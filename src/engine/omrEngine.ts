import type {
  AnswerKey,
  AppSettings,
  BubbleCoord,
  BubbleDensity,
  DigitRecognition,
  FiducialConfig,
  QualityMetrics,
  QuestionRecognition,
  RecognitionDetail,
  SheetTemplate,
} from '../types/omr';
import { ensureOpenCVReady, getCV } from './opencvLoader';
import { scoreRecognitionAgainstKey, type ScoredOutput } from './scoring';

export interface OMRProcessSingleResult {
  pairedSlot?: 1 | 2;
  warpedDataUrl: string;
  qualityMetrics: QualityMetrics;
  recognition: RecognitionDetail;
  scored: ScoredOutput;
  reviewReasons: string[];
  status: 'graded' | 'needs_review';
}

export interface LiveCameraDetection {
  fiducialsFound: number;
  cornersNorm: { x: number; y: number }[];
  brightness: number;
  blurScore: number;
  skewDeg: number;
  isStableReady: boolean;
  warning: string | null;
}

interface Point2D {
  x: number;
  y: number;
  area?: number;
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được dữ liệu hình ảnh bài thi.'));
    img.src = src;
  });
}

export async function imageSourceToCanvas(
  source: HTMLCanvasElement | HTMLImageElement | string
): Promise<HTMLCanvasElement> {
  if (source instanceof HTMLCanvasElement) return source;
  const img = typeof source === 'string' ? await loadImageElement(source) : source;
  const c = document.createElement('canvas');
  c.width = img.naturalWidth || img.width;
  c.height = img.naturalHeight || img.height;
  const ctx = c.getContext('2d')!;
  ctx.drawImage(img, 0, 0);
  return c;
}

// Step 2: Assess brightness, contrast, blur (Laplacian variance), shadow variance
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function computeImageQuality(cv: any, grayMat: any, settings: AppSettings): Omit<QualityMetrics, 'skewDeg' | 'detectedFiducials'> {
  const meanMat = new cv.Mat();
  const stdMat = new cv.Mat();
  const lap = new cv.Mat();
  const lapMean = new cv.Mat();
  const lapStd = new cv.Mat();

  try {
    cv.meanStdDev(grayMat, meanMat, stdMat);
    const brightness = meanMat.data64F[0] || 0;
    const contrast = stdMat.data64F[0] || 0;

    cv.Laplacian(grayMat, lap, cv.CV_64F);
    cv.meanStdDev(lap, lapMean, lapStd);
    const lapStdVal = lapStd.data64F[0] || 0;
    const blurScore = lapStdVal * lapStdVal;

    // Check quadrant brightness difference for shadow detection
    const w = grayMat.cols;
    const h = grayMat.rows;
    const hw = Math.floor(w / 2);
    const hh = Math.floor(h / 2);
    let hasShadowWarning = false;
    if (hw > 10 && hh > 10) {
      const qMeans: number[] = [];
      const rects = [
        new cv.Rect(0, 0, hw, hh),
        new cv.Rect(hw, 0, w - hw, hh),
        new cv.Rect(0, hh, hw, h - hh),
        new cv.Rect(hw, hh, w - hw, h - hh),
      ];
      for (const r of rects) {
        const roi = grayMat.roi(r);
        const m = cv.mean(roi);
        qMeans.push(m[0]);
        roi.delete();
      }
      const maxQ = Math.max(...qMeans);
      const minQ = Math.min(...qMeans);
      if (maxQ - minQ > 55) hasShadowWarning = true;
    }

    return {
      brightness: Math.round(brightness * 10) / 10,
      contrast: Math.round(contrast * 10) / 10,
      blurScore: Math.round(blurScore * 10) / 10,
      isLowLight: brightness < settings.darkMinBrightness,
      isBlurry: blurScore < settings.blurMinScore,
      hasShadowWarning,
    };
  } finally {
    meanMat.delete();
    stdMat.delete();
    lap.delete();
    lapMean.delete();
    lapStd.delete();
  }
}

// Step 4-7: Illumination normalization + contour detection for solid square fiducials
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function detectSquareFiducialCandidates(cv: any, grayMat: any, regionRect?: { x: number; y: number; w: number; h: number }): Point2D[] {
  const workGray = regionRect
    ? grayMat.roi(new cv.Rect(regionRect.x, regionRect.y, regionRect.w, regionRect.h))
    : grayMat;

  const blurred = new cv.Mat();
  const thresh = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();
  const candidates: Point2D[] = [];

  try {
    const w = workGray.cols;
    const h = workGray.rows;
    const blockSize = Math.max(15, (Math.round(Math.min(w, h) / 28) | 1));
    cv.GaussianBlur(workGray, blurred, new cv.Size(5, 5), 0);
    cv.adaptiveThreshold(
      blurred,
      thresh,
      255,
      cv.ADAPTIVE_THRESH_GAUSSIAN_C,
      cv.THRESH_BINARY_INV,
      blockSize,
      12
    );

    cv.findContours(thresh, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
    const totalArea = w * h;
    const minArea = totalArea * 0.00012;
    const maxArea = totalArea * 0.015;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area < minArea || area > maxArea) {
        cnt.delete();
        continue;
      }
      const rect = cv.boundingRect(cnt);
      const aspect = rect.width / Math.max(1, rect.height);
      const rectArea = rect.width * rect.height;
      const extent = area / Math.max(1, rectArea);

      // Solid square fiducial checks
      if (aspect >= 0.65 && aspect <= 1.45 && extent >= 0.68) {
        // Also check perimeter approximation
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.06 * peri, true);
        const verts = approx.rows;
        approx.delete();

        if (verts >= 4 && verts <= 8) {
          // Verify actual dark intensity inside the bounding box
          const roi = workGray.roi(rect);
          const meanVal = cv.mean(roi)[0];
          roi.delete();
          if (meanVal < 145) {
            candidates.push({
              x: rect.x + rect.width / 2 + (regionRect?.x || 0),
              y: rect.y + rect.height / 2 + (regionRect?.y || 0),
              area,
            });
          }
        }
      }
      cnt.delete();
    }
    return candidates;
  } finally {
    if (regionRect) workGray.delete();
    blurred.delete();
    thresh.delete();
    contours.delete();
    hierarchy.delete();
  }
}

interface CornerMatchResult {
  corners: [Point2D, Point2D, Point2D, Point2D] | null; // TL, TR, BR, BL in canonical orientation
  detectedCount: number;
  rotationDeg: 0 | 90 | 180 | 270;
  skewDeg: number;
}

function matchCornerFiducials(
  candidates: Point2D[],
  imgW: number,
  imgH: number,
  fiducials: FiducialConfig,
  searchBounds?: { x: number; y: number; w: number; h: number }
): CornerMatchResult {
  const bx = searchBounds ? searchBounds.x : 0;
  const by = searchBounds ? searchBounds.y : 0;
  const bw = searchBounds ? searchBounds.w : imgW;
  const bh = searchBounds ? searchBounds.h : imgH;

  // Pick closest candidate near each extreme corner of the search box (within 22% margin of corner)
  const marginX = bw * 0.25;
  const marginY = bh * 0.25;

  const pickNear = (tx: number, ty: number): Point2D | null => {
    let best: Point2D | null = null;
    let bestDist = Infinity;
    for (const c of candidates) {
      if (Math.abs(c.x - tx) > marginX || Math.abs(c.y - ty) > marginY) continue;
      // Filter out smaller orientation anchor by requiring area close to main markers when available
      const d = Math.hypot(c.x - tx, c.y - ty);
      if (d < bestDist) {
        bestDist = d;
        best = c;
      }
    }
    return best;
  };

  // Pick the largest-area candidate near each corner first to avoid picking the smaller orientationAnchor
  const pickCornerSquare = (tx: number, ty: number): Point2D | null => {
    const near = candidates
      .filter((c) => Math.abs(c.x - tx) <= marginX && Math.abs(c.y - ty) <= marginY)
      .sort((a, b) => (b.area || 0) - (a.area || 0));
    if (near.length === 0) return null;
    const maxA = near[0].area || 1;
    // Keep only main-size fiducials (> 55% of largest near corner) and pick closest to corner
    const mainSized = near.filter((c) => (c.area || 0) >= maxA * 0.55);
    mainSized.sort((a, b) => Math.hypot(a.x - tx, a.y - ty) - Math.hypot(b.x - tx, b.y - ty));
    return mainSized[0] || near[0];
  };

  const cTL = pickCornerSquare(bx + bw * 0.04, by + bh * 0.04);
  const cTR = pickCornerSquare(bx + bw * 0.96, by + bh * 0.04);
  const cBR = pickCornerSquare(bx + bw * 0.96, by + bh * 0.96);
  const cBL = pickCornerSquare(bx + bw * 0.04, by + bh * 0.96);

  const found = [cTL, cTR, cBR, cBL].filter(Boolean) as Point2D[];
  if (found.length < 4 || !cTL || !cTR || !cBR || !cBL) {
    return {
      corners: null,
      detectedCount: found.length,
      rotationDeg: 0,
      skewDeg: 0,
    };
  }

  // Resolve 0 / 90 / 180 / 270 degree rotation using orientationAnchor (smaller square near TL)
  // Look for a smaller candidate (30%..75% of corner marker area) adjacent to one of the 4 corners
  const avgMainArea =
    ((cTL.area || 1) + (cTR.area || 1) + (cBR.area || 1) + (cBL.area || 1)) / 4;
  const distScale = Math.hypot(cTR.x - cTL.x, cTR.y - cTL.y);
  const smallAnchors = candidates.filter((c) => {
    const a = c.area || 0;
    return a >= avgMainArea * 0.18 && a <= avgMainArea * 0.65;
  });

  let rotationDeg: 0 | 90 | 180 | 270 = 0;
  // Check which corner has an orientation anchor within 10% of sheet width
  const cornerPts = [
    { deg: 0 as const, pt: cTL },
    { deg: 90 as const, pt: cTR },
    { deg: 180 as const, pt: cBR },
    { deg: 270 as const, pt: cBL },
  ];

  let bestAnchorDist = Infinity;
  for (const cp of cornerPts) {
    for (const sa of smallAnchors) {
      const d = Math.hypot(sa.x - cp.pt.x, sa.y - cp.pt.y);
      if (d > distScale * 0.015 && d < distScale * 0.14 && d < bestAnchorDist) {
        bestAnchorDist = d;
        rotationDeg = cp.deg;
      }
    }
  }

  // Also ensure if image aspect ratio is swapped vs canonical fiducials (e.g. rotated 90/270), verify
  let ordered: [Point2D, Point2D, Point2D, Point2D];
  if (rotationDeg === 0) {
    ordered = [cTL, cTR, cBR, cBL];
  } else if (rotationDeg === 90) {
    // Top-left of physical sheet is currently at Top-Right of image -> rotate -90 deg
    ordered = [cTR, cBR, cBL, cTL];
  } else if (rotationDeg === 180) {
    ordered = [cBR, cBL, cTL, cTR];
  } else {
    // 270
    ordered = [cBL, cTL, cTR, cBR];
  }

  // Compute skew angle from top edge
  const dx = ordered[1].x - ordered[0].x;
  const dy = ordered[1].y - ordered[0].y;
  const skewDeg = Math.round(((Math.atan2(dy, dx) * 180) / Math.PI) * 10) / 10;

  void fiducials;
  void pickNear;

  return {
    corners: ordered,
    detectedCount: 4,
    rotationDeg,
    skewDeg,
  };
}

// Step 10: Perspective warp from detected 4 fiducials to exact canonical fiducial coordinates
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function warpToCanonical(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  srcMat: any,
  srcCorners: [Point2D, Point2D, Point2D, Point2D],
  dstW: number,
  dstH: number,
  fid: FiducialConfig
) {
  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    srcCorners[0].x,
    srcCorners[0].y,
    srcCorners[1].x,
    srcCorners[1].y,
    srcCorners[2].x,
    srcCorners[2].y,
    srcCorners[3].x,
    srcCorners[3].y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    fid.topLeft.x * dstW,
    fid.topLeft.y * dstH,
    fid.topRight.x * dstW,
    fid.topRight.y * dstH,
    fid.bottomRight.x * dstW,
    fid.bottomRight.y * dstH,
    fid.bottomLeft.x * dstW,
    fid.bottomLeft.y * dstH,
  ]);

  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat();
  try {
    cv.warpPerspective(
      srcMat,
      warped,
      M,
      new cv.Size(dstW, dstH),
      cv.INTER_LINEAR,
      cv.BORDER_CONSTANT,
      new cv.Scalar(255, 255, 255, 255)
    );
    return warped;
  } finally {
    srcTri.delete();
    dstTri.delete();
    M.delete();
  }
}

// Step 11-13: Measure illumination-normalized dark pixel density for every bubble
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function measureBubblesOnWarped(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cv: any,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  warpedRgba: any,
  bubbles: BubbleCoord[],
  settings: AppSettings
): Map<string, BubbleDensity> {
  const gray = new cv.Mat();
  const bgBlur = new cv.Mat();
  const norm = new cv.Mat();
  const coreDark = new cv.Mat();
  const faintDark = new cv.Mat();
  const result = new Map<string, BubbleDensity>();

  try {
    cv.cvtColor(warpedRgba, gray, cv.COLOR_RGBA2GRAY);
    const W = gray.cols;
    const H = gray.rows;

    // Illumination normalization (divides local gray by large background blur to eliminate shadows!)
    const kSize = Math.max(31, (Math.round(W / 18) | 1));
    cv.GaussianBlur(gray, bgBlur, new cv.Size(kSize, kSize), 0);
    cv.divide(gray, bgBlur, norm, 255, -1);

    // Thresholds on shadow-normalized luminance [0..255]:
    // Solid pencil/pen fill < 165; faint / erased smudge < 215
    cv.threshold(norm, coreDark, 165, 255, cv.THRESH_BINARY_INV);
    cv.threshold(norm, faintDark, 212, 255, cv.THRESH_BINARY_INV);

    const coreData = coreDark.data as Uint8Array;
    const faintData = faintDark.data as Uint8Array;

    for (const b of bubbles) {
      const cxPx = b.cx * W;
      const cyPx = b.cy * H;
      const rxPx = Math.max(4, b.rx * W);
      const ryPx = Math.max(4, b.ry * H);

      // Sample inner core (0.72 * r) to avoid printed circle outline, and outer halo (1.05..1.45 * r) for erasure
      const xMin = Math.max(0, Math.floor(cxPx - rxPx * 1.45));
      const xMax = Math.min(W - 1, Math.ceil(cxPx + rxPx * 1.45));
      const yMin = Math.max(0, Math.floor(cyPx - ryPx * 1.45));
      const yMax = Math.min(H - 1, Math.ceil(cyPx + ryPx * 1.45));

      let coreTotal = 0;
      let coreDarkCount = 0;
      let coreFaintCount = 0;
      let ringTotal = 0;
      let ringSmudgeCount = 0;

      for (let y = yMin; y <= yMax; y++) {
        const dy = (y - cyPx) / ryPx;
        const rowOffset = y * W;
        for (let x = xMin; x <= xMax; x++) {
          const dx = (x - cxPx) / rxPx;
          const dist2 = dx * dx + dy * dy;
          const idx = rowOffset + x;
          if (dist2 <= 0.52) {
            // Core (r <= 0.72)
            coreTotal++;
            if (coreData[idx] > 0) coreDarkCount++;
            else if (faintData[idx] > 0) coreFaintCount++;
          } else if (dist2 >= 1.15 && dist2 <= 2.1) {
            // Outer halo ring (1.07 <= r <= 1.45) - detects erasure smudges outside circle
            ringTotal++;
            if (faintData[idx] > 0) ringSmudgeCount++;
          }
        }
      }

      // Weighted fillRatio combines solid dark pixels + 0.55 * faint pixels inside core
      const fillRatio =
        coreTotal > 0 ? (coreDarkCount + coreFaintCount * 0.55) / coreTotal : 0;
      const ringRatio = ringTotal > 0 ? ringSmudgeCount / ringTotal : 0;

      result.set(b.id, {
        bubbleId: b.id,
        option: b.option,
        fillRatio: Math.round(fillRatio * 1000) / 1000,
        ringRatio: Math.round(ringRatio * 1000) / 1000,
        cx: b.cx,
        cy: b.cy,
        rx: b.rx,
        ry: b.ry,
        isMarked: fillRatio >= settings.fillThreshold,
      });
    }

    return result;
  } finally {
    gray.delete();
    bgBlur.delete();
    norm.delete();
    coreDark.delete();
    faintDark.delete();
  }
}

function evaluateDigitColumn(
  colBubbles: BubbleCoord[],
  densities: Map<string, BubbleDensity>,
  settings: AppSettings,
  colIdx: number
): DigitRecognition {
  const list = colBubbles
    .map((b) => densities.get(b.id)!)
    .filter(Boolean)
    .sort((a, b) => b.fillRatio - a.fillRatio);

  if (list.length === 0) {
    return { col: colIdx, detectedDigit: '?', confidence: 0, status: 'blank', bubbles: [] };
  }

  const top = list[0];
  const second = list[1];

  if (top.fillRatio < settings.faintThreshold) {
    return { col: colIdx, detectedDigit: '?', confidence: 0, status: 'blank', bubbles: list };
  }
  if (
    second &&
    second.fillRatio >= settings.faintThreshold &&
    top.fillRatio - second.fillRatio < settings.multiMarkDelta
  ) {
    return { col: colIdx, detectedDigit: '?', confidence: 0.25, status: 'multi_mark', bubbles: list };
  }
  if (top.fillRatio < settings.fillThreshold) {
    return {
      col: colIdx,
      detectedDigit: top.option,
      confidence: 0.55,
      status: 'faint',
      bubbles: list,
    };
  }
  return {
    col: colIdx,
    detectedDigit: top.option,
    confidence: Math.min(1, top.fillRatio / Math.max(0.5, settings.fillThreshold + 0.2)),
    status: 'ok',
    bubbles: list,
  };
}

function evaluateChoiceGroup(
  groupBubbles: BubbleCoord[],
  densities: Map<string, BubbleDensity>,
  settings: AppSettings
): {
  detectedValue: string;
  status: QuestionRecognition['status'];
  confidence: number;
  bubbles: BubbleDensity[];
  note?: string;
} {
  const list = groupBubbles
    .map((b) => densities.get(b.id)!)
    .filter(Boolean);
  const sorted = [...list].sort((a, b) => b.fillRatio - a.fillRatio);
  if (sorted.length === 0) {
    return { detectedValue: '', status: 'unrecognized', confidence: 0, bubbles: [] };
  }

  const top = sorted[0];
  const second = sorted[1];

  // Check if all bubbles are below faint threshold -> blank
  if (top.fillRatio < settings.faintThreshold) {
    // Still check for erasure residue across all bubbles
    const erased = sorted.find((b) => b.ringRatio >= settings.eraseRingThreshold);
    if (erased) {
      return {
        detectedValue: '',
        status: 'erased',
        confidence: 0.4,
        bubbles: list,
        note: `Phát hiện dấu tẩy xóa ở ô ${erased.option}`,
      };
    }
    return { detectedValue: '', status: 'blank', confidence: 0.95, bubbles: list };
  }

  // Multiple bubbles clearly marked OR top two have close fill levels -> multi_mark (never guess randomly!)
  const clearlyMarked = sorted.filter((b) => b.fillRatio >= settings.fillThreshold);
  if (clearlyMarked.length > 1) {
    return {
      detectedValue: '',
      status: 'multi_mark',
      confidence: 0.15,
      bubbles: list,
      note: `Tô nhiều đáp án: ${clearlyMarked.map((b) => b.option).join(', ')}`,
    };
  }

  if (
    second &&
    second.fillRatio >= settings.faintThreshold &&
    top.fillRatio - second.fillRatio < settings.multiMarkDelta
  ) {
    return {
      detectedValue: '',
      status: 'multi_mark',
      confidence: 0.2,
      bubbles: list,
      note: `Mức độ tô gần bằng nhau giữa ${top.option} và ${second.option}`,
    };
  }

  // Faint mark
  if (top.fillRatio < settings.fillThreshold) {
    return {
      detectedValue: top.option,
      status: 'faint',
      confidence: 0.5,
      bubbles: list,
      note: `Ô ${top.option} tô mờ (${Math.round(top.fillRatio * 100)}%)`,
    };
  }

  // Check if another bubble had erasure smudge while one bubble is solidly filled
  const erasedOther = sorted.find(
    (b) => b.option !== top.option && b.ringRatio >= settings.eraseRingThreshold
  );
  if (erasedOther) {
    return {
      detectedValue: top.option,
      status: 'erased',
      confidence: 0.65,
      bubbles: list,
      note: `Ô ${erasedOther.option} có dấu tẩy xóa, ô chọn chính: ${top.option}`,
    };
  }

  return {
    detectedValue: top.option,
    status: 'pending_review', // Will be scored against key to become correct/wrong
    confidence: Math.min(1, top.fillRatio + 0.25),
    bubbles: list,
  };
}

function decodeSubSheet(
  template: SheetTemplate,
  bubbles: BubbleCoord[],
  densities: Map<string, BubbleDensity>,
  settings: AppSettings,
  detectedFiducialsCount: number,
  rotationDeg: 0 | 90 | 180 | 270
): RecognitionDetail {
  const reviewFlagReasons: string[] = [];

  // SBD
  const sbdDigits: DigitRecognition[] = [];
  for (let c = 0; c < template.sbdDigits; c++) {
    const colB = bubbles.filter((b) => b.kind === 'sbd' && b.col === c);
    sbdDigits.push(evaluateDigitColumn(colB, densities, settings, c));
  }
  const sbd = sbdDigits.map((d) => d.detectedDigit).join('');
  const sbdConfidence =
    sbdDigits.length > 0
      ? sbdDigits.reduce((a, b) => a + b.confidence, 0) / sbdDigits.length
      : 0;

  // Exam Code
  const examCodeDigits: DigitRecognition[] = [];
  for (let c = 0; c < template.examCodeDigits; c++) {
    const colB = bubbles.filter((b) => b.kind === 'exam_code' && b.col === c);
    examCodeDigits.push(evaluateDigitColumn(colB, densities, settings, c));
  }
  const examCode = examCodeDigits.map((d) => d.detectedDigit).join('');
  const examCodeConfidence =
    examCodeDigits.length > 0
      ? examCodeDigits.reduce((a, b) => a + b.confidence, 0) / examCodeDigits.length
      : 0;

  // Phách Code (if applicable)
  let phachCode: string | undefined;
  let phachConfidence: number | undefined;
  let phachDigits: DigitRecognition[] | undefined;
  if (template.phachDigits && template.phachDigits > 0) {
    phachDigits = [];
    for (let c = 0; c < template.phachDigits; c++) {
      const colB = bubbles.filter((b) => b.kind === 'phach_code' && b.col === c);
      phachDigits.push(evaluateDigitColumn(colB, densities, settings, c));
    }
    phachCode = phachDigits.map((d) => d.detectedDigit).join('');
    phachConfidence =
      phachDigits.reduce((a, b) => a + b.confidence, 0) / phachDigits.length;
  }

  const questions: QuestionRecognition[] = [];

  // Part I
  for (let q = 1; q <= template.part1Count; q++) {
    const qB = bubbles.filter((b) => b.kind === 'part1' && b.question === q);
    const evalRes = evaluateChoiceGroup(qB, densities, settings);
    questions.push({
      part: 'part1',
      question: q,
      detectedValue: evalRes.detectedValue,
      correctValue: '',
      status: evalRes.status,
      confidence: evalRes.confidence,
      earnedPoints: 0,
      maxPoints: 0,
      bubbles: evalRes.bubbles,
      note: evalRes.note,
    });
  }

  // Part II
  const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  for (let q = 1; q <= template.part2Count; q++) {
    for (const sk of subKeys) {
      const qB = bubbles.filter(
        (b) => b.kind === 'part2' && b.question === q && b.subItem === sk
      );
      const evalRes = evaluateChoiceGroup(qB, densities, settings);
      questions.push({
        part: 'part2',
        question: q,
        subItem: sk,
        detectedValue: evalRes.detectedValue,
        correctValue: '',
        status: evalRes.status,
        confidence: evalRes.confidence,
        earnedPoints: 0,
        maxPoints: 0,
        bubbles: evalRes.bubbles,
        note: evalRes.note,
      });
    }
  }

  // Part III (short answer columns)
  for (let q = 1; q <= template.part3Count; q++) {
    const colVals: string[] = [];
    const allQBubbles: BubbleDensity[] = [];
    let qStatus: QuestionRecognition['status'] = 'pending_review';
    let qConfSum = 0;
    let hasAnyMark = false;
    let hasIssue = false;
    let issueNote = '';

    for (let col = 0; col < template.part3ColsPerQuestion; col++) {
      const colB = bubbles.filter(
        (b) => b.kind === 'part3' && b.question === q && b.col === col
      );
      const evalRes = evaluateChoiceGroup(colB, densities, settings);
      allQBubbles.push(...evalRes.bubbles);
      qConfSum += evalRes.confidence;

      if (evalRes.status === 'multi_mark' || evalRes.status === 'faint' || evalRes.status === 'erased') {
        hasIssue = true;
        qStatus = evalRes.status;
        issueNote = `Cột ${col + 1}: ${evalRes.note || evalRes.status}`;
      }
      if (evalRes.detectedValue) {
        hasAnyMark = true;
        colVals.push(evalRes.detectedValue);
      } else if (hasAnyMark && col < template.part3ColsPerQuestion - 1) {
        // Gap between filled columns
        colVals.push(' ');
      }
    }

    const rawStr = colVals.join('').trim();
    if (!hasAnyMark && !hasIssue) {
      qStatus = 'blank';
    } else if (!hasIssue) {
      // Validate numeric syntax (e.g. cannot start with ',', cannot have multiple ',' or internal '-')
      const cleanStr = rawStr.replace(/\s+/g, '');
      const commaCount = (cleanStr.match(/,/g) || []).length;
      const validSyntax =
        !cleanStr.includes(' ') &&
        commaCount <= 1 &&
        !/^,/.test(cleanStr) &&
        !/,$/.test(cleanStr) &&
        /^-?\d+(,\d+)?$/.test(cleanStr);
      if (!validSyntax) {
        qStatus = 'unrecognized';
        issueNote = `Chuỗi số không hợp lệ: "${rawStr}"`;
      }
    }

    questions.push({
      part: 'part3',
      question: q,
      detectedValue: rawStr.replace(/\s+/g, ''),
      correctValue: '',
      status: qStatus,
      confidence: qConfSum / Math.max(1, template.part3ColsPerQuestion),
      earnedPoints: 0,
      maxPoints: 0,
      bubbles: allQBubbles,
      note: issueNote || undefined,
    });
  }

  void reviewFlagReasons;
  const overallConfidence =
    questions.length > 0
      ? questions.reduce((a, b) => a + b.confidence, 0) / questions.length
      : 0;

  return {
    rotationDeg,
    detectedFiducialsCount,
    templateMatched: detectedFiducialsCount === 4,
    sbd,
    sbdConfidence,
    sbdDigits,
    examCode,
    examCodeConfidence,
    examCodeDigits,
    phachCode,
    phachConfidence,
    phachDigits,
    questions,
    overallConfidence: Math.round(overallConfidence * 100) / 100,
  };
}

export async function processSheetImageWithOpenCV(
  source: HTMLCanvasElement | HTMLImageElement | string,
  template: SheetTemplate,
  answerKeysForExam: AnswerKey[],
  settings: AppSettings
): Promise<OMRProcessSingleResult[]> {
  await ensureOpenCVReady();
  const cv = getCV();
  if (!cv) {
    throw new Error('Bộ máy nhận dạng OpenCV.js chưa sẵn sàng.');
  }

  const srcCanvas = await imageSourceToCanvas(source);
  const srcMat = cv.imread(srcCanvas);
  const gray = new cv.Mat();

  try {
    cv.cvtColor(srcMat, gray, cv.COLOR_RGBA2GRAY);
    const baseQuality = computeImageQuality(cv, gray, settings);
    const allCandidates = detectSquareFiducialCandidates(cv, gray);

    // Handle Paired A5 (2 sheets on 1 A4) vs Single sheet
    const slots: {
      pairedSlot?: 1 | 2;
      fiducials: FiducialConfig;
      searchBounds?: { x: number; y: number; w: number; h: number };
      bubbles: BubbleCoord[];
    }[] =
      template.category === 'paired_a5' && template.pairedSubSheets
        ? template.pairedSubSheets.map((sub) => ({
            pairedSlot: sub.slot,
            fiducials: sub.fiducials,
            searchBounds: {
              x: Math.round(sub.bounds.x * srcMat.cols),
              y: Math.round(sub.bounds.y * srcMat.rows),
              w: Math.round(sub.bounds.w * srcMat.cols),
              h: Math.round(sub.bounds.h * srcMat.rows),
            },
            bubbles: template.bubbles.filter((b) => b.pairedSlot === sub.slot),
          }))
        : [
            {
              pairedSlot: undefined,
              fiducials: template.fiducials,
              searchBounds: undefined,
              bubbles: template.bubbles,
            },
          ];

    const outputs: OMRProcessSingleResult[] = [];

    for (const slot of slots) {
      const cornerMatch = matchCornerFiducials(
        allCandidates,
        srcMat.cols,
        srcMat.rows,
        slot.fiducials,
        slot.searchBounds
      );

      let warpedMat;
      if (cornerMatch.corners) {
        warpedMat = warpToCanonical(
          cv,
          srcMat,
          cornerMatch.corners,
          template.widthPx,
          template.heightPx,
          slot.fiducials
        );
      } else {
        // Fallback resize to canonical canvas ONLY so teacher can inspect in Review view,
        // while strictly flagging missing fiducials and blocking official auto-grading!
        warpedMat = new cv.Mat();
        cv.resize(
          srcMat,
          warpedMat,
          new cv.Size(template.widthPx, template.heightPx),
          0,
          0,
          cv.INTER_LINEAR
        );
      }

      try {
        const warpedCanvas = document.createElement('canvas');
        cv.imshow(warpedCanvas, warpedMat);
        const warpedDataUrl = warpedCanvas.toDataURL('image/jpeg', 0.86);

        const densities = measureBubblesOnWarped(cv, warpedMat, slot.bubbles, settings);
        const recognition = decodeSubSheet(
          template,
          slot.bubbles,
          densities,
          settings,
          cornerMatch.detectedCount,
          cornerMatch.rotationDeg
        );

        const matchedKey = answerKeysForExam.find(
          (k) => k.examCode.trim() === recognition.examCode.trim()
        );

        const reviewReasons: string[] = [];
        if (cornerMatch.detectedCount < 4) {
          reviewReasons.push(
            `Thiếu điểm định vị góc (${cornerMatch.detectedCount}/4 điểm)`
          );
        }
        if (baseQuality.isLowLight) {
          reviewReasons.push(`Ảnh thiếu sáng (độ sáng ${baseQuality.brightness})`);
        }
        if (baseQuality.isBlurry) {
          reviewReasons.push(`Ảnh bị mờ (độ nét ${baseQuality.blurScore})`);
        }
        if (recognition.sbd.includes('?')) {
          reviewReasons.push(`Số báo danh chưa rõ (${recognition.sbd})`);
        }
        if (recognition.examCode.includes('?')) {
          reviewReasons.push(`Mã đề chưa rõ (${recognition.examCode})`);
        } else if (!matchedKey) {
          reviewReasons.push(
            `Không tìm thấy đáp án cho mã đề "${recognition.examCode}"`
          );
        }

        const issueQuestions = recognition.questions.filter(
          (q) =>
            q.status === 'multi_mark' ||
            q.status === 'faint' ||
            q.status === 'erased' ||
            q.status === 'unrecognized'
        );
        if (issueQuestions.length > 0) {
          reviewReasons.push(
            `${issueQuestions.length} câu cần kiểm duyệt (tô mờ / nhiều đáp án / tẩy xóa)`
          );
        }

        // Strict rule: do NOT assign official score if template fiducials missing or examCode unidentified
        const canScoreOfficially = cornerMatch.detectedCount === 4 && !!matchedKey;
        const scored = scoreRecognitionAgainstKey(
          recognition.questions,
          canScoreOfficially ? matchedKey : undefined
        );
        recognition.questions = scored.questions;

        const status: 'graded' | 'needs_review' =
          reviewReasons.length > 0 || !canScoreOfficially ? 'needs_review' : 'graded';

        outputs.push({
          pairedSlot: slot.pairedSlot,
          warpedDataUrl,
          qualityMetrics: {
            ...baseQuality,
            skewDeg: cornerMatch.skewDeg,
            detectedFiducials: cornerMatch.detectedCount,
          },
          recognition,
          scored,
          reviewReasons,
          status,
        });
      } finally {
        warpedMat.delete();
      }
    }

    return outputs;
  } finally {
    srcMat.delete();
    gray.delete();
  }
}

// Fast live detection for Camera overlay
export function detectLiveSheetForCamera(
  videoOrCanvas: HTMLVideoElement | HTMLCanvasElement,
  template: SheetTemplate,
  settings: AppSettings
): LiveCameraDetection {
  const cv = getCV();
  if (!cv) {
    return {
      fiducialsFound: 0,
      cornersNorm: [],
      brightness: 0,
      blurScore: 0,
      skewDeg: 0,
      isStableReady: false,
      warning: 'Đang khởi tạo OpenCV.js...',
    };
  }

  const vw =
    videoOrCanvas instanceof HTMLVideoElement
      ? videoOrCanvas.videoWidth
      : videoOrCanvas.width;
  const vh =
    videoOrCanvas instanceof HTMLVideoElement
      ? videoOrCanvas.videoHeight
      : videoOrCanvas.height;

  if (!vw || !vh) {
    return {
      fiducialsFound: 0,
      cornersNorm: [],
      brightness: 0,
      blurScore: 0,
      skewDeg: 0,
      isStableReady: false,
      warning: 'Đang chờ khung hình camera...',
    };
  }

  // Downscale to 640px max side for responsive real-time detection across devices
  const scale = Math.min(1, 640 / Math.max(vw, vh));
  const dw = Math.round(vw * scale);
  const dh = Math.round(vh * scale);
  const tmp = document.createElement('canvas');
  tmp.width = dw;
  tmp.height = dh;
  tmp.getContext('2d')!.drawImage(videoOrCanvas, 0, 0, dw, dh);

  const src = cv.imread(tmp);
  const gray = new cv.Mat();
  try {
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    const quality = computeImageQuality(cv, gray, settings);
    const cands = detectSquareFiducialCandidates(cv, gray);
    const match = matchCornerFiducials(cands, dw, dh, template.fiducials);

    const cornersNorm = match.corners
      ? match.corners.map((p) => ({ x: p.x / dw, y: p.y / dh }))
      : cands.slice(0, 4).map((p) => ({ x: p.x / dw, y: p.y / dh }));

    let warning: string | null = null;
    if (quality.isLowLight) warning = 'Ánh sáng yếu – hãy bật đèn flash hoặc tăng sáng.';
    else if (quality.isBlurry) warning = 'Ảnh hơi mờ – giữ chắc điện thoại/giấy.';
    else if (match.detectedCount < 4) warning = `Tìm thấy ${match.detectedCount}/4 điểm định vị góc.`;
    else if (Math.abs(match.skewDeg) > 12) warning = `Phiếu bị nghiêng (${match.skewDeg}°).`;

    const isStableReady =
      match.detectedCount === 4 &&
      !quality.isLowLight &&
      !quality.isBlurry &&
      Math.abs(match.skewDeg) <= 15;

    return {
      fiducialsFound: match.detectedCount,
      cornersNorm,
      brightness: quality.brightness,
      blurScore: quality.blurScore,
      skewDeg: match.skewDeg,
      isStableReady,
      warning,
    };
  } finally {
    src.delete();
    gray.delete();
  }
}

// Step XIII: Smart Document Scanner corner detection & shadow-removal enhancement
export async function detectDocumentCorners(
  imageDataUrl: string
): Promise<{ x: number; y: number }[]> {
  await ensureOpenCVReady();
  const cv = getCV();
  const canvas = await imageSourceToCanvas(imageDataUrl);
  if (!cv) {
    return [
      { x: 0.05, y: 0.05 },
      { x: 0.95, y: 0.05 },
      { x: 0.95, y: 0.95 },
      { x: 0.05, y: 0.95 },
    ];
  }

  const src = cv.imread(canvas);
  const gray = new cv.Mat();
  const blur = new cv.Mat();
  const edges = new cv.Mat();
  const contours = new cv.MatVector();
  const hierarchy = new cv.Mat();

  try {
    const W = src.cols;
    const H = src.rows;
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blur, new cv.Size(5, 5), 0);
    cv.Canny(blur, edges, 50, 150);
    cv.findContours(edges, contours, hierarchy, cv.RETR_LIST, cv.CHAIN_APPROX_SIMPLE);

    let bestQuad: { x: number; y: number }[] | null = null;
    let bestArea = W * H * 0.15;

    for (let i = 0; i < contours.size(); i++) {
      const cnt = contours.get(i);
      const area = cv.contourArea(cnt);
      if (area > bestArea) {
        const peri = cv.arcLength(cnt, true);
        const approx = new cv.Mat();
        cv.approxPolyDP(cnt, approx, 0.02 * peri, true);
        if (approx.rows === 4) {
          const pts: { x: number; y: number }[] = [];
          for (let r = 0; r < 4; r++) {
            pts.push({
              x: approx.data32S[r * 2] / W,
              y: approx.data32S[r * 2 + 1] / H,
            });
          }
          bestArea = area;
          bestQuad = pts;
        }
        approx.delete();
      }
      cnt.delete();
    }

    if (bestQuad) {
      // Order TL, TR, BR, BL by sum and diff
      const sortedSum = [...bestQuad].sort((a, b) => a.x + a.y - (b.x + b.y));
      const tl = sortedSum[0];
      const br = sortedSum[3];
      const rem = [sortedSum[1], sortedSum[2]].sort((a, b) => a.y - a.x - (b.y - b.x));
      return [tl, rem[0], br, rem[1]];
    }

    return [
      { x: 0.06, y: 0.06 },
      { x: 0.94, y: 0.06 },
      { x: 0.94, y: 0.94 },
      { x: 0.06, y: 0.94 },
    ];
  } finally {
    src.delete();
    gray.delete();
    blur.delete();
    edges.delete();
    contours.delete();
    hierarchy.delete();
  }
}

export async function processDocumentScan(
  imageDataUrl: string,
  cornersNorm: { x: number; y: number }[], // TL, TR, BR, BL
  options: {
    rotationDeg: 0 | 90 | 180 | 270;
    mode: 'color' | 'grayscale' | 'bw';
    removeShadow: boolean;
    contrast: number; // 1.0 .. 1.8
    denoise: boolean;
  }
): Promise<string> {
  await ensureOpenCVReady();
  const cv = getCV();
  const canvas = await imageSourceToCanvas(imageDataUrl);
  const src = cv.imread(canvas);
  const W = src.cols;
  const H = src.rows;

  const pts = cornersNorm.map((p) => ({ x: p.x * W, y: p.y * H }));
  const topW = Math.hypot(pts[1].x - pts[0].x, pts[1].y - pts[0].y);
  const botW = Math.hypot(pts[2].x - pts[3].x, pts[2].y - pts[3].y);
  const leftH = Math.hypot(pts[3].x - pts[0].x, pts[3].y - pts[0].y);
  const rightH = Math.hypot(pts[2].x - pts[1].x, pts[2].y - pts[1].y);

  const outW = Math.max(400, Math.round(Math.max(topW, botW)));
  const outH = Math.max(400, Math.round(Math.max(leftH, rightH)));

  const srcTri = cv.matFromArray(4, 1, cv.CV_32FC2, [
    pts[0].x,
    pts[0].y,
    pts[1].x,
    pts[1].y,
    pts[2].x,
    pts[2].y,
    pts[3].x,
    pts[3].y,
  ]);
  const dstTri = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, outW, 0, outW, outH, 0, outH]);
  const M = cv.getPerspectiveTransform(srcTri, dstTri);
  const warped = new cv.Mat();
  const processed = new cv.Mat();

  try {
    cv.warpPerspective(src, warped, M, new cv.Size(outW, outH));

    if (options.rotationDeg !== 0) {
      const code =
        options.rotationDeg === 90
          ? cv.ROTATE_90_CLOCKWISE
          : options.rotationDeg === 180
          ? cv.ROTATE_180
          : cv.ROTATE_90_COUNTERCLOCKWISE;
      cv.rotate(warped, warped, code);
    }

    if (options.denoise) {
      cv.GaussianBlur(warped, warped, new cv.Size(3, 3), 0);
    }

    if (options.mode === 'color') {
      if (options.removeShadow) {
        // Normalize luminance channel in Lab color space so faint pencil marks remain intact
        const rgb = new cv.Mat();
        const gray = new cv.Mat();
        const bg = new cv.Mat();
        const norm = new cv.Mat();
        const ratio = new cv.Mat();
        cv.cvtColor(warped, rgb, cv.COLOR_RGBA2RGB);
        cv.cvtColor(rgb, gray, cv.COLOR_RGB2GRAY);
        const k = Math.max(41, (Math.round(warped.cols / 14) | 1));
        cv.GaussianBlur(gray, bg, new cv.Size(k, k), 0);
        cv.divide(gray, bg, norm, 255, -1);
        norm.convertTo(norm, -1, options.contrast, -12 * (options.contrast - 1));
        cv.cvtColor(norm, processed, cv.COLOR_GRAY2RGBA);
        // Blend lightly with original color to keep colored ink visible while whitening background
        cv.addWeighted(warped, 0.35, processed, 0.65, 0, processed);
        rgb.delete();
        gray.delete();
        bg.delete();
        norm.delete();
        ratio.delete();
      } else {
        warped.convertTo(processed, -1, options.contrast, 0);
      }
    } else if (options.mode === 'grayscale') {
      const gray = new cv.Mat();
      cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
      if (options.removeShadow) {
        const bg = new cv.Mat();
        const k = Math.max(41, (Math.round(warped.cols / 14) | 1));
        cv.GaussianBlur(gray, bg, new cv.Size(k, k), 0);
        cv.divide(gray, bg, gray, 255, -1);
        bg.delete();
      }
      gray.convertTo(gray, -1, options.contrast, 0);
      cv.cvtColor(gray, processed, cv.COLOR_GRAY2RGBA);
      gray.delete();
    } else {
      // B&W mode with shadow removal & adaptive threshold preserving pencil marks
      const gray = new cv.Mat();
      const bg = new cv.Mat();
      const norm = new cv.Mat();
      const bw = new cv.Mat();
      cv.cvtColor(warped, gray, cv.COLOR_RGBA2GRAY);
      if (options.removeShadow) {
        const k = Math.max(41, (Math.round(warped.cols / 14) | 1));
        cv.GaussianBlur(gray, bg, new cv.Size(k, k), 0);
        cv.divide(gray, bg, norm, 255, -1);
      } else {
        gray.copyTo(norm);
      }
      const block = Math.max(21, (Math.round(warped.cols / 35) | 1));
      cv.adaptiveThreshold(norm, bw, 255, cv.ADAPTIVE_THRESH_GAUSSIAN_C, cv.THRESH_BINARY, block, 14);
      cv.cvtColor(bw, processed, cv.COLOR_GRAY2RGBA);
      gray.delete();
      bg.delete();
      norm.delete();
      bw.delete();
    }

    const outCanvas = document.createElement('canvas');
    cv.imshow(outCanvas, processed);
    return outCanvas.toDataURL('image/jpeg', 0.92);
  } finally {
    src.delete();
    srcTri.delete();
    dstTri.delete();
    M.delete();
    warped.delete();
    processed.delete();
  }
}

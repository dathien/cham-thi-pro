import type {
  BubbleCoord,
  FiducialConfig,
  Orientation,
  PaperSize,
  SheetTemplate,
  TemplateCategory,
} from '../types/omr';

export interface TemplateSpec {
  id: string;
  version?: string;
  name: string;
  category: TemplateCategory;
  paperSize: PaperSize;
  orientation: Orientation;
  sbdDigits: number;
  examCodeDigits: number;
  phachDigits?: number;
  part1Count: number;
  part1Columns?: number;
  part2Count: number;
  part3Count: number;
  part3ColsPerQuestion?: number;
  isBuiltIn?: boolean;
  isOfficialVerified?: boolean;
  compatibilityNote?: string;
}

export function getCanonicalDimensions(paperSize: PaperSize, orientation: Orientation) {
  // Canonical pixel size at ~150 DPI equivalent for fast, crisp OMR warping
  const base =
    paperSize === 'A3'
      ? { w: 1754, h: 2480 }
      : paperSize === 'A5'
      ? { w: 874, h: 1240 }
      : { w: 1240, h: 1754 }; // A4
  return orientation === 'landscape'
    ? { widthPx: base.h, heightPx: base.w }
    : { widthPx: base.w, heightPx: base.h };
}

function defaultFiducials(): FiducialConfig {
  return {
    topLeft: { x: 0.045, y: 0.035 },
    topRight: { x: 0.955, y: 0.035 },
    bottomRight: { x: 0.955, y: 0.965 },
    bottomLeft: { x: 0.045, y: 0.965 },
    markerSizeNorm: 0.022,
    orientationAnchor: { x: 0.085, y: 0.035 },
  };
}

function buildSingleSheetBubbles(params: {
  originX: number;
  originY: number;
  areaW: number;
  areaH: number;
  sbdDigits: number;
  examCodeDigits: number;
  phachDigits?: number;
  part1Count: number;
  part1Columns: number;
  part2Count: number;
  part3Count: number;
  part3ColsPerQuestion: number;
  pairedSlot?: 1 | 2;
}): {
  bubbles: BubbleCoord[];
  rects: SheetTemplate['headerConfig'];
} {
  const {
    originX,
    originY,
    areaW,
    areaH,
    sbdDigits,
    examCodeDigits,
    phachDigits = 0,
    part1Count,
    part1Columns,
    part2Count,
    part3Count,
    part3ColsPerQuestion,
    pairedSlot,
  } = params;

  const bubbles: BubbleCoord[] = [];
  const prefix = pairedSlot ? `s${pairedSlot}_` : '';
  const px = (nx: number) => originX + nx * areaW;
  const py = (ny: number) => originY + ny * areaH;
  const pw = (nw: number) => nw * areaW;
  const ph = (nh: number) => nh * areaH;

  const showPhachStub = phachDigits > 0;
  const stubShift = showPhachStub ? 0.24 : 0; // left 24% reserved for student stub on Phách sheet

  // Top metadata zone: 0.06 .. 0.30 (vertical)
  const metaTop = 0.09;
  const metaHeight = 0.21;

  // SBD box on top-right area
  const sbdW = Math.min(0.24, Math.max(0.12, sbdDigits * 0.028));
  const examW = Math.min(0.14, Math.max(0.08, examCodeDigits * 0.028));
  const examX = 0.94 - examW;
  const sbdX = examX - 0.02 - sbdW;

  const sbdRect = {
    x: px(sbdX),
    y: py(metaTop),
    w: pw(sbdW),
    h: ph(metaHeight),
  };
  const examCodeRect = {
    x: px(examX),
    y: py(metaTop),
    w: pw(examW),
    h: ph(metaHeight),
  };

  // Generate SBD bubbles (digits 0..9 vertically)
  const digitRows = 10;
  const sbdRadiusX = pw(Math.min(0.0085, (sbdW / (sbdDigits + 1)) * 0.32));
  const sbdRadiusY = ph(0.0072);

  for (let col = 0; col < sbdDigits; col++) {
    const cx = px(sbdX + ((col + 0.5) / sbdDigits) * sbdW);
    for (let d = 0; d < digitRows; d++) {
      const cy = py(metaTop + 0.032 + ((d + 0.5) / digitRows) * (metaHeight - 0.038));
      bubbles.push({
        id: `${prefix}sbd_c${col}_${d}`,
        kind: 'sbd',
        col,
        option: String(d),
        cx,
        cy,
        rx: sbdRadiusX,
        ry: sbdRadiusY,
        pairedSlot,
      });
    }
  }

  // Generate Exam Code bubbles (digits 0..9 vertically)
  const examRadiusX = pw(Math.min(0.0085, (examW / (examCodeDigits + 1)) * 0.32));
  for (let col = 0; col < examCodeDigits; col++) {
    const cx = px(examX + ((col + 0.5) / examCodeDigits) * examW);
    for (let d = 0; d < digitRows; d++) {
      const cy = py(metaTop + 0.032 + ((d + 0.5) / digitRows) * (metaHeight - 0.038));
      bubbles.push({
        id: `${prefix}code_c${col}_${d}`,
        kind: 'exam_code',
        col,
        option: String(d),
        cx,
        cy,
        rx: examRadiusX,
        ry: sbdRadiusY,
        pairedSlot,
      });
    }
  }

  let phachCodeRect: SheetTemplate['headerConfig']['phachCodeRect'];
  let phachStubRect: SheetTemplate['headerConfig']['phachStubRect'];

  if (showPhachStub) {
    phachStubRect = {
      x: px(0.05),
      y: py(0.08),
      w: pw(0.21),
      h: ph(0.86),
    };
    const pW = 0.14;
    const pX = sbdX - 0.02 - pW;
    phachCodeRect = {
      x: px(pX),
      y: py(metaTop),
      w: pw(pW),
      h: ph(metaHeight),
    };
    const pRx = pw(Math.min(0.0085, (pW / (phachDigits + 1)) * 0.32));
    for (let col = 0; col < phachDigits; col++) {
      const cx = px(pX + ((col + 0.5) / phachDigits) * pW);
      for (let d = 0; d < digitRows; d++) {
        const cy = py(metaTop + 0.032 + ((d + 0.5) / digitRows) * (metaHeight - 0.038));
        bubbles.push({
          id: `${prefix}phach_c${col}_${d}`,
          kind: 'phach_code',
          col,
          option: String(d),
          cx,
          cy,
          rx: pRx,
          ry: sbdRadiusY,
          pairedSlot,
        });
      }
    }
  }

  // Answer body region: vertical 0.325 .. 0.945, horizontal (0.06 + stubShift) .. 0.94
  const bodyLeft = 0.06 + stubShift;
  const bodyRight = 0.94;
  const bodyW = bodyRight - bodyLeft;
  const bodyTop = 0.33;
  const bodyBottom = 0.945;
  const bodyH = bodyBottom - bodyTop;

  // Allocate vertical bands proportionally to active sections
  const hasP1 = part1Count > 0;
  const hasP2 = part2Count > 0;
  const hasP3 = part3Count > 0;

  let p1BandH = 0;
  let p2BandH = 0;
  let p3BandH = 0;

  if (hasP1 && !hasP2 && !hasP3) {
    p1BandH = bodyH;
  } else if (hasP1 && hasP2 && hasP3) {
    // Typical THPT 2025 layout
    const p1RowsEst = Math.ceil(part1Count / part1Columns);
    const p1Weight = Math.max(0.22, Math.min(0.42, p1RowsEst * 0.025));
    const p2Weight = 0.24;
    const p3Weight = bodyH - p1Weight - p2Weight - 0.03;
    p1BandH = p1Weight;
    p2BandH = p2Weight;
    p3BandH = p3Weight;
  } else {
    const active = (hasP1 ? 1 : 0) + (hasP2 ? 1 : 0) + (hasP3 ? 1 : 0);
    const slice = (bodyH - 0.02 * Math.max(0, active - 1)) / Math.max(1, active);
    if (hasP1) p1BandH = slice;
    if (hasP2) p2BandH = slice;
    if (hasP3) p3BandH = slice;
  }

  let cursorY = bodyTop;
  let part1Rect: SheetTemplate['headerConfig']['part1Rect'];
  let part2Rect: SheetTemplate['headerConfig']['part2Rect'];
  let part3Rect: SheetTemplate['headerConfig']['part3Rect'];

  // PART I: MCQ (A, B, C, D)
  if (hasP1) {
    part1Rect = { x: px(bodyLeft), y: py(cursorY), w: pw(bodyW), h: ph(p1BandH) };
    const cols = Math.max(1, part1Columns);
    const rowsPerCol = Math.ceil(part1Count / cols);
    const colW = bodyW / cols;
    const innerTop = cursorY + 0.028;
    const innerH = p1BandH - 0.034;
    const rowStep = innerH / Math.max(1, rowsPerCol);
    const rX = pw(Math.min(0.010, (colW * 0.56) / 10));
    const rY = ph(Math.min(0.010, rowStep * 0.34));
    const rNorm = Math.min(rX, rY * (areaH / areaW)); // keep circle visually round in canonical px
    const rxFinal = rNorm;
    const ryFinal = rNorm * (areaW / areaH) * (1240 / 1754) > 0 ? Math.min(rY, rowStep * 0.36 * areaH) : rY;
    // Better: compute exact radius in normalized canvas space preserving aspect ratio
    const options = ['A', 'B', 'C', 'D'];

    for (let q = 1; q <= part1Count; q++) {
      const cIdx = Math.floor((q - 1) / rowsPerCol);
      const rIdx = (q - 1) % rowsPerCol;
      const colStart = bodyLeft + cIdx * colW;
      const cy = py(innerTop + (rIdx + 0.5) * rowStep);

      for (let oi = 0; oi < options.length; oi++) {
        const cx = px(colStart + colW * (0.28 + oi * 0.165));
        bubbles.push({
          id: `${prefix}p1_q${q}_${options[oi]}`,
          kind: 'part1',
          question: q,
          option: options[oi],
          cx,
          cy,
          rx: Math.min(rX, pw(0.010)),
          ry: Math.min(rY, ph(0.0082)),
          pairedSlot,
        });
      }
    }
    cursorY += p1BandH + 0.015;
  }

  // PART II: True/False (4 sub-items a, b, c, d per question; each has Đ and S)
  if (hasP2) {
    part2Rect = { x: px(bodyLeft), y: py(cursorY), w: pw(bodyW), h: ph(p2BandH) };
    const cols = Math.min(part2Count, 4);
    const rows = Math.ceil(part2Count / cols);
    const colW = bodyW / cols;
    const innerTop = cursorY + 0.030;
    const innerH = p2BandH - 0.036;
    const rowGroupH = innerH / Math.max(1, rows);
    const subItems: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];

    for (let q = 1; q <= part2Count; q++) {
      const cIdx = (q - 1) % cols;
      const rIdx = Math.floor((q - 1) / cols);
      const boxLeft = bodyLeft + cIdx * colW;
      const boxTop = innerTop + rIdx * rowGroupH;
      const subStep = (rowGroupH - 0.022) / 4;

      for (let si = 0; si < 4; si++) {
        const cy = py(boxTop + 0.020 + (si + 0.5) * subStep);
        const rx = pw(0.009);
        const ry = ph(Math.min(0.0075, subStep * 0.36));
        const cxTrue = px(boxLeft + colW * 0.44);
        const cxFalse = px(boxLeft + colW * 0.68);
        bubbles.push({
          id: `${prefix}p2_q${q}_${subItems[si]}_D`,
          kind: 'part2',
          question: q,
          subItem: subItems[si],
          option: 'Đ',
          cx: cxTrue,
          cy,
          rx,
          ry,
          pairedSlot,
        });
        bubbles.push({
          id: `${prefix}p2_q${q}_${subItems[si]}_S`,
          kind: 'part2',
          question: q,
          subItem: subItems[si],
          option: 'S',
          cx: cxFalse,
          cy,
          rx,
          ry,
          pairedSlot,
        });
      }
    }
    cursorY += p2BandH + 0.015;
  }

  // PART III: Short Answer numeric grid (4 cols per question: col 0 has '-' and '0'..'9', col 1..2 have ',' and '0'..'9', col 3 has '0'..'9')
  if (hasP3) {
    part3Rect = { x: px(bodyLeft), y: py(cursorY), w: pw(bodyW), h: ph(p3BandH) };
    const cols = Math.min(part3Count, 6);
    const qBoxW = bodyW / cols;
    const innerTop = cursorY + 0.032;
    const innerH = p3BandH - 0.040;
    // 12 rows: row 0 = '-', row 1 = ',', rows 2..11 = '0'..'9'
    const allRows = ['-', ',', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const rowStep = innerH / allRows.length;
    const rx = pw(Math.min(0.0078, (qBoxW / (part3ColsPerQuestion + 1)) * 0.28));
    const ry = ph(Math.min(0.0068, rowStep * 0.36));

    for (let q = 1; q <= part3Count; q++) {
      const qIdx = (q - 1) % cols;
      const qLeft = bodyLeft + qIdx * qBoxW + qBoxW * 0.16;
      const qInnerW = qBoxW * 0.78;
      for (let col = 0; col < part3ColsPerQuestion; col++) {
        const cx = px(qLeft + ((col + 0.5) / part3ColsPerQuestion) * qInnerW);
        for (let ri = 0; ri < allRows.length; ri++) {
          const sym = allRows[ri];
          // '-' only valid in col 0, ',' only valid in col 1 or 2
          if (sym === '-' && col !== 0) continue;
          if (sym === ',' && (col === 0 || col === part3ColsPerQuestion - 1)) continue;
          const cy = py(innerTop + (ri + 0.5) * rowStep);
          bubbles.push({
            id: `${prefix}p3_q${q}_c${col}_${sym}`,
            kind: 'part3',
            question: q,
            col,
            option: sym,
            cx,
            cy,
            rx,
            ry,
            pairedSlot,
          });
        }
      }
    }
  }

  // Keep rx/ry balanced to prevent ellipse distortion
  for (const b of bubbles) {
    if (b.rx <= 0) b.rx = 0.008;
    if (b.ry <= 0) b.ry = 0.006;
  }

  return {
    bubbles,
    rects: {
      showSchoolName: true,
      showExamName: true,
      showSubject: true,
      showStudentInfoBox: true,
      showPhachStub,
      phachStubRect,
      sbdRect,
      examCodeRect,
      phachCodeRect,
      part1Rect,
      part2Rect,
      part3Rect,
    },
  };
}

export function buildTemplateFromSpec(spec: TemplateSpec): SheetTemplate {
  const { widthPx, heightPx } = getCanonicalDimensions(spec.paperSize, spec.orientation);
  const part1Columns =
    spec.part1Columns ||
    (spec.part1Count <= 20 ? 2 : spec.part1Count <= 45 ? 3 : spec.part1Count <= 80 ? 4 : 5);
  const part3ColsPerQuestion = spec.part3ColsPerQuestion || 4;
  const now = Date.now();

  if (spec.category === 'paired_a5') {
    const f1: FiducialConfig = {
      topLeft: { x: 0.03, y: 0.04 },
      topRight: { x: 0.47, y: 0.04 },
      bottomRight: { x: 0.47, y: 0.96 },
      bottomLeft: { x: 0.03, y: 0.96 },
      markerSizeNorm: 0.016,
      orientationAnchor: { x: 0.06, y: 0.04 },
    };
    const f2: FiducialConfig = {
      topLeft: { x: 0.53, y: 0.04 },
      topRight: { x: 0.97, y: 0.04 },
      bottomRight: { x: 0.97, y: 0.96 },
      bottomLeft: { x: 0.53, y: 0.96 },
      markerSizeNorm: 0.016,
      orientationAnchor: { x: 0.56, y: 0.04 },
    };

    const left = buildSingleSheetBubbles({
      originX: 0.0,
      originY: 0.0,
      areaW: 0.49,
      areaH: 1.0,
      sbdDigits: spec.sbdDigits,
      examCodeDigits: spec.examCodeDigits,
      part1Count: spec.part1Count,
      part1Columns: spec.part1Count <= 25 ? 2 : 3,
      part2Count: spec.part2Count,
      part3Count: spec.part3Count,
      part3ColsPerQuestion,
      pairedSlot: 1,
    });
    const right = buildSingleSheetBubbles({
      originX: 0.51,
      originY: 0.0,
      areaW: 0.49,
      areaH: 1.0,
      sbdDigits: spec.sbdDigits,
      examCodeDigits: spec.examCodeDigits,
      part1Count: spec.part1Count,
      part1Columns: spec.part1Count <= 25 ? 2 : 3,
      part2Count: spec.part2Count,
      part3Count: spec.part3Count,
      part3ColsPerQuestion,
      pairedSlot: 2,
    });

    return {
      id: spec.id,
      version: spec.version || '1.0',
      name: spec.name,
      category: 'paired_a5',
      paperSize: 'A4',
      orientation: 'landscape',
      widthPx,
      heightPx,
      fiducials: defaultFiducials(),
      sbdDigits: spec.sbdDigits,
      examCodeDigits: spec.examCodeDigits,
      part1Count: spec.part1Count,
      part1Columns: spec.part1Count <= 25 ? 2 : 3,
      part2Count: spec.part2Count,
      part3Count: spec.part3Count,
      part3ColsPerQuestion,
      headerConfig: left.rects,
      bubbles: [...left.bubbles, ...right.bubbles],
      pairedSubSheets: [
        { slot: 1, bounds: { x: 0, y: 0, w: 0.5, h: 1 }, fiducials: f1 },
        { slot: 2, bounds: { x: 0.5, y: 0, w: 0.5, h: 1 }, fiducials: f2 },
      ],
      isBuiltIn: spec.isBuiltIn ?? true,
      isOfficialVerified: spec.isOfficialVerified ?? false,
      compatibilityNote:
        spec.compatibilityNote ||
        'Phiếu ghép đôi A4 chứa 2 phiếu A5 độc lập. Bộ máy OMR tự tách thành 2 bài thi riêng biệt.',
      createdAt: now,
      updatedAt: now,
    };
  }

  const built = buildSingleSheetBubbles({
    originX: 0,
    originY: 0,
    areaW: 1,
    areaH: 1,
    sbdDigits: spec.sbdDigits,
    examCodeDigits: spec.examCodeDigits,
    phachDigits: spec.phachDigits,
    part1Count: spec.part1Count,
    part1Columns,
    part2Count: spec.part2Count,
    part3Count: spec.part3Count,
    part3ColsPerQuestion,
  });

  return {
    id: spec.id,
    version: spec.version || '1.0',
    name: spec.name,
    category: spec.category,
    paperSize: spec.paperSize,
    orientation: spec.orientation,
    widthPx,
    heightPx,
    fiducials: defaultFiducials(),
    sbdDigits: spec.sbdDigits,
    examCodeDigits: spec.examCodeDigits,
    phachDigits: spec.phachDigits,
    part1Count: spec.part1Count,
    part1Columns,
    part2Count: spec.part2Count,
    part3Count: spec.part3Count,
    part3ColsPerQuestion,
    headerConfig: built.rects,
    bubbles: built.bubbles,
    isBuiltIn: spec.isBuiltIn ?? true,
    isOfficialVerified: spec.isOfficialVerified ?? false,
    compatibilityNote:
      spec.compatibilityNote ||
      'Cấu trúc chuẩn nội bộ của hệ thống. Vui lòng đối chiếu bản in mẫu trước khi tổ chức thi đại trà.',
    createdAt: now,
    updatedAt: now,
  };
}

export function getBuiltInTemplates(): SheetTemplate[] {
  return [
    buildTemplateFromSpec({
      id: 'tpl_thpt2025_toan',
      name: 'THPT 2025 – Môn Toán (12 I · 4 II · 6 III)',
      category: 'thpt2025',
      paperSize: 'A4',
      orientation: 'portrait',
      sbdDigits: 6,
      examCodeDigits: 3,
      part1Count: 12,
      part1Columns: 2,
      part2Count: 4,
      part3Count: 6,
      isOfficialVerified: false,
      compatibilityNote:
        'Theo cấu trúc đề minh họa THPT 2025 môn Toán (12 câu Phần I, 4 câu Đúng/Sai, 6 câu Trả lời ngắn). Chỉ xác nhận tương thích chính thức với phôi in Bộ GD&ĐT sau khi giáo viên đối chiếu trực tiếp mẫu thực tế.',
    }),
    buildTemplateFromSpec({
      id: 'tpl_thpt2025_khtn',
      name: 'THPT 2025 – KHTN / Địa lý (18 I · 4 II · 6 III)',
      category: 'thpt2025',
      paperSize: 'A4',
      orientation: 'portrait',
      sbdDigits: 6,
      examCodeDigits: 3,
      part1Count: 18,
      part1Columns: 3,
      part2Count: 4,
      part3Count: 6,
      isOfficialVerified: false,
      compatibilityNote:
        'Phù hợp Vật lý, Hóa học, Sinh học, Địa lý theo cấu trúc 2025 (18 câu Phần I, 4 câu Đúng/Sai, 6 câu Trả lời ngắn).',
    }),
    buildTemplateFromSpec({
      id: 'tpl_thpt2025_40',
      name: 'THPT 2025 – Ngoại ngữ / Lịch sử / GDKT&PL (40 câu)',
      category: 'thpt2025',
      paperSize: 'A4',
      orientation: 'portrait',
      sbdDigits: 6,
      examCodeDigits: 3,
      part1Count: 40,
      part1Columns: 4,
      part2Count: 0,
      part3Count: 0,
      isOfficialVerified: false,
      compatibilityNote:
        'Cấu trúc 40 câu trắc nghiệm 4 lựa chọn A/B/C/D theo môn Tiếng Anh, Lịch sử, Tin học, Công nghệ.',
    }),
    ...[10, 15, 20, 25, 30, 40, 50, 60, 80, 100].map((count) =>
      buildTemplateFromSpec({
        id: `tpl_trad_${count}`,
        name: `Phiếu truyền thống ${count} câu`,
        category: 'traditional',
        paperSize: 'A4',
        orientation: 'portrait',
        sbdDigits: 6,
        examCodeDigits: 3,
        part1Count: count,
        part1Columns: count <= 20 ? 2 : count <= 45 ? 3 : count <= 80 ? 4 : 5,
        part2Count: 0,
        part3Count: 0,
        isOfficialVerified: true,
        compatibilityNote: `Mẫu phiếu chuẩn Chấm Thi Thông Minh (${count} câu A/B/C/D), đồng bộ 1:1 giữa file PDF xuất in và bộ máy OMR.`,
      })
    ),
    buildTemplateFromSpec({
      id: 'tpl_paired_a5_20',
      name: 'Phiếu ghép đôi A4 (2 phiếu A5 × 20 câu)',
      category: 'paired_a5',
      paperSize: 'A4',
      orientation: 'landscape',
      sbdDigits: 6,
      examCodeDigits: 3,
      part1Count: 20,
      part1Columns: 2,
      part2Count: 0,
      part3Count: 0,
      isOfficialVerified: true,
      compatibilityNote:
        'Khổ A4 ngang chứa 2 phiếu A5 độc lập. Tự nhận diện và tách thành 2 bài thi riêng, không ghi đè dù trùng SBD.',
    }),
    buildTemplateFromSpec({
      id: 'tpl_phach_a3_40',
      name: 'Phiếu rọc phách A3 (40 câu + Mã phách 5 số)',
      category: 'phach_a3',
      paperSize: 'A3',
      orientation: 'landscape',
      sbdDigits: 6,
      examCodeDigits: 3,
      phachDigits: 5,
      part1Count: 40,
      part1Columns: 4,
      part2Count: 0,
      part3Count: 0,
      isOfficialVerified: true,
      compatibilityNote:
        'Khổ A3 ngang có vùng thông tin học sinh bên trái để rọc phách, vùng mã phách 5 chữ số và vùng bài làm độc lập.',
    }),
  ];
}

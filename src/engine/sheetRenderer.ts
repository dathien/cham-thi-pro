import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type {
  BubbleCoord,
  Exam,
  ExamSubmission,
  SheetTemplate,
  Student,
} from '../types/omr';

export interface SimulatedMarkSpec {
  sbd?: string;
  examCode?: string;
  phachCode?: string;
  part1?: Record<number, string | string[]>; // array simulates multi-mark
  part2?: Record<number, Partial<Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S' | 'ĐS'>>>;
  part3?: Record<number, string>;
  faintQuestions?: number[]; // simulate faint marks on Part I
  erasedQuestions?: { q: number; erasedOpt: string; finalOpt: string }[];
  rotationDeg?: 0 | 90 | 180 | 270;
  skewDeg?: number;
  brightnessOffset?: number; // e.g. -80 for low light
  shadowGradient?: boolean;
  omitBottomRightFiducial?: boolean;
  pairedSlot2?: {
    sbd?: string;
    examCode?: string;
    part1?: Record<number, string>;
  };
}

let cachedFonts: { regular: ArrayBuffer; bold: ArrayBuffer } | null = null;

async function loadVietnameseFonts(): Promise<{ regular: ArrayBuffer; bold: ArrayBuffer }> {
  if (cachedFonts) return cachedFonts;
  const [regRes, boldRes] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/fonts/DejaVuSans-Bold.ttf'),
  ]);
  if (!regRes.ok || !boldRes.ok) {
    throw new Error('Không tải được font tiếng Việt cục bộ (/fonts/DejaVuSans.ttf).');
  }
  const [regular, bold] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
  cachedFonts = { regular, bold };
  return cachedFonts;
}

export function drawTemplateOnCanvas(
  canvas: HTMLCanvasElement,
  template: SheetTemplate,
  meta?: { schoolName?: string; examName?: string; subject?: string },
  sim?: SimulatedMarkSpec
) {
  const W = template.widthPx;
  const H = template.heightPx;
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#FFFFFF';
  ctx.fillRect(0, 0, W, H);

  // Draw sheet content into an offscreen canonical buffer first so we can apply rotation/skew/lighting if requested
  const buf = document.createElement('canvas');
  buf.width = W;
  buf.height = H;
  const bctx = buf.getContext('2d')!;
  bctx.fillStyle = '#FFFFFF';
  bctx.fillRect(0, 0, W, H);

  const drawFiducialSet = (
    fid: SheetTemplate['fiducials'],
    omitBR = false
  ) => {
    const size = fid.markerSizeNorm * W;
    const pts = [
      { pt: fid.topLeft, skip: false },
      { pt: fid.topRight, skip: false },
      { pt: fid.bottomRight, skip: omitBR },
      { pt: fid.bottomLeft, skip: false },
    ];
    bctx.fillStyle = '#0F172A';
    for (const item of pts) {
      if (item.skip) continue;
      const x = item.pt.x * W - size / 2;
      const y = item.pt.y * H - size / 2;
      bctx.fillRect(x, y, size, size);
    }
    if (fid.orientationAnchor) {
      const aSize = size * 0.55;
      bctx.fillRect(
        fid.orientationAnchor.x * W - aSize / 2,
        fid.orientationAnchor.y * H - aSize / 2,
        aSize,
        aSize
      );
    }
  };

  if (template.category === 'paired_a5' && template.pairedSubSheets) {
    for (const sub of template.pairedSubSheets) {
      drawFiducialSet(sub.fiducials, sim?.omitBottomRightFiducial && sub.slot === 1);
    }
    // Center dashed cut line
    bctx.save();
    bctx.setLineDash([8, 6]);
    bctx.strokeStyle = '#94A3B8';
    bctx.lineWidth = 1.5;
    bctx.beginPath();
    bctx.moveTo(W * 0.5, H * 0.03);
    bctx.lineTo(W * 0.5, H * 0.97);
    bctx.stroke();
    bctx.restore();
  } else {
    drawFiducialSet(template.fiducials, sim?.omitBottomRightFiducial);
  }

  // Draw structural boxes & Vietnamese labels
  const drawSingleHeader = (originX: number, areaW: number) => {
    const stubShift = template.headerConfig.showPhachStub ? 0.24 : 0;
    const leftX = (originX + (0.06 + stubShift) * areaW) * W;
    const topY = 0.055 * H;
    bctx.fillStyle = '#0F172A';
    bctx.font = `bold ${Math.round(W * 0.015)}px "Be Vietnam Pro", DejaVu Sans, sans-serif`;
    bctx.fillText(meta?.schoolName || 'TRƯỜNG THPT', leftX, topY + 18);
    bctx.font = `bold ${Math.round(W * 0.017)}px "Be Vietnam Pro", DejaVu Sans, sans-serif`;
    bctx.fillText(meta?.examName || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM', leftX, topY + 44);
    bctx.font = `${Math.round(W * 0.012)}px "Be Vietnam Pro", DejaVu Sans, sans-serif`;
    bctx.fillStyle = '#334155';
    bctx.fillText(
      `Môn: ${meta?.subject || '................'}   Mẫu: ${template.id}`,
      leftX,
      topY + 66
    );

    // Student info lines
    const boxW = areaW * (0.45 - stubShift) * W;
    bctx.strokeStyle = '#CBD5E1';
    bctx.lineWidth = 1.2;
    bctx.strokeRect(leftX, topY + 78, boxW, H * 0.16);
    bctx.fillStyle = '#475569';
    bctx.font = `${Math.round(W * 0.011)}px "Be Vietnam Pro", sans-serif`;
    bctx.fillText('Họ và tên: ........................................', leftX + 10, topY + 102);
    bctx.fillText('Lớp: ...................  Ngày thi: ...............', leftX + 10, topY + 132);
    bctx.fillText('Phòng thi: .............  Chữ ký GT: ..............', leftX + 10, topY + 162);
  };

  if (template.category === 'paired_a5') {
    drawSingleHeader(0, 0.49);
    drawSingleHeader(0.51, 0.49);
  } else {
    drawSingleHeader(0, 1);
  }

  // Draw Phách stub if applicable
  if (template.headerConfig.showPhachStub && template.headerConfig.phachStubRect) {
    const r = template.headerConfig.phachStubRect;
    bctx.strokeStyle = '#475569';
    bctx.lineWidth = 1.5;
    bctx.strokeRect(r.x * W, r.y * H, r.w * W, r.h * H);
    bctx.fillStyle = '#0F172A';
    bctx.font = `bold ${Math.round(W * 0.012)}px sans-serif`;
    bctx.fillText('PHẦN RỌC PHÁCH', r.x * W + 12, r.y * H + 26);
    bctx.font = `${Math.round(W * 0.010)}px sans-serif`;
    bctx.fillText('Họ tên: .......................', r.x * W + 12, r.y * H + 60);
    bctx.fillText('SBD: ..........................', r.x * W + 12, r.y * H + 90);
    bctx.fillText('Lớp: ..........................', r.x * W + 12, r.y * H + 120);
    bctx.fillText('Mã phách: .....................', r.x * W + 12, r.y * H + 150);
    // Dashed tear line
    bctx.save();
    bctx.setLineDash([8, 6]);
    bctx.beginPath();
    bctx.moveTo((r.x + r.w + 0.012) * W, H * 0.04);
    bctx.lineTo((r.x + r.w + 0.012) * W, H * 0.96);
    bctx.stroke();
    bctx.restore();
  }

  // Draw region frames & section headers
  const hc = template.headerConfig;
  const drawRectFrame = (rect: { x: number; y: number; w: number; h: number } | undefined, title: string) => {
    if (!rect) return;
    bctx.strokeStyle = '#64748B';
    bctx.lineWidth = 1.2;
    bctx.strokeRect(rect.x * W, rect.y * H, rect.w * W, rect.h * H);
    bctx.fillStyle = '#0F172A';
    bctx.font = `bold ${Math.round(W * 0.010)}px sans-serif`;
    bctx.fillText(title, rect.x * W + 6, rect.y * H + 16);
  };

  drawRectFrame(hc.sbdRect, 'SỐ BÁO DANH');
  drawRectFrame(hc.examCodeRect, 'MÃ ĐỀ');
  drawRectFrame(hc.phachCodeRect, 'MÃ PHÁCH');
  drawRectFrame(hc.part1Rect, 'PHẦN I. Trắc nghiệm nhiều lựa chọn');
  drawRectFrame(hc.part2Rect, 'PHẦN II. Trắc nghiệm Đúng / Sai');
  drawRectFrame(hc.part3Rect, 'PHẦN III. Trả lời ngắn');

  // Helper to check if a bubble should be filled under simulation
  const getSimFillType = (b: BubbleCoord): 'none' | 'solid' | 'faint' | 'erased' => {
    if (!sim) return 'none';
    const slotSim =
      b.pairedSlot === 2 && sim.pairedSlot2
        ? { sbd: sim.pairedSlot2.sbd, examCode: sim.pairedSlot2.examCode, part1: sim.pairedSlot2.part1 }
        : sim;

    if (b.kind === 'sbd' && slotSim.sbd && b.col !== undefined) {
      if (slotSim.sbd[b.col] === b.option) return 'solid';
    }
    if (b.kind === 'exam_code' && slotSim.examCode && b.col !== undefined) {
      if (slotSim.examCode[b.col] === b.option) return 'solid';
    }
    if (b.kind === 'phach_code' && sim.phachCode && b.col !== undefined) {
      if (sim.phachCode[b.col] === b.option) return 'solid';
    }
    if (b.kind === 'part1' && b.question !== undefined && slotSim.part1) {
      const target = slotSim.part1[b.question];
      const isFaint = b.pairedSlot !== 2 && sim.faintQuestions?.includes(b.question);
      const erasedSpec = b.pairedSlot !== 2 && sim.erasedQuestions?.find((e) => e.q === b.question);
      if (erasedSpec && erasedSpec.erasedOpt === b.option) return 'erased';
      if (Array.isArray(target)) {
        if (target.includes(b.option)) return isFaint ? 'faint' : 'solid';
      } else if (target === b.option) {
        return isFaint ? 'faint' : 'solid';
      }
    }
    if (b.kind === 'part2' && b.question !== undefined && b.subItem && sim.part2) {
      const qMap = sim.part2[b.question];
      const val = qMap?.[b.subItem];
      if (val === 'ĐS') return 'solid';
      if (val === b.option) return 'solid';
    }
    if (b.kind === 'part3' && b.question !== undefined && b.col !== undefined && sim.part3) {
      const str = sim.part3[b.question];
      if (str && str[b.col] === b.option) return 'solid';
    }
    return 'none';
  };

  // Draw Question numbers & bubbles
  const seenP1Q = new Set<string>();
  const seenP2Q = new Set<string>();
  const seenP3Q = new Set<string>();

  for (const b of template.bubbles) {
    const cx = b.cx * W;
    const cy = b.cy * H;
    const r = Math.max(4.5, Math.min(b.rx * W, b.ry * H));

    // Draw question labels once per question
    if (b.kind === 'part1' && b.question !== undefined && b.option === 'A') {
      const key = `${b.pairedSlot || 1}_${b.question}`;
      if (!seenP1Q.has(key)) {
        seenP1Q.add(key);
        bctx.fillStyle = '#0F172A';
        bctx.font = `bold ${Math.max(10, Math.round(r * 1.15))}px sans-serif`;
        bctx.textAlign = 'right';
        bctx.textBaseline = 'middle';
        bctx.fillText(`${b.question}.`, cx - r * 1.9, cy);
      }
    }
    if (b.kind === 'part2' && b.question !== undefined && b.subItem === 'a' && b.option === 'Đ') {
      const key = `${b.pairedSlot || 1}_${b.question}`;
      if (!seenP2Q.has(key)) {
        seenP2Q.add(key);
        bctx.fillStyle = '#0F172A';
        bctx.font = `bold ${Math.max(10, Math.round(r * 1.15))}px sans-serif`;
        bctx.textAlign = 'left';
        bctx.textBaseline = 'middle';
        bctx.fillText(`Câu ${b.question}`, cx - r * 4.8, cy - r * 2.1);
      }
    }
    if (b.kind === 'part2' && b.option === 'Đ' && b.subItem) {
      bctx.fillStyle = '#334155';
      bctx.font = `${Math.max(9, Math.round(r * 1.05))}px sans-serif`;
      bctx.textAlign = 'right';
      bctx.textBaseline = 'middle';
      bctx.fillText(`${b.subItem})`, cx - r * 1.6, cy);
    }
    if (b.kind === 'part3' && b.question !== undefined && b.col === 0 && b.option === '-') {
      const key = `${b.pairedSlot || 1}_${b.question}`;
      if (!seenP3Q.has(key)) {
        seenP3Q.add(key);
        bctx.fillStyle = '#0F172A';
        bctx.font = `bold ${Math.max(10, Math.round(r * 1.15))}px sans-serif`;
        bctx.textAlign = 'left';
        bctx.textBaseline = 'middle';
        bctx.fillText(`Câu ${b.question}`, cx - r * 1.2, cy - r * 2.2);
      }
    }

    // Draw bubble ring
    bctx.beginPath();
    bctx.arc(cx, cy, r, 0, Math.PI * 2);
    bctx.strokeStyle = '#475569';
    bctx.lineWidth = 1.25;
    bctx.stroke();

    // Option text inside bubble (lighter tone prevents OMR false positives)
    bctx.fillStyle = '#94A3B8';
    bctx.font = `${Math.max(8, Math.round(r * 1.0))}px sans-serif`;
    bctx.textAlign = 'center';
    bctx.textBaseline = 'middle';
    bctx.fillText(b.option, cx, cy + 0.5);

    // Apply simulated pencil fill if any
    const fillType = getSimFillType(b);
    if (fillType === 'solid') {
      bctx.beginPath();
      bctx.arc(cx, cy, r * 0.9, 0, Math.PI * 2);
      bctx.fillStyle = '#111827';
      bctx.fill();
    } else if (fillType === 'faint') {
      bctx.beginPath();
      bctx.arc(cx, cy, r * 0.82, 0, Math.PI * 2);
      bctx.fillStyle = 'rgba(30, 41, 59, 0.30)';
      bctx.fill();
    } else if (fillType === 'erased') {
      // Simulate smudge + faint ring residue around perimeter
      bctx.beginPath();
      bctx.arc(cx, cy, r * 1.08, 0, Math.PI * 2);
      bctx.strokeStyle = 'rgba(51, 65, 85, 0.55)';
      bctx.lineWidth = 3.2;
      bctx.stroke();
      bctx.beginPath();
      bctx.arc(cx, cy, r * 0.78, 0, Math.PI * 2);
      bctx.fillStyle = 'rgba(71, 85, 105, 0.25)';
      bctx.fill();
    }
  }

  // Apply transforms (rotation, skew, shadow, low light) onto target canvas
  const rot = sim?.rotationDeg || 0;
  if (rot === 90 || rot === 270) {
    canvas.width = H;
    canvas.height = W;
  }
  ctx.save();
  ctx.fillStyle = '#E2E8F0';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.translate(canvas.width / 2, canvas.height / 2);
  const rad = ((rot + (sim?.skewDeg || 0)) * Math.PI) / 180;
  ctx.rotate(rad);
  const scale = sim?.skewDeg ? 0.92 : 1.0;
  ctx.scale(scale, scale);
  ctx.drawImage(buf, -W / 2, -H / 2);
  ctx.restore();

  if (sim?.shadowGradient) {
    const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
    grad.addColorStop(0, 'rgba(0,0,0,0.42)');
    grad.addColorStop(0.5, 'rgba(0,0,0,0.12)');
    grad.addColorStop(1, 'rgba(0,0,0,0.0)');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
  if (sim?.brightnessOffset && sim.brightnessOffset < 0) {
    const alpha = Math.min(0.85, Math.abs(sim.brightnessOffset) / 150);
    ctx.fillStyle = `rgba(0,0,0,${alpha})`;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
}

export async function generateBlankSheetPdf(
  template: SheetTemplate,
  meta?: { schoolName?: string; examName?: string; subject?: string }
): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  drawTemplateOnCanvas(canvas, template, meta);
  const pngUrl = canvas.toDataURL('image/png');
  const pngBytes = await fetch(pngUrl).then((r) => r.arrayBuffer());

  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = await loadVietnameseFonts();
  const fontReg = await pdfDoc.embedFont(fonts.regular);

  // Paper size in PDF points (1 inch = 72 pt)
  const dims =
    template.paperSize === 'A3'
      ? [841.89, 1190.55]
      : template.paperSize === 'A5'
      ? [419.53, 595.28]
      : [595.28, 841.89];
  const [pw, ph] = template.orientation === 'landscape' ? [dims[1], dims[0]] : dims;

  const page = pdfDoc.addPage([pw, ph]);
  const img = await pdfDoc.embedPng(pngBytes);
  // Safe print margin (8pt) so corner fiducials never clip when printed
  const margin = 8;
  page.drawImage(img, {
    x: margin,
    y: margin,
    width: pw - margin * 2,
    height: ph - margin * 2,
  });
  page.drawText(`Mẫu: ${template.name} (${template.id} v${template.version})`, {
    x: margin + 6,
    y: 2,
    size: 6.5,
    font: fontReg,
    color: rgb(0.45, 0.5, 0.58),
  });
  return pdfDoc.save();
}

export type ReportCardTemplateKind =
  | 'standard'
  | 'detailed'
  | 'competency'
  | 'annotated_sheet';

export type ReportCardImageMode = 'original' | 'warped' | 'annotated';
export type ReportCardPaperFormat = 'A4' | 'A5' | 'paired_a5';

export interface CommentBandRule {
  minScore: number;
  title: string;
  commentTemplate: string;
}

export interface ReportCardOptions {
  templateKind?: ReportCardTemplateKind;
  imageMode?: ReportCardImageMode;
  paperFormat?: ReportCardPaperFormat;
  showLogo?: boolean;
  schoolLogoDataUrl?: string;
  showRanking: boolean;
  showClassAverage?: boolean;
  showExamImage?: boolean;
  showCorrectAnswers: boolean;
  showDetailTable?: boolean;
  showComment: boolean;
  showComponentChart?: boolean;
  showSignature?: boolean;
  classAverage: number;
  classRankMap?: Record<string, number>;
  totalGraded: number;
  commentBands?: CommentBandRule[];
}

export function slugifyVietnamese(text: string): string {
  return (text || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function buildReportCardFilename(
  student: Student | undefined,
  sub: ExamSubmission,
  exam: Exam
): string {
  const cls = slugifyVietnamese(student?.className || 'Lop') || 'Lop';
  const sbd = slugifyVietnamese(sub.sbd || student?.sbd || 'SBD') || 'SBD';
  const name = slugifyVietnamese(student?.fullName || 'HocSinh') || 'HocSinh';
  const subj = slugifyVietnamese(exam.subject || 'MonHoc') || 'MonHoc';
  return `Phieu-tra-bai_${cls}_${sbd}_${name}_${subj}.pdf`;
}

const FALLBACK_BANDS: CommentBandRule[] = [
  {
    minScore: 9,
    title: '9,0 – 10,0',
    commentTemplate:
      'Bài làm đạt kết quả rất tốt, nắm vững kiến thức trọng tâm và xử lý chính xác các câu hỏi.',
  },
  {
    minScore: 8,
    title: '8,0 – <9,0',
    commentTemplate:
      'Bài làm đạt kết quả tốt, kiến thức vững vàng; rà soát thêm chi tiết nhỏ để đạt điểm tối đa.',
  },
  {
    minScore: 6.5,
    title: '6,5 – <8,0',
    commentTemplate:
      'Bài làm đạt mức khá; nên luyện tập thêm các câu hỏi vận dụng để nâng cao kết quả.',
  },
  {
    minScore: 5,
    title: '5,0 – <6,5',
    commentTemplate:
      'Bài làm đạt mức trung bình; cần hệ thống lại kiến thức cơ bản và đọc kỹ yêu cầu đề.',
  },
  {
    minScore: 3.5,
    title: '3,5 – <5,0',
    commentTemplate:
      'Bài làm chưa đạt mức yêu cầu; cần ôn tập kỹ kiến thức nền tảng và luyện thêm dạng bài.',
  },
  {
    minScore: 0,
    title: '<3,5',
    commentTemplate:
      'Kết quả còn hạn chế so với yêu cầu đề kiểm tra; nên trao đổi cùng giáo viên để củng cố kiến thức.',
  },
];

export function generateObjectiveComment(
  sub: ExamSubmission,
  exam?: Exam,
  bands?: CommentBandRule[]
): string {
  if (sub.teacherCommentLocked && sub.teacherComment?.trim()) {
    return sub.teacherComment.trim();
  }
  const { total, maxPossible, correctCount, wrongCount, blankCount } = sub.scoreBreakdown;
  const norm10 = maxPossible > 0 ? (total / maxPossible) * 10 : total;
  const activeBands = [...(bands && bands.length > 0 ? bands : FALLBACK_BANDS)].sort(
    (a, b) => b.minScore - a.minScore
  );
  const matchedBand = activeBands.find((b) => norm10 >= b.minScore) || activeBands[activeBands.length - 1];

  const parts: string[] = [
    `Đạt ${total}/${maxPossible} điểm (${correctCount} ý đúng, ${wrongCount} ý sai, ${blankCount} ý bỏ trống).`,
  ];
  if (matchedBand?.commentTemplate) {
    parts.push(matchedBand.commentTemplate);
  }

  if (exam?.questionSpecs && exam.questionSpecs.length > 0) {
    const specMap = new Map(
      exam.questionSpecs.map((sp) => [`${sp.part}_${sp.question}`, sp.topic])
    );
    const topicMistakes = new Map<string, number>();
    for (const q of sub.recognition.questions) {
      if (q.status === 'wrong' || q.status === 'blank') {
        const tp = specMap.get(`${q.part}_${q.question}`);
        if (tp) topicMistakes.set(tp, (topicMistakes.get(tp) || 0) + 1);
      }
    }
    const topWeak = Array.from(topicMistakes.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 2)
      .map(([tp]) => tp);
    if (topWeak.length > 0) {
      parts.push(`Gợi ý ôn tập thêm: ${topWeak.join(', ')}.`);
    }
  }

  if (sub.status !== 'graded' || sub.reviewReasons.length > 0) {
    const reason = sub.reviewReasons.length > 0 ? sub.reviewReasons.join('; ') : 'Bài chưa kiểm duyệt chính thức';
    parts.push(`[Tạm tính – Cần kiểm duyệt: ${reason}].`);
  }
  return parts.join(' ');
}

export interface ReportCardRenderInput {
  submission: ExamSubmission;
  student?: Student;
  warpedImageDataUrl?: string;
  imageDataUrl?: string;
  isWarpedCoords?: boolean;
  rank?: number;
}

function wrapTextLines(text: string, maxChars: number): string[] {
  const words = (text || '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if (cur.length + 1 + w.length <= maxChars) cur += ' ' + w;
    else {
      lines.push(cur);
      cur = w;
    }
  }
  if (cur) lines.push(cur);
  return lines;
}

export async function renderAnnotatedReportCardPdf(
  submissions: ReportCardRenderInput[],
  exam: Exam,
  template: SheetTemplate,
  options: ReportCardOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = await loadVietnameseFonts();
  const fontReg = await pdfDoc.embedFont(fonts.regular);
  const fontBold = await pdfDoc.embedFont(fonts.bold);

  const templateKind = options.templateKind || 'detailed';
  const imageMode = options.imageMode || 'annotated';
  const paperFormat = options.paperFormat || 'A4';
  const showLogo = options.showLogo !== false;
  const showClassAverage = options.showClassAverage !== false;
  const showExamImage = options.showExamImage !== false;
  const showDetailTable = options.showDetailTable !== false;
  const showComponentChart = options.showComponentChart !== false;
  const showSignature = options.showSignature !== false;

  let logoImg: Awaited<ReturnType<typeof pdfDoc.embedPng>> | null = null;
  if (showLogo && options.schoolLogoDataUrl) {
    try {
      const lBytes = await fetch(options.schoolLogoDataUrl).then((r) => r.arrayBuffer());
      logoImg = options.schoolLogoDataUrl.includes('image/png')
        ? await pdfDoc.embedPng(lBytes)
        : await pdfDoc.embedJpg(lBytes);
    } catch {
      logoImg = null;
    }
  }

  const drawSingleReportCardInRect = async (
    page: ReturnType<typeof pdfDoc.addPage>,
    item: ReportCardRenderInput,
    boxX: number,
    boxY: number,
    boxW: number,
    boxH: number,
    compact: boolean
  ) => {
    const { submission, student, rank } = item;
    const isProvisional = submission.status !== 'graded';
    const scaleF = compact ? 0.74 : 1;
    const pad = compact ? 14 : 24;
    const x0 = boxX + pad;
    const innerW = boxW - pad * 2;
    const topY = boxY + boxH - pad;

    // Header box
    const hdrH = compact ? 62 : 76;
    page.drawRectangle({
      x: x0,
      y: topY - hdrH,
      width: innerW,
      height: hdrH,
      color: rgb(0.96, 0.98, 1),
      borderColor: isProvisional ? rgb(0.92, 0.55, 0.1) : rgb(0.82, 0.86, 0.92),
      borderWidth: 1,
    });

    let textX = x0 + 10;
    if (logoImg) {
      const logoSz = hdrH - 18;
      page.drawImage(logoImg, {
        x: x0 + 8,
        y: topY - hdrH + 9,
        width: logoSz,
        height: logoSz,
      });
      textX += logoSz + 8;
    }

    page.drawText(exam.schoolName || 'TRƯỜNG THPT', {
      x: textX,
      y: topY - 15 * scaleF,
      size: 9.5 * scaleF,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.23),
    });
    page.drawText(`PHIẾU TRẢ BÀI – ${exam.name}`, {
      x: textX,
      y: topY - 30 * scaleF,
      size: 11 * scaleF,
      font: fontBold,
      color: rgb(0.14, 0.39, 0.92),
    });
    if (isProvisional) {
      const badgeW = compact ? 105 : 148;
      page.drawRectangle({
        x: x0 + innerW - badgeW - 6,
        y: topY - 22 * scaleF,
        width: badgeW,
        height: 14 * scaleF,
        color: rgb(0.99, 0.93, 0.84),
        borderColor: rgb(0.92, 0.55, 0.1),
        borderWidth: 0.7,
      });
      page.drawText('TẠM TÍNH – CHỜ DUYỆT', {
        x: x0 + innerW - badgeW - 1,
        y: topY - 18 * scaleF,
        size: 7 * scaleF,
        font: fontBold,
        color: rgb(0.75, 0.35, 0.02),
      });
    }

    page.drawText(
      `Môn: ${exam.subject} | Họ tên: ${student?.fullName || '(Chưa đối chiếu)'} | SBD: ${submission.sbd || '---'} | Lớp: ${student?.className || '---'} | Mã đề: ${submission.examCode || '---'}`,
      {
        x: textX,
        y: topY - 46 * scaleF,
        size: 8.2 * scaleF,
        font: fontReg,
        color: rgb(0.2, 0.25, 0.33),
      }
    );

    const avgPart = showClassAverage ? ` | ĐTB chung: ${options.classAverage}` : '';
    const rankPart = options.showRanking && rank ? ` | Hạng: ${rank}/${options.totalGraded}` : '';
    const partText = `P.I: ${submission.scoreBreakdown.part1}${template.part2Count > 0 ? ` · P.II: ${submission.scoreBreakdown.part2}` : ''}${template.part3Count > 0 ? ` · P.III: ${submission.scoreBreakdown.part3}` : ''}`;
    page.drawText(
      `Tổng điểm: ${submission.scoreBreakdown.total}/${submission.scoreBreakdown.maxPossible} (${partText})${avgPart}${rankPart}`,
      {
        x: textX,
        y: topY - (compact ? 56 : 62),
        size: 8.5 * scaleF,
        font: fontBold,
        color: isProvisional ? rgb(0.78, 0.4, 0.05) : rgb(0.09, 0.55, 0.29),
      }
    );

    let curTop = topY - hdrH - (compact ? 10 : 14);
    const footerReserve = (options.showComment ? (compact ? 62 : 82) : 14) + (showSignature ? (compact ? 36 : 52) : 8);
    const bodyBottom = boxY + pad + footerReserve;

    const activeImgUrl = item.imageDataUrl || item.warpedImageDataUrl;
    const canShowImg = showExamImage && !!activeImgUrl && templateKind !== 'standard' && templateKind !== 'competency';
    const wantFullSheet = templateKind === 'annotated_sheet';

    // Component bar chart when requested (compact horizontal stacked bar)
    if (showComponentChart && !wantFullSheet) {
      const barH = compact ? 16 : 20;
      const maxP = Math.max(0.01, submission.scoreBreakdown.maxPossible);
      const barW = innerW;
      page.drawText(
        `Phân bố tỷ trọng điểm: Đúng ${submission.scoreBreakdown.correctCount} | Sai ${submission.scoreBreakdown.wrongCount} | Trống ${submission.scoreBreakdown.blankCount}`,
        { x: x0, y: curTop - 8, size: 7.4 * scaleF, font: fontBold, color: rgb(0.28, 0.34, 0.42) }
      );
      const yBar = curTop - 12 - barH;
      page.drawRectangle({ x: x0, y: yBar, width: barW, height: barH * 0.55, color: rgb(0.93, 0.95, 0.97) });
      let accX = x0;
      const segments = [
        { val: submission.scoreBreakdown.part1, color: rgb(0.14, 0.39, 0.92) },
        { val: submission.scoreBreakdown.part2, color: rgb(0.09, 0.64, 0.29) },
        { val: submission.scoreBreakdown.part3, color: rgb(0.55, 0.36, 0.96) },
      ];
      for (const seg of segments) {
        if (seg.val <= 0) continue;
        const w = Math.min(x0 + barW - accX, (seg.val / maxP) * barW);
        page.drawRectangle({ x: accX, y: yBar, width: w, height: barH * 0.55, color: seg.color });
        accX += w;
      }
      curTop = yBar - 8;
    }

    const availBodyH = Math.max(90, curTop - bodyBottom);

    // Draw exam image (left column or full area for annotated_sheet)
    let tableX = x0;
    let tableW = innerW;
    if (canShowImg || (showExamImage && wantFullSheet && activeImgUrl)) {
      const imgW = wantFullSheet ? innerW : innerW * 0.54;
      const imgH = availBodyH - 16;
      const imgX = x0;
      const imgY = bodyBottom + 14;
      try {
        const bytes = await fetch(activeImgUrl!).then((r) => r.arrayBuffer());
        const embedded = activeImgUrl!.includes('image/png')
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const aspect = embedded.width / embedded.height;
        let drawW = imgW;
        let drawH = drawW / aspect;
        if (drawH > imgH) {
          drawH = imgH;
          drawW = drawH * aspect;
        }
        const drawX = imgX + (wantFullSheet ? (imgW - drawW) / 2 : 0);
        const drawY = imgY + (imgH - drawH);

        page.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });

        // Overlay OMR result markers ONLY in 'annotated' mode when image is in canonical/warped space
        if (imageMode === 'annotated' && item.isWarpedCoords !== false) {
          const p2Groups = new Map<number, typeof submission.recognition.questions>();
          for (const q of submission.recognition.questions) {
            if (q.part === 'part2') {
              const g = p2Groups.get(q.question) || [];
              g.push(q);
              p2Groups.set(q.question, g);
            }
            for (const b of q.bubbles) {
              const bx = drawX + b.cx * drawW;
              const by = drawY + (1 - b.cy) * drawH;
              const br = Math.max(2.6, Math.min(b.rx * drawW, b.ry * drawH) * 1.15);

              const isChosen =
                q.part === 'part3'
                  ? b.isMarked
                  : q.detectedValue
                  ? b.option === q.detectedValue
                  : b.isMarked;

              if (q.status === 'correct' && isChosen) {
                page.drawCircle({ x: bx, y: by, size: br + 1.3, borderColor: rgb(0.09, 0.64, 0.29), borderWidth: 1.3 });
              } else if (q.status === 'wrong') {
                if (isChosen) {
                  page.drawLine({ start: { x: bx - br, y: by - br }, end: { x: bx + br, y: by + br }, color: rgb(0.86, 0.15, 0.15), thickness: 1.25 });
                  page.drawLine({ start: { x: bx - br, y: by + br }, end: { x: bx + br, y: by - br }, color: rgb(0.86, 0.15, 0.15), thickness: 1.25 });
                }
                if (options.showCorrectAnswers && q.part !== 'part3' && b.option === q.correctValue) {
                  page.drawCircle({ x: bx, y: by, size: br + 1.2, borderColor: rgb(0.14, 0.39, 0.92), borderWidth: 1.2 });
                }
              } else if (q.status === 'blank') {
                if (options.showCorrectAnswers && q.part !== 'part3' && b.option === q.correctValue) {
                  page.drawCircle({ x: bx, y: by, size: br + 1.2, borderColor: rgb(0.14, 0.39, 0.92), borderWidth: 1.1 });
                }
              } else if (
                (q.status === 'multi_mark' || q.status === 'faint' || q.status === 'erased' || q.status === 'pending_review' || q.status === 'unrecognized') &&
                b.isMarked
              ) {
                page.drawCircle({ x: bx, y: by, size: br + 1.4, borderColor: rgb(0.92, 0.45, 0.05), borderWidth: 1.3 });
              }
            }

            // Part III summary badge near top-left of question grid
            if (q.part === 'part3' && q.bubbles.length > 0) {
              const firstB = q.bubbles[0];
              const px = drawX + firstB.cx * drawW;
              const py = drawY + (1 - firstB.cy) * drawH + 14;
              const tagColor =
                q.status === 'correct'
                  ? rgb(0.09, 0.64, 0.29)
                  : q.status === 'wrong'
                  ? rgb(0.86, 0.15, 0.15)
                  : rgb(0.45, 0.5, 0.58);
              const tagTxt = options.showCorrectAnswers
                ? `${q.detectedValue || 'Trống'} / ĐÁ:${q.correctValue || '-'}`
                : `${q.detectedValue || 'Trống'}`;
              page.drawText(tagTxt, { x: px, y: py, size: 5.5, font: fontBold, color: tagColor });
            }
          }

          // Part II progressive whole-question point callout near subItem 'd'
          for (const [, p2Items] of p2Groups.entries()) {
            const last = p2Items[p2Items.length - 1];
            const refB = last?.bubbles[0];
            if (!refB) continue;
            const qEarned = roundTo2(p2Items.reduce((a, b) => a + b.earnedPoints, 0));
            const bx = drawX + refB.cx * drawW + 22;
            const by = drawY + (1 - refB.cy) * drawH - 10;
            page.drawText(`+${qEarned}đ`, {
              x: bx,
              y: by,
              size: 5.8,
              font: fontBold,
              color: qEarned > 0 ? rgb(0.09, 0.55, 0.29) : rgb(0.6, 0.2, 0.2),
            });
          }
        }

        if (!wantFullSheet) {
          tableX = x0 + imgW + 10;
          tableW = innerW - imgW - 10;
        }
      } catch {
        page.drawText('(Không thể tải ảnh phiếu thi)', { x: imgX + 10, y: imgY + imgH * 0.5, size: 8, font: fontReg });
      }
      page.drawText(
        'Ký hiệu: Xanh lá = Đúng | X đỏ = Sai | Vòng xanh dương = Đáp án đúng | Cam = Cần duyệt',
        { x: x0, y: bodyBottom + 2, size: 6.5 * scaleF, font: fontReg, color: rgb(0.4, 0.46, 0.54) }
      );
    }

    // Topic/cognitive breakdown table for 'competency' template
    if (templateKind === 'competency' && exam.questionSpecs && exam.questionSpecs.length > 0) {
      const specMap = new Map(exam.questionSpecs.map((s) => [`${s.part}_${s.question}`, s]));
      const byTopic = new Map<string, { earned: number; max: number; count: number }>();
      for (const q of submission.recognition.questions) {
        const sp = specMap.get(`${q.part}_${q.question}`);
        const tp = sp?.topic || 'Chung';
        const cur = byTopic.get(tp) || { earned: 0, max: 0, count: 0 };
        cur.earned += q.earnedPoints;
        cur.max += q.maxPoints || 0.25;
        cur.count += 1;
        byTopic.set(tp, cur);
      }
      page.drawText('PHÂN TÍCH MỨC ĐỘ ĐẠT THEO CHUYÊN ĐỀ', {
        x: tableX,
        y: curTop - 8,
        size: 8.8 * scaleF,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      let cy = curTop - 24;
      for (const [tp, v] of byTopic.entries()) {
        if (cy < bodyBottom + 16) break;
        const pct = v.max > 0 ? Math.round((v.earned / v.max) * 100) : 0;
        page.drawText(`${tp} (${v.count} ý): ${roundTo2(v.earned)}/${roundTo2(v.max)} đ (${pct}%)`, {
          x: tableX,
          y: cy,
          size: 7.6 * scaleF,
          font: fontReg,
          color: rgb(0.15, 0.2, 0.28),
        });
        cy -= 13 * scaleF;
      }
    } else if (showDetailTable && !wantFullSheet) {
      // Multi-column detail question breakdown table so ALL questions fit without truncation
      page.drawText('BẢNG CHI TIẾT TỪNG CÂU HỎI', {
        x: tableX,
        y: curTop - 8,
        size: 8.8 * scaleF,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      const qs = submission.recognition.questions;
      const lineH = compact ? 9.5 : 11.5;
      const maxRowsPerCol = Math.max(10, Math.floor((availBodyH - 28) / lineH));
      const numCols = qs.length > maxRowsPerCol ? 2 : 1;
      const colW = tableW / numCols;

      for (let c = 0; c < numCols; c++) {
        const cx = tableX + c * colW;
        page.drawText('Câu   Chọn  ĐÁ   KQ', {
          x: cx,
          y: curTop - 21,
          size: 6.8 * scaleF,
          font: fontBold,
          color: rgb(0.4, 0.45, 0.52),
        });
        const slice = qs.slice(c * maxRowsPerCol, (c + 1) * maxRowsPerCol);
        let ry = curTop - 33;
        for (const q of slice) {
          const label =
            q.part === 'part1'
              ? `I.${q.question}`
              : q.part === 'part2'
              ? `II.${q.question}${q.subItem || ''}`
              : `III.${q.question}`;
          const stTxt =
            q.status === 'correct'
              ? 'Đúng'
              : q.status === 'wrong'
              ? 'Sai'
              : q.status === 'blank'
              ? 'Trống'
              : 'Duyệt';
          const stClr =
            q.status === 'correct'
              ? rgb(0.09, 0.64, 0.29)
              : q.status === 'wrong'
              ? rgb(0.86, 0.15, 0.15)
              : q.status === 'blank'
              ? rgb(0.45, 0.5, 0.58)
              : rgb(0.85, 0.47, 0.02);
          const fSz = (compact ? 6.2 : 7.0);
          page.drawText(label, { x: cx, y: ry, size: fSz, font: fontReg, color: rgb(0.15, 0.2, 0.28) });
          page.drawText(q.detectedValue || '-', { x: cx + colW * 0.26, y: ry, size: fSz, font: fontBold, color: rgb(0.15, 0.2, 0.28) });
          page.drawText(options.showCorrectAnswers ? q.correctValue || '-' : '***', {
            x: cx + colW * 0.5,
            y: ry,
            size: fSz,
            font: fontReg,
            color: rgb(0.15, 0.2, 0.28),
          });
          page.drawText(stTxt, { x: cx + colW * 0.74, y: ry, size: fSz, font: fontBold, color: stClr });
          ry -= lineH;
        }
      }
    }

    // Comment box
    let sigTopY = boxY + pad + (showSignature ? (compact ? 30 : 44) : 4);
    if (options.showComment) {
      const cBoxH = compact ? 52 : 66;
      const cBoxY = sigTopY + 6;
      page.drawRectangle({
        x: x0,
        y: cBoxY,
        width: innerW,
        height: cBoxH,
        color: rgb(0.98, 0.99, 1),
        borderColor: rgb(0.85, 0.88, 0.93),
        borderWidth: 0.8,
      });
      page.drawText('Nhận xét của giáo viên / phân tích kết quả:', {
        x: x0 + 8,
        y: cBoxY + cBoxH - 13,
        size: 7.8 * scaleF,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      const comment =
        submission.teacherComment?.trim() ||
        generateObjectiveComment(submission, exam, options.commentBands);
      const lines = wrapTextLines(comment, compact ? 76 : 102).slice(0, 3);
      lines.forEach((ln, idx) => {
        page.drawText(ln, {
          x: x0 + 8,
          y: cBoxY + cBoxH - 26 - idx * (11 * scaleF),
          size: 7.6 * scaleF,
          font: fontReg,
          color: rgb(0.2, 0.25, 0.33),
        });
      });
    }

    // Signature block
    if (showSignature) {
      page.drawText(`Ngày trả bài: ${exam.examDate || '..../..../2026'}`, {
        x: x0,
        y: boxY + pad + 18,
        size: 7.4 * scaleF,
        font: fontReg,
        color: rgb(0.35, 0.4, 0.48),
      });
      page.drawText(`Giáo viên chấm: ${exam.teacherName || '....................'}`, {
        x: x0 + innerW * 0.56,
        y: boxY + pad + 18,
        size: 7.4 * scaleF,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.33),
      });
      page.drawText('(Ký và ghi rõ họ tên)', {
        x: x0 + innerW * 0.62,
        y: boxY + pad + 7,
        size: 6.6 * scaleF,
        font: fontReg,
        color: rgb(0.45, 0.5, 0.58),
      });
    }
  };

  if (paperFormat === 'paired_a5') {
    const pw = 841.89;
    const ph = 595.28;
    for (let i = 0; i < submissions.length; i += 2) {
      const page = pdfDoc.addPage([pw, ph]);
      // Center cut line
      page.drawLine({
        start: { x: pw / 2, y: 14 },
        end: { x: pw / 2, y: ph - 14 },
        color: rgb(0.75, 0.8, 0.86),
        thickness: 0.8,
        dashArray: [4, 4],
      });
      await drawSingleReportCardInRect(page, submissions[i], 0, 0, pw / 2, ph, true);
      if (submissions[i + 1]) {
        await drawSingleReportCardInRect(page, submissions[i + 1], pw / 2, 0, pw / 2, ph, true);
      }
    }
  } else {
    const [pw, ph] = paperFormat === 'A5' ? [419.53, 595.28] : [595.28, 841.89];
    for (const item of submissions) {
      const page = pdfDoc.addPage([pw, ph]);
      await drawSingleReportCardInRect(page, item, 0, 0, pw, ph, paperFormat === 'A5');
    }
  }

  return pdfDoc.save();
}

function roundTo2(v: number): number {
  return Math.round((v + Number.EPSILON) * 100) / 100;
}


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
    const r = Math.max(4, Math.min(b.rx * W, b.ry * H));

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
    bctx.strokeStyle = '#334155';
    bctx.lineWidth = 1.3;
    bctx.stroke();

    // Option text inside bubble
    bctx.fillStyle = '#64748B';
    bctx.font = `${Math.max(8, Math.round(r * 1.05))}px sans-serif`;
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

export interface ReportCardOptions {
  showRanking: boolean;
  showCorrectAnswers: boolean;
  showComment: boolean;
  classAverage: number;
  rank?: number;
  totalGraded: number;
}

export function generateObjectiveComment(sub: ExamSubmission): string {
  const { total, maxPossible, correctCount, wrongCount, blankCount } = sub.scoreBreakdown;
  const parts: string[] = [
    `Đạt ${total}/${maxPossible} điểm (${correctCount} ý đúng, ${wrongCount} ý sai, ${blankCount} ý bỏ trống).`,
  ];
  if (sub.reviewReasons.length > 0) {
    parts.push(`Lưu ý kiểm tra lại: ${sub.reviewReasons.join('; ')}.`);
  }
  return parts.join(' ');
}

export async function renderAnnotatedReportCardPdf(
  submissions: {
    submission: ExamSubmission;
    student?: Student;
    warpedImageDataUrl?: string;
    rank?: number;
  }[],
  exam: Exam,
  template: SheetTemplate,
  options: ReportCardOptions
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);
  const fonts = await loadVietnameseFonts();
  const fontReg = await pdfDoc.embedFont(fonts.regular);
  const fontBold = await pdfDoc.embedFont(fonts.bold);

  for (const item of submissions) {
    const { submission, student, warpedImageDataUrl, rank } = item;
    const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait report card
    const pw = 595.28;
    const ph = 841.89;

    // Header
    page.drawRectangle({ x: 24, y: ph - 96, width: pw - 48, height: 74, color: rgb(0.96, 0.97, 0.99), borderColor: rgb(0.82, 0.86, 0.92), borderWidth: 1 });
    page.drawText(exam.schoolName || 'TRƯỜNG THPT', { x: 34, y: ph - 40, size: 10, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
    page.drawText(`PHIẾU TRẢ BÀI KIỂM TRA – ${exam.name}`, { x: 34, y: ph - 56, size: 11.5, font: fontBold, color: rgb(0.14, 0.39, 0.92) });
    page.drawText(
      `Môn: ${exam.subject}  |  Họ tên: ${student?.fullName || '(Chưa đối chiếu)'}  |  SBD: ${submission.sbd || '---'}  |  Lớp: ${student?.className || '---'}  |  Mã đề: ${submission.examCode || '---'}`,
      { x: 34, y: ph - 74, size: 8.5, font: fontReg, color: rgb(0.2, 0.25, 0.33) }
    );

    // Score summary bar
    const rankStr = options.showRanking && rank ? `  |  Hạng: ${rank}/${options.totalGraded}` : '';
    page.drawText(
      `Tổng điểm: ${submission.scoreBreakdown.total}/${submission.scoreBreakdown.maxPossible}   (P.I: ${submission.scoreBreakdown.part1} · P.II: ${submission.scoreBreakdown.part2} · P.III: ${submission.scoreBreakdown.part3})   |   ĐTB lớp: ${options.classAverage}${rankStr}`,
      { x: 34, y: ph - 89, size: 8.8, font: fontBold, color: rgb(0.09, 0.55, 0.29) }
    );

    // Draw annotated warped sheet image on left (with exact coordinate overlay!)
    const imgBoxX = 24;
    const imgBoxY = 148;
    const imgBoxW = 316;
    const imgBoxH = 580;

    if (warpedImageDataUrl) {
      try {
        const bytes = await fetch(warpedImageDataUrl).then((r) => r.arrayBuffer());
        const embedded = warpedImageDataUrl.includes('image/png')
          ? await pdfDoc.embedPng(bytes)
          : await pdfDoc.embedJpg(bytes);
        const aspect = embedded.width / embedded.height;
        let drawW = imgBoxW;
        let drawH = drawW / aspect;
        if (drawH > imgBoxH) {
          drawH = imgBoxH;
          drawW = drawH * aspect;
        }
        const drawX = imgBoxX;
        const drawY = imgBoxY + (imgBoxH - drawH);

        page.drawImage(embedded, { x: drawX, y: drawY, width: drawW, height: drawH });

        // Overlay vector annotations using exact canonical bubble coordinates (non-occluding!)
        for (const q of submission.recognition.questions) {
          for (const b of q.bubbles) {
            const bx = drawX + b.cx * drawW;
            const by = drawY + (1 - b.cy) * drawH;
            const br = Math.max(3, b.rx * drawW * 1.15);

            if (q.status === 'correct' && b.option === q.detectedValue) {
              page.drawCircle({ x: bx, y: by, size: br + 1.5, borderColor: rgb(0.09, 0.64, 0.29), borderWidth: 1.4 });
            } else if (q.status === 'wrong') {
              if (b.option === q.detectedValue) {
                page.drawLine({ start: { x: bx - br, y: by - br }, end: { x: bx + br, y: by + br }, color: rgb(0.86, 0.15, 0.15), thickness: 1.3 });
                page.drawLine({ start: { x: bx - br, y: by + br }, end: { x: bx + br, y: by - br }, color: rgb(0.86, 0.15, 0.15), thickness: 1.3 });
              }
              if (options.showCorrectAnswers && b.option === q.correctValue) {
                page.drawCircle({ x: bx + br * 1.9, y: by, size: br * 0.65, color: rgb(0.09, 0.64, 0.29) });
              }
            } else if (q.status === 'blank' && options.showCorrectAnswers && b.option === q.correctValue) {
              page.drawRectangle({ x: bx - br, y: by - br, width: br * 2, height: br * 2, borderColor: rgb(0.14, 0.39, 0.92), borderWidth: 1.1 });
            } else if (
              (q.status === 'multi_mark' || q.status === 'faint' || q.status === 'erased' || q.status === 'pending_review') &&
              b.isMarked
            ) {
              page.drawCircle({ x: bx, y: by, size: br + 1.5, borderColor: rgb(0.92, 0.5, 0.05), borderWidth: 1.4 });
            }
          }
        }
      } catch {
        page.drawText('(Không thể nhúng ảnh bài thi)', { x: imgBoxX + 20, y: imgBoxY + 280, size: 9, font: fontReg });
      }
    }

    // Right panel: detailed question breakdown table
    const tblX = 352;
    const tblTop = ph - 114;
    page.drawText('BẢNG CHI TIẾT CÂU HỎI', { x: tblX, y: tblTop, size: 9.5, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
    page.drawText('Câu     Chọn    Đáp án   Trạng thái', { x: tblX, y: tblTop - 16, size: 7.5, font: fontBold, color: rgb(0.4, 0.45, 0.52) });

    let rowY = tblTop - 30;
    const maxRows = 42;
    const items = submission.recognition.questions.slice(0, maxRows);
    for (const q of items) {
      const label =
        q.part === 'part1'
          ? `I.${q.question}`
          : q.part === 'part2'
          ? `II.${q.question}${q.subItem || ''}`
          : `III.${q.question}`;
      const statusText =
        q.status === 'correct'
          ? 'Đúng'
          : q.status === 'wrong'
          ? 'Sai'
          : q.status === 'blank'
          ? 'Trống'
          : 'Duyệt';
      const statusColor =
        q.status === 'correct'
          ? rgb(0.09, 0.64, 0.29)
          : q.status === 'wrong'
          ? rgb(0.86, 0.15, 0.15)
          : q.status === 'blank'
          ? rgb(0.45, 0.5, 0.58)
          : rgb(0.85, 0.47, 0.02);

      page.drawText(label, { x: tblX, y: rowY, size: 7.4, font: fontReg, color: rgb(0.15, 0.2, 0.28) });
      page.drawText(q.detectedValue || '-', { x: tblX + 52, y: rowY, size: 7.4, font: fontBold, color: rgb(0.15, 0.2, 0.28) });
      page.drawText(options.showCorrectAnswers ? q.correctValue || '-' : '***', { x: tblX + 95, y: rowY, size: 7.4, font: fontReg, color: rgb(0.15, 0.2, 0.28) });
      page.drawText(statusText, { x: tblX + 145, y: rowY, size: 7.4, font: fontBold, color: statusColor });
      rowY -= 13.5;
    }

    // Legend & objective comment at bottom
    page.drawText(
      'Ký hiệu trên ảnh: Vòng xanh lá = Đúng | Chữ X đỏ = Sai | Chấm xanh = Đáp án đúng | Khung xanh dương = Bỏ trống | Vòng cam = Cần duyệt',
      { x: 24, y: 122, size: 7.2, font: fontReg, color: rgb(0.35, 0.4, 0.48) }
    );

    if (options.showComment) {
      page.drawRectangle({ x: 24, y: 42, width: pw - 48, height: 68, color: rgb(0.98, 0.99, 1), borderColor: rgb(0.85, 0.88, 0.93), borderWidth: 0.8 });
      page.drawText('Nhận xét dựa trên dữ liệu chấm:', { x: 34, y: 94, size: 8.5, font: fontBold, color: rgb(0.12, 0.16, 0.23) });
      const comment = generateObjectiveComment(submission);
      page.drawText(comment.slice(0, 115), { x: 34, y: 78, size: 8.2, font: fontReg, color: rgb(0.2, 0.25, 0.33) });
      if (comment.length > 115) {
        page.drawText(comment.slice(115, 230), { x: 34, y: 63, size: 8.2, font: fontReg, color: rgb(0.2, 0.25, 0.33) });
      }
    }
  }

  return pdfDoc.save();
}

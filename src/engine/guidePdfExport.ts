import { PDFDocument, rgb, type PDFFont } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { GUIDE_FAQS, GUIDE_SECTIONS, type GuideSection } from '../data/guideSections';

function wrapTextToWidth(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  if (!cleaned) return [];
  const words = cleaned.split(' ');
  const lines: string[] = [];
  let current = '';

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      if (current) lines.push(current);
      if (font.widthOfTextAtSize(word, fontSize) <= maxWidth) {
        current = word;
      } else {
        // Hard-split exceptionally long tokens without spaces
        let chunk = '';
        for (const ch of word) {
          if (font.widthOfTextAtSize(chunk + ch, fontSize) <= maxWidth) {
            chunk += ch;
          } else {
            if (chunk) lines.push(chunk);
            chunk = ch;
          }
        }
        current = chunk;
      }
    }
  }
  if (current) lines.push(current);
  return lines;
}

export async function exportGuideToPDF(sectionOnly?: GuideSection): Promise<void> {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regRes, boldRes] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/fonts/DejaVuSans-Bold.ttf'),
  ]);
  const [regBytes, boldBytes] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
  const fontReg = await pdfDoc.embedFont(regBytes);
  const fontBold = await pdfDoc.embedFont(boldBytes);

  const pageWidth = 595.28; // A4
  const pageHeight = 841.89;
  const marginX = 44;
  const maxWidth = pageWidth - marginX * 2;
  const bottomLimit = 52;

  let page = pdfDoc.addPage([pageWidth, pageHeight]);
  let y = pageHeight - 48;

  const newPage = () => {
    page = pdfDoc.addPage([pageWidth, pageHeight]);
    y = pageHeight - 48;
  };

  const ensureSpace = (needed: number) => {
    if (y - needed < bottomLimit) {
      newPage();
    }
  };

  const drawParagraph = (
    text: string,
    opts?: {
      bold?: boolean;
      size?: number;
      color?: ReturnType<typeof rgb>;
      indent?: number;
      lineGap?: number;
      spaceAfter?: number;
    }
  ) => {
    const size = opts?.size ?? 10.5;
    const font = opts?.bold ? fontBold : fontReg;
    const color = opts?.color ?? rgb(0.12, 0.16, 0.23);
    const indent = opts?.indent ?? 0;
    const lineGap = opts?.lineGap ?? Math.round(size * 1.48);
    const lines = wrapTextToWidth(text, font, size, maxWidth - indent);

    for (const line of lines) {
      ensureSpace(lineGap + 2);
      page.drawText(line, { x: marginX + indent, y, size, font, color });
      y -= lineGap;
    }
    if (opts?.spaceAfter) {
      y -= opts.spaceAfter;
    }
  };

  // Document Header
  drawParagraph('CHẤM THI THÔNG MINH – TÀI LIỆU HƯỚNG DẪN SỬ DỤNG', {
    bold: true,
    size: 14,
    color: rgb(0.145, 0.388, 0.922),
    spaceAfter: 4,
  });
  drawParagraph(
    sectionOnly
      ? `Chuyên mục ${sectionOnly.number}: ${sectionOnly.title}`
      : 'Trọn bộ tài liệu hướng dẫn 16 chuyên mục & 14 câu hỏi thường gặp',
    { bold: false, size: 10.5, color: rgb(0.28, 0.33, 0.41), spaceAfter: 10 }
  );

  const targets = sectionOnly ? [sectionOnly] : GUIDE_SECTIONS;

  targets.forEach((sec, idx) => {
    if (idx > 0) {
      y -= 8;
      ensureSpace(40);
    }

    drawParagraph(`${sec.number}. ${sec.title.toUpperCase()} (${sec.category})`, {
      bold: true,
      size: 12.5,
      color: rgb(0.145, 0.388, 0.922),
      spaceAfter: 4,
    });
    drawParagraph(sec.summary, { bold: false, size: 10, color: rgb(0.28, 0.33, 0.41), spaceAfter: 6 });

    drawParagraph('1) Chức năng & Mục đích:', { bold: true, size: 10.5, spaceAfter: 2 });
    drawParagraph(sec.purpose, { size: 10, spaceAfter: 5 });

    if (sec.whenToUse.length > 0) {
      drawParagraph('2) Khi nào nên sử dụng:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.whenToUse.forEach((item) => drawParagraph(`• ${item}`, { size: 10, indent: 10, spaceAfter: 2 }));
      y -= 3;
    }

    drawParagraph('3) Cách mở chức năng:', { bold: true, size: 10.5, spaceAfter: 2 });
    drawParagraph(sec.howToOpen, { size: 10, spaceAfter: 5 });

    if (sec.prerequisites.length > 0) {
      drawParagraph('4) Điều kiện cần chuẩn bị:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.prerequisites.forEach((item) => drawParagraph(`• ${item}`, { size: 10, indent: 10, spaceAfter: 2 }));
      y -= 3;
    }

    if (sec.steps.length > 0) {
      drawParagraph('5) Hướng dẫn thao tác từng bước:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.steps.forEach((st, sIdx) => {
        drawParagraph(`Bước ${sIdx + 1}: ${st.title}`, { bold: true, size: 10, indent: 10, spaceAfter: 1 });
        drawParagraph(st.detail, { size: 10, indent: 18, spaceAfter: 3 });
      });
    }

    if (sec.controlsAndFields.length > 0) {
      drawParagraph('6) Ý nghĩa các nút bấm và trường nhập liệu:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.controlsAndFields.forEach((cf) => {
        drawParagraph(`• ${cf.name}: ${cf.meaning}`, { size: 10, indent: 10, spaceAfter: 2 });
      });
      y -= 3;
    }

    drawParagraph(`7) Ví dụ thực tế – ${sec.practicalExample.scenario}:`, { bold: true, size: 10.5, spaceAfter: 2 });
    sec.practicalExample.walkthrough.forEach((w, wIdx) => {
      drawParagraph(`${wIdx + 1}. ${w}`, { size: 10, indent: 10, spaceAfter: 2 });
    });
    y -= 3;

    drawParagraph('8) Kết quả nhận được:', { bold: true, size: 10.5, spaceAfter: 2 });
    drawParagraph(sec.expectedResult, { size: 10, spaceAfter: 5 });

    if (sec.importantNotes.length > 0) {
      drawParagraph('9) Lưu ý quan trọng:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.importantNotes.forEach((n) => drawParagraph(`• ${n}`, { size: 10, indent: 10, spaceAfter: 2 }));
      y -= 3;
    }

    if (sec.troubleshooting.length > 0) {
      drawParagraph('10) Lỗi thường gặp & Cách xử lý:', { bold: true, size: 10.5, spaceAfter: 2 });
      sec.troubleshooting.forEach((t) => {
        drawParagraph(`• ${t.problem} — Nguyên nhân: ${t.cause} Cách xử lý: ${t.solution}`, {
          size: 10,
          indent: 10,
          spaceAfter: 3,
        });
      });
    }

    if (sec.id === 'faq') {
      y -= 4;
      drawParagraph('DANH SÁCH 14 CÂU HỎI THƯỜNG GẶP', {
        bold: true,
        size: 11.5,
        color: rgb(0.145, 0.388, 0.922),
        spaceAfter: 5,
      });
      GUIDE_FAQS.forEach((faq, fIdx) => {
        drawParagraph(`Câu ${fIdx + 1}: ${faq.question}`, { bold: true, size: 10.5, spaceAfter: 2 });
        faq.answerParagraphs.forEach((p) => drawParagraph(p, { size: 10, indent: 10, spaceAfter: 2 }));
        if (faq.steps) {
          faq.steps.forEach((s, sIdx) =>
            drawParagraph(`${sIdx + 1}. ${s}`, { size: 10, indent: 16, spaceAfter: 2 })
          );
        }
        y -= 3;
      });
    }
  });

  // Page numbers
  const pages = pdfDoc.getPages();
  pages.forEach((p, idx) => {
    const label = `Trang ${idx + 1} / ${pages.length}`;
    p.drawText(label, {
      x: pageWidth - marginX - fontReg.widthOfTextAtSize(label, 9),
      y: 26,
      size: 9,
      font: fontReg,
      color: rgb(0.45, 0.5, 0.58),
    });
  });

  const pdfBytes = await pdfDoc.save();
  const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = sectionOnly
    ? `Huong_dan_${sectionOnly.number}_${sectionOnly.id}_ChamThiThongMinh.pdf`
    : 'Tai_lieu_Huong_dan_ChamThiThongMinh.pdf';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

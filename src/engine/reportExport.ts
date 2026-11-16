import ExcelJS from 'exceljs';
import {
  AlignmentType,
  BorderStyle,
  Document,
  HeadingLevel,
  ImageRun,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import type { Exam } from '../types/omr';
import type { FullAnalyticsReportData } from './analyticsEngine';

export interface TeacherReportSections {
  generalComment: string;
  questionReviewNote: string;
  adjustmentRecommendation: string;
  reinforcementPlan: string;
}

export interface ReportChartImage {
  title: string;
  dataUrl: string; // PNG data URL
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const base64 = dataUrl.split(',')[1] || '';
  const bin = atob(base64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

// ---------- WORD (.DOCX) EXPORT (Times New Roman 13pt) ----------
const TNR_SIZE = 26; // 13pt = 26 half-points in OOXML
const TNR_SMALL = 24; // 12pt for dense tables

function tnrPara(
  text: string,
  opts?: { bold?: boolean; italic?: boolean; size?: number; align?: (typeof AlignmentType)[keyof typeof AlignmentType]; spaceAfter?: number }
): Paragraph {
  return new Paragraph({
    alignment: opts?.align ?? AlignmentType.LEFT,
    spacing: { after: opts?.spaceAfter ?? 120, line: 276 },
    children: [
      new TextRun({
        text,
        font: 'Times New Roman',
        size: opts?.size ?? TNR_SIZE,
        bold: opts?.bold,
        italics: opts?.italic,
      }),
    ],
  });
}

function tnrCell(text: string | number, bold = false, align: (typeof AlignmentType)[keyof typeof AlignmentType] = AlignmentType.LEFT): TableCell {
  return new TableCell({
    borders: {
      top: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      bottom: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      left: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
      right: { style: BorderStyle.SINGLE, size: 4, color: '94A3B8' },
    },
    children: [
      new Paragraph({
        alignment: align,
        spacing: { before: 40, after: 40 },
        children: [
          new TextRun({
            text: String(text),
            font: 'Times New Roman',
            size: TNR_SMALL,
            bold,
          }),
        ],
      }),
    ],
  });
}

export async function exportAnalyticsWordDocx(params: {
  exam: Exam;
  data: FullAnalyticsReportData;
  classFilter: string;
  codeFilter: string;
  passThreshold: number;
  teacherSections: TeacherReportSections;
  chartImages: ReportChartImage[];
}): Promise<void> {
  const { exam, data, classFilter, codeFilter, passThreshold, teacherSections, chartImages } = params;
  const children: (Paragraph | Table)[] = [];

  children.push(tnrPara((exam.schoolName || 'TRƯỜNG THPT').toUpperCase(), { bold: true, align: AlignmentType.CENTER, spaceAfter: 60 }));
  children.push(
    new Paragraph({
      heading: HeadingLevel.HEADING_1,
      alignment: AlignmentType.CENTER,
      spacing: { after: 120 },
      children: [
        new TextRun({
          text: `BÁO CÁO PHÂN TÍCH KẾT QUẢ & CHẤT LƯỢNG ĐỀ KIỂM TRA`,
          font: 'Times New Roman',
          size: 30,
          bold: true,
        }),
      ],
    })
  );
  children.push(
    tnrPara(
      `Kỳ kiểm tra: ${exam.name} | Môn: ${exam.subject} | Khối: ${exam.gradeLevel} | Phạm vi lớp: ${
        classFilter === 'all' ? exam.classNames.join(', ') || 'Tất cả' : classFilter
      } | Mã đề: ${codeFilter === 'all' ? 'Tất cả' : codeFilter}`,
      { italic: true, align: AlignmentType.CENTER, spaceAfter: 200 }
    )
  );

  // 1. Summary Table
  children.push(tnrPara('I. TỔNG HỢP SỐ LIỆU CHÍNH THỨC (CHỈ TÍNH BÀI ĐÃ KIỂM DUYỆT)', { bold: true }));
  const summaryRows: [string, string][] = [
    ['Tổng học sinh thuộc phạm vi', String(data.totalStudents)],
    ['Số bài đã kiểm duyệt chính thức', String(data.summary.presentCount)],
    ['Số bài chờ kiểm duyệt (chưa tính thống kê)', String(data.reviewCount)],
    ['Số học sinh vắng thi', String(data.summary.absentCount)],
    ['Điểm trung bình / Trung vị', `${data.summary.mean} / ${data.summary.median}`],
    ['Độ lệch chuẩn', String(data.summary.stdDev)],
    ['Điểm cao nhất / Thấp nhất', `${data.summary.max} / ${data.summary.min}`],
    [`Số đạt (>= ${passThreshold}đ) / Tỉ lệ đạt`, `${data.summary.passCount} (${data.summary.passRate}%)`],
    [`Số chưa đạt (< ${passThreshold}đ) / Tỉ lệ`, `${data.failCount} (${data.failRate}%)`],
    ['Ghi chú độ tin cậy KR-20', data.kr20OverallNote],
  ];
  children.push(
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: [
        new TableRow({ children: [tnrCell('Chỉ tiêu thống kê', true), tnrCell('Giá trị', true)] }),
        ...summaryRows.map(([k, v]) => new TableRow({ children: [tnrCell(k), tnrCell(v)] })),
      ],
    })
  );

  children.push(tnrPara('', { spaceAfter: 120 }));

  // 2. Class comparison
  if (data.classComparison.length > 0) {
    children.push(tnrPara('II. SO SÁNH KẾT QUẢ THEO LỚP', { bold: true }));
    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: [
          new TableRow({
            children: [
              tnrCell('Lớp', true),
              tnrCell('Đã duyệt', true, AlignmentType.RIGHT),
              tnrCell('Vắng', true, AlignmentType.RIGHT),
              tnrCell('ĐTB', true, AlignmentType.RIGHT),
              tnrCell('Trung vị', true, AlignmentType.RIGHT),
              tnrCell('Cao nhất', true, AlignmentType.RIGHT),
              tnrCell('Thấp nhất', true, AlignmentType.RIGHT),
              tnrCell('Tỉ lệ đạt (%)', true, AlignmentType.RIGHT),
            ],
          }),
          ...data.classComparison.map(
            (r) =>
              new TableRow({
                children: [
                  tnrCell(r.className),
                  tnrCell(r.gradedCount, false, AlignmentType.RIGHT),
                  tnrCell(r.absentCount, false, AlignmentType.RIGHT),
                  tnrCell(r.mean, false, AlignmentType.RIGHT),
                  tnrCell(r.median, false, AlignmentType.RIGHT),
                  tnrCell(r.max, false, AlignmentType.RIGHT),
                  tnrCell(r.min, false, AlignmentType.RIGHT),
                  tnrCell(`${r.passRate}%`, false, AlignmentType.RIGHT),
                ],
              })
          ),
        ],
      })
    );
    children.push(tnrPara('', { spaceAfter: 120 }));
  }

  // 3. Embedded charts
  if (chartImages.length > 0) {
    children.push(tnrPara('III. BIỂU ĐỒ TRỰC QUAN', { bold: true }));
    for (const img of chartImages) {
      try {
        const bytes = dataUrlToUint8Array(img.dataUrl);
        children.push(tnrPara(img.title, { bold: true, spaceAfter: 60 }));
        children.push(
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 160 },
            children: [
              new ImageRun({
                data: bytes,
                transformation: { width: 560, height: 250 },
                type: 'png',
              }),
            ],
          })
        );
      } catch {
        // Ignore broken chart snapshot gracefully
      }
    }
  }

  // 4. Per-code analysis
  children.push(tnrPara('IV. PHÂN TÍCH CÂU HỎI THEO TỪNG MÃ ĐỀ', { bold: true }));
  for (const grp of data.codeGroups) {
    children.push(
      tnrPara(
        `Mã đề ${grp.examCode} (${grp.sampleCount} bài đã duyệt) – KR-20 Phần I: ${
          grp.kr20 !== null ? grp.kr20 : 'Chưa áp dụng'
        } (${grp.kr20Note})`,
        { bold: true }
      )
    );
    const flagged = [
      ...grp.part1Items.filter((i) => i.warnings.length > 0).map((i) => `Phần I - ${i.label} (${i.correctRate}% đúng): ${i.warnings.join('; ')}`),
      ...grp.part2Items.filter((i) => i.warnings.length > 0).map((i) => `Phần II - ${i.label} (${Math.round(i.completionRatio * 100)}% điểm): ${i.warnings.join('; ')}`),
      ...grp.part3Items.filter((i) => i.warnings.length > 0).map((i) => `Phần III - ${i.label} (${i.correctRate}% đúng): ${i.warnings.join('; ')}`),
    ];
    if (flagged.length === 0) {
      children.push(tnrPara('- Không ghi nhận câu hỏi nào có cảnh báo bất thường theo ngưỡng heuristic.'));
    } else {
      for (const f of flagged) {
        children.push(tnrPara(`- ${f}`));
      }
    }
  }

  // 5. Teacher sections
  children.push(tnrPara('V. NHẬN XÉT & ĐỀ XUẤT CỦA GIÁO VIÊN', { bold: true }));
  children.push(tnrPara(`1. Nhận xét chung: ${teacherSections.generalComment || '---'}`));
  children.push(tnrPara(`2. Các câu cần rà soát: ${teacherSections.questionReviewNote || '---'}`));
  children.push(tnrPara(`3. Kiến nghị điều chỉnh đề/đáp án: ${teacherSections.adjustmentRecommendation || '---'}`));
  children.push(tnrPara(`4. Định hướng phụ đạo & bồi dưỡng: ${teacherSections.reinforcementPlan || '---'}`));
  children.push(
    tnrPara(`Giáo viên phụ trách: ${exam.teacherName || '....................'}`, {
      bold: true,
      align: AlignmentType.RIGHT,
      spaceAfter: 60,
    })
  );

  const doc = new Document({
    sections: [{ properties: {}, children }],
  });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `Bao-cao-phan-tich_${exam.subject}_${exam.name}.docx`.replace(/\s+/g, '_'));
}

// ---------- EXCEL (.XLSX) ANALYTICS EXPORT (Times New Roman 13pt) ----------
const XLSX_FONT = { name: 'Times New Roman', size: 13 };
const XLSX_BOLD = { name: 'Times New Roman', size: 13, bold: true };
const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

function styleHeader(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = XLSX_BOLD;
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE2E8F0' } };
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  });
  row.height = 24;
}

function styleData(row: ExcelJS.Row) {
  row.eachCell((cell) => {
    cell.font = XLSX_FONT;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', wrapText: true };
  });
  row.height = 21;
}

export async function exportAnalyticsExcelXLSX(params: {
  exam: Exam;
  data: FullAnalyticsReportData;
  passThreshold: number;
}): Promise<void> {
  const { exam, data, passThreshold } = params;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();

  const ws1 = wb.addWorksheet('Tong hop');
  ws1.addRow([`BÁO CÁO THỐNG KÊ KẾT QUẢ – ${exam.name}`]).getCell(1).font = {
    name: 'Times New Roman',
    size: 15,
    bold: true,
  };
  ws1.addRow([`Môn: ${exam.subject} | Khối: ${exam.gradeLevel} | Ngưỡng đạt: ${passThreshold}`]).getCell(1).font = XLSX_FONT;
  const h1 = ws1.addRow(['Chỉ tiêu', 'Giá trị']);
  styleHeader(h1);
  const items: [string, string | number][] = [
    ['Tổng học sinh', data.totalStudents],
    ['Bài đã duyệt (tính thống kê)', data.summary.presentCount],
    ['Bài chờ kiểm duyệt', data.reviewCount],
    ['Vắng thi', data.summary.absentCount],
    ['Điểm trung bình', data.summary.mean],
    ['Trung vị', data.summary.median],
    ['Độ lệch chuẩn', data.summary.stdDev],
    ['Cao nhất', data.summary.max],
    ['Thấp nhất', data.summary.min],
    ['Tỉ lệ đạt (%)', data.summary.passRate],
    ['KR-20', data.kr20OverallNote],
  ];
  for (const r of items) styleData(ws1.addRow(r));
  ws1.columns = [{ width: 38 }, { width: 46 }];

  const ws2 = wb.addWorksheet('So sanh lop & ma de');
  styleHeader(ws2.addRow(['Nhóm', 'Tên lớp / Mã đề', 'Số bài duyệt', 'Vắng', 'ĐTB', 'Cao nhất', 'Thấp nhất', 'Tỉ lệ đạt (%)']));
  for (const c of data.classComparison) {
    styleData(ws2.addRow(['Lớp', c.className, c.gradedCount, c.absentCount, c.mean, c.max, c.min, c.passRate]));
  }
  for (const m of data.codeComparison) {
    styleData(ws2.addRow(['Mã đề', m.examCode, m.gradedCount, 0, m.mean, m.max, m.min, m.passRate]));
  }
  ws2.views = [{ state: 'frozen', ySplit: 1 }];
  ws2.columns.forEach((col) => { col.width = 18; });

  const ws3 = wb.addWorksheet('Phan tich cau hoi');
  styleHeader(ws3.addRow(['Mã đề', 'Phần', 'Câu', 'Đáp án đúng', 'Tỉ lệ đúng / HT (%)', 'Độ khó (p)', 'Độ phân biệt (D)', 'Tương quan r_ir', 'Cảnh báo chuyên môn']));
  for (const grp of data.codeGroups) {
    for (const i of grp.part1Items) {
      styleData(ws3.addRow([grp.examCode, 'Phần I', i.question, i.correctValue, i.correctRate, i.difficulty, i.discrimination ?? '-', i.itemRestCorr ?? '-', i.warnings.join('; ')]));
    }
    for (const i of grp.part2Items) {
      styleData(ws3.addRow([grp.examCode, 'Phần II', i.question, i.correctValue, Math.round(i.completionRatio * 1000) / 10, i.completionRatio, i.discrimination ?? '-', '-', i.warnings.join('; ')]));
    }
    for (const i of grp.part3Items) {
      styleData(ws3.addRow([grp.examCode, 'Phần III', i.question, i.correctValue, i.correctRate, i.difficulty, i.discrimination ?? '-', '-', i.warnings.join('; ')]));
    }
  }
  ws3.views = [{ state: 'frozen', ySplit: 1 }];
  ws3.autoFilter = 'A1:I1';
  ws3.columns = [
    { width: 12 }, { width: 12 }, { width: 10 }, { width: 18 },
    { width: 20 }, { width: 14 }, { width: 18 }, { width: 16 }, { width: 48 },
  ];

  const buffer = await wb.xlsx.writeBuffer();
  downloadBlob(
    new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' }),
    `Thong-ke-phan-tich_${exam.subject}_${exam.name}.xlsx`.replace(/\s+/g, '_')
  );
}

// ---------- PDF PROFESSIONAL REPORT ----------
export async function exportAnalyticsPdf(params: {
  exam: Exam;
  data: FullAnalyticsReportData;
  classFilter: string;
  codeFilter: string;
  passThreshold: number;
  teacherSections: TeacherReportSections;
  chartImages: ReportChartImage[];
}): Promise<void> {
  const { exam, data, classFilter, codeFilter, passThreshold, teacherSections, chartImages } = params;
  const pdfDoc = await PDFDocument.create();
  pdfDoc.registerFontkit(fontkit);

  const [regRes, boldRes] = await Promise.all([
    fetch('/fonts/DejaVuSans.ttf'),
    fetch('/fonts/DejaVuSans-Bold.ttf'),
  ]);
  const [regBytes, boldBytes] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
  const fontReg = await pdfDoc.embedFont(regBytes);
  const fontBold = await pdfDoc.embedFont(boldBytes);

  const pw = 595.28;
  const ph = 841.89;
  let page = pdfDoc.addPage([pw, ph]);
  let y = ph - 40;

  const ensureSpace = (need: number) => {
    if (y - need < 45) {
      page = pdfDoc.addPage([pw, ph]);
      y = ph - 40;
    }
  };

  const drawTextLine = (txt: string, bold = false, size = 9.5, color = rgb(0.12, 0.16, 0.23)) => {
    ensureSpace(size + 6);
    page.drawText(txt, { x: 32, y, size, font: bold ? fontBold : fontReg, color });
    y -= size + 5;
  };

  drawTextLine(exam.schoolName || 'TRƯỜNG THPT', true, 10);
  drawTextLine(`BÁO CÁO PHÂN TÍCH KẾT QUẢ – ${exam.name}`, true, 13, rgb(0.14, 0.39, 0.92));
  drawTextLine(
    `Môn: ${exam.subject} | Lớp: ${classFilter === 'all' ? 'Tất cả' : classFilter} | Mã đề: ${codeFilter === 'all' ? 'Tất cả' : codeFilter} | Ngưỡng đạt: ${passThreshold}`,
    false,
    8.5,
    rgb(0.35, 0.4, 0.48)
  );
  y -= 6;

  drawTextLine('1. SỐ LIỆU CHÍNH THỨC (CHỈ TÍNH BÀI ĐÃ DUYỆT)', true, 10);
  drawTextLine(
    `Tổng HS: ${data.totalStudents} | Đã duyệt: ${data.summary.presentCount} | Chờ duyệt: ${data.reviewCount} | Vắng: ${data.summary.absentCount}`
  );
  drawTextLine(
    `ĐTB: ${data.summary.mean} | Trung vị: ${data.summary.median} | ĐLC: ${data.summary.stdDev} | Cao nhất: ${data.summary.max} | Thấp nhất: ${data.summary.min} | Đạt: ${data.summary.passRate}%`
  );
  drawTextLine(`Độ tin cậy KR-20: ${data.kr20OverallNote}`, false, 8.5, rgb(0.3, 0.35, 0.42));
  y -= 8;

  if (data.classComparison.length > 0) {
    drawTextLine('2. SO SÁNH THEO LỚP', true, 10);
    for (const c of data.classComparison) {
      drawTextLine(
        `Lớp ${c.className}: ${c.gradedCount} bài duyệt, ${c.absentCount} vắng | ĐTB ${c.mean} | Cao nhất ${c.max} | Thấp nhất ${c.min} | Đạt ${c.passRate}%`,
        false,
        8.5
      );
    }
    y -= 6;
  }

  for (const img of chartImages) {
    try {
      const bytes = dataUrlToUint8Array(img.dataUrl);
      const embedded = await pdfDoc.embedPng(bytes);
      const drawW = pw - 64;
      const drawH = Math.min(200, (embedded.height / embedded.width) * drawW);
      ensureSpace(drawH + 26);
      drawTextLine(img.title, true, 9.5);
      page.drawImage(embedded, { x: 32, y: y - drawH, width: drawW, height: drawH });
      y -= drawH + 14;
    } catch {
      // skip
    }
  }

  drawTextLine('3. NHẬN XÉT & ĐỀ XUẤT CỦA GIÁO VIÊN', true, 10);
  const blocks = [
    `Nhận xét chung: ${teacherSections.generalComment || '---'}`,
    `Câu cần rà soát: ${teacherSections.questionReviewNote || '---'}`,
    `Kiến nghị điều chỉnh: ${teacherSections.adjustmentRecommendation || '---'}`,
    `Phụ đạo / bồi dưỡng: ${teacherSections.reinforcementPlan || '---'}`,
  ];
  for (const blk of blocks) {
    const words = blk.split(/\s+/);
    let cur = '';
    for (const w of words) {
      if ((cur + ' ' + w).trim().length > 98) {
        drawTextLine(cur.trim(), false, 8.8);
        cur = w;
      } else {
        cur = (cur + ' ' + w).trim();
      }
    }
    if (cur) drawTextLine(cur, false, 8.8);
  }

  const bytes = await pdfDoc.save();
  downloadBlob(
    new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' }),
    `Bao-cao-phan-tich_${exam.subject}_${exam.name}.pdf`.replace(/\s+/g, '_')
  );
}

import ExcelJS from 'exceljs';
import * as XLSX from 'xlsx';
import type {
  AnswerKey,
  Exam,
  ExamSubmission,
  Student,
} from '../types/omr';
import {
  computeCompetitionRanks,
  computeExamAnalytics,
  roundScore,
} from './scoring';

export function downloadStudentRosterSampleExcel() {
  const rows = [
    ['STT', 'Mã học sinh', 'Số báo danh', 'Họ và tên', 'Lớp', 'Ghi chú'],
    [1, 'HS001', '010001', 'Nguyễn Văn An', '12A1', ''],
    [2, 'HS002', '010002', 'Trần Thị Bình', '12A1', ''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['C2'].t = 's';
  ws['C3'].t = 's';
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  XLSX.writeFile(wb, 'mau_danh_sach_hoc_sinh.xlsx');
}

export function exportStudentRosterExcel(students: Student[], classLabel = 'tat_ca') {
  const rows: (string | number)[][] = [
    ['STT', 'Mã học sinh', 'Số báo danh', 'Họ và tên', 'Lớp', 'Ghi chú'],
    ...students.map((st, idx) => [
      idx + 1,
      st.studentCode || '',
      st.sbd || '',
      st.fullName,
      st.className,
      st.note || '',
    ]),
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  for (let i = 0; i < students.length; i++) {
    const cellRef = `C${i + 2}`;
    if (ws[cellRef]) ws[cellRef].t = 's';
    const codeRef = `B${i + 2}`;
    if (ws[codeRef]) ws[codeRef].t = 's';
  }
  XLSX.utils.book_append_sheet(wb, ws, 'DanhSachHocSinh');
  const safeLabel = classLabel.replace(/\s+/g, '_');
  XLSX.writeFile(wb, `danh_sach_hoc_sinh_${safeLabel}.xlsx`);
}

export async function parseStudentsFromSpreadsheet(
  file: File
): Promise<Omit<Student, 'id' | 'classId' | 'absentExamIds' | 'createdAt'>[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array', raw: false });
  const sheetName = wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: '',
    raw: false,
  });

  const parsed: Omit<Student, 'id' | 'classId' | 'absentExamIds' | 'createdAt'>[] = [];
  for (const row of rows) {
    const keys = Object.keys(row);
    const findVal = (candidates: string[]) => {
      for (const k of keys) {
        const low = k.toLowerCase().trim();
        if (candidates.some((c) => low.includes(c))) {
          return String(row[k] ?? '').trim();
        }
      }
      return '';
    };

    const fullName = findVal(['họ và tên', 'họ tên', 'ho ten', 'fullname', 'name']);
    const sbd = findVal(['số báo danh', 'so bao danh', 'sbd']);
    const studentCode = findVal(['mã học sinh', 'ma hoc sinh', 'mã hs', 'code']);
    const className = findVal(['lớp', 'lop', 'class']);
    const note = findVal(['ghi chú', 'ghi chu', 'note']);

    if (!fullName && !sbd) continue;
    parsed.push({
      studentCode: studentCode || sbd || '',
      sbd,
      fullName,
      className,
      note,
    });
  }
  return parsed;
}

export type GradebookColumnKey =
  | 'stt'
  | 'sbd'
  | 'studentCode'
  | 'fullName'
  | 'className'
  | 'examCode'
  | 'phachCode'
  | 'part1'
  | 'part2'
  | 'part3'
  | 'total'
  | 'correctCount'
  | 'wrongCount'
  | 'blankCount'
  | 'status'
  | 'rank'
  | 'note';

export interface GradebookColumnConfig {
  key: GradebookColumnKey;
  label: string;
  visible: boolean;
}

export const DEFAULT_GRADEBOOK_COLUMNS: GradebookColumnConfig[] = [
  { key: 'stt', label: 'STT', visible: true },
  { key: 'sbd', label: 'Số báo danh', visible: true },
  { key: 'studentCode', label: 'Mã học sinh', visible: true },
  { key: 'fullName', label: 'Họ và tên', visible: true },
  { key: 'className', label: 'Lớp', visible: true },
  { key: 'examCode', label: 'Mã đề', visible: true },
  { key: 'phachCode', label: 'Mã phách', visible: false },
  { key: 'part1', label: 'Điểm Phần I', visible: true },
  { key: 'part2', label: 'Điểm Phần II', visible: true },
  { key: 'part3', label: 'Điểm Phần III', visible: true },
  { key: 'total', label: 'Tổng điểm', visible: true },
  { key: 'correctCount', label: 'Số câu đúng', visible: true },
  { key: 'wrongCount', label: 'Số câu sai', visible: true },
  { key: 'blankCount', label: 'Số câu bỏ trống', visible: true },
  { key: 'status', label: 'Trạng thái', visible: true },
  { key: 'rank', label: 'Thứ hạng', visible: true },
  { key: 'note', label: 'Nhận xét', visible: true },
];

export type GradebookExportColumns = Record<GradebookColumnKey, boolean>;

export function statusLabelVi(status: ExamSubmission['status']): string {
  switch (status) {
    case 'graded':
      return 'Đã duyệt';
    case 'needs_review':
      return 'Chờ kiểm duyệt';
    case 'unprocessed':
      return 'Chưa chấm';
    case 'error':
      return 'Có lỗi';
    default:
      return 'Chờ xử lý';
  }
}

function triggerBlobDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  left: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  bottom: { style: 'thin', color: { argb: 'FFCBD5E1' } },
  right: { style: 'thin', color: { argb: 'FFCBD5E1' } },
};

const BASE_FONT: Partial<ExcelJS.Font> = {
  name: 'Times New Roman',
  size: 13,
  color: { argb: 'FF1E293B' },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  name: 'Times New Roman',
  size: 13,
  bold: true,
  color: { argb: 'FFFFFFFF' },
};

const HEADER_FILL: ExcelJS.Fill = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF1E40AF' },
};

function styleTableHeaderRow(row: ExcelJS.Row, colCount: number) {
  row.height = 26;
  for (let c = 1; c <= colCount; c++) {
    const cell = row.getCell(c);
    cell.font = HEADER_FONT;
    cell.fill = HEADER_FILL;
    cell.border = THIN_BORDER;
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
  }
}

export async function exportExamGradebookXLSX(params: {
  exam: Exam;
  allSubmissionsForExam: ExamSubmission[];
  visibleSubmissions: ExamSubmission[];
  students: Student[];
  answerKeys: AnswerKey[];
  columnConfigs: GradebookColumnConfig[];
  hasPart2: boolean;
  hasPart3: boolean;
  hasPhach: boolean;
  format?: 'xlsx' | 'csv';
  includeAllForExam?: boolean;
}) {
  const {
    exam,
    allSubmissionsForExam,
    visibleSubmissions,
    students,
    answerKeys,
    columnConfigs,
    hasPart2,
    hasPart3,
    hasPhach,
    format = 'xlsx',
    includeAllForExam = false,
  } = params;

  const targetSubs = (includeAllForExam ? allSubmissionsForExam : visibleSubmissions).filter(
    (s) => s.examId === exam.id && !s.isTestSample
  );

  // Official competition ranks ONLY calculated on graded submissions across the exam
  const ranks = computeCompetitionRanks(allSubmissionsForExam);
  const studentById = new Map(students.map((st) => [st.id, st]));
  const studentBySbd = new Map(students.map((st) => [st.sbd, st]));

  const activeCols = columnConfigs.filter((c) => {
    if (!c.visible) return false;
    if (c.key === 'part2' && !hasPart2) return false;
    if (c.key === 'part3' && !hasPart3) return false;
    if (c.key === 'phachCode' && !hasPhach) return false;
    return true;
  });

  const getCellValue = (
    colKey: GradebookColumnKey,
    sub: ExamSubmission,
    idx: number
  ): string | number | null => {
    const st =
      (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
      studentBySbd.get(sub.sbd);
    const isOfficial = sub.status === 'graded';
    switch (colKey) {
      case 'stt':
        return idx + 1;
      case 'sbd':
        return sub.sbd || '';
      case 'studentCode':
        return st?.studentCode || '';
      case 'fullName':
        return st?.fullName || '(Chưa đối chiếu)';
      case 'className':
        return st?.className || '';
      case 'examCode':
        return sub.examCode || '';
      case 'phachCode':
        return sub.phachCode || '';
      case 'part1':
        return roundScore(sub.scoreBreakdown.part1, 2);
      case 'part2':
        return roundScore(sub.scoreBreakdown.part2, 2);
      case 'part3':
        return roundScore(sub.scoreBreakdown.part3, 2);
      case 'total':
        return roundScore(sub.scoreBreakdown.total, 2);
      case 'correctCount':
        return sub.scoreBreakdown.correctCount;
      case 'wrongCount':
        return sub.scoreBreakdown.wrongCount;
      case 'blankCount':
        return sub.scoreBreakdown.blankCount;
      case 'status':
        return statusLabelVi(sub.status);
      case 'rank':
        return isOfficial ? (ranks.get(sub.id) ?? '') : '';
      case 'note':
        if (sub.teacherComment) return sub.teacherComment;
        if (!isOfficial) {
          return sub.reviewReasons.length > 0
            ? `[Chưa duyệt] ${sub.reviewReasons.join('; ')}`
            : 'Chờ kiểm duyệt';
        }
        return `Đúng ${sub.scoreBreakdown.correctCount}, Sai ${sub.scoreBreakdown.wrongCount}`;
      default:
        return '';
    }
  };

  if (format === 'csv') {
    const headers = activeCols.map((c) => c.label);
    const dataRows = targetSubs.map((sub, idx) =>
      activeCols.map((c) => getCellValue(c.key, sub, idx) ?? '')
    );
    const csvLines = [headers, ...dataRows]
      .map((r) => r.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
    triggerBlobDownload(
      blob,
      `Bang_diem_${exam.subject}_${exam.name}.csv`.replace(/\s+/g, '_')
    );
    return;
  }

  // Real styled XLSX via ExcelJS (Times New Roman 13pt, borders, freeze pane, autofilter)
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Chấm Thi Thông Minh';
  wb.created = new Date();

  const numericScoreCols = new Set<GradebookColumnKey>([
    'part1',
    'part2',
    'part3',
    'total',
  ]);
  const centerCols = new Set<GradebookColumnKey>([
    'stt',
    'sbd',
    'studentCode',
    'examCode',
    'phachCode',
    'part1',
    'part2',
    'part3',
    'total',
    'correctCount',
    'wrongCount',
    'blankCount',
    'status',
    'rank',
  ]);
  const textCols = new Set<GradebookColumnKey>(['sbd', 'studentCode', 'examCode', 'phachCode']);

  // SHEET 1: Bảng điểm
  const ws1 = wb.addWorksheet('Bang diem', {
    views: [{ state: 'frozen', ySplit: 5 }],
  });
  ws1.addRow([exam.schoolName || 'TRƯỜNG THPT']).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  ws1.addRow([`BẢNG ĐIỂM KỲ KIỂM TRA: ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
    color: { argb: 'FF1E40AF' },
  };
  ws1.addRow([
    `Môn: ${exam.subject}  |  Khối ${exam.gradeLevel}  |  Ngày thi: ${exam.examDate}  |  Năm học: ${exam.schoolYear}`,
  ]).font = BASE_FONT;
  ws1.addRow([]);

  const headerRow1 = ws1.addRow(activeCols.map((c) => c.label));
  styleTableHeaderRow(headerRow1, activeCols.length);

  targetSubs.forEach((sub, idx) => {
    const vals = activeCols.map((c) => getCellValue(c.key, sub, idx));
    const r = ws1.addRow(vals);
    r.height = 22;
    activeCols.forEach((col, cIdx) => {
      const cell = r.getCell(cIdx + 1);
      cell.font = {
        ...BASE_FONT,
        bold: col.key === 'total',
        color:
          col.key === 'status' && sub.status !== 'graded'
            ? { argb: 'FFB45309' }
            : col.key === 'total'
            ? { argb: 'FF1E40AF' }
            : BASE_FONT.color,
      };
      cell.border = THIN_BORDER;
      if (textCols.has(col.key)) {
        cell.numFmt = '@';
        cell.value = String(vals[cIdx] ?? '');
      } else if (numericScoreCols.has(col.key)) {
        cell.numFmt = '0.00';
      }
      cell.alignment = {
        vertical: 'middle',
        horizontal: centerCols.has(col.key) ? 'center' : 'left',
      };
    });
  });

  activeCols.forEach((col, i) => {
    const colObj = ws1.getColumn(i + 1);
    colObj.width =
      col.key === 'fullName'
        ? 26
        : col.key === 'note'
        ? 34
        : col.key === 'status'
        ? 18
        : col.key === 'stt'
        ? 8
        : 15;
  });
  if (activeCols.length > 0) {
    ws1.autoFilter = {
      from: { row: 5, column: 1 },
      to: { row: 5 + targetSubs.length, column: activeCols.length },
    };
  }

  // SHEET 2: Thống kê
  const analytics = computeExamAnalytics(
    allSubmissionsForExam,
    students,
    exam.id,
    exam.passThreshold,
    exam.scoreScale
  );
  const ws2 = wb.addWorksheet('Thong ke', {
    views: [{ state: 'frozen', ySplit: 3 }],
  });
  ws2.addRow([`THỐNG KÊ KẾT QUẢ – ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  ws2.addRow([
    `Lưu ý: Thống kê điểm chính thức chỉ tính trên ${analytics.presentCount} bài đã duyệt.`,
  ]).font = BASE_FONT;
  const statHeader = ws2.addRow(['Chỉ số thống kê', 'Giá trị']);
  styleTableHeaderRow(statHeader, 2);

  const statItems: [string, string | number][] = [
    ['Tổng số học sinh trong danh sách', students.length],
    ['Số bài thi đã duyệt (tính điểm chính thức)', analytics.presentCount],
    [
      'Số bài đang chờ kiểm duyệt',
      allSubmissionsForExam.filter((s) => s.examId === exam.id && s.status === 'needs_review').length,
    ],
    ['Số học sinh vắng thi (không tính điểm 0)', analytics.absentCount],
    ['Điểm trung bình', analytics.presentCount ? analytics.mean : 0],
    ['Điểm trung vị', analytics.presentCount ? analytics.median : 0],
    ['Điểm cao nhất', analytics.presentCount ? analytics.max : 0],
    ['Điểm thấp nhất', analytics.presentCount ? analytics.min : 0],
    ['Độ lệch chuẩn', analytics.presentCount ? analytics.stdDev : 0],
    [`Số bài đạt (>= ${exam.passThreshold})`, analytics.passCount],
    [`Tỉ lệ đạt (%)`, analytics.passRate],
    ['Độ tin cậy KR-20', analytics.kr20 ?? 'Chưa đủ điều kiện'],
  ];
  for (const [label, val] of statItems) {
    const r = ws2.addRow([label, val]);
    r.height = 22;
    r.getCell(1).font = BASE_FONT;
    r.getCell(1).border = THIN_BORDER;
    r.getCell(2).font = { ...BASE_FONT, bold: true };
    r.getCell(2).border = THIN_BORDER;
    r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws2.addRow([]);
  const histHead = ws2.addRow(['Khoảng điểm (Phổ điểm)', 'Số lượng bài']);
  styleTableHeaderRow(histHead, 2);
  for (const h of analytics.histogram) {
    const r = ws2.addRow([h.label, h.count]);
    r.height = 22;
    r.getCell(1).font = BASE_FONT;
    r.getCell(1).border = THIN_BORDER;
    r.getCell(2).font = BASE_FONT;
    r.getCell(2).border = THIN_BORDER;
    r.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
  }
  ws2.getColumn(1).width = 44;
  ws2.getColumn(2).width = 24;

  // SHEET 3: Chi tiết câu trả lời
  const ws3 = wb.addWorksheet('Chi tiet cau tra loi', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws3.addRow([`CHI TIẾT CÂU TRẢ LỜI – ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  const qHeaders = [
    'SBD',
    'Họ và tên',
    'Lớp',
    'Mã đề',
    'Trạng thái bài',
    'Câu hỏi',
    'Phần',
    'HS chọn',
    'Đáp án đúng',
    'Điểm đạt',
    'Kết quả',
  ];
  const qHeaderRow = ws3.addRow(qHeaders);
  styleTableHeaderRow(qHeaderRow, qHeaders.length);
  for (const sub of targetSubs) {
    const st =
      (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
      studentBySbd.get(sub.sbd);
    for (const q of sub.recognition.questions) {
      const qLabel =
        q.part === 'part1'
          ? `Câu ${q.question}`
          : q.part === 'part2'
          ? `Câu ${q.question}.${q.subItem || ''}`
          : `Câu ${q.question}`;
      const partLabel =
        q.part === 'part1' ? 'Phần I' : q.part === 'part2' ? 'Phần II' : 'Phần III';
      const qStatus =
        q.status === 'correct'
          ? 'Đúng'
          : q.status === 'wrong'
          ? 'Sai'
          : q.status === 'blank'
          ? 'Bỏ trống'
          : 'Cần duyệt';
      const row = ws3.addRow([
        String(sub.sbd || ''),
        st?.fullName || '(Chưa đối chiếu)',
        st?.className || '',
        String(sub.examCode || ''),
        statusLabelVi(sub.status),
        qLabel,
        partLabel,
        q.detectedValue || '',
        q.correctValue || '',
        q.earnedPoints,
        qStatus,
      ]);
      row.height = 20;
      for (let c = 1; c <= qHeaders.length; c++) {
        const cell = row.getCell(c);
        cell.font = BASE_FONT;
        cell.border = THIN_BORDER;
        if (c === 1 || c === 4) cell.numFmt = '@';
        if (c === 10) cell.numFmt = '0.00';
        cell.alignment = {
          vertical: 'middle',
          horizontal: c === 2 ? 'left' : 'center',
        };
      }
    }
  }
  [14, 24, 12, 12, 18, 12, 12, 12, 14, 12, 14].forEach((w, i) => {
    ws3.getColumn(i + 1).width = w;
  });

  // SHEET 4: Đáp án các mã đề
  const ws4 = wb.addWorksheet('Dap an cac ma de', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws4.addRow([`NGÂN HÀNG ĐÁP ÁN – ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  const akHeaders = ['Mã đề', 'Phần thi', 'Câu hỏi', 'Đáp án đúng', 'Điểm chuẩn'];
  styleTableHeaderRow(ws4.addRow(akHeaders), akHeaders.length);
  for (const ak of answerKeys.filter((k) => k.examId === exam.id)) {
    for (let q = 1; q <= ak.part1Count; q++) {
      const r = ws4.addRow([
        ak.examCode,
        'Phần I',
        `Câu ${q}`,
        ak.part1Answers[q] || '',
        ak.part1PointsPerQ,
      ]);
      for (let c = 1; c <= 5; c++) {
        r.getCell(c).font = BASE_FONT;
        r.getCell(c).border = THIN_BORDER;
        if (c === 1) r.getCell(c).numFmt = '@';
        if (c === 5) r.getCell(c).numFmt = '0.00';
        r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    for (let q = 1; q <= ak.part2Count; q++) {
      const m = ak.part2Answers[q];
      const str = m
        ? (['a', 'b', 'c', 'd'] as const)
            .map((k) => `${k}:${m[k] === true ? 'Đ' : m[k] === false ? 'S' : '-'}`)
            .join(' | ')
        : '';
      const r = ws4.addRow([
        ak.examCode,
        'Phần II (Lũy tiến)',
        `Câu ${q}`,
        str,
        ak.part2ScoringMode === 'progressive_2025'
          ? ak.part2Progressive[4]
          : 4 * ak.part2CustomPerItem,
      ]);
      for (let c = 1; c <= 5; c++) {
        r.getCell(c).font = BASE_FONT;
        r.getCell(c).border = THIN_BORDER;
        if (c === 1) r.getCell(c).numFmt = '@';
        if (c === 5) r.getCell(c).numFmt = '0.00';
        r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
    for (let q = 1; q <= ak.part3Count; q++) {
      const r = ws4.addRow([
        ak.examCode,
        'Phần III',
        `Câu ${q}`,
        (ak.part3Answers[q] || []).join(' | '),
        ak.part3PointsPerQ,
      ]);
      for (let c = 1; c <= 5; c++) {
        r.getCell(c).font = BASE_FONT;
        r.getCell(c).border = THIN_BORDER;
        if (c === 1) r.getCell(c).numFmt = '@';
        if (c === 5) r.getCell(c).numFmt = '0.00';
        r.getCell(c).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }
  }
  [12, 22, 14, 28, 14].forEach((w, i) => {
    ws4.getColumn(i + 1).width = w;
  });

  // SHEET 5: Danh sách vắng thi
  const absentList = students.filter((st) => st.absentExamIds.includes(exam.id));
  const ws5 = wb.addWorksheet('Danh sach vang thi', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws5.addRow([`DANH SÁCH HỌC SINH VẮNG THI – ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  const absHeaders = ['STT', 'Số báo danh', 'Mã học sinh', 'Họ và tên', 'Lớp', 'Ghi chú'];
  styleTableHeaderRow(ws5.addRow(absHeaders), absHeaders.length);
  absentList.forEach((st, idx) => {
    const r = ws5.addRow([
      idx + 1,
      st.sbd || '',
      st.studentCode || '',
      st.fullName,
      st.className,
      'Vắng thi (không gán điểm 0)',
    ]);
    for (let c = 1; c <= absHeaders.length; c++) {
      r.getCell(c).font = BASE_FONT;
      r.getCell(c).border = THIN_BORDER;
      if (c === 2 || c === 3) r.getCell(c).numFmt = '@';
      r.getCell(c).alignment = {
        horizontal: c === 4 || c === 6 ? 'left' : 'center',
        vertical: 'middle',
      };
    }
  });
  [8, 16, 16, 26, 12, 30].forEach((w, i) => {
    ws5.getColumn(i + 1).width = w;
  });

  // SHEET 6: Danh sách bài chờ kiểm duyệt
  const pendingSubs = allSubmissionsForExam.filter(
    (s) => s.examId === exam.id && !s.isTestSample && s.status !== 'graded'
  );
  const ws6 = wb.addWorksheet('Cho kiem duyet', {
    views: [{ state: 'frozen', ySplit: 2 }],
  });
  ws6.addRow([`DANH SÁCH BÀI CHỜ KIỂM DUYỆT – ${exam.name}`]).font = {
    ...BASE_FONT,
    bold: true,
    size: 14,
  };
  const revHeaders = [
    'STT',
    'SBD',
    'Họ và tên',
    'Lớp',
    'Mã đề',
    'Điểm dự kiến',
    'Trạng thái',
    'Lý do cần kiểm duyệt',
  ];
  styleTableHeaderRow(ws6.addRow(revHeaders), revHeaders.length);
  pendingSubs.forEach((sub, idx) => {
    const st =
      (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
      studentBySbd.get(sub.sbd);
    const r = ws6.addRow([
      idx + 1,
      sub.sbd || '',
      st?.fullName || '(Chưa đối chiếu)',
      st?.className || '',
      sub.examCode || '',
      roundScore(sub.scoreBreakdown.total, 2),
      statusLabelVi(sub.status),
      sub.reviewReasons.join('; '),
    ]);
    for (let c = 1; c <= revHeaders.length; c++) {
      r.getCell(c).font = BASE_FONT;
      r.getCell(c).border = THIN_BORDER;
      if (c === 2 || c === 5) r.getCell(c).numFmt = '@';
      if (c === 6) r.getCell(c).numFmt = '0.00';
      r.getCell(c).alignment = {
        horizontal: c === 3 || c === 8 ? 'left' : 'center',
        vertical: 'middle',
      };
    }
  });
  [8, 15, 25, 12, 12, 16, 18, 42].forEach((w, i) => {
    ws6.getColumn(i + 1).width = w;
  });

  const buffer = await wb.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  triggerBlobDownload(
    blob,
    `Bang_diem_${exam.subject}_${exam.name}.xlsx`.replace(/\s+/g, '_')
  );
}

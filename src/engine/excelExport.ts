import * as XLSX from 'xlsx';
import type {
  AnswerKey,
  Exam,
  ExamSubmission,
  Student,
} from '../types/omr';
import { computeCompetitionRanks, computeExamAnalytics } from './scoring';

export function downloadStudentRosterSampleExcel() {
  const rows = [
    ['STT', 'Mã học sinh', 'Số báo danh', 'Họ và tên', 'Lớp', 'Ghi chú'],
    [1, 'HS001', '010001', 'Nguyễn Văn An', '12A1', ''],
    [2, 'HS002', '010002', 'Trần Thị Bình', '12A1', ''],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  // Format SBD column as text so Excel keeps leading zeros
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

export interface GradebookExportColumns {
  stt: boolean;
  sbd: boolean;
  studentCode: boolean;
  fullName: boolean;
  className: boolean;
  examCode: boolean;
  part1: boolean;
  part2: boolean;
  part3: boolean;
  total: boolean;
  correctCount: boolean;
  wrongCount: boolean;
  blankCount: boolean;
  status: boolean;
  rank: boolean;
  note: boolean;
}

export const DEFAULT_EXPORT_COLUMNS: GradebookExportColumns = {
  stt: true,
  sbd: true,
  studentCode: false,
  fullName: true,
  className: true,
  examCode: true,
  part1: true,
  part2: true,
  part3: true,
  total: true,
  correctCount: true,
  wrongCount: true,
  blankCount: true,
  status: true,
  rank: true,
  note: true,
};

export function exportExamGradebookXLSX(
  exam: Exam,
  submissions: ExamSubmission[],
  students: Student[],
  answerKeys: AnswerKey[],
  columns: GradebookExportColumns,
  format: 'xlsx' | 'csv' = 'xlsx'
) {
  const realSubs = submissions.filter(
    (s) => s.examId === exam.id && !s.isTestSample
  );
  const ranks = computeCompetitionRanks(realSubs);
  const analytics = computeExamAnalytics(
    realSubs,
    students,
    exam.id,
    exam.passThreshold,
    exam.scoreScale
  );

  const studentById = new Map(students.map((st) => [st.id, st]));
  const studentBySbd = new Map(students.map((st) => [st.sbd, st]));

  const headerRow: string[] = [];
  if (columns.stt) headerRow.push('STT');
  if (columns.sbd) headerRow.push('Số báo danh');
  if (columns.studentCode) headerRow.push('Mã học sinh');
  if (columns.fullName) headerRow.push('Họ và tên');
  if (columns.className) headerRow.push('Lớp');
  if (columns.examCode) headerRow.push('Mã đề');
  if (columns.part1) headerRow.push('Điểm Phần I');
  if (columns.part2) headerRow.push('Điểm Phần II');
  if (columns.part3) headerRow.push('Điểm Phần III');
  if (columns.total) headerRow.push('Tổng điểm');
  if (columns.correctCount) headerRow.push('Số câu đúng');
  if (columns.wrongCount) headerRow.push('Số câu sai');
  if (columns.blankCount) headerRow.push('Bỏ trống');
  if (columns.status) headerRow.push('Trạng thái');
  if (columns.rank) headerRow.push('Thứ hạng');
  if (columns.note) headerRow.push('Nhận xét');

  const dataRows: (string | number)[][] = [];
  realSubs.forEach((sub, idx) => {
    const st =
      (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
      studentBySbd.get(sub.sbd);
    const row: (string | number)[] = [];
    if (columns.stt) row.push(idx + 1);
    if (columns.sbd) row.push(sub.sbd || '');
    if (columns.studentCode) row.push(st?.studentCode || '');
    if (columns.fullName) row.push(st?.fullName || '(Chưa đối chiếu)');
    if (columns.className) row.push(st?.className || '');
    if (columns.examCode) row.push(sub.examCode || '');
    if (columns.part1) row.push(sub.scoreBreakdown.part1);
    if (columns.part2) row.push(sub.scoreBreakdown.part2);
    if (columns.part3) row.push(sub.scoreBreakdown.part3);
    if (columns.total) row.push(sub.scoreBreakdown.total);
    if (columns.correctCount) row.push(sub.scoreBreakdown.correctCount);
    if (columns.wrongCount) row.push(sub.scoreBreakdown.wrongCount);
    if (columns.blankCount) row.push(sub.scoreBreakdown.blankCount);
    if (columns.status) {
      row.push(
        sub.status === 'graded'
          ? 'Đã chấm'
          : sub.status === 'needs_review'
          ? 'Chờ kiểm duyệt'
          : 'Chưa xử lý'
      );
    }
    if (columns.rank) row.push(ranks.get(sub.id) ?? '');
    if (columns.note) {
      row.push(
        sub.reviewReasons.length > 0
          ? sub.reviewReasons.join('; ')
          : `Đúng ${sub.scoreBreakdown.correctCount}, Sai ${sub.scoreBreakdown.wrongCount}`
      );
    }
    dataRows.push(row);
  });

  if (format === 'csv') {
    const csvLines = [headerRow, ...dataRows]
      .map((r) =>
        r
          .map((cell) => `"${String(cell).replace(/"/g, '""')}"`)
          .join(',')
      )
      .join('\n');
    const blob = new Blob(['\uFEFF' + csvLines], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang_diem_${exam.subject}_${exam.name}.csv`.replace(/\s+/g, '_');
    a.click();
    URL.revokeObjectURL(url);
    return;
  }

  const wb = XLSX.utils.book_new();
  const sheetRows = [
    [exam.schoolName || 'TRƯỜNG THPT'],
    [`BẢNG ĐIỂM KỲ KIỂM TRA: ${exam.name}`],
    [`Môn học: ${exam.subject} | Ngày thi: ${exam.examDate} | Năm học: ${exam.schoolYear}`],
    [],
    headerRow,
    ...dataRows,
  ];
  const ws = XLSX.utils.aoa_to_sheet(sheetRows);
  XLSX.utils.book_append_sheet(wb, ws, 'BangDiem');

  // Stats sheet
  const statRows = [
    ['THỐNG KÊ KẾT QUẢ KỲ KIỂM TRA'],
    ['Số bài đã chấm chính thức', analytics.presentCount],
    ['Số học sinh vắng thi', analytics.absentCount],
    ['Điểm trung bình', analytics.mean],
    ['Điểm trung vị', analytics.median],
    ['Điểm cao nhất', analytics.max],
    ['Điểm thấp nhất', analytics.min],
    ['Độ lệch chuẩn', analytics.stdDev],
    [`Tỉ lệ đạt (>= ${exam.passThreshold})`, `${analytics.passRate}%`],
    ['Độ tin cậy KR-20', analytics.kr20 ?? 'Chưa đủ điều kiện tính'],
    [],
    ['PHỔ ĐIỂM', 'Số lượng'],
    ...analytics.histogram.map((h) => [h.label, h.count]),
  ];
  const wsStats = XLSX.utils.aoa_to_sheet(statRows);
  XLSX.utils.book_append_sheet(wb, wsStats, 'ThongKe');

  // Answer keys sheet
  const keyRows: (string | number)[][] = [['BẢNG ĐÁP ÁN CÁC MÃ ĐỀ']];
  for (const ak of answerKeys.filter((k) => k.examId === exam.id)) {
    keyRows.push([`Mã đề: ${ak.examCode}`]);
    if (ak.part1Count > 0) {
      const p1Row: (string | number)[] = ['Phần I'];
      for (let q = 1; q <= ak.part1Count; q++) {
        p1Row.push(`${q}:${ak.part1Answers[q] || '-'}`);
      }
      keyRows.push(p1Row);
    }
    if (ak.part2Count > 0) {
      const p2Row: (string | number)[] = ['Phần II'];
      for (let q = 1; q <= ak.part2Count; q++) {
        const m = ak.part2Answers[q];
        const s = m
          ? ['a', 'b', 'c', 'd']
              .map((k) => `${k}:${m[k as 'a' | 'b' | 'c' | 'd'] === true ? 'Đ' : m[k as 'a' | 'b' | 'c' | 'd'] === false ? 'S' : '-'}`)
              .join(' ')
          : '-';
        p2Row.push(`C${q}[${s}]`);
      }
      keyRows.push(p2Row);
    }
    if (ak.part3Count > 0) {
      const p3Row: (string | number)[] = ['Phần III'];
      for (let q = 1; q <= ak.part3Count; q++) {
        p3Row.push(`${q}:${(ak.part3Answers[q] || []).join('|')}`);
      }
      keyRows.push(p3Row);
    }
    keyRows.push([]);
  }
  const wsKeys = XLSX.utils.aoa_to_sheet(keyRows);
  XLSX.utils.book_append_sheet(wb, wsKeys, 'DapAn');

  XLSX.writeFile(
    wb,
    `bang_diem_${exam.subject}_${exam.name}.xlsx`.replace(/\s+/g, '_')
  );
}

// Export mapped for vnEdu or SMAS templates configured by teacher
export function exportMappedExternalSheet(
  systemName: 'vnEdu' | 'SMAS',
  columnMap: Record<string, string>,
  exam: Exam,
  submissions: ExamSubmission[],
  students: Student[]
) {
  const realSubs = submissions.filter(
    (s) => s.examId === exam.id && s.status === 'graded' && !s.isTestSample
  );
  const studentById = new Map(students.map((st) => [st.id, st]));
  const studentBySbd = new Map(students.map((st) => [st.sbd, st]));

  const keys = Object.keys(columnMap);
  const headers = keys.map((k) => columnMap[k] || k);
  const rows = realSubs.map((sub) => {
    const st =
      (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
      studentBySbd.get(sub.sbd);
    return keys.map((k) => {
      if (k === 'sbd') return sub.sbd || '';
      if (k === 'studentCode') return st?.studentCode || '';
      if (k === 'fullName') return st?.fullName || '';
      if (k === 'className') return st?.className || '';
      if (k === 'totalScore') return sub.scoreBreakdown.total;
      if (k === 'note') return `Mã đề ${sub.examCode}`;
      return '';
    });
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  XLSX.utils.book_append_sheet(wb, ws, systemName);
  XLSX.writeFile(wb, `xuat_${systemName.toLowerCase()}_${exam.subject}.xlsx`.replace(/\s+/g, '_'));
}

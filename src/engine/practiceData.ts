import { PDFDocument } from 'pdf-lib';
import type {
  AnswerKey,
  ClassRoom,
  Exam,
  Part2AnswerMap,
  PracticeScenario,
  PracticeSheetSpec,
  SheetTemplate,
  Student,
} from '../types/omr';
import { drawTemplateOnCanvas, type SimulatedMarkSpec } from './sheetRenderer';

const HO = [
  'Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ',
  'Đặng', 'Bùi', 'Đỗ', 'Hồ', 'Ngô', 'Dương', 'Lý', 'Trịnh', 'Đào',
];
const DEM_NAM = ['Văn', 'Minh', 'Quốc', 'Hoàng', 'Gia', 'Đức', 'Tuấn', 'Hữu', 'Thanh'];
const DEM_NU = ['Thị', 'Ngọc', 'Phương', 'Thùy', 'Khánh', 'Minh', 'Bảo', 'Tuyết', 'Lan'];
const TEN_NAM = ['An', 'Bình', 'Cường', 'Dũng', 'Đạt', 'Hải', 'Hiếu', 'Huy', 'Khang', 'Khoa', 'Lâm', 'Long', 'Nam', 'Phong', 'Phúc', 'Quân', 'Sơn', 'Tài', 'Thịnh', 'Trung', 'Tú', 'Vinh'];
const TEN_NU = ['Anh', 'Chi', 'Diệp', 'Dung', 'Giang', 'Hà', 'Hân', 'Hương', 'Lan', 'Linh', 'Ly', 'Mai', 'My', 'Ngân', 'Nhi', 'Nhung', 'Oanh', 'Phương', 'Quỳnh', 'Thảo', 'Trang', 'Trinh', 'Uyên', 'Vân', 'Vy', 'Yến'];

function makeFictionalName(index: number): string {
  const ho = HO[index % HO.length];
  const isFemale = index % 2 === 1;
  if (isFemale) {
    const dem = DEM_NU[Math.floor(index / 2) % DEM_NU.length];
    const ten = TEN_NU[Math.floor(index / 3) % TEN_NU.length];
    return `${ho} ${dem} ${ten}`;
  }
  const dem = DEM_NAM[Math.floor(index / 2) % DEM_NAM.length];
  const ten = TEN_NAM[Math.floor(index / 3) % TEN_NAM.length];
  return `${ho} ${dem} ${ten}`;
}

export function buildPracticeClasses(): ClassRoom[] {
  const baseTs = 1780000000000;
  return [
    {
      id: 'cls_prac_10a1',
      name: '10A1',
      gradeLevel: '10',
      schoolYear: '2026-2027',
      teacherName: 'Cô Nguyễn Thị Minh Châu',
      note: 'Lớp thực hành Khối 10',
      isPractice: true,
      createdAt: baseTs,
    },
    {
      id: 'cls_prac_11a2',
      name: '11A2',
      gradeLevel: '11',
      schoolYear: '2026-2027',
      teacherName: 'Thầy Trần Quốc Bảo',
      note: 'Lớp thực hành Khối 11',
      isPractice: true,
      createdAt: baseTs + 1,
    },
    {
      id: 'cls_prac_12a5',
      name: '12A5',
      gradeLevel: '12',
      schoolYear: '2026-2027',
      teacherName: 'Thầy Lê Hoàng Nam',
      note: 'Lớp thực hành Khối 12',
      isPractice: true,
      createdAt: baseTs + 2,
    },
  ];
}

export function buildPracticeStudents(): Student[] {
  const baseTs = 1780000000000;
  const classes = buildPracticeClasses();
  const list: Student[] = [];

  classes.forEach((cls, cIdx) => {
    const prefix = cls.gradeLevel; // '10', '11', '12'
    for (let i = 1; i <= 45; i++) {
      const globalIdx = cIdx * 45 + i;
      const numStr = String(i).padStart(4, '0');
      const sbd = `${prefix}${numStr}`; // 6 digits keeping leading/grade structure: 100001..100045
      list.push({
        id: `st_prac_${cls.name.toLowerCase()}_${i}`,
        studentCode: `HS${prefix}${String(i).padStart(3, '0')}`,
        sbd,
        fullName: makeFictionalName(globalIdx),
        classId: cls.id,
        className: cls.name,
        note: 'Hồ sơ thực hành',
        absentExamIds: [],
        isPractice: true,
        createdAt: baseTs + globalIdx,
      });
    }
  });
  return list;
}

export function buildPracticeExams(): Exam[] {
  const baseTs = 1780000000000;
  return [
    {
      id: 'exam_prac_toan12',
      schoolName: 'TRƯỜNG THPT',
      name: 'Kiểm tra giữa kỳ I – Toán 12',
      schoolYear: '2026-2027',
      semester: 'Học kỳ I',
      subject: 'Toán',
      gradeLevel: '12',
      classNames: ['12A5'],
      examDate: '2026-11-05',
      durationMinutes: 90,
      teacherName: 'Thầy Lê Hoàng Nam',
      templateId: 'tpl_thpt2025_toan',
      scoreScale: 10,
      passThreshold: 5.0,
      examCodes: ['101', '102', '103', '104'],
      isArchived: false,
      isPractice: true,
      createdAt: baseTs + 50,
      updatedAt: baseTs + 50,
    },
    {
      id: 'exam_prac_ly11',
      schoolName: 'TRƯỜNG THPT',
      name: 'Kiểm tra giữa kỳ I – Vật lý 11',
      schoolYear: '2026-2027',
      semester: 'Học kỳ I',
      subject: 'Vật lý',
      gradeLevel: '11',
      classNames: ['11A2'],
      examDate: '2026-11-07',
      durationMinutes: 50,
      teacherName: 'Thầy Trần Quốc Bảo',
      templateId: 'tpl_thpt2025_khtn',
      scoreScale: 10,
      passThreshold: 5.0,
      examCodes: ['101', '102', '103', '104'],
      isArchived: false,
      isPractice: true,
      createdAt: baseTs + 40,
      updatedAt: baseTs + 40,
    },
    {
      id: 'exam_prac_hoa10',
      schoolName: 'TRƯỜNG THPT',
      name: 'Kiểm tra giữa kỳ I – Hóa học 10',
      schoolYear: '2026-2027',
      semester: 'Học kỳ I',
      subject: 'Hóa học',
      gradeLevel: '10',
      classNames: ['10A1'],
      examDate: '2026-11-09',
      durationMinutes: 45,
      teacherName: 'Cô Nguyễn Thị Minh Châu',
      templateId: 'tpl_trad_40',
      scoreScale: 10,
      passThreshold: 5.0,
      examCodes: ['101', '102', '103', '104'],
      isArchived: false,
      isPractice: true,
      createdAt: baseTs + 30,
      updatedAt: baseTs + 30,
    },
    {
      id: 'exam_prac_tin12',
      schoolName: 'TRƯỜNG THPT',
      name: 'Kiểm tra thường xuyên – Tin học 12',
      schoolYear: '2026-2027',
      semester: 'Học kỳ I',
      subject: 'Tin học',
      gradeLevel: '12',
      classNames: ['12A5'],
      examDate: '2026-11-11',
      durationMinutes: 45,
      teacherName: 'Thầy Lê Hoàng Nam',
      templateId: 'tpl_trad_20',
      scoreScale: 10,
      passThreshold: 5.0,
      examCodes: ['101', '102', '103', '104'],
      isArchived: false,
      isPractice: true,
      createdAt: baseTs + 20,
      updatedAt: baseTs + 20,
    },
    {
      id: 'exam_prac_anh11',
      schoolName: 'TRƯỜNG THPT',
      name: 'Kiểm tra giữa kỳ I – Tiếng Anh 11',
      schoolYear: '2026-2027',
      semester: 'Học kỳ I',
      subject: 'Tiếng Anh',
      gradeLevel: '11',
      classNames: ['11A2'],
      examDate: '2026-11-12',
      durationMinutes: 60,
      teacherName: 'Cô Phạm Thu Hà',
      templateId: 'tpl_thpt2025_40',
      scoreScale: 10,
      passThreshold: 5.0,
      examCodes: ['101', '102', '103', '104'],
      isArchived: false,
      isPractice: true,
      createdAt: baseTs + 10,
      updatedAt: baseTs + 10,
    },
  ];
}

export function buildPracticeAnswerKeys(): AnswerKey[] {
  const exams = buildPracticeExams();
  const keys: AnswerKey[] = [];
  const opts = ['A', 'B', 'C', 'D'];
  const baseTs = 1780000000000;

  for (let eIdx = 0; eIdx < exams.length; eIdx++) {
    const ex = exams[eIdx];
    for (let cIdx = 0; cIdx < ex.examCodes.length; cIdx++) {
      const code = ex.examCodes[cIdx];
      const shift = eIdx * 3 + cIdx;

      let p1Count = 40;
      let p1Pts = 0.25;
      let p2Count = 0;
      let p3Count = 0;
      let p3Pts = 0;

      if (ex.id === 'exam_prac_toan12') {
        p1Count = 12;
        p1Pts = 0.25; // 3.0đ
        p2Count = 4;  // 4.0đ
        p3Count = 6;
        p3Pts = 0.5;  // 3.0đ -> Total 10.0đ
      } else if (ex.id === 'exam_prac_ly11') {
        p1Count = 18;
        p1Pts = 0.25; // 4.5đ
        p2Count = 4;  // 4.0đ
        p3Count = 6;
        p3Pts = 0.25; // 1.5đ -> Total 10.0đ
      } else if (ex.id === 'exam_prac_tin12') {
        p1Count = 20;
        p1Pts = 0.5;  // 10.0đ
      } else {
        p1Count = 40;
        p1Pts = 0.25; // 10.0đ
      }

      const part1Answers: Record<number, string> = {};
      for (let q = 1; q <= p1Count; q++) {
        part1Answers[q] = opts[(q + shift) % 4];
      }

      const part2Answers: Record<number, Part2AnswerMap> = {};
      for (let q = 1; q <= p2Count; q++) {
        part2Answers[q] = {
          a: (q + shift) % 2 === 0,
          b: (q + shift + 1) % 3 !== 0,
          c: (q + shift) % 3 === 0,
          d: (q + shift + 1) % 2 === 0,
        };
      }

      const part3Answers: Record<number, string[]> = {};
      const sampleNums = ['-1,5', '0,25', '120', '-42', '3,14', '98'];
      for (let q = 1; q <= p3Count; q++) {
        const val = sampleNums[(q + cIdx - 1) % sampleNums.length];
        part3Answers[q] = [val];
      }

      keys.push({
        id: `ak_prac_${ex.id}_${code}`,
        examId: ex.id,
        examCode: code,
        templateId: ex.templateId,
        part1Count: p1Count,
        part1PointsPerQ: p1Pts,
        part1Answers,
        part2Count: p2Count,
        part2ScoringMode: 'progressive_2025',
        part2Progressive: [0, 0.1, 0.25, 0.5, 1.0],
        part2CustomPerItem: 0.25,
        part2Answers,
        part3Count: p3Count,
        part3PointsPerQ: p3Pts,
        part3AllowDotComma: true,
        part3AllowTolerance: false,
        part3Tolerance: 0,
        part3RoundingMode: 'exact',
        part3Answers,
        history: [
          {
            timestamp: baseTs,
            reason: 'Khởi tạo ngân hàng đáp án chuẩn 4 mã đề',
            changedBy: ex.teacherName,
          },
        ],
        isPractice: true,
        updatedAt: baseTs,
      });
    }
  }
  return keys;
}

const SCENARIO_LABELS: Record<PracticeScenario, string> = {
  standard_correct: 'Tô đúng quy cách',
  has_wrong: 'Có câu trả lời sai',
  has_blank: 'Có câu bỏ trống',
  multi_mark: 'Tô nhiều đáp án',
  faint_mark: 'Tô mờ',
  erased_mark: 'Có dấu tẩy xóa',
  rotated_90: 'Xoay ngang 90°',
  skewed: 'Chụp nghiêng 5°',
  low_light: 'Thiếu sáng',
  shadow_gradient: 'Có bóng đổ',
  wrong_exam_code: 'Sai mã đề',
};

function pickScenarioForIndex(idx0: number): PracticeScenario {
  // Out of 45 sheets per exam: majority standard_correct + has_wrong + has_blank, plus realistic edge cases
  const mod = idx0 % 45;
  if (mod < 16) return 'standard_correct';
  if (mod < 28) return 'has_wrong';
  if (mod < 32) return 'has_blank';
  if (mod === 32 || mod === 33) return 'multi_mark';
  if (mod === 34 || mod === 35) return 'faint_mark';
  if (mod === 36 || mod === 37) return 'erased_mark';
  if (mod === 38 || mod === 39) return 'rotated_90';
  if (mod === 40 || mod === 41) return 'skewed';
  if (mod === 42) return 'low_light';
  if (mod === 43) return 'shadow_gradient';
  return 'wrong_exam_code';
}

export function buildPracticeSheets225(): PracticeSheetSpec[] {
  const exams = buildPracticeExams(); // All 5 exams: Toán 12, Vật lý 11, Hóa học 10, Tin học 12, Tiếng Anh 11
  const students = buildPracticeStudents();
  const keys = buildPracticeAnswerKeys();
  const sheets: PracticeSheetSpec[] = [];

  const examClassMap: Record<string, string> = {
    exam_prac_toan12: '12A5',
    exam_prac_ly11: '11A2',
    exam_prac_hoa10: '10A1',
    exam_prac_tin12: '12A5',
    exam_prac_anh11: '11A2',
  };

  for (const ex of exams) {
    const clsName = examClassMap[ex.id] || '12A5';
    const clsStudents = students.filter((s) => s.className === clsName);
    clsStudents.forEach((st, idx) => {
      const code = ex.examCodes[idx % ex.examCodes.length];
      const ak = keys.find((k) => k.examId === ex.id && k.examCode === code)!;
      const scenario = pickScenarioForIndex(idx);

      let expectedScore = 10;
      let expectedSummary = 'Đúng toàn bộ theo đáp án';
      if (scenario === 'has_wrong') {
        const numSeed = Number(st.sbd.slice(-2)) || 1;
        const wrongCount = (numSeed % 4) + 1;
        expectedScore = Math.max(0, Math.round((10 - wrongCount * ak.part1PointsPerQ) * 100) / 100);
        expectedSummary = `Sai ${wrongCount} câu Phần I`;
      } else if (scenario === 'has_blank') {
        expectedScore = Math.round((10 - 2 * ak.part1PointsPerQ) * 100) / 100;
        expectedSummary = 'Bỏ trống 2 câu Phần I';
      } else if (scenario === 'multi_mark') {
        expectedScore = Math.round((10 - ak.part1PointsPerQ) * 100) / 100;
        expectedSummary = 'Câu 2 tô 2 phương án -> Cần kiểm duyệt';
      } else if (scenario === 'faint_mark') {
        expectedScore = 10;
        expectedSummary = 'Câu 3 tô mờ -> Cần kiểm duyệt';
      } else if (scenario === 'erased_mark') {
        expectedScore = 10;
        expectedSummary = 'Câu 4 có vết tẩy xóa -> Cần kiểm duyệt';
      } else if (scenario === 'wrong_exam_code') {
        expectedScore = 0;
        expectedSummary = 'Mã đề 999 không có trong ngân hàng -> Cần kiểm duyệt';
      }

      sheets.push({
        id: `ps_${ex.id}_${st.sbd}`,
        examId: ex.id,
        templateId: ex.templateId,
        studentId: st.id,
        studentName: st.fullName,
        className: st.className,
        sbd: st.sbd,
        examCode: scenario === 'wrong_exam_code' ? '999' : code,
        scenario,
        scenarioLabel: SCENARIO_LABELS[scenario],
        expectedScore,
        expectedSummary,
      });
    });
  }

  return sheets;
}

export function buildPracticeSheets135(): PracticeSheetSpec[] {
  return buildPracticeSheets225().slice(0, 135);
}

export function buildSimSpecForPracticeSheet(
  sheet: PracticeSheetSpec,
  answerKey: AnswerKey | undefined
): SimulatedMarkSpec {
  const opts = ['A', 'B', 'C', 'D'];
  const part1: Record<number, string | string[]> = {};
  const part2: Record<number, Partial<Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>>> = {};
  const part3: Record<number, string> = {};

  if (answerKey) {
    for (let q = 1; q <= answerKey.part1Count; q++) {
      part1[q] = answerKey.part1Answers[q] || 'A';
    }
    for (let q = 1; q <= answerKey.part2Count; q++) {
      const m = answerKey.part2Answers[q];
      if (m) {
        part2[q] = {
          a: m.a ? 'Đ' : 'S',
          b: m.b ? 'Đ' : 'S',
          c: m.c ? 'Đ' : 'S',
          d: m.d ? 'Đ' : 'S',
        };
      }
    }
    for (let q = 1; q <= answerKey.part3Count; q++) {
      const raw = (answerKey.part3Answers[q]?.[0] || '10').padEnd(4, ' ');
      part3[q] = raw;
    }
  } else {
    // wrong_exam_code fallback mark pattern
    for (let q = 1; q <= 12; q++) part1[q] = opts[q % 4];
  }

  const sim: SimulatedMarkSpec = {
    sbd: sheet.sbd,
    examCode: sheet.examCode,
    part1,
    part2,
    part3,
  };

  if (sheet.scenario === 'has_wrong' && answerKey) {
    const numSeed = Number(sheet.sbd.slice(-2)) || 1;
    const wrongCount = (numSeed % 4) + 1;
    for (let w = 1; w <= wrongCount && w <= answerKey.part1Count; w++) {
      const correct = answerKey.part1Answers[w] || 'A';
      part1[w] = opts[(opts.indexOf(correct) + 1) % 4];
    }
  } else if (sheet.scenario === 'has_blank') {
    delete part1[1];
    delete part1[2];
  } else if (sheet.scenario === 'multi_mark') {
    part1[2] = ['A', 'B'];
  } else if (sheet.scenario === 'faint_mark') {
    sim.faintQuestions = [3];
  } else if (sheet.scenario === 'erased_mark') {
    const correct4 = answerKey?.part1Answers[4] || 'D';
    const wrong4 = opts[(opts.indexOf(correct4) + 1) % 4];
    sim.erasedQuestions = [{ q: 4, erasedOpt: wrong4, finalOpt: correct4 }];
  } else if (sheet.scenario === 'rotated_90') {
    sim.rotationDeg = 90;
  } else if (sheet.scenario === 'skewed') {
    sim.skewDeg = 5;
  } else if (sheet.scenario === 'low_light') {
    sim.brightnessOffset = -58;
  } else if (sheet.scenario === 'shadow_gradient') {
    sim.shadowGradient = true;
  }

  return sim;
}

export async function generatePracticeBatchPdf(
  sheets: PracticeSheetSpec[],
  exams: Exam[],
  templates: SheetTemplate[],
  answerKeys: AnswerKey[]
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const canvas = document.createElement('canvas');

  for (const sheet of sheets) {
    const ex = exams.find((e) => e.id === sheet.examId);
    const tpl = templates.find((t) => t.id === sheet.templateId);
    if (!ex || !tpl) continue;
    const ak = answerKeys.find(
      (k) => k.examId === sheet.examId && k.examCode === sheet.examCode
    );
    const sim = buildSimSpecForPracticeSheet(sheet, ak);
    drawTemplateOnCanvas(
      canvas,
      tpl,
      { schoolName: ex.schoolName, examName: ex.name, subject: ex.subject },
      sim
    );
    const jpgUrl = canvas.toDataURL('image/jpeg', 0.85);
    const bytes = await fetch(jpgUrl).then((r) => r.arrayBuffer());
    const img = await pdf.embedJpg(bytes);

    const isLand = img.width > img.height;
    const pw = isLand ? 841.89 : 595.28;
    const ph = isLand ? 595.28 : 841.89;
    const page = pdf.addPage([pw, ph]);
    page.drawImage(img, { x: 8, y: 8, width: pw - 16, height: ph - 16 });
  }

  canvas.width = 1;
  canvas.height = 1;
  return pdf.save();
}

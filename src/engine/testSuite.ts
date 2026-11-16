import type {
  AnswerKey,
  AppSettings,
  QuestionRecognition,
  TestCaseResult,
} from '../types/omr';
import { DEFAULT_SETTINGS, exportBackup, restoreBackup } from '../db/database';
import { processSheetImageWithOpenCV } from './omrEngine';
import { scoreRecognitionAgainstKey } from './scoring';
import { drawTemplateOnCanvas, generateBlankSheetPdf, type SimulatedMarkSpec } from './sheetRenderer';
import { getBuiltInTemplates } from './templates';

function makeBaseAnswerKey(templateId: string, examCode = '101'): AnswerKey {
  return {
    id: `test_ak_${examCode}`,
    examId: 'test_exam',
    examCode,
    templateId,
    part1Count: 12,
    part1PointsPerQ: 0.25,
    part1Answers: {
      1: 'A', 2: 'B', 3: 'C', 4: 'D',
      5: 'A', 6: 'B', 7: 'C', 8: 'D',
      9: 'A', 10: 'B', 11: 'C', 12: 'D',
    },
    part2Count: 4,
    part2ScoringMode: 'progressive_2025',
    part2Progressive: [0, 0.1, 0.25, 0.5, 1.0],
    part2CustomPerItem: 0.25,
    part2Answers: {
      1: { a: true, b: false, c: true, d: false },
      2: { a: true, b: true, c: false, d: false },
      3: { a: false, b: false, c: true, d: true },
      4: { a: true, b: false, c: false, d: true },
    },
    part3Count: 6,
    part3PointsPerQ: 0.5,
    part3AllowDotComma: true,
    part3AllowTolerance: false,
    part3Tolerance: 0,
    part3RoundingMode: 'exact',
    part3Answers: {
      1: ['-1,5'],
      2: ['0,25'],
      3: ['120'],
      4: ['-42'],
      5: ['3,14'],
      6: ['98'],
    },
    history: [],
    updatedAt: Date.now(),
  };
}

export async function runMandatoryVerificationSuite(
  settings: AppSettings = DEFAULT_SETTINGS
): Promise<TestCaseResult[]> {
  const results: TestCaseResult[] = [];
  const templates = getBuiltInTemplates();
  const thptTpl = templates.find((t) => t.id === 'tpl_thpt2025_toan')!;
  const trad20Tpl = templates.find((t) => t.id === 'tpl_trad_20')!;
  const pairedTpl = templates.find((t) => t.id === 'tpl_paired_a5_20')!;

  // 1. Unit Test: MOET 2025 Progressive Part II Scoring + Fixed-point arithmetic
  {
    const t0 = performance.now();
    const ak = makeBaseAnswerKey(thptTpl.id, '101');
    const mockQs: QuestionRecognition[] = [];
    for (let q = 1; q <= 12; q++) {
      mockQs.push({
        part: 'part1',
        question: q,
        detectedValue: ak.part1Answers[q],
        correctValue: ak.part1Answers[q],
        status: 'pending_review',
        confidence: 1,
        earnedPoints: 0,
        maxPoints: 0.25,
        bubbles: [],
      });
    }
    // Q1: 4/4 -> 1.0, Q2: 3/4 -> 0.5, Q3: 2/4 -> 0.25, Q4: 1/4 -> 0.1 => sum = 1.85
    const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
    const correctCounts = [4, 3, 2, 1];
    for (let q = 1; q <= 4; q++) {
      const targetC = correctCounts[q - 1];
      subKeys.forEach((sk, idx) => {
        const expBool = ak.part2Answers[q][sk]!;
        const chooseBool = idx < targetC ? expBool : !expBool;
        mockQs.push({
          part: 'part2',
          question: q,
          subItem: sk,
          detectedValue: chooseBool ? 'Đ' : 'S',
          correctValue: '',
          status: 'pending_review',
          confidence: 1,
          earnedPoints: 0,
          maxPoints: 0.25,
          bubbles: [],
        });
      });
    }
    // Part 3: Q1=-1.5 (dot/comma norm), Q2=0,25, others blank => 1.0
    mockQs.push(
      { part: 'part3', question: 1, detectedValue: '-1.5', correctValue: '', status: 'pending_review', confidence: 1, earnedPoints: 0, maxPoints: 0.5, bubbles: [] },
      { part: 'part3', question: 2, detectedValue: '0,25', correctValue: '', status: 'pending_review', confidence: 1, earnedPoints: 0, maxPoints: 0.5, bubbles: [] }
    );
    const out = scoreRecognitionAgainstKey(mockQs, ak);
    const expectedTotal = 5.85; // 3.0 + 1.85 + 1.0
    results.push({
      id: 'unit_scoring_2025',
      name: 'Unit Test: Thang điểm THPT 2025 & số âm/phẩy',
      category: 'scoring',
      passed: out.scoreBreakdown.total === expectedTotal && out.scoreBreakdown.part2 === 1.85,
      expected: `Tổng ${expectedTotal} (PI:3, PII:1.85, PIII:1)`,
      actual: `Tổng ${out.scoreBreakdown.total} (PI:${out.scoreBreakdown.part1}, PII:${out.scoreBreakdown.part2}, PIII:${out.scoreBreakdown.part3})`,
      durationMs: Math.round(performance.now() - t0),
    });
  }

  // Helper to run real OpenCV OMR test on a synthetic ground-truth canvas
  const runOmrTest = async (
    id: string,
    name: string,
    tpl: typeof thptTpl,
    ak: AnswerKey,
    sim: SimulatedMarkSpec,
    verify: (res: Awaited<ReturnType<typeof processSheetImageWithOpenCV>>) => { ok: boolean; actual: string },
    expectedText: string
  ) => {
    const t0 = performance.now();
    try {
      const canvas = document.createElement('canvas');
      drawTemplateOnCanvas(canvas, tpl, { schoolName: 'TRƯỜNG THPT', examName: 'KIỂM THỬ OMR', subject: 'Toán' }, sim);
      const res = await processSheetImageWithOpenCV(canvas, tpl, [ak], settings);
      const check = verify(res);
      results.push({
        id,
        name,
        category: 'omr',
        passed: check.ok,
        expected: expectedText,
        actual: check.actual,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      results.push({
        id,
        name,
        category: 'omr',
        passed: false,
        expected: expectedText,
        actual: err instanceof Error ? err.message : 'Lỗi thực thi',
        durationMs: Math.round(performance.now() - t0),
      });
    }
  };

  const akThpt = makeBaseAnswerKey(thptTpl.id, '101');
  const akTrad20: AnswerKey = {
    ...makeBaseAnswerKey(trad20Tpl.id, '101'),
    part1Count: 20,
    part1PointsPerQ: 0.5,
    part1Answers: Object.fromEntries(
      Array.from({ length: 20 }, (_, i) => [i + 1, ['A', 'B', 'C', 'D'][i % 4]])
    ),
    part2Count: 0,
    part3Count: 0,
  };

  // 2. Exact full THPT 2025 sheet (including negative number -1,5 and comma 0,25)
  await runOmrTest(
    'omr_exact_thpt2025',
    'OMR: Phiếu tô chuẩn THPT 2025 (âm -1,5 & phẩy 0,25)',
    thptTpl,
    akThpt,
    {
      sbd: '012345',
      examCode: '101',
      part1: akThpt.part1Answers,
      part2: {
        1: { a: 'Đ', b: 'S', c: 'Đ', d: 'S' },
        2: { a: 'Đ', b: 'Đ', c: 'S', d: 'S' },
        3: { a: 'S', b: 'S', c: 'Đ', d: 'Đ' },
        4: { a: 'Đ', b: 'S', c: 'S', d: 'Đ' },
      },
      part3: {
        1: '-1,5',
        2: '0,25',
        3: '120 ',
        4: '-42 ',
        5: '3,14',
        6: '98  ',
      },
    },
    (res) => {
      const r = res[0];
      const ok =
        r.status === 'graded' &&
        r.recognition.sbd === '012345' &&
        r.recognition.examCode === '101' &&
        r.scored.scoreBreakdown.total === 10;
      return {
        ok,
        actual: `SBD=${r.recognition.sbd}, Mã=${r.recognition.examCode}, Điểm=${r.scored.scoreBreakdown.total}, TT=${r.status}`,
      };
    },
    'SBD=012345, Mã=101, Điểm=10, TT=graded'
  );

  // 3. Blank sheet
  await runOmrTest(
    'omr_blank',
    'OMR: Phiếu bỏ trống toàn bộ câu trả lời',
    trad20Tpl,
    akTrad20,
    { sbd: '000012', examCode: '101' },
    (res) => {
      const r = res[0];
      return {
        ok: r.scored.scoreBreakdown.blankCount === 20 && r.scored.scoreBreakdown.total === 0,
        actual: `Trống=${r.scored.scoreBreakdown.blankCount}/20, Điểm=${r.scored.scoreBreakdown.total}`,
      };
    },
    'Trống=20/20, Điểm=0'
  );

  // 4. Faint mark detection
  await runOmrTest(
    'omr_faint',
    'OMR: Phiếu có câu tô mờ',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000025',
      examCode: '101',
      part1: { 1: 'A', 2: 'B', 3: 'C' },
      faintQuestions: [2],
    },
    (res) => {
      const r = res[0];
      const q2 = r.recognition.questions.find((q) => q.question === 2);
      const ok = r.status === 'needs_review' && (q2?.status === 'faint' || q2?.status === 'blank');
      return { ok, actual: `Q2=${q2?.status}, TT=${r.status}` };
    },
    'Q2=faint/blank, TT=needs_review'
  );

  // 5. Multi-mark detection
  await runOmrTest(
    'omr_multimark',
    'OMR: Phiếu tô nhiều đáp án trên một câu',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000033',
      examCode: '101',
      part1: { 1: ['A', 'B'], 2: 'B' },
    },
    (res) => {
      const r = res[0];
      const q1 = r.recognition.questions.find((q) => q.question === 1);
      return {
        ok: q1?.status === 'multi_mark' && r.status === 'needs_review',
        actual: `Q1=${q1?.status}, TT=${r.status}`,
      };
    },
    'Q1=multi_mark, TT=needs_review'
  );

  // 6. Erasure smudge detection
  await runOmrTest(
    'omr_erased',
    'OMR: Phiếu có dấu hiệu tẩy xóa',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000044',
      examCode: '101',
      part1: { 1: 'A' },
      erasedQuestions: [{ q: 1, erasedOpt: 'C', finalOpt: 'A' }],
    },
    (res) => {
      const r = res[0];
      const q1 = r.recognition.questions.find((q) => q.question === 1);
      return {
        ok: q1?.status === 'erased' || q1?.status === 'multi_mark',
        actual: `Q1=${q1?.status} (${q1?.note || ''})`,
      };
    },
    'Q1=erased/multi_mark'
  );

  // 7. Rotations 90, 180, 270
  for (const deg of [90, 180, 270] as const) {
    await runOmrTest(
      `omr_rot_${deg}`,
      `OMR: Phiếu xoay ${deg}°`,
      trad20Tpl,
      akTrad20,
      {
        sbd: '000105',
        examCode: '101',
        part1: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
        rotationDeg: deg,
      },
      (res) => {
        const r = res[0];
        const ok =
          r.recognition.rotationDeg === deg &&
          r.recognition.sbd === '000105' &&
          r.scored.scoreBreakdown.correctCount === 4;
        return {
          ok,
          actual: `Xoay=${r.recognition.rotationDeg}°, SBD=${r.recognition.sbd}, Đúng=${r.scored.scoreBreakdown.correctCount}/4`,
        };
      },
      `Xoay=${deg}°, SBD=000105, Đúng=4/4`
    );
  }

  // 8. Skewed sheet (6 deg)
  await runOmrTest(
    'omr_skew',
    'OMR: Phiếu chụp nghiêng 6°',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000201',
      examCode: '101',
      part1: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
      skewDeg: 6,
    },
    (res) => {
      const r = res[0];
      return {
        ok: r.recognition.sbd === '000201' && r.scored.scoreBreakdown.correctCount === 4,
        actual: `Nghiêng=${r.qualityMetrics.skewDeg}°, SBD=${r.recognition.sbd}, Đúng=${r.scored.scoreBreakdown.correctCount}/4`,
      };
    },
    'SBD=000201, Đúng=4/4'
  );

  // 9. Low light + Shadow gradient
  await runOmrTest(
    'omr_shadow_lowlight',
    'OMR: Phiếu thiếu sáng & có bóng đổ chéo',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000309',
      examCode: '101',
      part1: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
      shadowGradient: true,
      brightnessOffset: -65,
    },
    (res) => {
      const r = res[0];
      return {
        ok: r.recognition.sbd === '000309' && r.scored.scoreBreakdown.correctCount === 4,
        actual: `Bóng=${r.qualityMetrics.hasShadowWarning}, SBD=${r.recognition.sbd}, Đúng=${r.scored.scoreBreakdown.correctCount}/4`,
      };
    },
    'Khử bóng đọc đúng SBD=000309, Đúng=4/4'
  );

  // 10. Missing fiducial marker
  await runOmrTest(
    'omr_missing_fiducial',
    'OMR: Thiếu điểm định vị góc (chặn chấm tự động)',
    trad20Tpl,
    akTrad20,
    {
      sbd: '000401',
      examCode: '101',
      part1: { 1: 'A' },
      omitBottomRightFiducial: true,
    },
    (res) => {
      const r = res[0];
      return {
        ok: r.qualityMetrics.detectedFiducials < 4 && r.status === 'needs_review' && r.scored.scoreBreakdown.total === 0,
        actual: `Định vị=${r.qualityMetrics.detectedFiducials}/4, TT=${r.status}, Điểm=${r.scored.scoreBreakdown.total}`,
      };
    },
    'Định vị <4/4, TT=needs_review, Điểm=0'
  );

  // 11. Paired A4 (2 x A5) including duplicate SBD isolation
  await runOmrTest(
    'omr_paired_a5',
    'OMR: Phiếu ghép đôi A4 -> 2 phiếu A5 độc lập',
    pairedTpl,
    akTrad20,
    {
      sbd: '000501',
      examCode: '101',
      part1: { 1: 'A', 2: 'B' },
      pairedSlot2: {
        sbd: '000501', // same SBD to verify non-overwrite!
        examCode: '101',
        part1: { 1: 'A', 2: 'B', 3: 'C', 4: 'D' },
      },
    },
    (res) => {
      const ok =
        res.length === 2 &&
        res[0].pairedSlot === 1 &&
        res[1].pairedSlot === 2 &&
        res[0].scored.scoreBreakdown.correctCount === 2 &&
        res[1].scored.scoreBreakdown.correctCount === 4;
      return {
        ok,
        actual: `Số phiếu tách=${res.length} (P1=${res[0]?.scored.scoreBreakdown.correctCount}đ, P2=${res[1]?.scored.scoreBreakdown.correctCount}đ)`,
      };
    },
    'Tách 2 phiếu độc lập (P1=2 đúng, P2=4 đúng)'
  );

  // 12. IndexedDB Backup Export/Validation test
  {
    const t0 = performance.now();
    try {
      const backup = await exportBackup('full');
      const valid = backup.app === 'chamthi-smart' && typeof backup.schemaVersion === 'string';
      // Ensure restore validation rejects invalid payload
      let rejectedInvalid = false;
      try {
        // @ts-expect-error testing invalid payload rejection
        await restoreBackup({ app: 'invalid' }, 'merge');
      } catch {
        rejectedInvalid = true;
      }
      results.push({
        id: 'storage_backup',
        name: 'Lưu trữ: Sao lưu IndexedDB & kiểm tra phiên bản',
        category: 'storage',
        passed: valid && rejectedInvalid,
        expected: 'Xuất JSON hợp lệ & từ chối tệp sai định dạng',
        actual: `Hợp lệ=${valid}, Từ chối tệp lỗi=${rejectedInvalid}`,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      results.push({
        id: 'storage_backup',
        name: 'Lưu trữ: Sao lưu IndexedDB',
        category: 'storage',
        passed: false,
        expected: 'Xuất JSON hợp lệ',
        actual: err instanceof Error ? err.message : 'Lỗi',
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }

  // 13. Vietnamese PDF Generation test
  {
    const t0 = performance.now();
    try {
      const bytes = await generateBlankSheetPdf(thptTpl, {
        schoolName: 'TRƯỜNG THPT',
        examName: 'KIỂM TRA HỌC KỲ I',
        subject: 'Toán học',
      });
      results.push({
        id: 'pdf_vietnamese',
        name: 'Xuất PDF: Nhúng font tiếng Việt Unicode (DejaVuSans)',
        category: 'pdf',
        passed: bytes.byteLength > 10000,
        expected: 'Tạo PDF > 10KB không lỗi font tiếng Việt',
        actual: `Kích thước PDF = ${Math.round(bytes.byteLength / 1024)} KB`,
        durationMs: Math.round(performance.now() - t0),
      });
    } catch (err) {
      results.push({
        id: 'pdf_vietnamese',
        name: 'Xuất PDF tiếng Việt',
        category: 'pdf',
        passed: false,
        expected: 'Tạo PDF thành công',
        actual: err instanceof Error ? err.message : 'Lỗi',
        durationMs: Math.round(performance.now() - t0),
      });
    }
  }

  return results;
}

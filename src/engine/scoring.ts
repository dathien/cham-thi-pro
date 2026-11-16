import type {
  AnswerKey,
  ExamSubmission,
  Part2SubKey,
  QuestionRecognition,
  Student,
} from '../types/omr';

// Fixed-point scale factor (10,000) to avoid IEEE 754 floating-point drift
const SCALE = 10000;

export function toFixedInt(val: number): number {
  return Math.round(val * SCALE);
}

export function fromFixedInt(intVal: number): number {
  return Math.round(intVal) / SCALE;
}

export function roundScore(val: number, decimals = 2): number {
  const f = Math.pow(10, decimals);
  return Math.round((val + Number.EPSILON) * f) / f;
}

export function normalizeNumericAnswer(
  raw: string,
  allowDotComma: boolean
): { valid: boolean; value: number | null; normalized: string } {
  const trimmed = raw.trim().replace(/\s+/g, '');
  if (!trimmed) return { valid: false, value: null, normalized: '' };
  if (allowDotComma) {
    const norm = trimmed.replace(/,/g, '.');
    if (!/^-?\d+(\.\d+)?$/.test(norm)) {
      return { valid: false, value: null, normalized: trimmed };
    }
    const parsed = Number(norm);
    return Number.isFinite(parsed)
      ? { valid: true, value: parsed, normalized: norm }
      : { valid: false, value: null, normalized: trimmed };
  } else {
    // Vietnamese standard requires comma for decimal if configured strictly
    const norm = trimmed.replace(/,/g, '.');
    if (!/^-?\d+(\.\d+)?$/.test(norm)) {
      return { valid: false, value: null, normalized: trimmed };
    }
    if (trimmed.includes('.') && !allowDotComma) {
      return { valid: false, value: null, normalized: trimmed };
    }
    const parsed = Number(norm);
    return Number.isFinite(parsed)
      ? { valid: true, value: parsed, normalized: trimmed }
      : { valid: false, value: null, normalized: trimmed };
  }
}

export function computeAnswerKeyMaxScore(ak: AnswerKey): number {
  let totalInt = 0;
  totalInt += ak.part1Count * toFixedInt(ak.part1PointsPerQ);
  if (ak.part2ScoringMode === 'progressive_2025') {
    totalInt += ak.part2Count * toFixedInt(ak.part2Progressive[4]);
  } else {
    totalInt += ak.part2Count * 4 * toFixedInt(ak.part2CustomPerItem);
  }
  totalInt += ak.part3Count * toFixedInt(ak.part3PointsPerQ);
  return fromFixedInt(totalInt);
}

export interface ScoredOutput {
  questions: QuestionRecognition[];
  scoreBreakdown: {
    part1: number;
    part2: number;
    part3: number;
    total: number;
    maxPossible: number;
    correctCount: number;
    wrongCount: number;
    blankCount: number;
  };
}

export function scoreRecognitionAgainstKey(
  rawQuestions: QuestionRecognition[],
  answerKey: AnswerKey | undefined
): ScoredOutput {
  if (!answerKey) {
    return {
      questions: rawQuestions,
      scoreBreakdown: {
        part1: 0,
        part2: 0,
        part3: 0,
        total: 0,
        maxPossible: 0,
        correctCount: 0,
        wrongCount: 0,
        blankCount: rawQuestions.filter((q) => q.status === 'blank').length,
      },
    };
  }

  let part1Int = 0;
  let part2Int = 0;
  let part3Int = 0;
  let correctCount = 0;
  let wrongCount = 0;
  let blankCount = 0;

  // Group Part II questions by question number to apply progressive scoring accurately
  const part2Groups = new Map<number, QuestionRecognition[]>();
  const updatedQuestions: QuestionRecognition[] = rawQuestions.map((q) => ({ ...q }));

  for (const q of updatedQuestions) {
    if (q.part === 'part1') {
      const expected = (answerKey.part1Answers[q.question] || '').trim().toUpperCase();
      q.correctValue = expected;
      q.maxPoints = answerKey.part1PointsPerQ;

      if (
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'unrecognized' ||
        q.status === 'pending_review'
      ) {
        q.earnedPoints = 0;
        continue;
      }

      if (!q.detectedValue) {
        q.status = 'blank';
        q.earnedPoints = 0;
        blankCount++;
      } else if (expected && q.detectedValue.toUpperCase() === expected) {
        q.status = 'correct';
        q.earnedPoints = answerKey.part1PointsPerQ;
        part1Int += toFixedInt(answerKey.part1PointsPerQ);
        correctCount++;
      } else {
        q.status = 'wrong';
        q.earnedPoints = 0;
        wrongCount++;
      }
    } else if (q.part === 'part2') {
      const list = part2Groups.get(q.question) || [];
      list.push(q);
      part2Groups.set(q.question, list);
    } else if (q.part === 'part3') {
      const expectedList = answerKey.part3Answers[q.question] || [];
      q.correctValue = expectedList.join(' | ');
      q.maxPoints = answerKey.part3PointsPerQ;

      if (
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'unrecognized' ||
        q.status === 'pending_review'
      ) {
        q.earnedPoints = 0;
        continue;
      }

      if (!q.detectedValue) {
        q.status = 'blank';
        q.earnedPoints = 0;
        blankCount++;
      } else {
        const studentParsed = normalizeNumericAnswer(
          q.detectedValue,
          answerKey.part3AllowDotComma
        );
        let matched = false;
        if (studentParsed.valid && studentParsed.value !== null) {
          for (const expRaw of expectedList) {
            const expParsed = normalizeNumericAnswer(expRaw, true);
            if (!expParsed.valid || expParsed.value === null) continue;
            if (answerKey.part3RoundingMode === 'round_2') {
              const sRound = roundScore(studentParsed.value, 2);
              const eRound = roundScore(expParsed.value, 2);
              if (
                answerKey.part3AllowTolerance
                  ? Math.abs(sRound - eRound) <= answerKey.part3Tolerance
                  : sRound === eRound
              ) {
                matched = true;
                break;
              }
            } else {
              if (
                answerKey.part3AllowTolerance
                  ? Math.abs(studentParsed.value - expParsed.value) <= answerKey.part3Tolerance
                  : studentParsed.value === expParsed.value
              ) {
                matched = true;
                break;
              }
            }
          }
        }
        if (matched) {
          q.status = 'correct';
          q.earnedPoints = answerKey.part3PointsPerQ;
          part3Int += toFixedInt(answerKey.part3PointsPerQ);
          correctCount++;
        } else {
          q.status = 'wrong';
          q.earnedPoints = 0;
          wrongCount++;
        }
      }
    }
  }

  // Evaluate Part II groups
  for (const [qNum, items] of part2Groups.entries()) {
    const expObj = answerKey.part2Answers[qNum];
    let correctSubItems = 0;
    const maxQuestionPoints =
      answerKey.part2ScoringMode === 'progressive_2025'
        ? answerKey.part2Progressive[4]
        : 4 * answerKey.part2CustomPerItem;

    for (const item of items) {
      const subKey = (item.subItem || 'a') as Part2SubKey;
      const expBool = expObj ? expObj[subKey] : null;
      item.correctValue = expBool === true ? 'Đ' : expBool === false ? 'S' : '';
      item.maxPoints = fromFixedInt(toFixedInt(maxQuestionPoints) / 4);

      if (
        item.status === 'multi_mark' ||
        item.status === 'faint' ||
        item.status === 'erased' ||
        item.status === 'unrecognized' ||
        item.status === 'pending_review'
      ) {
        item.earnedPoints = 0;
        continue;
      }

      if (!item.detectedValue) {
        item.status = 'blank';
        item.earnedPoints = 0;
        blankCount++;
      } else if (item.correctValue && item.detectedValue === item.correctValue) {
        item.status = 'correct';
        correctSubItems++;
        correctCount++;
      } else {
        item.status = 'wrong';
        wrongCount++;
      }
    }

    const qPoints =
      answerKey.part2ScoringMode === 'progressive_2025'
        ? answerKey.part2Progressive[Math.min(4, correctSubItems)]
        : fromFixedInt(correctSubItems * toFixedInt(answerKey.part2CustomPerItem));

    part2Int += toFixedInt(qPoints);
    // Distribute earnedPoints annotation cleanly on items for reporting
    if (items.length > 0) {
      const perCorrect = correctSubItems > 0 ? qPoints / correctSubItems : 0;
      for (const item of items) {
        item.earnedPoints = item.status === 'correct' ? roundScore(perCorrect, 3) : 0;
      }
    }
  }

  const totalInt = part1Int + part2Int + part3Int;
  const maxPossible = computeAnswerKeyMaxScore(answerKey);

  return {
    questions: updatedQuestions,
    scoreBreakdown: {
      part1: roundScore(fromFixedInt(part1Int), 2),
      part2: roundScore(fromFixedInt(part2Int), 2),
      part3: roundScore(fromFixedInt(part3Int), 2),
      total: roundScore(fromFixedInt(totalInt), 2),
      maxPossible: roundScore(maxPossible, 2),
      correctCount,
      wrongCount,
      blankCount,
    },
  };
}

// Consistent competition ranking (1, 1, 3, 4...) for tied scores
export function computeCompetitionRanks(
  submissions: ExamSubmission[]
): Map<string, number> {
  const graded = submissions
    .filter((s) => s.status === 'graded' && !s.isTestSample)
    .slice()
    .sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);

  const ranks = new Map<string, number>();
  let currentRank = 1;
  for (let i = 0; i < graded.length; i++) {
    if (i > 0 && graded[i].scoreBreakdown.total < graded[i - 1].scoreBreakdown.total) {
      currentRank = i + 1;
    }
    ranks.set(graded[i].id, currentRank);
  }
  return ranks;
}

// Statistical helpers for Exam Analytics (Mục XVII)
export interface ExamAnalyticsSummary {
  presentCount: number;
  absentCount: number;
  mean: number;
  median: number;
  max: number;
  min: number;
  stdDev: number;
  passCount: number;
  passRate: number;
  histogram: { label: string; min: number; max: number; count: number }[];
  kr20: number | null;
}

export function computeExamAnalytics(
  submissions: ExamSubmission[],
  students: Student[],
  examId: string,
  passThreshold: number,
  scoreScale = 10
): ExamAnalyticsSummary {
  const graded = submissions.filter(
    (s) => s.examId === examId && s.status === 'graded' && !s.isTestSample
  );
  const absentCount = students.filter((st) => st.absentExamIds.includes(examId)).length;
  const scores = graded.map((s) => s.scoreBreakdown.total).sort((a, b) => a - b);

  const bins = [
    { label: '0 - <2', min: 0, max: 2, count: 0 },
    { label: '2 - <4', min: 2, max: 4, count: 0 },
    { label: '4 - <5', min: 4, max: 5, count: 0 },
    { label: '5 - <6.5', min: 5, max: 6.5, count: 0 },
    { label: '6.5 - <8', min: 6.5, max: 8, count: 0 },
    { label: '8 - 10', min: 8, max: scoreScale + 0.01, count: 0 },
  ];

  for (const sc of scores) {
    const bin = bins.find((b) => sc >= b.min && sc < b.max) || bins[bins.length - 1];
    bin.count++;
  }

  if (scores.length === 0) {
    return {
      presentCount: 0,
      absentCount,
      mean: 0,
      median: 0,
      max: 0,
      min: 0,
      stdDev: 0,
      passCount: 0,
      passRate: 0,
      histogram: bins,
      kr20: null,
    };
  }

  const sum = scores.reduce((acc, v) => acc + v, 0);
  const mean = sum / scores.length;
  const mid = Math.floor(scores.length / 2);
  const median =
    scores.length % 2 === 0 ? (scores[mid - 1] + scores[mid]) / 2 : scores[mid];
  const min = scores[0];
  const max = scores[scores.length - 1];
  const variance =
    scores.reduce((acc, v) => acc + Math.pow(v - mean, 2), 0) / scores.length;
  const stdDev = Math.sqrt(variance);
  const passCount = scores.filter((s) => s >= passThreshold).length;
  const passRate = (passCount / scores.length) * 100;

  // KR-20 for binary-scored items (Part I) when all graded papers share same examCode or question mapping
  let kr20: number | null = null;
  if (graded.length >= 3) {
    const part1Cols = graded[0].recognition.questions.filter((q) => q.part === 'part1');
    const examCodes = new Set(graded.map((g) => g.examCode));
    if (part1Cols.length >= 2 && examCodes.size === 1) {
      const k = part1Cols.length;
      const totalCorrectPerStudent = graded.map(
        (g) => g.recognition.questions.filter((q) => q.part === 'part1' && q.status === 'correct').length
      );
      const meanCorrect =
        totalCorrectPerStudent.reduce((a, b) => a + b, 0) / totalCorrectPerStudent.length;
      const varTotal =
        totalCorrectPerStudent.reduce((acc, v) => acc + Math.pow(v - meanCorrect, 2), 0) /
        totalCorrectPerStudent.length;

      if (varTotal > 0) {
        let sumPQ = 0;
        for (const qItem of part1Cols) {
          const correctN = graded.filter((g) => {
            const found = g.recognition.questions.find(
              (x) => x.part === 'part1' && x.question === qItem.question
            );
            return found?.status === 'correct';
          }).length;
          const p = correctN / graded.length;
          sumPQ += p * (1 - p);
        }
        kr20 = roundScore((k / (k - 1)) * (1 - sumPQ / varTotal), 3);
      }
    }
  }

  return {
    presentCount: graded.length,
    absentCount,
    mean: roundScore(mean, 2),
    median: roundScore(median, 2),
    max: roundScore(max, 2),
    min: roundScore(min, 2),
    stdDev: roundScore(stdDev, 2),
    passCount,
    passRate: roundScore(passRate, 1),
    histogram: bins,
    kr20,
  };
}

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
  type ExamAnalyticsSummary,
} from './scoring';

export interface DistractorOptionStat {
  option: string;
  count: number;
  rate: number;
  highCount: number;
  lowCount: number;
  isCorrect: boolean;
}

export interface Part1ItemAnalysis {
  part: 'part1';
  question: number;
  label: string;
  correctValue: string;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  correctRate: number;
  avgPoints: number;
  maxPoints: number;
  difficulty: number; // p
  discrimination: number | null; // D (27% upper - 27% lower)
  itemRestCorr: number | null;
  distractors: DistractorOptionStat[];
  warnings: string[];
  topic?: string;
  cognitiveLevel?: string;
}

export interface Part2SubItemStat {
  subItem: 'a' | 'b' | 'c' | 'd';
  correctValue: string;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  correctRate: number;
}

export interface Part2ItemAnalysis {
  part: 'part2';
  question: number;
  label: string;
  correctValue: string;
  subItems: Part2SubItemStat[];
  correctBucketCounts: [number, number, number, number, number]; // 0, 1, 2, 3, 4 right
  avgPoints: number;
  maxPoints: number;
  completionRatio: number; // avgPoints / maxPoints (honors progressive rules)
  discrimination: number | null;
  warnings: string[];
  topic?: string;
  cognitiveLevel?: string;
}

export interface Part3ItemAnalysis {
  part: 'part3';
  question: number;
  label: string;
  correctValue: string;
  correctCount: number;
  wrongCount: number;
  blankCount: number;
  invalidCount: number;
  reviewCount: number;
  correctRate: number;
  avgPoints: number;
  maxPoints: number;
  difficulty: number;
  discrimination: number | null;
  commonWrongAnswers: { value: string; count: number }[];
  warnings: string[];
  topic?: string;
  cognitiveLevel?: string;
}

export interface CodeAnalysisGroup {
  examCode: string;
  sampleCount: number;
  kr20: number | null;
  kr20Note: string;
  part1Items: Part1ItemAnalysis[];
  part2Items: Part2ItemAnalysis[];
  part3Items: Part3ItemAnalysis[];
}

export interface ClassComparisonRow {
  className: string;
  gradedCount: number;
  absentCount: number;
  mean: number;
  median: number;
  max: number;
  min: number;
  passRate: number;
}

export interface ExamCodeComparisonRow {
  examCode: string;
  gradedCount: number;
  mean: number;
  max: number;
  min: number;
  passRate: number;
}

export interface TopicCognitiveStat {
  name: string;
  questionCount: number;
  avgCompletionRate: number;
}

export interface FullAnalyticsReportData {
  summary: ExamAnalyticsSummary;
  totalStudents: number;
  reviewCount: number;
  failCount: number;
  failRate: number;
  partAverages: {
    part1Avg: number;
    part1Max: number;
    part2Avg: number;
    part2Max: number;
    part3Avg: number;
    part3Max: number;
  };
  classComparison: ClassComparisonRow[];
  codeComparison: ExamCodeComparisonRow[];
  codeGroups: CodeAnalysisGroup[];
  topicStats: TopicCognitiveStat[];
  cognitiveStats: TopicCognitiveStat[];
  kr20OverallNote: string;
  rankedSubmissions: {
    submission: ExamSubmission;
    student?: Student;
    rank: number;
  }[];
}

function pearsonCorr(xs: number[], ys: number[]): number | null {
  if (xs.length !== ys.length || xs.length < 4) return null;
  const n = xs.length;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let num = 0;
  let dx2 = 0;
  let dy2 = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx;
    const dy = ys[i] - my;
    num += dx * dy;
    dx2 += dx * dx;
    dy2 += dy * dy;
  }
  const den = Math.sqrt(dx2 * dy2);
  if (den <= 1e-9) return null;
  return roundScore(num / den, 2);
}

function analyzeSingleCodeGroup(
  examCode: string,
  subs: ExamSubmission[],
  ak: AnswerKey | undefined,
  exam: Exam
): CodeAnalysisGroup {
  const n = subs.length;
  const sorted = [...subs].sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total);
  const groupSize = Math.max(1, Math.floor(n * 0.27));
  const upperGroup = sorted.slice(0, groupSize);
  const lowerGroup = sorted.slice(-groupSize);
  const hasDiscrim = n >= 6;

  const specLookup = new Map(
    (exam.questionSpecs || []).map((sp) => [`${sp.part}_${sp.question}`, sp])
  );

  // Determine question counts from AnswerKey or first submission
  const ref = subs[0];
  const p1Nums = Array.from(
    new Set(ref.recognition.questions.filter((q) => q.part === 'part1').map((q) => q.question))
  ).sort((a, b) => a - b);
  const p2Nums = Array.from(
    new Set(ref.recognition.questions.filter((q) => q.part === 'part2').map((q) => q.question))
  ).sort((a, b) => a - b);
  const p3Nums = Array.from(
    new Set(ref.recognition.questions.filter((q) => q.part === 'part3').map((q) => q.question))
  ).sort((a, b) => a - b);

  // Part I analysis (binary scored)
  const part1Items: Part1ItemAnalysis[] = p1Nums.map((qNum) => {
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;
    let ptsSum = 0;
    let maxPts = ak?.part1PointsPerQ ?? 0.25;
    let correctValue = ak?.part1Answers[qNum] || '';
    const optCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const highCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };
    const lowCounts: Record<string, number> = { A: 0, B: 0, C: 0, D: 0 };

    const itemVec: number[] = [];
    const restVec: number[] = [];

    for (const s of subs) {
      const q = s.recognition.questions.find((x) => x.part === 'part1' && x.question === qNum);
      if (!q) continue;
      if (!correctValue && q.correctValue) correctValue = q.correctValue;
      if (q.maxPoints > 0) maxPts = q.maxPoints;
      ptsSum += q.earnedPoints;

      const isCorr = q.status === 'correct' ? 1 : 0;
      itemVec.push(isCorr);
      restVec.push(s.scoreBreakdown.total - q.earnedPoints);

      if (q.status === 'correct') correctCount++;
      else if (q.status === 'blank') blankCount++;
      else wrongCount++;

      const det = (q.detectedValue || '').toUpperCase();
      if (det in optCounts) optCounts[det]++;
    }

    for (const s of upperGroup) {
      const q = s.recognition.questions.find((x) => x.part === 'part1' && x.question === qNum);
      const det = (q?.detectedValue || '').toUpperCase();
      if (det in highCounts) highCounts[det]++;
    }
    for (const s of lowerGroup) {
      const q = s.recognition.questions.find((x) => x.part === 'part1' && x.question === qNum);
      const det = (q?.detectedValue || '').toUpperCase();
      if (det in lowCounts) lowCounts[det]++;
    }

    const p = n > 0 ? roundScore(correctCount / n, 2) : 0;
    let discrimination: number | null = null;
    if (hasDiscrim) {
      const upRate =
        upperGroup.filter(
          (s) =>
            s.recognition.questions.find((x) => x.part === 'part1' && x.question === qNum)
              ?.status === 'correct'
        ).length / upperGroup.length;
      const lowRate =
        lowerGroup.filter(
          (s) =>
            s.recognition.questions.find((x) => x.part === 'part1' && x.question === qNum)
              ?.status === 'correct'
        ).length / lowerGroup.length;
      discrimination = roundScore(upRate - lowRate, 2);
    }

    const itemRestCorr = pearsonCorr(itemVec, restVec);

    const distractors: DistractorOptionStat[] = ['A', 'B', 'C', 'D'].map((opt) => ({
      option: opt,
      count: optCounts[opt],
      rate: n > 0 ? roundScore((optCounts[opt] / n) * 100, 1) : 0,
      highCount: highCounts[opt],
      lowCount: lowCounts[opt],
      isCorrect: opt === correctValue,
    }));

    const warnings: string[] = [];
    if (n >= 5) {
      const unused = distractors.filter((d) => !d.isCorrect && d.rate < 5).map((d) => d.option);
      if (unused.length > 0) {
        warnings.push(`Nhiễu ít được chọn (<5%): ${unused.join(', ')}`);
      }
      const dominantWrong = distractors.filter(
        (d) => !d.isCorrect && d.count > correctCount
      );
      if (dominantWrong.length > 0) {
        warnings.push(
          `Phương án nhiễu ${dominantWrong.map((d) => d.option).join(', ')} được chọn nhiều hơn đáp án đúng`
        );
      }
      if (p < 0.2) {
        warnings.push('Tỉ lệ trả lời đúng rất thấp (<20%), nên kiểm tra lại câu hỏi/đáp án');
      }
      if (discrimination !== null && discrimination < 0) {
        warnings.push('Độ phân biệt âm (cần xem lại câu hỏi/đáp án, không tự kết luận sai)');
      }
      if (upperGroup.length >= 3 && correctValue) {
        const upCorrectRate = (highCounts[correctValue] || 0) / upperGroup.length;
        if (upCorrectRate < 0.4 && p > 0.25) {
          warnings.push('Nhóm điểm cao có tỉ lệ đúng thấp bất thường');
        }
      }
    }

    const sp = specLookup.get(`part1_${qNum}`);
    return {
      part: 'part1',
      question: qNum,
      label: `Câu ${qNum}`,
      correctValue,
      correctCount,
      wrongCount,
      blankCount,
      correctRate: roundScore(p * 100, 1),
      avgPoints: n > 0 ? roundScore(ptsSum / n, 3) : 0,
      maxPoints: maxPts,
      difficulty: p,
      discrimination,
      itemRestCorr,
      distractors,
      warnings,
      topic: sp?.topic,
      cognitiveLevel: sp?.cognitiveLevel,
    };
  });

  // Part II analysis (progressive multi-level per question + per sub-item a,b,c,d)
  const subKeys: ('a' | 'b' | 'c' | 'd')[] = ['a', 'b', 'c', 'd'];
  const part2Items: Part2ItemAnalysis[] = p2Nums.map((qNum) => {
    const bucket: [number, number, number, number, number] = [0, 0, 0, 0, 0];
    let qPtsSum = 0;
    const maxPts =
      ak?.part2ScoringMode === 'progressive_2025'
        ? ak.part2Progressive[4]
        : 4 * (ak?.part2CustomPerItem ?? 0.25);

    const subStats: Part2SubItemStat[] = subKeys.map((sk) => {
      let c = 0;
      let w = 0;
      let b = 0;
      const expBool = ak?.part2Answers[qNum]?.[sk];
      let cVal = expBool === true ? 'Đ' : expBool === false ? 'S' : '';
      for (const s of subs) {
        const item = s.recognition.questions.find(
          (x) => x.part === 'part2' && x.question === qNum && x.subItem === sk
        );
        if (!item) continue;
        if (!cVal && item.correctValue) cVal = item.correctValue;
        if (item.status === 'correct') c++;
        else if (item.status === 'blank') b++;
        else w++;
      }
      return {
        subItem: sk,
        correctValue: cVal,
        correctCount: c,
        wrongCount: w,
        blankCount: b,
        correctRate: n > 0 ? roundScore((c / n) * 100, 1) : 0,
      };
    });

    const getQPointsForSub = (s: ExamSubmission) => {
      const items = s.recognition.questions.filter(
        (x) => x.part === 'part2' && x.question === qNum
      );
      const rightCount = items.filter((x) => x.status === 'correct').length;
      const qPts = items.reduce((sum, x) => sum + (x.earnedPoints || 0), 0);
      return { rightCount: Math.min(4, rightCount), qPts };
    };

    for (const s of subs) {
      const { rightCount, qPts } = getQPointsForSub(s);
      bucket[rightCount]++;
      qPtsSum += qPts;
    }

    const avgPts = n > 0 ? roundScore(qPtsSum / n, 3) : 0;
    const completionRatio = maxPts > 0 ? roundScore(avgPts / maxPts, 2) : 0;

    let discrimination: number | null = null;
    if (hasDiscrim && maxPts > 0) {
      const upAvg =
        upperGroup.reduce((a, s) => a + getQPointsForSub(s).qPts, 0) /
        (upperGroup.length * maxPts);
      const lowAvg =
        lowerGroup.reduce((a, s) => a + getQPointsForSub(s).qPts, 0) /
        (lowerGroup.length * maxPts);
      discrimination = roundScore(upAvg - lowAvg, 2);
    }

    const warnings: string[] = [];
    if (discrimination !== null && discrimination < 0) {
      warnings.push('Độ phân biệt âm (cần rà soát lại các ý a, b, c, d)');
    }
    if (completionRatio < 0.25 && n >= 5) {
      warnings.push('Mức độ hoàn thành câu rất thấp (<25%)');
    }

    const sp = specLookup.get(`part2_${qNum}`);
    return {
      part: 'part2',
      question: qNum,
      label: `Câu ${qNum}`,
      correctValue: subStats.map((st) => `${st.subItem}:${st.correctValue || '-'}`).join(' '),
      subItems: subStats,
      correctBucketCounts: bucket,
      avgPoints: avgPts,
      maxPoints: maxPts,
      completionRatio,
      discrimination,
      warnings,
      topic: sp?.topic,
      cognitiveLevel: sp?.cognitiveLevel,
    };
  });

  // Part III analysis (short numeric answers)
  const part3Items: Part3ItemAnalysis[] = p3Nums.map((qNum) => {
    let correctCount = 0;
    let wrongCount = 0;
    let blankCount = 0;
    let invalidCount = 0;
    let reviewCount = 0;
    let ptsSum = 0;
    let maxPts = ak?.part3PointsPerQ ?? 0.5;
    let correctValue = (ak?.part3Answers[qNum] || []).join(' | ');
    const wrongFreq = new Map<string, number>();

    for (const s of subs) {
      const q = s.recognition.questions.find((x) => x.part === 'part3' && x.question === qNum);
      if (!q) continue;
      if (!correctValue && q.correctValue) correctValue = q.correctValue;
      if (q.maxPoints > 0) maxPts = q.maxPoints;
      ptsSum += q.earnedPoints;

      if (q.status === 'correct') {
        correctCount++;
      } else if (q.status === 'blank') {
        blankCount++;
      } else if (q.status === 'unrecognized') {
        invalidCount++;
        wrongCount++;
      } else if (
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'pending_review'
      ) {
        reviewCount++;
      } else {
        wrongCount++;
        const v = q.detectedValue || '(Trống)';
        wrongFreq.set(v, (wrongFreq.get(v) || 0) + 1);
      }
    }

    const p = n > 0 ? roundScore(correctCount / n, 2) : 0;
    let discrimination: number | null = null;
    if (hasDiscrim) {
      const upR =
        upperGroup.filter(
          (s) =>
            s.recognition.questions.find((x) => x.part === 'part3' && x.question === qNum)
              ?.status === 'correct'
        ).length / upperGroup.length;
      const lowR =
        lowerGroup.filter(
          (s) =>
            s.recognition.questions.find((x) => x.part === 'part3' && x.question === qNum)
              ?.status === 'correct'
        ).length / lowerGroup.length;
      discrimination = roundScore(upR - lowR, 2);
    }

    const commonWrongAnswers = Array.from(wrongFreq.entries())
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    const warnings: string[] = [];
    if (discrimination !== null && discrimination < 0) {
      warnings.push('Độ phân biệt âm (cần xem lại biểu thức/đáp án)');
    }
    if (p < 0.15 && n >= 5) {
      warnings.push('Tỉ lệ trả lời đúng thấp (<15%)');
    }
    if (invalidCount > 0) {
      warnings.push(`Có ${invalidCount} bài tô chuỗi số không hợp lệ`);
    }

    const sp = specLookup.get(`part3_${qNum}`);
    return {
      part: 'part3',
      question: qNum,
      label: `Câu ${qNum}`,
      correctValue,
      correctCount,
      wrongCount,
      blankCount,
      invalidCount,
      reviewCount,
      correctRate: roundScore(p * 100, 1),
      avgPoints: n > 0 ? roundScore(ptsSum / n, 3) : 0,
      maxPoints: maxPts,
      difficulty: p,
      discrimination,
      commonWrongAnswers,
      warnings,
      topic: sp?.topic,
      cognitiveLevel: sp?.cognitiveLevel,
    };
  });

  // KR-20 strictly for binary items (Part I) within this single examCode
  let kr20: number | null = null;
  let kr20Note = '';
  if (p1Nums.length < 2) {
    kr20Note = 'Không đủ số câu nhị phân (cần ≥ 2 câu Phần I).';
  } else if (n < 3) {
    kr20Note = `Cần ≥ 3 bài đã duyệt cùng mã đề ${examCode} (hiện có ${n}).`;
  } else {
    const k = p1Nums.length;
    const scoresPerStudent = subs.map(
      (s) =>
        s.recognition.questions.filter((q) => q.part === 'part1' && q.status === 'correct').length
    );
    const meanC = scoresPerStudent.reduce((a, b) => a + b, 0) / scoresPerStudent.length;
    const varTotal =
      scoresPerStudent.reduce((acc, v) => acc + Math.pow(v - meanC, 2), 0) /
      scoresPerStudent.length;
    if (varTotal <= 0) {
      kr20Note = 'Phương sai tổng điểm Phần I bằng 0 (các bài có số câu đúng giống nhau).';
    } else {
      let sumPQ = 0;
      for (const item of part1Items) {
        const p = item.correctCount / n;
        sumPQ += p * (1 - p);
      }
      kr20 = roundScore((k / (k - 1)) * (1 - sumPQ / varTotal), 3);
      kr20Note = `Tính trên ${k} câu trắc nghiệm nhị phân (Phần I) của ${n} bài mã đề ${examCode}.`;
    }
  }

  return {
    examCode,
    sampleCount: n,
    kr20,
    kr20Note,
    part1Items,
    part2Items,
    part3Items,
  };
}

export function buildFullAnalyticsReportData(params: {
  exam: Exam;
  allSubmissions: ExamSubmission[];
  students: Student[];
  answerKeys: AnswerKey[];
  classFilter: string;
  codeFilter: string;
  passThreshold: number;
}): FullAnalyticsReportData {
  const {
    exam,
    allSubmissions,
    students,
    answerKeys,
    classFilter,
    codeFilter,
    passThreshold,
  } = params;

  const studentById = new Map(students.map((s) => [s.id, s]));
  const studentBySbd = new Map(students.map((s) => [s.sbd, s]));

  // Students belonging to this exam / classFilter
  const scopedStudents = students.filter((st) => {
    if (classFilter !== 'all') return st.className === classFilter;
    if (exam.classNames.length > 0) return exam.classNames.includes(st.className);
    return true;
  });

  const subsInExam = allSubmissions.filter((s) => s.examId === exam.id && !s.isTestSample);

  const filteredSubs = subsInExam.filter((s) => {
    if (codeFilter !== 'all' && s.examCode !== codeFilter) return false;
    if (classFilter !== 'all') {
      const st =
        (s.studentId ? studentById.get(s.studentId) : undefined) || studentBySbd.get(s.sbd);
      if (st?.className !== classFilter) return false;
    }
    return true;
  });

  const gradedSubs = filteredSubs.filter((s) => s.status === 'graded');
  const reviewCount = filteredSubs.filter((s) => s.status === 'needs_review').length;

  const summary = computeExamAnalytics(
    gradedSubs,
    scopedStudents,
    exam.id,
    passThreshold,
    exam.scoreScale
  );

  const failCount = Math.max(0, summary.presentCount - summary.passCount);
  const failRate =
    summary.presentCount > 0 ? roundScore(100 - summary.passRate, 1) : 0;

  // Part averages from gradedSubs & AnswerKeys
  const refKey = answerKeys.find((k) => k.examId === exam.id);
  const part1Max = refKey ? roundScore(refKey.part1Count * refKey.part1PointsPerQ, 2) : 0;
  const part2Max = refKey
    ? roundScore(
        refKey.part2Count *
          (refKey.part2ScoringMode === 'progressive_2025'
            ? refKey.part2Progressive[4]
            : 4 * refKey.part2CustomPerItem),
        2
      )
    : 0;
  const part3Max = refKey ? roundScore(refKey.part3Count * refKey.part3PointsPerQ, 2) : 0;

  const part1Avg =
    gradedSubs.length > 0
      ? roundScore(gradedSubs.reduce((a, s) => a + s.scoreBreakdown.part1, 0) / gradedSubs.length, 2)
      : 0;
  const part2Avg =
    gradedSubs.length > 0
      ? roundScore(gradedSubs.reduce((a, s) => a + s.scoreBreakdown.part2, 0) / gradedSubs.length, 2)
      : 0;
  const part3Avg =
    gradedSubs.length > 0
      ? roundScore(gradedSubs.reduce((a, s) => a + s.scoreBreakdown.part3, 0) / gradedSubs.length, 2)
      : 0;

  // Class comparisons
  const classNamesSet = new Set<string>(exam.classNames);
  for (const s of subsInExam) {
    const st = (s.studentId ? studentById.get(s.studentId) : undefined) || studentBySbd.get(s.sbd);
    if (st?.className) classNamesSet.add(st.className);
  }
  const classComparison: ClassComparisonRow[] = Array.from(classNamesSet)
    .filter((cn) => classFilter === 'all' || cn === classFilter)
    .sort((a, b) => a.localeCompare(b, 'vi'))
    .map((cn) => {
      const clsStudents = students.filter((st) => st.className === cn);
      const clsGraded = gradedSubs.filter((s) => {
        const st = (s.studentId ? studentById.get(s.studentId) : undefined) || studentBySbd.get(s.sbd);
        return st?.className === cn;
      });
      const stats = computeExamAnalytics(
        clsGraded,
        clsStudents,
        exam.id,
        passThreshold,
        exam.scoreScale
      );
      return {
        className: cn,
        gradedCount: stats.presentCount,
        absentCount: stats.absentCount,
        mean: stats.mean,
        median: stats.median,
        max: stats.max,
        min: stats.min,
        passRate: stats.passRate,
      };
    });

  // Exam code comparisons
  const distinctCodes = Array.from(new Set(gradedSubs.map((s) => s.examCode).filter(Boolean))).sort();
  const codeComparison: ExamCodeComparisonRow[] = distinctCodes.map((code) => {
    const cSubs = gradedSubs.filter((s) => s.examCode === code);
    const scores = cSubs.map((s) => s.scoreBreakdown.total);
    const cPass = scores.filter((sc) => sc >= passThreshold).length;
    return {
      examCode: code,
      gradedCount: cSubs.length,
      mean: roundScore(scores.reduce((a, b) => a + b, 0) / Math.max(1, scores.length), 2),
      max: scores.length ? Math.max(...scores) : 0,
      min: scores.length ? Math.min(...scores) : 0,
      passRate: scores.length ? roundScore((cPass / scores.length) * 100, 1) : 0,
    };
  });

  // Per-examCode item & distractor analysis (never merges mismatched examCodes without mapping!)
  const codeGroups: CodeAnalysisGroup[] = distinctCodes.map((code) => {
    const cSubs = gradedSubs.filter((s) => s.examCode === code);
    const ak = answerKeys.find((k) => k.examId === exam.id && k.examCode === code);
    return analyzeSingleCodeGroup(code, cSubs, ak, exam);
  });

  // Topic & cognitive stats ONLY if exam.questionSpecs exists
  const topicStats: TopicCognitiveStat[] = [];
  const cognitiveStats: TopicCognitiveStat[] = [];
  if (exam.questionSpecs && exam.questionSpecs.length > 0 && gradedSubs.length > 0) {
    const topicAgg = new Map<string, { sum: number; count: number; qSet: Set<string> }>();
    const cogAgg = new Map<string, { sum: number; count: number; qSet: Set<string> }>();
    for (const sp of exam.questionSpecs) {
      const qKey = `${sp.part}_${sp.question}`;
      for (const s of gradedSubs) {
        const qs = s.recognition.questions.filter(
          (q) => q.part === sp.part && q.question === sp.question
        );
        if (qs.length === 0) continue;
        const maxP =
          sp.part === 'part2'
            ? (refKey?.part2ScoringMode === 'progressive_2025'
                ? refKey.part2Progressive[4]
                : 4 * (refKey?.part2CustomPerItem ?? 0.25))
            : qs[0].maxPoints || 0.25;
        const earned = qs.reduce((a, b) => a + b.earnedPoints, 0);
        const ratio = maxP > 0 ? Math.min(1, earned / maxP) : 0;

        if (sp.topic.trim()) {
          const cur = topicAgg.get(sp.topic.trim()) || { sum: 0, count: 0, qSet: new Set() };
          cur.sum += ratio;
          cur.count += 1;
          cur.qSet.add(qKey);
          topicAgg.set(sp.topic.trim(), cur);
        }
        if (sp.cognitiveLevel) {
          const cur = cogAgg.get(sp.cognitiveLevel) || { sum: 0, count: 0, qSet: new Set() };
          cur.sum += ratio;
          cur.count += 1;
          cur.qSet.add(qKey);
          cogAgg.set(sp.cognitiveLevel, cur);
        }
      }
    }
    for (const [name, v] of topicAgg.entries()) {
      topicStats.push({
        name,
        questionCount: v.qSet.size,
        avgCompletionRate: roundScore((v.sum / Math.max(1, v.count)) * 100, 1),
      });
    }
    const cogOrder = ['NB', 'TH', 'VD', 'VDC'];
    for (const lvl of cogOrder) {
      const v = cogAgg.get(lvl);
      if (v) {
        cognitiveStats.push({
          name:
            lvl === 'NB'
              ? 'Nhận biết'
              : lvl === 'TH'
              ? 'Thông hiểu'
              : lvl === 'VD'
              ? 'Vận dụng'
              : 'Vận dụng cao',
          questionCount: v.qSet.size,
          avgCompletionRate: roundScore((v.sum / Math.max(1, v.count)) * 100, 1),
        });
      }
    }
  }

  let kr20OverallNote = '';
  if (gradedSubs.length < 3) {
    kr20OverallNote = 'Cần tối thiểu 3 bài đã duyệt cùng mã đề để tính KR-20.';
  } else if (distinctCodes.length > 1) {
    kr20OverallNote = 'Kỳ thi có nhiều mã đề — xem chỉ số KR-20 Phần I riêng theo từng mã đề bên dưới (không gộp đề có điểm lũy tiến).';
  } else if (codeGroups[0]) {
    kr20OverallNote = codeGroups[0].kr20Note;
  }

  const ranks = computeCompetitionRanks(gradedSubs);
  const rankedSubmissions = [...gradedSubs]
    .sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total)
    .map((sub) => ({
      submission: sub,
      student:
        (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
        studentBySbd.get(sub.sbd),
      rank: ranks.get(sub.id) ?? 1,
    }));

  return {
    summary,
    totalStudents: scopedStudents.length,
    reviewCount,
    failCount,
    failRate,
    partAverages: {
      part1Avg,
      part1Max,
      part2Avg,
      part2Max,
      part3Avg,
      part3Max,
    },
    classComparison,
    codeComparison,
    codeGroups,
    topicStats,
    cognitiveStats,
    kr20OverallNote,
    rankedSubmissions,
  };
}

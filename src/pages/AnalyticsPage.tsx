import React, { useEffect, useMemo, useState } from 'react';
import { Award, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeExamAnalytics, roundScore } from '../engine/scoring';

export const AnalyticsPage: React.FC = () => {
  const { activeExam, students, submissions, setActivePage } = useApp();
  const [customThreshold, setCustomThreshold] = useState<number>(
    activeExam?.passThreshold ?? 5.0
  );
  const [selectedCodeFilter, setSelectedCodeFilter] = useState<string>('all');
  const [showHonorBoard, setShowHonorBoard] = useState(false);
  const [topN, setTopN] = useState<3 | 5 | 10>(5);

  useEffect(() => {
    setCustomThreshold(activeExam?.passThreshold ?? 5.0);
    setSelectedCodeFilter('all');
  }, [activeExam?.id, activeExam?.passThreshold]);

  const examSubs = useMemo(() => {
    if (!activeExam) return [];
    return submissions.filter(
      (s) => s.examId === activeExam.id && s.status === 'graded' && !s.isTestSample
    );
  }, [submissions, activeExam]);

  const distinctCodes = useMemo(
    () => Array.from(new Set(examSubs.map((s) => s.examCode).filter(Boolean))),
    [examSubs]
  );

  const scopedSubs = useMemo(() => {
    if (selectedCodeFilter === 'all') return examSubs;
    return examSubs.filter((s) => s.examCode === selectedCodeFilter);
  }, [examSubs, selectedCodeFilter]);

  const analytics = useMemo(() => {
    if (!activeExam) return null;
    return computeExamAnalytics(
      scopedSubs,
      students,
      activeExam.id,
      customThreshold,
      activeExam.scoreScale
    );
  }, [scopedSubs, students, activeExam, customThreshold]);

  // Item analysis computed strictly per examCode (unless only 1 code present)
  const itemAnalysis = useMemo(() => {
    if (scopedSubs.length === 0) return [];
    const codesPresent = new Set(scopedSubs.map((s) => s.examCode));
    if (codesPresent.size > 1) return []; // Do not merge mismatched item positions across exam codes without mapping

    // Sort submissions by total score to compute upper/lower 27% discrimination index
    const sorted = [...scopedSubs].sort(
      (a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total
    );
    const groupSize = Math.max(1, Math.floor(sorted.length * 0.27));
    const upperGroup = sorted.slice(0, groupSize);
    const lowerGroup = sorted.slice(-groupSize);

    const refQuestions = sorted[0].recognition.questions;
    return refQuestions.map((rq) => {
      const match = (s: (typeof sorted)[number]) =>
        s.recognition.questions.find(
          (q) =>
            q.part === rq.part &&
            q.question === rq.question &&
            (q.subItem || '') === (rq.subItem || '')
        );

      let correct = 0;
      let blank = 0;
      const distCounts: Record<string, number> = {};

      for (const s of scopedSubs) {
        const q = match(s);
        if (!q) continue;
        if (q.status === 'correct') correct++;
        if (q.status === 'blank') blank++;
        if (q.detectedValue) {
          distCounts[q.detectedValue] = (distCounts[q.detectedValue] || 0) + 1;
        }
      }

      const difficulty = roundScore(correct / scopedSubs.length, 2);
      const blankRate = roundScore((blank / scopedSubs.length) * 100, 1);

      let discrimination: number | null = null;
      if (sorted.length >= 6) {
        const upC = upperGroup.filter((s) => match(s)?.status === 'correct').length / upperGroup.length;
        const lowC = lowerGroup.filter((s) => match(s)?.status === 'correct').length / lowerGroup.length;
        discrimination = roundScore(upC - lowC, 2);
      }

      const lowDistractors =
        rq.part === 'part1'
          ? ['A', 'B', 'C', 'D'].filter(
              (opt) =>
                opt !== rq.correctValue &&
                (distCounts[opt] || 0) / scopedSubs.length < 0.05
            )
          : [];

      const warning =
        discrimination !== null && discrimination < 0
          ? 'Độ phân biệt âm (cần xem lại câu hỏi/đáp án, không tự kết luận sai chỉ từ 1 chỉ số)'
          : difficulty < 0.15
          ? 'Tỉ lệ đúng rất thấp (<15%)'
          : difficulty > 0.95
          ? 'Câu hỏi quá dễ (>95% đúng)'
          : null;

      return {
        label:
          rq.part === 'part1'
            ? `P.I Câu ${rq.question}`
            : rq.part === 'part2'
            ? `P.II C${rq.question}.${rq.subItem}`
            : `P.III Câu ${rq.question}`,
        part: rq.part,
        correctRate: roundScore(difficulty * 100, 1),
        difficulty,
        discrimination,
        blankRate,
        distCounts,
        lowDistractors,
        warning,
      };
    });
  }, [scopedSubs]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);

  const honorList = useMemo(() => {
    return [...examSubs]
      .sort((a, b) => b.scoreBreakdown.total - a.scoreBreakdown.total)
      .slice(0, topN);
  }, [examSubs, topN]);

  if (!activeExam || !analytics) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3">
        <h2 className="text-base font-semibold">Chưa chọn kỳ kiểm tra</h2>
        <button
          type="button"
          onClick={() => setActivePage('exams')}
          className="px-4 py-2 bg-[#2563EB] text-white text-xs font-medium rounded-md"
        >
          Chọn kỳ kiểm tra
        </button>
      </div>
    );
  }

  const maxHist = Math.max(1, ...analytics.histogram.map((h) => h.count));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Thống kê và phân tích chất lượng đề</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeExam.name} ({activeExam.subject}) · Tính toán từ dữ liệu bài thi đã kiểm duyệt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <label className="flex items-center gap-1.5 bg-white border border-slate-200 rounded px-2.5 py-1.5">
            <span>Ngưỡng đạt:</span>
            <input
              type="number"
              step="0.25"
              value={customThreshold}
              onChange={(e) => setCustomThreshold(Number(e.target.value) || 0)}
              className="w-14 px-1.5 py-0.5 border border-slate-300 rounded font-mono-num"
            />
          </label>
          <select
            value={selectedCodeFilter}
            onChange={(e) => setSelectedCodeFilter(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded bg-white"
          >
            <option value="all">Tất cả mã đề</option>
            {distinctCodes.map((c) => (
              <option key={c} value={c}>
                Mã đề {c}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Descriptive Statistics Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {[
          { label: 'Dự thi', val: analytics.presentCount },
          { label: 'Vắng thi', val: analytics.absentCount },
          { label: 'Điểm TB', val: analytics.presentCount ? analytics.mean : '—' },
          { label: 'Trung vị', val: analytics.presentCount ? analytics.median : '—' },
          { label: 'Cao nhất', val: analytics.presentCount ? analytics.max : '—' },
          { label: 'Thấp nhất', val: analytics.presentCount ? analytics.min : '—' },
          { label: 'Độ lệch chuẩn', val: analytics.presentCount ? analytics.stdDev : '—' },
          { label: 'Tỉ lệ đạt', val: analytics.presentCount ? `${analytics.passRate}%` : '—' },
        ].map((item) => (
          <div key={item.label} className="bg-white border border-slate-200 rounded-lg p-3">
            <div className="text-[11px] text-slate-500">{item.label}</div>
            <div className="text-lg font-bold font-mono-num text-[#1E293B] mt-0.5">
              {item.val}
            </div>
          </div>
        ))}
      </div>

      {/* Histogram + KR-20 */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-8 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1E293B]">Phổ điểm</h2>
            <span className="text-xs text-slate-500 font-mono-num">
              KR-20: {analytics.kr20 !== null ? analytics.kr20 : 'Cần ≥ 3 bài cùng mã đề Phần I'}
            </span>
          </div>
          {analytics.presentCount === 0 ? (
            <div className="py-8 text-center text-xs text-slate-500">Chưa có dữ liệu bài thi.</div>
          ) : (
            <div className="space-y-2">
              {analytics.histogram.map((h) => (
                <div key={h.label} className="flex items-center gap-3 text-xs">
                  <span className="w-16 font-mono-num text-slate-600">{h.label}</span>
                  <div className="flex-1 h-5 bg-slate-100 rounded overflow-hidden">
                    <div
                      className="h-full bg-[#2563EB] rounded"
                      style={{ width: `${Math.round((h.count / maxHist) * 100)}%` }}
                    />
                  </div>
                  <span className="w-10 text-right font-mono-num font-medium">{h.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Optional Gold Honor Board (hidden by default for student privacy) */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-[#1E293B]">
              <Award className="w-4 h-4 text-amber-500" />
              Bảng vàng thành tích
            </div>
            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showHonorBoard}
                onChange={(e) => setShowHonorBoard(e.target.checked)}
              />
              Hiển thị
            </label>
          </div>
          {!showHonorBoard ? (
            <p className="text-xs text-slate-500 leading-relaxed">
              Bảng vàng được ẩn mặc định để bảo vệ quyền riêng tư học sinh. Bật tùy chọn Hiển thị khi cần vinh danh Top 3 / Top 5 / Top 10.
            </p>
          ) : (
            <div className="space-y-2 text-xs">
              <div className="flex gap-1">
                {([3, 5, 10] as const).map((n) => (
                  <button
                    key={n}
                    type="button"
                    onClick={() => setTopN(n)}
                    className={`px-2.5 py-1 rounded ${
                      topN === n ? 'bg-[#2563EB] text-white' : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    Top {n}
                  </button>
                ))}
              </div>
              <div className="divide-y divide-slate-100">
                {honorList.map((sub, i) => {
                  const st =
                    (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
                    studentBySbd.get(sub.sbd);
                  return (
                    <div key={sub.id} className="py-1.5 flex items-center justify-between">
                      <span>
                        <strong className="font-mono-num mr-1.5">#{i + 1}</strong>
                        {st?.fullName || `SBD ${sub.sbd}`}
                      </span>
                      <span className="font-mono-num font-bold text-[#16A34A]">
                        {sub.scoreBreakdown.total}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Item Quality Analysis Table */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
        <h2 className="text-sm font-semibold text-[#1E293B]">Phân tích chất lượng từng câu hỏi</h2>
        {distinctCodes.length > 1 && selectedCodeFilter === 'all' ? (
          <div className="p-3 rounded bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>
              Kỳ thi có nhiều mã đề ({distinctCodes.join(', ')}). Vui lòng chọn từng mã đề ở bộ lọc phía trên để phân tích chính xác độ khó, độ phân biệt và phương án nhiễu của từng câu.
            </span>
          </div>
        ) : itemAnalysis.length === 0 ? (
          <div className="text-xs text-slate-500 py-4 text-center">
            Chưa có đủ dữ liệu câu hỏi để phân tích.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Câu / Ý</th>
                  <th className="py-2 px-3 font-semibold text-right">Tỉ lệ đúng</th>
                  <th className="py-2 px-3 font-semibold text-right">Độ khó (p)</th>
                  <th className="py-2 px-3 font-semibold text-right">Độ phân biệt (D)</th>
                  <th className="py-2 px-3 font-semibold text-right">Bỏ trống</th>
                  <th className="py-2 px-3 font-semibold">Phân bố phương án / Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {itemAnalysis.map((it) => (
                  <tr key={it.label} className="hover:bg-slate-50/70">
                    <td className="py-2 px-3 font-mono-num font-semibold">{it.label}</td>
                    <td className="py-2 px-3 font-mono-num text-right">{it.correctRate}%</td>
                    <td className="py-2 px-3 font-mono-num text-right">{it.difficulty}</td>
                    <td className="py-2 px-3 font-mono-num text-right">
                      {it.discrimination !== null ? it.discrimination : '—'}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-right">{it.blankRate}%</td>
                    <td className="py-2 px-3">
                      <div className="font-mono-num text-[11px] text-slate-600">
                        {Object.entries(it.distCounts)
                          .map(([opt, cnt]) => `${opt}:${cnt}`)
                          .join(' · ') || '—'}
                      </div>
                      {it.lowDistractors.length > 0 && (
                        <div className="text-[11px] text-slate-500">
                          Nhiễu ít chọn (&lt;5%): {it.lowDistractors.join(', ')}
                        </div>
                      )}
                      {it.warning && (
                        <div className="text-[11px] text-amber-700 font-medium">{it.warning}</div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

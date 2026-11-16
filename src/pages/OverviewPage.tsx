import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  BookOpen,
  CalendarPlus,
  Camera,
  CheckCircle2,
  CheckSquare,
  FileCheck2,
  FileImage,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { computeExamAnalytics } from '../engine/scoring';

export const OverviewPage: React.FC = () => {
  const {
    dataScope,
    setDataScope,
    starterSeedingStatus,
    exams,
    activeExam,
    students,
    submissions,
    setActivePage,
    setActiveExamId,
    openReviewSubmission,
  } = useApp();

  const realSubs = useMemo(
    () => submissions.filter((s) => !s.isTestSample),
    [submissions]
  );

  // Scope stats cleanly: overall across active dataScope + focused exam analytics
  const examSubs = useMemo(
    () => (activeExam ? realSubs.filter((s) => s.examId === activeExam.id) : realSubs),
    [realSubs, activeExam]
  );

  const totalExams = exams.length;
  const totalStudents = students.length;
  const totalSubmissions = realSubs.length;
  const gradedAll = useMemo(
    () => realSubs.filter((s) => s.status === 'graded'),
    [realSubs]
  );
  const reviewList = useMemo(
    () => realSubs.filter((s) => s.status === 'needs_review'),
    [realSubs]
  );
  const gradedCount = gradedAll.length;
  const reviewCount = reviewList.length;

  const threshold = activeExam?.passThreshold ?? 5.0;
  const activeAnalytics = useMemo(() => {
    if (!activeExam) return null;
    const activeGraded = examSubs.filter((s) => s.status === 'graded');
    if (activeGraded.length === 0) return null;
    return computeExamAnalytics(
      realSubs,
      students,
      activeExam.id,
      threshold,
      activeExam.scoreScale
    );
  }, [activeExam, examSubs, realSubs, students, threshold]);

  // Dynamic KPI aggregates (computed strictly from IndexedDB submissions)
  const avgScore = useMemo(() => {
    if (activeAnalytics && activeAnalytics.presentCount > 0) return activeAnalytics.mean;
    if (gradedAll.length === 0) return null;
    const sum = gradedAll.reduce((a, b) => a + b.scoreBreakdown.total, 0);
    return Math.round((sum / gradedAll.length) * 100) / 100;
  }, [activeAnalytics, gradedAll]);

  const maxScore = useMemo(() => {
    if (activeAnalytics && activeAnalytics.presentCount > 0) return activeAnalytics.max;
    if (gradedAll.length === 0) return null;
    return Math.max(...gradedAll.map((s) => s.scoreBreakdown.total));
  }, [activeAnalytics, gradedAll]);

  const passRate = useMemo(() => {
    if (activeAnalytics && activeAnalytics.presentCount > 0) return activeAnalytics.passRate;
    if (gradedAll.length === 0) return null;
    const passed = gradedAll.filter((s) => s.scoreBreakdown.total >= threshold).length;
    return Math.round((passed / gradedAll.length) * 1000) / 10;
  }, [activeAnalytics, gradedAll, threshold]);

  // Histogram across active exam or all graded submissions in scope
  const histogram = useMemo(() => {
    if (activeAnalytics && activeAnalytics.histogram.length > 0) {
      return activeAnalytics.histogram;
    }
    const bins = [
      { label: '0 – <2', min: 0, max: 2, count: 0 },
      { label: '2 – <4', min: 2, max: 4, count: 0 },
      { label: '4 – <5', min: 4, max: 5, count: 0 },
      { label: '5 – <6.5', min: 5, max: 6.5, count: 0 },
      { label: '6.5 – <8', min: 6.5, max: 8, count: 0 },
      { label: '8 – <9', min: 8, max: 9, count: 0 },
      { label: '9 – 10', min: 9, max: 10.01, count: 0 },
    ];
    for (const s of gradedAll) {
      const sc = s.scoreBreakdown.total;
      const bin = bins.find((b) => sc >= b.min && sc < b.max) || bins[bins.length - 1];
      bin.count += 1;
    }
    return bins;
  }, [activeAnalytics, gradedAll]);

  const maxBin = Math.max(1, ...histogram.map((h) => h.count));
  const progressPct =
    totalSubmissions > 0 ? Math.round((gradedCount / totalSubmissions) * 100) : 0;

  const examProgressList = useMemo(() => {
    return exams.slice(0, 5).map((ex) => {
      const subs = realSubs.filter((s) => s.examId === ex.id);
      const graded = subs.filter((s) => s.status === 'graded').length;
      const review = subs.filter((s) => s.status === 'needs_review').length;
      return {
        exam: ex,
        total: subs.length,
        graded,
        review,
        pct: subs.length > 0 ? Math.round((graded / subs.length) * 100) : 0,
      };
    });
  }, [exams, realSubs]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);
  const examById = useMemo(() => new Map(exams.map((e) => [e.id, e])), [exams]);

  return (
    <div className="space-y-5">
      {/* Welcome Banner */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-2 text-xs font-semibold text-[#2563EB]">
            <GraduationCap className="w-4 h-4" />
            <span>
              {dataScope === 'practice'
                ? 'Không gian dữ liệu thực hành tích hợp sẵn'
                : 'Không gian dữ liệu chính thức của giáo viên'}
            </span>
          </div>
          <h1 className="text-[20px] lg:text-[22px] font-bold text-[#1E293B] leading-snug">
            Chào mừng quý Thầy Cô đến với Chấm Thi Thông Minh
          </h1>
          <p className="text-[13px] text-slate-600 max-w-2xl">
            Chấm nhanh – Chính xác – Bảo mật – Miễn phí · Xử lý 100% cục bộ bằng OpenCV.js WebAssembly
            {activeExam ? ` · Kỳ thi đang chọn: ${activeExam.name}` : ''}.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          <button
            type="button"
            onClick={() => setActivePage('camera')}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-md bg-[#2563EB] text-white text-[13px] font-medium hover:bg-blue-700 transition-colors whitespace-nowrap"
          >
            <Camera className="w-4 h-4" />
            Chấm bằng Camera
          </button>
          <button
            type="button"
            onClick={() => setActivePage('batch')}
            className="inline-flex items-center gap-2 px-4 py-2.5 min-h-[40px] rounded-md bg-[#16A34A] text-white text-[13px] font-medium hover:bg-green-700 transition-colors whitespace-nowrap"
          >
            <FileImage className="w-4 h-4" />
            Chấm PDF & Bộ 135 phiếu
          </button>
          {dataScope === 'official' && exams.length === 0 && (
            <button
              type="button"
              onClick={() => setDataScope('practice')}
              className="inline-flex items-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-md border border-slate-300 bg-white text-[#1E293B] text-[13px] font-medium hover:bg-slate-50 transition-colors whitespace-nowrap"
            >
              Mở dữ liệu thực hành
            </button>
          )}
        </div>
      </div>

      {starterSeedingStatus?.active && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 flex items-center justify-between gap-3 text-[13px] text-blue-900">
          <div className="flex items-center gap-2.5">
            <RefreshCw className="w-4 h-4 animate-spin text-[#2563EB] shrink-0" />
            <span>
              Đang chấm tự động bộ phiếu khởi đầu qua OpenCV.js ({starterSeedingStatus.done}/
              {starterSeedingStatus.total} bài) để hiển thị số liệu thực tế...
            </span>
          </div>
          <span className="font-mono-num font-semibold text-[#2563EB]">
            {Math.round((starterSeedingStatus.done / Math.max(1, starterSeedingStatus.total)) * 100)}%
          </span>
        </div>
      )}

      {/* Dynamic 8 KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Kỳ kiểm tra</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#1E293B]">
            {totalExams}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Hồ sơ học sinh</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#1E293B]">
            {totalStudents}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Tổng số bài thi</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#1E293B]">
            {totalSubmissions}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Số bài đã chấm</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#16A34A]">
            {gradedCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Chờ kiểm duyệt</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-amber-600">
            {reviewCount}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">
            Điểm trung bình {activeExam ? `(${activeExam.subject})` : ''}
          </div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#2563EB]">
            {avgScore !== null ? avgScore : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Điểm cao nhất</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#1E293B]">
            {maxScore !== null ? maxScore : '—'}
          </div>
        </div>
        <div className="bg-white border border-slate-200 rounded-lg p-4">
          <div className="text-xs font-medium text-slate-500">Tỉ lệ đạt (&ge; {threshold})</div>
          <div className="text-[26px] leading-tight font-bold font-mono-num mt-1.5 text-[#16A34A]">
            {passRate !== null ? `${passRate}%` : '—'}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white border border-slate-200 rounded-lg p-4">
        <h2 className="text-sm font-semibold text-[#1E293B] mb-3">Thao tác nhanh</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          {[
            { id: 'exams' as const, label: 'Kỳ kiểm tra', icon: CalendarPlus },
            { id: 'templates' as const, label: 'Mẫu phiếu thi', icon: FolderKanban },
            { id: 'answers' as const, label: 'Đáp án & thang điểm', icon: CheckSquare },
            { id: 'batch' as const, label: 'Chấm PDF / Ảnh', icon: FileImage },
            { id: 'gradebook' as const, label: 'Bảng điểm', icon: FileSpreadsheet },
            { id: 'analytics' as const, label: 'Phân tích đề', icon: BarChart3 },
          ].map((btn) => {
            const Icon = btn.icon;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={() => setActivePage(btn.id)}
                className="flex items-center gap-2 px-3 py-2.5 min-h-[40px] rounded-md border border-slate-200 bg-slate-50/70 hover:bg-blue-50 hover:border-blue-200 hover:text-[#2563EB] text-[13px] font-medium text-[#1E293B] transition-colors text-left"
              >
                <Icon className="w-4 h-4 shrink-0 text-[#2563EB]" />
                <span className="truncate">{btn.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Charts Row: Score Histogram + Grading Progress */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="text-sm font-semibold text-[#1E293B]">
                Phổ điểm {activeExam ? `– ${activeExam.name}` : ''}
              </h2>
              <p className="text-xs text-slate-500">
                Chỉ tính từ bài thi đã chấm hoàn tất và kiểm duyệt trong IndexedDB
              </p>
            </div>
            <button
              type="button"
              onClick={() => setActivePage('analytics')}
              className="inline-flex items-center gap-1 text-xs font-medium text-[#2563EB] hover:underline"
            >
              Phân tích chi tiết <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {gradedCount === 0 ? (
            <div className="py-10 text-center space-y-2.5">
              <p className="text-[13px] text-slate-600">
                {exams.length === 0
                  ? 'Chưa có kỳ kiểm tra trong mục Dữ liệu của tôi. Hãy tạo kỳ kiểm tra mới hoặc dùng Bộ dữ liệu thực hành.'
                  : 'Chưa có bài thi nào được chấm trong kỳ kiểm tra này.'}
              </p>
              <button
                type="button"
                onClick={() => setActivePage(exams.length === 0 ? 'exams' : 'batch')}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
              >
                {exams.length === 0 ? 'Tạo kỳ kiểm tra ngay' : 'Chấm thử phiếu thi ngay'}
              </button>
            </div>
          ) : (
            <div className="space-y-2.5">
              {histogram.map((bin) => {
                const widthPct = Math.round((bin.count / maxBin) * 100);
                return (
                  <div key={bin.label} className="flex items-center gap-3 text-xs">
                    <span className="w-16 font-mono-num text-slate-600 shrink-0">{bin.label}</span>
                    <div className="flex-1 h-6 bg-slate-100 rounded overflow-hidden">
                      <div
                        className="h-full bg-[#2563EB] rounded transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                    <span className="w-10 text-right font-mono-num font-semibold text-[#1E293B]">
                      {bin.count}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Grading Progress Chart */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-[#1E293B]">Tiến độ chấm bài</h2>
            <span className="text-xs font-mono-num font-semibold text-[#16A34A]">
              {gradedCount}/{totalSubmissions} ({progressPct}%)
            </span>
          </div>

          <div className="space-y-1.5">
            <div className="w-full h-3 bg-slate-100 rounded-full overflow-hidden flex">
              <div
                className="h-full bg-[#16A34A] transition-all"
                style={{ width: `${progressPct}%` }}
              />
              <div
                className="h-full bg-amber-400 transition-all"
                style={{
                  width: `${
                    totalSubmissions > 0 ? Math.round((reviewCount / totalSubmissions) * 100) : 0
                  }%`,
                }}
              />
            </div>
            <div className="flex items-center justify-between text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-[#16A34A]" />
                Đã duyệt: <strong className="font-mono-num">{gradedCount}</strong>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                Chờ duyệt: <strong className="font-mono-num">{reviewCount}</strong>
              </span>
            </div>
          </div>

          <div className="pt-2 border-t border-slate-100 space-y-2.5">
            <div className="text-xs font-semibold text-slate-600">Theo từng kỳ kiểm tra</div>
            {examProgressList.length === 0 ? (
              <div className="text-xs text-slate-400 py-3">Chưa có kỳ kiểm tra.</div>
            ) : (
              examProgressList.map((row) => (
                <div key={row.exam.id} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <button
                      type="button"
                      onClick={() => setActiveExamId(row.exam.id)}
                      className={`truncate text-left font-medium hover:text-[#2563EB] ${
                        activeExam?.id === row.exam.id ? 'text-[#2563EB]' : 'text-[#1E293B]'
                      }`}
                    >
                      {row.exam.name}
                    </button>
                    <span className="font-mono-num text-slate-600 shrink-0 ml-2">
                      {row.graded} đạt / {row.review} duyệt
                    </span>
                  </div>
                  <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden flex">
                    <div
                      className="h-full bg-[#16A34A]"
                      style={{
                        width: `${row.total ? Math.round((row.graded / row.total) * 100) : 0}%`,
                      }}
                    />
                    <div
                      className="h-full bg-amber-400"
                      style={{
                        width: `${row.total ? Math.round((row.review / row.total) * 100) : 0}%`,
                      }}
                    />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: Recent Exams & Pending Review Queue */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Recent Exams */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1E293B]">Kỳ kiểm tra gần đây</h2>
            <button
              type="button"
              onClick={() => setActivePage('exams')}
              className="text-xs text-[#2563EB] hover:underline font-medium"
            >
              Quản lý tất cả
            </button>
          </div>
          {exams.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">Chưa có kỳ kiểm tra nào.</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {exams.slice(0, 6).map((ex) => {
                const count = realSubs.filter((s) => s.examId === ex.id).length;
                const isSelected = activeExam?.id === ex.id;
                return (
                  <div key={ex.id} className="py-2.5 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setActiveExamId(ex.id)}
                      className="text-left min-w-0 flex-1"
                    >
                      <div
                        className={`text-[13px] font-semibold truncate ${
                          isSelected ? 'text-[#2563EB]' : 'text-[#1E293B]'
                        }`}
                      >
                        {ex.name}
                      </div>
                      <div className="text-xs text-slate-500 truncate mt-0.5">
                        {ex.subject} · Khối {ex.gradeLevel} · Lớp {ex.classNames.join(', ') || '—'} ·{' '}
                        <span className="font-mono-num">{count} bài</span>
                      </div>
                    </button>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExamId(ex.id);
                          setActivePage('gradebook');
                        }}
                        className="px-2.5 py-1.5 rounded border border-slate-200 text-xs font-medium text-slate-700 hover:text-[#2563EB] hover:border-blue-200 whitespace-nowrap"
                      >
                        Bảng điểm
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveExamId(ex.id);
                          setActivePage('report-cards');
                        }}
                        className="p-1.5 rounded border border-slate-200 text-slate-600 hover:text-[#2563EB]"
                        title="Phiếu trả bài"
                      >
                        <BookOpen className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Pending Review Submissions */}
        <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold text-[#1E293B]">
              Bài thi cần kiểm duyệt ({reviewCount})
            </h2>
            <button
              type="button"
              onClick={() => setActivePage('review')}
              className="text-xs text-[#2563EB] hover:underline font-medium"
            >
              Mở hàng chờ kiểm duyệt
            </button>
          </div>
          {reviewList.length === 0 ? (
            <div className="py-6 text-center text-xs text-slate-500">
              Không có bài thi nào đang chờ kiểm duyệt.
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {reviewList.slice(0, 6).map((sub) => {
                const st =
                  (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
                  studentBySbd.get(sub.sbd);
                const ex = examById.get(sub.examId);
                return (
                  <div key={sub.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] font-semibold text-[#1E293B] truncate">
                        {st?.fullName || `SBD ${sub.sbd || '???'}`}{' '}
                        <span className="font-mono-num text-xs text-slate-500 font-normal">
                          · SBD {sub.sbd} · Mã đề {sub.examCode || '???'}
                        </span>
                      </div>
                      <div className="text-xs text-[#DC2626] truncate mt-0.5">
                        {ex ? `${ex.subject}: ` : ''}
                        {sub.reviewReasons[0] || 'Cần kiểm tra thủ công'}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openReviewSubmission(sub.id, sub.examId)}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-amber-50 border border-amber-200 text-amber-800 text-xs font-medium hover:bg-amber-100 whitespace-nowrap shrink-0"
                    >
                      <FileCheck2 className="w-3.5 h-3.5" />
                      Kiểm duyệt
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

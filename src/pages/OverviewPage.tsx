import React, { useMemo } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarPlus,
  CheckCircle2,
  Users,
  Settings2,
  ClipboardList,
  Lightbulb,
  FileCheck2,
  FileImage,
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
  const hasExams = totalExams > 0;
  const hasSubmissions = realSubs.length > 0;
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
      {/* Compact heading: one clear action per data state. */}
      <div className="bg-white border border-slate-200 rounded-xl px-5 py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 text-[13px] font-semibold text-blue-700">
            <GraduationCap className="w-4 h-4" />
            {dataScope === 'practice' ? 'Dữ liệu thực hành' : 'Dữ liệu của tôi'}
          </div>
          <h1 className="text-[22px] font-bold text-slate-900 mt-1">Tổng quan chấm thi</h1>
          <p className="text-[14px] text-slate-600 mt-1 leading-relaxed">
            {activeExam ? `Kỳ kiểm tra đang chọn: ${activeExam.name}` :
              !hasExams ? 'Chưa có kỳ kiểm tra. Chọn một chức năng bên dưới để bắt đầu.' :
              !hasSubmissions ? 'Đã có kỳ kiểm tra. Hãy chuẩn bị đáp án và bắt đầu chấm bài.' :
              'Theo dõi kết quả chấm thi và các bài cần kiểm duyệt.'}
          </p>
        </div>
        {!hasExams ? (
          <button type="button" onClick={() => setActivePage('exams')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-blue-700 min-h-[44px]">
            <CalendarPlus className="w-4 h-4" /> Tạo kỳ kiểm tra
          </button>
        ) : (
          <button type="button" onClick={() => setActivePage('batch')}
            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-3 text-[14px] font-semibold text-white hover:bg-blue-700 min-h-[44px]">
            <FileImage className="w-4 h-4" /> Chấm PDF / Ảnh
          </button>
        )}
      </div>

      {/* New users see a useful starting point instead of eight zeros and empty charts. */}
      {!hasExams && (
        <section className="bg-white border border-slate-200 rounded-xl p-5 sm:p-6 space-y-5">
          <div className="max-w-2xl">
            <h2 className="text-[19px] font-bold text-slate-900">Bắt đầu với Chấm Thi Thông Minh</h2>
            <p className="text-[15px] leading-relaxed text-slate-600 mt-2">
              Tạo kỳ kiểm tra đầu tiên, chuẩn bị phiếu hoặc khám phá dữ liệu thực hành. Các biểu đồ sẽ xuất hiện khi có bài thi đã được duyệt.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
            {[
              { id: 'exams' as const, icon: CalendarPlus, title: 'Kỳ kiểm tra', detail: 'Tạo kỳ kiểm tra, chọn môn và lớp học', color: 'text-blue-700 bg-blue-50' },
              { id: 'templates' as const, icon: FileCheck2, title: 'Mẫu phiếu thi', detail: 'Xem rõ, tải và in phiếu trả lời', color: 'text-emerald-700 bg-emerald-50' },
              { id: 'classes' as const, icon: Users, title: 'Lớp học & SBD', detail: 'Nhập học sinh và quản lý số báo danh', color: 'text-orange-700 bg-orange-50' },
              { id: 'settings' as const, icon: Settings2, title: 'Cài đặt hệ thống', detail: 'Thiết lập nhận diện và chế độ hiển thị', color: 'text-violet-700 bg-violet-50' },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button key={item.id} type="button" onClick={() => setActivePage(item.id)}
                  className="text-left rounded-xl border border-slate-200 bg-white p-4 min-h-[146px] hover:border-blue-300 hover:shadow-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 transition-all">
                  <span className={`inline-flex p-2 rounded-lg ${item.color}`}><Icon className="w-5 h-5" /></span>
                  <span className="block mt-3 text-[15px] font-semibold text-slate-900">{item.title}</span>
                  <span className="block mt-1 text-[14px] leading-relaxed text-slate-600">{item.detail}</span>
                </button>
              );
            })}
          </div>
          {dataScope === 'official' && (
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4">
              <div className="flex-1 text-[14px] leading-relaxed text-slate-700">
                <strong>Muốn thử trước?</strong> Dữ liệu thực hành được lưu riêng, không trộn vào dữ liệu chính thức.
              </div>
              <button type="button" onClick={() => setDataScope('practice')}
                className="shrink-0 rounded-lg border border-blue-300 bg-white px-4 py-2.5 min-h-[44px] text-[14px] font-semibold text-blue-700 hover:bg-blue-100">
                Mở dữ liệu thực hành
              </button>
            </div>
          )}
          <div className="flex items-start gap-2 rounded-lg bg-slate-50 p-3 text-[14px] leading-relaxed text-slate-700">
            <Lightbulb className="w-5 h-5 shrink-0 text-amber-600" />
            <span>Mẹo: Khi chấm bằng Camera, đặt phiếu đủ sáng và giữ trọn bốn góc định vị trong khung hình.</span>
          </div>
        </section>
      )}

      {hasExams && !hasSubmissions && (
        <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <ClipboardList className="w-6 h-6 text-blue-700 shrink-0" />
            <div>
              <h2 className="text-[17px] font-bold text-slate-900">Sẵn sàng chấm kỳ kiểm tra đầu tiên</h2>
              <p className="text-[14px] text-slate-700 mt-1 leading-relaxed">Đã có {totalExams} kỳ kiểm tra nhưng chưa có bài thi được lưu. Chuẩn bị đáp án, sau đó chọn Camera hoặc PDF/Ảnh để bắt đầu.</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setActivePage('answers')} className="rounded-lg bg-white border border-blue-200 px-4 py-2.5 text-[14px] font-semibold text-blue-800 hover:bg-blue-100 min-h-[44px]">Đáp án & thang điểm</button>
            <button type="button" onClick={() => setActivePage('camera')} className="rounded-lg bg-blue-600 px-4 py-2.5 text-[14px] font-semibold text-white hover:bg-blue-700 min-h-[44px]">Chấm bằng Camera</button>
            <button type="button" onClick={() => setActivePage('batch')} className="rounded-lg bg-white border border-blue-200 px-4 py-2.5 text-[14px] font-semibold text-blue-800 hover:bg-blue-100 min-h-[44px]">Chấm PDF / Ảnh</button>
          </div>
        </section>
      )}

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

      {hasSubmissions && (
        <>
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

        </>
      )}

      {hasSubmissions && gradedCount === 0 && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">Đã nhận {totalSubmissions} bài thi</h2>
            <p className="text-[14px] leading-relaxed text-slate-700 mt-1">{reviewCount > 0 ? `${reviewCount} bài đang chờ kiểm duyệt.` : 'Chưa có bài được duyệt.'} Phổ điểm và thống kê kết quả chỉ xuất hiện sau khi có bài đã duyệt.</p>
          </div>
          {reviewCount > 0 && <button type="button" onClick={() => setActivePage('review')} className="rounded-lg bg-amber-600 text-white px-4 py-2.5 min-h-[44px] text-[14px] font-semibold hover:bg-amber-700 shrink-0">Kiểm duyệt bài thi</button>}
        </div>
      )}
      {hasSubmissions && gradedCount > 0 && (
        <>
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

        </>
      )}

      {/* Only show meaningful lists, never two empty panels. */}
      {hasExams && (hasSubmissions || gradedCount > 0) && <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
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
        {reviewCount > 0 && <div className="lg:col-span-6 bg-white border border-slate-200 rounded-lg p-4">
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
        </div>}
      </div>}
    </div>
  );
};

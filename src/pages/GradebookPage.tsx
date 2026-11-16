import React, { useMemo, useState } from 'react';
import {
  Download,
  Eye,
  FileSpreadsheet,
  Link2,
  RefreshCw,
  Search,
  Trash2,
  UserX,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_EXPORT_COLUMNS,
  exportExamGradebookXLSX,
  exportMappedExternalSheet,
  type GradebookExportColumns,
} from '../engine/excelExport';
import { computeCompetitionRanks, scoreRecognitionAgainstKey } from '../engine/scoring';

export const GradebookPage: React.FC = () => {
  const {
    exams,
    activeExam,
    setActiveExamId,
    students,
    classes,
    submissions,
    answerKeys,
    settings,
    upsertStudent,
    upsertSubmission,
    removeSubmission,
    setActivePage,
    openReviewSubmission,
  } = useApp();

  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('all');
  const [codeFilter, setCodeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'graded' | 'all' | 'needs_review'>('graded');
  const [sortBy, setSortBy] = useState<'rank' | 'sbd' | 'name' | 'total'>('rank');
  const [showColumnPicker, setShowColumnPicker] = useState(false);
  const [exportCols, setExportCols] = useState<GradebookExportColumns>(DEFAULT_EXPORT_COLUMNS);
  const [showAbsentPanel, setShowAbsentPanel] = useState(false);
  const [phachMapInput, setPhachMapInput] = useState<Record<string, string>>({});
  const [notice, setNotice] = useState<string | null>(null);

  const examSubs = useMemo(() => {
    if (!activeExam) return [];
    return submissions.filter((s) => s.examId === activeExam.id && !s.isTestSample);
  }, [submissions, activeExam]);

  const distinctCodes = useMemo(
    () => Array.from(new Set(examSubs.map((s) => s.examCode).filter(Boolean))),
    [examSubs]
  );

  const ranks = useMemo(() => computeCompetitionRanks(examSubs), [examSubs]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);

  const filteredSubs = useMemo(() => {
    const q = search.toLowerCase().trim();
    return examSubs
      .filter((s) => {
        if (statusFilter === 'graded' && s.status !== 'graded') return false;
        if (statusFilter === 'needs_review' && s.status === 'graded') return false;
        if (codeFilter !== 'all' && s.examCode !== codeFilter) return false;
        const st =
          (s.studentId ? studentById.get(s.studentId) : undefined) ||
          studentBySbd.get(s.sbd);
        if (classFilter !== 'all' && st?.className !== classFilter) return false;
        if (!q) return true;
        return (
          s.sbd.toLowerCase().includes(q) ||
          (s.phachCode || '').toLowerCase().includes(q) ||
          (st?.fullName || '').toLowerCase().includes(q) ||
          (st?.className || '').toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (sortBy === 'rank' || sortBy === 'total') {
          return b.scoreBreakdown.total - a.scoreBreakdown.total;
        }
        if (sortBy === 'sbd') return a.sbd.localeCompare(b.sbd, 'vi');
        const stA =
          (a.studentId ? studentById.get(a.studentId) : undefined) ||
          studentBySbd.get(a.sbd);
        const stB =
          (b.studentId ? studentById.get(b.studentId) : undefined) ||
          studentBySbd.get(b.sbd);
        return (stA?.fullName || '').localeCompare(stB?.fullName || '', 'vi');
      });
  }, [examSubs, statusFilter, codeFilter, classFilter, search, sortBy, studentById, studentBySbd]);

  const absentStudents = useMemo(() => {
    if (!activeExam) return [];
    return students.filter((st) => st.absentExamIds.includes(activeExam.id));
  }, [students, activeExam]);

  const handleToggleAbsent = async (studentId: string) => {
    if (!activeExam) return;
    const st = students.find((s) => s.id === studentId);
    if (!st) return;
    const isAbsent = st.absentExamIds.includes(activeExam.id);
    const nextAbsent = isAbsent
      ? st.absentExamIds.filter((id) => id !== activeExam.id)
      : [...st.absentExamIds, activeExam.id];
    await upsertStudent({ ...st, absentExamIds: nextAbsent });
  };

  const handleRegradeAll = async () => {
    if (!activeExam) return;
    const examKeys = answerKeys.filter((k) => k.examId === activeExam.id);
    let count = 0;
    for (const sub of examSubs) {
      const ak = examKeys.find((k) => k.examCode === sub.examCode);
      if (!ak) continue;
      const scored = scoreRecognitionAgainstKey(sub.recognition.questions, ak);
      await upsertSubmission({
        ...sub,
        recognition: { ...sub.recognition, questions: scored.questions },
        scoreBreakdown: scored.scoreBreakdown,
        updatedAt: Date.now(),
      });
      count++;
    }
    setNotice(`Đã chấm lại ${count} bài thi theo bộ đáp án mới nhất.`);
  };

  const handlePairPhach = async (subId: string) => {
    const sbdTarget = (phachMapInput[subId] || '').trim();
    if (!sbdTarget) return;
    const sub = examSubs.find((s) => s.id === subId);
    if (!sub) return;
    const st = students.find((s) => s.sbd === sbdTarget);
    await upsertSubmission({
      ...sub,
      sbd: sbdTarget,
      studentId: st?.id,
      updatedAt: Date.now(),
    });
    setNotice(`Đã ghép mã phách ${sub.phachCode || ''} với SBD ${sbdTarget}.`);
  };

  if (!activeExam) {
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

  const unreviewedCount = examSubs.filter((s) => s.status !== 'graded').length;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Bảng điểm kỳ kiểm tra</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeExam.name} ({activeExam.subject}) · {examSubs.filter((s) => s.status === 'graded').length} bài chính thức ·{' '}
            {unreviewedCount > 0 ? `${unreviewedCount} bài chờ kiểm duyệt (không tự gán vào bảng điểm chính thức)` : 'Tất cả bài đã duyệt'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAbsentPanel((v) => !v)}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
          >
            <UserX className="w-4 h-4" />
            Vắng thi ({absentStudents.length})
          </button>
          <button
            type="button"
            onClick={() => setShowColumnPicker((v) => !v)}
            className="px-3 py-2 min-h-[38px] rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
          >
            Chọn cột xuất
          </button>
          <button
            type="button"
            onClick={() =>
              exportExamGradebookXLSX(
                activeExam,
                submissions,
                students,
                answerKeys,
                exportCols,
                'xlsx'
              )
            }
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-md bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() =>
              exportExamGradebookXLSX(
                activeExam,
                submissions,
                students,
                answerKeys,
                exportCols,
                'csv'
              )
            }
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất CSV
          </button>
          <button
            type="button"
            onClick={() => setActivePage('report-cards')}
            className="inline-flex items-center gap-1.5 px-3 py-2 min-h-[38px] rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
          >
            <Download className="w-3.5 h-3.5" />
            Phiếu trả bài PDF
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-3.5 py-2 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      )}

      {/* Column Picker & vnEdu / SMAS mapped export */}
      {showColumnPicker && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="font-semibold text-[#1E293B]">Tùy chọn cột xuất Excel / CSV</div>
          <div className="flex flex-wrap gap-3">
            {Object.keys(exportCols).map((key) => {
              const k = key as keyof GradebookExportColumns;
              const labels: Record<keyof GradebookExportColumns, string> = {
                stt: 'STT',
                sbd: 'Số báo danh',
                studentCode: 'Mã học sinh',
                fullName: 'Họ tên',
                className: 'Lớp',
                examCode: 'Mã đề',
                part1: 'Điểm P.I',
                part2: 'Điểm P.II',
                part3: 'Điểm P.III',
                total: 'Tổng điểm',
                correctCount: 'Số đúng',
                wrongCount: 'Số sai',
                blankCount: 'Bỏ trống',
                status: 'Trạng thái',
                rank: 'Thứ hạng',
                note: 'Nhận xét',
              };
              return (
                <label key={k} className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={exportCols[k]}
                    onChange={(e) =>
                      setExportCols({ ...exportCols, [k]: e.target.checked })
                    }
                  />
                  {labels[k]}
                </label>
              );
            })}
          </div>
          <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-2">
            <span className="text-slate-600">Xuất theo mẫu ánh xạ cột:</span>
            <button
              type="button"
              onClick={() =>
                exportMappedExternalSheet(
                  'vnEdu',
                  settings.vnEduColumnMap,
                  activeExam,
                  submissions,
                  students
                )
              }
              className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-medium"
            >
              Xuất mẫu vnEdu
            </button>
            <button
              type="button"
              onClick={() =>
                exportMappedExternalSheet(
                  'SMAS',
                  settings.smasColumnMap,
                  activeExam,
                  submissions,
                  students
                )
              }
              className="px-2.5 py-1 rounded border border-slate-300 bg-slate-50 hover:bg-slate-100 font-medium"
            >
              Xuất mẫu SMAS
            </button>
          </div>
        </div>
      )}

      {/* Absent Students Panel */}
      {showAbsentPanel && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3 text-xs">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-[#1E293B]">
              Quản lý học sinh vắng thi (không tự động gán điểm 0)
            </h2>
            <button
              type="button"
              onClick={() => setShowAbsentPanel(false)}
              className="text-slate-500 hover:text-slate-800"
            >
              Đóng
            </button>
          </div>
          {students.length === 0 ? (
            <div className="text-slate-500">Chưa có danh sách học sinh.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-56 overflow-y-auto">
              {students.map((st) => {
                const isAbsent = st.absentExamIds.includes(activeExam.id);
                return (
                  <label
                    key={st.id}
                    className={`flex items-center justify-between p-2 rounded border cursor-pointer ${
                      isAbsent ? 'bg-amber-50 border-amber-300' : 'border-slate-200'
                    }`}
                  >
                    <span>
                      <strong className="font-mono-num">{st.sbd}</strong> · {st.fullName} ({st.className})
                    </span>
                    <input
                      type="checkbox"
                      checked={isAbsent}
                      onChange={() => handleToggleAbsent(st.id)}
                    />
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <select
            value={activeExam.id}
            onChange={(e) => {
              setActiveExamId(e.target.value);
              setCodeFilter('all');
            }}
            className="px-2.5 py-2 text-xs font-medium border border-slate-300 rounded-md bg-white max-w-[240px]"
          >
            {exams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name}
              </option>
            ))}
          </select>

          <div className="relative flex-1 min-w-[180px] max-w-xs">
            <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm SBD, mã phách, họ tên..."
              className="w-full pl-8 pr-3 py-2 text-xs border border-slate-300 rounded-md"
            />
          </div>

          <select
            value={classFilter}
            onChange={(e) => setClassFilter(e.target.value)}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="all">Tất cả lớp</option>
            {classes.map((c) => (
              <option key={c.id} value={c.name}>
                Lớp {c.name}
              </option>
            ))}
          </select>

          <select
            value={codeFilter}
            onChange={(e) => setCodeFilter(e.target.value)}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="all">Tất cả mã đề</option>
            {distinctCodes.map((c) => (
              <option key={c} value={c}>
                Mã đề {c}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value as 'graded' | 'all' | 'needs_review')
            }
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="graded">Chính thức (Đã duyệt)</option>
            <option value="needs_review">Chờ kiểm duyệt</option>
            <option value="all">Tất cả bài thi</option>
          </select>

          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as 'rank' | 'sbd' | 'name' | 'total')
            }
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
          >
            <option value="rank">Sắp xếp: Điểm / Hạng</option>
            <option value="sbd">Sắp xếp: SBD</option>
            <option value="name">Sắp xếp: Họ tên</option>
          </select>
        </div>

        <button
          type="button"
          onClick={handleRegradeAll}
          className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium border border-slate-300 rounded-md hover:bg-slate-50"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Chấm lại tất cả
        </button>
      </div>

      {/* Main Gradebook Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredSubs.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chưa có bài thi nào phù hợp bộ lọc.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">STT</th>
                  <th className="py-2.5 px-3 font-semibold">SBD / Phách</th>
                  <th className="py-2.5 px-3 font-semibold">Họ và tên</th>
                  <th className="py-2.5 px-3 font-semibold">Lớp</th>
                  <th className="py-2.5 px-3 font-semibold">Mã đề</th>
                  <th className="py-2.5 px-3 font-semibold text-right">P.I</th>
                  <th className="py-2.5 px-3 font-semibold text-right">P.II</th>
                  <th className="py-2.5 px-3 font-semibold text-right">P.III</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Tổng</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Đ/S/T</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Trạng thái</th>
                  <th className="py-2.5 px-3 font-semibold text-center">Hạng</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSubs.map((sub, idx) => {
                  const st =
                    (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
                    studentBySbd.get(sub.sbd);
                  const hideInfo =
                    !!sub.phachCode &&
                    settings.hideStudentInfoOnPhach &&
                    sub.status !== 'graded';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70">
                      <td className="py-2.5 px-3 font-mono-num text-slate-500">{idx + 1}</td>
                      <td className="py-2.5 px-3 font-mono-num font-semibold">
                        {hideInfo ? (
                          <span className="text-slate-600">Phách: {sub.phachCode}</span>
                        ) : (
                          <div>
                            <div>{sub.sbd || '—'}</div>
                            {sub.phachCode && (
                              <div className="text-[10px] text-slate-400">
                                Phách: {sub.phachCode}
                              </div>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-medium">
                        {hideInfo ? (
                          <span className="text-slate-400 italic">(Ẩn khi chấm phách)</span>
                        ) : st?.fullName ? (
                          st.fullName
                        ) : sub.phachCode ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="text"
                              value={phachMapInput[sub.id] || ''}
                              onChange={(e) =>
                                setPhachMapInput({ ...phachMapInput, [sub.id]: e.target.value })
                              }
                              placeholder="Nhập SBD ghép phách"
                              className="w-28 px-1.5 py-0.5 text-[11px] border border-slate-300 rounded font-mono-num"
                            />
                            <button
                              type="button"
                              onClick={() => handlePairPhach(sub.id)}
                              className="p-1 text-[#2563EB] hover:bg-blue-50 rounded"
                              title="Ghép phách"
                            >
                              <Link2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        ) : (
                          <span className="text-slate-400">(Chưa đối chiếu)</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3">{hideInfo ? '—' : st?.className || '—'}</td>
                      <td className="py-2.5 px-3 font-mono-num">{sub.examCode || '—'}</td>
                      <td className="py-2.5 px-3 font-mono-num text-right">
                        {sub.scoreBreakdown.part1}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-right">
                        {sub.scoreBreakdown.part2}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-right">
                        {sub.scoreBreakdown.part3}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num font-bold text-right text-[#2563EB]">
                        {sub.scoreBreakdown.total}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-center text-slate-600">
                        {sub.scoreBreakdown.correctCount}/{sub.scoreBreakdown.wrongCount}/
                        {sub.scoreBreakdown.blankCount}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        {sub.status === 'graded' ? (
                          <span className="text-[#16A34A] font-medium">Đã duyệt</span>
                        ) : (
                          <button
                            type="button"
                            onClick={() => openReviewSubmission(sub.id, sub.examId)}
                            className="text-amber-700 underline font-medium"
                          >
                            Chờ duyệt
                          </button>
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-center font-semibold">
                        {ranks.get(sub.id) ?? '—'}
                      </td>
                      <td className="py-2.5 px-3 text-right whitespace-nowrap space-x-2">
                        <button
                          type="button"
                          onClick={() => openReviewSubmission(sub.id, sub.examId)}
                          className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-medium"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          Xem chi tiết
                        </button>
                        <button
                          type="button"
                          onClick={() => removeSubmission(sub.id)}
                          className="p-1 text-slate-400 hover:text-[#DC2626]"
                          title="Xóa bài"
                        >
                          <Trash2 className="w-3.5 h-3.5 inline" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

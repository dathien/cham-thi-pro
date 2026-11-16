import React, { useState } from 'react';
import {
  Archive,
  Copy,
  Edit3,
  Plus,
  Trash2,
  Check,
  X,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import type { Exam } from '../types/omr';

const SUBJECT_SUGGESTIONS = [
  'Toán',
  'Ngữ văn',
  'Tiếng Anh',
  'Vật lý',
  'Hóa học',
  'Sinh học',
  'Lịch sử',
  'Địa lý',
  'GDKT & PL',
  'Tin học',
  'Công nghệ',
  'Khoa học tự nhiên',
];

function createBlankExamDraft(defaultTemplateId: string): Omit<Exam, 'id' | 'createdAt' | 'updatedAt'> {
  const today = new Date().toISOString().slice(0, 10);
  return {
    schoolName: 'TRƯỜNG THPT',
    name: '',
    schoolYear: '2026-2027',
    semester: 'Học kỳ I',
    subject: 'Toán',
    gradeLevel: '12',
    classNames: [],
    examDate: today,
    durationMinutes: 90,
    teacherName: '',
    templateId: defaultTemplateId,
    scoreScale: 10,
    passThreshold: 5.0,
    examCodes: ['101', '102', '103', '104'],
    isArchived: false,
  };
}

export const ExamsPage: React.FC = () => {
  const {
    exams,
    classes,
    templates,
    activeExamId,
    setActiveExamId,
    upsertExam,
    removeExam,
    setActivePage,
  } = useApp();

  const defaultTpl = templates[0]?.id || 'tpl_thpt2025_toan';
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showEditor, setShowEditor] = useState(exams.length === 0);
  const [draft, setDraft] = useState(() => createBlankExamDraft(defaultTpl));
  const [customSubject, setCustomSubject] = useState('');
  const [codesInput, setCodesInput] = useState('101, 102, 103, 104');
  const [classInput, setClassInput] = useState('');
  const [showArchived, setShowArchived] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const startCreate = () => {
    setEditingId(null);
    setDraft(createBlankExamDraft(defaultTpl));
    setCodesInput('101, 102, 103, 104');
    setCustomSubject('');
    setFormError(null);
    setShowEditor(true);
  };

  const startEdit = (ex: Exam) => {
    setEditingId(ex.id);
    setDraft({
      schoolName: ex.schoolName,
      name: ex.name,
      schoolYear: ex.schoolYear,
      semester: ex.semester,
      subject: ex.subject,
      gradeLevel: ex.gradeLevel,
      classNames: [...ex.classNames],
      examDate: ex.examDate,
      durationMinutes: ex.durationMinutes,
      teacherName: ex.teacherName,
      templateId: ex.templateId,
      scoreScale: ex.scoreScale,
      passThreshold: ex.passThreshold,
      examCodes: [...ex.examCodes],
      isArchived: ex.isArchived,
    });
    setCodesInput(ex.examCodes.join(', '));
    setCustomSubject(SUBJECT_SUGGESTIONS.includes(ex.subject) ? '' : ex.subject);
    setFormError(null);
    setShowEditor(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.name.trim()) {
      setFormError('Vui lòng nhập tên kỳ kiểm tra.');
      return;
    }
    const parsedCodes = codesInput
      .split(/[\s,;]+/)
      .map((s) => s.trim())
      .filter(Boolean);
    if (parsedCodes.length === 0) {
      setFormError('Vui lòng nhập ít nhất một mã đề (ví dụ: 101).');
      return;
    }
    const now = Date.now();
    const existing = editingId ? exams.find((x) => x.id === editingId) : undefined;
    const exam: Exam = {
      id: editingId || `exam_${now}_${Math.random().toString(36).slice(2, 6)}`,
      ...draft,
      schoolName: draft.schoolName.trim() || 'TRƯỜNG THPT',
      name: draft.name.trim(),
      subject: customSubject.trim() || draft.subject,
      examCodes: Array.from(new Set(parsedCodes)),
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };
    await upsertExam(exam);
    setShowEditor(false);
    setEditingId(null);
    setFormError(null);
  };

  const handleDuplicate = async (ex: Exam) => {
    const now = Date.now();
    const copy: Exam = {
      ...ex,
      id: `exam_${now}_${Math.random().toString(36).slice(2, 6)}`,
      name: `${ex.name} (Bản sao)`,
      isArchived: false,
      createdAt: now,
      updatedAt: now,
    };
    await upsertExam(copy);
  };

  const handleToggleArchive = async (ex: Exam) => {
    await upsertExam({ ...ex, isArchived: !ex.isArchived, updatedAt: Date.now() });
  };

  const addClassTag = () => {
    const c = classInput.trim();
    if (!c) return;
    if (!draft.classNames.includes(c)) {
      setDraft({ ...draft, classNames: [...draft.classNames, c] });
    }
    setClassInput('');
  };

  const filteredExams = exams.filter((e) => (showArchived ? true : !e.isArchived));

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Quản lý kỳ kiểm tra</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Tạo, chỉnh sửa, sao chép, lưu trữ kỳ kiểm tra và gán mẫu phiếu, danh sách mã đề.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(e) => setShowArchived(e.target.checked)}
              className="rounded border-slate-300"
            />
            Hiện kỳ đã lưu trữ
          </label>
          <button
            type="button"
            onClick={startCreate}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 whitespace-nowrap"
          >
            <Plus className="w-4 h-4" />
            Tạo kỳ kiểm tra
          </button>
        </div>
      </div>

      {/* Inline Editor Panel (No Popup!) */}
      {showEditor && (
        <form
          onSubmit={handleSave}
          className="bg-white border border-slate-200 rounded-lg p-5 space-y-4"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-sm font-semibold text-[#1E293B]">
              {editingId ? 'Chỉnh sửa kỳ kiểm tra' : 'Tạo kỳ kiểm tra mới'}
            </h2>
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="text-xs text-slate-500 hover:text-slate-800 inline-flex items-center gap-1"
            >
              <X className="w-4 h-4" />
              Đóng
            </button>
          </div>

          {formError && (
            <div className="p-2.5 rounded bg-red-50 border border-red-200 text-xs text-[#DC2626]">
              {formError}
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tên trường (có thể sửa)
              </label>
              <input
                type="text"
                value={draft.schoolName}
                onChange={(e) => setDraft({ ...draft, schoolName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#2563EB]"
                placeholder="TRƯỜNG THPT"
              />
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Tên kỳ kiểm tra *
              </label>
              <input
                type="text"
                required
                value={draft.name}
                onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md focus:outline-none focus:border-[#2563EB]"
                placeholder="Ví dụ: Kiểm tra giữa học kỳ I"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Năm học</label>
              <input
                type="text"
                value={draft.schoolYear}
                onChange={(e) => setDraft({ ...draft, schoolYear: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Học kỳ</label>
              <select
                value={draft.semester}
                onChange={(e) => setDraft({ ...draft, semester: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="Học kỳ I">Học kỳ I</option>
                <option value="Học kỳ II">Học kỳ II</option>
                <option value="Thi thử THPT">Thi thử THPT</option>
                <option value="Kiểm tra thường xuyên">Kiểm tra thường xuyên</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Môn học</label>
              <div className="flex gap-1.5">
                <select
                  value={SUBJECT_SUGGESTIONS.includes(draft.subject) ? draft.subject : '__custom__'}
                  onChange={(e) => {
                    if (e.target.value === '__custom__') {
                      setDraft({ ...draft, subject: '' });
                    } else {
                      setDraft({ ...draft, subject: e.target.value });
                      setCustomSubject('');
                    }
                  }}
                  className="w-1/2 px-2 py-2 text-xs border border-slate-300 rounded-md bg-white"
                >
                  {SUBJECT_SUGGESTIONS.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                  <option value="__custom__">Môn khác...</option>
                </select>
                <input
                  type="text"
                  value={customSubject || (SUBJECT_SUGGESTIONS.includes(draft.subject) ? '' : draft.subject)}
                  onChange={(e) => {
                    setCustomSubject(e.target.value);
                    setDraft({ ...draft, subject: e.target.value });
                  }}
                  placeholder="Nhập môn tùy chỉnh"
                  className="w-1/2 px-2.5 py-2 text-xs border border-slate-300 rounded-md"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Khối lớp</label>
              <input
                type="text"
                value={draft.gradeLevel}
                onChange={(e) => setDraft({ ...draft, gradeLevel: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                placeholder="10, 11, 12..."
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Ngày kiểm tra</label>
              <input
                type="date"
                value={draft.examDate}
                onChange={(e) => setDraft({ ...draft, examDate: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Thời gian làm bài (phút)
              </label>
              <input
                type="number"
                min={5}
                max={300}
                value={draft.durationMinutes}
                onChange={(e) =>
                  setDraft({ ...draft, durationMinutes: Number(e.target.value) || 45 })
                }
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Giáo viên phụ trách
              </label>
              <input
                type="text"
                value={draft.teacherName}
                onChange={(e) => setDraft({ ...draft, teacherName: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md"
                placeholder="Họ tên giáo viên"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Mẫu phiếu sử dụng
              </label>
              <select
                value={draft.templateId}
                onChange={(e) => setDraft({ ...draft, templateId: e.target.value })}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Thang điểm</label>
                <input
                  type="number"
                  min={1}
                  max={100}
                  step="0.5"
                  value={draft.scoreScale}
                  onChange={(e) =>
                    setDraft({ ...draft, scoreScale: Number(e.target.value) || 10 })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-700 mb-1">Ngưỡng đạt</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step="0.25"
                  value={draft.passThreshold}
                  onChange={(e) =>
                    setDraft({ ...draft, passThreshold: Number(e.target.value) || 5 })
                  }
                  className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Danh sách mã đề (cách nhau bởi dấu phẩy)
              </label>
              <input
                type="text"
                value={codesInput}
                onChange={(e) => setCodesInput(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-md font-mono-num"
                placeholder="101, 102, 103, 104"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">
                Các lớp tham gia
              </label>
              <div className="flex gap-1.5">
                <input
                  type="text"
                  value={classInput}
                  onChange={(e) => setClassInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addClassTag();
                    }
                  }}
                  placeholder="Nhập lớp (vd: 12A1)"
                  className="flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-md"
                />
                <button
                  type="button"
                  onClick={addClassTag}
                  className="px-3 py-2 text-xs bg-slate-100 border border-slate-300 rounded-md hover:bg-slate-200"
                >
                  Thêm
                </button>
              </div>
              {classes.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-1.5">
                  {classes.map((c) => {
                    const active = draft.classNames.includes(c.name);
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setDraft({
                            ...draft,
                            classNames: active
                              ? draft.classNames.filter((x) => x !== c.name)
                              : [...draft.classNames, c.name],
                          });
                        }}
                        className={`px-2 py-0.5 text-[11px] rounded border ${
                          active
                            ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] font-medium'
                            : 'border-slate-200 text-slate-600'
                        }`}
                      >
                        {c.name}
                      </button>
                    );
                  })}
                </div>
              )}
              {draft.classNames.length > 0 && (
                <div className="text-[11px] text-slate-600 mt-1">
                  Đã chọn: {draft.classNames.join(', ')}
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={() => setShowEditor(false)}
              className="px-4 py-2 text-xs font-medium rounded-md border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium rounded-md bg-[#2563EB] text-white hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
              {editingId ? 'Lưu cập nhật' : 'Lưu kỳ kiểm tra'}
            </button>
          </div>
        </form>
      )}

      {/* Exams Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        {filteredExams.length === 0 ? (
          <div className="p-8 text-center text-xs text-slate-500">
            Chưa có kỳ kiểm tra nào. Nhấn <strong>Tạo kỳ kiểm tra</strong> để bắt đầu.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2.5 px-3 font-semibold">Kỳ kiểm tra</th>
                  <th className="py-2.5 px-3 font-semibold">Môn · Khối</th>
                  <th className="py-2.5 px-3 font-semibold">Mẫu phiếu</th>
                  <th className="py-2.5 px-3 font-semibold">Mã đề</th>
                  <th className="py-2.5 px-3 font-semibold">Ngày thi</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Thao tác</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredExams.map((ex) => {
                  const isActive = activeExamId === ex.id;
                  const tpl = templates.find((t) => t.id === ex.templateId);
                  return (
                    <tr
                      key={ex.id}
                      className={`hover:bg-slate-50/80 ${isActive ? 'bg-blue-50/40' : ''}`}
                    >
                      <td className="py-2.5 px-3">
                        <div className="font-semibold text-[#1E293B]">
                          {ex.name}
                          {ex.isArchived && (
                            <span className="ml-2 text-[11px] font-normal text-slate-500">
                              (Đã lưu trữ)
                            </span>
                          )}
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {ex.schoolName} · {ex.semester} ({ex.schoolYear})
                        </div>
                      </td>
                      <td className="py-2.5 px-3">
                        <div>{ex.subject}</div>
                        <div className="text-[11px] text-slate-500">
                          Khối {ex.gradeLevel} · {ex.durationMinutes} phút
                        </div>
                      </td>
                      <td className="py-2.5 px-3 max-w-[200px] truncate text-slate-600">
                        {tpl?.name || ex.templateId}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-700">
                        {ex.examCodes.join(', ')}
                      </td>
                      <td className="py-2.5 px-3 font-mono-num text-slate-600 whitespace-nowrap">
                        {ex.examDate}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="inline-flex items-center gap-1">
                          {!isActive ? (
                            <button
                              type="button"
                              onClick={() => setActiveExamId(ex.id)}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                            >
                              Chọn làm việc
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setActivePage('answers')}
                              className="px-2 py-1 rounded text-[11px] font-medium bg-emerald-50 text-[#16A34A]"
                            >
                              Đang chọn · Đáp án
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => startEdit(ex)}
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                            title="Chỉnh sửa"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDuplicate(ex)}
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                            title="Sao chép"
                          >
                            <Copy className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleToggleArchive(ex)}
                            className="p-1.5 rounded text-slate-600 hover:bg-slate-100"
                            title={ex.isArchived ? 'Bỏ lưu trữ' : 'Lưu trữ'}
                          >
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                          {confirmDeleteId === ex.id ? (
                            <span className="inline-flex items-center gap-1 ml-1">
                              <button
                                type="button"
                                onClick={async () => {
                                  await removeExam(ex.id);
                                  setConfirmDeleteId(null);
                                }}
                                className="px-2 py-1 rounded bg-[#DC2626] text-white text-[11px]"
                              >
                                Xóa hẳn
                              </button>
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteId(null)}
                                className="px-1.5 py-1 text-[11px] text-slate-500"
                              >
                                Hủy
                              </button>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteId(ex.id)}
                              className="p-1.5 rounded text-slate-500 hover:text-[#DC2626] hover:bg-red-50"
                              title="Xóa kỳ kiểm tra"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
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

import React, { useRef, useState } from 'react';
import {
  CheckCircle2,
  Database,
  Download,
  FlaskConical,
  Play,
  RotateCcw,
  Save,
  Trash2,
  Upload,
  XCircle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  DEFAULT_SETTINGS,
  exportOfficialOnlyBackup,
  restoreBackup,
  type BackupPayload,
} from '../db/database';
import { runMandatoryVerificationSuite } from '../engine/testSuite';
import type { AppSettings, TestCaseResult } from '../types/omr';

export const SettingsPage: React.FC = () => {
  const {
    settings,
    updateSettings,
    opencvStatus,
    allExams,
    practiceMeta,
    restorePracticeDataset,
    deletePracticeDataset,
    reloadFromDB,
  } = useApp();

  const importOfficialRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<AppSettings>(settings);
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [confirmDeletePractice, setConfirmDeletePractice] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [testResults, setTestResults] = useState<TestCaseResult[]>([]);

  const practiceExamCount = allExams.filter((e) => e.isPractice).length;
  const officialExamCount = allExams.filter((e) => !e.isPractice).length;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    await updateSettings(draft);
    setSavedMsg('Đã lưu cấu hình OMR và hệ thống vào IndexedDB.');
  };

  const handleResetDefaults = async () => {
    setDraft(DEFAULT_SETTINGS);
    await updateSettings(DEFAULT_SETTINGS);
    setSavedMsg('Đã khôi phục cấu hình mặc định.');
  };

  const handleRestorePractice = async () => {
    await restorePracticeDataset();
    setSavedMsg(
      'Đã khôi phục bộ dữ liệu thực hành (3 lớp, 135 học sinh, 5 kỳ thi, 20 mã đáp án). Dữ liệu chính thức của bạn được giữ nguyên.'
    );
  };

  const handleDeletePractice = async () => {
    await deletePracticeDataset();
    setConfirmDeletePractice(false);
    setSavedMsg(
      'Đã xóa toàn bộ dữ liệu thực hành khỏi IndexedDB. Hệ thống sẽ không tự khởi tạo lại khi tải lại trang trừ khi bạn nhấn Khôi phục.'
    );
  };

  const handleBackupOfficialOnly = async () => {
    const payload = await exportOfficialOnlyBackup();
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `chamthi_du_lieu_cua_toi_${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setSavedMsg(
      `Đã sao lưu dữ liệu của tôi (${payload.data.exams.length} kỳ thi, ${payload.data.submissions.length} bài chấm).`
    );
  };

  const handleImportOfficialOnly = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      await restoreBackup(parsed, 'merge');
      await reloadFromDB();
      setSavedMsg(`Đã nhập dữ liệu từ tệp "${file.name}" vào hệ thống.`);
    } catch (err) {
      setSavedMsg(err instanceof Error ? err.message : 'Lỗi khi nhập tệp sao lưu.');
    } finally {
      e.target.value = '';
    }
  };

  const handleRunTestSuite = async () => {
    setRunningTests(true);
    try {
      const results = await runMandatoryVerificationSuite(draft);
      setTestResults(results);
    } finally {
      setRunningTests(false);
    }
  };

  const passedCount = testResults.filter((r) => r.passed).length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[20px] font-bold text-[#1E293B]">Cài đặt và Quản lý dữ liệu</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Quản lý tách biệt dữ liệu thực hành – dữ liệu chính thức, ngưỡng nhận dạng OMR OpenCV và kiểm thử xác minh.
        </p>
      </div>

      {savedMsg && (
        <div className="px-3.5 py-2.5 rounded-md bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center justify-between gap-2">
          <span>{savedMsg}</span>
          <button type="button" onClick={() => setSavedMsg(null)} className="underline shrink-0">
            Đóng
          </button>
        </div>
      )}

      {/* Practice & Official Data Management */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
          <div>
            <h2 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
              <Database className="w-4 h-4 text-[#2563EB]" />
              Quản lý dữ liệu thực hành và dữ liệu của tôi
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Dữ liệu thực hành (<span className="font-mono-num">{practiceExamCount}</span> kỳ thi) và dữ liệu chính thức của bạn (<span className="font-mono-num">{officialExamCount}</span> kỳ thi) được tách biệt hoàn toàn trong IndexedDB.
              {practiceMeta.deletedByUser && ' Bộ dữ liệu thực hành đang ở trạng thái đã xóa theo yêu cầu giáo viên.'}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <button
            type="button"
            onClick={handleRestorePractice}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-md border border-blue-200 bg-blue-50 text-[#2563EB] font-medium hover:bg-blue-100"
          >
            <RotateCcw className="w-4 h-4 shrink-0" />
            Khôi phục bộ dữ liệu thực hành
          </button>

          {!confirmDeletePractice ? (
            <button
              type="button"
              onClick={() => setConfirmDeletePractice(true)}
              disabled={practiceExamCount === 0}
              className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-md border border-red-200 bg-red-50 text-[#DC2626] font-medium hover:bg-red-100 disabled:opacity-40"
            >
              <Trash2 className="w-4 h-4 shrink-0" />
              Xóa dữ liệu thực hành
            </button>
          ) : (
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border border-red-300 bg-red-50">
              <button
                type="button"
                onClick={handleDeletePractice}
                className="flex-1 py-1.5 rounded bg-[#DC2626] text-white font-medium"
              >
                Xác nhận xóa
              </button>
              <button
                type="button"
                onClick={() => setConfirmDeletePractice(false)}
                className="px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700"
              >
                Hủy
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={handleBackupOfficialOnly}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-md bg-[#2563EB] text-white font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4 shrink-0" />
            Sao lưu dữ liệu của tôi
          </button>

          <button
            type="button"
            onClick={() => importOfficialRef.current?.click()}
            className="inline-flex items-center justify-center gap-2 px-3.5 py-2.5 min-h-[40px] rounded-md border border-slate-300 bg-white text-[#1E293B] font-medium hover:bg-slate-50"
          >
            <Upload className="w-4 h-4 shrink-0" />
            Nhập dữ liệu của tôi
          </button>
          <input
            ref={importOfficialRef}
            type="file"
            accept=".json,application/json"
            onChange={handleImportOfficialOnly}
            className="hidden"
          />
        </div>
      </div>

      {/* OMR & General Settings Form */}
      <form
        onSubmit={handleSave}
        className="bg-white border border-slate-200 rounded-lg p-5 space-y-5 text-xs"
      >
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <h2 className="text-sm font-semibold text-[#1E293B]">
            Cài đặt nâng cao bộ máy nhận dạng OMR
          </h2>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetDefaults}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              Mặc định
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-4 py-1.5 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700"
            >
              <Save className="w-3.5 h-3.5" />
              Lưu cài đặt
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Ngưỡng tô chắc chắn (0.20 – 0.65): <strong className="font-mono-num">{draft.fillThreshold}</strong>
            </label>
            <input
              type="range"
              min={0.2}
              max={0.65}
              step={0.02}
              value={draft.fillThreshold}
              onChange={(e) => setDraft({ ...draft, fillThreshold: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Ngưỡng tô mờ (0.10 – 0.35): <strong className="font-mono-num">{draft.faintThreshold}</strong>
            </label>
            <input
              type="range"
              min={0.1}
              max={0.35}
              step={0.01}
              value={draft.faintThreshold}
              onChange={(e) => setDraft({ ...draft, faintThreshold: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Chênh lệch nghi ngờ tô nhiều: <strong className="font-mono-num">{draft.multiMarkDelta}</strong>
            </label>
            <input
              type="range"
              min={0.05}
              max={0.25}
              step={0.01}
              value={draft.multiMarkDelta}
              onChange={(e) => setDraft({ ...draft, multiMarkDelta: Number(e.target.value) })}
              className="w-full"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Ngưỡng phát hiện tẩy xóa (viền ngoài)
            </label>
            <input
              type="number"
              step="0.02"
              min={0.1}
              max={0.5}
              value={draft.eraseRingThreshold}
              onChange={(e) =>
                setDraft({ ...draft, eraseRingThreshold: Number(e.target.value) || 0.22 })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Độ nét tối thiểu Camera (Laplacian)
            </label>
            <input
              type="number"
              min={10}
              max={200}
              value={draft.blurMinScore}
              onChange={(e) => setDraft({ ...draft, blurMinScore: Number(e.target.value) || 45 })}
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Số khung hình ổn định trước khi tự chụp
            </label>
            <input
              type="number"
              min={2}
              max={15}
              value={draft.autoCaptureFrames}
              onChange={(e) =>
                setDraft({ ...draft, autoCaptureFrames: Number(e.target.value) || 4 })
              }
              className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-6 pt-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.soundEnabled}
              onChange={(e) => setDraft({ ...draft, soundEnabled: e.target.checked })}
            />
            Phát âm thanh khi chấm thành công bằng Camera
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={draft.hideStudentInfoOnPhach}
              onChange={(e) => setDraft({ ...draft, hideStudentInfoOnPhach: e.target.checked })}
            />
            Ẩn thông tin học sinh trong quá trình chấm phiếu rọc phách
          </label>
        </div>

        {/* vnEdu & SMAS column mapping */}
        <div className="pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="font-semibold text-slate-700">Ánh xạ tên cột xuất mẫu vnEdu</div>
            {Object.entries(draft.vnEduColumnMap).map(([k, val]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-24 text-slate-500 font-mono-num">{k}</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      vnEduColumnMap: { ...draft.vnEduColumnMap, [k]: e.target.value },
                    })
                  }
                  className="flex-1 px-2 py-1 border border-slate-300 rounded"
                />
              </div>
            ))}
          </div>
          <div className="space-y-2">
            <div className="font-semibold text-slate-700">Ánh xạ tên cột xuất mẫu SMAS</div>
            {Object.entries(draft.smasColumnMap).map(([k, val]) => (
              <div key={k} className="flex items-center gap-2">
                <span className="w-24 text-slate-500 font-mono-num">{k}</span>
                <input
                  type="text"
                  value={val}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      smasColumnMap: { ...draft.smasColumnMap, [k]: e.target.value },
                    })
                  }
                  className="flex-1 px-2 py-1 border border-slate-300 rounded"
                />
              </div>
            ))}
          </div>
        </div>
      </form>

      {/* Mandatory Verification Test Suite */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#2563EB]" />
              Bộ kiểm thử xác minh OMR & Tính điểm
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Kiểm thử trực tiếp bằng OpenCV.js trên các tình huống biên (tô chuẩn, bỏ trống, tô mờ, tô nhiều, tẩy xóa, xoay 90°/180°/270°, nghiêng, bóng đổ, thiếu định vị, ghép đôi A5, số âm/dấu phẩy, PDF tiếng Việt).
            </p>
          </div>
          <button
            type="button"
            onClick={handleRunTestSuite}
            disabled={runningTests || opencvStatus !== 'ready'}
            className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-md bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50 whitespace-nowrap"
          >
            <Play className="w-4 h-4" />
            {runningTests ? 'Đang chạy kiểm thử...' : 'Chạy toàn bộ bộ kiểm thử'}
          </button>
        </div>

        {testResults.length > 0 && (
          <div className="space-y-3">
            <div className="text-xs font-semibold">
              Kết quả thực tế:{' '}
              <span className="font-mono-num text-[#16A34A]">
                {passedCount}/{testResults.length} đạt
              </span>
            </div>
            <div className="overflow-x-auto border border-slate-200 rounded-md">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <th className="py-2 px-3 font-semibold">Trường hợp kiểm thử</th>
                    <th className="py-2 px-3 font-semibold">Kỳ vọng</th>
                    <th className="py-2 px-3 font-semibold">Kết quả đo được</th>
                    <th className="py-2 px-3 font-semibold text-right">Thời gian</th>
                    <th className="py-2 px-3 font-semibold text-center">Đạt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {testResults.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 px-3 font-medium">{r.name}</td>
                      <td className="py-2 px-3 text-slate-600 font-mono-num">{r.expected}</td>
                      <td className="py-2 px-3 font-mono-num">{r.actual}</td>
                      <td className="py-2 px-3 text-right font-mono-num text-slate-500">
                        {r.durationMs} ms
                      </td>
                      <td className="py-2 px-3 text-center">
                        {r.passed ? (
                          <span className="inline-flex items-center gap-1 text-[#16A34A] font-semibold">
                            <CheckCircle2 className="w-4 h-4" />
                            Đạt
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-[#DC2626] font-semibold">
                            <XCircle className="w-4 h-4" />
                            Chưa đạt
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

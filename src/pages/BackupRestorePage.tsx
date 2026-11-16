import React, { useEffect, useRef, useState } from 'react';
import {
  AlertTriangle,
  Cloud,
  Download,
  HardDrive,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import {
  BACKUP_SCHEMA_VERSION,
  exportBackup,
  getStorageUsageEstimate,
  restoreBackup,
  type BackupPayload,
} from '../db/database';

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export const BackupRestorePage: React.FC = () => {
  const { exams, activeExamId, settings, updateSettings, reloadFromDB } = useApp();
  const fileRef = useRef<HTMLInputElement>(null);

  const [selectedExamId, setSelectedExamId] = useState(activeExamId || exams[0]?.id || '');
  const [storageInfo, setStorageInfo] = useState({ usageBytes: 0, quotaBytes: 0, percentUsed: 0 });
  const [pendingPayload, setPendingPayload] = useState<BackupPayload | null>(null);
  const [restoreMode, setRestoreMode] = useState<'merge' | 'replace'>('merge');
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const refreshQuota = async () => {
    const info = await getStorageUsageEstimate();
    setStorageInfo(info);
  };

  useEffect(() => {
    refreshQuota();
  }, []);

  const handleExport = async (scope: 'full' | 'exam') => {
    if (scope === 'exam' && !selectedExamId) {
      setErrorMsg('Vui lòng chọn kỳ kiểm tra cần sao lưu.');
      return;
    }
    const payload = await exportBackup(scope, selectedExamId);
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download =
      scope === 'full'
        ? `chamthi_smart_backup_toanbo_${new Date().toISOString().slice(0, 10)}.json`
        : `chamthi_smart_kythi_${selectedExamId}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setNotice(
      scope === 'full'
        ? 'Đã xuất file sao lưu toàn bộ dữ liệu IndexedDB.'
        : 'Đã xuất file sao lưu riêng kỳ kiểm tra đã chọn.'
    );
  };

  const handleFilePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setNotice(null);
    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as BackupPayload;
      if (parsed.app !== 'chamthi-smart' || !parsed.schemaVersion || !parsed.data) {
        throw new Error('Tệp JSON không phải bản sao lưu hợp lệ của Chấm Thi Thông Minh.');
      }
      setPendingPayload(parsed);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Không đọc được tệp sao lưu.');
      setPendingPayload(null);
    } finally {
      e.target.value = '';
    }
  };

  const handleConfirmRestore = async () => {
    if (!pendingPayload) return;
    try {
      await restoreBackup(pendingPayload, restoreMode);
      await reloadFromDB();
      await refreshQuota();
      setPendingPayload(null);
      setNotice(
        restoreMode === 'replace'
          ? 'Đã khôi phục toàn bộ dữ liệu (thay thế dữ liệu cũ).'
          : 'Đã gộp dữ liệu từ tệp sao lưu thành công.'
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Lỗi khi khôi phục dữ liệu.');
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-bold text-[#1E293B]">Sao lưu và khôi phục dữ liệu</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Dữ liệu lưu tự động trong IndexedDB trên thiết bị của bạn (Phiên bản lược đồ: v{BACKUP_SCHEMA_VERSION}).
        </p>
      </div>

      {notice && (
        <div className="px-3.5 py-2.5 rounded bg-emerald-50 border border-emerald-200 text-xs text-emerald-900">
          {notice}
        </div>
      )}
      {errorMsg && (
        <div className="px-3.5 py-2.5 rounded bg-red-50 border border-red-200 text-xs text-[#DC2626]">
          {errorMsg}
        </div>
      )}

      {/* Storage Quota Monitor */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#1E293B]">
            <HardDrive className="w-4 h-4 text-[#2563EB]" />
            Dung lượng lưu trữ cục bộ (IndexedDB)
          </span>
          <span className="font-mono-num text-slate-600">
            {formatBytes(storageInfo.usageBytes)} / {formatBytes(storageInfo.quotaBytes)} (
            {storageInfo.percentUsed.toFixed(1)}%)
          </span>
        </div>
        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              storageInfo.percentUsed > 75 ? 'bg-[#DC2626]' : 'bg-[#2563EB]'
            }`}
            style={{ width: `${Math.min(100, Math.max(1, storageInfo.percentUsed))}%` }}
          />
        </div>
        {storageInfo.percentUsed > 75 && (
          <div className="text-xs text-[#DC2626] flex items-center gap-1.5">
            <AlertTriangle className="w-4 h-4" />
            Dung lượng trình duyệt sắp đầy. Hãy sao lưu toàn bộ và xóa bớt kỳ kiểm tra cũ đã lưu trữ.
          </div>
        )}
      </div>

      {/* Export & Import Cards */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[#1E293B]">Sao lưu ra tệp JSON</h2>
          <p className="text-xs text-slate-600">
            Bao gồm kỳ kiểm tra, lớp học, học sinh, mẫu phiếu, đáp án, kết quả chấm, lịch sử chỉnh sửa và ảnh bài thi.
          </p>
          <button
            type="button"
            onClick={() => handleExport('full')}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
          >
            <Download className="w-4 h-4" />
            Sao lưu toàn bộ dữ liệu
          </button>

          <div className="pt-3 border-t border-slate-100 space-y-2">
            <label className="block text-xs font-medium text-slate-700">
              Hoặc sao lưu riêng một kỳ kiểm tra:
            </label>
            <div className="flex gap-2">
              <select
                value={selectedExamId}
                onChange={(e) => setSelectedExamId(e.target.value)}
                className="flex-1 px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
              >
                {exams.map((ex) => (
                  <option key={ex.id} value={ex.id}>
                    {ex.name} ({ex.subject})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => handleExport('exam')}
                disabled={!selectedExamId}
                className="px-3.5 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
              >
                Xuất kỳ thi
              </button>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[#1E293B]">Khôi phục từ tệp sao lưu</h2>
          <p className="text-xs text-slate-600">
            Hệ thống sẽ kiểm tra phiên bản dữ liệu và hỏi xác nhận trước khi ghi đè dữ liệu hiện tại.
          </p>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-md border border-slate-300 bg-slate-50 text-[#1E293B] text-xs font-medium hover:bg-slate-100"
          >
            <Upload className="w-4 h-4" />
            Chọn tệp sao lưu (.json)
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            onChange={handleFilePick}
            className="hidden"
          />

          {pendingPayload && (
            <div className="p-3.5 rounded-md bg-amber-50 border border-amber-300 space-y-3 text-xs">
              <div className="font-semibold text-amber-900 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                Xác nhận khôi phục dữ liệu (Phiên bản {pendingPayload.schemaVersion})
              </div>
              <div className="text-amber-900">
                Ngày xuất: {new Date(pendingPayload.exportedAt).toLocaleString('vi-VN')} ·{' '}
                {pendingPayload.data.exams.length} kỳ thi · {pendingPayload.data.students.length} học sinh ·{' '}
                {pendingPayload.data.submissions.length} bài thi.
              </div>
              <div className="space-y-1.5">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rmode"
                    checked={restoreMode === 'merge'}
                    onChange={() => setRestoreMode('merge')}
                  />
                  Gộp thêm vào dữ liệu hiện tại (an toàn)
                </label>
                <label className="flex items-center gap-2 cursor-pointer text-[#DC2626] font-medium">
                  <input
                    type="radio"
                    name="rmode"
                    checked={restoreMode === 'replace'}
                    onChange={() => setRestoreMode('replace')}
                  />
                  Ghi đè toàn bộ dữ liệu hiện tại (không thể hoàn tác)
                </label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleConfirmRestore}
                  className="px-3.5 py-1.5 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700"
                >
                  Xác nhận khôi phục
                </button>
                <button
                  type="button"
                  onClick={() => setPendingPayload(null)}
                  className="px-3 py-1.5 rounded border border-slate-300 bg-white"
                >
                  Hủy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Optional Google Drive Backup Privacy Notice */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5 text-xs">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 font-semibold text-[#1E293B]">
            <Cloud className="w-4 h-4 text-[#2563EB]" />
            Đồng bộ Google Drive (Tùy chọn, tắt mặc định)
          </div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={settings.googleDriveSyncEnabled}
              onChange={(e) =>
                updateSettings({ ...settings, googleDriveSyncEnabled: e.target.checked })
              }
            />
            Bật tùy chọn đồng bộ
          </label>
        </div>
        <p className="text-slate-600 leading-relaxed">
          Hệ thống mặc định lưu 100% dữ liệu trên máy và không gửi dữ liệu học sinh lên bất kỳ máy chủ nào. Nếu giáo viên chủ động bật đồng bộ Google Drive, chỉ tệp JSON sao lưu do bạn chọn mới được tải lên bằng Google OAuth phía trình duyệt (không lưu Client Secret trong mã nguồn).
        </p>
        {settings.googleDriveSyncEnabled && (
          <div className="pt-2 flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={settings.googleClientId}
              onChange={(e) =>
                updateSettings({ ...settings, googleClientId: e.target.value })
              }
              placeholder="Google OAuth Client ID (của bạn)..."
              className="flex-1 min-w-[240px] px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
            />
            <span className="text-[11px] text-slate-500">
              Nhập Client ID đã cấu hình phạm vi drive.file để sử dụng khi triển khai.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

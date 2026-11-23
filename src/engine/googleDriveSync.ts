/** Google Drive backup of confirmed official grading results. OAuth token stays in memory. */
import { exportOfficialOnlyBackup } from '../db/database';

const CONFIG_KEY = 'chamthi_drive_oauth_client_id';
const AUTO_KEY = 'chamthi_drive_auto_sync';
const FILE_KEY = 'chamthi_drive_result_file_id';
const FOLDER_KEY = 'chamthi_drive_folder_id';
const SCOPE = 'https://www.googleapis.com/auth/drive.file';
let accessToken: string | null = null;
let expiresAt = 0;
let busy: Promise<string> | null = null;
let debounce: ReturnType<typeof setTimeout> | undefined;

export const driveConfig = {
  getClientId: () => localStorage.getItem(CONFIG_KEY) || import.meta.env.VITE_GOOGLE_CLIENT_ID || '',
  setClientId: (id: string) => localStorage.setItem(CONFIG_KEY, id.trim()),
  autoEnabled: () => localStorage.getItem(AUTO_KEY) === 'true',
  setAuto: (enabled: boolean) => localStorage.setItem(AUTO_KEY, String(enabled)),
  isConnected: () => Boolean(accessToken && Date.now() < expiresAt),
  disconnect: () => { accessToken = null; expiresAt = 0; },
};

type TokenClient = { requestAccessToken: (opts?: { prompt?: string }) => void };
type GoogleIdentity = { accounts: { oauth2: { initTokenClient: (opts: {
  client_id: string; scope: string; callback: (response: { access_token?: string; expires_in?: number; error?: string }) => void;
}) => TokenClient } } };
declare global { interface Window { google?: GoogleIdentity } }

function loadIdentity(): Promise<void> {
  if (window.google?.accounts.oauth2) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const existing = document.querySelector('script[data-chamthi-google]');
    if (existing) {
      existing.addEventListener('load', () => resolve(), { once: true });
      existing.addEventListener('error', () => reject(new Error('Không tải được Google Identity.')), { once: true });
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://accounts.google.com/gsi/client';
    script.async = true;
    script.dataset.chamthiGoogle = 'true';
    script.onload = () => resolve();
    script.onerror = () => reject(new Error('Không tải được Google Identity.'));
    document.head.appendChild(script);
  });
}

/** Must be called from a user click. Never prompts for Google permissions in background. */
export async function connectGoogleDrive(): Promise<void> {
  const clientId = driveConfig.getClientId();
  if (!clientId) throw new Error('Chưa cấu hình Google OAuth Client ID cho ứng dụng.');
  if (!navigator.onLine) throw new Error('Cần kết nối Internet để cấp quyền Google Drive.');
  await loadIdentity();
  return new Promise<void>((resolve, reject) => {
    window.google!.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: SCOPE,
      callback: response => {
        if (response.error || !response.access_token) {
          reject(new Error(`Không được cấp quyền Google Drive: ${response.error || 'Không có mã truy cập'}`));
          return;
        }
        accessToken = response.access_token;
        expiresAt = Date.now() + (response.expires_in || 3600) * 1000 - 60_000;
        resolve();
      },
    }).requestAccessToken({ prompt: 'consent' });
  });
}

async function api(path: string, init: RequestInit = {}): Promise<Response> {
  if (!driveConfig.isConnected()) throw new Error('Phiên Google Drive hết hạn. Vui lòng nhấn Kết nối lại.');
  const res = await fetch(`https://www.googleapis.com${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${accessToken}`, ...(init.headers || {}) },
  });
  if (!res.ok) throw new Error(`Google Drive HTTP ${res.status}: ${(await res.text()).slice(0, 240)}`);
  return res;
}

async function folderId(): Promise<string> {
  const saved = localStorage.getItem(FOLDER_KEY);
  if (saved) return saved;
  const res = await api('/drive/v3/files?fields=id', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name: 'CHAM THI THONG MINH', mimeType: 'application/vnd.google-apps.folder' }),
  });
  const { id } = await res.json() as { id: string };
  localStorage.setItem(FOLDER_KEY, id);
  return id;
}

function toCsv(rows: Array<Record<string, string | number>>): string {
  const fields = ['Kỳ thi', 'Số báo danh', 'Mã đề', 'Điểm', 'Điểm tối đa', 'Đúng', 'Sai', 'Trống', 'Trạng thái', 'Cập nhật'];
  const escape = (v: string | number) => `"${String(v).replace(/"/g, '""')}"`;
  return '\uFEFF' + [fields.join(','), ...rows.map(row => fields.map(k => escape(row[k] ?? '')).join(','))].join('\r\n');
}

async function uploadCsv(csv: string, folder: string): Promise<void> {
  const existingId = localStorage.getItem(FILE_KEY);
  const file = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  if (existingId) {
    try {
      await api(`/upload/drive/v3/files/${encodeURIComponent(existingId)}?uploadType=media`, {
        method: 'PATCH', headers: { 'Content-Type': 'text/csv;charset=utf-8' }, body: file,
      });
      return;
    } catch (err) {
      // Only recreate a deleted file. Never create duplicates for network/auth failures.
      if (!(err instanceof Error) || !err.message.includes('HTTP 404')) throw err;
      localStorage.removeItem(FILE_KEY);
    }
  }
  const boundary = `chamthi_${Date.now()}`;
  const metadata = JSON.stringify({ name: 'Bang_diem_chinh_thuc.csv', parents: [folder], mimeType: 'text/csv' });
  const body = new Blob([
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
    `--${boundary}\r\nContent-Type: text/csv; charset=UTF-8\r\n\r\n`,
    file, `\r\n--${boundary}--`,
  ], { type: `multipart/related; boundary=${boundary}` });
  const res = await api('/upload/drive/v3/files?uploadType=multipart&fields=id', { method: 'POST', body, headers: { 'Content-Type': `multipart/related; boundary=${boundary}` } });
  const { id } = await res.json() as { id: string };
  localStorage.setItem(FILE_KEY, id);
}

/** Uploads only confirmed, non-practice grades. Does not upload raw student images. */
export function syncConfirmedGrades(): Promise<string> {
  if (busy) return busy;
  busy = (async () => {
    if (!navigator.onLine) throw new Error('Đang ngoại tuyến. Kết quả đã lưu cục bộ, sẽ đồng bộ khi có mạng.');
    const backup = await exportOfficialOnlyBackup();
    const exams = new Map(backup.data.exams.map(e => [e.id, e.name]));
    const confirmed = backup.data.submissions.filter(s => s.status === 'graded' && exams.has(s.examId));
    if (!confirmed.length) return 'Chưa có bài chấm chính thức đã xác nhận để đồng bộ.';
    const rows = confirmed.map(s => ({
      'Kỳ thi': exams.get(s.examId) || '', 'Số báo danh': s.sbd, 'Mã đề': s.examCode,
      'Điểm': s.scoreBreakdown.total, 'Điểm tối đa': s.scoreBreakdown.maxPossible,
      'Đúng': s.scoreBreakdown.correctCount, 'Sai': s.scoreBreakdown.wrongCount,
      'Trống': s.scoreBreakdown.blankCount, 'Trạng thái': s.status,
      'Cập nhật': new Date(s.updatedAt).toISOString(),
    }));
    await uploadCsv(toCsv(rows), await folderId());
    localStorage.setItem('chamthi_drive_last_sync', new Date().toISOString());
    window.dispatchEvent(new Event('chamthi:drive-synced'));
    return `Đã đồng bộ ${confirmed.length} bài chấm chính thức lên Google Drive.`;
  })().finally(() => { busy = null; });
  return busy;
}

/** Background retries only while an existing OAuth session is valid. */
export function scheduleDriveSync(): void {
  if (!driveConfig.autoEnabled() || !driveConfig.isConnected() || !navigator.onLine) return;
  if (debounce) clearTimeout(debounce);
  debounce = setTimeout(() => { void syncConfirmedGrades().catch(() => {}); }, 1800);
}

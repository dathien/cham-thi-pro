import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type {
  AnswerKey,
  AppSettings,
  ClassRoom,
  Exam,
  ExamSubmission,
  SheetTemplate,
  Student,
} from '../types/omr';

export const DB_NAME = 'chamthi_smart_db';
export const DB_VERSION = 1;
export const BACKUP_SCHEMA_VERSION = '1.0.0';

export const DEFAULT_SETTINGS: AppSettings = {
  fillThreshold: 0.34,
  faintThreshold: 0.21,
  multiMarkDelta: 0.12,
  eraseRingThreshold: 0.22,
  blurMinScore: 45,
  darkMinBrightness: 55,
  autoCaptureFrames: 4,
  soundEnabled: true,
  hideStudentInfoOnPhach: true,
  showRankingDefault: false,
  reportCommentBands: [
    {
      minScore: 9,
      title: '9,0 – 10,0 điểm',
      commentTemplate:
        'Bài làm đạt kết quả rất tốt, nắm vững kiến thức trọng tâm và xử lý chính xác các câu hỏi trong đề.',
    },
    {
      minScore: 8,
      title: '8,0 – dưới 9,0 điểm',
      commentTemplate:
        'Bài làm đạt kết quả tốt, kiến thức vững vàng; cần rà soát thêm một số chi tiết nhỏ để tối ưu điểm số.',
    },
    {
      minScore: 6.5,
      title: '6,5 – dưới 8,0 điểm',
      commentTemplate:
        'Bài làm đạt mức khá, nắm được các nội dung cơ bản; nên luyện tập thêm các câu hỏi vận dụng để nâng cao kết quả.',
    },
    {
      minScore: 5,
      title: '5,0 – dưới 6,5 điểm',
      commentTemplate:
        'Bài làm đạt mức trung bình; cần hệ thống lại kiến thức nền tảng và đọc kỹ đề bài hơn khi làm bài.',
    },
    {
      minScore: 3.5,
      title: '3,5 – dưới 5,0 điểm',
      commentTemplate:
        'Bài làm chưa đạt mức yêu cầu; cần ôn tập kỹ lại các kiến thức cơ bản và luyện tập thêm dạng bài tương tự.',
    },
    {
      minScore: 0,
      title: 'Dưới 3,5 điểm',
      commentTemplate:
        'Kết quả còn hạn chế so với yêu cầu đề kiểm tra; nên trao đổi cùng giáo viên để được hướng dẫn củng cố kiến thức nền.',
    },
  ],
  vnEduColumnMap: {
    sbd: 'Số báo danh',
    fullName: 'Họ và tên',
    className: 'Lớp',
    totalScore: 'Điểm TB/Tổng',
    note: 'Ghi chú',
  },
  smasColumnMap: {
    studentCode: 'Mã học sinh',
    fullName: 'Họ tên',
    className: 'Lớp học',
    totalScore: 'Điểm kiểm tra',
    note: 'Nhận xét',
  },
  googleDriveSyncEnabled: false,
  googleClientId: '',
};

export interface BlobRecord {
  id: string;
  dataUrl: string;
  mimeType: string;
  createdAt: number;
}

interface ChamThiDB extends DBSchema {
  exams: { key: string; value: Exam };
  classes: { key: string; value: ClassRoom };
  students: { key: string; value: Student; indexes: { 'by-class': string; 'by-sbd': string } };
  templates: { key: string; value: SheetTemplate };
  answerKeys: { key: string; value: AnswerKey; indexes: { 'by-exam': string } };
  submissions: { key: string; value: ExamSubmission; indexes: { 'by-exam': string; 'by-sbd': string } };
  blobs: { key: string; value: BlobRecord };
  settings: { key: string; value: { key: string; value: unknown } };
}

let dbPromise: Promise<IDBPDatabase<ChamThiDB>> | null = null;

export function getDB(): Promise<IDBPDatabase<ChamThiDB>> {
  if (!dbPromise) {
    dbPromise = openDB<ChamThiDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('exams')) {
          db.createObjectStore('exams', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('classes')) {
          db.createObjectStore('classes', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('students')) {
          const store = db.createObjectStore('students', { keyPath: 'id' });
          store.createIndex('by-class', 'classId');
          store.createIndex('by-sbd', 'sbd');
        }
        if (!db.objectStoreNames.contains('templates')) {
          db.createObjectStore('templates', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('answerKeys')) {
          const store = db.createObjectStore('answerKeys', { keyPath: 'id' });
          store.createIndex('by-exam', 'examId');
        }
        if (!db.objectStoreNames.contains('submissions')) {
          const store = db.createObjectStore('submissions', { keyPath: 'id' });
          store.createIndex('by-exam', 'examId');
          store.createIndex('by-sbd', 'sbd');
        }
        if (!db.objectStoreNames.contains('blobs')) {
          db.createObjectStore('blobs', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function loadAllData() {
  const db = await getDB();
  const [exams, classes, students, templates, answerKeys, submissions, settingsRow] = await Promise.all([
    db.getAll('exams'),
    db.getAll('classes'),
    db.getAll('students'),
    db.getAll('templates'),
    db.getAll('answerKeys'),
    db.getAll('submissions'),
    db.get('settings', 'app_settings'),
  ]);
  const settings: AppSettings = {
    ...DEFAULT_SETTINGS,
    ...((settingsRow?.value as Partial<AppSettings>) || {}),
  };
  return {
    exams: exams.sort((a, b) => b.updatedAt - a.updatedAt),
    classes: classes.sort((a, b) => a.name.localeCompare(b.name, 'vi')),
    students,
    templates,
    answerKeys,
    submissions: submissions.sort((a, b) => b.createdAt - a.createdAt),
    settings,
  };
}

export async function saveExam(exam: Exam) {
  const db = await getDB();
  await db.put('exams', exam);
}

export async function deleteExamCascade(examId: string) {
  const db = await getDB();
  const keys = await db.getAllFromIndex('answerKeys', 'by-exam', examId);
  const subs = await db.getAllFromIndex('submissions', 'by-exam', examId);
  const tx = db.transaction(['exams', 'answerKeys', 'submissions', 'blobs'], 'readwrite');
  await tx.objectStore('exams').delete(examId);
  for (const k of keys) await tx.objectStore('answerKeys').delete(k.id);
  for (const s of subs) {
    await tx.objectStore('submissions').delete(s.id);
    if (s.originalImageBlobId) await tx.objectStore('blobs').delete(s.originalImageBlobId);
    if (s.warpedImageBlobId) await tx.objectStore('blobs').delete(s.warpedImageBlobId);
  }
  await tx.done;
}

export async function saveClassRoom(cls: ClassRoom) {
  const db = await getDB();
  await db.put('classes', cls);
}

export async function deleteClassRoom(classId: string) {
  const db = await getDB();
  await db.delete('classes', classId);
}

export async function saveStudent(student: Student) {
  const db = await getDB();
  await db.put('students', student);
}

export async function saveStudentsBulk(students: Student[]) {
  const db = await getDB();
  const tx = db.transaction('students', 'readwrite');
  for (const s of students) await tx.store.put(s);
  await tx.done;
}

export async function deleteStudent(studentId: string) {
  const db = await getDB();
  await db.delete('students', studentId);
}

export async function saveTemplate(tpl: SheetTemplate) {
  const db = await getDB();
  await db.put('templates', tpl);
}

export async function deleteTemplate(templateId: string) {
  const db = await getDB();
  await db.delete('templates', templateId);
}

export async function saveAnswerKey(ak: AnswerKey) {
  const db = await getDB();
  await db.put('answerKeys', ak);
}

export async function deleteAnswerKey(id: string) {
  const db = await getDB();
  await db.delete('answerKeys', id);
}

export async function saveSubmission(sub: ExamSubmission) {
  const db = await getDB();
  await db.put('submissions', sub);
}

export async function deleteSubmission(subId: string) {
  const db = await getDB();
  const existing = await db.get('submissions', subId);
  const tx = db.transaction(['submissions', 'blobs'], 'readwrite');
  await tx.objectStore('submissions').delete(subId);
  if (existing?.originalImageBlobId) await tx.objectStore('blobs').delete(existing.originalImageBlobId);
  if (existing?.warpedImageBlobId) await tx.objectStore('blobs').delete(existing.warpedImageBlobId);
  await tx.done;
}

export async function saveBlob(id: string, dataUrl: string, mimeType = 'image/jpeg') {
  const db = await getDB();
  await db.put('blobs', { id, dataUrl, mimeType, createdAt: Date.now() });
}

export async function getBlob(id: string): Promise<BlobRecord | undefined> {
  if (!id) return undefined;
  const db = await getDB();
  return db.get('blobs', id);
}

export async function saveSettings(settings: AppSettings) {
  const db = await getDB();
  await db.put('settings', { key: 'app_settings', value: settings });
}

export interface BackupPayload {
  app: 'chamthi-smart';
  schemaVersion: string;
  exportedAt: number;
  scope: 'full' | 'exam';
  examId?: string;
  data: {
    exams: Exam[];
    classes: ClassRoom[];
    students: Student[];
    templates: SheetTemplate[];
    answerKeys: AnswerKey[];
    submissions: ExamSubmission[];
    blobs: BlobRecord[];
    settings?: AppSettings;
  };
}

export async function exportBackup(scope: 'full' | 'exam', examId?: string): Promise<BackupPayload> {
  const db = await getDB();
  const [exams, classes, students, templates, answerKeys, submissions, blobs, settingsRow] =
    await Promise.all([
      db.getAll('exams'),
      db.getAll('classes'),
      db.getAll('students'),
      db.getAll('templates'),
      db.getAll('answerKeys'),
      db.getAll('submissions'),
      db.getAll('blobs'),
      db.get('settings', 'app_settings'),
    ]);

  if (scope === 'exam' && examId) {
    const filteredExams = exams.filter((e) => e.id === examId);
    const filteredSubs = submissions.filter((s) => s.examId === examId);
    const blobIds = new Set<string>();
    for (const s of filteredSubs) {
      if (s.originalImageBlobId) blobIds.add(s.originalImageBlobId);
      if (s.warpedImageBlobId) blobIds.add(s.warpedImageBlobId);
    }
    return {
      app: 'chamthi-smart',
      schemaVersion: BACKUP_SCHEMA_VERSION,
      exportedAt: Date.now(),
      scope: 'exam',
      examId,
      data: {
        exams: filteredExams,
        classes,
        students,
        templates: templates.filter((t) => filteredExams.some((e) => e.templateId === t.id) || !t.isBuiltIn),
        answerKeys: answerKeys.filter((a) => a.examId === examId),
        submissions: filteredSubs,
        blobs: blobs.filter((b) => blobIds.has(b.id)),
      },
    };
  }

  return {
    app: 'chamthi-smart',
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: Date.now(),
    scope: 'full',
    data: {
      exams,
      classes,
      students,
      templates,
      answerKeys,
      submissions,
      blobs,
      settings: (settingsRow?.value as AppSettings) || DEFAULT_SETTINGS,
    },
  };
}

export async function restoreBackup(payload: BackupPayload, mode: 'replace' | 'merge'): Promise<void> {
  if (payload.app !== 'chamthi-smart' || !payload.schemaVersion || !payload.data) {
    throw new Error('Tệp sao lưu không hợp lệ hoặc không đúng định dạng Chấm Thi Thông Minh.');
  }
  const db = await getDB();
  const stores = ['exams', 'classes', 'students', 'templates', 'answerKeys', 'submissions', 'blobs', 'settings'] as const;
  const tx = db.transaction(stores, 'readwrite');

  if (mode === 'replace') {
    for (const st of ['exams', 'classes', 'students', 'answerKeys', 'submissions', 'blobs'] as const) {
      await tx.objectStore(st).clear();
    }
    const existingTemplates = await tx.objectStore('templates').getAll();
    for (const t of existingTemplates) {
      if (!t.isBuiltIn) await tx.objectStore('templates').delete(t.id);
    }
  }

  for (const e of payload.data.exams || []) await tx.objectStore('exams').put(e);
  for (const c of payload.data.classes || []) await tx.objectStore('classes').put(c);
  for (const s of payload.data.students || []) await tx.objectStore('students').put(s);
  for (const t of payload.data.templates || []) await tx.objectStore('templates').put(t);
  for (const a of payload.data.answerKeys || []) await tx.objectStore('answerKeys').put(a);
  for (const sub of payload.data.submissions || []) await tx.objectStore('submissions').put(sub);
  for (const b of payload.data.blobs || []) await tx.objectStore('blobs').put(b);
  if (payload.data.settings) {
    await tx.objectStore('settings').put({ key: 'app_settings', value: payload.data.settings });
  }
  await tx.done;
}

export async function getStorageUsageEstimate(): Promise<{
  usageBytes: number;
  quotaBytes: number;
  percentUsed: number;
}> {
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    const est = await navigator.storage.estimate();
    const usageBytes = est.usage || 0;
    const quotaBytes = est.quota || 0;
    const percentUsed = quotaBytes > 0 ? (usageBytes / quotaBytes) * 100 : 0;
    return { usageBytes, quotaBytes, percentUsed };
  }
  return { usageBytes: 0, quotaBytes: 0, percentUsed: 0 };
}

export interface PracticeMeta {
  initialized: boolean;
  deletedByUser: boolean;
  starterOmrSeeded: boolean;
}

export async function getPracticeMeta(): Promise<PracticeMeta> {
  const db = await getDB();
  const row = await db.get('settings', 'practice_meta');
  return (
    (row?.value as PracticeMeta) || {
      initialized: false,
      deletedByUser: false,
      starterOmrSeeded: false,
    }
  );
}

export async function savePracticeMeta(meta: PracticeMeta) {
  const db = await getDB();
  await db.put('settings', { key: 'practice_meta', value: meta });
}

export async function writePracticeBaseRecords(params: {
  exams: Exam[];
  classes: ClassRoom[];
  students: Student[];
  answerKeys: AnswerKey[];
}) {
  const db = await getDB();
  const tx = db.transaction(['exams', 'classes', 'students', 'answerKeys'], 'readwrite');
  for (const e of params.exams) await tx.objectStore('exams').put(e);
  for (const c of params.classes) await tx.objectStore('classes').put(c);
  for (const s of params.students) await tx.objectStore('students').put(s);
  for (const k of params.answerKeys) await tx.objectStore('answerKeys').put(k);
  await tx.done;
}

export async function deleteAllPracticeData(): Promise<void> {
  const db = await getDB();
  const [exams, classes, students, answerKeys, submissions] = await Promise.all([
    db.getAll('exams'),
    db.getAll('classes'),
    db.getAll('students'),
    db.getAll('answerKeys'),
    db.getAll('submissions'),
  ]);
  const tx = db.transaction(
    ['exams', 'classes', 'students', 'answerKeys', 'submissions', 'blobs', 'settings'],
    'readwrite'
  );
  for (const e of exams) if (e.isPractice) await tx.objectStore('exams').delete(e.id);
  for (const c of classes) if (c.isPractice) await tx.objectStore('classes').delete(c.id);
  for (const s of students) if (s.isPractice) await tx.objectStore('students').delete(s.id);
  for (const k of answerKeys) if (k.isPractice) await tx.objectStore('answerKeys').delete(k.id);
  for (const sub of submissions) {
    if (sub.isPractice) {
      await tx.objectStore('submissions').delete(sub.id);
      if (sub.originalImageBlobId) await tx.objectStore('blobs').delete(sub.originalImageBlobId);
      if (sub.warpedImageBlobId) await tx.objectStore('blobs').delete(sub.warpedImageBlobId);
    }
  }
  await tx.objectStore('settings').put({
    key: 'practice_meta',
    value: { initialized: false, deletedByUser: true, starterOmrSeeded: false },
  });
  await tx.done;
}

export async function exportOfficialOnlyBackup(): Promise<BackupPayload> {
  const full = await exportBackup('full');
  const officialSubs = full.data.submissions.filter((s) => !s.isPractice && !s.isTestSample);
  const blobIds = new Set<string>();
  for (const s of officialSubs) {
    if (s.originalImageBlobId) blobIds.add(s.originalImageBlobId);
    if (s.warpedImageBlobId) blobIds.add(s.warpedImageBlobId);
  }
  return {
    ...full,
    data: {
      exams: full.data.exams.filter((e) => !e.isPractice),
      classes: full.data.classes.filter((c) => !c.isPractice),
      students: full.data.students.filter((s) => !s.isPractice),
      templates: full.data.templates.filter((t) => !t.isBuiltIn),
      answerKeys: full.data.answerKeys.filter((k) => !k.isPractice),
      submissions: officialSubs,
      blobs: full.data.blobs.filter((b) => blobIds.has(b.id)),
      settings: full.data.settings,
    },
  };
}

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  DEFAULT_SETTINGS,
  deleteAllPracticeData,
  deleteAnswerKey,
  deleteClassRoom,
  deleteExamCascade,
  deleteStudent,
  deleteSubmission,
  deleteTemplate,
  getPracticeMeta,
  loadAllData,
  saveAnswerKey,
  saveBlob,
  saveClassRoom,
  saveExam,
  savePracticeMeta,
  saveSettings,
  saveStudent,
  saveStudentsBulk,
  saveSubmission,
  saveTemplate,
  writePracticeBaseRecords,
  type PracticeMeta,
} from '../db/database';
import { processSheetImageWithOpenCV } from '../engine/omrEngine';
import {
  ensureOpenCVReady,
  subscribeOpenCVStatus,
  type OpenCVStatus,
} from '../engine/opencvLoader';
import {
  buildPracticeAnswerKeys,
  buildPracticeClasses,
  buildPracticeExams,
  buildPracticeSheets225,
  buildPracticeStudents,
  buildSimSpecForPracticeSheet,
} from '../engine/practiceData';
import { drawTemplateOnCanvas } from '../engine/sheetRenderer';
import { getBuiltInTemplates } from '../engine/templates';
import type {
  AnswerKey,
  AppSettings,
  ClassRoom,
  Exam,
  ExamSubmission,
  NavPage,
  PracticeSheetSpec,
  SheetTemplate,
  Student,
} from '../types/omr';

export type DataScope = 'practice' | 'official';

export interface PracticeGradeRunItem {
  sheet: PracticeSheetSpec;
  submissionId: string;
  detectedSbd: string;
  detectedExamCode: string;
  omrScore: number;
  expectedScore: number;
  status: ExamSubmission['status'];
  matchedExpected: boolean;
  durationMs: number;
  error?: string;
}

interface AppContextValue {
  ready: boolean;
  activePage: NavPage;
  setActivePage: (page: NavPage) => void;
  dataScope: DataScope;
  setDataScope: (scope: DataScope) => void;
  practiceMeta: PracticeMeta;
  starterSeedingStatus: { active: boolean; done: number; total: number } | null;
  focusedReviewId: string | null;
  setFocusedReviewId: (id: string | null) => void;
  openReviewSubmission: (subId: string, examId?: string) => void;
  focusedReportCardSubId: string | null;
  setFocusedReportCardSubId: (id: string | null) => void;
  openReportCardSubmission: (subId: string, examId?: string) => void;
  exams: Exam[];
  allExams: Exam[];
  activeExamId: string | null;
  setActiveExamId: (id: string | null) => void;
  activeExam: Exam | null;
  classes: ClassRoom[];
  students: Student[];
  templates: SheetTemplate[];
  answerKeys: AnswerKey[];
  submissions: ExamSubmission[];
  settings: AppSettings;
  opencvStatus: OpenCVStatus;
  opencvError: string | null;
  retryLoadOpenCV: () => void;
  reloadFromDB: () => Promise<void>;
  upsertExam: (exam: Exam) => Promise<void>;
  removeExam: (examId: string) => Promise<void>;
  upsertClass: (cls: ClassRoom) => Promise<void>;
  removeClass: (classId: string) => Promise<void>;
  upsertStudent: (student: Student) => Promise<void>;
  upsertStudentsBulk: (students: Student[]) => Promise<void>;
  removeStudent: (studentId: string) => Promise<void>;
  upsertTemplate: (tpl: SheetTemplate) => Promise<void>;
  removeTemplate: (templateId: string) => Promise<void>;
  upsertAnswerKey: (ak: AnswerKey) => Promise<void>;
  removeAnswerKey: (id: string) => Promise<void>;
  upsertSubmission: (sub: ExamSubmission) => Promise<void>;
  removeSubmission: (subId: string) => Promise<void>;
  updateSettings: (next: AppSettings) => Promise<void>;
  restorePracticeDataset: () => Promise<void>;
  deletePracticeDataset: () => Promise<void>;
  runPracticeGrading: (
    sheets: PracticeSheetSpec[],
    onProgress?: (done: number, total: number, last?: PracticeGradeRunItem) => void,
    options?: { forceRegrade?: boolean }
  ) => Promise<PracticeGradeRunItem[]>;
}

const AppContext = createContext<AppContextValue | null>(null);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [ready, setReady] = useState(false);
  const [activePage, setActivePage] = useState<NavPage>('overview');
  const [dataScope, setDataScopeState] = useState<DataScope>(() => {
    const saved = localStorage.getItem('chamthi_data_scope');
    return saved === 'official' ? 'official' : 'practice';
  });
  const [practiceMeta, setPracticeMeta] = useState<PracticeMeta>({
    initialized: false,
    deletedByUser: false,
    starterOmrSeeded: false,
  });
  const [starterSeedingStatus, setStarterSeedingStatus] = useState<{
    active: boolean;
    done: number;
    total: number;
  } | null>(null);
  const [focusedReviewId, setFocusedReviewId] = useState<string | null>(null);
  const [focusedReportCardSubId, setFocusedReportCardSubId] = useState<string | null>(null);

  const [allExams, setAllExams] = useState<Exam[]>([]);
  const [activeExamId, setActiveExamIdState] = useState<string | null>(() =>
    localStorage.getItem('chamthi_active_exam_id')
  );
  const [allClasses, setAllClasses] = useState<ClassRoom[]>([]);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [templates, setTemplates] = useState<SheetTemplate[]>([]);
  const [allAnswerKeys, setAllAnswerKeys] = useState<AnswerKey[]>([]);
  const [allSubmissions, setAllSubmissions] = useState<ExamSubmission[]>([]);
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [opencvStatus, setOpencvStatus] = useState<OpenCVStatus>('idle');
  const [opencvError, setOpencvError] = useState<string | null>(null);

  const starterSeedLockRef = useRef(false);

  const setDataScope = useCallback((scope: DataScope) => {
    setDataScopeState(scope);
    localStorage.setItem('chamthi_data_scope', scope);
  }, []);

  const setActiveExamId = useCallback((id: string | null) => {
    setActiveExamIdState(id);
    if (id) localStorage.setItem('chamthi_active_exam_id', id);
    else localStorage.removeItem('chamthi_active_exam_id');
  }, []);

  const reloadFromDB = useCallback(async () => {
    let meta = await getPracticeMeta();

    // Initialize practice dataset exactly once on first run unless user explicitly deleted it
    if (!meta.initialized && !meta.deletedByUser) {
      await writePracticeBaseRecords({
        exams: buildPracticeExams(),
        classes: buildPracticeClasses(),
        students: buildPracticeStudents(),
        answerKeys: buildPracticeAnswerKeys(),
      });
      meta = { initialized: true, deletedByUser: false, starterOmrSeeded: false };
      await savePracticeMeta(meta);
    }

    const data = await loadAllData();
    const builtIn = getBuiltInTemplates();
    const existingMap = new Map(data.templates.map((t) => [t.id, t]));
    const mergedTemplates: SheetTemplate[] = [];
    for (const bt of builtIn) {
      const ex = existingMap.get(bt.id);
      if (!ex || ex.version !== bt.version) {
        await saveTemplate(bt);
        mergedTemplates.push(bt);
      } else {
        mergedTemplates.push(ex);
      }
    }
    for (const t of data.templates) {
      if (!t.isBuiltIn) mergedTemplates.push(t);
    }

    setPracticeMeta(meta);
    setAllExams(data.exams);
    setAllClasses(data.classes);
    setAllStudents(data.students);
    setTemplates(mergedTemplates);
    setAllAnswerKeys(data.answerKeys);
    setAllSubmissions(data.submissions);
    setSettings(data.settings);

    // Pick sensible initial scope
    const hasPractice = data.exams.some((e) => e.isPractice);
    const hasOfficial = data.exams.some((e) => !e.isPractice);
    const savedScope = localStorage.getItem('chamthi_data_scope');
    let nextScope: DataScope = savedScope === 'official' ? 'official' : 'practice';
    if (!hasPractice && hasOfficial) nextScope = 'official';
    else if (meta.deletedByUser && !hasPractice) nextScope = 'official';
    setDataScopeState(nextScope);

    const scopedList = data.exams.filter((e) =>
      nextScope === 'practice' ? !!e.isPractice : !e.isPractice
    );
    const savedId = localStorage.getItem('chamthi_active_exam_id');
    if (savedId && scopedList.some((e) => e.id === savedId)) {
      setActiveExamIdState(savedId);
    } else if (scopedList.length > 0) {
      setActiveExamIdState(scopedList[0].id);
    } else {
      setActiveExamIdState(null);
    }
    setReady(true);
  }, []);

  useEffect(() => {
    reloadFromDB();
    const unsub = subscribeOpenCVStatus((s, err) => {
      setOpencvStatus(s);
      setOpencvError(err);
    });
    ensureOpenCVReady().catch(() => {
      // Surfacing via opencvStatus
    });
    return unsub;
  }, [reloadFromDB]);

  const retryLoadOpenCV = useCallback(() => {
    ensureOpenCVReady().catch(() => {});
  }, []);

  const upsertSubmission = useCallback(
    async (sub: ExamSubmission) => {
      const tagged: ExamSubmission = {
        ...sub,
        isPractice: sub.isPractice ?? dataScope === 'practice',
      };
      await saveSubmission(tagged);
      setAllSubmissions((prev) => {
        const idx = prev.findIndex((s) => s.id === tagged.id);
        return idx >= 0 ? prev.map((s) => (s.id === tagged.id ? tagged : s)) : [tagged, ...prev];
      });
    },
    [dataScope]
  );

  // Real OpenCV grading runner for any subset of PracticeSheetSpec
  const runPracticeGrading = useCallback(
    async (
      sheets: PracticeSheetSpec[],
      onProgress?: (done: number, total: number, last?: PracticeGradeRunItem) => void,
      options?: { forceRegrade?: boolean }
    ): Promise<PracticeGradeRunItem[]> => {
      await ensureOpenCVReady();
      const results: PracticeGradeRunItem[] = [];
      const canvas = document.createElement('canvas');
      const existingById = new Map(allSubmissions.map((s) => [s.id, s]));

      try {
        for (let i = 0; i < sheets.length; i++) {
          const sheet = sheets[i];
          const t0 = performance.now();
          const subId = `sub_prac_${sheet.id}`;
          const existingSub = existingById.get(subId);

          // Reuse valid saved result instead of re-grading unless forced or failed earlier
          if (
            !options?.forceRegrade &&
            existingSub &&
            (existingSub.status === 'graded' || existingSub.editHistory.length > 0)
          ) {
            const isExpectedReviewCase =
              sheet.scenario === 'multi_mark' ||
              sheet.scenario === 'faint_mark' ||
              sheet.scenario === 'erased_mark' ||
              sheet.scenario === 'wrong_exam_code';
            const matchedExpected = isExpectedReviewCase
              ? existingSub.status === 'needs_review'
              : existingSub.sbd === sheet.sbd &&
                existingSub.examCode === sheet.examCode &&
                Math.abs(existingSub.scoreBreakdown.total - sheet.expectedScore) <= 0.05;

            const cachedItem: PracticeGradeRunItem = {
              sheet,
              submissionId: existingSub.id,
              detectedSbd: existingSub.sbd,
              detectedExamCode: existingSub.examCode,
              omrScore: existingSub.scoreBreakdown.total,
              expectedScore: sheet.expectedScore,
              status: existingSub.status,
              matchedExpected,
              durationMs: 1,
            };
            results.push(cachedItem);
            onProgress?.(i + 1, sheets.length, cachedItem);
            continue;
          }

          const ex = allExams.find((e) => e.id === sheet.examId) || buildPracticeExams().find((e) => e.id === sheet.examId);
          const tpl = templates.find((t) => t.id === sheet.templateId);
          const ak = allAnswerKeys.find(
            (k) => k.examId === sheet.examId && k.examCode === sheet.examCode
          );
          const examKeys = allAnswerKeys.filter((k) => k.examId === sheet.examId);

          if (!ex || !tpl) {
            const failItem: PracticeGradeRunItem = {
              sheet,
              submissionId: '',
              detectedSbd: '',
              detectedExamCode: '',
              omrScore: 0,
              expectedScore: sheet.expectedScore,
              status: 'error',
              matchedExpected: false,
              durationMs: Math.round(performance.now() - t0),
              error: 'Thiếu cấu hình kỳ thi hoặc mẫu phiếu.',
            };
            results.push(failItem);
            onProgress?.(i + 1, sheets.length, failItem);
            continue;
          }

          try {
            const sim = buildSimSpecForPracticeSheet(sheet, ak);
            drawTemplateOnCanvas(
              canvas,
              tpl,
              { schoolName: ex.schoolName, examName: ex.name, subject: ex.subject },
              sim
            );
            const origUrl = canvas.toDataURL('image/jpeg', 0.85);
            const omrOutputs = await processSheetImageWithOpenCV(
              canvas,
              tpl,
              examKeys,
              settings
            );

            const res = omrOutputs[0];
            const now = Date.now();
            const origBlobId = `blob_prac_orig_${sheet.id}`;
            const warpBlobId = `blob_prac_warp_${sheet.id}`;
            await saveBlob(origBlobId, origUrl, 'image/jpeg');
            await saveBlob(warpBlobId, res.warpedDataUrl, 'image/jpeg');

            const sub: ExamSubmission = {
              id: subId,
              examId: ex.id,
              templateId: tpl.id,
              examCode: res.recognition.examCode,
              sbd: res.recognition.sbd,
              phachCode: res.recognition.phachCode,
              studentId: sheet.studentId,
              sourceFileName: `ThucHanh_${ex.subject}_${sheet.sbd}.png`,
              originalImageBlobId: origBlobId,
              warpedImageBlobId: warpBlobId,
              qualityMetrics: res.qualityMetrics,
              recognition: res.recognition,
              scoreBreakdown: res.scored.scoreBreakdown,
              status: res.status,
              reviewReasons: res.reviewReasons,
              editHistory: existingSub?.editHistory || [],
              teacherComment: existingSub?.teacherCommentLocked ? existingSub.teacherComment : undefined,
              teacherCommentLocked: existingSub?.teacherCommentLocked,
              isPractice: true,
              practiceSheetId: sheet.id,
              createdAt: existingSub?.createdAt || now,
              updatedAt: now,
            };

            await saveSubmission(sub);
            setAllSubmissions((prev) => {
              const idx = prev.findIndex((s) => s.id === sub.id);
              return idx >= 0 ? prev.map((s) => (s.id === sub.id ? sub : s)) : [sub, ...prev];
            });

            // Check whether OMR output matched expected condition
            const isExpectedReviewCase =
              sheet.scenario === 'multi_mark' ||
              sheet.scenario === 'faint_mark' ||
              sheet.scenario === 'erased_mark' ||
              sheet.scenario === 'wrong_exam_code';

            const matchedExpected = isExpectedReviewCase
              ? res.status === 'needs_review'
              : res.recognition.sbd === sheet.sbd &&
                res.recognition.examCode === sheet.examCode &&
                Math.abs(res.scored.scoreBreakdown.total - sheet.expectedScore) <= 0.05;

            const item: PracticeGradeRunItem = {
              sheet,
              submissionId: sub.id,
              detectedSbd: res.recognition.sbd,
              detectedExamCode: res.recognition.examCode,
              omrScore: res.scored.scoreBreakdown.total,
              expectedScore: sheet.expectedScore,
              status: res.status,
              matchedExpected,
              durationMs: Math.round(performance.now() - t0),
            };
            results.push(item);
            onProgress?.(i + 1, sheets.length, item);
          } catch (err) {
            const failItem: PracticeGradeRunItem = {
              sheet,
              submissionId: '',
              detectedSbd: '',
              detectedExamCode: '',
              omrScore: 0,
              expectedScore: sheet.expectedScore,
              status: 'error',
              matchedExpected: false,
              durationMs: Math.round(performance.now() - t0),
              error: err instanceof Error ? err.message : 'Lỗi OpenCV OMR',
            };
            results.push(failItem);
            onProgress?.(i + 1, sheets.length, failItem);
          }

          // Yield cleanly so browser stays responsive
          await new Promise((r) => setTimeout(r, 12));
        }
      } finally {
        canvas.width = 1;
        canvas.height = 1;
      }

      return results;
    },
    [allExams, templates, allAnswerKeys, allSubmissions, settings]
  );

  // Automatic initial real-OpenCV grading of representative practice sheets across all 5 exams on first run
  useEffect(() => {
    if (
      !ready ||
      opencvStatus !== 'ready' ||
      !practiceMeta.initialized ||
      practiceMeta.deletedByUser ||
      practiceMeta.starterOmrSeeded ||
      starterSeedLockRef.current ||
      templates.length === 0 ||
      allAnswerKeys.length === 0
    ) {
      return;
    }

    starterSeedLockRef.current = true;
    const all225 = buildPracticeSheets225();
    const pickFromExam = (examId: string, indices: number[]) => {
      const subList = all225.filter((s) => s.examId === examId);
      return indices.map((i) => subList[i]).filter(Boolean);
    };
    const starterSheets = [
      ...pickFromExam('exam_prac_toan12', [0, 1, 16, 17, 28, 32]),
      ...pickFromExam('exam_prac_ly11', [0, 16, 28, 34, 44]),
      ...pickFromExam('exam_prac_hoa10', [0, 1, 18, 29]),
      ...pickFromExam('exam_prac_tin12', [0, 16, 28, 32]),
      ...pickFromExam('exam_prac_anh11', [0, 16, 28, 36]),
    ];

    (async () => {
      setStarterSeedingStatus({ active: true, done: 0, total: starterSheets.length });
      try {
        await runPracticeGrading(starterSheets, (done, total) => {
          setStarterSeedingStatus({ active: true, done, total });
        });
        const nextMeta: PracticeMeta = { ...practiceMeta, starterOmrSeeded: true };
        await savePracticeMeta(nextMeta);
        setPracticeMeta(nextMeta);
      } finally {
        setStarterSeedingStatus(null);
      }
    })();
  }, [
    ready,
    opencvStatus,
    practiceMeta,
    templates.length,
    allAnswerKeys.length,
    runPracticeGrading,
  ]);

  // Scoped datasets strictly separating practice & official records
  const exams = useMemo(
    () => allExams.filter((e) => (dataScope === 'practice' ? !!e.isPractice : !e.isPractice)),
    [allExams, dataScope]
  );
  const classes = useMemo(
    () => allClasses.filter((c) => (dataScope === 'practice' ? !!c.isPractice : !c.isPractice)),
    [allClasses, dataScope]
  );
  const students = useMemo(
    () => allStudents.filter((s) => (dataScope === 'practice' ? !!s.isPractice : !s.isPractice)),
    [allStudents, dataScope]
  );
  const answerKeys = useMemo(
    () => allAnswerKeys.filter((k) => (dataScope === 'practice' ? !!k.isPractice : !k.isPractice)),
    [allAnswerKeys, dataScope]
  );
  const submissions = useMemo(
    () => allSubmissions.filter((s) => (dataScope === 'practice' ? !!s.isPractice : !s.isPractice)),
    [allSubmissions, dataScope]
  );

  // Keep activeExamId valid within current scope
  useEffect(() => {
    if (!ready) return;
    if (activeExamId && exams.some((e) => e.id === activeExamId)) return;
    if (exams.length > 0) setActiveExamId(exams[0].id);
    else setActiveExamId(null);
  }, [ready, exams, activeExamId, setActiveExamId]);

  const upsertExam = useCallback(
    async (exam: Exam) => {
      const tagged: Exam = { ...exam, isPractice: exam.isPractice ?? dataScope === 'practice' };
      await saveExam(tagged);
      setAllExams((prev) => {
        const idx = prev.findIndex((e) => e.id === tagged.id);
        const next = idx >= 0 ? prev.map((e) => (e.id === tagged.id ? tagged : e)) : [tagged, ...prev];
        return next.sort((a, b) => b.updatedAt - a.updatedAt);
      });
      setActiveExamId(tagged.id);
    },
    [dataScope, setActiveExamId]
  );

  const removeExam = useCallback(
    async (examId: string) => {
      await deleteExamCascade(examId);
      setAllExams((prev) => prev.filter((e) => e.id !== examId));
      setAllAnswerKeys((prev) => prev.filter((a) => a.examId !== examId));
      setAllSubmissions((prev) => prev.filter((s) => s.examId !== examId));
    },
    []
  );

  const upsertClass = useCallback(
    async (cls: ClassRoom) => {
      const tagged: ClassRoom = { ...cls, isPractice: cls.isPractice ?? dataScope === 'practice' };
      await saveClassRoom(tagged);
      setAllClasses((prev) => {
        const idx = prev.findIndex((c) => c.id === tagged.id);
        const next = idx >= 0 ? prev.map((c) => (c.id === tagged.id ? tagged : c)) : [...prev, tagged];
        return next.sort((a, b) => a.name.localeCompare(b.name, 'vi'));
      });
    },
    [dataScope]
  );

  const removeClass = useCallback(async (classId: string) => {
    await deleteClassRoom(classId);
    setAllClasses((prev) => prev.filter((c) => c.id !== classId));
  }, []);

  const upsertStudent = useCallback(
    async (student: Student) => {
      const tagged: Student = {
        ...student,
        isPractice: student.isPractice ?? dataScope === 'practice',
      };
      await saveStudent(tagged);
      setAllStudents((prev) => {
        const idx = prev.findIndex((s) => s.id === tagged.id);
        return idx >= 0 ? prev.map((s) => (s.id === tagged.id ? tagged : s)) : [...prev, tagged];
      });
    },
    [dataScope]
  );

  const upsertStudentsBulk = useCallback(
    async (list: Student[]) => {
      const tagged = list.map((s) => ({
        ...s,
        isPractice: s.isPractice ?? dataScope === 'practice',
      }));
      await saveStudentsBulk(tagged);
      setAllStudents((prev) => {
        const map = new Map(prev.map((s) => [s.id, s]));
        for (const item of tagged) map.set(item.id, item);
        return Array.from(map.values());
      });
    },
    [dataScope]
  );

  const removeStudent = useCallback(async (studentId: string) => {
    await deleteStudent(studentId);
    setAllStudents((prev) => prev.filter((s) => s.id !== studentId));
  }, []);

  const upsertTemplate = useCallback(async (tpl: SheetTemplate) => {
    await saveTemplate(tpl);
    setTemplates((prev) => {
      const idx = prev.findIndex((t) => t.id === tpl.id);
      return idx >= 0 ? prev.map((t) => (t.id === tpl.id ? tpl : t)) : [...prev, tpl];
    });
  }, []);

  const removeTemplate = useCallback(async (templateId: string) => {
    await deleteTemplate(templateId);
    setTemplates((prev) => prev.filter((t) => t.id !== templateId));
  }, []);

  const upsertAnswerKey = useCallback(
    async (ak: AnswerKey) => {
      const tagged: AnswerKey = { ...ak, isPractice: ak.isPractice ?? dataScope === 'practice' };
      await saveAnswerKey(tagged);
      setAllAnswerKeys((prev) => {
        const idx = prev.findIndex((a) => a.id === tagged.id);
        return idx >= 0 ? prev.map((a) => (a.id === tagged.id ? tagged : a)) : [...prev, tagged];
      });
    },
    [dataScope]
  );

  const removeAnswerKey = useCallback(async (id: string) => {
    await deleteAnswerKey(id);
    setAllAnswerKeys((prev) => prev.filter((a) => a.id !== id));
  }, []);

  const removeSubmission = useCallback(async (subId: string) => {
    await deleteSubmission(subId);
    setAllSubmissions((prev) => prev.filter((s) => s.id !== subId));
  }, []);

  const updateSettings = useCallback(async (next: AppSettings) => {
    await saveSettings(next);
    setSettings(next);
  }, []);

  const restorePracticeDataset = useCallback(async () => {
    starterSeedLockRef.current = false;
    await writePracticeBaseRecords({
      exams: buildPracticeExams(),
      classes: buildPracticeClasses(),
      students: buildPracticeStudents(),
      answerKeys: buildPracticeAnswerKeys(),
    });
    const nextMeta: PracticeMeta = {
      initialized: true,
      deletedByUser: false,
      starterOmrSeeded: false,
    };
    await savePracticeMeta(nextMeta);
    setPracticeMeta(nextMeta);
    setDataScope('practice');
    await reloadFromDB();
  }, [reloadFromDB, setDataScope]);

  const deletePracticeDataset = useCallback(async () => {
    await deleteAllPracticeData();
    starterSeedLockRef.current = false;
    setDataScope('official');
    await reloadFromDB();
  }, [reloadFromDB, setDataScope]);

  const openReviewSubmission = useCallback(
    (subId: string, examId?: string) => {
      if (examId) setActiveExamId(examId);
      setFocusedReviewId(subId);
      setActivePage('review');
    },
    [setActiveExamId]
  );

  const openReportCardSubmission = useCallback(
    (subId: string, examId?: string) => {
      if (examId) setActiveExamId(examId);
      setFocusedReportCardSubId(subId);
      setActivePage('report-cards');
    },
    [setActiveExamId]
  );

  const activeExam = exams.find((e) => e.id === activeExamId) || null;

  return (
    <AppContext.Provider
      value={{
        ready,
        activePage,
        setActivePage,
        dataScope,
        setDataScope,
        practiceMeta,
        starterSeedingStatus,
        focusedReviewId,
        setFocusedReviewId,
        openReviewSubmission,
        focusedReportCardSubId,
        setFocusedReportCardSubId,
        openReportCardSubmission,
        exams,
        allExams,
        activeExamId,
        setActiveExamId,
        activeExam,
        classes,
        students,
        templates,
        answerKeys,
        submissions,
        settings,
        opencvStatus,
        opencvError,
        retryLoadOpenCV,
        reloadFromDB,
        upsertExam,
        removeExam,
        upsertClass,
        removeClass,
        upsertStudent,
        upsertStudentsBulk,
        removeStudent,
        upsertTemplate,
        removeTemplate,
        upsertAnswerKey,
        removeAnswerKey,
        upsertSubmission,
        removeSubmission,
        updateSettings,
        restorePracticeDataset,
        deletePracticeDataset,
        runPracticeGrading,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}

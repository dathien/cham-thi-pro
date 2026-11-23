import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  ClipboardCheck,
  Columns3,
  Download,
  Eye,
  FileSpreadsheet,
  FileText,
  FilterX,
  Lock,
  Play,
  Printer,
  RefreshCw,
  Search,
  Trash2,
  Unlock,
  UserCheck,
  UserX,
  X,
} from 'lucide-react';
import { PDFDocument, rgb } from 'pdf-lib';
import fontkit from '@pdf-lib/fontkit';
import { useApp } from '../context/AppContext';
import { getBlob } from '../db/database';
import {
  DEFAULT_GRADEBOOK_COLUMNS,
  exportExamGradebookXLSX,
  statusLabelVi,
  type GradebookColumnConfig,
} from '../engine/excelExport';
import { buildPracticeSheets225 } from '../engine/practiceData';
import {
  computeCompetitionRanks,
  computeExamAnalytics,
  roundScore,
} from '../engine/scoring';
import { scoreRecognitionAgainstKey } from '../engine/scoring';
import { generateObjectiveComment } from '../engine/sheetRenderer';
import type { ExamSubmission, Student } from '../types/omr';

type ExtendedStatusFilter =
  | 'all'
  | 'graded'
  | 'needs_review'
  | 'unprocessed'
  | 'error'
  | 'absent';

type SortField =
  | 'sbd'
  | 'fullName'
  | 'className'
  | 'examCode'
  | 'part1'
  | 'part2'
  | 'part3'
  | 'total'
  | 'correctCount'
  | 'status';

interface DisplayRow {
  rowKey: string;
  kind: 'submission' | 'absent';
  submission?: ExamSubmission;
  student?: Student;
  sbd: string;
  studentCode: string;
  fullName: string;
  className: string;
  examCode: string;
  phachCode: string;
  part1: number | null;
  part2: number | null;
  part3: number | null;
  total: number | null;
  maxPossible: number;
  correctCount: number | null;
  wrongCount: number | null;
  blankCount: number | null;
  status: ExamSubmission['status'] | 'absent';
  rank: number | null;
  note: string;
}

const INSPECT_MODES: { id: 'annotated' | 'warped' | 'original'; label: string }[] = [
  { id: 'annotated', label: 'Đánh dấu kết quả' },
  { id: 'warped', label: 'Ảnh đã xử lý' },
  { id: 'original', label: 'Ảnh gốc' },
];

export const GradebookPage: React.FC = () => {
  const {
    dataScope,
    setDataScope,
    exams,
    activeExam,
    activeExamId,
    setActiveExamId,
    students,
    templates,
    answerKeys,
    submissions,
    settings,
    opencvStatus,
    upsertSubmission,
    upsertStudent,
    removeSubmission,
    openReviewSubmission,
    openReportCardSubmission,
    runPracticeGrading,
    setActivePage,
  } = useApp();

  // Filters — status defaults to 'all' per Section I
  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const [gradeFilter, setGradeFilter] = useState<string>('all');
  const [classFilter, setClassFilter] = useState<string>('all');
  const [codeFilter, setCodeFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<ExtendedStatusFilter>('all');
  const [passFilter, setPassFilter] = useState<'all' | 'pass' | 'fail'>('all');
  const [minScoreInput, setMinScoreInput] = useState<string>('');
  const [maxScoreInput, setMaxScoreInput] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Table config, sort & pagination
  const [columnConfigs, setColumnConfigs] = useState<GradebookColumnConfig[]>(
    DEFAULT_GRADEBOOK_COLUMNS
  );
  const [showColumnPanel, setShowColumnPanel] = useState(false);
  const [sortField, setSortField] = useState<SortField>('sbd');
  const [sortAsc, setSortAsc] = useState(true);
  const [pageSize, setPageSize] = useState<number>(25);
  const [currentPage, setCurrentPage] = useState(1);

  // Selection, inline inspector, inline delete confirm & notifications
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [inspectedSubId, setInspectedSubId] = useState<string | null>(null);
  const [inspectImgMode, setInspectImgMode] = useState<'annotated' | 'warped' | 'original'>(
    'annotated'
  );
  const [inspectImgUrl, setInspectImgUrl] = useState<string>('');
  const inspectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [confirmDeleteBatch, setConfirmDeleteBatch] = useState(false);
  const [confirmDeleteOneId, setConfirmDeleteOneId] = useState<string | null>(null);

  // Inline editor fields for inspected submission
  const [editSbd, setEditSbd] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editStudentId, setEditStudentId] = useState('');
  const [editComment, setEditComment] = useState('');
  const [editCommentLocked, setEditCommentLocked] = useState(false);

  const [notice, setNotice] = useState<{ type: 'ok' | 'warn'; text: string } | null>(null);
  const [gradingPractice, setGradingPractice] = useState<{
    active: boolean;
    done: number;
    total: number;
  } | null>(null);

  // Available subjects/grades within current scope for quick cross-exam selection
  const availableSubjects = useMemo(
    () => Array.from(new Set(exams.map((e) => e.subject))).sort((a, b) => a.localeCompare(b, 'vi')),
    [exams]
  );
  const availableGrades = useMemo(
    () => Array.from(new Set(exams.map((e) => e.gradeLevel))).sort((a, b) => a.localeCompare(b, 'vi')),
    [exams]
  );
  const filteredExamChoices = useMemo(
    () =>
      exams.filter(
        (e) =>
          (subjectFilter === 'all' || e.subject === subjectFilter) &&
          (gradeFilter === 'all' || e.gradeLevel === gradeFilter)
      ),
    [exams, subjectFilter, gradeFilter]
  );

  // Keep activeExamId aligned when subject/grade narrows choices
  useEffect(() => {
    if (filteredExamChoices.length > 0 && activeExam && !filteredExamChoices.some((e) => e.id === activeExam.id)) {
      setActiveExamId(filteredExamChoices[0].id);
    }
  }, [filteredExamChoices, activeExam, setActiveExamId]);

  const activeTemplate = useMemo(
    () => templates.find((t) => t.id === activeExam?.templateId),
    [templates, activeExam]
  );

  const examSubmissions = useMemo(() => {
    if (!activeExam) return [];
    return submissions.filter((s) => s.examId === activeExam.id && !s.isTestSample);
  }, [submissions, activeExam]);

  const examAnswerKeys = useMemo(() => {
    if (!activeExam) return [];
    return answerKeys.filter((k) => k.examId === activeExam.id);
  }, [answerKeys, activeExam]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);

  const resolveStudent = (sub: ExamSubmission): Student | undefined =>
    (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
    (sub.sbd ? studentBySbd.get(sub.sbd) : undefined);

  // Students belonging to active exam classes
  const examStudents = useMemo(() => {
    if (!activeExam) return [];
    if (activeExam.classNames.length === 0) return students;
    return students.filter((st) => activeExam.classNames.includes(st.className));
  }, [students, activeExam]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>(activeExam?.classNames || []);
    for (const s of examSubmissions) {
      const st = resolveStudent(s);
      if (st?.className) set.add(st.className);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [activeExam, examSubmissions, studentById, studentBySbd]);

  const availableCodes = useMemo(() => {
    const set = new Set<string>(activeExam?.examCodes || []);
    for (const s of examSubmissions) {
      if (s.examCode) set.add(s.examCode);
    }
    return Array.from(set).sort();
  }, [activeExam, examSubmissions]);

  // Detect whether Part II / Part III / Phách exist on template or answer key or submissions
  const hasPart2 = useMemo(() => {
    if (activeTemplate && activeTemplate.part2Count > 0) return true;
    if (examAnswerKeys.some((k) => k.part2Count > 0)) return true;
    return examSubmissions.some((s) => s.scoreBreakdown.part2 > 0);
  }, [activeTemplate, examAnswerKeys, examSubmissions]);

  const hasPart3 = useMemo(() => {
    if (activeTemplate && activeTemplate.part3Count > 0) return true;
    if (examAnswerKeys.some((k) => k.part3Count > 0)) return true;
    return examSubmissions.some((s) => s.scoreBreakdown.part3 > 0);
  }, [activeTemplate, examAnswerKeys, examSubmissions]);

  const hasPhach = useMemo(() => {
    if (activeTemplate && (activeTemplate.phachDigits || 0) > 0) return true;
    return examSubmissions.some((s) => !!s.phachCode);
  }, [activeTemplate, examSubmissions]);

  // Official stats strictly from status === 'graded'
  const gradedSubmissions = useMemo(
    () => examSubmissions.filter((s) => s.status === 'graded'),
    [examSubmissions]
  );
  const reviewCount = useMemo(
    () => examSubmissions.filter((s) => s.status === 'needs_review').length,
    [examSubmissions]
  );
  const unprocessedCount = useMemo(
    () => examSubmissions.filter((s) => s.status === 'unprocessed').length,
    [examSubmissions]
  );
  const errorCount = useMemo(
    () => examSubmissions.filter((s) => s.status === 'error').length,
    [examSubmissions]
  );

  const officialAnalytics = useMemo(() => {
    if (!activeExam) return null;
    return computeExamAnalytics(
      gradedSubmissions,
      examStudents,
      activeExam.id,
      activeExam.passThreshold,
      activeExam.scoreScale
    );
  }, [gradedSubmissions, examStudents, activeExam]);

  const rankMap = useMemo(() => computeCompetitionRanks(gradedSubmissions), [gradedSubmissions]);

  // Practice sheet count for current exam
  const practiceSheetsForExam = useMemo(() => {
    if (!activeExam || !activeExam.isPractice) return [];
    return buildPracticeSheets225().filter((sh) => sh.examId === activeExam.id);
  }, [activeExam]);

  const gradedPracticeCountForExam = useMemo(() => {
    if (!activeExam || !activeExam.isPractice) return 0;
    const set = new Set(examSubmissions.map((s) => s.practiceSheetId).filter(Boolean));
    return set.size;
  }, [activeExam, examSubmissions]);

  // Build combined table rows (all submissions + explicit absent students)
  const allRows = useMemo((): DisplayRow[] => {
    if (!activeExam) return [];
    const rows: DisplayRow[] = [];
    const submittedStudentIds = new Set<string>();
    const submittedSbds = new Set<string>();

    for (const sub of examSubmissions) {
      const st = resolveStudent(sub);
      if (st?.id) submittedStudentIds.add(st.id);
      if (sub.sbd) submittedSbds.add(sub.sbd);

      rows.push({
        rowKey: sub.id,
        kind: 'submission',
        submission: sub,
        student: st,
        sbd: sub.sbd || st?.sbd || '',
        studentCode: st?.studentCode || '',
        fullName: st?.fullName || '(Chưa đối chiếu hồ sơ)',
        className: st?.className || '---',
        examCode: sub.examCode || '',
        phachCode: sub.phachCode || '',
        part1: sub.scoreBreakdown.part1,
        part2: sub.scoreBreakdown.part2,
        part3: sub.scoreBreakdown.part3,
        total: sub.scoreBreakdown.total,
        maxPossible: sub.scoreBreakdown.maxPossible,
        correctCount: sub.scoreBreakdown.correctCount,
        wrongCount: sub.scoreBreakdown.wrongCount,
        blankCount: sub.scoreBreakdown.blankCount,
        status: sub.status,
        rank: sub.status === 'graded' ? rankMap.get(sub.id) ?? null : null,
        note:
          sub.teacherComment?.trim() ||
          (sub.reviewReasons.length > 0 ? sub.reviewReasons.join('; ') : ''),
      });
    }

    // Absent students: explicitly flagged absent OR belonging to exam without any submission when toggled?
    // Section I specifies "Vắng thi" comes from absentExamIds (and teachers can mark absent/present)
    for (const st of examStudents) {
      const hasSub = submittedStudentIds.has(st.id) || (st.sbd && submittedSbds.has(st.sbd));
      if (!hasSub && st.absentExamIds.includes(activeExam.id)) {
        rows.push({
          rowKey: `absent_${st.id}`,
          kind: 'absent',
          student: st,
          sbd: st.sbd,
          studentCode: st.studentCode,
          fullName: st.fullName,
          className: st.className,
          examCode: '---',
          phachCode: '',
          part1: null,
          part2: null,
          part3: null,
          total: null,
          maxPossible: activeExam.scoreScale,
          correctCount: null,
          wrongCount: null,
          blankCount: null,
          status: 'absent',
          rank: null,
          note: 'Vắng thi (không tính điểm 0)',
        });
      }
    }
    return rows;
  }, [activeExam, examSubmissions, examStudents, rankMap, studentById, studentBySbd]);

  // Apply comprehensive filters + sort
  const filteredRows = useMemo(() => {
    const minS = minScoreInput.trim() === '' ? null : Number(minScoreInput.replace(',', '.'));
    const maxS = maxScoreInput.trim() === '' ? null : Number(maxScoreInput.replace(',', '.'));
    const q = searchQuery.trim().toLowerCase();
    const passThr = activeExam?.passThreshold ?? 5;

    const out = allRows.filter((r) => {
      if (classFilter !== 'all' && r.className !== classFilter) return false;
      if (codeFilter !== 'all' && r.examCode !== codeFilter) return false;
      if (statusFilter !== 'all' && r.status !== statusFilter) return false;

      if (passFilter !== 'all') {
        if (r.kind !== 'submission' || r.status !== 'graded' || r.total === null) return false;
        if (passFilter === 'pass' && r.total < passThr) return false;
        if (passFilter === 'fail' && r.total >= passThr) return false;
      }

      if (minS !== null && Number.isFinite(minS)) {
        if (r.total === null || r.total < minS) return false;
      }
      if (maxS !== null && Number.isFinite(maxS)) {
        if (r.total === null || r.total > maxS) return false;
      }

      if (q) {
        const hay = `${r.sbd} ${r.studentCode} ${r.fullName} ${r.className} ${r.phachCode} ${r.examCode}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    out.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'total' || sortField === 'part1' || sortField === 'part2' || sortField === 'part3' || sortField === 'correctCount') {
        cmp = (a[sortField] ?? -1) - (b[sortField] ?? -1);
      } else {
        cmp = String(a[sortField] ?? '').localeCompare(String(b[sortField] ?? ''), 'vi');
      }
      return sortAsc ? cmp : -cmp;
    });
    return out;
  }, [
    allRows,
    classFilter,
    codeFilter,
    statusFilter,
    passFilter,
    minScoreInput,
    maxScoreInput,
    searchQuery,
    activeExam,
    sortField,
    sortAsc,
  ]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [activeExamId, classFilter, codeFilter, statusFilter, passFilter, minScoreInput, maxScoreInput, searchQuery]);

  const totalPages = pageSize <= 0 ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const pagedRows = useMemo(() => {
    if (pageSize <= 0) return filteredRows;
    const start = (currentPage - 1) * pageSize;
    return filteredRows.slice(start, start + pageSize);
  }, [filteredRows, pageSize, currentPage]);

  // Visible dynamic columns hiding Part II / III / Phách if unused
  const activeColumns = useMemo(() => {
    return columnConfigs.filter((c) => {
      if (!c.visible) return false;
      if (c.key === 'part2' && !hasPart2) return false;
      if (c.key === 'part3' && !hasPart3) return false;
      if (c.key === 'phachCode' && !hasPhach) return false;
      return true;
    });
  }, [columnConfigs, hasPart2, hasPart3, hasPhach]);

  // Inspected submission synchronization & canvas preview
  const inspectedSub = useMemo(
    () => examSubmissions.find((s) => s.id === inspectedSubId) || null,
    [examSubmissions, inspectedSubId]
  );

  useEffect(() => {
    if (!inspectedSub) return;
    setEditSbd(inspectedSub.sbd);
    setEditCode(inspectedSub.examCode);
    setEditStudentId(inspectedSub.studentId || '');
    setEditComment(
      inspectedSub.teacherComment ||
        generateObjectiveComment(inspectedSub, activeExam || undefined, settings.reportCommentBands)
    );
    setEditCommentLocked(!!inspectedSub.teacherCommentLocked);
  }, [inspectedSub?.id]);

  useEffect(() => {
    let alive = true;
    if (!inspectedSub) {
      setInspectImgUrl('');
      return;
    }
    const blobId =
      inspectImgMode === 'original'
        ? inspectedSub.originalImageBlobId
        : inspectedSub.warpedImageBlobId || inspectedSub.originalImageBlobId;
    getBlob(blobId).then((rec) => {
      if (alive) setInspectImgUrl(rec?.dataUrl || '');
    });
    return () => {
      alive = false;
    };
  }, [inspectedSub?.id, inspectedSub?.updatedAt, inspectImgMode]);

  useEffect(() => {
    const canvas = inspectCanvasRef.current;
    if (!canvas || !inspectImgUrl || !inspectedSub) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      if (inspectImgMode === 'annotated') {
        const W = canvas.width;
        const H = canvas.height;
        for (const q of inspectedSub.recognition.questions) {
          for (const b of q.bubbles) {
            const bx = b.cx * W;
            const by = b.cy * H;
            const br = Math.max(5, Math.min(b.rx * W, b.ry * H) * 1.18);
            const chosen =
              q.part === 'part3' ? b.isMarked : q.detectedValue ? b.option === q.detectedValue : b.isMarked;

            if (q.status === 'correct' && chosen) {
              ctx.strokeStyle = '#16A34A';
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
              ctx.stroke();
            } else if (q.status === 'wrong') {
              if (chosen) {
                ctx.strokeStyle = '#DC2626';
                ctx.lineWidth = 2.6;
                ctx.beginPath();
                ctx.moveTo(bx - br, by - br);
                ctx.lineTo(bx + br, by + br);
                ctx.moveTo(bx - br, by + br);
                ctx.lineTo(bx + br, by - br);
                ctx.stroke();
              }
              if (q.part !== 'part3' && b.option === q.correctValue) {
                ctx.strokeStyle = '#2563EB';
                ctx.lineWidth = 2.3;
                ctx.beginPath();
                ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
                ctx.stroke();
              }
            } else if (q.status === 'blank' && q.part !== 'part3' && b.option === q.correctValue) {
              ctx.strokeStyle = '#2563EB';
              ctx.lineWidth = 2.2;
              ctx.beginPath();
              ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
              ctx.stroke();
            } else if (
              (q.status === 'multi_mark' ||
                q.status === 'faint' ||
                q.status === 'erased' ||
                q.status === 'pending_review' ||
                q.status === 'unrecognized') &&
              b.isMarked
            ) {
              ctx.strokeStyle = '#EA580C';
              ctx.lineWidth = 2.6;
              ctx.beginPath();
              ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
              ctx.stroke();
            }
          }
        }
      }
    };
    img.src = inspectImgUrl;
  }, [inspectImgUrl, inspectImgMode, inspectedSub]);

  // Handlers
  const clearFilters = () => {
    setSubjectFilter('all');
    setGradeFilter('all');
    setClassFilter('all');
    setCodeFilter('all');
    setStatusFilter('all');
    setPassFilter('all');
    setMinScoreInput('');
    setMaxScoreInput('');
    setSearchQuery('');
  };

  const toggleSort = (f: SortField) => {
    if (sortField === f) setSortAsc(!sortAsc);
    else {
      setSortField(f);
      setSortAsc(f !== 'total');
    }
  };

  const moveColumn = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= columnConfigs.length) return;
    const next = [...columnConfigs];
    const tmp = next[idx];
    next[idx] = next[target];
    next[target] = tmp;
    setColumnConfigs(next);
  };

  const toggleSelectAllPage = () => {
    const pageSubIds = pagedRows.filter((r) => r.submission).map((r) => r.submission!.id);
    const allSel = pageSubIds.length > 0 && pageSubIds.every((id) => selectedIds.has(id));
    const next = new Set(selectedIds);
    if (allSel) pageSubIds.forEach((id) => next.delete(id));
    else pageSubIds.forEach((id) => next.add(id));
    setSelectedIds(next);
  };

  const handleGradePracticeExam = async (forceRegrade = false) => {
    if (!activeExam || practiceSheetsForExam.length === 0) return;
    if (opencvStatus !== 'ready') {
      setNotice({ type: 'warn', text: 'OpenCV.js chưa sẵn sàng, vui lòng đợi vài giây rồi thử lại.' });
      return;
    }
    setGradingPractice({ active: true, done: 0, total: practiceSheetsForExam.length });
    try {
      const res = await runPracticeGrading(
        practiceSheetsForExam,
        (done, total) => setGradingPractice({ active: true, done, total }),
        { forceRegrade }
      );
      const gradedNow = res.filter((r) => r.status === 'graded').length;
      const reviewNow = res.filter((r) => r.status === 'needs_review').length;
      setNotice({
        type: 'ok',
        text: `Đã hoàn tất chấm thực tế OMR ${res.length} phiếu thực hành (${gradedNow} bài đủ điều kiện duyệt tự động, ${reviewNow} bài chờ kiểm duyệt).`,
      });
    } finally {
      setGradingPractice(null);
    }
  };

  const isSubmissionEligibleForApproval = (sub: ExamSubmission): { ok: boolean; reasons: string[] } => {
    const issues: string[] = [];
    const ak = examAnswerKeys.find((k) => k.examCode.trim() === sub.examCode.trim());
    if (!ak) issues.push(`Thiếu đáp án mã đề "${sub.examCode || '---'}"`);
    if (!sub.sbd || sub.sbd.includes('?')) issues.push('SBD chưa rõ');
    const unresolved = sub.recognition.questions.filter(
      (q) =>
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'unrecognized' ||
        q.status === 'pending_review'
    );
    if (unresolved.length > 0) issues.push(`Còn ${unresolved.length} câu chưa xác nhận`);
    return { ok: issues.length === 0, reasons: issues };
  };

  const handleBatchApprove = async () => {
    const targets = examSubmissions.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;
    let approved = 0;
    let skipped = 0;
    for (const sub of targets) {
      const check = isSubmissionEligibleForApproval(sub);
      if (!check.ok) {
        skipped++;
        continue;
      }
      if (sub.status === 'graded') continue;
      await upsertSubmission({
        ...sub,
        status: 'graded',
        reviewReasons: [],
        editHistory: [
          {
            timestamp: Date.now(),
            field: 'Duyệt hàng loạt từ Bảng điểm',
            oldValue: statusLabelVi(sub.status),
            newValue: 'Đã duyệt',
            reason: 'Đủ điều kiện kiểm tra (có SBD, mã đề khớp đáp án, không còn câu nghi ngờ)',
          },
          ...sub.editHistory,
        ],
        updatedAt: Date.now(),
      });
      approved++;
    }
    setNotice({
      type: skipped > 0 ? 'warn' : 'ok',
      text:
        skipped > 0
          ? `Đã duyệt ${approved} bài đủ điều kiện. Bỏ qua ${skipped} bài còn lỗi/nghi ngờ cần kiểm duyệt thủ công.`
          : `Đã duyệt thành công ${approved} bài thi.`,
    });
  };

  const handleBatchRegrade = async () => {
    const targets = examSubmissions.filter((s) => selectedIds.has(s.id));
    if (targets.length === 0) return;
    for (const sub of targets) {
      const ak = examAnswerKeys.find((k) => k.examCode.trim() === sub.examCode.trim());
      const scored = scoreRecognitionAgainstKey(sub.recognition.questions, ak);
      const issues: string[] = [];
      if (!ak) issues.push(`Chưa có đáp án mã đề "${sub.examCode}"`);
      if (!sub.sbd || sub.sbd.includes('?')) issues.push(`SBD chưa rõ (${sub.sbd})`);
      const unres = scored.questions.filter(
        (q) =>
          q.status === 'multi_mark' ||
          q.status === 'faint' ||
          q.status === 'erased' ||
          q.status === 'unrecognized' ||
          q.status === 'pending_review'
      );
      if (unres.length > 0) issues.push(`Còn ${unres.length} câu cần xác nhận`);

      await upsertSubmission({
        ...sub,
        recognition: { ...sub.recognition, questions: scored.questions },
        scoreBreakdown: scored.scoreBreakdown,
        status: issues.length === 0 ? 'graded' : 'needs_review',
        reviewReasons: issues,
        updatedAt: Date.now(),
      });
    }
    setNotice({ type: 'ok', text: `Đã chấm lại ${targets.length} bài thi theo bộ đáp án hiện hành.` });
  };

  const handleBatchDelete = async () => {
    const targets = Array.from(selectedIds);
    for (const id of targets) await removeSubmission(id);
    setSelectedIds(new Set());
    setConfirmDeleteBatch(false);
    if (inspectedSubId && targets.includes(inspectedSubId)) setInspectedSubId(null);
    setNotice({ type: 'ok', text: `Đã xóa ${targets.length} bài làm khỏi kỳ kiểm tra.` });
  };

  const handleSaveInspected = async (approveIfEligible: boolean) => {
    if (!inspectedSub || !activeExam) return;
    const ak = examAnswerKeys.find((k) => k.examCode.trim() === editCode.trim());
    const scored = scoreRecognitionAgainstKey(inspectedSub.recognition.questions, ak);
    const matchedStudent =
      students.find((s) => s.id === editStudentId) ||
      students.find((s) => s.sbd === editSbd.trim());

    const issues: string[] = [];
    if (!ak) issues.push(`Chưa có đáp án mã đề "${editCode}"`);
    if (!editSbd.trim() || editSbd.includes('?')) issues.push(`SBD chưa rõ (${editSbd})`);
    const unres = scored.questions.filter(
      (q) =>
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'unrecognized' ||
        q.status === 'pending_review'
    );
    if (unres.length > 0) issues.push(`Còn ${unres.length} câu cần kiểm duyệt`);

    const nextStatus: ExamSubmission['status'] =
      approveIfEligible && issues.length === 0 ? 'graded' : issues.length === 0 && inspectedSub.status === 'graded' ? 'graded' : 'needs_review';

    await upsertSubmission({
      ...inspectedSub,
      sbd: editSbd.trim(),
      examCode: editCode.trim(),
      studentId: matchedStudent?.id,
      recognition: {
        ...inspectedSub.recognition,
        sbd: editSbd.trim(),
        examCode: editCode.trim(),
        questions: scored.questions,
      },
      scoreBreakdown: scored.scoreBreakdown,
      status: nextStatus,
      reviewReasons: issues,
      teacherComment: editComment.trim(),
      teacherCommentLocked: editCommentLocked,
      editHistory: [
        {
          timestamp: Date.now(),
          field: 'Cập nhật tại Bảng điểm',
          oldValue: `SBD:${inspectedSub.sbd} | Mã:${inspectedSub.examCode} | ${inspectedSub.scoreBreakdown.total}đ`,
          newValue: `SBD:${editSbd.trim()} | Mã:${editCode.trim()} | ${scored.scoreBreakdown.total}đ`,
          reason: 'Chỉnh sửa trực tiếp trong bảng điểm',
        },
        ...inspectedSub.editHistory,
      ],
      updatedAt: Date.now(),
    });
    setNotice({
      type: nextStatus === 'graded' ? 'ok' : 'warn',
      text:
        nextStatus === 'graded'
          ? `Đã lưu và xác nhận bài SBD ${editSbd.trim()} (${scored.scoreBreakdown.total}đ).`
          : `Đã lưu thay đổi (${issues.join('; ')}).`,
    });
  };

  const handleToggleAbsent = async (st: Student, markAbsent: boolean) => {
    if (!activeExam) return;
    const set = new Set(st.absentExamIds);
    if (markAbsent) set.add(activeExam.id);
    else set.delete(activeExam.id);
    await upsertStudent({ ...st, absentExamIds: Array.from(set) });
    setNotice({
      type: 'ok',
      text: markAbsent
        ? `Đã đánh dấu vắng thi: ${st.fullName} (không tính điểm 0).`
        : `Đã bỏ trạng thái vắng thi cho ${st.fullName}.`,
    });
  };

  const handleExportExcelOrCsv = async (format: 'xlsx' | 'csv') => {
    if (!activeExam) return;
    const selectedSubs =
      selectedIds.size > 0
        ? examSubmissions.filter((s) => selectedIds.has(s.id))
        : filteredRows.filter((r) => r.submission).map((r) => r.submission!);

    if (selectedSubs.length === 0) {
      setNotice({ type: 'warn', text: 'Không có bài thi trong phạm vi xuất. Hãy thay đổi bộ lọc hoặc chọn bài thi.' });
      return;
    }
    try {
    await exportExamGradebookXLSX({
      exam: activeExam,
      allSubmissionsForExam: examSubmissions,
      visibleSubmissions: selectedSubs,
      students,
      answerKeys: examAnswerKeys,
      columnConfigs,
      hasPart2,
      hasPart3,
      hasPhach,
      format,
      includeAllForExam: false,
    });
    setNotice({ type: 'ok', text: `Đã tạo bảng điểm ${format.toUpperCase()} cho ${selectedSubs.length} bài trong phạm vi chọn.` });
    } catch (err) {
      setNotice({ type: 'warn', text: `Xuất bảng điểm thất bại: ${err instanceof Error ? err.message : 'Lỗi không xác định'}` });
    }
  };

  const handleExportGradebookPdf = async () => {
    if (!activeExam) return;
    const pdfDoc = await PDFDocument.create();
    pdfDoc.registerFontkit(fontkit);
    const [regRes, boldRes] = await Promise.all([
      fetch('/fonts/DejaVuSans.ttf'),
      fetch('/fonts/DejaVuSans-Bold.ttf'),
    ]);
    const [regBytes, boldBytes] = await Promise.all([regRes.arrayBuffer(), boldRes.arrayBuffer()]);
    const fontReg = await pdfDoc.embedFont(regBytes);
    const fontBold = await pdfDoc.embedFont(boldBytes);

    const pw = 841.89; // A4 Landscape
    const ph = 595.28;
    const rowsPerPage = 24;
    const exportRows =
      selectedIds.size > 0
        ? filteredRows.filter((r) => r.submission && selectedIds.has(r.submission.id))
        : filteredRows;

    for (let start = 0; start < Math.max(1, exportRows.length); start += rowsPerPage) {
      const page = pdfDoc.addPage([pw, ph]);
      page.drawText(`${activeExam.schoolName || 'TRƯỜNG THPT'} – BẢNG ĐIỂM: ${activeExam.name}`, {
        x: 28,
        y: ph - 34,
        size: 11.5,
        font: fontBold,
        color: rgb(0.12, 0.16, 0.23),
      });
      page.drawText(
        `Môn: ${activeExam.subject} | Lớp: ${classFilter === 'all' ? 'Tất cả' : classFilter} | Đã duyệt: ${gradedSubmissions.length} | ĐTB: ${officialAnalytics?.mean ?? 0}`,
        { x: 28, y: ph - 50, size: 8.5, font: fontReg, color: rgb(0.35, 0.4, 0.48) }
      );

      let y = ph - 74;
      page.drawRectangle({ x: 28, y: y - 4, width: pw - 56, height: 18, color: rgb(0.92, 0.95, 0.99) });
      page.drawText('STT', { x: 34, y: y + 1, size: 8, font: fontBold });
      page.drawText('SBD', { x: 64, y: y + 1, size: 8, font: fontBold });
      page.drawText('Họ và tên', { x: 125, y: y + 1, size: 8, font: fontBold });
      page.drawText('Lớp', { x: 300, y: y + 1, size: 8, font: fontBold });
      page.drawText('Mã đề', { x: 350, y: y + 1, size: 8, font: fontBold });
      page.drawText('P.I', { x: 400, y: y + 1, size: 8, font: fontBold });
      if (hasPart2) page.drawText('P.II', { x: 445, y: y + 1, size: 8, font: fontBold });
      if (hasPart3) page.drawText('P.III', { x: 490, y: y + 1, size: 8, font: fontBold });
      page.drawText('Tổng', { x: 540, y: y + 1, size: 8, font: fontBold });
      page.drawText('Trạng thái', { x: 595, y: y + 1, size: 8, font: fontBold });
      page.drawText('Ghi chú', { x: 680, y: y + 1, size: 8, font: fontBold });
      y -= 20;

      const slice = exportRows.slice(start, start + rowsPerPage);
      slice.forEach((r, idx) => {
        page.drawText(String(start + idx + 1), { x: 34, y, size: 7.8, font: fontReg });
        page.drawText(r.sbd || '-', { x: 64, y, size: 7.8, font: fontReg });
        page.drawText(r.fullName.slice(0, 32), { x: 125, y, size: 7.8, font: fontReg });
        page.drawText(r.className, { x: 300, y, size: 7.8, font: fontReg });
        page.drawText(r.examCode, { x: 350, y, size: 7.8, font: fontReg });
        page.drawText(r.part1 !== null ? String(r.part1) : '-', { x: 400, y, size: 7.8, font: fontReg });
        if (hasPart2) page.drawText(r.part2 !== null ? String(r.part2) : '-', { x: 445, y, size: 7.8, font: fontReg });
        if (hasPart3) page.drawText(r.part3 !== null ? String(r.part3) : '-', { x: 490, y, size: 7.8, font: fontReg });
        page.drawText(
          r.total !== null ? (r.status === 'graded' ? String(r.total) : `${r.total} (tạm)`) : '-',
          { x: 540, y, size: 7.8, font: fontBold }
        );
        page.drawText(r.status === 'absent' ? 'Vắng thi' : statusLabelVi(r.status), {
          x: 595,
          y,
          size: 7.6,
          font: fontReg,
        });
        page.drawText((r.note || '').slice(0, 28), { x: 680, y, size: 7.4, font: fontReg });
        y -= 19;
      });
    }

    const bytes = await pdfDoc.save();
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Bang-diem_${activeExam.subject}_${activeExam.name}.pdf`.replace(/\s+/g, '_');
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1200);
  };

  if (!activeExam) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3">
        <h2 className="text-base font-semibold text-[#1E293B]">Chưa có kỳ kiểm tra trong phạm vi hiện tại</h2>
        <p className="text-xs text-slate-500">
          Vui lòng tạo kỳ kiểm tra mới hoặc chuyển sang Bộ dữ liệu thực hành để xem bảng điểm.
        </p>
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => setActivePage('exams')}
            className="px-4 py-2 bg-[#2563EB] text-white text-xs font-medium rounded-md"
          >
            Quản lý kỳ kiểm tra
          </button>
          <button
            type="button"
            onClick={() => setDataScope('practice')}
            className="px-4 py-2 border border-slate-300 text-slate-700 text-xs font-medium rounded-md"
          >
            Mở bộ thực hành
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 1. Header & Exam Info + Practice Grader */}
      <div className="bg-white border border-slate-200 rounded-lg p-4 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-[21px] font-bold text-[#1E293B]">Bảng điểm kỳ kiểm tra</h1>
            <p className="mt-1 text-sm text-slate-600">Chọn bài hoặc lọc kết quả trước khi xuất. Bài chờ kiểm duyệt không được tự động chuyển thành điểm chính thức.</p>
            <span
              className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                dataScope === 'practice'
                  ? 'bg-blue-50 text-[#2563EB] border border-blue-200'
                  : 'bg-emerald-50 text-[#16A34A] border border-emerald-200'
              }`}
            >
              {dataScope === 'practice' ? 'Bộ dữ liệu thực hành' : 'Dữ liệu chính thức'}
            </span>
          </div>
          <div className="text-xs text-slate-600 mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <span className="font-semibold text-[#1E293B]">{activeExam.name}</span>
            <span>·</span>
            <span>Môn {activeExam.subject}</span>
            <span>·</span>
            <span>Khối {activeExam.gradeLevel}</span>
            <span>·</span>
            <span>Lớp: {activeExam.classNames.join(', ') || 'Tất cả'}</span>
            <span>·</span>
            <span>Mẫu phiếu: {activeTemplate?.name || activeExam.templateId}</span>
            <span>·</span>
            <span>{activeExam.examCodes.length} mã đề ({activeExam.examCodes.join(', ')})</span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded-md border border-slate-300 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDataScope('practice')}
              className={`px-2.5 py-1.5 rounded font-medium ${
                dataScope === 'practice' ? 'bg-white text-[#2563EB] shadow-xs' : 'text-slate-600'
              }`}
            >
              Thực hành
            </button>
            <button
              type="button"
              onClick={() => setDataScope('official')}
              className={`px-2.5 py-1.5 rounded font-medium ${
                dataScope === 'official' ? 'bg-white text-[#16A34A] shadow-xs' : 'text-slate-600'
              }`}
            >
              Chính thức
            </button>
          </div>

          {dataScope === 'practice' && practiceSheetsForExam.length > 0 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={!!gradingPractice}
                onClick={() => handleGradePracticeExam(false)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                <Play className="w-3.5 h-3.5" />
                {gradingPractice
                  ? `Đang chấm ${gradingPractice.done}/${gradingPractice.total}...`
                  : `Chấm bộ phiếu thực hành (${gradedPracticeCountForExam}/${practiceSheetsForExam.length})`}
              </button>
              {gradedPracticeCountForExam > 0 && (
                <button
                  type="button"
                  disabled={!!gradingPractice}
                  onClick={() => handleGradePracticeExam(true)}
                  title="Chấm lại toàn bộ 45 phiếu thực hành bằng OpenCV.js"
                  className="inline-flex items-center gap-1 px-2.5 py-2 rounded-md border border-slate-300 bg-white text-slate-700 text-xs hover:bg-slate-50 disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Chấm lại
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Notice feedback */}
      {notice && (
        <div
          className={`rounded-md border px-3.5 py-2.5 text-xs flex items-center justify-between gap-2 ${
            notice.type === 'ok'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
              : 'bg-amber-50 border-amber-200 text-amber-800'
          }`}
        >
          <span>{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} className="text-slate-500 hover:text-slate-800">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* 2. 10 KPI Cards (Official stats strictly from graded) */}
      <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2.5">
        {[
          { label: 'Tổng học sinh', val: examStudents.length, cls: 'text-[#1E293B]' },
          { label: 'Đã duyệt (CT)', val: gradedSubmissions.length, cls: 'text-[#16A34A]' },
          {
            label: 'Chờ kiểm duyệt',
            val: reviewCount,
            sub: unprocessedCount + errorCount > 0 ? `+${unprocessedCount + errorCount} lỗi/chờ` : undefined,
            cls: 'text-amber-600',
          },
          { label: 'Vắng thi', val: officialAnalytics?.absentCount ?? 0, cls: 'text-slate-600' },
          { label: 'Điểm TB', val: officialAnalytics?.mean ?? 0, cls: 'text-[#2563EB]' },
          { label: 'Trung vị', val: officialAnalytics?.median ?? 0, cls: 'text-[#1E293B]' },
          { label: 'Cao nhất', val: officialAnalytics?.max ?? 0, cls: 'text-[#16A34A]' },
          { label: 'Thấp nhất', val: officialAnalytics?.min ?? 0, cls: 'text-[#DC2626]' },
          { label: 'Độ lệch chuẩn', val: officialAnalytics?.stdDev ?? 0, cls: 'text-slate-700' },
          {
            label: `Tỉ lệ đạt (≥${activeExam.passThreshold})`,
            val: `${officialAnalytics?.passRate ?? 0}%`,
            cls: 'text-[#16A34A]',
          },
        ].map((kpi) => (
          <div key={kpi.label} className="bg-white border border-slate-200 rounded-lg px-3 py-2.5">
            <div className="text-[11px] text-slate-500 truncate">{kpi.label}</div>
            <div className={`text-base font-bold font-mono-num mt-0.5 ${kpi.cls}`}>{kpi.val}</div>
            {kpi.sub && <div className="text-[10px] text-slate-400">{kpi.sub}</div>}
          </div>
        ))}
      </div>

      {/* 3. Toolbar & Comprehensive Multi-Filter Bar */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={subjectFilter}
              onChange={(e) => setSubjectFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="all">Tất cả môn học</option>
              {availableSubjects.map((s) => (
                <option key={s} value={s}>
                  Môn {s}
                </option>
              ))}
            </select>

            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="all">Tất cả khối</option>
              {availableGrades.map((g) => (
                <option key={g} value={g}>
                  Khối {g}
                </option>
              ))}
            </select>

            <select
              value={activeExam.id}
              onChange={(e) => setActiveExamId(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium min-w-[230px]"
            >
              {filteredExamChoices.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>

            <select
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="all">Tất cả lớp</option>
              {availableClasses.map((c) => (
                <option key={c} value={c}>
                  Lớp {c}
                </option>
              ))}
            </select>

            <select
              value={codeFilter}
              onChange={(e) => setCodeFilter(e.target.value)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="all">Tất cả mã đề</option>
              {availableCodes.map((c) => (
                <option key={c} value={c}>
                  Mã đề {c}
                </option>
              ))}
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as ExtendedStatusFilter)}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
            >
              <option value="all">Tất cả trạng thái</option>
              <option value="graded">Đã duyệt (Chính thức)</option>
              <option value="needs_review">Chờ kiểm duyệt</option>
              <option value="unprocessed">Chưa chấm</option>
              <option value="error">Có lỗi</option>
              <option value="absent">Vắng thi</option>
            </select>

            <select
              value={passFilter}
              onChange={(e) => setPassFilter(e.target.value as 'all' | 'pass' | 'fail')}
              className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white"
            >
              <option value="all">Đạt / Chưa đạt: Tất cả</option>
              <option value="pass">Chỉ bài Đạt (chính thức)</option>
              <option value="fail">Chỉ bài Chưa đạt</option>
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setShowColumnPanel((v) => !v)}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white hover:bg-slate-50"
            >
              <Columns3 className="w-3.5 h-3.5" />
              Cột hiển thị
            </button>
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white text-slate-600 hover:bg-slate-50"
            >
              <FilterX className="w-3.5 h-3.5" />
              Xóa bộ lọc
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm SBD, mã HS, họ tên, mã phách..."
                className="pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs w-64"
              />
            </div>

            <div className="flex items-center gap-1 text-xs text-slate-600">
              <span>Điểm từ</span>
              <input
                type="text"
                value={minScoreInput}
                onChange={(e) => setMinScoreInput(e.target.value)}
                placeholder="0"
                className="w-14 px-2 py-1 border border-slate-300 rounded font-mono-num text-center"
              />
              <span>đến</span>
              <input
                type="text"
                value={maxScoreInput}
                onChange={(e) => setMaxScoreInput(e.target.value)}
                placeholder="10"
                className="w-14 px-2 py-1 border border-slate-300 rounded font-mono-num text-center"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => handleExportExcelOrCsv('xlsx')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Xuất Excel (.xlsx)
            </button>
            <button
              type="button"
              onClick={() => handleExportExcelOrCsv('csv')}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs hover:bg-slate-50"
            >
              <Download className="w-3.5 h-3.5" />
              CSV
            </button>
            <button
              type="button"
              onClick={handleExportGradebookPdf}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs hover:bg-slate-50"
            >
              <FileText className="w-3.5 h-3.5" />
              Xuất PDF
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 text-xs hover:bg-slate-50"
            >
              <Printer className="w-3.5 h-3.5" />
              In bảng điểm
            </button>
          </div>
        </div>

        {/* Column visibility & ordering inline panel */}
        {showColumnPanel && (
          <div className="border-t border-slate-200 pt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
            {columnConfigs.map((col, idx) => (
              <div
                key={col.key}
                className="flex items-center justify-between px-2.5 py-1.5 rounded border border-slate-200 bg-slate-50 text-xs"
              >
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={col.visible}
                    onChange={(e) =>
                      setColumnConfigs((prev) =>
                        prev.map((c) => (c.key === col.key ? { ...c, visible: e.target.checked } : c))
                      )
                    }
                  />
                  <span>{col.label}</span>
                </label>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveColumn(idx, -1)}
                    className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowUp className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === columnConfigs.length - 1}
                    onClick={() => moveColumn(idx, 1)}
                    className="p-0.5 text-slate-500 hover:text-slate-900 disabled:opacity-30"
                  >
                    <ArrowDown className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 4. Batch Action Bar */}
      {selectedIds.size > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
          <div className="font-semibold text-[#1E293B]">
            Đã chọn <span className="font-mono-num text-[#2563EB]">{selectedIds.size}</span> bài thi
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleBatchApprove}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#16A34A] text-white font-medium hover:bg-green-700"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              Duyệt hàng loạt (đủ ĐK)
            </button>
            <button
              type="button"
              onClick={handleBatchRegrade}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Chấm lại
            </button>
            <button
              type="button"
              onClick={() => {
                const firstId = Array.from(selectedIds)[0];
                if (firstId) openReviewSubmission(firstId, activeExam.id);
              }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              <ClipboardCheck className="w-3.5 h-3.5" />
              Chuyển đến kiểm duyệt
            </button>
            {!confirmDeleteBatch ? (
              <button
                type="button"
                onClick={() => setConfirmDeleteBatch(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-white border border-red-200 text-[#DC2626] hover:bg-red-50"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Xóa đã chọn
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 bg-red-50 border border-red-300 rounded px-2 py-1">
                <span className="text-[#DC2626] font-medium">Xác nhận xóa?</span>
                <button
                  type="button"
                  onClick={handleBatchDelete}
                  className="px-2 py-0.5 rounded bg-[#DC2626] text-white font-medium"
                >
                  Xóa
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteBatch(false)}
                  className="px-2 py-0.5 rounded bg-white border border-slate-300"
                >
                  Hủy
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setSelectedIds(new Set());
                setConfirmDeleteBatch(false);
              }}
              className="text-slate-500 hover:text-slate-800 px-2"
            >
              Bỏ chọn
            </button>
          </div>
        </div>
      )}

      {/* 5. Inline Single Submission Inspector & Editor (NO POPUPS!) */}
      {inspectedSub && (
        <div className="bg-white border-2 border-[#2563EB]/30 rounded-lg p-4 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
            <div>
              <h2 className="text-sm font-bold text-[#1E293B]">
                Chi tiết & chỉnh sửa bài thi — SBD {inspectedSub.sbd || '---'}
              </h2>
              <p className="text-[11px] text-slate-500">
                Trạng thái: {statusLabelVi(inspectedSub.status)} · Điểm:{' '}
                <strong className="font-mono-num text-[#1E293B]">
                  {inspectedSub.scoreBreakdown.total}/{inspectedSub.scoreBreakdown.maxPossible}
                </strong>{' '}
                {inspectedSub.status !== 'graded' && '(Tạm tính — chưa tính vào điểm chính thức)'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => openReviewSubmission(inspectedSub.id, activeExam.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 text-xs hover:bg-slate-50"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                Mở trang Kiểm duyệt
              </button>
              <button
                type="button"
                onClick={() => openReportCardSubmission(inspectedSub.id, activeExam.id)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#2563EB] text-white text-xs hover:bg-blue-700"
              >
                <FileText className="w-3.5 h-3.5" />
                Xem Phiếu trả bài
              </button>
              <button
                type="button"
                onClick={() => setInspectedSubId(null)}
                className="p-1.5 rounded border border-slate-200 text-slate-500 hover:bg-slate-100"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Image preview with 3 modes */}
            <div className="lg:col-span-5 space-y-2">
              <div className="inline-flex rounded border border-slate-200 bg-slate-50 p-0.5 text-[11px]">
                {INSPECT_MODES.map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setInspectImgMode(m.id)}
                    className={`px-2.5 py-1 rounded ${
                      inspectImgMode === m.id ? 'bg-white text-[#2563EB] font-semibold shadow-xs' : 'text-slate-600'
                    }`}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <div className="border border-slate-200 rounded bg-slate-50 overflow-auto max-h-[380px] flex justify-center p-2">
                {inspectImgUrl ? (
                  <canvas ref={inspectCanvasRef} className="max-w-full h-auto" />
                ) : (
                  <div className="py-12 text-xs text-slate-400">Không có ảnh lưu trữ cho bài thi này.</div>
                )}
              </div>
            </div>

            {/* Metadata + Comment Editor */}
            <div className="lg:col-span-7 space-y-3 text-xs">
              {inspectedSub.reviewReasons.length > 0 && (
                <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-amber-800">
                  <strong>Lý do chờ duyệt:</strong> {inspectedSub.reviewReasons.join('; ')}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Số báo danh</label>
                  <input
                    type="text"
                    value={editSbd}
                    onChange={(e) => setEditSbd(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Mã đề</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Học sinh đối chiếu</label>
                  <select
                    value={editStudentId}
                    onChange={(e) => setEditStudentId(e.target.value)}
                    className="w-full px-2 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="">-- Tự đối chiếu theo SBD --</option>
                    {examStudents.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.sbd} - {st.fullName} ({st.className})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-medium text-slate-600">
                    Nhận xét phiếu trả bài
                  </label>
                  <button
                    type="button"
                    onClick={() => setEditCommentLocked((v) => !v)}
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded border text-[11px] ${
                      editCommentLocked
                        ? 'bg-blue-50 border-blue-300 text-[#2563EB] font-medium'
                        : 'bg-white border-slate-300 text-slate-600'
                    }`}
                  >
                    {editCommentLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                    {editCommentLocked ? 'Đã khóa ghi đè khi chấm lại' : 'Khóa nhận xét giáo viên'}
                  </button>
                </div>
                <textarea
                  rows={3}
                  value={editComment}
                  onChange={(e) => setEditComment(e.target.value)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded text-xs"
                />
              </div>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => handleSaveInspected(false)}
                  className="px-3 py-1.5 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700"
                >
                  Lưu & Chấm lại
                </button>
                <button
                  type="button"
                  onClick={() => handleSaveInspected(true)}
                  className="px-3 py-1.5 rounded bg-[#16A34A] text-white font-medium hover:bg-green-700"
                >
                  Lưu & Duyệt chính thức (nếu đủ ĐK)
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 6. Sticky Main Gradebook Table */}
      <div className="bg-white border border-slate-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-[580px]">
          <table className="w-full text-xs border-collapse">
            <thead className="bg-slate-100 sticky top-0 z-20 border-b border-slate-200 text-slate-700">
              <tr>
                <th className="sticky left-0 z-30 bg-slate-100 px-3 py-2.5 text-left w-10 border-r border-slate-200">
                  <input
                    type="checkbox"
                    checked={
                      pagedRows.some((r) => r.submission) &&
                      pagedRows
                        .filter((r) => r.submission)
                        .every((r) => selectedIds.has(r.submission!.id))
                    }
                    onChange={toggleSelectAllPage}
                  />
                </th>
                {activeColumns.map((col) => {
                  const isStickySbd = col.key === 'sbd';
                  const isStickyName = col.key === 'fullName';
                  const stickyClass = isStickySbd
                    ? 'sticky left-10 z-30 bg-slate-100 border-r border-slate-200'
                    : isStickyName
                    ? 'sticky left-[124px] z-30 bg-slate-100 border-r border-slate-200'
                    : '';
                  const sortable = (
                    ['sbd', 'fullName', 'className', 'examCode', 'part1', 'part2', 'part3', 'total', 'correctCount', 'status'] as string[]
                  ).includes(col.key);

                  return (
                    <th
                      key={col.key}
                      onClick={() => sortable && toggleSort(col.key as SortField)}
                      className={`px-3 py-2.5 text-left font-semibold whitespace-nowrap ${
                        sortable ? 'cursor-pointer hover:text-[#2563EB]' : ''
                      } ${stickyClass}`}
                    >
                      <span className="inline-flex items-center gap-1">
                        {col.label}
                        {sortable && sortField === col.key && (
                          <span className="text-[10px] text-[#2563EB]">{sortAsc ? '▲' : '▼'}</span>
                        )}
                      </span>
                    </th>
                  );
                })}
                <th className="px-3 py-2.5 text-right font-semibold whitespace-nowrap">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {pagedRows.length === 0 ? (
                <tr>
                  <td colSpan={activeColumns.length + 2} className="px-4 py-10 text-center text-slate-500">
                    Không có bản ghi nào khớp bộ lọc hiện tại. Hãy nhấn <strong>Xóa bộ lọc</strong> hoặc chuyển sang{' '}
                    <strong>Tất cả trạng thái</strong>.
                  </td>
                </tr>
              ) : (
                pagedRows.map((row, idx) => {
                  const stt = pageSize <= 0 ? idx + 1 : (currentPage - 1) * pageSize + idx + 1;
                  const sub = row.submission;
                  const isSel = sub ? selectedIds.has(sub.id) : false;
                  const isProvisional = row.kind === 'submission' && row.status !== 'graded';

                  return (
                    <tr
                      key={row.rowKey}
                      className={`hover:bg-slate-50 ${isSel ? 'bg-blue-50/40' : 'bg-white'}`}
                    >
                      <td className="sticky left-0 z-10 bg-inherit px-3 py-2 border-r border-slate-100">
                        {sub ? (
                          <input
                            type="checkbox"
                            checked={isSel}
                            onChange={() => {
                              const next = new Set(selectedIds);
                              if (next.has(sub.id)) next.delete(sub.id);
                              else next.add(sub.id);
                              setSelectedIds(next);
                            }}
                          />
                        ) : (
                          <span className="text-slate-300">-</span>
                        )}
                      </td>

                      {activeColumns.map((col) => {
                        const stickyClass =
                          col.key === 'sbd'
                            ? 'sticky left-10 z-10 bg-inherit border-r border-slate-100 font-mono-num min-w-[84px]'
                            : col.key === 'fullName'
                            ? 'sticky left-[124px] z-10 bg-inherit border-r border-slate-100 min-w-[165px] font-medium'
                            : '';

                        if (col.key === 'stt') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-slate-500">{stt}</td>;
                        }
                        if (col.key === 'sbd') {
                          return <td key={col.key} className={`px-3 py-2 ${stickyClass}`}>{row.sbd || '---'}</td>;
                        }
                        if (col.key === 'studentCode') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-slate-600">{row.studentCode || '---'}</td>;
                        }
                        if (col.key === 'fullName') {
                          return <td key={col.key} className={`px-3 py-2 ${stickyClass}`}>{row.fullName}</td>;
                        }
                        if (col.key === 'className') {
                          return <td key={col.key} className="px-3 py-2 whitespace-nowrap">{row.className}</td>;
                        }
                        if (col.key === 'examCode') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num">{row.examCode}</td>;
                        }
                        if (col.key === 'phachCode') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num">{row.phachCode || '---'}</td>;
                        }
                        if (col.key === 'part1') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num">{row.part1 !== null ? roundScore(row.part1, 2) : '-'}</td>;
                        }
                        if (col.key === 'part2') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num">{row.part2 !== null ? roundScore(row.part2, 2) : '-'}</td>;
                        }
                        if (col.key === 'part3') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num">{row.part3 !== null ? roundScore(row.part3, 2) : '-'}</td>;
                        }
                        if (col.key === 'total') {
                          return (
                            <td key={col.key} className="px-3 py-2 font-mono-num whitespace-nowrap">
                              {row.total === null ? (
                                <span className="text-slate-400">Vắng</span>
                              ) : isProvisional ? (
                                <span className="text-amber-700 font-semibold" title="Điểm dự kiến — chưa duyệt chính thức">
                                  {row.total} <span className="text-[10px] font-normal">(tạm tính)</span>
                                </span>
                              ) : (
                                <span
                                  className={`font-bold ${
                                    row.total >= activeExam.passThreshold ? 'text-[#16A34A]' : 'text-[#DC2626]'
                                  }`}
                                >
                                  {row.total}
                                </span>
                              )}
                            </td>
                          );
                        }
                        if (col.key === 'correctCount') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-[#16A34A]">{row.correctCount ?? '-'}</td>;
                        }
                        if (col.key === 'wrongCount') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-[#DC2626]">{row.wrongCount ?? '-'}</td>;
                        }
                        if (col.key === 'blankCount') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-slate-500">{row.blankCount ?? '-'}</td>;
                        }
                        if (col.key === 'status') {
                          const badge =
                            row.status === 'graded'
                              ? 'bg-emerald-50 text-[#16A34A] border-emerald-200'
                              : row.status === 'needs_review'
                              ? 'bg-amber-50 text-amber-700 border-amber-200'
                              : row.status === 'absent'
                              ? 'bg-slate-100 text-slate-600 border-slate-200'
                              : row.status === 'error'
                              ? 'bg-red-50 text-[#DC2626] border-red-200'
                              : 'bg-blue-50 text-[#2563EB] border-blue-200';
                          return (
                            <td key={col.key} className="px-3 py-2 whitespace-nowrap">
                              <span className={`px-2 py-0.5 rounded border text-[11px] font-medium ${badge}`}>
                                {row.status === 'absent' ? 'Vắng thi' : statusLabelVi(row.status)}
                              </span>
                            </td>
                          );
                        }
                        if (col.key === 'rank') {
                          return <td key={col.key} className="px-3 py-2 font-mono-num text-slate-700">{row.rank ?? '-'}</td>;
                        }
                        return (
                          <td key={col.key} className="px-3 py-2 text-slate-600 max-w-[240px] truncate" title={row.note}>
                            {row.note || '-'}
                          </td>
                        );
                      })}

                      <td className="px-3 py-2 text-right whitespace-nowrap">
                        {sub ? (
                          <div className="inline-flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => setInspectedSubId(inspectedSubId === sub.id ? null : sub.id)}
                              title="Xem chi tiết & chỉnh sửa tại chỗ"
                              className="px-2 py-1 rounded border border-slate-200 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                            >
                              <Eye className="w-3 h-3" />
                              Chi tiết
                            </button>
                            {sub.status !== 'graded' && (
                              <button
                                type="button"
                                onClick={() => openReviewSubmission(sub.id, activeExam.id)}
                                title="Mở trang Kiểm duyệt bài thi"
                                className="px-2 py-1 rounded border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 inline-flex items-center gap-1"
                              >
                                <ClipboardCheck className="w-3 h-3" />
                                Duyệt
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openReportCardSubmission(sub.id, activeExam.id)}
                              title="Mở Phiếu trả bài của học sinh"
                              className="px-2 py-1 rounded border border-blue-200 bg-blue-50 text-[#2563EB] hover:bg-blue-100"
                            >
                              Phiếu
                            </button>
                            {confirmDeleteOneId === sub.id ? (
                              <span className="inline-flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await removeSubmission(sub.id);
                                    setConfirmDeleteOneId(null);
                                  }}
                                  className="px-1.5 py-0.5 rounded bg-[#DC2626] text-white"
                                >
                                  Xóa
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteOneId(null)}
                                  className="px-1.5 py-0.5 rounded border border-slate-300"
                                >
                                  Hủy
                                </button>
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setConfirmDeleteOneId(sub.id)}
                                title="Xóa bài làm"
                                className="p-1 text-slate-400 hover:text-[#DC2626]"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        ) : row.student ? (
                          <button
                            type="button"
                            onClick={() => handleToggleAbsent(row.student!, false)}
                            className="px-2 py-1 rounded border border-slate-300 text-slate-700 hover:bg-slate-100 inline-flex items-center gap-1"
                          >
                            <UserCheck className="w-3 h-3" />
                            Bỏ vắng
                          </button>
                        ) : null}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination & Absent quick marker footer */}
        <div className="px-4 py-2.5 border-t border-slate-200 bg-slate-50 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-600">
          <div className="flex items-center gap-2">
            <span>
              Hiển thị <strong className="font-mono-num">{pagedRows.length}</strong> /{' '}
              <strong className="font-mono-num">{filteredRows.length}</strong> bản ghi
            </span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setCurrentPage(1);
              }}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs"
            >
              <option value={15}>15 dòng</option>
              <option value={25}>25 dòng</option>
              <option value={50}>50 dòng</option>
              <option value={100}>100 dòng</option>
              <option value={0}>Tất cả</option>
            </select>
          </div>

          {pageSize > 0 && totalPages > 1 && (
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white disabled:opacity-40"
              >
                Trước
              </button>
              <span className="font-mono-num px-2">
                Trang {currentPage} / {totalPages}
              </span>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                className="px-2.5 py-1 border border-slate-300 rounded bg-white disabled:opacity-40"
              >
                Sau
              </button>
            </div>
          )}

          {/* Quick absent toggle for students without submissions */}
          <div className="flex items-center gap-1.5">
            <UserX className="w-3.5 h-3.5 text-slate-400" />
            <select
              defaultValue=""
              onChange={(e) => {
                const st = examStudents.find((s) => s.id === e.target.value);
                if (st) handleToggleAbsent(st, true);
                e.currentTarget.value = '';
              }}
              className="px-2 py-1 border border-slate-300 rounded bg-white text-xs max-w-[220px]"
            >
              <option value="">Đánh dấu học sinh vắng thi...</option>
              {examStudents
                .filter(
                  (st) =>
                    !st.absentExamIds.includes(activeExam.id) &&
                    !examSubmissions.some((s) => s.studentId === st.id || (s.sbd && s.sbd === st.sbd))
                )
                .map((st) => (
                  <option key={st.id} value={st.id}>
                    {st.sbd} - {st.fullName} ({st.className})
                  </option>
                ))}
            </select>
          </div>
        </div>
      </div>
    </div>
  );
};

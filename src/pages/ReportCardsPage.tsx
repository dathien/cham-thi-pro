import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  CheckSquare,
  Download,
  FileArchive,
  FileText,
  Lock,
  Maximize2,
  Minimize2,
  Printer,
  RefreshCw,
  Search,
  SlidersHorizontal,
  Square,
  Unlock,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { DEFAULT_SETTINGS, getBlob } from '../db/database';
import { computeCompetitionRanks, computeExamAnalytics, roundScore } from '../engine/scoring';
import {
  buildReportCardFilename,
  generateObjectiveComment,
  renderAnnotatedReportCardPdf,
  type CommentBandRule,
  type ReportCardImageMode,
  type ReportCardPaperFormat,
  type ReportCardTemplateKind,
} from '../engine/sheetRenderer';
import type { ExamSubmission, QuestionRecognition, Student } from '../types/omr';

const TEMPLATE_LABELS: { id: ReportCardTemplateKind; label: string; desc: string }[] = [
  { id: 'standard', label: 'Tiêu chuẩn', desc: 'Gọn rõ: điểm, bảng câu, nhận xét' },
  { id: 'detailed', label: 'Chi tiết + Ảnh', desc: 'Ảnh bài thi kèm bảng câu & biểu đồ' },
  { id: 'competency', label: 'Năng lực chuyên đề', desc: 'Tổng hợp điểm theo chuyên đề' },
  { id: 'annotated_sheet', label: 'Trên ảnh bài thi', desc: 'Ảnh bài thi cỡ lớn đánh dấu trực tiếp' },
];

export const ReportCardsPage: React.FC = () => {
  const {
    dataScope,
    setDataScope,
    exams,
    activeExam,
    setActiveExamId,
    students,
    templates,
    submissions,
    settings,
    updateSettings,
    upsertSubmission,
    focusedReportCardSubId,
    setFocusedReportCardSubId,
    setActivePage,
  } = useApp();

  // Left filter & selection
  const [classFilter, setClassFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'graded' | 'needs_review'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [currentSubId, setCurrentSubId] = useState<string>('');
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());

  // Template, image mode, paper format & visibility toggles
  const [templateKind, setTemplateKind] = useState<ReportCardTemplateKind>('detailed');
  const [imageMode, setImageMode] = useState<ReportCardImageMode>('annotated');
  const [paperFormat, setPaperFormat] = useState<ReportCardPaperFormat>('A4');

  const [showLogo, setShowLogo] = useState(true);
  const [showRanking, setShowRanking] = useState(settings.showRankingDefault);
  const [showClassAverage, setShowClassAverage] = useState(true);
  const [showExamImage, setShowExamImage] = useState(true);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [showDetailTable, setShowDetailTable] = useState(true);
  const [showComment, setShowComment] = useState(true);
  const [showComponentChart, setShowComponentChart] = useState(true);
  const [showSignature, setShowSignature] = useState(true);

  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [showBandEditor, setShowBandEditor] = useState(false);
  const [draftBands, setDraftBands] = useState<CommentBandRule[]>(
    settings.reportCommentBands || DEFAULT_SETTINGS.reportCommentBands || []
  );

  // Teacher comment inline editor
  const [commentDraft, setCommentDraft] = useState('');
  const [commentLocked, setCommentLocked] = useState(false);

  const [previewImgUrl, setPreviewImgUrl] = useState('');
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [busyAction, setBusyAction] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const examTemplate = useMemo(
    () => templates.find((t) => t.id === activeExam?.templateId) || templates[0],
    [templates, activeExam]
  );

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);

  const resolveStudent = (sub: ExamSubmission): Student | undefined =>
    (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
    (sub.sbd ? studentBySbd.get(sub.sbd) : undefined);

  const examSubs = useMemo(() => {
    if (!activeExam) return [];
    return submissions.filter((s) => s.examId === activeExam.id && !s.isTestSample);
  }, [submissions, activeExam]);

  const gradedSubs = useMemo(() => examSubs.filter((s) => s.status === 'graded'), [examSubs]);
  const rankMap = useMemo(() => computeCompetitionRanks(gradedSubs), [gradedSubs]);

  const analytics = useMemo(() => {
    if (!activeExam) return null;
    return computeExamAnalytics(
      gradedSubs,
      students,
      activeExam.id,
      activeExam.passThreshold,
      activeExam.scoreScale
    );
  }, [gradedSubs, students, activeExam]);

  const availableClasses = useMemo(() => {
    const set = new Set<string>(activeExam?.classNames || []);
    for (const s of examSubs) {
      const st = resolveStudent(s);
      if (st?.className) set.add(st.className);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b, 'vi'));
  }, [activeExam, examSubs, studentById, studentBySbd]);

  const filteredSubs = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return examSubs
      .filter((sub) => {
        if (statusFilter !== 'all' && sub.status !== statusFilter) return false;
        const st = resolveStudent(sub);
        if (classFilter !== 'all' && st?.className !== classFilter) return false;
        if (q) {
          const hay = `${sub.sbd} ${sub.examCode} ${st?.fullName || ''} ${st?.className || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => a.sbd.localeCompare(b.sbd, 'vi'));
  }, [examSubs, statusFilter, classFilter, searchQuery, studentById, studentBySbd]);

  // Focus requested submission from Gradebook or default to first filtered
  useEffect(() => {
    if (focusedReportCardSubId && examSubs.some((s) => s.id === focusedReportCardSubId)) {
      setCurrentSubId(focusedReportCardSubId);
      setFocusedReportCardSubId(null);
      return;
    }
    if (filteredSubs.length > 0 && !filteredSubs.some((s) => s.id === currentSubId)) {
      setCurrentSubId(filteredSubs[0].id);
    }
  }, [focusedReportCardSubId, filteredSubs, currentSubId, examSubs, setFocusedReportCardSubId]);

  const currentSub = useMemo(
    () => examSubs.find((s) => s.id === currentSubId) || filteredSubs[0] || null,
    [examSubs, currentSubId, filteredSubs]
  );
  const currentStudent = currentSub ? resolveStudent(currentSub) : undefined;

  useEffect(() => {
    setDraftBands(settings.reportCommentBands || DEFAULT_SETTINGS.reportCommentBands || []);
  }, [settings.reportCommentBands]);

  useEffect(() => {
    if (!currentSub) return;
    setCommentDraft(
      currentSub.teacherComment?.trim() ||
        generateObjectiveComment(currentSub, activeExam || undefined, draftBands)
    );
    setCommentLocked(!!currentSub.teacherCommentLocked);
  }, [currentSub?.id]);

  // Load image blob according to imageMode
  useEffect(() => {
    let alive = true;
    if (!currentSub) {
      setPreviewImgUrl('');
      return;
    }
    const blobId =
      imageMode === 'original'
        ? currentSub.originalImageBlobId
        : currentSub.warpedImageBlobId || currentSub.originalImageBlobId;
    getBlob(blobId).then((rec) => {
      if (alive) setPreviewImgUrl(rec?.dataUrl || '');
    });
    return () => {
      alive = false;
    };
  }, [currentSub?.id, currentSub?.updatedAt, imageMode]);

  // Render annotated canvas preview cleanly without mutating original blob
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !previewImgUrl || !currentSub) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      if (imageMode === 'annotated') {
        const W = canvas.width;
        const H = canvas.height;
        const p2Groups = new Map<number, QuestionRecognition[]>();

        for (const q of currentSub.recognition.questions) {
          if (q.part === 'part2') {
            const g = p2Groups.get(q.question) || [];
            g.push(q);
            p2Groups.set(q.question, g);
          }

          for (const b of q.bubbles) {
            const bx = b.cx * W;
            const by = b.cy * H;
            const br = Math.max(5, Math.min(b.rx * W, b.ry * H) * 1.18);
            const chosen =
              q.part === 'part3'
                ? b.isMarked
                : q.detectedValue
                ? b.option === q.detectedValue
                : b.isMarked;

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
              if (showCorrectAnswers && q.part !== 'part3' && b.option === q.correctValue) {
                ctx.strokeStyle = '#2563EB';
                ctx.lineWidth = 2.4;
                ctx.beginPath();
                ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
                ctx.stroke();
              }
            } else if (q.status === 'blank') {
              if (showCorrectAnswers && q.part !== 'part3' && b.option === q.correctValue) {
                ctx.strokeStyle = '#2563EB';
                ctx.lineWidth = 2.2;
                ctx.beginPath();
                ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
                ctx.stroke();
              } else if (b.option === 'A' || b.option === 'Đ') {
                ctx.strokeStyle = 'rgba(100,116,139,0.55)';
                ctx.lineWidth = 1.4;
                ctx.beginPath();
                ctx.arc(bx, by, br + 1.5, 0, Math.PI * 2);
                ctx.stroke();
              }
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

          // Part III tag
          if (q.part === 'part3' && q.bubbles.length > 0) {
            const firstB = q.bubbles[0];
            const px = firstB.cx * W;
            const py = Math.max(18, firstB.cy * H - 22);
            ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
            const txt = showCorrectAnswers
              ? `${q.detectedValue || 'Trống'} | ĐÁ: ${q.correctValue || '-'}`
              : q.detectedValue || 'Trống';
            const tw = ctx.measureText(txt).width;
            ctx.fillStyle = 'rgba(255,255,255,0.88)';
            ctx.fillRect(px - 2, py - 11, tw + 6, 15);
            ctx.fillStyle =
              q.status === 'correct'
                ? '#16A34A'
                : q.status === 'wrong'
                ? '#DC2626'
                : '#475569';
            ctx.fillText(txt, px + 1, py);
          }
        }

        // Part II progressive whole-question badge
        for (const [, items] of p2Groups.entries()) {
          const last = items[items.length - 1];
          const b = last?.bubbles[0];
          if (!b) continue;
          const pts = roundScore(items.reduce((a, x) => a + x.earnedPoints, 0), 2);
          const bx = b.cx * W + 42;
          const by = b.cy * H + 18;
          ctx.fillStyle = 'rgba(255,255,255,0.9)';
          ctx.fillRect(bx - 3, by - 11, 46, 15);
          ctx.font = 'bold 12px "Be Vietnam Pro", sans-serif';
          ctx.fillStyle = pts > 0 ? '#16A34A' : '#DC2626';
          ctx.fillText(`+${pts}đ`, bx, by);
        }
      }
    };
    img.src = previewImgUrl;
  }, [previewImgUrl, imageMode, showCorrectAnswers, currentSub]);

  // Group Part II questions for clean progressive display
  const groupedPart2 = useMemo(() => {
    if (!currentSub) return [];
    const map = new Map<number, QuestionRecognition[]>();
    for (const q of currentSub.recognition.questions) {
      if (q.part === 'part2') {
        const list = map.get(q.question) || [];
        list.push(q);
        map.set(q.question, list);
      }
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [currentSub]);

  const part1List = useMemo(
    () =>
      (currentSub?.recognition.questions || [])
        .filter((q) => q.part === 'part1')
        .sort((a, b) => a.question - b.question),
    [currentSub]
  );

  const part3List = useMemo(
    () =>
      (currentSub?.recognition.questions || [])
        .filter((q) => q.part === 'part3')
        .sort((a, b) => a.question - b.question),
    [currentSub]
  );

  // Competency breakdown when questionSpecs exists
  const competencyStats = useMemo(() => {
    if (!activeExam?.questionSpecs?.length || !currentSub) return [];
    const mapSpec = new Map(
      activeExam.questionSpecs.map((s) => [`${s.part}_${s.question}`, s])
    );
    const agg = new Map<string, { earned: number; max: number; count: number }>();
    for (const q of currentSub.recognition.questions) {
      const sp = mapSpec.get(`${q.part}_${q.question}`);
      const tp = sp?.topic || 'Chung';
      const cur = agg.get(tp) || { earned: 0, max: 0, count: 0 };
      cur.earned += q.earnedPoints;
      cur.max += q.maxPoints || 0.25;
      cur.count += 1;
      agg.set(tp, cur);
    }
    return Array.from(agg.entries()).map(([topic, v]) => ({
      topic,
      earned: roundScore(v.earned, 2),
      max: roundScore(v.max, 2),
      pct: v.max > 0 ? Math.round((v.earned / v.max) * 100) : 0,
      count: v.count,
    }));
  }, [activeExam, currentSub]);

  const buildPdfInputs = async (targets: ExamSubmission[]) => {
    const out = [];
    for (const sub of targets) {
      const blobId =
        imageMode === 'original'
          ? sub.originalImageBlobId
          : sub.warpedImageBlobId || sub.originalImageBlobId;
      const rec = await getBlob(blobId);
      out.push({
        submission: sub,
        student: resolveStudent(sub),
        imageDataUrl: rec?.dataUrl,
        isWarpedCoords: imageMode !== 'original' || !sub.warpedImageBlobId,
        rank: sub.status === 'graded' ? rankMap.get(sub.id) : undefined,
      });
    }
    return out;
  };

  const getPdfOptions = () => ({
    templateKind,
    imageMode,
    paperFormat,
    showLogo,
    schoolLogoDataUrl: settings.schoolLogoDataUrl,
    showRanking,
    showClassAverage,
    showExamImage,
    showCorrectAnswers,
    showDetailTable,
    showComment,
    showComponentChart,
    showSignature,
    classAverage: analytics?.mean ?? 0,
    totalGraded: gradedSubs.length,
    commentBands: draftBands,
  });

  const downloadPdfBytes = (bytes: Uint8Array, filename: string) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
  };

  const printPdfBytes = (bytes: Uint8Array) => {
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
      } catch {
        window.print();
      }
      setTimeout(() => {
        if (iframe.parentNode) iframe.parentNode.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 60000);
    };
  };

  const handleExportPdf = async (mode: 'single' | 'selected' | 'class', shouldPrint = false) => {
    if (!activeExam || !examTemplate) return;
    const targets =
      mode === 'single'
        ? currentSub
          ? [currentSub]
          : []
        : mode === 'selected'
        ? filteredSubs.filter((s) => checkedIds.has(s.id))
        : filteredSubs;
    if (targets.length === 0) {
      setNotice('Chưa có bài thi nào trong nhóm xuất.');
      return;
    }
    setBusyAction(shouldPrint ? 'Đang chuẩn bị bản in...' : `Đang tạo PDF (${targets.length} phiếu)...`);
    try {
      const inputs = await buildPdfInputs(targets);
      const bytes = await renderAnnotatedReportCardPdf(inputs, activeExam, examTemplate, getPdfOptions());
      if (shouldPrint) {
        printPdfBytes(bytes);
      } else {
        const fname =
          targets.length === 1
            ? buildReportCardFilename(inputs[0].student, targets[0], activeExam)
            : `Phieu-tra-bai_${classFilter === 'all' ? 'TatCa' : classFilter}_${activeExam.subject}_${targets.length}-phieu.pdf`.replace(
                /\s+/g,
                '-'
              );
        downloadPdfBytes(bytes, fname);
      }
    } finally {
      setBusyAction(null);
    }
  };

  const handleExportZip = async () => {
    if (!activeExam || !examTemplate) return;
    const targets =
      checkedIds.size > 0 ? filteredSubs.filter((s) => checkedIds.has(s.id)) : filteredSubs;
    if (targets.length === 0) {
      setNotice('Chưa chọn bài thi để nén ZIP.');
      return;
    }
    setBusyAction(`Đang tạo ZIP ${targets.length} file PDF riêng...`);
    try {
      const zip = new JSZip();
      const inputs = await buildPdfInputs(targets);
      const opts = getPdfOptions();
      for (const inp of inputs) {
        const bytes = await renderAnnotatedReportCardPdf([inp], activeExam, examTemplate, opts);
        const fname = buildReportCardFilename(inp.student, inp.submission, activeExam);
        zip.file(fname, bytes);
      }
      const blob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Phieu-tra-bai_${classFilter === 'all' ? 'TatCa' : classFilter}_${activeExam.subject}.zip`.replace(
        /\s+/g,
        '-'
      );
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    } finally {
      setBusyAction(null);
    }
  };

  const handleSaveComment = async (lockState: boolean) => {
    if (!currentSub) return;
    await upsertSubmission({
      ...currentSub,
      teacherComment: commentDraft.trim(),
      teacherCommentLocked: lockState,
      updatedAt: Date.now(),
    });
    setCommentLocked(lockState);
    setNotice(
      lockState
        ? 'Đã lưu và khóa nhận xét giáo viên (giữ nguyên khi chấm lại).'
        : 'Đã lưu nhận xét cho phiếu trả bài.'
    );
  };

  const handleUploadSchoolLogo = (file: File) => {
    const reader = new FileReader();
    reader.onload = async () => {
      if (typeof reader.result === 'string') {
        await updateSettings({ ...settings, schoolLogoDataUrl: reader.result });
        setNotice('Đã cập nhật logo trường cho phiếu trả bài.');
      }
    };
    reader.readAsDataURL(file);
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

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2">
        <div>
          <h1 className="text-[21px] font-bold text-[#1E293B]">Phiếu trả bài cá nhân hóa</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeExam.name} · Môn {activeExam.subject} · Hỗ trợ 4 mẫu phiếu, 3 chế độ ảnh, khổ A4 / A5 / 2×A5.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="inline-flex rounded border border-slate-300 bg-slate-50 p-0.5 text-xs">
            <button
              type="button"
              onClick={() => setDataScope('practice')}
              className={`px-2.5 py-1 rounded ${dataScope === 'practice' ? 'bg-white text-[#2563EB] font-medium' : 'text-slate-600'}`}
            >
              Thực hành
            </button>
            <button
              type="button"
              onClick={() => setDataScope('official')}
              className={`px-2.5 py-1 rounded ${dataScope === 'official' ? 'bg-white text-[#16A34A] font-medium' : 'text-slate-600'}`}
            >
              Chính thức
            </button>
          </div>
          <select
            value={activeExam.id}
            onChange={(e) => setActiveExamId(e.target.value)}
            className="px-2.5 py-1.5 border border-slate-300 rounded text-xs bg-white font-medium"
          >
            {exams.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {notice && (
        <div className="bg-blue-50 border border-blue-200 rounded-md px-3.5 py-2 text-xs text-blue-800 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      )}

      {/* 2-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-start">
        {/* LEFT COLUMN: Filter + Student list */}
        {!fullscreenPreview && (
          <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-3.5 space-y-3">
            <div className="grid grid-cols-2 gap-2 text-xs">
              <select
                value={classFilter}
                onChange={(e) => setClassFilter(e.target.value)}
                className="px-2 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="all">Tất cả lớp</option>
                {availableClasses.map((c) => (
                  <option key={c} value={c}>
                    Lớp {c}
                  </option>
                ))}
              </select>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | 'graded' | 'needs_review')}
                className="px-2 py-1.5 border border-slate-300 rounded bg-white"
              >
                <option value="all">Tất cả trạng thái</option>
                <option value="graded">Chỉ đã duyệt</option>
                <option value="needs_review">Chờ kiểm duyệt (tạm tính)</option>
              </select>
            </div>

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Tìm SBD, họ tên, mã đề..."
                className="w-full pl-8 pr-3 py-1.5 border border-slate-300 rounded text-xs"
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-600 pt-1">
              <span>
                Danh sách (<strong className="font-mono-num">{filteredSubs.length}</strong> bài)
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCheckedIds(new Set(filteredSubs.map((s) => s.id)))}
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline"
                >
                  <CheckSquare className="w-3 h-3" /> Chọn hết
                </button>
                <button
                  type="button"
                  onClick={() => setCheckedIds(new Set())}
                  className="inline-flex items-center gap-1 text-slate-500 hover:underline"
                >
                  <Square className="w-3 h-3" /> Bỏ chọn
                </button>
              </div>
            </div>

            <div className="max-h-[540px] overflow-y-auto divide-y divide-slate-100 border border-slate-200 rounded">
              {filteredSubs.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500">
                  Không có bài thi nào khớp bộ lọc.
                </div>
              ) : (
                filteredSubs.map((sub) => {
                  const st = resolveStudent(sub);
                  const active = currentSub?.id === sub.id;
                  const checked = checkedIds.has(sub.id);
                  const isProv = sub.status !== 'graded';
                  return (
                    <div
                      key={sub.id}
                      className={`px-2.5 py-2 flex items-center gap-2 text-xs cursor-pointer ${
                        active ? 'bg-blue-50 border-l-2 border-l-[#2563EB]' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => setCurrentSubId(sub.id)}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onClick={(e) => e.stopPropagation()}
                        onChange={() => {
                          const next = new Set(checkedIds);
                          if (next.has(sub.id)) next.delete(sub.id);
                          else next.add(sub.id);
                          setCheckedIds(next);
                        }}
                      />
                      <div className="flex-1 min-w-0">
                        <div className="font-semibold text-[#1E293B] truncate">
                          {st?.fullName || '(Chưa đối chiếu)'}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          SBD {sub.sbd || '---'} · {st?.className || '---'} · Đề {sub.examCode || '---'}
                        </div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className={`font-bold font-mono-num ${
                            isProv ? 'text-amber-600' : 'text-[#16A34A]'
                          }`}
                        >
                          {sub.scoreBreakdown.total}đ
                        </div>
                        <div className="text-[10px] text-slate-400">
                          {isProv ? 'Tạm tính' : 'Chính thức'}
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        )}

        {/* RIGHT COLUMN: Controls + Preview + Export */}
        <div className={fullscreenPreview ? 'lg:col-span-12 space-y-4' : 'lg:col-span-8 space-y-4'}>
          {/* Configuration Toolbar */}
          <div className="bg-white border border-slate-200 rounded-lg p-3.5 space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1">Mẫu phiếu trả bài</div>
                <select
                  value={templateKind}
                  onChange={(e) => setTemplateKind(e.target.value as ReportCardTemplateKind)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                >
                  {TEMPLATE_LABELS.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.label} — {t.desc}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1">Chế độ ảnh bài thi</div>
                <select
                  value={imageMode}
                  onChange={(e) => setImageMode(e.target.value as ReportCardImageMode)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                >
                  <option value="annotated">Ảnh đánh dấu kết quả</option>
                  <option value="warped">Ảnh đã xử lý (nắn phẳng)</option>
                  <option value="original">Ảnh gốc</option>
                </select>
              </div>
              <div>
                <div className="text-[11px] font-semibold text-slate-600 mb-1">Khổ giấy xuất PDF</div>
                <select
                  value={paperFormat}
                  onChange={(e) => setPaperFormat(e.target.value as ReportCardPaperFormat)}
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white font-medium"
                >
                  <option value="A4">A4 dọc (1 phiếu / trang)</option>
                  <option value="A5">A5 dọc (1 phiếu nhỏ / trang)</option>
                  <option value="paired_a5">2 phiếu A5 ghép trên 1 tờ A4 ngang</option>
                </select>
              </div>
            </div>

            {/* Visibility toggles */}
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 pt-2 border-t border-slate-100 text-[11px] text-slate-700">
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showLogo} onChange={(e) => setShowLogo(e.target.checked)} />
                Logo trường
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showRanking} onChange={(e) => setShowRanking(e.target.checked)} />
                Xếp hạng
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showClassAverage} onChange={(e) => setShowClassAverage(e.target.checked)} />
                Điểm TB chung
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showExamImage} onChange={(e) => setShowExamImage(e.target.checked)} />
                Ảnh bài thi
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showCorrectAnswers} onChange={(e) => setShowCorrectAnswers(e.target.checked)} />
                Đáp án đúng
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showDetailTable} onChange={(e) => setShowDetailTable(e.target.checked)} />
                Bảng chi tiết câu
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showComment} onChange={(e) => setShowComment(e.target.checked)} />
                Nhận xét
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showComponentChart} onChange={(e) => setShowComponentChart(e.target.checked)} />
                Thanh tỷ trọng điểm
              </label>
              <label className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={showSignature} onChange={(e) => setShowSignature(e.target.checked)} />
                Chữ ký GV
              </label>

              <label className="inline-flex items-center gap-1 px-2 py-0.5 border border-slate-300 rounded cursor-pointer hover:bg-slate-50 ml-auto">
                <Upload className="w-3 h-3" />
                Tải logo trường
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleUploadSchoolLogo(f);
                  }}
                />
              </label>
            </div>

            {/* Export & Print action bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  disabled={!currentSub || !!busyAction}
                  onClick={() => handleExportPdf('single', false)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  Xuất PDF học sinh này
                </button>
                <button
                  type="button"
                  disabled={checkedIds.size === 0 || !!busyAction}
                  onClick={() => handleExportPdf('selected', false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF đã chọn ({checkedIds.size})
                </button>
                <button
                  type="button"
                  disabled={filteredSubs.length === 0 || !!busyAction}
                  onClick={() => handleExportPdf('class', false)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <FileText className="w-3.5 h-3.5" />
                  PDF cả lớp ({filteredSubs.length})
                </button>
                <button
                  type="button"
                  disabled={filteredSubs.length === 0 || !!busyAction}
                  onClick={handleExportZip}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded bg-[#16A34A] text-white font-medium hover:bg-green-700 disabled:opacity-50"
                >
                  <FileArchive className="w-3.5 h-3.5" />
                  Xuất ZIP ({checkedIds.size > 0 ? checkedIds.size : filteredSubs.length} file)
                </button>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={!currentSub || !!busyAction}
                  onClick={() => handleExportPdf('single', true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In phiếu
                </button>
                <button
                  type="button"
                  disabled={filteredSubs.length === 0 || !!busyAction}
                  onClick={() => handleExportPdf(checkedIds.size > 0 ? 'selected' : 'class', true)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In hàng loạt
                </button>
                <button
                  type="button"
                  onClick={() => setFullscreenPreview((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                >
                  {fullscreenPreview ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                  {fullscreenPreview ? 'Thu gọn' : 'Toàn màn hình'}
                </button>
              </div>
            </div>
            {busyAction && <div className="text-[11px] text-[#2563EB] font-medium">{busyAction}</div>}
          </div>

          {/* LIVE REPORT CARD PREVIEW */}
          {!currentSub ? (
            <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
              Chọn một bài thi ở cột bên trái để xem và xuất phiếu trả bài.
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              {/* Provisional banner if not yet officially approved */}
              {currentSub.status !== 'graded' && (
                <div className="bg-amber-50 border border-amber-300 rounded px-3.5 py-2 text-xs text-amber-900 flex items-center justify-between">
                  <span>
                    <strong>Phiếu tạm tính – Chờ kiểm duyệt:</strong> Điểm số hiện tại chưa phải điểm chính thức.
                    {currentSub.reviewReasons.length > 0 && ` Lý do: ${currentSub.reviewReasons.join('; ')}.`}
                  </span>
                </div>
              )}

              {/* Card Header */}
              <div className="border border-slate-200 rounded-lg bg-slate-50/70 p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {showLogo && settings.schoolLogoDataUrl && (
                    <img
                      src={settings.schoolLogoDataUrl}
                      alt="Logo trường"
                      className="w-12 h-12 object-contain rounded border border-slate-200 bg-white p-1"
                    />
                  )}
                  <div>
                    <div className="text-[11px] font-bold text-slate-500 uppercase">
                      {activeExam.schoolName || 'TRƯỜNG THPT'}
                    </div>
                    <div className="text-sm font-bold text-[#2563EB]">
                      PHIẾU TRẢ BÀI – {activeExam.name}
                    </div>
                    <div className="text-xs text-slate-700 mt-0.5">
                      Họ tên: <strong>{currentStudent?.fullName || '(Chưa đối chiếu)'}</strong> · Lớp:{' '}
                      <strong>{currentStudent?.className || '---'}</strong> · SBD:{' '}
                      <strong className="font-mono-num">{currentSub.sbd || '---'}</strong> · Mã đề:{' '}
                      <strong className="font-mono-num">{currentSub.examCode || '---'}</strong>
                    </div>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0">
                  <div className="text-[11px] text-slate-500">
                    {currentSub.status === 'graded' ? 'Tổng điểm chính thức' : 'Tổng điểm tạm tính'}
                  </div>
                  <div
                    className={`text-2xl font-bold font-mono-num ${
                      currentSub.status !== 'graded'
                        ? 'text-amber-600'
                        : currentSub.scoreBreakdown.total >= activeExam.passThreshold
                        ? 'text-[#16A34A]'
                        : 'text-[#DC2626]'
                    }`}
                  >
                    {currentSub.scoreBreakdown.total}
                    <span className="text-xs font-normal text-slate-500">
                      /{currentSub.scoreBreakdown.maxPossible}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    {showClassAverage && `ĐTB: ${analytics?.mean ?? 0}`}
                    {showRanking &&
                      currentSub.status === 'graded' &&
                      rankMap.get(currentSub.id) &&
                      ` · Hạng: ${rankMap.get(currentSub.id)}/${gradedSubs.length}`}
                  </div>
                </div>
              </div>

              {/* Component Progress Chart */}
              {showComponentChart && (
                <div className="space-y-1.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between text-[11px] text-slate-600">
                    <span>
                      Thành phần: Phần I <strong>{currentSub.scoreBreakdown.part1}đ</strong>
                      {examTemplate && examTemplate.part2Count > 0 && (
                        <> · Phần II <strong>{currentSub.scoreBreakdown.part2}đ</strong></>
                      )}
                      {examTemplate && examTemplate.part3Count > 0 && (
                        <> · Phần III <strong>{currentSub.scoreBreakdown.part3}đ</strong></>
                      )}
                    </span>
                    <span className="font-mono-num">
                      Đúng {currentSub.scoreBreakdown.correctCount} · Sai {currentSub.scoreBreakdown.wrongCount} · Trống{' '}
                      {currentSub.scoreBreakdown.blankCount}
                    </span>
                  </div>
                  <div className="h-2.5 w-full rounded bg-slate-100 overflow-hidden flex">
                    <div
                      style={{
                        width: `${(currentSub.scoreBreakdown.part1 / Math.max(0.01, currentSub.scoreBreakdown.maxPossible)) * 100}%`,
                      }}
                      className="bg-[#2563EB]"
                      title="Phần I"
                    />
                    <div
                      style={{
                        width: `${(currentSub.scoreBreakdown.part2 / Math.max(0.01, currentSub.scoreBreakdown.maxPossible)) * 100}%`,
                      }}
                      className="bg-[#16A34A]"
                      title="Phần II"
                    />
                    <div
                      style={{
                        width: `${(currentSub.scoreBreakdown.part3 / Math.max(0.01, currentSub.scoreBreakdown.maxPossible)) * 100}%`,
                      }}
                      className="bg-violet-600"
                      title="Phần III"
                    />
                  </div>
                </div>
              )}

              {/* Body: Image + Detail Table */}
              <div
                className={`grid gap-4 ${
                  templateKind === 'annotated_sheet' ||
                  !showExamImage ||
                  templateKind === 'standard' ||
                  templateKind === 'competency'
                    ? 'grid-cols-1'
                    : 'grid-cols-1 xl:grid-cols-12'
                }`}
              >
                {showExamImage &&
                  templateKind !== 'standard' &&
                  templateKind !== 'competency' && (
                    <div
                      className={
                        templateKind === 'annotated_sheet' ? 'space-y-1.5' : 'xl:col-span-6 space-y-1.5'
                      }
                    >
                      <div className="border border-slate-200 rounded bg-slate-50 p-2 flex justify-center overflow-auto max-h-[600px]">
                        {previewImgUrl ? (
                          <canvas ref={canvasRef} className="max-w-full h-auto" />
                        ) : (
                          <div className="py-12 text-xs text-slate-400">Không có ảnh phiếu thi</div>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">
                        Chú thích: <span className="text-[#16A34A] font-medium">Xanh lá</span> = Đúng ·{' '}
                        <span className="text-[#DC2626] font-medium">X đỏ</span> = Sai ·{' '}
                        <span className="text-[#2563EB] font-medium">Vòng xanh dương</span> = Đáp án đúng ·{' '}
                        <span className="text-orange-600 font-medium">Cam</span> = Cần duyệt
                      </div>
                    </div>
                  )}

                {templateKind === 'competency' && (
                  <div className="space-y-2 text-xs">
                    <div className="font-semibold text-[#1E293B]">Phân tích năng lực theo chuyên đề</div>
                    {competencyStats.length === 0 ? (
                      <div className="p-4 border border-slate-200 rounded bg-slate-50 text-slate-500">
                        Đề kiểm tra này chưa khai báo ma trận chuyên đề cho từng câu hỏi (có thể thiết lập tại trang Thống kê & Phân tích).
                      </div>
                    ) : (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {competencyStats.map((cs) => (
                          <div key={cs.topic} className="border border-slate-200 rounded p-2.5">
                            <div className="flex justify-between font-medium">
                              <span>{cs.topic}</span>
                              <span className="font-mono-num text-[#2563EB]">
                                {cs.earned}/{cs.max}đ ({cs.pct}%)
                              </span>
                            </div>
                            <div className="h-1.5 bg-slate-100 rounded mt-1.5 overflow-hidden">
                              <div className="h-full bg-[#2563EB]" style={{ width: `${cs.pct}%` }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {showDetailTable && templateKind !== 'annotated_sheet' && (
                  <div
                    className={
                      showExamImage && templateKind !== 'standard' && templateKind !== 'competency'
                        ? 'xl:col-span-6 space-y-3'
                        : 'space-y-3'
                    }
                  >
                    {/* Part I compact grid */}
                    {part1List.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#1E293B] mb-1.5">
                          Phần I — Trắc nghiệm nhiều lựa chọn ({part1List.length} câu)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 text-[11px]">
                          {part1List.map((q) => (
                            <div
                              key={q.question}
                              className={`px-2 py-1 rounded border flex items-center justify-between font-mono-num ${
                                q.status === 'correct'
                                  ? 'bg-emerald-50/70 border-emerald-200'
                                  : q.status === 'wrong'
                                  ? 'bg-red-50/70 border-red-200'
                                  : q.status === 'blank'
                                  ? 'bg-slate-50 border-slate-200'
                                  : 'bg-amber-50 border-amber-200'
                              }`}
                            >
                              <span className="font-semibold">C{q.question}</span>
                              <span>
                                {q.detectedValue || '-'}
                                {showCorrectAnswers && q.status !== 'correct' && (
                                  <span className="text-[#2563EB]"> ({q.correctValue || '-'})</span>
                                )}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Part II progressive group table */}
                    {groupedPart2.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#1E293B] mb-1.5">
                          Phần II — Đúng / Sai (tính điểm lũy tiến theo câu)
                        </div>
                        <div className="border border-slate-200 rounded overflow-hidden">
                          <table className="w-full text-[11px]">
                            <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
                              <tr>
                                <th className="px-2 py-1 text-left">Câu</th>
                                <th className="px-2 py-1 text-left">Chi tiết a, b, c, d (Chọn / ĐÁ)</th>
                                <th className="px-2 py-1 text-right">Điểm</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {groupedPart2.map(([qNum, items]) => {
                                const pts = roundScore(items.reduce((a, b) => a + b.earnedPoints, 0), 2);
                                return (
                                  <tr key={qNum}>
                                    <td className="px-2 py-1 font-semibold font-mono-num">Câu {qNum}</td>
                                    <td className="px-2 py-1">
                                      <div className="flex flex-wrap gap-2">
                                        {items.map((it) => (
                                          <span
                                            key={it.subItem}
                                            className={`font-mono-num ${
                                              it.status === 'correct'
                                                ? 'text-[#16A34A]'
                                                : it.status === 'wrong'
                                                ? 'text-[#DC2626]'
                                                : 'text-slate-500'
                                            }`}
                                          >
                                            {it.subItem}){it.detectedValue || '-'}
                                            {showCorrectAnswers ? `/${it.correctValue || '-'}` : ''}
                                          </span>
                                        ))}
                                      </div>
                                    </td>
                                    <td className="px-2 py-1 text-right font-mono-num font-bold">{pts}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {/* Part III short-answer table */}
                    {part3List.length > 0 && (
                      <div>
                        <div className="text-xs font-semibold text-[#1E293B] mb-1.5">
                          Phần III — Trả lời ngắn ({part3List.length} câu)
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5 text-[11px]">
                          {part3List.map((q) => (
                            <div
                              key={q.question}
                              className={`px-2 py-1.5 rounded border font-mono-num ${
                                q.status === 'correct'
                                  ? 'bg-emerald-50/70 border-emerald-200'
                                  : q.status === 'wrong'
                                  ? 'bg-red-50/70 border-red-200'
                                  : 'bg-slate-50 border-slate-200'
                              }`}
                            >
                              <div className="font-semibold">Câu {q.question}</div>
                              <div>
                                Đọc: <strong>{q.detectedValue || 'Trống'}</strong>
                                {showCorrectAnswers && (
                                  <span className="text-[#2563EB]"> · ĐÁ: {q.correctValue || '-'}</span>
                                )}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Teacher Comment Box & Configurable Score Bands */}
              {showComment && (
                <div className="border border-slate-200 rounded-lg bg-slate-50/60 p-3.5 space-y-2.5 text-xs">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#1E293B]">
                      Nhận xét kết quả (tự động theo khung điểm, có thể chỉnh sửa)
                    </span>
                    <div className="flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setShowBandEditor((v) => !v)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <SlidersHorizontal className="w-3 h-3" />
                        Khung nhận xét
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCommentLocked(false);
                          setCommentDraft(
                            generateObjectiveComment(
                              { ...currentSub, teacherCommentLocked: false },
                              activeExam,
                              draftBands
                            )
                          );
                        }}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
                      >
                        <RefreshCw className="w-3 h-3" />
                        Tạo lại tự động
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveComment(!commentLocked)}
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded border ${
                          commentLocked
                            ? 'bg-blue-50 border-blue-300 text-[#2563EB] font-medium'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                      >
                        {commentLocked ? <Lock className="w-3 h-3" /> : <Unlock className="w-3 h-3" />}
                        {commentLocked ? 'Đã khóa' : 'Khóa nhận xét'}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSaveComment(commentLocked)}
                        className="px-2.5 py-1 rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700"
                      >
                        Lưu nhận xét
                      </button>
                    </div>
                  </div>

                  <textarea
                    rows={2}
                    value={commentDraft}
                    onChange={(e) => setCommentDraft(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white text-xs"
                  />

                  {showBandEditor && (
                    <div className="border-t border-slate-200 pt-2.5 space-y-2">
                      <div className="text-[11px] font-semibold text-slate-600">
                        Cấu hình khung nhận xét theo thang điểm 10 (lưu bền vững vào hệ thống)
                      </div>
                      {draftBands.map((b, i) => (
                        <div key={i} className="grid grid-cols-12 gap-2 items-center">
                          <input
                            type="number"
                            step="0.5"
                            value={b.minScore}
                            onChange={(e) =>
                              setDraftBands((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, minScore: Number(e.target.value) } : x
                                )
                              )
                            }
                            className="col-span-2 px-2 py-1 border border-slate-300 rounded font-mono-num"
                          />
                          <input
                            type="text"
                            value={b.title}
                            onChange={(e) =>
                              setDraftBands((prev) =>
                                prev.map((x, idx) => (idx === i ? { ...x, title: e.target.value } : x))
                              )
                            }
                            className="col-span-3 px-2 py-1 border border-slate-300 rounded"
                          />
                          <input
                            type="text"
                            value={b.commentTemplate}
                            onChange={(e) =>
                              setDraftBands((prev) =>
                                prev.map((x, idx) =>
                                  idx === i ? { ...x, commentTemplate: e.target.value } : x
                                )
                              )
                            }
                            className="col-span-7 px-2 py-1 border border-slate-300 rounded"
                          />
                        </div>
                      ))}
                      <button
                        type="button"
                        onClick={async () => {
                          await updateSettings({ ...settings, reportCommentBands: draftBands });
                          setShowBandEditor(false);
                          setNotice('Đã lưu cấu hình khung nhận xét.');
                        }}
                        className="px-3 py-1 rounded bg-[#16A34A] text-white font-medium"
                      >
                        Áp dụng & lưu cấu hình khung
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Signature block */}
              {showSignature && (
                <div className="flex justify-between items-start pt-2 text-xs text-slate-600">
                  <div>Ngày trả bài: {activeExam.examDate || '..../..../2026'}</div>
                  <div className="text-center pr-6">
                    <div className="font-semibold text-[#1E293B]">
                      Giáo viên: {activeExam.teacherName || '....................'}
                    </div>
                    <div className="text-[11px] text-slate-400 mt-1">(Ký và ghi rõ họ tên)</div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

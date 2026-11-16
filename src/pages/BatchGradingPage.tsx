import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FileUp,
  FlaskConical,
  Pause,
  Play,
  RefreshCw,
  Trash2,
  XCircle,
} from 'lucide-react';
import { useApp, type PracticeGradeRunItem } from '../context/AppContext';
import { saveBlob } from '../db/database';
import { processSheetImageWithOpenCV } from '../engine/omrEngine';
import {
  closePdfDocument,
  getPdfPageCount,
  releaseCanvasMemory,
  renderPdfPageToCanvas,
} from '../engine/pdfReader';
import {
  buildPracticeAnswerKeys,
  buildPracticeExams,
  buildPracticeSheets225,
  generatePracticeBatchPdf,
} from '../engine/practiceData';
import type { ExamSubmission } from '../types/omr';

interface QueueTask {
  id: string;
  label: string;
  file: File;
  pageNumber?: number;
  status: 'queued' | 'processing' | 'done' | 'needs_review' | 'error';
  message?: string;
  score?: number;
  sbd?: string;
  examCode?: string;
}

export const BatchGradingPage: React.FC = () => {
  const {
    activeExam,
    exams,
    templates,
    answerKeys,
    students,
    settings,
    opencvStatus,
    upsertSubmission,
    runPracticeGrading,
    setDataScope,
    setActiveExamId,
    setActivePage,
  } = useApp();

  const fileInputRef = useRef<HTMLInputElement>(null);
  const cancelRef = useRef(false);
  const pauseRef = useRef(false);

  const [selectedTplId, setSelectedTplId] = useState<string>(
    activeExam?.templateId || templates[0]?.id || ''
  );
  const [queue, setQueue] = useState<QueueTask[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [workerReady, setWorkerReady] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  // Practice 135-sheet batch tester state
  const [practiceSubset, setPracticeSubset] = useState<string>('exam_prac_toan12');
  const [practiceBusy, setPracticeBusy] = useState(false);
  const [practiceProgress, setPracticeProgress] = useState<{ done: number; total: number } | null>(
    null
  );
  const [practiceResults, setPracticeResults] = useState<PracticeGradeRunItem[]>([]);
  const [pdfGenerating, setPdfGenerating] = useState(false);

  useEffect(() => {
    if (activeExam?.templateId) setSelectedTplId(activeExam.templateId);
  }, [activeExam?.templateId]);

  useEffect(() => {
    if (typeof Worker === 'undefined') return;
    try {
      const w = new Worker('/workers/omr-worker.js');
      w.onmessage = (e) => {
        if (e.data?.type === 'READY' || (e.data?.type === 'STATUS' && e.data?.ready)) {
          setWorkerReady(true);
        }
      };
      w.postMessage({ type: 'PING' });
      return () => w.terminate();
    } catch {
      setWorkerReady(false);
    }
  }, []);

  const allPracticeSheets = useMemo(() => buildPracticeSheets225(), []);
  const selectedPracticeSheets = useMemo(() => {
    if (practiceSubset === 'all_225') return allPracticeSheets;
    return allPracticeSheets.filter((s) => s.examId === practiceSubset);
  }, [allPracticeSheets, practiceSubset]);

  const template = templates.find((t) => t.id === selectedTplId) || templates[0];
  const examKeys = activeExam
    ? answerKeys.filter((k) => k.examId === activeExam.id)
    : [];

  const handleDownloadPracticePdf = async () => {
    setPdfGenerating(true);
    try {
      const practiceExams = exams.some((e) => e.isPractice)
        ? exams
        : buildPracticeExams();
      const practiceKeys = answerKeys.some((k) => k.isPractice)
        ? answerKeys
        : buildPracticeAnswerKeys();

      const pdfBytes = await generatePracticeBatchPdf(
        selectedPracticeSheets,
        practiceExams,
        templates,
        practiceKeys
      );
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bo_phieu_thuc_hanh_${practiceSubset}_${selectedPracticeSheets.length}_trang.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setPdfGenerating(false);
    }
  };

  const handleRunPracticeTestGrading = async () => {
    if (opencvStatus !== 'ready' || practiceBusy) return;
    setDataScope('practice');
    if (practiceSubset !== 'all_225') {
      setActiveExamId(practiceSubset);
    }
    setPracticeBusy(true);
    setPracticeResults([]);
    setPracticeProgress({ done: 0, total: selectedPracticeSheets.length });

    try {
      const results = await runPracticeGrading(
        selectedPracticeSheets,
        (done, total, item) => {
          setPracticeProgress({ done, total });
          if (item) {
            setPracticeResults((prev) => [...prev, item]);
          }
        },
        { forceRegrade: true }
      );
      setPracticeResults(results);
    } finally {
      setPracticeBusy(false);
    }
  };

  const enqueueFiles = async (files: FileList | File[]) => {
    const newTasks: QueueTask[] = [];
    for (const file of Array.from(files)) {
      const ext = file.name.toLowerCase();
      if (file.type === 'application/pdf' || ext.endsWith('.pdf')) {
        try {
          const { doc, numPages } = await getPdfPageCount(file);
          for (let p = 1; p <= numPages; p++) {
            newTasks.push({
              id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}_p${p}`,
              label: `${file.name} — Trang ${p}/${numPages}`,
              file,
              pageNumber: p,
              status: 'queued',
            });
          }
          await closePdfDocument(doc);
        } catch (err) {
          newTasks.push({
            id: `task_err_${Date.now()}`,
            label: file.name,
            file,
            status: 'error',
            message: err instanceof Error ? err.message : 'Không đọc được file PDF',
          });
        }
      } else if (
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|webp)$/i.test(ext)
      ) {
        newTasks.push({
          id: `task_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
          label: file.name,
          file,
          status: 'queued',
        });
      }
    }
    setQueue((prev) => [...prev, ...newTasks]);
  };

  const runQueue = async (onlyRetryErrors = false) => {
    if (!activeExam || !template || isRunning) return;
    cancelRef.current = false;
    pauseRef.current = false;
    setIsPaused(false);
    setIsRunning(true);
    const tStart = performance.now();

    const targetIds = new Set(
      queue
        .filter((t) => (onlyRetryErrors ? t.status === 'error' : t.status === 'queued'))
        .map((t) => t.id)
    );

    let currentPdfFile: File | null = null;
    let currentPdfDoc: Awaited<ReturnType<typeof getPdfPageCount>>['doc'] | null = null;

    try {
      for (const task of queue) {
        if (!targetIds.has(task.id)) continue;
        if (cancelRef.current) break;

        while (pauseRef.current && !cancelRef.current) {
          await new Promise((r) => setTimeout(r, 200));
        }
        if (cancelRef.current) break;

        setQueue((prev) =>
          prev.map((q) => (q.id === task.id ? { ...q, status: 'processing', message: undefined } : q))
        );

        let workCanvas: HTMLCanvasElement | null = null;
        try {
          if (task.pageNumber) {
            if (currentPdfFile !== task.file || !currentPdfDoc) {
              if (currentPdfDoc) await closePdfDocument(currentPdfDoc);
              const opened = await getPdfPageCount(task.file);
              currentPdfFile = task.file;
              currentPdfDoc = opened.doc;
            }
            workCanvas = await renderPdfPageToCanvas(currentPdfDoc, task.pageNumber, 2.0);
          } else {
            const dataUrl: string = await new Promise((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error('Lỗi đọc file ảnh'));
              reader.readAsDataURL(task.file);
            });
            const img = new Image();
            await new Promise<void>((resolve, reject) => {
              img.onload = () => resolve();
              img.onerror = () => reject(new Error('Ảnh không hợp lệ'));
              img.src = dataUrl;
            });
            workCanvas = document.createElement('canvas');
            workCanvas.width = img.naturalWidth;
            workCanvas.height = img.naturalHeight;
            workCanvas.getContext('2d')!.drawImage(img, 0, 0);
          }

          const origDataUrl = workCanvas.toDataURL('image/jpeg', 0.88);
          const results = await processSheetImageWithOpenCV(
            workCanvas,
            template,
            examKeys,
            settings
          );

          for (const res of results) {
            const now = Date.now();
            const matchedStudent = students.find(
              (st) => st.sbd && st.sbd === res.recognition.sbd
            );
            const origBlobId = `blob_orig_${now}_${Math.random().toString(36).slice(2, 6)}`;
            const warpBlobId = `blob_warp_${now}_${Math.random().toString(36).slice(2, 6)}`;
            await saveBlob(origBlobId, origDataUrl, 'image/jpeg');
            await saveBlob(warpBlobId, res.warpedDataUrl, 'image/jpeg');

            const sub: ExamSubmission = {
              id: `sub_${now}_${Math.random().toString(36).slice(2, 7)}`,
              examId: activeExam.id,
              templateId: template.id,
              examCode: res.recognition.examCode,
              sbd: res.recognition.sbd,
              phachCode: res.recognition.phachCode,
              studentId: matchedStudent?.id,
              pairedSlot: res.pairedSlot,
              sourceFileName: task.label,
              originalImageBlobId: origBlobId,
              warpedImageBlobId: warpBlobId,
              qualityMetrics: res.qualityMetrics,
              recognition: res.recognition,
              scoreBreakdown: res.scored.scoreBreakdown,
              status: res.status,
              reviewReasons: res.reviewReasons,
              editHistory: [],
              createdAt: now,
              updatedAt: now,
            };
            await upsertSubmission(sub);
          }

          const first = results[0];
          const anyReview = results.some((r) => r.status === 'needs_review');
          setQueue((prev) =>
            prev.map((q) =>
              q.id === task.id
                ? {
                    ...q,
                    status: anyReview ? 'needs_review' : 'done',
                    sbd: results.map((r) => r.recognition.sbd).join(' | '),
                    examCode: first?.recognition.examCode,
                    score: first?.scored.scoreBreakdown.total,
                    message: anyReview ? first?.reviewReasons[0] : undefined,
                  }
                : q
            )
          );
        } catch (err) {
          setQueue((prev) =>
            prev.map((q) =>
              q.id === task.id
                ? {
                    ...q,
                    status: 'error',
                    message: err instanceof Error ? err.message : 'Lỗi xử lý ảnh',
                  }
                : q
            )
          );
        } finally {
          if (workCanvas) releaseCanvasMemory(workCanvas);
          setElapsedMs(Math.round(performance.now() - tStart));
          await new Promise((r) => setTimeout(r, 10));
        }
      }
    } finally {
      if (currentPdfDoc) await closePdfDocument(currentPdfDoc);
      setIsRunning(false);
    }
  };

  const doneCount = queue.filter((q) => q.status === 'done' || q.status === 'needs_review').length;
  const errCount = queue.filter((q) => q.status === 'error').length;
  const queuedCount = queue.filter((q) => q.status === 'queued').length;
  const practiceMatchedCount = practiceResults.filter((r) => r.matchedExpected).length;

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Chấm hàng loạt PDF và Ảnh</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Đọc từng trang PDF · Tách phiếu ghép đôi A5 · Web Worker:{' '}
            {workerReady ? 'Sẵn sàng' : 'Chế độ luồng chính an toàn'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            value={selectedTplId}
            onChange={(e) => setSelectedTplId(e.target.value)}
            className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white max-w-[240px]"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>

          {!isRunning ? (
            <button
              type="button"
              onClick={() => runQueue(false)}
              disabled={!activeExam || queuedCount === 0 || opencvStatus !== 'ready'}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              Bắt đầu chấm ({queuedCount})
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  pauseRef.current = !pauseRef.current;
                  setIsPaused(pauseRef.current);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium"
              >
                {isPaused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {isPaused ? 'Tiếp tục' : 'Tạm dừng'}
              </button>
              <button
                type="button"
                onClick={() => {
                  cancelRef.current = true;
                }}
                className="px-3 py-2 rounded-md bg-[#DC2626] text-white text-xs font-medium"
              >
                Hủy hàng đợi
              </button>
            </>
          )}
        </div>
      </div>

      {/* Dropzone */}
      {activeExam ? (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragOver(false);
            if (e.dataTransfer.files.length) enqueueFiles(e.dataTransfer.files);
          }}
          onClick={() => fileInputRef.current?.click()}
          className={`border-2 border-dashed rounded-lg p-7 text-center cursor-pointer transition-colors ${
            dragOver
              ? 'border-[#2563EB] bg-blue-50/70'
              : 'border-slate-300 bg-white hover:border-[#2563EB]'
          }`}
        >
          <FileUp className="w-9 h-9 text-[#2563EB] mx-auto mb-2" />
          <div className="text-sm font-semibold text-[#1E293B]">
            Kéo thả nhiều tệp PDF, JPG, JPEG, PNG, WEBP vào đây hoặc nhấp để chọn
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Đang chấm cho kỳ kiểm tra: <strong>{activeExam.name}</strong> ({activeExam.subject})
          </p>
          <input
            ref={fileInputRef}
            type="file"
            multiple
            accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
            onChange={(e) => {
              if (e.target.files?.length) enqueueFiles(e.target.files);
              e.target.value = '';
            }}
            className="hidden"
          />
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-lg p-5 flex items-center justify-between gap-3">
          <div className="text-xs text-slate-600">
            Vui lòng chọn hoặc tạo kỳ kiểm tra để nạp tệp PDF/Ảnh bài thi chính thức.
          </div>
          <button
            type="button"
            onClick={() => setActivePage('exams')}
            className="px-3.5 py-2 bg-[#2563EB] text-white text-xs font-medium rounded-md shrink-0"
          >
            Chọn kỳ kiểm tra
          </button>
        </div>
      )}

      {/* Progress & Queue Table */}
      {queue.length > 0 && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="flex items-center gap-4">
              <span>
                Tiến độ: <strong className="font-mono-num">{doneCount}/{queue.length}</strong>
              </span>
              <span className="text-slate-500 font-mono-num">
                Thời gian: {(elapsedMs / 1000).toFixed(1)}s
              </span>
              {errCount > 0 && (
                <button
                  type="button"
                  onClick={() => runQueue(true)}
                  disabled={isRunning}
                  className="inline-flex items-center gap-1 text-[#2563EB] hover:underline font-medium"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Thử lại {errCount} trang lỗi
                </button>
              )}
            </div>
            <button
              type="button"
              onClick={() => setQueue([])}
              disabled={isRunning}
              className="inline-flex items-center gap-1 text-slate-500 hover:text-[#DC2626] disabled:opacity-40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Xóa danh sách
            </button>
          </div>

          <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-[#2563EB] transition-all"
              style={{
                width: `${queue.length ? Math.round((doneCount / queue.length) * 100) : 0}%`,
              }}
            />
          </div>

          <div className="overflow-x-auto max-h-[340px]">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2 px-3 font-semibold">Tài liệu / Trang</th>
                  <th className="py-2 px-3 font-semibold">SBD</th>
                  <th className="py-2 px-3 font-semibold">Mã đề</th>
                  <th className="py-2 px-3 font-semibold">Điểm</th>
                  <th className="py-2 px-3 font-semibold">Trạng thái</th>
                  <th className="py-2 px-3 font-semibold">Ghi chú</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((q) => (
                  <tr key={q.id}>
                    <td className="py-2 px-3 font-medium">{q.label}</td>
                    <td className="py-2 px-3 font-mono-num">{q.sbd || '—'}</td>
                    <td className="py-2 px-3 font-mono-num">{q.examCode || '—'}</td>
                    <td className="py-2 px-3 font-mono-num font-semibold">
                      {q.score !== undefined ? q.score : '—'}
                    </td>
                    <td className="py-2 px-3">
                      {q.status === 'done' && (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          Đã chấm
                        </span>
                      )}
                      {q.status === 'needs_review' && (
                        <span className="inline-flex items-center gap-1 text-amber-600 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Chờ kiểm duyệt
                        </span>
                      )}
                      {q.status === 'processing' && (
                        <span className="text-[#2563EB] font-medium">Đang nhận dạng...</span>
                      )}
                      {q.status === 'queued' && <span className="text-slate-400">Chờ xử lý</span>}
                      {q.status === 'error' && (
                        <span className="inline-flex items-center gap-1 text-[#DC2626] font-medium">
                          <XCircle className="w-3.5 h-3.5" />
                          Lỗi
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 text-slate-500">{q.message || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Built-in 135 Practice Sheets OMR Testbed */}
      <div className="bg-white border border-slate-200 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold text-[#1E293B] flex items-center gap-2">
              <FlaskConical className="w-4 h-4 text-[#2563EB]" />
              Bộ 225 phiếu bài thi thực hành để thử nghiệm OpenCV OMR
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              45 phiếu/kỳ cho cả 5 kỳ kiểm tra (tô chuẩn, sai, bỏ trống, tô nhiều, tô mờ, tẩy xóa, xoay 90°, nghiêng 5°, thiếu sáng, bóng đổ, sai mã đề). Chấm thử chạy trực tiếp qua bộ máy nhận dạng ảnh OpenCV.js thật.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <select
              value={practiceSubset}
              onChange={(e) => setPracticeSubset(e.target.value)}
              disabled={practiceBusy || pdfGenerating}
              className="px-2.5 py-2 text-xs border border-slate-300 rounded-md bg-white"
            >
              <option value="exam_prac_toan12">Toán 12 – Lớp 12A5 (45 phiếu)</option>
              <option value="exam_prac_ly11">Vật lý 11 – Lớp 11A2 (45 phiếu)</option>
              <option value="exam_prac_hoa10">Hóa học 10 – Lớp 10A1 (45 phiếu)</option>
              <option value="exam_prac_tin12">Tin học 12 – Lớp 12A5 (45 phiếu)</option>
              <option value="exam_prac_anh11">Tiếng Anh 11 – Lớp 11A2 (45 phiếu)</option>
              <option value="all_225">Toàn bộ 5 kỳ (225 phiếu)</option>
            </select>

            <button
              type="button"
              onClick={handleDownloadPracticePdf}
              disabled={pdfGenerating || practiceBusy}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-md border border-slate-300 bg-white text-xs font-medium text-[#1E293B] hover:bg-slate-50 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {pdfGenerating ? 'Đang xuất PDF...' : 'Tải bộ phiếu thực hành'}
            </button>

            <button
              type="button"
              onClick={handleRunPracticeTestGrading}
              disabled={practiceBusy || opencvStatus !== 'ready'}
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[38px] rounded-md bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Play className="w-4 h-4" />
              {practiceBusy ? 'Đang chấm OpenCV...' : `Chấm thử (${selectedPracticeSheets.length} phiếu)`}
            </button>
          </div>
        </div>

        {practiceProgress && (
          <div className="space-y-1.5 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">
                Tiến độ nhận dạng OpenCV.js:{' '}
                <strong className="font-mono-num">
                  {practiceProgress.done}/{practiceProgress.total}
                </strong>
              </span>
              {practiceResults.length > 0 && (
                <span className="font-mono-num font-semibold text-[#16A34A]">
                  Khớp kỳ vọng: {practiceMatchedCount}/{practiceResults.length} (
                  {Math.round((practiceMatchedCount / practiceResults.length) * 100)}%)
                </span>
              )}
            </div>
            <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#16A34A] transition-all"
                style={{
                  width: `${
                    practiceProgress.total
                      ? Math.round((practiceProgress.done / practiceProgress.total) * 100)
                      : 0
                  }%`,
                }}
              />
            </div>
          </div>
        )}

        {practiceResults.length > 0 && (
          <div className="overflow-x-auto max-h-[320px] border border-slate-200 rounded-md">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-slate-600">
                  <th className="py-2 px-3 font-semibold">SBD</th>
                  <th className="py-2 px-3 font-semibold">Học sinh</th>
                  <th className="py-2 px-3 font-semibold">Tình huống ảnh</th>
                  <th className="py-2 px-3 font-semibold">Nhận diện SBD / Mã</th>
                  <th className="py-2 px-3 font-semibold text-right">Điểm OpenCV</th>
                  <th className="py-2 px-3 font-semibold text-right">Điểm kỳ vọng</th>
                  <th className="py-2 px-3 font-semibold text-center">Trạng thái</th>
                  <th className="py-2 px-3 font-semibold text-right">Tốc độ</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {practiceResults.map((r) => (
                  <tr key={r.sheet.id}>
                    <td className="py-2 px-3 font-mono-num">{r.sheet.sbd}</td>
                    <td className="py-2 px-3 font-medium">{r.sheet.studentName}</td>
                    <td className="py-2 px-3 text-slate-600">{r.sheet.scenarioLabel}</td>
                    <td className="py-2 px-3 font-mono-num">
                      {r.detectedSbd} / {r.detectedExamCode}
                    </td>
                    <td className="py-2 px-3 font-mono-num font-bold text-right text-[#2563EB]">
                      {r.omrScore}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-right text-slate-600">
                      {r.expectedScore}
                    </td>
                    <td className="py-2 px-3 text-center">
                      {r.matchedExpected ? (
                        <span className="inline-flex items-center gap-1 text-[#16A34A] font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          {r.status === 'needs_review' ? 'Bắt kiểm duyệt' : 'Khớp'}
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-amber-700 font-medium">
                          <AlertTriangle className="w-3.5 h-3.5" />
                          Cần xem
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono-num text-right text-slate-500">
                      {r.durationMs} ms
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

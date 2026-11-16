import React, { useEffect, useMemo, useRef, useState } from 'react';
import JSZip from 'jszip';
import {
  Download,
  FileArchive,
  Printer,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getBlob } from '../db/database';
import { computeCompetitionRanks, computeExamAnalytics } from '../engine/scoring';
import {
  generateObjectiveComment,
  renderAnnotatedReportCardPdf,
} from '../engine/sheetRenderer';

export const ReportCardsPage: React.FC = () => {
  const { activeExam, templates, students, submissions, setActivePage } = useApp();
  const [selectedSubId, setSelectedSubId] = useState<string | null>(null);
  const [showRanking, setShowRanking] = useState(false);
  const [showCorrectAnswers, setShowCorrectAnswers] = useState(true);
  const [showComment, setShowComment] = useState(true);
  const [warpedUrl, setWarpedUrl] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const examSubs = useMemo(() => {
    if (!activeExam) return [];
    return submissions.filter(
      (s) => s.examId === activeExam.id && s.status === 'graded' && !s.isTestSample
    );
  }, [submissions, activeExam]);

  const current = useMemo(() => {
    if (selectedSubId) {
      const found = examSubs.find((s) => s.id === selectedSubId);
      if (found) return found;
    }
    return examSubs[0] || null;
  }, [examSubs, selectedSubId]);

  const studentById = useMemo(() => new Map(students.map((s) => [s.id, s])), [students]);
  const studentBySbd = useMemo(() => new Map(students.map((s) => [s.sbd, s])), [students]);

  const ranks = useMemo(() => computeCompetitionRanks(examSubs), [examSubs]);
  const analytics = useMemo(() => {
    if (!activeExam) return null;
    return computeExamAnalytics(
      examSubs,
      students,
      activeExam.id,
      activeExam.passThreshold,
      activeExam.scoreScale
    );
  }, [examSubs, students, activeExam]);

  useEffect(() => {
    if (!current) {
      setWarpedUrl(null);
      return;
    }
    getBlob(current.warpedImageBlobId).then((b) => setWarpedUrl(b?.dataUrl || null));
  }, [current]);

  // Draw live annotated canvas preview using exact canonical coordinates
  useEffect(() => {
    const canvas = previewCanvasRef.current;
    if (!canvas || !current || !warpedUrl) return;
    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      for (const q of current.recognition.questions) {
        for (const b of q.bubbles) {
          const bx = b.cx * canvas.width;
          const by = b.cy * canvas.height;
          const br = Math.max(8, b.rx * canvas.width * 1.25);

          if (q.status === 'correct' && b.option === q.detectedValue) {
            ctx.beginPath();
            ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#16A34A';
            ctx.lineWidth = 3;
            ctx.stroke();
          } else if (q.status === 'wrong') {
            if (b.option === q.detectedValue) {
              ctx.strokeStyle = '#DC2626';
              ctx.lineWidth = 2.8;
              ctx.beginPath();
              ctx.moveTo(bx - br, by - br);
              ctx.lineTo(bx + br, by + br);
              ctx.moveTo(bx + br, by - br);
              ctx.lineTo(bx - br, by + br);
              ctx.stroke();
            }
            if (showCorrectAnswers && b.option === q.correctValue) {
              ctx.beginPath();
              ctx.arc(bx + br * 1.8, by, br * 0.55, 0, Math.PI * 2);
              ctx.fillStyle = '#16A34A';
              ctx.fill();
            }
          } else if (q.status === 'blank' && showCorrectAnswers && b.option === q.correctValue) {
            ctx.strokeStyle = '#2563EB';
            ctx.lineWidth = 2.2;
            ctx.strokeRect(bx - br, by - br, br * 2, br * 2);
          } else if (
            (q.status === 'multi_mark' || q.status === 'faint' || q.status === 'erased') &&
            b.isMarked
          ) {
            ctx.beginPath();
            ctx.arc(bx, by, br + 2, 0, Math.PI * 2);
            ctx.strokeStyle = '#D97706';
            ctx.lineWidth = 2.8;
            ctx.stroke();
          }
        }
      }
    };
    img.src = warpedUrl;
  }, [current, warpedUrl, showCorrectAnswers]);

  const template = templates.find((t) => t.id === activeExam?.templateId) || templates[0];

  const handleDownloadSinglePdf = async () => {
    if (!current || !activeExam || !template) return;
    setBusy(true);
    try {
      const st =
        (current.studentId ? studentById.get(current.studentId) : undefined) ||
        studentBySbd.get(current.sbd);
      const bytes = await renderAnnotatedReportCardPdf(
        [
          {
            submission: current,
            student: st,
            warpedImageDataUrl: warpedUrl || undefined,
            rank: ranks.get(current.id),
          },
        ],
        activeExam,
        template,
        {
          showRanking,
          showCorrectAnswers,
          showComment,
          classAverage: analytics?.mean ?? 0,
          rank: ranks.get(current.id),
          totalGraded: examSubs.length,
        }
      );
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu_tra_bai_${current.sbd || current.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handleExportAllPdf = async () => {
    if (!activeExam || !template || examSubs.length === 0) return;
    setBusy(true);
    try {
      const items = await Promise.all(
        examSubs.map(async (sub) => {
          const b = await getBlob(sub.warpedImageBlobId);
          const st =
            (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
            studentBySbd.get(sub.sbd);
          return {
            submission: sub,
            student: st,
            warpedImageDataUrl: b?.dataUrl,
            rank: ranks.get(sub.id),
          };
        })
      );
      const bytes = await renderAnnotatedReportCardPdf(items, activeExam, template, {
        showRanking,
        showCorrectAnswers,
        showComment,
        classAverage: analytics?.mean ?? 0,
        totalGraded: examSubs.length,
      });
      const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu_tra_bai_ca_lop_${activeExam.subject}.pdf`.replace(/\s+/g, '_');
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
  };

  const handleExportZip = async () => {
    if (!activeExam || !template || examSubs.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const sub of examSubs) {
        const b = await getBlob(sub.warpedImageBlobId);
        const st =
          (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
          studentBySbd.get(sub.sbd);
        const bytes = await renderAnnotatedReportCardPdf(
          [
            {
              submission: sub,
              student: st,
              warpedImageDataUrl: b?.dataUrl,
              rank: ranks.get(sub.id),
            },
          ],
          activeExam,
          template,
          {
            showRanking,
            showCorrectAnswers,
            showComment,
            classAverage: analytics?.mean ?? 0,
            rank: ranks.get(sub.id),
            totalGraded: examSubs.length,
          }
        );
        const fileName = `${sub.sbd || sub.id}_${(st?.fullName || 'hoc_sinh').replace(/\s+/g, '_')}.pdf`;
        zip.file(fileName, bytes);
      }
      const zipBlob = await zip.generateAsync({ type: 'blob' });
      const url = URL.createObjectURL(zipBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `phieu_tra_bai_${activeExam.subject}.zip`.replace(/\s+/g, '_');
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setBusy(false);
    }
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

  const currentStudent = current
    ? (current.studentId ? studentById.get(current.studentId) : undefined) ||
      studentBySbd.get(current.sbd)
    : undefined;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Phiếu trả bài PDF</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Vẽ lớp chú thích đúng/sai trực tiếp theo tọa độ chuẩn lên ảnh bài thi, hỗ trợ xuất PDF tiếng Việt & ZIP cả lớp.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => window.print()}
            disabled={!current}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <Printer className="w-4 h-4" />
            In phiếu này
          </button>
          <button
            type="button"
            onClick={handleDownloadSinglePdf}
            disabled={!current || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Tải PDF học sinh
          </button>
          <button
            type="button"
            onClick={handleExportAllPdf}
            disabled={examSubs.length === 0 || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            Xuất PDF cả lớp
          </button>
          <button
            type="button"
            onClick={handleExportZip}
            disabled={examSubs.length === 0 || busy}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50 disabled:opacity-50"
          >
            <FileArchive className="w-4 h-4" />
            Tải ZIP ({examSubs.length})
          </button>
        </div>
      </div>

      {/* Visibility Options */}
      <div className="no-print bg-white border border-slate-200 rounded-lg p-3 flex flex-wrap items-center gap-5 text-xs">
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showRanking}
            onChange={(e) => setShowRanking(e.target.checked)}
          />
          Hiển thị thứ hạng trên phiếu
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showCorrectAnswers}
            onChange={(e) => setShowCorrectAnswers(e.target.checked)}
          />
          Hiển thị đáp án đúng
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={showComment}
            onChange={(e) => setShowComment(e.target.checked)}
          />
          Hiển thị nhận xét dựa trên dữ liệu chấm
        </label>
      </div>

      {examSubs.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
          Chưa có bài thi đã duyệt để tạo phiếu trả bài.
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Student List */}
          <div className="no-print lg:col-span-3 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[680px] overflow-y-auto">
            {examSubs.map((sub) => {
              const st =
                (sub.studentId ? studentById.get(sub.studentId) : undefined) ||
                studentBySbd.get(sub.sbd);
              const active = current?.id === sub.id;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubId(sub.id)}
                  className={`w-full text-left p-3 ${
                    active ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span>{st?.fullName || `SBD ${sub.sbd}`}</span>
                    <span className="font-mono-num text-[#2563EB]">{sub.scoreBreakdown.total}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                    SBD: {sub.sbd} · Lớp: {st?.className || '—'} · Mã: {sub.examCode}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Live Annotated Report Card Preview */}
          {current && (
            <div className="lg:col-span-9 bg-white border border-slate-200 rounded-lg p-5 space-y-4">
              <div className="border border-slate-200 rounded-md p-3.5 bg-slate-50/70 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-bold text-sm text-[#1E293B]">
                    {activeExam.schoolName} — {activeExam.name}
                  </div>
                  <div className="text-slate-600 mt-0.5">
                    Học sinh: <strong>{currentStudent?.fullName || '(Chưa đối chiếu)'}</strong> · SBD:{' '}
                    <span className="font-mono-num">{current.sbd}</span> · Lớp:{' '}
                    {currentStudent?.className || '—'} · Mã đề:{' '}
                    <span className="font-mono-num">{current.examCode}</span>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-bold font-mono-num text-[#16A34A]">
                    {current.scoreBreakdown.total} / {current.scoreBreakdown.maxPossible}
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    ĐTB lớp: {analytics?.mean ?? '—'}
                    {showRanking && ranks.get(current.id)
                      ? ` · Hạng ${ranks.get(current.id)}/${examSubs.length}`
                      : ''}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-7 bg-slate-100 rounded p-2 flex justify-center">
                  <canvas
                    ref={previewCanvasRef}
                    className="max-w-full h-auto bg-white border border-slate-300"
                    style={{ maxHeight: '560px', width: 'auto' }}
                  />
                </div>
                <div className="md:col-span-5 space-y-3 text-xs">
                  <div className="font-semibold text-[#1E293B]">Bảng chi tiết bài làm</div>
                  <div className="max-h-[420px] overflow-y-auto border border-slate-200 rounded">
                    <table className="w-full text-left border-collapse text-[11px]">
                      <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                          <th className="py-1.5 px-2">Câu</th>
                          <th className="py-1.5 px-2">Chọn</th>
                          <th className="py-1.5 px-2">Đáp án</th>
                          <th className="py-1.5 px-2">Kết quả</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 font-mono-num">
                        {current.recognition.questions.map((q, i) => (
                          <tr key={i}>
                            <td className="py-1 px-2">
                              {q.part === 'part1'
                                ? `I.${q.question}`
                                : q.part === 'part2'
                                ? `II.${q.question}${q.subItem}`
                                : `III.${q.question}`}
                            </td>
                            <td className="py-1 px-2 font-semibold">{q.detectedValue || '—'}</td>
                            <td className="py-1 px-2">
                              {showCorrectAnswers ? q.correctValue || '—' : '***'}
                            </td>
                            <td
                              className={`py-1 px-2 font-sans font-medium ${
                                q.status === 'correct'
                                  ? 'text-[#16A34A]'
                                  : q.status === 'wrong'
                                  ? 'text-[#DC2626]'
                                  : 'text-slate-500'
                              }`}
                            >
                              {q.status === 'correct'
                                ? 'Đúng'
                                : q.status === 'wrong'
                                ? 'Sai'
                                : 'Trống'}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {showComment && (
                    <div className="p-3 rounded bg-slate-50 border border-slate-200">
                      <div className="font-semibold text-[#1E293B] mb-1">Nhận xét</div>
                      <p className="text-slate-600 leading-relaxed">
                        {generateObjectiveComment(current)}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

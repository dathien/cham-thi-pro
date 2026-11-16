import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  History,
  RefreshCw,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { getBlob } from '../db/database';
import { scoreRecognitionAgainstKey } from '../engine/scoring';
import type { ExamSubmission, QuestionRecognition, ReviewEditEntry } from '../types/omr';

export const ReviewPage: React.FC = () => {
  const {
    activeExam,
    templates,
    answerKeys,
    submissions,
    students,
    focusedReviewId,
    setFocusedReviewId,
    upsertSubmission,
    setActivePage,
  } = useApp();

  const [filterMode, setFilterMode] = useState<'needs_review' | 'all'>('needs_review');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [imageTab, setImageTab] = useState<'warped' | 'original'>('warped');
  const [warpedUrl, setWarpedUrl] = useState<string | null>(null);
  const [originalUrl, setOriginalUrl] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState<{ x: number; y: number } | null>(null);

  const [editSbd, setEditSbd] = useState('');
  const [editCode, setEditCode] = useState('');
  const [editTemplateId, setEditTemplateId] = useState('');
  const [editReason, setEditReason] = useState('');
  const [draftQuestions, setDraftQuestions] = useState<QuestionRecognition[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Sync deep-link from Gradebook or Overview
  useEffect(() => {
    if (!focusedReviewId) return;
    const target = submissions.find((s) => s.id === focusedReviewId);
    if (target) {
      if (target.status === 'graded') setFilterMode('all');
      else setFilterMode('needs_review');
      setSelectedId(target.id);
    }
    setFocusedReviewId(null);
  }, [focusedReviewId, submissions, setFocusedReviewId]);

  const list = useMemo(() => {
    return submissions.filter((s) => {
      if (s.isTestSample) return false;
      if (activeExam && s.examId !== activeExam.id) return false;
      if (filterMode === 'needs_review') return s.status !== 'graded';
      return true;
    });
  }, [submissions, activeExam, filterMode]);

  const current: ExamSubmission | null = useMemo(() => {
    if (selectedId) {
      const found = list.find((s) => s.id === selectedId);
      if (found) return found;
    }
    return list[0] || null;
  }, [list, selectedId]);

  useEffect(() => {
    if (!current) {
      setWarpedUrl(null);
      setOriginalUrl(null);
      return;
    }
    setEditSbd(current.sbd);
    setEditCode(current.examCode);
    setEditTemplateId(current.templateId);
    setDraftQuestions(structuredClone(current.recognition.questions));
    setZoom(1);
    setPan({ x: 0, y: 0 });

    getBlob(current.warpedImageBlobId).then((b) => setWarpedUrl(b?.dataUrl || null));
    getBlob(current.originalImageBlobId).then((b) => setOriginalUrl(b?.dataUrl || null));
  }, [current]);

  // Draw sheet image + highlight suspicious / multi-mark / faint / erased / graded bubbles
  useEffect(() => {
    const activeUrl = imageTab === 'warped' ? warpedUrl : originalUrl;
    const canvas = canvasRef.current;
    if (!canvas || !activeUrl || !current) return;

    const img = new Image();
    img.onload = () => {
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);

      if (imageTab === 'warped') {
        for (const q of draftQuestions) {
          const isSuspect =
            q.status === 'multi_mark' ||
            q.status === 'faint' ||
            q.status === 'erased' ||
            q.status === 'unrecognized';

          for (const b of q.bubbles) {
            const x = b.cx * canvas.width;
            const y = b.cy * canvas.height;
            const r = Math.max(8, b.rx * canvas.width * 1.3);

            if (isSuspect && (b.isMarked || b.fillRatio >= 0.18 || b.ringRatio >= 0.2)) {
              ctx.beginPath();
              ctx.arc(x, y, r + 3, 0, Math.PI * 2);
              ctx.strokeStyle = '#F59E0B';
              ctx.lineWidth = 3;
              ctx.stroke();
            } else if (q.status === 'correct' && b.option === q.detectedValue) {
              ctx.beginPath();
              ctx.arc(x, y, r + 2, 0, Math.PI * 2);
              ctx.strokeStyle = '#16A34A';
              ctx.lineWidth = 2.4;
              ctx.stroke();
            } else if (q.status === 'wrong' && b.option === q.detectedValue) {
              ctx.beginPath();
              ctx.arc(x, y, r + 2, 0, Math.PI * 2);
              ctx.strokeStyle = '#DC2626';
              ctx.lineWidth = 2.4;
              ctx.stroke();
            }
          }
        }
      }
    };
    img.src = activeUrl;
  }, [warpedUrl, originalUrl, imageTab, current, draftQuestions]);

  const updateQuestionManual = (
    idx: number,
    nextValue: string,
    nextStatus: QuestionRecognition['status']
  ) => {
    setDraftQuestions((prev) =>
      prev.map((q, i) =>
        i === idx ? { ...q, detectedValue: nextValue, status: nextStatus } : q
      )
    );
  };

  const handleConfirmAndRegrade = async (confirmFinal: boolean) => {
    if (!current || !activeExam) return;
    const matchedKey = answerKeys.find(
      (k) => k.examId === activeExam.id && k.examCode.trim() === editCode.trim()
    );
    const matchedStudent = students.find((st) => st.sbd && st.sbd === editSbd.trim());

    const prepared = draftQuestions.map((q) => {
      if (
        q.status === 'correct' ||
        q.status === 'wrong' ||
        q.status === 'blank' ||
        q.status === 'pending_review'
      ) {
        return {
          ...q,
          status: (q.detectedValue ? 'pending_review' : 'blank') as QuestionRecognition['status'],
        };
      }
      return q;
    });

    const scored = scoreRecognitionAgainstKey(prepared, matchedKey);
    const remainingIssues: string[] = [];
    if (!matchedKey) remainingIssues.push(`Chưa có đáp án mã đề "${editCode}"`);
    if (editSbd.includes('?')) remainingIssues.push(`SBD chưa rõ (${editSbd})`);
    const unresolvedQs = scored.questions.filter(
      (q) =>
        q.status === 'multi_mark' ||
        q.status === 'faint' ||
        q.status === 'erased' ||
        q.status === 'unrecognized'
    );
    if (unresolvedQs.length > 0) {
      remainingIssues.push(`Còn ${unresolvedQs.length} câu chưa xác nhận`);
    }

    const reasonText = editReason.trim() || 'Giáo viên kiểm duyệt và xác nhận thủ công';
    const historyEntry: ReviewEditEntry = {
      timestamp: Date.now(),
      field: 'Kiểm duyệt bài thi',
      oldValue: `SBD:${current.sbd} | Mã:${current.examCode} | Điểm:${current.scoreBreakdown.total}`,
      newValue: `SBD:${editSbd} | Mã:${editCode} | Điểm:${scored.scoreBreakdown.total}`,
      reason: reasonText,
    };

    const updated: ExamSubmission = {
      ...current,
      templateId: editTemplateId,
      sbd: editSbd.trim(),
      examCode: editCode.trim(),
      studentId: matchedStudent?.id,
      recognition: {
        ...current.recognition,
        sbd: editSbd.trim(),
        examCode: editCode.trim(),
        questions: scored.questions,
      },
      scoreBreakdown: scored.scoreBreakdown,
      status:
        confirmFinal && matchedKey && remainingIssues.length === 0
          ? 'graded'
          : 'needs_review',
      reviewReasons: remainingIssues,
      editHistory: [historyEntry, ...current.editHistory],
      updatedAt: Date.now(),
    };

    await upsertSubmission(updated);
    setEditReason('');
    setNotice(
      updated.status === 'graded'
        ? `Đã xác nhận kết quả cuối cùng: SBD ${updated.sbd} – ${updated.scoreBreakdown.total} điểm.`
        : `Đã cập nhật và chấm lại (${remainingIssues.join('; ')}).`
    );
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Kiểm duyệt bài thi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Phóng to kiểm tra ô tô, xem mật độ tô từng ô và xác nhận các câu nghi ngờ (ảnh gốc được bảo toàn).
          </p>
        </div>

        <div className="flex items-center gap-1 p-1 bg-slate-200/70 rounded-md w-fit">
          <button
            type="button"
            onClick={() => setFilterMode('needs_review')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filterMode === 'needs_review' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
            }`}
          >
            Cần kiểm duyệt
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1.5 rounded text-xs font-medium ${
              filterMode === 'all' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
            }`}
          >
            Tất cả bài thi
          </button>
        </div>
      </div>

      {notice && (
        <div className="px-3.5 py-2 rounded bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      )}

      {list.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-lg p-8 text-center text-xs text-slate-500">
          {filterMode === 'needs_review'
            ? 'Không có bài thi nào đang chờ kiểm duyệt.'
            : 'Chưa có bài thi nào trong kỳ kiểm tra này.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Left: Queue List */}
          <div className="lg:col-span-3 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
            {list.map((item) => {
              const active = current?.id === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setSelectedId(item.id)}
                  className={`w-full text-left p-3 transition-colors ${
                    active ? 'bg-blue-50/80' : 'hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="font-mono-num">SBD: {item.sbd || '???'}</span>
                    <span
                      className={`font-mono-num ${
                        item.status === 'graded' ? 'text-[#16A34A]' : 'text-amber-600'
                      }`}
                    >
                      {item.scoreBreakdown.total} đ
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5 truncate">
                    Mã đề: {item.examCode || '???'} · {item.sourceFileName || 'Ảnh'}
                  </div>
                  {item.reviewReasons.length > 0 && (
                    <div className="text-[11px] text-[#DC2626] mt-1 truncate">
                      {item.reviewReasons[0]}
                    </div>
                  )}
                </button>
              );
            })}
          </div>

          {/* Center: Zoom & Pan Image Canvas */}
          <div className="lg:col-span-5 bg-slate-900 rounded-lg p-3 flex flex-col gap-2 min-h-[540px]">
            <div className="flex items-center justify-between gap-2 text-xs text-white">
              <div className="flex gap-1">
                <button
                  type="button"
                  onClick={() => setImageTab('warped')}
                  className={`px-2.5 py-1 rounded ${
                    imageTab === 'warped' ? 'bg-[#2563EB]' : 'bg-slate-800'
                  }`}
                >
                  Ảnh đã hiệu chỉnh + đánh dấu
                </button>
                <button
                  type="button"
                  onClick={() => setImageTab('original')}
                  className={`px-2.5 py-1 rounded ${
                    imageTab === 'original' ? 'bg-[#2563EB]' : 'bg-slate-800'
                  }`}
                >
                  Ảnh gốc
                </button>
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.max(0.5, z - 0.25))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700"
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono-num w-11 text-center">{Math.round(zoom * 100)}%</span>
                <button
                  type="button"
                  onClick={() => setZoom((z) => Math.min(3, z + 0.25))}
                  className="p-1.5 rounded bg-slate-800 hover:bg-slate-700"
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div
              className="flex-1 overflow-hidden relative bg-slate-950 rounded flex items-center justify-center cursor-grab active:cursor-grabbing"
              onMouseDown={(e) => setDragging({ x: e.clientX - pan.x, y: e.clientY - pan.y })}
              onMouseMove={(e) => {
                if (dragging) setPan({ x: e.clientX - dragging.x, y: e.clientY - dragging.y });
              }}
              onMouseUp={() => setDragging(null)}
              onMouseLeave={() => setDragging(null)}
            >
              <canvas
                ref={canvasRef}
                style={{
                  transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                  transformOrigin: 'center center',
                }}
                className="max-w-full max-h-[620px] object-contain"
              />
            </div>
          </div>

          {/* Right: Recognition Details & Bubble Density Inspection */}
          {current && (
            <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-4 max-h-[700px] overflow-y-auto text-xs">
              {current.reviewReasons.length > 0 && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="flex items-center gap-1 font-semibold">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    Vấn đề cần kiểm tra:
                  </div>
                  {current.reviewReasons.map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Số báo danh</label>
                  <input
                    type="text"
                    value={editSbd}
                    onChange={(e) => setEditSbd(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block font-medium text-slate-700 mb-1">Mã đề</label>
                  <input
                    type="text"
                    value={editCode}
                    onChange={(e) => setEditCode(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div className="col-span-2">
                  <label className="block font-medium text-slate-700 mb-1">Mẫu phiếu áp dụng</label>
                  <select
                    value={editTemplateId}
                    onChange={(e) => setEditTemplateId(e.target.value)}
                    className="w-full px-2.5 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    {templates.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <div className="font-semibold text-[#1E293B]">
                  Chi tiết câu trả lời & mật độ tô ({draftQuestions.length})
                </div>
                <div className="space-y-1.5 max-h-[290px] overflow-y-auto pr-1">
                  {draftQuestions.map((q, idx) => {
                    const isIssue =
                      q.status === 'multi_mark' ||
                      q.status === 'faint' ||
                      q.status === 'erased' ||
                      q.status === 'unrecognized';
                    const bubbleSummary =
                      q.part === 'part1' || q.part === 'part2'
                        ? q.bubbles
                            .map((b) => `${b.option}:${Math.round(b.fillRatio * 100)}%`)
                            .join(' ')
                        : '';
                    return (
                      <div
                        key={`${q.part}_${q.question}_${q.subItem || ''}`}
                        className={`p-2 rounded border ${
                          isIssue
                            ? 'border-amber-300 bg-amber-50/70'
                            : 'border-slate-200 bg-slate-50/40'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-semibold font-mono-num">
                            {q.part === 'part1'
                              ? `P.I Câu ${q.question}`
                              : q.part === 'part2'
                              ? `P.II C${q.question}.${q.subItem}`
                              : `P.III Câu ${q.question}`}
                          </span>
                          <span className="text-[11px] text-slate-500">
                            {q.status === 'correct'
                              ? 'Đúng'
                              : q.status === 'wrong'
                              ? 'Sai'
                              : q.status === 'blank'
                              ? 'Bỏ trống'
                              : q.status === 'multi_mark'
                              ? 'Tô nhiều'
                              : q.status === 'faint'
                              ? 'Tô mờ'
                              : q.status === 'erased'
                              ? 'Tẩy xóa'
                              : 'Cần xác nhận'}
                          </span>
                        </div>
                        {bubbleSummary && (
                          <div className="text-[10px] font-mono-num text-slate-500 mt-0.5">
                            Mật độ ô: {bubbleSummary}
                          </div>
                        )}
                        {q.note && <div className="text-[11px] text-amber-800 mt-0.5">{q.note}</div>}

                        {q.part === 'part1' && (
                          <div className="flex flex-wrap gap-1 mt-1.5">
                            {['A', 'B', 'C', 'D'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => updateQuestionManual(idx, opt, 'pending_review')}
                                className={`px-2 py-0.5 rounded text-[11px] font-medium ${
                                  q.detectedValue === opt
                                    ? 'bg-[#2563EB] text-white'
                                    : 'bg-white border border-slate-300'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQuestionManual(idx, '', 'blank')}
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                q.status === 'blank'
                                  ? 'bg-slate-700 text-white'
                                  : 'bg-white border border-slate-300'
                              }`}
                            >
                              Trống
                            </button>
                            <button
                              type="button"
                              onClick={() => updateQuestionManual(idx, '', 'multi_mark')}
                              className={`px-2 py-0.5 rounded text-[11px] ${
                                q.status === 'multi_mark'
                                  ? 'bg-[#DC2626] text-white'
                                  : 'bg-white border border-slate-300'
                              }`}
                            >
                              Tô nhiều
                            </button>
                          </div>
                        )}

                        {q.part === 'part2' && (
                          <div className="flex gap-1 mt-1.5">
                            {['Đ', 'S'].map((opt) => (
                              <button
                                key={opt}
                                type="button"
                                onClick={() => updateQuestionManual(idx, opt, 'pending_review')}
                                className={`px-2.5 py-0.5 rounded text-[11px] font-medium ${
                                  q.detectedValue === opt
                                    ? 'bg-[#2563EB] text-white'
                                    : 'bg-white border border-slate-300'
                                }`}
                              >
                                {opt}
                              </button>
                            ))}
                            <button
                              type="button"
                              onClick={() => updateQuestionManual(idx, '', 'blank')}
                              className="px-2 py-0.5 rounded text-[11px] bg-white border border-slate-300"
                            >
                              Trống
                            </button>
                          </div>
                        )}

                        {q.part === 'part3' && (
                          <input
                            type="text"
                            value={q.detectedValue}
                            onChange={(e) =>
                              updateQuestionManual(
                                idx,
                                e.target.value,
                                e.target.value ? 'pending_review' : 'blank'
                              )
                            }
                            placeholder="Nhập đáp án số..."
                            className="mt-1.5 w-full px-2 py-1 border border-slate-300 rounded font-mono-num"
                          />
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  placeholder="Lý do điều chỉnh (tùy chọn)..."
                  className="w-full px-2.5 py-1.5 border border-slate-300 rounded"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleConfirmAndRegrade(false)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded border border-slate-300 hover:bg-slate-50 font-medium"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    Chấm lại
                  </button>
                  <button
                    type="button"
                    onClick={() => handleConfirmAndRegrade(true)}
                    className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded bg-[#16A34A] text-white hover:bg-green-700 font-medium"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Xác nhận cuối
                  </button>
                </div>
              </div>

              {current.editHistory.length > 0 && (
                <div className="pt-2 border-t border-slate-100 space-y-1">
                  <div className="flex items-center gap-1 font-semibold text-slate-700">
                    <History className="w-3.5 h-3.5" />
                    Lịch sử kiểm duyệt
                  </div>
                  {current.editHistory.map((h, i) => (
                    <div key={i} className="text-[11px] text-slate-500">
                      {new Date(h.timestamp).toLocaleString('vi-VN')} · {h.newValue} ({h.reason})
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

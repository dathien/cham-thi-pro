import React, { useMemo, useRef, useState } from 'react';
import * as XLSX from 'xlsx';
import {
  AlertTriangle,
  Camera,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  History,
  Plus,
  RefreshCw,
  Upload,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { processSheetImageWithOpenCV } from '../engine/omrEngine';
import { computeAnswerKeyMaxScore, scoreRecognitionAgainstKey } from '../engine/scoring';
import type { AnswerKey, Part2AnswerMap, Part2SubKey } from '../types/omr';

function createEmptyAnswerKey(
  examId: string,
  examCode: string,
  templateId: string,
  p1: number,
  p2: number,
  p3: number
): AnswerKey {
  const part1Answers: Record<number, string> = {};
  for (let i = 1; i <= p1; i++) part1Answers[i] = '';
  const part2Answers: Record<number, Part2AnswerMap> = {};
  for (let i = 1; i <= p2; i++) part2Answers[i] = { a: null, b: null, c: null, d: null };
  const part3Answers: Record<number, string[]> = {};
  for (let i = 1; i <= p3; i++) part3Answers[i] = [];

  const p1Pts = p1 > 0 && p2 === 0 && p3 === 0 ? Math.round((10 / p1) * 1000) / 1000 : 0.25;
  return {
    id: `ak_${examId}_${examCode}`,
    examId,
    examCode,
    templateId,
    part1Count: p1,
    part1PointsPerQ: p1Pts,
    part1Answers,
    part2Count: p2,
    part2ScoringMode: 'progressive_2025',
    part2Progressive: [0, 0.1, 0.25, 0.5, 1.0],
    part2CustomPerItem: 0.25,
    part2Answers,
    part3Count: p3,
    part3PointsPerQ: 0.5,
    part3AllowDotComma: true,
    part3AllowTolerance: false,
    part3Tolerance: 0,
    part3RoundingMode: 'exact',
    part3Answers,
    history: [],
    updatedAt: Date.now(),
  };
}

export const AnswerKeysPage: React.FC = () => {
  const {
    exams,
    activeExam,
    setActiveExamId,
    templates,
    answerKeys,
    submissions,
    settings,
    upsertExam,
    upsertAnswerKey,
    upsertSubmission,
    setActivePage,
  } = useApp();

  const fileRef = useRef<HTMLInputElement>(null);
  const omrKeyFileRef = useRef<HTMLInputElement>(null);

  const [subjectFilter, setSubjectFilter] = useState<string>('all');
  const filteredExams = useMemo(
    () =>
      subjectFilter === 'all'
        ? exams
        : exams.filter((e) => e.subject === subjectFilter),
    [exams, subjectFilter]
  );
  const distinctSubjects = useMemo(
    () => Array.from(new Set(exams.map((e) => e.subject).filter(Boolean))),
    [exams]
  );

  const template = templates.find((t) => t.id === activeExam?.templateId) || templates[0];
  const examCodes = activeExam?.examCodes || ['101'];
  const [selectedCode, setSelectedCode] = useState<string>(examCodes[0] || '101');
  const [generateCount, setGenerateCount] = useState(4);
  const [pasteText, setPasteText] = useState('');
  const [showPasteBox, setShowPasteBox] = useState(false);
  const [copySourceCode, setCopySourceCode] = useState('');
  const [editReason, setEditReason] = useState('');
  const [notice, setNotice] = useState<string | null>(null);

  React.useEffect(() => {
    if (activeExam && !activeExam.examCodes.includes(selectedCode)) {
      setSelectedCode(activeExam.examCodes[0] || '101');
    }
  }, [activeExam, selectedCode]);

  const existingAk = useMemo(() => {
    if (!activeExam) return null;
    return (
      answerKeys.find(
        (k) => k.examId === activeExam.id && k.examCode === selectedCode
      ) || null
    );
  }, [activeExam, answerKeys, selectedCode]);

  const [draft, setDraft] = useState<AnswerKey | null>(null);

  React.useEffect(() => {
    if (!activeExam || !template) {
      setDraft(null);
      return;
    }
    if (existingAk) {
      setDraft(structuredClone(existingAk));
    } else {
      setDraft(
        createEmptyAnswerKey(
          activeExam.id,
          selectedCode,
          template.id,
          template.part1Count,
          template.part2Count,
          template.part3Count
        )
      );
    }
  }, [activeExam, template, selectedCode, existingAk]);

  if (!activeExam || !template) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3">
        <h2 className="text-base font-semibold">Chưa có kỳ kiểm tra đang chọn</h2>
        <p className="text-xs text-slate-500">
          Vui lòng tạo hoặc chọn một kỳ kiểm tra trước khi nhập đáp án.
        </p>
        <button
          type="button"
          onClick={() => setActivePage('exams')}
          className="px-4 py-2 bg-[#2563EB] text-white text-xs font-medium rounded-md"
        >
          Đi tới Quản lý kỳ kiểm tra
        </button>
      </div>
    );
  }

  const handleTemplateSwitch = async (nextTplId: string) => {
    const nextTpl = templates.find((t) => t.id === nextTplId);
    if (!nextTpl) return;
    await upsertExam({ ...activeExam, templateId: nextTplId, updatedAt: Date.now() });
    if (draft) {
      setDraft({
        ...draft,
        templateId: nextTplId,
        part1Count: nextTpl.part1Count,
        part2Count: nextTpl.part2Count,
        part3Count: nextTpl.part3Count,
      });
    }
    setNotice(`Đã cập nhật mẫu phiếu "${nextTpl.name}" cho kỳ thi.`);
  };

  const handleScaleChange = async (nextScale: number) => {
    const clean = Math.max(1, Math.min(100, nextScale || 10));
    await upsertExam({ ...activeExam, scoreScale: clean, updatedAt: Date.now() });
  };

  const handleGenerateCodes = async () => {
    const n = Math.max(1, Math.min(24, generateCount));
    const newCodes = Array.from({ length: n }, (_, i) => String(101 + i));
    await upsertExam({ ...activeExam, examCodes: newCodes, updatedAt: Date.now() });
    setSelectedCode(newCodes[0]);
    setNotice(`Đã tạo ${n} mã đề (${newCodes.join(', ')}).`);
  };

  const maxScore = draft ? computeAnswerKeyMaxScore(draft) : 0;
  const maxScoreMismatch = Math.abs(maxScore - activeExam.scoreScale) > 0.05;

  const handleSave = async (regradeExisting = false) => {
    if (!draft) return;
    const isModifiedAfterGrading = submissions.some(
      (s) => s.examId === activeExam.id && s.examCode === draft.examCode && !s.isTestSample
    );
    const updated: AnswerKey = {
      ...draft,
      updatedAt: Date.now(),
      history: isModifiedAfterGrading
        ? [
            {
              timestamp: Date.now(),
              reason: editReason.trim() || 'Cập nhật đáp án / thang điểm',
              changedBy: activeExam.teacherName || 'Giáo viên',
            },
            ...draft.history,
          ]
        : draft.history,
    };
    await upsertAnswerKey(updated);

    if (regradeExisting) {
      const targetSubs = submissions.filter(
        (s) => s.examId === activeExam.id && s.examCode === updated.examCode && !s.isTestSample
      );
      for (const sub of targetSubs) {
        const scored = scoreRecognitionAgainstKey(sub.recognition.questions, updated);
        await upsertSubmission({
          ...sub,
          recognition: { ...sub.recognition, questions: scored.questions },
          scoreBreakdown: scored.scoreBreakdown,
          updatedAt: Date.now(),
        });
      }
      setNotice(
        `Đã lưu đáp án mã đề ${updated.examCode} và chấm lại ${targetSubs.length} bài thi.`
      );
    } else {
      setNotice(`Đã lưu đáp án mã đề ${updated.examCode} (Tổng điểm tối đa: ${maxScore}).`);
    }
    setEditReason('');
  };

  const applyPastedTokens = (raw: string) => {
    if (!draft) return;
    const tokens = raw
      .toUpperCase()
      .replace(/\d+\s*[.:)\-]/g, ' ')
      .match(/[ABCD]/g);
    if (!tokens || tokens.length === 0) {
      setNotice('Không tìm thấy ký tự đáp án A, B, C, D hợp lệ trong nội dung dán.');
      return;
    }
    const nextP1 = { ...draft.part1Answers };
    for (let i = 0; i < Math.min(draft.part1Count, tokens.length); i++) {
      nextP1[i + 1] = tokens[i];
    }
    setDraft({ ...draft, part1Answers: nextP1 });
    setShowPasteBox(false);
    setPasteText('');
    setNotice(
      `Đã điền ${Math.min(draft.part1Count, tokens.length)} đáp án Phần I từ văn bản dán.`
    );
  };

  const handleClipboardPaste = async () => {
    try {
      if (navigator.clipboard?.readText) {
        const text = await navigator.clipboard.readText();
        if (text.trim()) {
          applyPastedTokens(text);
          return;
        }
      }
    } catch {
      // Fallback to inline textarea
    }
    setShowPasteBox((v) => !v);
  };

  const handleImportExcel = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    try {
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      const nextP1 = { ...draft.part1Answers };
      let count = 0;
      for (const r of rows) {
        const qVal = Number(r['Câu'] ?? r['Cau'] ?? r['Question'] ?? Object.values(r)[0]);
        const ansVal = String(
          r['Đáp án'] ?? r['Dap an'] ?? r['Answer'] ?? Object.values(r)[1] ?? ''
        )
          .trim()
          .toUpperCase();
        if (qVal >= 1 && qVal <= draft.part1Count && ['A', 'B', 'C', 'D'].includes(ansVal)) {
          nextP1[qVal] = ansVal;
          count++;
        }
      }
      setDraft({ ...draft, part1Answers: nextP1 });
      setNotice(`Đã nhập ${count} đáp án từ file "${file.name}".`);
    } finally {
      e.target.value = '';
    }
  };

  const handleExportExcel = () => {
    if (!draft) return;
    const wb = XLSX.utils.book_new();
    const p1Rows: (string | number)[][] = [['Câu', 'Đáp án', 'Điểm']];
    for (let q = 1; q <= draft.part1Count; q++) {
      p1Rows.push([q, draft.part1Answers[q] || '', draft.part1PointsPerQ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p1Rows), 'Phan_I');

    if (draft.part2Count > 0) {
      const p2Rows: (string | number)[][] = [['Câu', 'Ý a', 'Ý b', 'Ý c', 'Ý d']];
      for (let q = 1; q <= draft.part2Count; q++) {
        const m = draft.part2Answers[q];
        p2Rows.push([
          q,
          m?.a === true ? 'Đ' : m?.a === false ? 'S' : '',
          m?.b === true ? 'Đ' : m?.b === false ? 'S' : '',
          m?.c === true ? 'Đ' : m?.c === false ? 'S' : '',
          m?.d === true ? 'Đ' : m?.d === false ? 'S' : '',
        ]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p2Rows), 'Phan_II');
    }

    if (draft.part3Count > 0) {
      const p3Rows: (string | number)[][] = [['Câu', 'Đáp án đúng', 'Điểm']];
      for (let q = 1; q <= draft.part3Count; q++) {
        p3Rows.push([q, (draft.part3Answers[q] || []).join(' | '), draft.part3PointsPerQ]);
      }
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(p3Rows), 'Phan_III');
    }

    XLSX.writeFile(wb, `dap_an_${activeExam.subject}_ma_${draft.examCode}.xlsx`.replace(/\s+/g, '_'));
    setNotice(`Đã xuất đáp án mã đề ${draft.examCode} ra file Excel.`);
  };

  const handleImportOmrAnswerSheet = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !draft) return;
    try {
      const reader = new FileReader();
      const dataUrl: string = await new Promise((res) => {
        reader.onload = () => res(String(reader.result));
        reader.readAsDataURL(file);
      });
      const results = await processSheetImageWithOpenCV(dataUrl, template, [], settings);
      if (results.length > 0) {
        const rec = results[0].recognition;
        const nextP1 = { ...draft.part1Answers };
        const nextP2 = { ...draft.part2Answers };
        const nextP3 = { ...draft.part3Answers };
        for (const q of rec.questions) {
          if (q.part === 'part1' && q.detectedValue) nextP1[q.question] = q.detectedValue;
          if (q.part === 'part2' && q.subItem && q.detectedValue) {
            nextP2[q.question] = {
              ...(nextP2[q.question] || { a: null, b: null, c: null, d: null }),
              [q.subItem]: q.detectedValue === 'Đ' ? true : q.detectedValue === 'S' ? false : null,
            };
          }
          if (q.part === 'part3' && q.detectedValue) nextP3[q.question] = [q.detectedValue];
        }
        setDraft({ ...draft, part1Answers: nextP1, part2Answers: nextP2, part3Answers: nextP3 });
        setNotice(
          `Đã quét đáp án từ ảnh phiếu tô (Mã đề nhận diện: ${rec.examCode}). Hãy kiểm tra lại trước khi lưu!`
        );
      }
    } catch (err) {
      setNotice(err instanceof Error ? err.message : 'Không quét được phiếu đáp án.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCopyFromCode = () => {
    if (!draft || !copySourceCode) return;
    const src = answerKeys.find(
      (k) => k.examId === activeExam.id && k.examCode === copySourceCode
    );
    if (!src) {
      setNotice(`Mã đề ${copySourceCode} chưa có đáp án để sao chép.`);
      return;
    }
    setDraft({
      ...structuredClone(src),
      id: `ak_${activeExam.id}_${selectedCode}`,
      examCode: selectedCode,
      history: draft.history,
      updatedAt: Date.now(),
    });
    setNotice(`Đã sao chép đáp án từ mã đề ${copySourceCode} sang ${selectedCode}.`);
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Đáp án và thang điểm</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Chỉnh sửa trực tiếp trên màn hình cho từng mã đề, cấu hình Phần I / II / III và chấm lại bài hàng loạt.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2.5 py-1.5">
            <span className="text-xs text-slate-600">Tạo mã đề:</span>
            <input
              type="number"
              min={1}
              max={24}
              value={generateCount}
              onChange={(e) => setGenerateCount(Number(e.target.value) || 4)}
              className="w-12 px-1.5 py-1 text-xs border border-slate-300 rounded font-mono-num"
            />
            <button
              type="button"
              onClick={handleGenerateCodes}
              className="inline-flex items-center gap-1 px-2.5 py-1 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-900"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo nhiều mã
            </button>
          </div>
        </div>
      </div>

      {/* Inline Selector Bar: Kỳ kiểm tra, Môn học, Mẫu phiếu, Thang điểm */}
      <div className="bg-white border border-slate-200 rounded-lg p-3.5 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
        <div>
          <label className="block font-medium text-slate-600 mb-1">Môn học</label>
          <select
            value={subjectFilter}
            onChange={(e) => {
              const subj = e.target.value;
              setSubjectFilter(subj);
              if (subj !== 'all') {
                const match = exams.find((x) => x.subject === subj);
                if (match) setActiveExamId(match.id);
              }
            }}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
          >
            <option value="all">Tất cả môn học</option>
            {distinctSubjects.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Kỳ kiểm tra</label>
          <select
            value={activeExam.id}
            onChange={(e) => setActiveExamId(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white font-medium"
          >
            {filteredExams.map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.subject})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Mẫu phiếu</label>
          <select
            value={activeExam.templateId}
            onChange={(e) => handleTemplateSwitch(e.target.value)}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-md bg-white"
          >
            {templates.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block font-medium text-slate-600 mb-1">Thang điểm chuẩn</label>
          <input
            type="number"
            min={1}
            max={100}
            step="0.5"
            value={activeExam.scoreScale}
            onChange={(e) => handleScaleChange(Number(e.target.value))}
            className="w-full px-2.5 py-2 border border-slate-300 rounded-md font-mono-num"
          />
        </div>
      </div>

      {notice && (
        <div className="px-3.5 py-2.5 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between">
          <span>{notice}</span>
          <button type="button" onClick={() => setNotice(null)} className="underline">
            Đóng
          </button>
        </div>
      )}

      {/* Exam Code Tabs & Tools */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white border border-slate-200 rounded-lg p-3">
        <div className="flex flex-wrap gap-1.5">
          {examCodes.map((code) => {
            const hasSaved = answerKeys.some(
              (k) => k.examId === activeExam.id && k.examCode === code
            );
            const active = selectedCode === code;
            return (
              <button
                key={code}
                type="button"
                onClick={() => setSelectedCode(code)}
                className={`px-3 py-1.5 min-h-[34px] rounded-md text-xs font-mono-num font-semibold transition-colors ${
                  active
                    ? 'bg-[#2563EB] text-white'
                    : hasSaved
                    ? 'bg-emerald-50 text-[#16A34A] border border-emerald-200'
                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                }`}
              >
                Mã {code} {hasSaved ? '✓' : ''}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleClipboardPaste}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <ClipboardPaste className="w-3.5 h-3.5" />
            Dán clipboard / Nhập nhanh
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Upload className="w-3.5 h-3.5" />
            Nhập Excel
          </button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleImportExcel}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportExcel}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Download className="w-3.5 h-3.5" />
            Xuất Excel
          </button>
          <button
            type="button"
            onClick={() => omrKeyFileRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 min-h-[34px] text-xs border border-slate-300 rounded-md hover:bg-slate-50"
          >
            <Camera className="w-3.5 h-3.5" />
            Quét phiếu tô
          </button>
          <input
            ref={omrKeyFileRef}
            type="file"
            accept="image/*"
            onChange={handleImportOmrAnswerSheet}
            className="hidden"
          />
          {examCodes.length > 1 && (
            <div className="flex items-center gap-1">
              <select
                value={copySourceCode}
                onChange={(e) => setCopySourceCode(e.target.value)}
                className="px-2 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="">Sao chép từ mã...</option>
                {examCodes
                  .filter((c) => c !== selectedCode)
                  .map((c) => (
                    <option key={c} value={c}>
                      Mã {c}
                    </option>
                  ))}
              </select>
              <button
                type="button"
                onClick={handleCopyFromCode}
                className="p-1.5 border border-slate-300 rounded-md hover:bg-slate-50"
                title="Sao chép mã đề"
              >
                <Copy className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>

      {showPasteBox && (
        <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-2.5">
          <label className="block text-xs font-medium text-slate-700">
            Dán chuỗi đáp án Phần I (ví dụ: &quot;1.A 2.B 3.C 4.D&quot; hoặc &quot;A B C D A B...&quot;)
          </label>
          <textarea
            rows={3}
            value={pasteText}
            onChange={(e) => setPasteText(e.target.value)}
            className="w-full p-2.5 text-xs border border-slate-300 rounded-md font-mono-num"
            placeholder="1.A 2.B 3.C 4.D ..."
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowPasteBox(false)}
              className="px-3 py-1.5 text-xs border border-slate-300 rounded"
            >
              Đóng
            </button>
            <button
              type="button"
              onClick={() => applyPastedTokens(pasteText)}
              className="px-3 py-1.5 text-xs bg-[#2563EB] text-white rounded font-medium"
            >
              Áp dụng vào bảng
            </button>
          </div>
        </div>
      )}

      {draft && (
        <div className="space-y-4">
          {/* Total Score Check & Save Actions */}
          <div
            className={`px-4 py-3 rounded-lg border text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2 ${
              maxScoreMismatch
                ? 'bg-amber-50 border-amber-200 text-amber-900'
                : 'bg-emerald-50 border-emerald-200 text-emerald-900'
            }`}
          >
            <div className="flex items-center gap-2">
              {maxScoreMismatch && <AlertTriangle className="w-4 h-4 shrink-0" />}
              <span>
                Kiểm tra tổng điểm: <strong className="font-mono-num">{maxScore}</strong> / Thang điểm:{' '}
                <strong className="font-mono-num">{activeExam.scoreScale}</strong>
                {maxScoreMismatch && ' — Cần điều chỉnh điểm từng phần cho khớp thang điểm.'}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="text"
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                placeholder="Lý do chỉnh sửa..."
                className="px-2.5 py-1.5 text-xs border border-slate-300 rounded bg-white"
              />
              <button
                type="button"
                onClick={() => handleSave(false)}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 min-h-[34px] rounded bg-[#2563EB] text-white font-medium hover:bg-blue-700"
              >
                <Check className="w-3.5 h-3.5" />
                Lưu đáp án
              </button>
              <button
                type="button"
                onClick={() => handleSave(true)}
                className="inline-flex items-center gap-1 px-3.5 py-1.5 min-h-[34px] rounded bg-[#16A34A] text-white font-medium hover:bg-green-700"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Chấm lại bài
              </button>
            </div>
          </div>

          {/* Part I Table */}
          {draft.part1Count > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#1E293B]">
                  Phần I – Trắc nghiệm nhiều lựa chọn ({draft.part1Count} câu)
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  <span>Điểm mỗi câu đúng:</span>
                  <input
                    type="number"
                    step="0.05"
                    min={0}
                    value={draft.part1PointsPerQ}
                    onChange={(e) =>
                      setDraft({ ...draft, part1PointsPerQ: Number(e.target.value) || 0 })
                    }
                    className="w-20 px-2 py-1 border border-slate-300 rounded font-mono-num"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                {Array.from({ length: draft.part1Count }, (_, idx) => {
                  const q = idx + 1;
                  const val = draft.part1Answers[q] || '';
                  return (
                    <div
                      key={q}
                      className="flex items-center justify-between px-2.5 py-1.5 border border-slate-200 rounded bg-slate-50/50"
                    >
                      <span className="text-xs font-mono-num font-semibold text-slate-700 w-7">
                        {q}.
                      </span>
                      <div className="flex gap-1">
                        {['A', 'B', 'C', 'D'].map((opt) => (
                          <button
                            key={opt}
                            type="button"
                            onClick={() =>
                              setDraft({
                                ...draft,
                                part1Answers: { ...draft.part1Answers, [q]: opt },
                              })
                            }
                            className={`w-6 h-6 rounded text-[11px] font-semibold transition-colors ${
                              val === opt
                                ? 'bg-[#2563EB] text-white'
                                : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {opt}
                          </button>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Part II Table */}
          {draft.part2Count > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#1E293B]">
                  Phần II – Trắc nghiệm Đúng / Sai ({draft.part2Count} câu)
                </h2>
                <div className="flex items-center gap-2 text-xs">
                  <span>Cách tính điểm:</span>
                  <select
                    value={draft.part2ScoringMode}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        part2ScoringMode: e.target.value as 'progressive_2025' | 'custom',
                      })
                    }
                    className="px-2 py-1 border border-slate-300 rounded bg-white"
                  >
                    <option value="progressive_2025">
                      Lũy tiến 2025 (0,10 · 0,25 · 0,50 · 1,00)
                    </option>
                    <option value="custom">Tùy chỉnh theo từng ý đúng</option>
                  </select>
                  {draft.part2ScoringMode === 'custom' && (
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={draft.part2CustomPerItem}
                      onChange={(e) =>
                        setDraft({ ...draft, part2CustomPerItem: Number(e.target.value) || 0 })
                      }
                      className="w-20 px-2 py-1 border border-slate-300 rounded font-mono-num"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {Array.from({ length: draft.part2Count }, (_, idx) => {
                  const q = idx + 1;
                  const map = draft.part2Answers[q] || { a: null, b: null, c: null, d: null };
                  return (
                    <div key={q} className="border border-slate-200 rounded-md p-3 space-y-2">
                      <div className="text-xs font-semibold text-[#1E293B]">Câu {q}</div>
                      {(['a', 'b', 'c', 'd'] as Part2SubKey[]).map((sk) => {
                        const v = map[sk];
                        return (
                          <div key={sk} className="flex items-center justify-between text-xs">
                            <span className="font-mono-num text-slate-600">Ý {sk})</span>
                            <div className="flex gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    part2Answers: {
                                      ...draft.part2Answers,
                                      [q]: { ...map, [sk]: true },
                                    },
                                  })
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                                  v === true
                                    ? 'bg-[#16A34A] text-white'
                                    : 'border border-slate-300 text-slate-600'
                                }`}
                              >
                                Đúng
                              </button>
                              <button
                                type="button"
                                onClick={() =>
                                  setDraft({
                                    ...draft,
                                    part2Answers: {
                                      ...draft.part2Answers,
                                      [q]: { ...map, [sk]: false },
                                    },
                                  })
                                }
                                className={`px-2.5 py-1 rounded text-[11px] font-medium ${
                                  v === false
                                    ? 'bg-[#DC2626] text-white'
                                    : 'border border-slate-300 text-slate-600'
                                }`}
                              >
                                Sai
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Part III Table */}
          {draft.part3Count > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-[#1E293B]">
                  Phần III – Trả lời ngắn ({draft.part3Count} câu)
                </h2>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="flex items-center gap-1">
                    <span>Điểm/câu:</span>
                    <input
                      type="number"
                      step="0.05"
                      min={0}
                      value={draft.part3PointsPerQ}
                      onChange={(e) =>
                        setDraft({ ...draft, part3PointsPerQ: Number(e.target.value) || 0 })
                      }
                      className="w-16 px-2 py-1 border border-slate-300 rounded font-mono-num"
                    />
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.part3AllowDotComma}
                      onChange={(e) =>
                        setDraft({ ...draft, part3AllowDotComma: e.target.checked })
                      }
                    />
                    Chuẩn hóa dấu phẩy/chấm
                  </label>
                  <label className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={draft.part3AllowTolerance}
                      onChange={(e) =>
                        setDraft({ ...draft, part3AllowTolerance: e.target.checked })
                      }
                    />
                    Cho phép sai số
                  </label>
                  {draft.part3AllowTolerance && (
                    <input
                      type="number"
                      step="0.01"
                      min={0}
                      value={draft.part3Tolerance}
                      onChange={(e) =>
                        setDraft({ ...draft, part3Tolerance: Number(e.target.value) || 0 })
                      }
                      className="w-16 px-2 py-1 border border-slate-300 rounded font-mono-num"
                    />
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {Array.from({ length: draft.part3Count }, (_, idx) => {
                  const q = idx + 1;
                  const val = (draft.part3Answers[q] || []).join(' | ');
                  return (
                    <div key={q} className="border border-slate-200 rounded p-2.5">
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        Câu {q} (nhiều đáp án cách nhau bởi dấu | )
                      </label>
                      <input
                        type="text"
                        value={val}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            part3Answers: {
                              ...draft.part3Answers,
                              [q]: e.target.value
                                .split('|')
                                .map((s) => s.trim())
                                .filter(Boolean),
                            },
                          })
                        }
                        placeholder="Ví dụ: -1,5 | -1.5"
                        className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Edit History */}
          {draft.history.length > 0 && (
            <div className="bg-white border border-slate-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700 mb-2">
                <History className="w-4 h-4" />
                Lịch sử phiên bản đáp án
              </div>
              <div className="space-y-1 text-xs text-slate-600">
                {draft.history.map((h, i) => (
                  <div key={i}>
                    <span className="font-mono-num text-slate-500">
                      {new Date(h.timestamp).toLocaleString('vi-VN')}
                    </span>{' '}
                    — {h.reason} ({h.changedBy})
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

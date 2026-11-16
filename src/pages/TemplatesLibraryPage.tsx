import React, { useEffect, useRef, useState } from 'react';
import {
  CheckCircle2,
  Copy,
  Download,
  FileImage,
  PenTool,
  Play,
  Plus,
  Printer,
  ShieldAlert,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { processSheetImageWithOpenCV } from '../engine/omrEngine';
import {
  drawTemplateOnCanvas,
  generateBlankSheetPdf,
  type SimulatedMarkSpec,
} from '../engine/sheetRenderer';
import { buildTemplateFromSpec } from '../engine/templates';
import type { SheetTemplate, TemplateCategory } from '../types/omr';

const CATEGORY_TABS: { id: 'all' | TemplateCategory; label: string }[] = [
  { id: 'all', label: 'Tất cả mẫu' },
  { id: 'thpt2025', label: 'THPT từ 2025' },
  { id: 'traditional', label: 'Truyền thống (10–100 câu)' },
  { id: 'paired_a5', label: 'Ghép đôi A5' },
  { id: 'phach_a3', label: 'Rọc phách A3' },
  { id: 'custom', label: 'Mẫu tự thiết kế' },
];

export const TemplatesLibraryPage: React.FC = () => {
  const {
    templates,
    activeExam,
    answerKeys,
    settings,
    opencvStatus,
    upsertTemplate,
    upsertExam,
    setActivePage,
  } = useApp();
  const [catFilter, setCatFilter] = useState<'all' | TemplateCategory>('all');
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id || 'tpl_thpt2025_toan');
  const [customCount, setCustomCount] = useState(35);
  const [exporting, setExporting] = useState(false);
  const [showFilledPreview, setShowFilledPreview] = useState(false);
  const [testGradeMsg, setTestGradeMsg] = useState<string | null>(null);
  const [gradingTest, setGradingTest] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);

  const filtered = templates.filter((t) =>
    catFilter === 'all' ? true : t.category === catFilter
  );
  const selected = templates.find((t) => t.id === selectedId) || filtered[0] || templates[0];

  const buildSampleSimSpec = (tpl: SheetTemplate): SimulatedMarkSpec => {
    const matchedKey = activeExam
      ? answerKeys.find((k) => k.examId === activeExam.id && k.templateId === tpl.id) ||
        answerKeys.find((k) => k.examId === activeExam.id)
      : undefined;
    const opts = ['A', 'B', 'C', 'D'];
    const p1: Record<number, string> = {};
    for (let q = 1; q <= tpl.part1Count; q++) {
      p1[q] = matchedKey?.part1Answers[q] || opts[(q - 1) % 4];
    }
    const p2: Record<number, Partial<Record<'a' | 'b' | 'c' | 'd', 'Đ' | 'S'>>> = {};
    for (let q = 1; q <= tpl.part2Count; q++) {
      const m = matchedKey?.part2Answers[q];
      p2[q] = {
        a: m?.a === false ? 'S' : 'Đ',
        b: m?.b === false ? 'S' : 'Đ',
        c: m?.c === true ? 'Đ' : 'S',
        d: m?.d === true ? 'Đ' : 'S',
      };
    }
    const p3: Record<number, string> = {};
    for (let q = 1; q <= tpl.part3Count; q++) {
      p3[q] = (matchedKey?.part3Answers[q]?.[0] || '12,5').padEnd(4, ' ');
    }
    return {
      sbd: '120001',
      examCode: matchedKey?.examCode || activeExam?.examCodes[0] || '101',
      phachCode: tpl.phachDigits ? '10234' : undefined,
      part1: p1,
      part2: p2,
      part3: p3,
      pairedSlot2:
        tpl.category === 'paired_a5'
          ? { sbd: '120002', examCode: '102', part1: p1 }
          : undefined,
    };
  };

  useEffect(() => {
    if (!selected || !previewCanvasRef.current) return;
    drawTemplateOnCanvas(
      previewCanvasRef.current,
      selected,
      {
        schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
        examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
        subject: activeExam?.subject || 'Môn kiểm tra',
      },
      showFilledPreview ? buildSampleSimSpec(selected) : undefined
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeExam, showFilledPreview]);

  const handleDownloadPdf = async () => {
    if (!selected) return;
    setExporting(true);
    try {
      const pdfBytes = await generateBlankSheetPdf(selected, {
        schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
        examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
        subject: activeExam?.subject || 'Môn kiểm tra',
      });
      const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${selected.id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const handleDownloadPng = () => {
    if (!selected || !previewCanvasRef.current) return;
    const url = previewCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selected.id}${showFilledPreview ? '_da_to' : ''}.png`;
    a.click();
  };

  const handleGenerateFilledAndDownload = () => {
    if (!selected || !previewCanvasRef.current) return;
    setShowFilledPreview(true);
    drawTemplateOnCanvas(
      previewCanvasRef.current,
      selected,
      {
        schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
        examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
        subject: activeExam?.subject || 'Môn kiểm tra',
      },
      buildSampleSimSpec(selected)
    );
    const url = previewCanvasRef.current.toDataURL('image/png');
    const a = document.createElement('a');
    a.href = url;
    a.download = `phieu_mau_da_to_${selected.id}.png`;
    a.click();
    setTestGradeMsg(
      'Đã tạo & tải xuống ảnh PNG phiếu đã tô theo đúng tọa độ chuẩn. Bạn có thể bấm "Chấm thử OpenCV ngay" hoặc nạp vào mục Chấm PDF và ảnh.'
    );
  };

  const handleTestGradePreview = async () => {
    if (!selected || !previewCanvasRef.current || opencvStatus !== 'ready') return;
    setGradingTest(true);
    setShowFilledPreview(true);
    try {
      const canvas = document.createElement('canvas');
      drawTemplateOnCanvas(
        canvas,
        selected,
        {
          schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
          examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
          subject: activeExam?.subject || 'Môn kiểm tra',
        },
        buildSampleSimSpec(selected)
      );
      const keys = activeExam
        ? answerKeys.filter((k) => k.examId === activeExam.id)
        : [];
      const res = await processSheetImageWithOpenCV(canvas, selected, keys, settings);
      const first = res[0];
      setTestGradeMsg(
        `OpenCV.js đã nhận dạng xong (${res.length} bài trên ảnh): SBD=${first.recognition.sbd}, Mã đề=${first.recognition.examCode}, Định vị=${first.qualityMetrics.detectedFiducials}/4, Tổng điểm=${first.scored.scoreBreakdown.total} (${first.scored.scoreBreakdown.correctCount} câu đúng).`
      );
    } catch (err) {
      setTestGradeMsg(err instanceof Error ? err.message : 'Lỗi chấm thử OpenCV');
    } finally {
      setGradingTest(false);
    }
  };

  const handlePrint = async () => {
    if (!selected) return;
    const pdfBytes = await generateBlankSheetPdf(selected, {
      schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
      examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
      subject: activeExam?.subject || 'Môn kiểm tra',
    });
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    document.body.appendChild(iframe);
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => {
        document.body.removeChild(iframe);
        URL.revokeObjectURL(url);
      }, 4000);
    };
  };

  const handleCreateCustomTrad = async () => {
    const q = Math.max(5, Math.min(120, customCount));
    const tpl = buildTemplateFromSpec({
      id: `tpl_custom_trad_${q}_${Date.now()}`,
      name: `Phiếu truyền thống tùy chỉnh ${q} câu`,
      category: 'custom',
      paperSize: 'A4',
      orientation: 'portrait',
      sbdDigits: 6,
      examCodeDigits: 3,
      part1Count: q,
      part2Count: 0,
      part3Count: 0,
      isBuiltIn: false,
      isOfficialVerified: true,
      compatibilityNote: `Mẫu truyền thống tùy chỉnh ${q} câu.`,
    });
    await upsertTemplate(tpl);
    setSelectedId(tpl.id);
    setCatFilter('custom');
  };

  const handleToggleVerified = async (tpl: SheetTemplate) => {
    await upsertTemplate({
      ...tpl,
      isOfficialVerified: !tpl.isOfficialVerified,
      updatedAt: Date.now(),
    });
  };

  const handleApplyToExam = async () => {
    if (!activeExam || !selected) return;
    await upsertExam({ ...activeExam, templateId: selected.id, updatedAt: Date.now() });
    setTestGradeMsg(`Đã gán mẫu "${selected.name}" cho kỳ kiểm tra "${activeExam.name}".`);
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-bold text-[#1E293B]">Thư viện mẫu phiếu thi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Đầy đủ mẫu 10–100 câu, THPT từ 2025, phiếu A4 ghép đôi A5, phiếu A3 rọc phách và trình tạo phiếu tùy chỉnh.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 bg-white border border-slate-200 rounded-md px-2 py-1">
            <span className="text-xs text-slate-600">Số câu tùy chỉnh:</span>
            <input
              type="number"
              min={5}
              max={120}
              value={customCount}
              onChange={(e) => setCustomCount(Number(e.target.value) || 30)}
              className="w-14 px-1.5 py-1 text-xs border border-slate-300 rounded font-mono-num"
            />
            <button
              type="button"
              onClick={handleCreateCustomTrad}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-slate-800 text-white rounded text-xs font-medium hover:bg-slate-900"
            >
              <Plus className="w-3.5 h-3.5" />
              Tạo nhanh
            </button>
          </div>
          <button
            type="button"
            onClick={() => setActivePage('designer')}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 min-h-[38px] rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
          >
            <PenTool className="w-4 h-4" />
            Mở trình thiết kế phiếu
          </button>
        </div>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex flex-wrap gap-1 p-1 bg-slate-200/70 rounded-lg w-fit">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setCatFilter(tab.id)}
            className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors whitespace-nowrap ${
              catFilter === tab.id
                ? 'bg-white text-[#1E293B] shadow-sm'
                : 'text-slate-600 hover:text-[#1E293B]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Template List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[700px] overflow-y-auto">
          {filtered.map((tpl) => {
            const isSel = selected?.id === tpl.id;
            const isUsed = activeExam?.templateId === tpl.id;
            return (
              <button
                key={tpl.id}
                type="button"
                onClick={() => {
                  setSelectedId(tpl.id);
                  setTestGradeMsg(null);
                }}
                className={`w-full text-left p-3.5 transition-colors ${
                  isSel ? 'bg-blue-50/70' : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="font-semibold text-xs text-[#1E293B]">{tpl.name}</div>
                  {isUsed && (
                    <span className="text-[11px] font-medium text-[#16A34A] whitespace-nowrap">
                      Đang dùng
                    </span>
                  )}
                </div>
                <div className="text-[11px] text-slate-500 mt-1">
                  {tpl.paperSize} ({tpl.orientation === 'portrait' ? 'Dọc' : 'Ngang'}) · P.I: {tpl.part1Count} · P.II: {tpl.part2Count} · P.III: {tpl.part3Count} · SBD {tpl.sbdDigits} số
                </div>
                <div className="mt-1.5 flex items-center gap-1.5 text-[11px]">
                  {tpl.isOfficialVerified ? (
                    <span className="inline-flex items-center gap-1 text-[#16A34A]">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      Đã đối chiếu tương thích
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-amber-700">
                      <ShieldAlert className="w-3.5 h-3.5" />
                      Cần đối chiếu mẫu in thực tế
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        {/* Live Canonical Preview & Actions */}
        {selected && (
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-lg p-4 space-y-3.5">
            <div className="border-b border-slate-100 pb-3 space-y-2.5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h2 className="text-sm font-bold text-[#1E293B]">{selected.name}</h2>
                  <div className="text-[11px] text-slate-500 font-mono-num">
                    ID: {selected.id} · Phiên bản {selected.version} · {selected.widthPx}×{selected.heightPx}px
                  </div>
                </div>
                <div className="flex items-center gap-1.5 text-xs">
                  <button
                    type="button"
                    onClick={() => setShowFilledPreview((v) => !v)}
                    className={`px-2.5 py-1.5 rounded border text-xs font-medium ${
                      showFilledPreview
                        ? 'bg-blue-50 border-[#2563EB] text-[#2563EB]'
                        : 'border-slate-300 text-slate-600'
                    }`}
                  >
                    {showFilledPreview ? 'Đang xem: Phiếu đã tô' : 'Xem thử: Phiếu trống'}
                  </button>
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {activeExam && activeExam.templateId !== selected.id && (
                  <button
                    type="button"
                    onClick={handleApplyToExam}
                    className="px-3 py-1.5 min-h-[36px] rounded-md bg-[#16A34A] text-white text-xs font-medium hover:bg-green-700"
                  >
                    Chọn sử dụng
                  </button>
                )}
                <button
                  type="button"
                  onClick={handleDownloadPdf}
                  disabled={exporting}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
                >
                  <Download className="w-3.5 h-3.5" />
                  {exporting ? 'Đang tạo PDF...' : 'Tải PDF'}
                </button>
                <button
                  type="button"
                  onClick={handleDownloadPng}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <FileImage className="w-3.5 h-3.5" />
                  Tải PNG
                </button>
                <button
                  type="button"
                  onClick={handlePrint}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Printer className="w-3.5 h-3.5" />
                  In phiếu
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    const copy: SheetTemplate = {
                      ...selected,
                      id: `tpl_copy_${Date.now()}`,
                      name: `${selected.name} (Bản sao)`,
                      isBuiltIn: false,
                      createdAt: Date.now(),
                      updatedAt: Date.now(),
                    };
                    await upsertTemplate(copy);
                    setSelectedId(copy.id);
                    setActivePage('designer');
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-50"
                >
                  <Copy className="w-3.5 h-3.5" />
                  Sao chép & sửa
                </button>
                <button
                  type="button"
                  onClick={handleGenerateFilledAndDownload}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md bg-slate-800 text-white text-xs font-medium hover:bg-slate-900"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Tạo phiếu đã tô để thử chấm
                </button>
                <button
                  type="button"
                  onClick={handleTestGradePreview}
                  disabled={gradingTest || opencvStatus !== 'ready'}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 min-h-[36px] rounded-md border border-emerald-300 bg-emerald-50 text-[#16A34A] text-xs font-medium hover:bg-emerald-100 disabled:opacity-50"
                >
                  <Play className="w-3.5 h-3.5" />
                  {gradingTest ? 'Đang chấm...' : 'Chấm thử OpenCV ngay'}
                </button>
              </div>
            </div>

            {testGradeMsg && (
              <div className="p-3 rounded-md bg-blue-50 border border-blue-200 text-xs text-blue-900 flex items-center justify-between gap-2">
                <span>{testGradeMsg}</span>
                <button
                  type="button"
                  onClick={() => setTestGradeMsg(null)}
                  className="underline shrink-0"
                >
                  Đóng
                </button>
              </div>
            )}

            <div className="p-3 rounded-md bg-slate-50 border border-slate-200 text-xs text-slate-700 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="leading-relaxed">{selected.compatibilityNote}</p>
              <button
                type="button"
                onClick={() => handleToggleVerified(selected)}
                className="shrink-0 px-2.5 py-1.5 rounded border border-slate-300 bg-white text-[11px] font-medium hover:bg-slate-100"
              >
                {selected.isOfficialVerified ? 'Bỏ xác nhận đối chiếu' : 'Xác nhận đã đối chiếu bản in'}
              </button>
            </div>

            <div className="bg-slate-100 rounded-md p-3 flex justify-center overflow-auto max-h-[540px]">
              <canvas
                ref={previewCanvasRef}
                className="max-w-full h-auto shadow-sm bg-white border border-slate-200"
                style={{ maxHeight: '500px', width: 'auto' }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

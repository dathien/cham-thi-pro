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
  Search,
  Upload,
  ZoomIn,
  ZoomOut,
  Maximize2,
  Minimize2,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { processSheetImageWithOpenCV } from '../engine/omrEngine';
import {
  drawTemplateOnCanvas,
  generateBlankSheetPdf,
  type SimulatedMarkSpec,
} from '../engine/sheetRenderer';
import { buildTemplateFromSpec, validateThpt2025Template } from '../engine/templates';
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
  const [searchText, setSearchText] = useState('');
  const [detecting, setDetecting] = useState(false);
  const [detectMessage, setDetectMessage] = useState('');
  const [detectMatches, setDetectMatches] = useState<{ id: string; name: string; fiducials: number; code: string; sbd: string }[]>([]);
  const detectFileRef = useRef<HTMLInputElement>(null);
  const [catFilter, setCatFilter] = useState<'all' | TemplateCategory>('all');
  const [selectedId, setSelectedId] = useState<string>(templates[0]?.id || 'tpl_thpt2025_toan');
  const [customCount, setCustomCount] = useState(35);
  const [exporting, setExporting] = useState(false);
  const [showFilledPreview, setShowFilledPreview] = useState(false);
  const [testGradeMsg, setTestGradeMsg] = useState<string | null>(null);
  const [gradingTest, setGradingTest] = useState(false);
  const previewCanvasRef = useRef<HTMLCanvasElement>(null);
  const fullscreenCanvasRef = useRef<HTMLCanvasElement>(null);
  const [zoom, setZoom] = useState(100);
  const [fullscreenPreview, setFullscreenPreview] = useState(false);
  const [hideTemplateList, setHideTemplateList] = useState(false);
  const [fitPreview, setFitPreview] = useState(true);
  const previewScrollRef = useRef<HTMLDivElement>(null);

  const filtered = templates.filter((t) =>
    (catFilter === 'all' || t.category === catFilter) &&
    `${t.name} ${t.id} ${t.paperSize} ${t.part1Count}`.toLocaleLowerCase('vi')
      .includes(searchText.trim().toLocaleLowerCase('vi'))
  );
  const selected = templates.find((t) => t.id === selectedId) || filtered[0] || templates[0];
  const templateIssues = selected ? validateThpt2025Template(selected) : [];

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
    if (!selected) return;
    for (const canvas of [previewCanvasRef.current, fullscreenCanvasRef.current]) {
      if (!canvas) continue;
      drawTemplateOnCanvas(
        canvas,
        selected,
        {
          schoolName: activeExam?.schoolName || 'TRƯỜNG THPT',
          examName: activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM',
          subject: activeExam?.subject || 'Môn kiểm tra',
        },
        showFilledPreview ? buildSampleSimSpec(selected) : undefined
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selected, activeExam, showFilledPreview, fullscreenPreview]);

  const handleDetectTemplate = async (file: File) => {
    if (opencvStatus !== 'ready') {
      setDetectMessage('OpenCV chưa sẵn sàng. Vui lòng đợi tải bộ máy nhận dạng.');
      return;
    }
    if (!file.type.startsWith('image/')) {
      setDetectMessage('Hãy chọn ảnh JPG, PNG hoặc WEBP. PDF nhiều trang được xử lý tại mục Chấm PDF/Ảnh.');
      return;
    }
    setDetecting(true);
    setDetectMatches([]);
    setDetectMessage('Đang kiểm tra các mẫu đã đăng ký. Chưa có kết quả chấm chính thức.');
    let url = '';
    try {
      url = URL.createObjectURL(file);
      const img = new Image();
      img.src = url;
      await img.decode();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
      canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
      canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
      canvas.getContext('2d')!.drawImage(img, 0, 0, canvas.width, canvas.height);
      const matches: { id: string; name: string; fiducials: number; code: string; sbd: string }[] = [];
      for (const tpl of templates) {
        try {
          const result = await processSheetImageWithOpenCV(canvas, tpl, [], settings);
          if (result.length && result.every(r => r.qualityMetrics.detectedFiducials === 4)) {
            matches.push({
              id: tpl.id,
              name: tpl.name,
              fiducials: Math.min(...result.map(r => r.qualityMetrics.detectedFiducials)),
              code: result[0].recognition.examCode,
              sbd: result[0].recognition.sbd,
            });
          }
        } catch {
          // Mẫu không tương thích: tiếp tục kiểm tra các mẫu khác.
        }
      }
      setDetectMatches(matches);
      setDetectMessage(matches.length === 0
        ? 'Không tìm thấy mẫu có đủ bốn điểm định vị. Hãy chọn mẫu thủ công hoặc thiết kế mẫu mới.'
        : matches.length === 1
          ? 'Tìm thấy một mẫu ứng viên. Kiểm tra ảnh phiếu và mã đề trước khi chọn sử dụng.'
          : `Có ${matches.length} mẫu cùng đạt điều kiện định vị. Chưa thể tự kết luận: hãy kiểm tra và chọn đúng mẫu.`);
    } catch (err) {
      setDetectMessage(err instanceof Error ? err.message : 'Không đọc được ảnh.');
    } finally {
      if (url) URL.revokeObjectURL(url);
      setDetecting(false);
      if (detectFileRef.current) detectFileRef.current.value = '';
    }
  };

  useEffect(() => {
    if (!fullscreenPreview) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setFullscreenPreview(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [fullscreenPreview]);

  const changeZoom = (next: number) => {
    setFitPreview(false);
    setZoom(Math.max(50, Math.min(250, next)));
  };

  const previewTools = (large: boolean) => (
    <div className="flex flex-wrap items-center gap-2" aria-label="Điều khiển xem mẫu phiếu">
      <button type="button" onClick={() => changeZoom(zoom - 25)} aria-label="Thu nhỏ"
        className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100"><ZoomOut className="h-4 w-4" /></button>
      <span className="min-w-[54px] text-center text-sm font-semibold tabular-nums">{fitPreview ? 'Vừa khung' : `${zoom}%`}</span>
      <button type="button" onClick={() => changeZoom(zoom + 25)} aria-label="Phóng to"
        className="rounded-lg border border-slate-300 p-2 hover:bg-slate-100"><ZoomIn className="h-4 w-4" /></button>
      <button type="button" onClick={() => { setFitPreview(true); setZoom(100); }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">Vừa khung</button>
      <button type="button" onClick={() => { setFitPreview(false); setZoom(100); }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">100%</button>
      <button type="button" onClick={() => { setFitPreview(false); setZoom(150); }}
        className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-100">150%</button>
      <button type="button" onClick={() => setFullscreenPreview(!large)}
        className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700">
        {large ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
        {large ? 'Đóng xem lớn' : 'Xem lớn'}
      </button>
    </div>
  );

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

      <section className="rounded-xl border border-blue-200 bg-blue-50/60 p-4 space-y-3" aria-label="Kiểm tra mẫu phiếu từ ảnh">
        <div>
          <h2 className="text-base font-bold text-slate-900">Kiểm tra mẫu phiếu từ ảnh</h2>
          <p className="text-sm leading-relaxed text-slate-700 mt-1">
            Tải ảnh phiếu để đối chiếu các mẫu đã đăng ký bằng OpenCV. Kết quả chỉ là gợi ý,
            chưa thay thế xác nhận của giáo viên. Mẫu ngoài thư viện cần thiết lập tọa độ trước khi chấm.
          </p>
        </div>
        <input ref={detectFileRef} type="file" accept="image/png,image/jpeg,image/webp"
          className="hidden" onChange={e => { const file = e.target.files?.[0]; if (file) void handleDetectTemplate(file); }} />
        <button type="button" disabled={detecting || opencvStatus !== 'ready'}
          onClick={() => detectFileRef.current?.click()}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50">
          <Upload className="h-4 w-4" />
          {detecting ? 'Đang kiểm tra...' : 'Tải ảnh để nhận diện mẫu'}
        </button>
        {detectMessage && <p role="status" className="text-sm text-slate-800">{detectMessage}</p>}
        {detectMatches.map(m => (
          <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-white p-3">
            <div>
              <p className="text-sm font-semibold text-slate-900">{m.name}</p>
              <p className="text-sm text-slate-600">Định vị: {m.fiducials}/4 · SBD đọc được: {m.sbd} · Mã đề: {m.code}</p>
            </div>
            <button type="button" onClick={() => { setSelectedId(m.id); setCatFilter('all'); setSearchText(''); }}
              className="rounded-md border border-blue-300 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-50">
              Xem và kiểm tra mẫu
            </button>
          </div>
        ))}
      </section>
      <div className="relative max-w-lg">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
        <input value={searchText} onChange={e => setSearchText(e.target.value)}
          placeholder="Tìm theo tên, mã mẫu, số câu..." aria-label="Tìm mẫu phiếu"
          className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pl-10 pr-3 text-sm text-slate-900" />
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

      <div className="flex justify-end">
        <button type="button" onClick={() => setHideTemplateList(v => !v)}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium hover:bg-slate-50">
          {hideTemplateList ? <PanelLeftOpen className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          {hideTemplateList ? 'Hiện danh sách mẫu' : 'Ẩn danh sách mẫu'}
        </button>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Template List */}
        <div className={`${hideTemplateList ? 'hidden' : 'lg:col-span-5'} bg-white border border-slate-200 rounded-lg divide-y divide-slate-100 max-h-[700px] overflow-y-auto`}>
          {filtered.length === 0 && <p className="p-5 text-sm text-slate-600">Không tìm thấy mẫu phù hợp. Hãy thay đổi từ khóa hoặc nhóm mẫu.</p>}
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
          <div className={`${hideTemplateList ? 'lg:col-span-12' : 'lg:col-span-7'} min-w-0 bg-white border border-slate-200 rounded-lg p-4 space-y-3.5`}>
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

            {selected.category === 'thpt2025' && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm leading-relaxed text-slate-800">
                <p className={`mb-2 font-semibold ${templateIssues.length ? 'text-red-700' : 'text-emerald-800'}`}>
                  {templateIssues.length
                    ? `Cấu trúc vùng tô chưa hợp lệ (${templateIssues.length} vấn đề): ${templateIssues.slice(0, 3).join('; ')}`
                    : 'Đã kiểm tra đủ vùng tô I, II, III theo cấu hình của mẫu nội bộ.'}
                </p>
                <strong>Cấu trúc mẫu:</strong> Phần I: {selected.part1Count} câu A/B/C/D;
                {' '}Phần II: {selected.part2Count} câu Đúng/Sai (mỗi câu 4 ý a, b, c, d);
                {' '}Phần III: {selected.part3Count} câu trả lời ngắn.
                {selected.part2Count > 0 && (
                  <p className="mt-1">Điểm Phần II theo số ý đúng trong mỗi câu: 0 ý = 0; 1 ý = 0,10; 2 ý = 0,25; 3 ý = 0,50; 4 ý = 1,00 (cấu hình trong Đáp án và thang điểm).</p>
                )}
                {selected.part3Count > 0 && (
                  <p className="mt-1">Phần III hỗ trợ các ô chữ số 0–9, dấu âm và dấu phẩy; cần kiểm tra nhận dạng trên phiếu in thực tế.</p>
                )}
                <p className="mt-1 text-amber-800">Đây là mẫu do ứng dụng tạo theo cấu trúc bài thi, không phải phôi phiếu chính thức được Bộ GD&ĐT xác nhận.</p>
              </div>
            )}
            {previewTools(false)}
            <div ref={previewScrollRef} className="bg-slate-100 rounded-md p-3 overflow-auto max-h-[680px]"
              aria-label="Xem trước mẫu phiếu có thể phóng to và cuộn">
              <canvas ref={previewCanvasRef}
                className="block mx-auto shadow-sm bg-white border border-slate-200"
                style={fitPreview
                  ? { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '640px' }
                  : { width: `${selected.widthPx * zoom / 100}px`, height: 'auto', maxWidth: 'none' }}
              />
            </div>
          </div>
        )}
      </div>
      {fullscreenPreview && selected && (
        <div role="dialog" aria-modal="true" aria-label={`Xem lớn mẫu phiếu ${selected.name}`}
          className="fixed inset-0 z-[100] flex flex-col bg-slate-950/95 p-3 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white p-3">
            <h2 className="max-w-[440px] text-sm font-bold text-slate-900">{selected.name}</h2>
            {previewTools(true)}
          </div>
          <div className="mt-3 min-h-0 flex-1 overflow-auto rounded-lg bg-slate-200 p-4">
            <canvas ref={fullscreenCanvasRef} className="block mx-auto bg-white shadow-xl"
              style={fitPreview
                ? { width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }
                : { width: `${selected.widthPx * zoom / 100}px`, height: 'auto', maxWidth: 'none' }} />
          </div>
          <p className="mt-2 text-center text-sm text-white">Dùng thanh cuộn để xem các vùng khi phóng to. Nhấn Esc để đóng.</p>
        </div>
      )}
    </div>
  );
};

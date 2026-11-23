import React, { useEffect, useRef, useState } from 'react';
import {
  Copy,
  Download,
  ImagePlus,
  Printer,
  RotateCcw,
  Save,
  Trash2,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { closePdfDocument, getPdfPageCount, renderPdfPageToCanvas, releaseCanvasMemory } from '../engine/pdfReader';
import { drawTemplateOnCanvas, generateBlankSheetPdf } from '../engine/sheetRenderer';
import { buildTemplateFromSpec, getCanonicalDimensions } from '../engine/templates';
import type {
  BubbleCoord,
  BubbleGroupKind,
  Orientation,
  PaperSize,
  SheetTemplate,
  TemplateCategory,
} from '../types/omr';

export const TemplateDesignerPage: React.FC = () => {
  const { templates, activeExam, upsertTemplate } = useApp();
  const customTemplates = templates.filter((t) => !t.isBuiltIn);

  const [mode, setMode] = useState<'parametric' | 'overlay'>('parametric');
  const [baseId, setBaseId] = useState<string>(templates[0]?.id || 'tpl_thpt2025_toan');
  const [tplName, setTplName] = useState('Mẫu phiếu thiết kế mới');
  const newTemplateIdRef = useRef(`tpl_custom_${Date.now()}`);
  const [tplVersion, setTplVersion] = useState('1.0');
  const [category, setCategory] = useState<TemplateCategory>('custom');
  const [paperSize, setPaperSize] = useState<PaperSize>('A4');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [sbdDigits, setSbdDigits] = useState(6);
  const [examCodeDigits, setExamCodeDigits] = useState(3);
  const [phachDigits, setPhachDigits] = useState(0);
  const [part1Count, setPart1Count] = useState(20);
  const [part1Cols, setPart1Cols] = useState(2);
  const [part2Count, setPart2Count] = useState(4);
  const [part3Count, setPart3Count] = useState(6);
  const [bubbleScale, setBubbleScale] = useState(1.0);
  const [schoolLabel, setSchoolLabel] = useState(activeExam?.schoolName || 'TRƯỜNG THPT');
  const [examLabel, setExamLabel] = useState(activeExam?.name || 'PHIẾU TRẢ LỜI TRẮC NGHIỆM');
  const [subjectLabel, setSubjectLabel] = useState(activeExam?.subject || 'Toán');

  // External image / PDF overlay mapping state
  const [externalBgUrl, setExternalBgUrl] = useState<string | null>(null);
  const [overlayTool, setOverlayTool] = useState<'fiducial' | 'bubble'>('bubble');
  const [overlayKind, setOverlayKind] = useState<BubbleGroupKind>('part1');
  const [overlayQ, setOverlayQ] = useState(1);
  const [overlayOpt, setOverlayOpt] = useState('A');
  const [overlayBubbles, setOverlayBubbles] = useState<BubbleCoord[]>([]);
  const [overlayFiducials, setOverlayFiducials] = useState<{ x: number; y: number }[]>([]);
  const [notice, setNotice] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Build live parametric template directly using the exact OMR engine generator
  const liveTemplate: SheetTemplate = React.useMemo(() => {
    const spec = buildTemplateFromSpec({
      id: baseId.startsWith('tpl_custom_') ? baseId : newTemplateIdRef.current,
      version: tplVersion,
      name: tplName,
      category,
      paperSize,
      orientation,
      sbdDigits,
      examCodeDigits,
      phachDigits: phachDigits > 0 ? phachDigits : undefined,
      part1Count,
      part1Columns: part1Cols,
      part2Count,
      part3Count,
      isBuiltIn: false,
      isOfficialVerified: false,
    });

    if (mode === 'overlay' && externalBgUrl) {
      const dims = getCanonicalDimensions(paperSize, orientation);
      const fid =
        overlayFiducials.length === 4
          ? {
              topLeft: overlayFiducials[0],
              topRight: overlayFiducials[1],
              bottomRight: overlayFiducials[2],
              bottomLeft: overlayFiducials[3],
              markerSizeNorm: 0.022,
            }
          : spec.fiducials;
      return {
        ...spec,
        widthPx: dims.widthPx,
        heightPx: dims.heightPx,
        fiducials: fid,
        bubbles: overlayBubbles,
        backgroundImageDataUrl: externalBgUrl,
      };
    }

    // Apply bubble radius scale factor consistently to preview & OMR map
    if (bubbleScale !== 1.0) {
      spec.bubbles = spec.bubbles.map((b) => ({
        ...b,
        rx: b.rx * bubbleScale,
        ry: b.ry * bubbleScale,
      }));
    }
    return spec;
  }, [
    baseId,
    tplVersion,
    tplName,
    category,
    paperSize,
    orientation,
    sbdDigits,
    examCodeDigits,
    phachDigits,
    part1Count,
    part1Cols,
    part2Count,
    part3Count,
    bubbleScale,
    mode,
    externalBgUrl,
    overlayBubbles,
    overlayFiducials,
  ]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (mode === 'overlay' && externalBgUrl) {
      const img = new Image();
      img.onload = () => {
        canvas.width = liveTemplate.widthPx;
        canvas.height = liveTemplate.heightPx;
        const ctx = canvas.getContext('2d')!;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        // Draw marked fiducials
        overlayFiducials.forEach((pt, idx) => {
          ctx.fillStyle = '#16A34A';
          ctx.fillRect(pt.x * canvas.width - 10, pt.y * canvas.height - 10, 20, 20);
          ctx.fillStyle = '#FFFFFF';
          ctx.font = 'bold 11px sans-serif';
          ctx.fillText(String(idx + 1), pt.x * canvas.width - 3, pt.y * canvas.height + 4);
        });
        // Draw marked bubbles
        for (const b of overlayBubbles) {
          ctx.beginPath();
          ctx.ellipse(
            b.cx * canvas.width,
            b.cy * canvas.height,
            b.rx * canvas.width,
            b.ry * canvas.height,
            0,
            0,
            Math.PI * 2
          );
          ctx.strokeStyle = '#2563EB';
          ctx.lineWidth = 2;
          ctx.stroke();
          ctx.fillStyle = 'rgba(37, 99, 235, 0.22)';
          ctx.fill();
        }
      };
      img.src = externalBgUrl;
    } else {
      drawTemplateOnCanvas(canvas, liveTemplate, {
        schoolName: schoolLabel,
        examName: examLabel,
        subject: subjectLabel,
      });
    }
  }, [liveTemplate, mode, externalBgUrl, overlayBubbles, overlayFiducials, schoolLabel, examLabel, subjectLabel]);

  const handleLoadTemplateIntoEditor = (tpl: SheetTemplate) => {
    setBaseId(tpl.id);
    setTplName(tpl.isBuiltIn ? `${tpl.name} (Tùy chỉnh)` : tpl.name);
    setTplVersion(tpl.version);
    setCategory(tpl.category === 'paired_a5' || tpl.category === 'phach_a3' ? tpl.category : 'custom');
    setPaperSize(tpl.paperSize);
    setOrientation(tpl.orientation);
    setSbdDigits(tpl.sbdDigits);
    setExamCodeDigits(tpl.examCodeDigits);
    setPhachDigits(tpl.phachDigits || 0);
    setPart1Count(tpl.part1Count);
    setPart1Cols(tpl.part1Columns);
    setPart2Count(tpl.part2Count);
    setPart3Count(tpl.part3Count);
    if (tpl.backgroundImageDataUrl) {
      setExternalBgUrl(tpl.backgroundImageDataUrl);
      setOverlayBubbles(tpl.bubbles);
      setMode('overlay');
    } else {
      setMode('parametric');
    }
  };

  const handleUploadExternal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.type === 'application/pdf') {
        const { doc } = await getPdfPageCount(file);
        const c = await renderPdfPageToCanvas(doc, 1, 2.0);
        setExternalBgUrl(c.toDataURL('image/jpeg', 0.92));
        releaseCanvasMemory(c);
        await closePdfDocument(doc);
      } else {
        const reader = new FileReader();
        reader.onload = () => setExternalBgUrl(String(reader.result));
        reader.readAsDataURL(file);
      }
      setMode('overlay');
      setOverlayFiducials([]);
      setOverlayBubbles([]);
      setNotice('Đã tải mẫu ngoài. Hãy chấm 4 điểm định vị góc rồi chấm trực tiếp tọa độ từng ô tô.');
    } finally {
      e.target.value = '';
    }
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (mode !== 'overlay' || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = (e.clientX - rect.left) / rect.width;
    const ny = (e.clientY - rect.top) / rect.height;

    if (overlayTool === 'fiducial') {
      setOverlayFiducials((prev) => (prev.length >= 4 ? [{ x: nx, y: ny }] : [...prev, { x: nx, y: ny }]));
      return;
    }

    const opts = ['A', 'B', 'C', 'D'];
    const newB: BubbleCoord = {
      id: `ov_${Date.now()}_${Math.random().toString(36).slice(2, 5)}`,
      kind: overlayKind,
      question: overlayKind === 'part1' || overlayKind === 'part2' || overlayKind === 'part3' ? overlayQ : undefined,
      col: overlayKind === 'sbd' || overlayKind === 'exam_code' || overlayKind === 'phach_code' ? overlayQ - 1 : undefined,
      option: overlayOpt,
      cx: nx,
      cy: ny,
      rx: 0.011 * bubbleScale,
      ry: 0.008 * bubbleScale,
    };
    setOverlayBubbles((prev) => [...prev, newB]);

    // Auto advance option A->B->C->D -> next question for fast mapping
    if (overlayKind === 'part1') {
      const idx = opts.indexOf(overlayOpt);
      if (idx >= 0 && idx < 3) setOverlayOpt(opts[idx + 1]);
      else {
        setOverlayOpt('A');
        setOverlayQ((q) => q + 1);
      }
    }
  };

  const handleSaveTemplate = async () => {
    if (!tplName.trim()) { setNotice('Hãy nhập tên mẫu phiếu trước khi lưu.'); return; }
    if (mode === 'overlay' && externalBgUrl && (overlayFiducials.length !== 4 || overlayBubbles.length === 0)) {
      setNotice('Mẫu ngoài cần đủ bốn điểm định vị và ít nhất một ô trả lời đã gán tọa độ.');
      return;
    }
    const id = baseId.startsWith('tpl_custom_') ? baseId : `tpl_custom_${Date.now()}`;
    const toSave: SheetTemplate = {
      ...liveTemplate,
      id,
      name: tplName.trim() || 'Mẫu phiếu tùy chỉnh',
      isBuiltIn: false,
      isOfficialVerified: false,
      updatedAt: Date.now(),
    };
    await upsertTemplate(toSave);
    setBaseId(id);
    setNotice(`Đã lưu mẫu "${toSave.name}" (ID: ${id}). Đây là mẫu tùy chỉnh chưa xác minh chính thức; hãy in và chấm thử trước khi sử dụng.`);
  };

  const handleExportPdf = async () => {
    const bytes = await generateBlankSheetPdf(liveTemplate, {
      schoolName: schoolLabel,
      examName: examLabel,
      subject: subjectLabel,
    });
    const blob = new Blob([new Uint8Array(bytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${liveTemplate.id}.pdf`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-4">
      <div role="note" className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm leading-relaxed text-amber-900">
        Mẫu do giáo viên thiết kế chưa được xác minh là mẫu chính thức. Sau khi lưu, hãy in thử và kiểm tra bốn điểm định vị, SBD, mã đề, vùng tô và kết quả chấm trước khi dùng trong kỳ kiểm tra.
      </div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Trình thiết kế phiếu thi</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Hệ tọa độ xem trước đồng bộ 1:1 với bộ máy nhận dạng OMR. Hỗ trợ tạo mới hoặc đánh dấu trực tiếp trên mẫu ảnh/PDF tải lên.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <ImagePlus className="w-4 h-4" />
            Tải mẫu ngoài (JPG/PNG/PDF)
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".jpg,.jpeg,.png,.pdf"
            onChange={handleUploadExternal}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportPdf}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Download className="w-4 h-4" />
            Xuất PDF
          </button>
          <button
            type="button"
            onClick={() => window.print()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            <Printer className="w-4 h-4" />
            In
          </button>
          <button
            type="button"
            onClick={handleSaveTemplate}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700"
          >
            <Save className="w-4 h-4" />
            Lưu mẫu phiếu
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

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Left Controls */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <div className="flex items-center gap-1 p-1 bg-slate-100 rounded-md">
            <button
              type="button"
              onClick={() => setMode('parametric')}
              className={`flex-1 py-1.5 text-xs font-medium rounded ${
                mode === 'parametric' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
              }`}
            >
              Thiết kế tự động
            </button>
            <button
              type="button"
              onClick={() => setMode('overlay')}
              className={`flex-1 py-1.5 text-xs font-medium rounded ${
                mode === 'overlay' ? 'bg-white text-[#1E293B] shadow-sm' : 'text-slate-600'
              }`}
            >
              Đánh dấu mẫu tải lên
            </button>
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-700 mb-1">Nạp từ mẫu có sẵn</label>
            <select
              onChange={(e) => {
                const found = templates.find((t) => t.id === e.target.value);
                if (found) handleLoadTemplateIntoEditor(found);
              }}
              value={baseId}
              className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
            >
              {templates.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="col-span-2">
              <label className="block text-xs font-medium text-slate-700 mb-1">Tên mẫu phiếu</label>
              <input
                type="text"
                value={tplName}
                onChange={(e) => setTplName(e.target.value)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Khổ giấy</label>
              <select
                value={paperSize}
                onChange={(e) => setPaperSize(e.target.value as PaperSize)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="A4">A4</option>
                <option value="A5">A5</option>
                <option value="A3">A3</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-slate-700 mb-1">Hướng giấy</label>
              <select
                value={orientation}
                onChange={(e) => setOrientation(e.target.value as Orientation)}
                className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded-md bg-white"
              >
                <option value="portrait">Dọc</option>
                <option value="landscape">Ngang</option>
              </select>
            </div>
          </div>

          {mode === 'parametric' ? (
            <div className="space-y-3">
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Ô SBD</label>
                  <input
                    type="number"
                    min={3}
                    max={8}
                    value={sbdDigits}
                    onChange={(e) => setSbdDigits(Number(e.target.value) || 6)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Ô Mã đề</label>
                  <input
                    type="number"
                    min={2}
                    max={4}
                    value={examCodeDigits}
                    onChange={(e) => setExamCodeDigits(Number(e.target.value) || 3)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Ô Phách</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={phachDigits}
                    onChange={(e) => setPhachDigits(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Câu Phần I</label>
                  <input
                    type="number"
                    min={0}
                    max={100}
                    value={part1Count}
                    onChange={(e) => setPart1Count(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Số cột P.I</label>
                  <input
                    type="number"
                    min={1}
                    max={5}
                    value={part1Cols}
                    onChange={(e) => setPart1Cols(Number(e.target.value) || 2)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Câu Phần II (Đ/S)</label>
                  <input
                    type="number"
                    min={0}
                    max={8}
                    value={part2Count}
                    onChange={(e) => setPart2Count(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-medium text-slate-600 mb-1">Câu Phần III (TLN)</label>
                  <input
                    type="number"
                    min={0}
                    max={6}
                    value={part3Count}
                    onChange={(e) => setPart3Count(Number(e.target.value) || 0)}
                    className="w-full px-2 py-1.5 text-xs border border-slate-300 rounded font-mono-num"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-medium text-slate-600 mb-1">
                  Kích thước ô tô: {Math.round(bubbleScale * 100)}%
                </label>
                <input
                  type="range"
                  min={0.75}
                  max={1.3}
                  step={0.05}
                  value={bubbleScale}
                  onChange={(e) => setBubbleScale(Number(e.target.value))}
                  className="w-full"
                />
              </div>

              <div className="space-y-2 pt-2 border-t border-slate-100">
                <input
                  type="text"
                  value={schoolLabel}
                  onChange={(e) => setSchoolLabel(e.target.value)}
                  placeholder="Tên trường"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={examLabel}
                  onChange={(e) => setExamLabel(e.target.value)}
                  placeholder="Tên kỳ kiểm tra"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
                <input
                  type="text"
                  value={subjectLabel}
                  onChange={(e) => setSubjectLabel(e.target.value)}
                  placeholder="Môn học"
                  className="w-full px-2.5 py-1.5 text-xs border border-slate-300 rounded"
                />
              </div>
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <p className="text-slate-600">
                Nhấp trực tiếp lên ảnh phiếu bên phải để tạo bản đồ tọa độ nhận diện.
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOverlayTool('fiducial')}
                  className={`flex-1 py-1.5 rounded border ${
                    overlayTool === 'fiducial'
                      ? 'bg-emerald-50 border-[#16A34A] text-[#16A34A] font-medium'
                      : 'border-slate-300'
                  }`}
                >
                  Đặt 4 điểm định vị ({overlayFiducials.length}/4)
                </button>
                <button
                  type="button"
                  onClick={() => setOverlayTool('bubble')}
                  className={`flex-1 py-1.5 rounded border ${
                    overlayTool === 'bubble'
                      ? 'bg-blue-50 border-[#2563EB] text-[#2563EB] font-medium'
                      : 'border-slate-300'
                  }`}
                >
                  Đặt ô tô ({overlayBubbles.length})
                </button>
              </div>
              {overlayTool === 'bubble' && (
                <div className="grid grid-cols-3 gap-2">
                  <select
                    value={overlayKind}
                    onChange={(e) => setOverlayKind(e.target.value as BubbleGroupKind)}
                    className="px-2 py-1.5 border border-slate-300 rounded bg-white"
                  >
                    <option value="part1">Phần I</option>
                    <option value="sbd">SBD</option>
                    <option value="exam_code">Mã đề</option>
                  </select>
                  <input
                    type="number"
                    min={1}
                    value={overlayQ}
                    onChange={(e) => setOverlayQ(Number(e.target.value) || 1)}
                    className="px-2 py-1.5 border border-slate-300 rounded font-mono-num"
                    title="Câu / Cột"
                  />
                  <input
                    type="text"
                    value={overlayOpt}
                    onChange={(e) => setOverlayOpt(e.target.value)}
                    className="px-2 py-1.5 border border-slate-300 rounded font-mono-num"
                    title="Phương án (A/B/C/D hoặc 0..9)"
                  />
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setOverlayBubbles((p) => p.slice(0, -1))}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-slate-300 rounded hover:bg-slate-50"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Hoàn tác ô cuối
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setOverlayBubbles([]);
                    setOverlayFiducials([]);
                  }}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 border border-red-200 text-[#DC2626] rounded hover:bg-red-50"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Xóa hết
                </button>
              </div>
            </div>
          )}

          {/* Template Metadata Summary */}
          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 space-y-1 font-mono-num">
            <div>Tổng số ô tô tọa độ: {liveTemplate.bubbles.length}</div>
            <div>Kích thước chuẩn: {liveTemplate.widthPx} × {liveTemplate.heightPx} px</div>
            <div>Phiên bản mẫu: v{liveTemplate.version}</div>
          </div>

          {customTemplates.length > 0 && (
            <div className="pt-2 border-t border-slate-100">
              <div className="text-xs font-semibold text-slate-700 mb-1.5">Mẫu đã lưu ({customTemplates.length})</div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {customTemplates.map((ct) => (
                  <button
                    key={ct.id}
                    type="button"
                    onClick={() => handleLoadTemplateIntoEditor(ct)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded text-xs hover:bg-slate-100 text-left"
                  >
                    <span className="truncate">{ct.name}</span>
                    <Copy className="w-3 h-3 text-slate-400 shrink-0" />
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right Live Canvas */}
        <div className="lg:col-span-8 bg-slate-100 border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center overflow-auto max-h-[760px]">
          <canvas
            ref={canvasRef}
            onClick={handleCanvasClick}
            className={`max-w-full h-auto bg-white shadow-sm border border-slate-300 ${
              mode === 'overlay' ? 'cursor-crosshair' : ''
            }`}
            style={{ maxHeight: '690px', width: 'auto' }}
          />
        </div>
      </div>
    </div>
  );
};

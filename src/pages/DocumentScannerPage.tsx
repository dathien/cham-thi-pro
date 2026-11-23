import React, { useEffect, useRef, useState } from 'react';
import { PDFDocument } from 'pdf-lib';
import {
  Camera,
  Download,
  FilePlus2,
  ImagePlus,
  RotateCw,
  ScanLine,
  Sparkles,
  Trash2,
} from 'lucide-react';
import {
  detectDocumentCorners,
  processDocumentScan,
} from '../engine/omrEngine';

interface ScannedPage {
  id: string;
  name: string;
  originalUrl: string;
  processedUrl: string;
  corners: { x: number; y: number }[];
}

export const DocumentScannerPage: React.FC = () => {
  const fileRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const [sourceUrl, setSourceUrl] = useState<string | null>(null);
  const [processedUrl, setProcessedUrl] = useState<string | null>(null);
  const [corners, setCorners] = useState<{ x: number; y: number }[]>([
    { x: 0.08, y: 0.08 },
    { x: 0.92, y: 0.08 },
    { x: 0.92, y: 0.92 },
    { x: 0.08, y: 0.92 },
  ]);
  const [draggingCorner, setDraggingCorner] = useState<number | null>(null);
  const [rotationDeg, setRotationDeg] = useState<0 | 90 | 180 | 270>(0);
  const [mode, setMode] = useState<'color' | 'grayscale' | 'bw'>('bw');
  const [removeShadow, setRemoveShadow] = useState(true);
  const [contrast, setContrast] = useState(1.15);
  const [denoise, setDenoise] = useState(true);
  const [compareOriginal, setCompareOriginal] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [pages, setPages] = useState<ScannedPage[]>([]);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [exporting, setExporting] = useState(false);
  const imageLoadToken = useRef(0);

  useEffect(() => {
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
      }
    };
  }, []);

  const loadImageAndDetect = async (dataUrl: string) => {
    const token = ++imageLoadToken.current;
    setErrorMessage('');
    setSourceUrl(dataUrl);
    setProcessedUrl(null);
    try {
      const detected = await detectDocumentCorners(dataUrl);
      if (token === imageLoadToken.current) setCorners(detected);
    } catch {
      if (token === imageLoadToken.current) setErrorMessage('Không tự tìm được bốn góc. Hãy kéo các điểm định vị thủ công.');
    }
  };

  const handleUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { setErrorMessage('Vui lòng chọn tệp ảnh JPG, PNG hoặc WEBP.'); return; }
    const reader = new FileReader();
    reader.onload = () => loadImageAndDetect(String(reader.result));
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const openCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } },
        audio: false,
      });
      streamRef.current = stream;
      setCameraOpen(true);
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
      }, 60);
    } catch {
      setCameraOpen(false);
      setErrorMessage('Không mở được Camera. Kiểm tra quyền truy cập, kết nối HTTPS và thiết bị Camera.');
    }
  };

  const snapFromCamera = () => {
    if (!videoRef.current) return;
    const v = videoRef.current;
    const c = document.createElement('canvas');
    c.width = v.videoWidth;
    c.height = v.videoHeight;
    c.getContext('2d')!.drawImage(v, 0, 0);
    const url = c.toDataURL('image/jpeg', 0.92);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraOpen(false);
    loadImageAndDetect(url);
  };

  // Draw interactive 4-corner polygon editor on source image
  useEffect(() => {
    if (!sourceUrl || processedUrl || !canvasRef.current) return;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current!;
      const scale = Math.min(1, 900 / img.naturalWidth);
      c.width = Math.round(img.naturalWidth * scale);
      c.height = Math.round(img.naturalHeight * scale);
      const ctx = c.getContext('2d')!;
      ctx.drawImage(img, 0, 0, c.width, c.height);

      // Draw polygon
      ctx.strokeStyle = '#2563EB';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      corners.forEach((pt, idx) => {
        const x = pt.x * c.width;
        const y = pt.y * c.height;
        if (idx === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      });
      ctx.closePath();
      ctx.stroke();

      // Corner handles
      corners.forEach((pt, idx) => {
        const x = pt.x * c.width;
        const y = pt.y * c.height;
        ctx.beginPath();
        ctx.arc(x, y, 10, 0, Math.PI * 2);
        ctx.fillStyle = '#2563EB';
        ctx.fill();
        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 2.5;
        ctx.stroke();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = 'bold 10px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(String(idx + 1), x, y);
      });
    };
    img.src = sourceUrl;
  }, [sourceUrl, processedUrl, corners]);

  const updateCornerPointer = (clientX: number, clientY: number) => {
    if (draggingCorner === null || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();
    const nx = Math.max(0.01, Math.min(0.99, (clientX - rect.left) / rect.width));
    const ny = Math.max(0.01, Math.min(0.99, (clientY - rect.top) / rect.height));
    setCorners((prev) => prev.map((p, idx) => (idx === draggingCorner ? { x: nx, y: ny } : p)));
  };

  const handleRunScan = async () => {
    if (!sourceUrl) return;
    setProcessing(true);
    setErrorMessage('');
    try {
      const out = await processDocumentScan(sourceUrl, corners, {
        rotationDeg,
        mode,
        removeShadow,
        contrast,
        denoise,
      });
      setProcessedUrl(out);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không xử lý được ảnh. Hãy kiểm tra lại bốn góc giấy.');
    } finally {
      setProcessing(false);
    }
  };

  const handleAddToPdfList = () => {
    if (!sourceUrl || !processedUrl) return;
    setPages((prev) => [
      ...prev,
      {
        id: `scan_${Date.now()}`,
        name: `Trang ${prev.length + 1}`,
        originalUrl: sourceUrl,
        processedUrl,
        corners: [...corners],
      },
    ]);
  };

  const handleExportMultiPagePdf = async () => {
    const items = pages.length > 0 ? pages : processedUrl ? [{ processedUrl }] : [];
    if (items.length === 0) return;
    setExporting(true);
    setErrorMessage('');
    try {
    const pdf = await PDFDocument.create();
    for (const p of items) {
      const bytes = await fetch(p.processedUrl).then((r) => r.arrayBuffer());
      const img = p.processedUrl.startsWith('data:image/png') ? await pdf.embedPng(bytes) : await pdf.embedJpg(bytes);
      // Export at A4 proportion matching aspect
      const isLandscape = img.width > img.height;
      const pw = isLandscape ? 841.89 : 595.28;
      const ph = isLandscape ? 595.28 : 841.89;
      const page = pdf.addPage([pw, ph]);
      const scale = Math.min(pw / img.width, ph / img.height);
      const dw = img.width * scale;
      const dh = img.height * scale;
      page.drawImage(img, {
        x: (pw - dw) / 2,
        y: (ph - dh) / 2,
        width: dw,
        height: dh,
      });
    }
    const pdfBytes = await pdf.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tai_lieu_scan_${Date.now()}.pdf`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1500);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Không xuất được PDF.');
    } finally {
      setExporting(false);
    }
  };

  const downloadProcessedImage = () => {
    if (!processedUrl) return;
    const a = document.createElement('a');
    a.href = processedUrl;
    a.download = `scan_${Date.now()}.${processedUrl.startsWith('data:image/png') ? 'png' : 'jpg'}`;
    a.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Scan tài liệu thông minh</h1>
          <p className="text-sm text-slate-600 mt-0.5">
            Phát hiện & kéo chỉnh 4 góc giấy, hiệu chỉnh phối cảnh, khử bóng mà vẫn giữ nét bút chì mờ, ghép nhiều trang thành PDF.
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={openCamera}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
          >
            <Camera className="w-4 h-4" />
            Chụp tài liệu
          </button>
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
          >
            <ImagePlus className="w-4 h-4" />
            Chọn ảnh có sẵn
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            type="button"
            onClick={handleExportMultiPagePdf}
            disabled={(pages.length === 0 && !processedUrl) || exporting}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            {exporting ? 'Đang xuất PDF...' : `Xuất PDF (${pages.length > 0 ? `${pages.length} trang` : 'trang hiện tại'})`}
          </button>
        </div>
      </div>

      {errorMessage && <div role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{errorMessage}</div>}
      {cameraOpen && (
        <div className="bg-slate-900 rounded-lg p-4 space-y-3">
          <video ref={videoRef} playsInline muted className="w-full max-h-[420px] object-contain mx-auto" />
          <div className="flex justify-center gap-2">
            <button
              type="button"
              onClick={snapFromCamera}
              className="px-4 py-2 rounded bg-[#16A34A] text-white text-xs font-medium"
            >
              Chụp ảnh
            </button>
            <button
              type="button"
              onClick={() => {
                streamRef.current?.getTracks().forEach((t) => t.stop());
                setCameraOpen(false);
              }}
              className="px-4 py-2 rounded bg-slate-700 text-white text-xs"
            >
              Đóng Camera
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Controls */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-4 text-xs">
          <h2 className="text-sm font-semibold text-[#1E293B]">Thiết lập xử lý ảnh</h2>

          <div>
            <label className="block font-medium text-slate-700 mb-1">Chế độ màu</label>
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { id: 'color' as const, label: 'Màu' },
                { id: 'grayscale' as const, label: 'Xám' },
                { id: 'bw' as const, label: 'Đen trắng' },
              ].map((m) => (
                <button
                  key={m.id}
                  type="button"
                  onClick={() => setMode(m.id)}
                  className={`py-1.5 rounded border font-medium ${
                    mode === m.id
                      ? 'bg-[#2563EB] border-[#2563EB] text-white'
                      : 'border-slate-300 text-slate-700'
                  }`}
                >
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={removeShadow}
                onChange={(e) => setRemoveShadow(e.target.checked)}
              />
              Khử bóng & làm trắng nền (giữ nét chì mờ)
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={denoise}
                onChange={(e) => setDenoise(e.target.checked)}
              />
              Giảm nhiễu hạt
            </label>
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Độ tương phản: {contrast.toFixed(2)}×
            </label>
            <input
              type="range"
              min={1.0}
              max={1.8}
              step={0.05}
              value={contrast}
              onChange={(e) => setContrast(Number(e.target.value))}
              className="w-full"
            />
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setRotationDeg((d) => ((d + 90) % 360) as 0 | 90 | 180 | 270)}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded border border-slate-300 hover:bg-slate-50"
            >
              <RotateCw className="w-3.5 h-3.5" />
              Xoay ({rotationDeg}°)
            </button>
            <button
              type="button"
              onClick={handleRunScan}
              disabled={!sourceUrl || processing}
              className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded bg-[#16A34A] text-white font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {processing ? 'Đang xử lý...' : 'Cắt & làm nét'}
            </button>
          </div>

          {processedUrl && (
            <div className="pt-2 border-t border-slate-100 space-y-2">
              <button type="button" onClick={downloadProcessedImage}
                className="w-full rounded border border-blue-300 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-800">
                Tải ảnh đã xử lý (JPG/PNG)
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setCompareOriginal((v) => !v)}
                  className="flex-1 py-1.5 rounded border border-slate-300 hover:bg-slate-50 font-medium"
                >
                  {compareOriginal ? 'Xem ảnh đã xử lý' : 'So sánh ảnh gốc'}
                </button>
                <button
                  type="button"
                  onClick={() => setProcessedUrl(null)}
                  className="py-1.5 px-3 rounded border border-slate-300 hover:bg-slate-50"
                >
                  Chỉnh lại 4 góc
                </button>
              </div>
              <button
                type="button"
                onClick={handleAddToPdfList}
                className="w-full inline-flex items-center justify-center gap-1.5 py-2 rounded bg-slate-800 text-white font-medium hover:bg-slate-900"
              >
                <FilePlus2 className="w-4 h-4" />
                Thêm vào tệp PDF nhiều trang
              </button>
            </div>
          )}

          {pages.length > 0 && (
            <div className="pt-3 border-t border-slate-100 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <div className="font-semibold text-slate-700">Danh sách trang đã ghép ({pages.length})</div>
                <button type="button" onClick={() => setPages([])} className="text-sm font-semibold text-red-700 underline">Xóa tất cả trang</button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {pages.map((p, i) => (
                  <div
                    key={p.id}
                    className="flex items-center justify-between px-2.5 py-1.5 bg-slate-50 rounded border border-slate-200"
                  >
                    <span>Trang {i + 1}</span>
                    <button
                      type="button"
                      onClick={() => setPages((prev) => prev.filter((x) => x.id !== p.id))}
                      className="text-slate-400 hover:text-[#DC2626]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Interactive Corner / Result Canvas */}
        <div className="lg:col-span-8 bg-slate-100 border border-slate-200 rounded-lg p-4 flex flex-col items-center justify-center min-h-[440px]">
          {!sourceUrl ? (
            <div className="text-center text-sm text-slate-600 space-y-2">
              <ScanLine className="w-10 h-10 text-slate-400 mx-auto" />
              <div>Hãy chụp ảnh hoặc chọn ảnh tài liệu để bắt đầu kéo chỉnh 4 góc.</div>
            </div>
          ) : processedUrl ? (
            <img
              src={compareOriginal ? sourceUrl : processedUrl}
              alt="Kết quả scan"
              referrerPolicy="no-referrer"
              className="max-w-full max-h-[600px] object-contain bg-white shadow-sm border border-slate-300"
            />
          ) : (
            <div className="space-y-2 text-center">
              <div className="text-xs text-slate-600">
                Kéo 4 điểm tròn màu xanh dương vào đúng 4 góc giấy, sau đó nhấn <strong>Cắt & làm nét</strong>.
              </div>
              <canvas
                ref={canvasRef}
                onPointerDown={(e) => {
                  if (!canvasRef.current) return;
                  const rect = canvasRef.current.getBoundingClientRect();
                  const nx = (e.clientX - rect.left) / rect.width;
                  const ny = (e.clientY - rect.top) / rect.height;
                  let bestIdx = 0;
                  let bestD = Infinity;
                  corners.forEach((p, idx) => {
                    const d = Math.hypot(p.x - nx, p.y - ny);
                    if (d < bestD) {
                      bestD = d;
                      bestIdx = idx;
                    }
                  });
                  if (bestD < 0.08) { setDraggingCorner(bestIdx); e.currentTarget.setPointerCapture(e.pointerId); }
                }}
                onPointerMove={(e) => updateCornerPointer(e.clientX, e.clientY)}
                onPointerUp={() => setDraggingCorner(null)}
                onPointerCancel={() => setDraggingCorner(null)}
                className="max-w-full max-h-[580px] cursor-crosshair touch-none bg-white shadow-sm border border-slate-300"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

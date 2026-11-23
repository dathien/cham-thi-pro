import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Camera,
  CheckCircle2,
  Flashlight,
  Focus,
  Maximize2,
  Pause,
  Play,
  RefreshCw,
  SwitchCamera,
  AlertTriangle,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { saveBlob } from '../db/database';
import {
  detectLiveSheetForCamera,
  processSheetImageWithOpenCV,
  type LiveCameraDetection,
} from '../engine/omrEngine';
import type { ExamSubmission } from '../types/omr';

function playSuccessBeep() {
  try {
    const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(1320, ctx.currentTime + 0.08);
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.16);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.17);
  } catch {
    // Ignore audio context block
  }
}

export const CameraGradingPage: React.FC = () => {
  const {
    activeExam,
    templates,
    answerKeys,
    students,
    settings,
    opencvStatus,
    upsertSubmission,
    setActivePage,
  } = useApp();

  const videoRef = useRef<HTMLVideoElement>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animRef = useRef<number | null>(null);

  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [torchOn, setTorchOn] = useState(false);
  const [torchSupported, setTorchSupported] = useState(false);
  const [cameraActive, setCameraActive] = useState(false);
  const [paused, setPaused] = useState(false);
  const [autoCapture, setAutoCapture] = useState(true);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [liveDet, setLiveDet] = useState<LiveCameraDetection | null>(null);
  const [processing, setProcessing] = useState(false);
  const [lastResult, setLastResult] = useState<ExamSubmission | null>(null);
  const [sessionCount, setSessionCount] = useState(0);
  const [sessionReviewCount, setSessionReviewCount] = useState(0);
  const [sessionErrorCount, setSessionErrorCount] = useState(0);
  const processingRef = useRef(false);
  const cameraStartTokenRef = useRef(0);
  const lastCapturedSignatureRef = useRef('');
  const lastCapturedAtRef = useRef(0);
  const sheetPresentRef = useRef(false);

  const stableFramesRef = useRef(0);

  const template = templates.find((t) => t.id === activeExam?.templateId) || templates[0];
  const examKeys = activeExam
    ? answerKeys.filter((k) => k.examId === activeExam.id)
    : [];

  const stopCamera = useCallback(() => {
    cameraStartTokenRef.current += 1;
    if (animRef.current) {
      cancelAnimationFrame(animRef.current);
      animRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
    setTorchOn(false);
    setTorchSupported(false);
    setLiveDet(null);
    stableFramesRef.current = 0;
    sheetPresentRef.current = false;
  }, []);

  const startCamera = useCallback(async (requestedFacing?: 'environment' | 'user') => {
    stopCamera();
    const startToken = cameraStartTokenRef.current;
    setCameraError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Trình duyệt hoặc thiết bị không hỗ trợ truy cập Camera (MediaDevices API).');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: requestedFacing ?? facingMode },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      if (cameraStartTokenRef.current !== startToken) {
        stream.getTracks().forEach(track => track.stop());
        return;
      }
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      const track = stream.getVideoTracks()[0];
      const caps = track?.getCapabilities?.() as { torch?: boolean } | undefined;
      setTorchSupported(!!caps?.torch);
      setCameraActive(true);
    } catch (err) {
      if (cameraStartTokenRef.current !== startToken) return;
      setCameraError(
        err instanceof Error
          ? `Không thể mở Camera: ${err.message}`
          : 'Không thể truy cập Camera. Vui lòng cấp quyền Camera.'
      );
    }
  }, [facingMode, stopCamera]);

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, [stopCamera]);

  const captureAndGrade = useCallback(async () => {
    if (!videoRef.current || !activeExam || !template || processingRef.current) return;
    const vid = videoRef.current;
    if (!vid.videoWidth || !vid.videoHeight) return;

    processingRef.current = true;
    setProcessing(true);
    try {
      const snap = document.createElement('canvas');
      snap.width = vid.videoWidth;
      snap.height = vid.videoHeight;
      snap.getContext('2d')!.drawImage(vid, 0, 0);
      const originalDataUrl = snap.toDataURL('image/jpeg', 0.9);

      const results = await processSheetImageWithOpenCV(
        snap,
        template,
        examKeys,
        settings
      );

      for (const res of results) {
        // Prevent rapid repeat captures, including unreadable SBDs.
        const now = Date.now();
        const signature = `${activeExam.id}|${template.id}|${res.recognition.sbd}|${res.recognition.examCode}|${JSON.stringify(res.recognition.questions)}`;
        if (signature === lastCapturedSignatureRef.current && now - lastCapturedAtRef.current < 10000) {
          continue;
        }
        lastCapturedSignatureRef.current = signature;
        lastCapturedAtRef.current = now;

        const matchedStudent = students.find(
          (st) => st.sbd && st.sbd === res.recognition.sbd
        );
        const origBlobId = `blob_orig_${now}_${Math.random().toString(36).slice(2, 6)}`;
        const warpBlobId = `blob_warp_${now}_${Math.random().toString(36).slice(2, 6)}`;
        await saveBlob(origBlobId, originalDataUrl, 'image/jpeg');
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
          sourceFileName: 'Camera',
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
        setLastResult(sub);
        setSessionCount((c) => c + 1);
        if (sub.status !== 'graded') setSessionReviewCount(c => c + 1);
        if (settings.soundEnabled) playSuccessBeep();
      }
      snap.width = 1;
      snap.height = 1;
    } catch (err) {
      setSessionErrorCount(c => c + 1);
      setCameraError(err instanceof Error ? err.message : 'Lỗi xử lý ảnh Camera.');
    } finally {
      stableFramesRef.current = 0;
      processingRef.current = false;
      setProcessing(false);
    }
  }, [activeExam, template, processing, examKeys, settings, students, upsertSubmission]);

  // Adaptive frame analysis loop
  useEffect(() => {
    if (!cameraActive || paused || opencvStatus !== 'ready' || !template) return;

    let cancelled = false;
    let lastTick = 0;

    const loop = (ts: number) => {
      if (cancelled) return;
      // Throttle detection to ~5-8 FPS depending on device to keep UI smooth & avoid battery drain
      if (ts - lastTick >= 150 && videoRef.current && videoRef.current.readyState >= 2) {
        lastTick = ts;
        const det = detectLiveSheetForCamera(videoRef.current, template, settings);
        setLiveDet(det);

        // Draw overlay guide & 4 corner markers
        const ov = overlayCanvasRef.current;
        if (ov && videoRef.current) {
          ov.width = videoRef.current.clientWidth || 640;
          ov.height = videoRef.current.clientHeight || 480;
          const ctx = ov.getContext('2d')!;
          ctx.clearRect(0, 0, ov.width, ov.height);

          // Guide frame
          const padX = ov.width * 0.08;
          const padY = ov.height * 0.06;
          ctx.strokeStyle = det.isStableReady ? '#16A34A' : 'rgba(255,255,255,0.75)';
          ctx.lineWidth = det.isStableReady ? 3 : 2;
          ctx.setLineDash(det.isStableReady ? [] : [10, 6]);
          ctx.strokeRect(padX, padY, ov.width - padX * 2, ov.height - padY * 2);
          ctx.setLineDash([]);

          // Draw detected fiducial dots (green when all 4 locked!)
          for (const pt of det.cornersNorm) {
            ctx.beginPath();
            ctx.arc(pt.x * ov.width, pt.y * ov.height, 9, 0, Math.PI * 2);
            ctx.fillStyle = det.fiducialsFound === 4 ? '#16A34A' : '#F59E0B';
            ctx.fill();
            ctx.strokeStyle = '#FFFFFF';
            ctx.lineWidth = 2;
            ctx.stroke();
          }
        }

        if (!det.isStableReady) sheetPresentRef.current = false;
        if (det.isStableReady && autoCapture && !processingRef.current && !sheetPresentRef.current) {
          stableFramesRef.current += 1;
          if (stableFramesRef.current >= settings.autoCaptureFrames) {
            sheetPresentRef.current = true;
            void captureAndGrade();
          }
        } else {
          stableFramesRef.current = 0;
        }
      }
      animRef.current = requestAnimationFrame(loop);
    };

    animRef.current = requestAnimationFrame(loop);
    return () => {
      cancelled = true;
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, [cameraActive, paused, opencvStatus, template, settings, autoCapture, processing, captureAndGrade]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      const next = !torchOn;
      await track.applyConstraints({ advanced: [{ torch: next } as MediaTrackConstraintSet] });
      setTorchOn(next);
    } catch {
      // Torch unsupported on this browser/device
    }
  };

  const triggerAutofocus = async () => {
    const track = streamRef.current?.getVideoTracks()[0];
    if (!track) return;
    try {
      await track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] });
    } catch {
      // Ignore if unsupported
    }
  };

  if (!activeExam || !template) {
    return (
      <div className="bg-white border border-slate-200 rounded-lg p-6 text-center space-y-3">
        <h2 className="text-base font-semibold">Chưa chọn kỳ kiểm tra</h2>
        <p className="text-xs text-slate-500">Vui lòng chọn hoặc tạo kỳ kiểm tra trước khi chấm bằng Camera.</p>
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
    <div ref={containerRef} className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <h1 className="text-xl font-bold text-[#1E293B]">Chấm thi bằng Camera</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            {activeExam.name} · Mẫu: {template.name} · Đã chấm phiên này: <strong className="font-mono-num">{sessionCount}</strong> bài
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {!cameraActive ? (
            <button
              type="button"
              onClick={() => void startCamera()}
              disabled={opencvStatus !== 'ready'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
            >
              <Camera className="w-4 h-4" />
              Bật Camera
            </button>
          ) : (
            <>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
              >
                {paused ? <Play className="w-4 h-4" /> : <Pause className="w-4 h-4" />}
                {paused ? 'Tiếp tục' : 'Tạm dừng'}
              </button>
              <button
                type="button"
                onClick={() => {
                  const next = facingMode === 'environment' ? 'user' : 'environment';
                  setFacingMode(next);
                  void startCamera(next);
                }}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
              >
                <SwitchCamera className="w-4 h-4" />
                Đổi Camera
              </button>
              {torchSupported && (
                <button
                  type="button"
                  onClick={toggleTorch}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-md border text-xs font-medium ${
                    torchOn
                      ? 'bg-amber-50 border-amber-400 text-amber-800'
                      : 'border-slate-300 bg-white hover:bg-slate-50'
                  }`}
                >
                  <Flashlight className="w-4 h-4" />
                  Đèn Flash
                </button>
              )}
              <button
                type="button"
                onClick={triggerAutofocus}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md border border-slate-300 bg-white text-xs font-medium hover:bg-slate-50"
              >
                <Focus className="w-4 h-4" />
                Lấy nét
              </button>
              <button
                type="button"
                onClick={() => containerRef.current?.requestFullscreen?.()}
                className="p-2 rounded-md border border-slate-300 bg-white hover:bg-slate-50"
                title="Toàn màn hình"
              >
                <Maximize2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={stopCamera}
                className="px-3 py-2 rounded-md bg-[#DC2626] text-white text-xs font-medium hover:bg-red-700"
              >
                Tắt Camera
              </button>
            </>
          )}
        </div>
      </div>

      {cameraError && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-xs text-[#DC2626] flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{cameraError}</span>
        </div>
      )}

      <div className="flex flex-wrap gap-2 text-sm" aria-live="polite">
        <span className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 font-semibold text-emerald-800">Đã lưu: {sessionCount}</span>
        <span className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 font-semibold text-amber-800">Chờ kiểm duyệt: {sessionReviewCount}</span>
        <span className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 font-semibold text-red-800">Lỗi xử lý: {sessionErrorCount}</span>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Camera Viewport */}
        <div className="lg:col-span-8 bg-slate-900 rounded-lg overflow-hidden relative min-h-[380px] flex items-center justify-center">
          <video
            ref={videoRef}
            playsInline
            muted
            className="w-full h-full object-contain max-h-[580px]"
          />
          <canvas
            ref={overlayCanvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
          />

          {!cameraActive && (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-300 p-6 text-center space-y-3">
              <Camera className="w-12 h-12 text-slate-400" />
              <div className="text-sm font-medium">Camera đang tắt</div>
              <p className="text-xs text-slate-400 max-w-md">
                Đặt phiếu thi trong khung hình để nhận diện 4 điểm định vị góc màu xanh lá. Khi ảnh rõ và ổn định, hệ thống sẽ tự động chụp và chấm ngay.
              </p>
              <button
                type="button"
                onClick={() => void startCamera()}
                disabled={opencvStatus !== 'ready'}
                className="px-4 py-2 rounded-md bg-[#2563EB] text-white text-xs font-medium hover:bg-blue-700 disabled:opacity-50"
              >
                {opencvStatus === 'ready' ? 'Mở Camera ngay' : 'Đang nạp OpenCV.js...'}
              </button>
            </div>
          )}

          {cameraActive && (
            <div className="absolute bottom-3 left-3 right-3 flex flex-wrap items-center justify-between gap-2 bg-slate-950/80 text-white px-3.5 py-2.5 rounded-md text-xs">
              <div className="flex items-center gap-3">
                <span
                  className={`font-semibold ${
                    liveDet?.fiducialsFound === 4 ? 'text-emerald-400' : 'text-amber-300'
                  }`}
                >
                  Định vị: {liveDet?.fiducialsFound ?? 0}/4
                </span>
                <span className="font-mono-num text-slate-300">
                  Nghiêng: {liveDet?.skewDeg ?? 0}°
                </span>
                {liveDet?.warning && (
                  <span className="text-amber-300">{liveDet.warning}</span>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={autoCapture}
                    onChange={(e) => setAutoCapture(e.target.checked)}
                  />
                  Tự động chụp
                </label>
                <button
                  type="button"
                  onClick={() => void captureAndGrade()}
                  disabled={processing}
                  className="px-3 py-1.5 rounded bg-[#16A34A] hover:bg-green-700 font-medium disabled:opacity-50"
                >
                  {processing ? 'Đang chấm...' : 'Chụp & chấm ngay'}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Immediate Result Panel */}
        <div className="lg:col-span-4 bg-white border border-slate-200 rounded-lg p-4 space-y-4">
          <h2 className="text-sm font-semibold text-[#1E293B] border-b border-slate-100 pb-2">
            Kết quả vừa chấm
          </h2>

          {!lastResult ? (
            <div className="py-12 text-center text-xs text-slate-500">
              Chưa có bài thi nào được chụp trong phiên này.
            </div>
          ) : (
            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Trạng thái:</span>
                {lastResult.status === 'graded' ? (
                  <span className="inline-flex items-center gap-1 font-semibold text-[#16A34A]">
                    <CheckCircle2 className="w-4 h-4" />
                    Chấm tự động thành công
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 font-semibold text-amber-600">
                    <AlertTriangle className="w-4 h-4" />
                    Chờ kiểm duyệt
                  </span>
                )}
              </div>

              <div className="grid grid-cols-2 gap-2 bg-slate-50 p-3 rounded-md border border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500">Số báo danh</div>
                  <div className="font-mono-num font-bold text-sm">{lastResult.sbd || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Mã đề</div>
                  <div className="font-mono-num font-bold text-sm">{lastResult.examCode || '—'}</div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Tổng điểm</div>
                  <div className={`font-mono-num font-extrabold text-4xl sm:text-5xl ${lastResult.status === 'graded' ? 'text-emerald-700' : 'text-amber-600'}`} aria-live="assertive">
                    {lastResult.status === 'graded' ? lastResult.scoreBreakdown.total.toLocaleString('vi-VN', { maximumFractionDigits: 2 }) : 'Chờ duyệt'}
                    {lastResult.status === 'graded' && <span className="ml-1 text-base font-medium text-slate-500">/ {lastResult.scoreBreakdown.maxPossible}</span>}
                  </div>
                </div>
                <div>
                  <div className="text-[11px] text-slate-500">Đúng / Sai / Trống</div>
                  <div className="font-mono-num font-semibold text-sm">
                    {lastResult.scoreBreakdown.correctCount} / {lastResult.scoreBreakdown.wrongCount} /{' '}
                    {lastResult.scoreBreakdown.blankCount}
                  </div>
                </div>
              </div>

              {lastResult.status === 'graded' && (
                <div role="status" className="rounded-md bg-emerald-50 border border-emerald-200 p-3 font-semibold text-emerald-800 text-sm">
                  Đã chấm và lưu trên thiết bị. {navigator.onLine ? 'Sẵn sàng đồng bộ Drive nếu đã bật.' : 'Ngoại tuyến – sẽ đồng bộ khi có mạng.'}
                </div>
              )}
              {lastResult.reviewReasons.length > 0 && (
                <div className="p-2.5 rounded bg-amber-50 border border-amber-200 text-amber-900 space-y-1">
                  <div className="font-semibold">Lý do cần kiểm duyệt:</div>
                  {lastResult.reviewReasons.map((r, i) => (
                    <div key={i}>• {r}</div>
                  ))}
                </div>
              )}

              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    lastCapturedSignatureRef.current = '';
                    sheetPresentRef.current = true;
                    void captureAndGrade();
                  }}
                  disabled={!cameraActive || processing}
                  className="flex-1 inline-flex items-center justify-center gap-1 py-2 rounded border border-slate-300 hover:bg-slate-50 font-medium disabled:opacity-50"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Chấm lại
                </button>
                <button
                  type="button"
                  onClick={() => setActivePage('review')}
                  className="flex-1 py-2 rounded bg-slate-800 text-white hover:bg-slate-900 font-medium"
                >
                  Mở kiểm duyệt
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export type OpenCVStatus = 'idle' | 'loading' | 'ready' | 'error';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    cv?: any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    Module?: any;
  }
}

let status: OpenCVStatus = 'idle';
let errorMessage: string | null = null;
let loadPromise: Promise<void> | null = null;
const listeners = new Set<(s: OpenCVStatus, err: string | null) => void>();

function notify() {
  for (const fn of listeners) fn(status, errorMessage);
}

export function getOpenCVStatus(): { status: OpenCVStatus; error: string | null } {
  return { status, error: errorMessage };
}

export function subscribeOpenCVStatus(
  fn: (s: OpenCVStatus, err: string | null) => void
): () => void {
  listeners.add(fn);
  fn(status, errorMessage);
  return () => {
    listeners.delete(fn);
  };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getCV(): any {
  if (typeof window !== 'undefined' && window.cv && typeof window.cv.Mat === 'function') {
    return window.cv;
  }
  return null;
}

export function ensureOpenCVReady(): Promise<void> {
  if (getCV()) {
    status = 'ready';
    errorMessage = null;
    notify();
    return Promise.resolve();
  }
  if (loadPromise) return loadPromise;

  status = 'loading';
  errorMessage = null;
  notify();

  loadPromise = new Promise<void>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      if (status !== 'ready') {
        status = 'error';
        errorMessage = 'Quá thời gian khởi tạo OpenCV.js WebAssembly. Vui lòng tải lại trang.';
        notify();
        reject(new Error(errorMessage));
      }
    }, 35000);

    const finalizeReady = () => {
      window.clearTimeout(timeout);
      status = 'ready';
      errorMessage = null;
      notify();
      resolve();
    };

    const waitForMat = (attempts = 0) => {
      const c = window.cv;
      if (c && typeof c.Mat === 'function') {
        finalizeReady();
        return;
      }
      if (c && typeof c.then === 'function') {
        c.then((resolved: unknown) => {
          window.cv = resolved;
          finalizeReady();
        }).catch((err: unknown) => {
          window.clearTimeout(timeout);
          status = 'error';
          errorMessage = err instanceof Error ? err.message : 'Lỗi khởi tạo OpenCV.js';
          notify();
          reject(err);
        });
        return;
      }
      if (attempts > 300) {
        window.clearTimeout(timeout);
        status = 'error';
        errorMessage = 'Không thể khởi tạo bộ máy OpenCV.js trên trình duyệt này.';
        notify();
        reject(new Error(errorMessage));
        return;
      }
      window.setTimeout(() => waitForMat(attempts + 1), 80);
    };

    const existing = document.querySelector('script[data-opencv="true"]');
    if (existing) {
      waitForMat();
      return;
    }

    const script = document.createElement('script');
    script.src = '/vendor/opencv.js';
    script.async = true;
    script.dataset.opencv = 'true';
    script.onload = () => {
      if (window.cv && typeof window.cv.Mat === 'function') {
        finalizeReady();
      } else if (window.cv) {
        const prev = window.cv.onRuntimeInitialized;
        window.cv.onRuntimeInitialized = () => {
          if (typeof prev === 'function') prev();
          finalizeReady();
        };
        waitForMat();
      } else {
        waitForMat();
      }
    };
    script.onerror = () => {
      window.clearTimeout(timeout);
      status = 'error';
      errorMessage = 'Không tải được thư viện xử lý ảnh cục bộ (/vendor/opencv.js).';
      loadPromise = null;
      notify();
      reject(new Error(errorMessage));
    };
    document.head.appendChild(script);
  });

  return loadPromise;
}

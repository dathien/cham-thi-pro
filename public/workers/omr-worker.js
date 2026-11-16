/* Classic Web Worker for off-thread OpenCV.js image pre-analysis and batch queue assistance */
let cvReady = false;
let cvInitError = null;

try {
  importScripts('/vendor/opencv.js');
  if (self.cv && typeof self.cv.Mat === 'function') {
    cvReady = true;
  } else if (self.cv) {
    self.cv.onRuntimeInitialized = function () {
      cvReady = true;
      self.postMessage({ type: 'READY' });
    };
  }
} catch (err) {
  cvInitError = err && err.message ? err.message : 'Failed to load opencv.js in worker';
}

self.onmessage = function (e) {
  const msg = e.data;
  if (!msg) return;
  if (msg.type === 'PING') {
    self.postMessage({ type: 'STATUS', ready: cvReady, error: cvInitError });
    return;
  }
  if (msg.type === 'PREPROCESS_QUALITY') {
    if (!cvReady || !self.cv) {
      self.postMessage({ id: msg.id, error: cvInitError || 'OpenCV worker not ready' });
      return;
    }
    const cv = self.cv;
    let mat = null;
    let gray = null;
    let lap = null;
    let meanMat = null;
    let stdMat = null;
    try {
      const imgData = new ImageData(new Uint8ClampedArray(msg.buffer), msg.width, msg.height);
      mat = cv.matFromImageData(imgData);
      gray = new cv.Mat();
      lap = new cv.Mat();
      meanMat = new cv.Mat();
      stdMat = new cv.Mat();
      cv.cvtColor(mat, gray, cv.COLOR_RGBA2GRAY);
      cv.meanStdDev(gray, meanMat, stdMat);
      const brightness = meanMat.data64F[0] || 0;
      cv.Laplacian(gray, lap, cv.CV_64F);
      cv.meanStdDev(lap, meanMat, stdMat);
      const lapStd = stdMat.data64F[0] || 0;
      self.postMessage({
        id: msg.id,
        brightness: Math.round(brightness * 10) / 10,
        blurScore: Math.round(lapStd * lapStd * 10) / 10,
      });
    } catch (err) {
      self.postMessage({ id: msg.id, error: err && err.message ? err.message : 'Worker error' });
    } finally {
      if (mat) mat.delete();
      if (gray) gray.delete();
      if (lap) lap.delete();
      if (meanMat) meanMat.delete();
      if (stdMat) stdMat.delete();
    }
  }
};

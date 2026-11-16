import * as pdfjsLib from 'pdfjs-dist';

let workerConfigured = false;

export function ensurePdfJsWorker() {
  if (!workerConfigured) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = '/vendor/pdf.worker.min.mjs';
    workerConfigured = true;
  }
}

export async function getPdfPageCount(file: File): Promise<{ doc: pdfjsLib.PDFDocumentProxy; numPages: number }> {
  ensurePdfJsWorker();
  const data = new Uint8Array(await file.arrayBuffer());
  const loadingTask = pdfjsLib.getDocument({ data });
  const doc = await loadingTask.promise;
  return { doc, numPages: doc.numPages };
}

export async function renderPdfPageToCanvas(
  doc: pdfjsLib.PDFDocumentProxy,
  pageNumber: number,
  scale = 2.0
): Promise<HTMLCanvasElement> {
  const page = await doc.getPage(pageNumber);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(viewport.width);
  canvas.height = Math.round(viewport.height);
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport, canvas }).promise;
  page.cleanup();
  return canvas;
}

export function releaseCanvasMemory(canvas: HTMLCanvasElement) {
  canvas.width = 1;
  canvas.height = 1;
}

export async function closePdfDocument(doc: pdfjsLib.PDFDocumentProxy | null | undefined) {
  if (!doc) return;
  try {
    await doc.cleanup?.(false);
    const maybeDestroy = (doc as unknown as { destroy?: () => Promise<void> }).destroy;
    if (typeof maybeDestroy === 'function') await maybeDestroy.call(doc);
  } catch {
    // Ignore cleanup errors
  }
}

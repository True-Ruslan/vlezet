import type { PDFDocumentProxy } from "pdfjs-dist";
import { calculateNormalizedRasterSize, ReferenceImportError } from "./reference-file";
import { normalizeDecodedImage, type NormalizedReferenceRaster } from "./raster-normalizer";

export type LoadedPdfReference = Readonly<{
  pageCount: number;
  renderPage: (pageNumber: number) => Promise<NormalizedReferenceRaster>;
  destroy: () => Promise<void>;
}>;

async function configurePdfJs() {
  const pdfjs = await import("pdfjs-dist");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = new URL("pdfjs-dist/build/pdf.worker.min.mjs", import.meta.url).toString();
  }
  return pdfjs;
}

async function renderPage(document: PDFDocumentProxy, pageNumber: number): Promise<NormalizedReferenceRaster> {
  if (!Number.isInteger(pageNumber) || pageNumber < 1 || pageNumber > document.numPages) {
    throw new ReferenceImportError("pdf-page-failed", "Выбранная страница PDF не существует.");
  }
  const page = await document.getPage(pageNumber);
  try {
    const base = page.getViewport({ scale: 1 });
    const target = calculateNormalizedRasterSize(base.width, base.height);
    const viewport = page.getViewport({ scale: target.width / base.width });
    const canvas = window.document.createElement("canvas");
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new ReferenceImportError("pdf-page-failed", "Браузер не смог подготовить страницу PDF.");
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvas, canvasContext: context, viewport, background: "#ffffff" }).promise;
    try {
      return await normalizeDecodedImage(canvas);
    } finally {
      canvas.width = 1;
      canvas.height = 1;
    }
  } catch (cause) {
    if (cause instanceof ReferenceImportError) throw cause;
    throw new ReferenceImportError("pdf-page-failed", "Не удалось прочитать выбранную страницу PDF.", { cause });
  } finally {
    page.cleanup();
  }
}

export async function loadPdfReference(bytes: ArrayBuffer): Promise<LoadedPdfReference> {
  try {
    const pdfjs = await configurePdfJs();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(bytes), isEvalSupported: false });
    const document = await loadingTask.promise;
    return {
      pageCount: document.numPages,
      renderPage: (pageNumber) => renderPage(document, pageNumber),
      destroy: async () => { await loadingTask.destroy(); },
    };
  } catch (cause) {
    if (cause instanceof ReferenceImportError) throw cause;
    throw new ReferenceImportError("pdf-load-failed", "Не удалось открыть PDF. Возможно, файл повреждён или защищён.", { cause });
  }
}

import {
  MAX_NORMALIZED_BYTES,
  ReferenceImportError,
  calculateNormalizedRasterSize,
} from "./reference-file";

export type NormalizedReferenceRaster = Readonly<{
  blob: Blob;
  mimeType: "image/png" | "image/jpeg";
  widthPx: number;
  heightPx: number;
}>;

function canvasBlob(canvas: HTMLCanvasElement, type: "image/png" | "image/jpeg", quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) resolve(blob);
      else reject(new ReferenceImportError("decode-failed", "Не удалось подготовить изображение плана."));
    }, type, quality);
  });
}

export async function normalizeDecodedImage(
  image: CanvasImageSource & Readonly<{ width: number; height: number }>,
): Promise<NormalizedReferenceRaster> {
  const size = calculateNormalizedRasterSize(image.width, image.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new ReferenceImportError("decode-failed", "Браузер не смог подготовить изображение плана.");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, size.width, size.height);
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, size.width, size.height);

  const png = await canvasBlob(canvas, "image/png");
  if (png.size <= MAX_NORMALIZED_BYTES) {
    canvas.width = 1;
    canvas.height = 1;
    return { blob: png, mimeType: "image/png", widthPx: size.width, heightPx: size.height };
  }
  const jpeg = await canvasBlob(canvas, "image/jpeg", 0.92);
  canvas.width = 1;
  canvas.height = 1;
  if (jpeg.size > MAX_NORMALIZED_BYTES) {
    throw new ReferenceImportError("normalized-asset-too-large", "Подготовленное изображение слишком большое для локального проекта.");
  }
  return { blob: jpeg, mimeType: "image/jpeg", widthPx: size.width, heightPx: size.height };
}

export async function normalizeImageFile(file: Blob): Promise<NormalizedReferenceRaster> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
  } catch (cause) {
    throw new ReferenceImportError("decode-failed", "Не удалось прочитать изображение. Попробуйте другой файл.", { cause });
  }
  try {
    return await normalizeDecodedImage(bitmap);
  } finally {
    bitmap.close();
  }
}

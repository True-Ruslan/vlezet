export const MAX_REFERENCE_INPUT_BYTES = 50 * 1024 * 1024;
export const MAX_NORMALIZED_LONGEST_EDGE = 8192;
export const MAX_NORMALIZED_PIXELS = 36_000_000;
export const MAX_NORMALIZED_BYTES = 20 * 1024 * 1024;
export const MIN_REFERENCE_SIDE = 200;

export type ReferenceFileType = "png" | "jpeg" | "pdf";
export type ReferenceImportErrorCode =
  | "unsupported-file"
  | "file-too-large"
  | "decode-failed"
  | "pdf-load-failed"
  | "pdf-page-failed"
  | "image-too-small"
  | "normalized-asset-too-large"
  | "invalid-calibration"
  | "storage-failed"
  | "asset-missing";

export class ReferenceImportError extends Error {
  readonly code: ReferenceImportErrorCode;
  constructor(code: ReferenceImportErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "ReferenceImportError";
    this.code = code;
  }
}

function startsWith(bytes: Uint8Array, signature: readonly number[]): boolean {
  return signature.every((value, index) => bytes[index] === value);
}

export function detectReferenceFileType(bytes: Uint8Array, byteLength: number): ReferenceFileType {
  if (!Number.isFinite(byteLength) || byteLength <= 0) {
    throw new ReferenceImportError("unsupported-file", "Файл пустой или повреждён.");
  }
  if (byteLength > MAX_REFERENCE_INPUT_BYTES) {
    throw new ReferenceImportError("file-too-large", "Файл слишком большой для обработки в браузере.");
  }
  if (startsWith(bytes, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])) return "png";
  if (startsWith(bytes, [0xff, 0xd8, 0xff])) return "jpeg";
  if (startsWith(bytes, [0x25, 0x50, 0x44, 0x46, 0x2d])) return "pdf";
  throw new ReferenceImportError("unsupported-file", "Этот формат не поддерживается. Загрузите JPG, PNG или PDF.");
}

export function calculateNormalizedRasterSize(width: number, height: number): Readonly<{ width: number; height: number; scale: number }> {
  if (!Number.isFinite(width) || !Number.isFinite(height) || width <= 0 || height <= 0) {
    throw new ReferenceImportError("decode-failed", "Не удалось определить размер изображения.");
  }
  if (Math.min(width, height) < MIN_REFERENCE_SIDE) {
    throw new ReferenceImportError("image-too-small", "Изображение слишком маленькое для точной обводки.");
  }
  const longestScale = Math.min(1, MAX_NORMALIZED_LONGEST_EDGE / Math.max(width, height));
  const pixelScale = Math.min(1, Math.sqrt(MAX_NORMALIZED_PIXELS / (width * height)));
  const scale = Math.min(longestScale, pixelScale);
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
    scale,
  };
}

export async function inspectReferenceFile(file: File): Promise<Readonly<{ type: ReferenceFileType; bytes: ArrayBuffer }>> {
  const bytes = await file.arrayBuffer();
  return { type: detectReferenceFileType(new Uint8Array(bytes, 0, Math.min(16, bytes.byteLength)), bytes.byteLength), bytes };
}

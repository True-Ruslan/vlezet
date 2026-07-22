const MAX_LOCAL_ANALYSIS_EDGE_PX = 2400;

async function loadBitmap(blob: Blob): Promise<ImageBitmap> {
  try {
    return await createImageBitmap(blob);
  } catch (cause) {
    throw new Error("Не удалось декодировать изображение подложки для распознавания.", { cause });
  }
}

export async function referenceBlobToAnalysisImageData(blob: Blob): Promise<ImageData> {
  const bitmap = await loadBitmap(blob);
  try {
    const scale = Math.min(1, MAX_LOCAL_ANALYSIS_EDGE_PX / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Браузер не поддерживает Canvas2D для локального распознавания.");
    context.drawImage(bitmap, 0, 0, width, height);
    return context.getImageData(0, 0, width, height);
  } finally {
    bitmap.close();
  }
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => typeof reader.result === "string"
      ? resolve(reader.result)
      : reject(new Error("Не удалось подготовить изображение для AI."));
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать изображение для AI."));
    reader.readAsDataURL(blob);
  });
}

import { ReferenceImportError } from "./reference-file";

export function parseCalibrationLength(value: string): number {
  const normalized = value.trim().toLowerCase().replace(/\s+/g, " ");
  if (!normalized) throw new ReferenceImportError("invalid-calibration", "Введите известную длину.");
  const metreMatch = normalized.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:м|m)$/);
  const millimetreMatch = normalized.match(/^([0-9]+(?:[.,][0-9]+)?)\s*(?:мм|mm)?$/);
  let millimetres: number;
  if (metreMatch) millimetres = Number(metreMatch[1]!.replace(",", ".")) * 1000;
  else if (millimetreMatch) millimetres = Number(millimetreMatch[1]!.replace(",", "."));
  else throw new ReferenceImportError("invalid-calibration", "Укажите длину в миллиметрах или метрах, например 3200 или 3,2 м.");
  if (!Number.isFinite(millimetres) || millimetres < 100 || millimetres > 100_000) {
    throw new ReferenceImportError("invalid-calibration", "Длина должна быть от 100 мм до 100 м.");
  }
  return Math.round(millimetres);
}

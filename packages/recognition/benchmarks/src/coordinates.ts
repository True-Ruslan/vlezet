import type { NormalizedPoint } from "../../src/model";
import type { BenchmarkCalibrationV1, BenchmarkPointMm } from "../schema/fixture-v1";

const KEY_PRECISION_MM = 0.1;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} должен быть конечным числом.`);
  return value;
}

function positive(value: number, label: string): number {
  const result = finite(value, label);
  if (result <= 0) throw new Error(`${label} должен быть больше нуля.`);
  return result;
}

function unit(value: number, label: string): number {
  const result = finite(value, label);
  if (result < 0 || result > 1) throw new Error(`${label} должен быть от 0 до 1.`);
  return result;
}

function keyNumber(value: number): string {
  const rounded = Math.round(finite(value, "Координата ключа") / KEY_PRECISION_MM) * KEY_PRECISION_MM;
  const normalized = Object.is(rounded, -0) || Math.abs(rounded) < KEY_PRECISION_MM / 2 ? 0 : rounded;
  return normalized.toFixed(1);
}

export function normalizedPointToReferenceMm(
  point: NormalizedPoint,
  calibration: BenchmarkCalibrationV1,
): BenchmarkPointMm {
  const x = unit(point.x, "point.x");
  const y = unit(point.y, "point.y");
  const sourceWidthPx = positive(calibration.sourceWidthPx, "calibration.sourceWidthPx");
  const sourceHeightPx = positive(calibration.sourceHeightPx, "calibration.sourceHeightPx");
  const millimetersPerPixel = positive(calibration.millimetersPerPixel, "calibration.millimetersPerPixel");
  const originX = finite(calibration.originPx.x, "calibration.originPx.x");
  const originY = finite(calibration.originPx.y, "calibration.originPx.y");
  return {
    x: (x * sourceWidthPx - originX) * millimetersPerPixel,
    y: (y * sourceHeightPx - originY) * millimetersPerPixel,
  };
}

export function stablePointKey(point: BenchmarkPointMm): string {
  return `${keyNumber(point.x)},${keyNumber(point.y)}`;
}

export function stableSegmentKey(start: BenchmarkPointMm, end: BenchmarkPointMm): string {
  const keys = [stablePointKey(start), stablePointKey(end)].sort((first, second) => first.localeCompare(second));
  return `${keys[0]}→${keys[1]}`;
}

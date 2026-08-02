import type { DetectedLineSegment } from "./local-lines";

export type ArchitecturalLineOrientation = "horizontal" | "vertical" | "diagonal";

export type ArchitecturalLineOptions = Readonly<{
  minimumSegmentLengthPx: number;
  axisToleranceDeg: number;
  duplicateEndpointTolerancePx: number;
  borderMarginPx: number;
  borderSpanRatio: number;
}>;

export type NormalisedLineSegment = Readonly<{
  start: Readonly<{ x: number; y: number }>;
  end: Readonly<{ x: number; y: number }>;
  lengthPx: number;
  angleDeg: number;
  orientation: ArchitecturalLineOrientation;
  sourceCount: number;
}>;

type Point = Readonly<{ x: number; y: number }>;

type SegmentAccumulator = {
  startX: number;
  startY: number;
  endX: number;
  endY: number;
  sourceCount: number;
};

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным конечным числом.`);
  }
  return value;
}

function finiteNonNegative(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error(`${label} должен быть неотрицательным конечным числом.`);
  }
  return value;
}

function finiteRatio(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0 || value > 1) {
    throw new Error(`${label} должна быть больше 0 и не больше 1.`);
  }
  return value;
}

function canonicalEndpoints(segment: DetectedLineSegment): Readonly<{ start: Point; end: Point }> | null {
  if (![segment.x1, segment.y1, segment.x2, segment.y2].every(Number.isFinite)) return null;
  const first = { x: segment.x1, y: segment.y1 };
  const second = { x: segment.x2, y: segment.y2 };
  if (first.x < second.x || (first.x === second.x && first.y <= second.y)) {
    return { start: first, end: second };
  }
  return { start: second, end: first };
}

function segmentLength(start: Point, end: Point): number {
  return Math.hypot(end.x - start.x, end.y - start.y);
}

function directionIndependentAngleDeg(start: Point, end: Point): number {
  const raw = ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
  return Math.abs(raw - 180) < 1e-9 ? 0 : raw;
}

function orientationForAngle(angleDeg: number, toleranceDeg: number): ArchitecturalLineOrientation {
  const horizontalDelta = Math.min(Math.abs(angleDeg), Math.abs(180 - angleDeg));
  if (horizontalDelta <= toleranceDeg) return "horizontal";
  if (Math.abs(angleDeg - 90) <= toleranceDeg) return "vertical";
  return "diagonal";
}

function isBorderArtifact(input: Readonly<{
  start: Point;
  end: Point;
  orientation: ArchitecturalLineOrientation;
  widthPx: number;
  heightPx: number;
  borderMarginPx: number;
  borderSpanRatio: number;
}>): boolean {
  if (input.orientation === "horizontal") {
    const y = (input.start.y + input.end.y) / 2;
    const nearBorder = y <= input.borderMarginPx || y >= input.heightPx - input.borderMarginPx;
    const span = Math.abs(input.end.x - input.start.x) / input.widthPx;
    return nearBorder && span >= input.borderSpanRatio;
  }
  if (input.orientation === "vertical") {
    const x = (input.start.x + input.end.x) / 2;
    const nearBorder = x <= input.borderMarginPx || x >= input.widthPx - input.borderMarginPx;
    const span = Math.abs(input.end.y - input.start.y) / input.heightPx;
    return nearBorder && span >= input.borderSpanRatio;
  }
  return false;
}

function quantize(value: number, tolerance: number): number {
  return Math.round(value / tolerance);
}

function duplicateKey(start: Point, end: Point, orientation: ArchitecturalLineOrientation, tolerance: number): string {
  return [
    orientation,
    quantize(start.x, tolerance),
    quantize(start.y, tolerance),
    quantize(end.x, tolerance),
    quantize(end.y, tolerance),
  ].join(":");
}

const ORIENTATION_ORDER: Readonly<Record<ArchitecturalLineOrientation, number>> = Object.freeze({
  horizontal: 0,
  vertical: 1,
  diagonal: 2,
});

function compareNumber(first: number, second: number): number {
  return Math.abs(first - second) < 1e-9 ? 0 : first - second;
}

export function normaliseArchitecturalLineSegments(input: Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
  options: ArchitecturalLineOptions;
}>): readonly NormalisedLineSegment[] {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const minimumSegmentLengthPx = finitePositive(
    input.options.minimumSegmentLengthPx,
    "Минимальная длина сегмента",
  );
  const axisToleranceDeg = finiteNonNegative(input.options.axisToleranceDeg, "Допуск направления");
  if (axisToleranceDeg > 45) throw new Error("Допуск направления не должен превышать 45°.");
  const duplicateEndpointTolerancePx = finitePositive(
    input.options.duplicateEndpointTolerancePx,
    "Допуск дубликатов",
  );
  const borderMarginPx = finiteNonNegative(input.options.borderMarginPx, "Отступ рамки");
  const borderSpanRatio = finiteRatio(input.options.borderSpanRatio, "Доля рамки");

  const grouped = new Map<string, SegmentAccumulator>();

  for (const raw of input.segments) {
    const canonical = canonicalEndpoints(raw);
    if (!canonical) continue;
    const lengthPx = segmentLength(canonical.start, canonical.end);
    if (lengthPx < minimumSegmentLengthPx) continue;
    const angleDeg = directionIndependentAngleDeg(canonical.start, canonical.end);
    const orientation = orientationForAngle(angleDeg, axisToleranceDeg);
    if (isBorderArtifact({
      ...canonical,
      orientation,
      widthPx,
      heightPx,
      borderMarginPx,
      borderSpanRatio,
    })) continue;

    const key = duplicateKey(canonical.start, canonical.end, orientation, duplicateEndpointTolerancePx);
    const existing = grouped.get(key);
    if (existing) {
      existing.startX += canonical.start.x;
      existing.startY += canonical.start.y;
      existing.endX += canonical.end.x;
      existing.endY += canonical.end.y;
      existing.sourceCount += 1;
    } else {
      grouped.set(key, {
        startX: canonical.start.x,
        startY: canonical.start.y,
        endX: canonical.end.x,
        endY: canonical.end.y,
        sourceCount: 1,
      });
    }
  }

  return [...grouped.values()]
    .map((group): NormalisedLineSegment => {
      const start = { x: group.startX / group.sourceCount, y: group.startY / group.sourceCount };
      const end = { x: group.endX / group.sourceCount, y: group.endY / group.sourceCount };
      const angleDeg = directionIndependentAngleDeg(start, end);
      return {
        start,
        end,
        lengthPx: segmentLength(start, end),
        angleDeg,
        orientation: orientationForAngle(angleDeg, axisToleranceDeg),
        sourceCount: group.sourceCount,
      };
    })
    .sort((first, second) =>
      ORIENTATION_ORDER[first.orientation] - ORIENTATION_ORDER[second.orientation]
      || compareNumber(first.start.x, second.start.x)
      || compareNumber(first.start.y, second.start.y)
      || compareNumber(first.end.x, second.end.x)
      || compareNumber(first.end.y, second.end.y));
}

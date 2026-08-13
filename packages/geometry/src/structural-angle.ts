import type { Point2 } from "./point";

const FULL_TURN_DEG = 360;
const TRIG_ZERO_EPSILON = 1e-12;

function assertFinitePoint(point: Point2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new RangeError("Point coordinates must be finite");
  }
}

export function normalizeCanvasAngleDeg(angleDeg: number): number {
  if (!Number.isFinite(angleDeg)) {
    throw new RangeError("Angle must be finite");
  }
  const normalized = ((angleDeg % FULL_TURN_DEG) + FULL_TURN_DEG) % FULL_TURN_DEG;
  return Object.is(normalized, -0) ? 0 : normalized;
}

export function vectorToCanvasAngleDeg(start: Point2, end: Point2): number {
  assertFinitePoint(start);
  assertFinitePoint(end);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  if (dx === 0 && dy === 0) {
    throw new RangeError("A zero vector has no direction");
  }
  return normalizeCanvasAngleDeg(Math.atan2(dy, dx) * 180 / Math.PI);
}

export function pointFromCanvasPolar(
  start: Point2,
  lengthMm: number,
  angleDeg: number,
): Point2 {
  assertFinitePoint(start);
  if (!Number.isFinite(lengthMm) || lengthMm <= 0) {
    throw new RangeError("Length must be a positive finite number");
  }
  const radians = normalizeCanvasAngleDeg(angleDeg) * Math.PI / 180;
  const rawCos = Math.cos(radians);
  const rawSin = Math.sin(radians);
  const unitX = Math.abs(rawCos) <= TRIG_ZERO_EPSILON ? 0 : rawCos;
  const unitY = Math.abs(rawSin) <= TRIG_ZERO_EPSILON ? 0 : rawSin;
  return {
    x: start.x + unitX * lengthMm,
    y: start.y + unitY * lengthMm,
  };
}

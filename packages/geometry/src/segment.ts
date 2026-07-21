import { distanceBetween, type Point2 } from "./point";

export const GEOMETRY_EPSILON_MM = 1e-6;

export type SegmentProjection = Readonly<{
  point: Point2;
  t: number;
  distance: number;
}>;

export function projectPointToSegment(point: Point2, start: Point2, end: Point2): SegmentProjection {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared <= GEOMETRY_EPSILON_MM * GEOMETRY_EPSILON_MM) {
    return { point: start, t: 0, distance: distanceBetween(point, start) };
  }

  const unclampedT = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  const t = Math.max(0, Math.min(1, unclampedT));
  const projected = { x: start.x + dx * t, y: start.y + dy * t };
  return { point: projected, t, distance: distanceBetween(point, projected) };
}

export function pointOnSegment(
  point: Point2,
  start: Point2,
  end: Point2,
  tolerance: number = GEOMETRY_EPSILON_MM,
): boolean {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= tolerance * tolerance) return distanceBetween(point, start) <= tolerance;

  const t = ((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared;
  if (t < -tolerance || t > 1 + tolerance) return false;

  const projection = { x: start.x + dx * t, y: start.y + dy * t };
  return distanceBetween(point, projection) <= tolerance;
}

export type SegmentIntersection = Readonly<{
  point: Point2;
  t: number;
  u: number;
}>;

function cross(ax: number, ay: number, bx: number, by: number): number {
  return ax * by - ay * bx;
}

export function segmentIntersection(
  aStart: Point2,
  aEnd: Point2,
  bStart: Point2,
  bEnd: Point2,
  tolerance: number = GEOMETRY_EPSILON_MM,
): SegmentIntersection | null {
  const rx = aEnd.x - aStart.x;
  const ry = aEnd.y - aStart.y;
  const sx = bEnd.x - bStart.x;
  const sy = bEnd.y - bStart.y;
  const denominator = cross(rx, ry, sx, sy);
  if (Math.abs(denominator) <= tolerance) return null;

  const qpx = bStart.x - aStart.x;
  const qpy = bStart.y - aStart.y;
  const t = cross(qpx, qpy, sx, sy) / denominator;
  const u = cross(qpx, qpy, rx, ry) / denominator;

  if (t < -tolerance || t > 1 + tolerance || u < -tolerance || u > 1 + tolerance) return null;

  return {
    point: { x: aStart.x + rx * t, y: aStart.y + ry * t },
    t,
    u,
  };
}

export function isProperInteriorIntersection(
  intersection: SegmentIntersection,
  tolerance: number = GEOMETRY_EPSILON_MM,
): boolean {
  return (
    intersection.t > tolerance &&
    intersection.t < 1 - tolerance &&
    intersection.u > tolerance &&
    intersection.u < 1 - tolerance
  );
}

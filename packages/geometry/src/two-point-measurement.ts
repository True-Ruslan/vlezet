import type { Point2 } from "./point";

export type TwoPointMeasurement = Readonly<{
  distanceMm: number;
  deltaXmm: number;
  deltaYmm: number;
}>;

export function measureBetweenPoints(start: Point2, end: Point2): TwoPointMeasurement {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  return {
    distanceMm: Math.hypot(dx, dy),
    deltaXmm: Math.abs(dx),
    deltaYmm: Math.abs(dy),
  };
}

export type Point2 = Readonly<{
  x: number;
  y: number;
}>;

export function distanceBetween(a: Point2, b: Point2): number {
  return Math.hypot(b.x - a.x, b.y - a.y);
}

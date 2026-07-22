import type { DerivedRoom } from "./rooms";
import { GEOMETRY_EPSILON_MM } from "./segment";

export type RectangularRoomDimensions = Readonly<{
  widthMm: number;
  heightMm: number;
}>;

function approximatelyEqual(first: number, second: number): boolean {
  return Math.abs(first - second) <= GEOMETRY_EPSILON_MM;
}

export function deriveRectangularRoomDimensions(room: DerivedRoom): RectangularRoomDimensions | null {
  if (room.polygon.length !== 4) return null;

  let horizontalEdges = 0;
  let verticalEdges = 0;
  for (let index = 0; index < room.polygon.length; index += 1) {
    const current = room.polygon[index]!;
    const next = room.polygon[(index + 1) % room.polygon.length]!;
    const horizontal = approximatelyEqual(current.y, next.y) && !approximatelyEqual(current.x, next.x);
    const vertical = approximatelyEqual(current.x, next.x) && !approximatelyEqual(current.y, next.y);
    if (!horizontal && !vertical) return null;
    if (horizontal) horizontalEdges += 1;
    if (vertical) verticalEdges += 1;
  }
  if (horizontalEdges !== 2 || verticalEdges !== 2) return null;

  const xs = room.polygon.map((point) => point.x);
  const ys = room.polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const widthMm = maxX - minX;
  const heightMm = maxY - minY;
  if (widthMm <= GEOMETRY_EPSILON_MM || heightMm <= GEOMETRY_EPSILON_MM) return null;

  for (const point of room.polygon) {
    const onXBoundary = approximatelyEqual(point.x, minX) || approximatelyEqual(point.x, maxX);
    const onYBoundary = approximatelyEqual(point.y, minY) || approximatelyEqual(point.y, maxY);
    if (!onXBoundary || !onYBoundary) return null;
  }

  return { widthMm, heightMm };
}

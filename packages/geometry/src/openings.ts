import type { Point2 } from "./point";
import { topologyVertexMap, type TopologyDocumentLike } from "./topology";

export type OpeningLike = Readonly<{
  id: string;
  wallId: string;
  kind: "door" | "window";
  offset: number;
  width: number;
}>;

export type OpeningDocumentLike = TopologyDocumentLike & Readonly<{
  openings: readonly OpeningLike[];
}>;

export type WallInterval = Readonly<{
  startOffset: number;
  endOffset: number;
}>;

export type OpeningWorldSegment = Readonly<{
  start: Point2;
  end: Point2;
  tangent: Point2;
  leftNormal: Point2;
  wallLength: number;
}>;

function cleanZero(value: number): number {
  return Object.is(value, -0) ? 0 : value;
}

function wallGeometry(document: TopologyDocumentLike, wallId: string) {
  const wall = document.walls.find((candidate) => candidate.id === wallId);
  if (!wall) throw new Error(`Wall does not exist: ${wallId}`);
  const vertices = topologyVertexMap(document);
  const start = vertices.get(wall.startVertexId);
  const end = vertices.get(wall.endVertexId);
  if (!start || !end) throw new Error(`Wall ${wallId} references a missing endpoint vertex`);
  const dx = end.position.x - start.position.x;
  const dy = end.position.y - start.position.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= 0) throw new Error(`Wall ${wallId} has invalid length`);
  return {
    wall,
    start: start.position,
    end: end.position,
    length,
    tangent: { x: cleanZero(dx / length), y: cleanZero(dy / length) },
  };
}

export function pointAtWallOffset(document: TopologyDocumentLike, wallId: string, offset: number): Point2 {
  const geometry = wallGeometry(document, wallId);
  return {
    x: cleanZero(geometry.start.x + geometry.tangent.x * offset),
    y: cleanZero(geometry.start.y + geometry.tangent.y * offset),
  };
}

export function openingSegment(document: OpeningDocumentLike, opening: OpeningLike): OpeningWorldSegment {
  const geometry = wallGeometry(document, opening.wallId);
  return {
    start: pointAtWallOffset(document, opening.wallId, opening.offset),
    end: pointAtWallOffset(document, opening.wallId, opening.offset + opening.width),
    tangent: geometry.tangent,
    leftNormal: { x: cleanZero(-geometry.tangent.y), y: cleanZero(geometry.tangent.x) },
    wallLength: geometry.length,
  };
}

export function deriveVisibleWallIntervals(document: OpeningDocumentLike, wallId: string): WallInterval[] {
  const { length } = wallGeometry(document, wallId);
  const openings = document.openings
    .filter((opening) => opening.wallId === wallId)
    .map((opening) => ({ start: opening.offset, end: opening.offset + opening.width }))
    .sort((a, b) => a.start - b.start || a.end - b.end);

  const intervals: WallInterval[] = [];
  let cursor = 0;
  for (const opening of openings) {
    const start = Math.max(0, Math.min(length, opening.start));
    const end = Math.max(0, Math.min(length, opening.end));
    if (start > cursor) intervals.push({ startOffset: cursor, endOffset: start });
    cursor = Math.max(cursor, end);
  }
  if (cursor < length) intervals.push({ startOffset: cursor, endOffset: length });
  return intervals.filter((interval) => interval.endOffset > interval.startOffset);
}

export function proposeOpeningPlacement(
  document: TopologyDocumentLike,
  wallId: string,
  pointerOffset: number,
  width: number,
): Readonly<{ offset: number; width: number }> {
  const { length } = wallGeometry(document, wallId);
  if (!Number.isFinite(width) || width <= 0 || width > length) throw new RangeError("Opening width must fit the wall");
  if (!Number.isFinite(pointerOffset)) throw new RangeError("Opening placement offset must be finite");
  const offset = Math.max(0, Math.min(length - width, pointerOffset - width / 2));
  return { offset: cleanZero(offset), width };
}

export function projectPointToWallOffset(document: TopologyDocumentLike, wallId: string, point: Point2): number {
  const geometry = wallGeometry(document, wallId);
  return cleanZero((point.x - geometry.start.x) * geometry.tangent.x + (point.y - geometry.start.y) * geometry.tangent.y);
}

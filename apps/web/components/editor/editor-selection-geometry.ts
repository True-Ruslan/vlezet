import {
  getWallEndpoints,
  type Opening,
  type PlacedObject,
  type Point2,
  type VlezetDocument,
  type Wall,
} from "@vlezet/domain";
import {
  deriveRooms,
  deriveVisibleWallIntervals,
  objectRectangle,
  openingSegment,
  orientedRectangleCorners,
  pointAtWallOffset,
  pointInPolygon,
} from "@vlezet/geometry";
import type { EditorEntityRef, EditorSelection } from "./editor-selection";

export type WorldRect = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

type ConcretePointHitEntityRef =
  | Readonly<{ kind: "opening"; id: string }>
  | Readonly<{ kind: "placed-object"; id: string }>
  | Readonly<{ kind: "wall"; id: string }>;

export type PointHitEntityRef =
  | ConcretePointHitEntityRef
  | Readonly<{ kind: "room"; id: string }>;

const EPSILON = 1e-6;

function normalizedRect(rect: WorldRect): WorldRect {
  return {
    minX: Math.min(rect.minX, rect.maxX),
    minY: Math.min(rect.minY, rect.maxY),
    maxX: Math.max(rect.minX, rect.maxX),
    maxY: Math.max(rect.minY, rect.maxY),
  };
}

function boundsFromPoints(points: readonly Point2[]): WorldRect | null {
  if (points.length === 0) return null;
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) return null;
    minX = Math.min(minX, point.x);
    minY = Math.min(minY, point.y);
    maxX = Math.max(maxX, point.x);
    maxY = Math.max(maxY, point.y);
  }
  return { minX, minY, maxX, maxY };
}

function unionBounds(first: WorldRect | null, second: WorldRect | null): WorldRect | null {
  if (!first) return second;
  if (!second) return first;
  return {
    minX: Math.min(first.minX, second.minX),
    minY: Math.min(first.minY, second.minY),
    maxX: Math.max(first.maxX, second.maxX),
    maxY: Math.max(first.maxY, second.maxY),
  };
}

function wallBandPolygon(start: Point2, end: Point2, thickness: number): readonly Point2[] | null {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= EPSILON || !Number.isFinite(thickness) || thickness <= 0) {
    return null;
  }
  const half = thickness / 2;
  const normal = { x: -dy / length, y: dx / length };
  const offset = { x: normal.x * half, y: normal.y * half };
  return [
    { x: start.x + offset.x, y: start.y + offset.y },
    { x: end.x + offset.x, y: end.y + offset.y },
    { x: end.x - offset.x, y: end.y - offset.y },
    { x: start.x - offset.x, y: start.y - offset.y },
  ];
}

function visibleWallPolygons(document: VlezetDocument, wall: Wall): readonly (readonly Point2[])[] {
  return deriveVisibleWallIntervals(document, wall.id).flatMap((interval) => {
    const polygon = wallBandPolygon(
      pointAtWallOffset(document, wall.id, interval.startOffset),
      pointAtWallOffset(document, wall.id, interval.endOffset),
      wall.thickness,
    );
    return polygon ? [polygon] : [];
  });
}

function openingBandPolygon(document: VlezetDocument, opening: Opening): readonly Point2[] | null {
  const wall = document.walls.find((candidate) => candidate.id === opening.wallId);
  if (!wall) return null;
  const segment = openingSegment(document, opening);
  return wallBandPolygon(segment.start, segment.end, wall.thickness);
}

function objectPolygon(object: PlacedObject): readonly Point2[] {
  return orientedRectangleCorners(objectRectangle(object));
}

function project(points: readonly Point2[], axis: Point2): Readonly<{ min: number; max: number }> {
  let min = Number.POSITIVE_INFINITY;
  let max = Number.NEGATIVE_INFINITY;
  for (const point of points) {
    const value = point.x * axis.x + point.y * axis.y;
    min = Math.min(min, value);
    max = Math.max(max, value);
  }
  return { min, max };
}

function intervalsOverlap(
  first: Readonly<{ min: number; max: number }>,
  second: Readonly<{ min: number; max: number }>,
): boolean {
  return first.max >= second.min - EPSILON && second.max >= first.min - EPSILON;
}

function rectPolygon(rect: WorldRect): readonly Point2[] {
  const normalized = normalizedRect(rect);
  return [
    { x: normalized.minX, y: normalized.minY },
    { x: normalized.maxX, y: normalized.minY },
    { x: normalized.maxX, y: normalized.maxY },
    { x: normalized.minX, y: normalized.maxY },
  ];
}

function polygonIntersectsRect(polygon: readonly Point2[], rect: WorldRect): boolean {
  if (polygon.length < 3) return false;
  const normalized = normalizedRect(rect);
  const polygonBounds = boundsFromPoints(polygon);
  if (!polygonBounds ||
      polygonBounds.maxX < normalized.minX - EPSILON ||
      polygonBounds.minX > normalized.maxX + EPSILON ||
      polygonBounds.maxY < normalized.minY - EPSILON ||
      polygonBounds.minY > normalized.maxY + EPSILON) {
    return false;
  }

  const marqueePolygon = rectPolygon(normalized);
  const axes: Point2[] = [
    { x: 1, y: 0 },
    { x: 0, y: 1 },
  ];
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]!;
    const end = polygon[(index + 1) % polygon.length]!;
    const edge = { x: end.x - start.x, y: end.y - start.y };
    if (Math.hypot(edge.x, edge.y) <= EPSILON) continue;
    axes.push({ x: -edge.y, y: edge.x });
  }

  return axes.every((axis) => intervalsOverlap(project(polygon, axis), project(marqueePolygon, axis)));
}

function polygonFullyInsideRect(polygon: readonly Point2[], rect: WorldRect): boolean {
  if (polygon.length < 3) return false;
  const normalized = normalizedRect(rect);
  return polygon.every((point) =>
    point.x >= normalized.minX - EPSILON &&
    point.x <= normalized.maxX + EPSILON &&
    point.y >= normalized.minY - EPSILON &&
    point.y <= normalized.maxY + EPSILON
  );
}

function boundsForWall(document: VlezetDocument, wall: Wall): WorldRect | null {
  let bounds: WorldRect | null = null;
  for (const polygon of visibleWallPolygons(document, wall)) {
    bounds = unionBounds(bounds, boundsFromPoints(polygon));
  }
  return bounds;
}

export function deriveEntityWorldBounds(
  document: VlezetDocument,
  ref: EditorEntityRef,
): WorldRect | null {
  if (ref.kind === "placed-object") {
    const object = document.placedObjects.find((candidate) => candidate.id === ref.id);
    return object ? boundsFromPoints(objectPolygon(object)) : null;
  }

  if (ref.kind === "opening") {
    const opening = document.openings.find((candidate) => candidate.id === ref.id);
    if (!opening) return null;
    const polygon = openingBandPolygon(document, opening);
    return polygon ? boundsFromPoints(polygon) : null;
  }

  if (ref.kind === "wall") {
    const wall = document.walls.find((candidate) => candidate.id === ref.id);
    return wall ? boundsForWall(document, wall) : null;
  }

  if (ref.kind === "room") {
    const room = deriveRooms(document).rooms.find((candidate) => candidate.id === ref.id);
    return room ? boundsFromPoints(room.polygon) : null;
  }

  return null;
}

export function deriveSelectionWorldBounds(
  document: VlezetDocument,
  selection: EditorSelection,
): WorldRect | null {
  let bounds: WorldRect | null = null;
  for (const ref of selection.refs) {
    bounds = unionBounds(bounds, deriveEntityWorldBounds(document, ref));
  }
  return bounds;
}

function concreteEntitiesIntersectingRect(
  document: VlezetDocument,
  rect: WorldRect,
): readonly ConcretePointHitEntityRef[] {
  const result: ConcretePointHitEntityRef[] = [];

  for (const opening of document.openings) {
    const polygon = openingBandPolygon(document, opening);
    if (polygon && polygonIntersectsRect(polygon, rect)) {
      result.push({ kind: "opening", id: opening.id });
    }
  }

  for (const object of document.placedObjects) {
    if (polygonIntersectsRect(objectPolygon(object), rect)) {
      result.push({ kind: "placed-object", id: object.id });
    }
  }

  for (const wall of document.walls) {
    if (visibleWallPolygons(document, wall).some((polygon) => polygonIntersectsRect(polygon, rect))) {
      result.push({ kind: "wall", id: wall.id });
    }
  }

  return result;
}

export function entitiesAtPoint(
  document: VlezetDocument,
  point: Point2,
): readonly PointHitEntityRef[] {
  const pointRect: WorldRect = {
    minX: point.x,
    minY: point.y,
    maxX: point.x,
    maxY: point.y,
  };
  const result: PointHitEntityRef[] = [...concreteEntitiesIntersectingRect(document, pointRect)];
  const roomHits = deriveRooms(document).rooms
    .filter((room) => pointInPolygon(point, room.polygon))
    .sort((first, second) => first.areaMm2 - second.areaMm2);

  for (const room of roomHits) {
    result.push({ kind: "room", id: room.id });
  }

  return result;
}

export function entitiesIntersectingMarquee(
  document: VlezetDocument,
  marquee: WorldRect,
): readonly EditorEntityRef[] {
  const normalized = normalizedRect(marquee);
  if (Math.abs(normalized.maxX - normalized.minX) <= EPSILON &&
      Math.abs(normalized.maxY - normalized.minY) <= EPSILON) {
    return entitiesAtPoint(document, { x: normalized.minX, y: normalized.minY });
  }

  const concreteHits = concreteEntitiesIntersectingRect(document, normalized);
  const enclosedRooms = deriveRooms(document).rooms
    .filter((room) => polygonFullyInsideRect(room.polygon, normalized));
  if (enclosedRooms.length === 0) return concreteHits;

  return [
    ...enclosedRooms.map((room) => ({ kind: "room" as const, id: room.id })),
    ...concreteHits.filter((ref) => ref.kind === "placed-object"),
  ];
}

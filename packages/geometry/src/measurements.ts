import {
  doorSwingPolygon,
  evaluateObjectFits,
  objectRectangle,
  type FitDocumentLike,
} from "./fit";
import {
  localToWorld,
  orientedRectangleAxes,
  orientedRectangleEdges,
} from "./oriented-rectangle";
import type { Point2 } from "./point";
import { deriveRooms } from "./rooms";
import { GEOMETRY_EPSILON_MM } from "./segment";

export type DirectionalClearances = Readonly<{
  front: number | null;
  right: number | null;
  back: number | null;
  left: number | null;
}>;

type Segment = Readonly<{ start: Point2; end: Point2 }>;

function cross(first: Point2, second: Point2): number {
  return first.x * second.y - first.y * second.x;
}

function subtract(first: Point2, second: Point2): Point2 {
  return { x: first.x - second.x, y: first.y - second.y };
}

function scale(vector: Point2, factor: number): Point2 {
  return { x: vector.x * factor, y: vector.y * factor };
}

function polygonSegments(polygon: readonly Point2[]): Segment[] {
  return polygon.map((start, index) => ({ start, end: polygon[(index + 1) % polygon.length]! }));
}

function raySegmentDistance(origin: Point2, direction: Point2, segment: Segment): number | null {
  const segmentVector = subtract(segment.end, segment.start);
  const denominator = cross(direction, segmentVector);
  const offset = subtract(segment.start, origin);

  if (Math.abs(denominator) <= GEOMETRY_EPSILON_MM) return null;

  const rayT = cross(offset, segmentVector) / denominator;
  const segmentT = cross(offset, direction) / denominator;
  if (rayT < -GEOMETRY_EPSILON_MM) return null;
  if (segmentT < -GEOMETRY_EPSILON_MM || segmentT > 1 + GEOMETRY_EPSILON_MM) return null;
  return Math.max(0, rayT);
}

function nearestRayDistance(origin: Point2, direction: Point2, obstacles: readonly Segment[]): number | null {
  let minimum = Number.POSITIVE_INFINITY;
  for (const obstacle of obstacles) {
    const distance = raySegmentDistance(origin, direction, obstacle);
    if (distance === null) continue;
    minimum = Math.min(minimum, distance);
  }
  return Number.isFinite(minimum) ? minimum : null;
}

function measureSide(
  sampleOrigins: readonly Point2[],
  direction: Point2,
  obstacles: readonly Segment[],
): number | null {
  let minimum = Number.POSITIVE_INFINITY;
  for (const origin of sampleOrigins) {
    const distance = nearestRayDistance(origin, direction, obstacles);
    if (distance === null) continue;
    minimum = Math.min(minimum, distance);
  }
  return Number.isFinite(minimum) ? minimum : null;
}

function sideSamples(
  object: FitDocumentLike["placedObjects"][number],
): Readonly<{
  front: readonly Point2[];
  right: readonly Point2[];
  back: readonly Point2[];
  left: readonly Point2[];
  directions: Readonly<{ front: Point2; right: Point2; back: Point2; left: Point2 }>;
}> {
  const rectangle = objectRectangle(object);
  const quarterWidth = object.width / 4;
  const quarterDepth = object.depth / 4;
  const halfWidth = object.width / 2;
  const halfDepth = object.depth / 2;
  const { widthAxis, depthAxis } = orientedRectangleAxes(rectangle);

  return {
    front: [-quarterWidth, 0, quarterWidth].map((x) => localToWorld(rectangle, { x, y: halfDepth })),
    right: [-quarterDepth, 0, quarterDepth].map((y) => localToWorld(rectangle, { x: halfWidth, y })),
    back: [-quarterWidth, 0, quarterWidth].map((x) => localToWorld(rectangle, { x, y: -halfDepth })),
    left: [-quarterDepth, 0, quarterDepth].map((y) => localToWorld(rectangle, { x: -halfWidth, y })),
    directions: {
      front: depthAxis,
      right: widthAxis,
      back: scale(depthAxis, -1),
      left: scale(widthAxis, -1),
    },
  };
}

export function measureObjectClearances(
  document: FitDocumentLike,
  objectId: string,
): DirectionalClearances {
  const object = document.placedObjects.find((candidate) => candidate.id === objectId);
  if (!object) throw new Error(`Placed object is missing: ${objectId}`);

  const fit = evaluateObjectFits(document).byObjectId.get(objectId);
  const roomId = fit?.roomId;
  if (!roomId) return { front: null, right: null, back: null, left: null };

  const room = deriveRooms(document).rooms.find((candidate) => candidate.id === roomId);
  if (!room) return { front: null, right: null, back: null, left: null };

  const obstacles: Segment[] = [...polygonSegments(room.polygon)];

  for (const other of document.placedObjects) {
    if (other.id === objectId) continue;
    obstacles.push(...orientedRectangleEdges(objectRectangle(other)));
  }

  for (const opening of document.openings) {
    if (opening.kind !== "door") continue;
    obstacles.push(...polygonSegments(doorSwingPolygon(document, opening)));
  }

  const samples = sideSamples(object);
  return {
    front: measureSide(samples.front, samples.directions.front, obstacles),
    right: measureSide(samples.right, samples.directions.right, obstacles),
    back: measureSide(samples.back, samples.directions.back, obstacles),
    left: measureSide(samples.left, samples.directions.left, obstacles),
  };
}

import type { Point2 } from "./point";
import {
  orientedRectangleEdges,
  orientedRectanglesIntersect,
  type OrientedRectangle,
} from "./oriented-rectangle";
import { GEOMETRY_EPSILON_MM } from "./segment";

type Segment = Readonly<{ start: Point2; end: Point2 }>;

function pointToSegmentDistance(point: Point2, segment: Segment): number {
  const dx = segment.end.x - segment.start.x;
  const dy = segment.end.y - segment.start.y;
  const lengthSquared = dx * dx + dy * dy;

  if (lengthSquared === 0) {
    return Math.hypot(point.x - segment.start.x, point.y - segment.start.y);
  }

  const t = Math.max(
    0,
    Math.min(
      1,
      ((point.x - segment.start.x) * dx + (point.y - segment.start.y) * dy) / lengthSquared,
    ),
  );

  return Math.hypot(
    point.x - (segment.start.x + t * dx),
    point.y - (segment.start.y + t * dy),
  );
}

function segmentDistance(first: Segment, second: Segment): number {
  return Math.min(
    pointToSegmentDistance(first.start, second),
    pointToSegmentDistance(first.end, second),
    pointToSegmentDistance(second.start, first),
    pointToSegmentDistance(second.end, first),
  );
}

export function minimumDistanceBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): number {
  if (orientedRectanglesIntersect(first, second)) return 0;

  let minimum = Number.POSITIVE_INFINITY;
  for (const firstEdge of orientedRectangleEdges(first)) {
    for (const secondEdge of orientedRectangleEdges(second)) {
      minimum = Math.min(minimum, segmentDistance(firstEdge, secondEdge));
    }
  }

  return minimum <= GEOMETRY_EPSILON_MM ? 0 : minimum;
}

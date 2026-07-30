import type { Point2 } from "./point";
import {
  orientedRectangleEdges,
  orientedRectanglesIntersect,
  type OrientedRectangle,
} from "./oriented-rectangle";
import {
  GEOMETRY_EPSILON_MM,
  projectPointToSegment,
  segmentIntersection,
} from "./segment";

type Segment = Readonly<{ start: Point2; end: Point2 }>;

type GapCandidate = Readonly<{
  distanceMm: number;
  firstPoint: Point2;
  secondPoint: Point2;
}>;

export type OrientedRectangleGapWitness = Readonly<{
  distanceMm: number;
  firstPoint: Point2 | null;
  secondPoint: Point2 | null;
  relation: "separated" | "touching" | "overlapping";
}>;

function comparePoint(first: Point2, second: Point2): number {
  return first.x - second.x || first.y - second.y;
}

function canonicalPair(candidate: GapCandidate): readonly [Point2, Point2] {
  return comparePoint(candidate.firstPoint, candidate.secondPoint) <= 0
    ? [candidate.firstPoint, candidate.secondPoint]
    : [candidate.secondPoint, candidate.firstPoint];
}

function compareCandidate(first: GapCandidate, second: GapCandidate): number {
  const distance = first.distanceMm - second.distanceMm;
  if (Math.abs(distance) > GEOMETRY_EPSILON_MM) return distance;
  const [firstLow, firstHigh] = canonicalPair(first);
  const [secondLow, secondHigh] = canonicalPair(second);
  return comparePoint(firstLow, secondLow) || comparePoint(firstHigh, secondHigh);
}

function pointCandidate(
  point: Point2,
  target: Segment,
  pointBelongsToFirst: boolean,
): GapCandidate {
  const projection = projectPointToSegment(point, target.start, target.end);
  return pointBelongsToFirst
    ? { distanceMm: projection.distance, firstPoint: point, secondPoint: projection.point }
    : { distanceMm: projection.distance, firstPoint: projection.point, secondPoint: point };
}

function edgePairCandidates(first: Segment, second: Segment): GapCandidate[] {
  const candidates: GapCandidate[] = [];
  const intersection = segmentIntersection(first.start, first.end, second.start, second.end);
  if (intersection) {
    candidates.push({
      distanceMm: 0,
      firstPoint: intersection.point,
      secondPoint: intersection.point,
    });
  }
  candidates.push(pointCandidate(first.start, second, true));
  candidates.push(pointCandidate(first.end, second, true));
  candidates.push(pointCandidate(second.start, first, false));
  candidates.push(pointCandidate(second.end, first, false));
  return candidates;
}

function closestBoundaryCandidate(
  first: OrientedRectangle,
  second: OrientedRectangle,
): GapCandidate {
  const candidates: GapCandidate[] = [];
  for (const firstEdge of orientedRectangleEdges(first)) {
    for (const secondEdge of orientedRectangleEdges(second)) {
      candidates.push(...edgePairCandidates(firstEdge, secondEdge));
    }
  }
  candidates.sort(compareCandidate);
  const closest = candidates[0];
  if (!closest) throw new Error("Oriented rectangles have no boundary edges.");
  if (closest.distanceMm > GEOMETRY_EPSILON_MM) return closest;

  const contactPoint = comparePoint(closest.firstPoint, closest.secondPoint) <= 0
    ? closest.firstPoint
    : closest.secondPoint;
  return {
    distanceMm: 0,
    firstPoint: contactPoint,
    secondPoint: contactPoint,
  };
}

export function minimumGapWitnessBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): OrientedRectangleGapWitness {
  if (orientedRectanglesIntersect(first, second)) {
    return {
      distanceMm: 0,
      firstPoint: null,
      secondPoint: null,
      relation: "overlapping",
    };
  }

  const closest = closestBoundaryCandidate(first, second);
  const touching = closest.distanceMm <= GEOMETRY_EPSILON_MM;
  return {
    distanceMm: touching ? 0 : closest.distanceMm,
    firstPoint: closest.firstPoint,
    secondPoint: closest.secondPoint,
    relation: touching ? "touching" : "separated",
  };
}

export function minimumDistanceBetweenOrientedRectangles(
  first: OrientedRectangle,
  second: OrientedRectangle,
): number {
  return minimumGapWitnessBetweenOrientedRectangles(first, second).distanceMm;
}

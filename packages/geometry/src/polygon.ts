import { distanceBetween, type Point2 } from "./point";
import { GEOMETRY_EPSILON_MM, pointOnSegment, projectPointToSegment, segmentIntersection } from "./segment";

export function signedPolygonArea(points: readonly Point2[]): number {
  if (points.length < 3) return 0;
  let sum = 0;
  for (let index = 0; index < points.length; index += 1) {
    const current = points[index]!;
    const next = points[(index + 1) % points.length]!;
    sum += current.x * next.y - next.x * current.y;
  }
  return sum / 2;
}

export function pointInPolygon(point: Point2, polygon: readonly Point2[]): boolean {
  if (polygon.length < 3) return false;
  for (let index = 0; index < polygon.length; index += 1) {
    if (pointOnSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!, GEOMETRY_EPSILON_MM)) return true;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const a = polygon[i]!;
    const b = polygon[j]!;
    const intersects = ((a.y > point.y) !== (b.y > point.y)) &&
      point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x;
    if (intersects) inside = !inside;
  }
  return inside;
}

export function polygonSelfIntersects(polygon: readonly Point2[]): boolean {
  if (polygon.length < 4) return false;
  for (let first = 0; first < polygon.length; first += 1) {
    const firstStart = polygon[first]!;
    const firstEnd = polygon[(first + 1) % polygon.length]!;
    for (let second = first + 1; second < polygon.length; second += 1) {
      if (second === first || second === first + 1) continue;
      if (first === 0 && second === polygon.length - 1) continue;
      const secondStart = polygon[second]!;
      const secondEnd = polygon[(second + 1) % polygon.length]!;
      const intersection = segmentIntersection(firstStart, firstEnd, secondStart, secondEnd);
      if (intersection) return true;
    }
  }
  return false;
}

function polygonCentroid(polygon: readonly Point2[]): Point2 | null {
  const area = signedPolygonArea(polygon);
  if (Math.abs(area) <= GEOMETRY_EPSILON_MM) return null;
  let x = 0;
  let y = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]!;
    const next = polygon[(index + 1) % polygon.length]!;
    const factor = current.x * next.y - next.x * current.y;
    x += (current.x + next.x) * factor;
    y += (current.y + next.y) * factor;
  }
  return { x: x / (6 * area), y: y / (6 * area) };
}

function minimumDistanceToBoundary(point: Point2, polygon: readonly Point2[]): number {
  let minimum = Number.POSITIVE_INFINITY;
  for (let index = 0; index < polygon.length; index += 1) {
    const projection = projectPointToSegment(point, polygon[index]!, polygon[(index + 1) % polygon.length]!);
    minimum = Math.min(minimum, projection.distance);
  }
  return minimum;
}

export function findInteriorPoint(polygon: readonly Point2[]): Point2 {
  if (polygon.length < 3) throw new Error("Polygon must contain at least three points");
  const centroid = polygonCentroid(polygon);
  if (centroid && pointInPolygon(centroid, polygon)) return centroid;

  const xs = polygon.map((point) => point.x);
  const ys = polygon.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const candidates: Array<{ point: Point2; clearance: number }> = [];
  const divisions = 24;

  for (let yIndex = 1; yIndex < divisions; yIndex += 1) {
    for (let xIndex = 1; xIndex < divisions; xIndex += 1) {
      const point = {
        x: minX + ((maxX - minX) * xIndex) / divisions,
        y: minY + ((maxY - minY) * yIndex) / divisions,
      };
      if (!pointInPolygon(point, polygon)) continue;
      candidates.push({ point, clearance: minimumDistanceToBoundary(point, polygon) });
    }
  }

  candidates.sort((a, b) => b.clearance - a.clearance || a.point.y - b.point.y || a.point.x - b.point.x);
  if (candidates[0]) return candidates[0].point;

  const fallback = polygon[0]!;
  const next = polygon[1]!;
  const midpoint = { x: (fallback.x + next.x) / 2, y: (fallback.y + next.y) / 2 };
  if (pointInPolygon(midpoint, polygon)) return midpoint;
  throw new Error("Could not find an interior point for polygon");
}

export function polygonPerimeter(polygon: readonly Point2[]): number {
  let perimeter = 0;
  for (let index = 0; index < polygon.length; index += 1) {
    perimeter += distanceBetween(polygon[index]!, polygon[(index + 1) % polygon.length]!);
  }
  return perimeter;
}

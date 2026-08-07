import type { DetectedLineSegment } from "./local-lines";

type Point = Readonly<{ x: number; y: number }>;
type SegmentGeometry = Readonly<{
  source: DetectedLineSegment;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  midpoint: Point;
  lengthPx: number;
  angleDeg: number;
}>;
type ProjectedSegment = Readonly<{
  geometry: SegmentGeometry;
  startAlong: number;
  endAlong: number;
  offsetPx: number;
}>;

const MAX_SOURCE_SEGMENTS = 512;
const MAX_AUGMENTED_SEGMENTS = 768;
const MIN_SOURCE_LENGTH_PX = 24;
const MIN_ROTATED_AXIS_DELTA_DEG = 20;
const MAX_ANGLE_DELTA_DEG = 3;
const MAX_RAIL_AXIS_OFFSET_PX = 4;
const MAX_INTERNAL_GAP_PX = 36;
const MIN_MERGED_EXTENSION_PX = 12;
const EPSILON = 1e-7;

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
}

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function angleDeg(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function axisDelta(angle: number): number {
  return Math.min(angle, Math.abs(90 - angle), Math.abs(180 - angle));
}

function canonicalPoints(first: Point, second: Point): readonly [Point, Point] {
  return first.x < second.x || (first.x === second.x && first.y <= second.y)
    ? [first, second]
    : [second, first];
}

function geometry(source: DetectedLineSegment): SegmentGeometry | null {
  if (![source.x1, source.y1, source.x2, source.y2].every(Number.isFinite)) return null;
  const [start, end] = canonicalPoints(
    { x: source.x1, y: source.y1 },
    { x: source.x2, y: source.y2 },
  );
  const vector = subtract(end, start);
  const lengthPx = Math.hypot(vector.x, vector.y);
  if (lengthPx < MIN_SOURCE_LENGTH_PX) return null;
  const tangent = { x: vector.x / lengthPx, y: vector.y / lengthPx };
  const normal = { x: -tangent.y, y: tangent.x };
  const angle = angleDeg(start, end);
  if (axisDelta(angle) < MIN_ROTATED_AXIS_DELTA_DEG) return null;
  return {
    source,
    start,
    end,
    tangent,
    normal,
    midpoint: scale(add(start, end), 0.5),
    lengthPx,
    angleDeg: angle,
  };
}

function compareGeometry(first: SegmentGeometry, second: SegmentGeometry): number {
  return first.start.x - second.start.x
    || first.start.y - second.start.y
    || first.end.x - second.end.x
    || first.end.y - second.end.y
    || first.lengthPx - second.lengthPx;
}

function projectToSeed(seed: SegmentGeometry, candidate: SegmentGeometry): ProjectedSegment | null {
  if (angleDelta(seed.angleDeg, candidate.angleDeg) > MAX_ANGLE_DELTA_DEG) return null;
  const offsetPx = dot(subtract(candidate.midpoint, seed.start), seed.normal);
  if (Math.abs(offsetPx) > MAX_RAIL_AXIS_OFFSET_PX) return null;
  const first = dot(subtract(candidate.start, seed.start), seed.tangent);
  const second = dot(subtract(candidate.end, seed.start), seed.tangent);
  return {
    geometry: candidate,
    startAlong: Math.min(first, second),
    endAlong: Math.max(first, second),
    offsetPx,
  };
}

function key(segment: DetectedLineSegment): string {
  const [start, end] = canonicalPoints(
    { x: segment.x1, y: segment.y1 },
    { x: segment.x2, y: segment.y2 },
  );
  return [start.x, start.y, end.x, end.y]
    .map((value) => Math.round(value * 2))
    .join(":");
}

function mergedSegment(seed: SegmentGeometry, run: readonly ProjectedSegment[]): DetectedLineSegment | null {
  if (run.length < 2) return null;
  const longest = [...run].sort((first, second) =>
    second.geometry.lengthPx - first.geometry.lengthPx
    || compareGeometry(first.geometry, second.geometry))[0]!;
  if (longest.geometry !== seed) return null;

  const startAlong = Math.min(...run.map((item) => item.startAlong));
  const endAlong = Math.max(...run.map((item) => item.endAlong));
  const spanPx = endAlong - startAlong;
  const maximumSourceLengthPx = Math.max(...run.map((item) => item.geometry.lengthPx));
  if (spanPx < maximumSourceLengthPx + MIN_MERGED_EXTENSION_PX) return null;

  const weight = run.reduce((sum, item) => sum + item.geometry.lengthPx, 0);
  if (weight <= EPSILON) return null;
  const offsetPx = run.reduce(
    (sum, item) => sum + item.offsetPx * item.geometry.lengthPx,
    0,
  ) / weight;
  const start = add(seed.start, add(scale(seed.tangent, startAlong), scale(seed.normal, offsetPx)));
  const end = add(seed.start, add(scale(seed.tangent, endAlong), scale(seed.normal, offsetPx)));
  const [canonicalStart, canonicalEnd] = canonicalPoints(start, end);
  return {
    x1: canonicalStart.x,
    y1: canonicalStart.y,
    x2: canonicalEnd.x,
    y2: canonicalEnd.y,
  };
}

export function augmentRotatedCollinearRailSegments(
  sourceSegments: readonly DetectedLineSegment[],
): DetectedLineSegment[] {
  const originals = sourceSegments.map((segment) => ({ ...segment }));
  if (sourceSegments.length < 2 || sourceSegments.length > MAX_SOURCE_SEGMENTS) return originals;

  const geometries = sourceSegments
    .map(geometry)
    .filter((segment): segment is SegmentGeometry => segment !== null)
    .sort(compareGeometry);
  const additions = new Map<string, DetectedLineSegment>();

  for (const seed of geometries) {
    const projected = geometries
      .map((candidate) => projectToSeed(seed, candidate))
      .filter((candidate): candidate is ProjectedSegment => candidate !== null)
      .sort((first, second) =>
        first.startAlong - second.startAlong
        || first.endAlong - second.endAlong
        || compareGeometry(first.geometry, second.geometry));
    if (projected.length < 2) continue;

    let run: ProjectedSegment[] = [];
    let runEnd = Number.NEGATIVE_INFINITY;
    const flush = () => {
      const merged = mergedSegment(seed, run);
      if (merged) additions.set(key(merged), merged);
      run = [];
      runEnd = Number.NEGATIVE_INFINITY;
    };

    for (const candidate of projected) {
      if (run.length > 0 && candidate.startAlong - runEnd > MAX_INTERNAL_GAP_PX) flush();
      run.push(candidate);
      runEnd = Math.max(runEnd, candidate.endAlong);
    }
    flush();
    if (originals.length + additions.size >= MAX_AUGMENTED_SEGMENTS) break;
  }

  const existingKeys = new Set(originals.map(key));
  const merged = [...additions.values()]
    .filter((segment) => !existingKeys.has(key(segment)))
    .sort((first, second) =>
      first.x1 - second.x1
      || first.y1 - second.y1
      || first.x2 - second.x2
      || first.y2 - second.y2)
    .slice(0, Math.max(0, MAX_AUGMENTED_SEGMENTS - originals.length));
  return [...originals, ...merged];
}

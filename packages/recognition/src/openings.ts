import type { DetectedLineSegment } from "./local-lines";
import type { NormalizedPoint, RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

export type BuildOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
}>;

type Point = { x: number; y: number };
type Interval = { start: number; end: number };

function length(a: Point, b: Point): number { return Math.hypot(b.x - a.x, b.y - a.y); }
function dot(a: Point, b: Point): number { return a.x * b.x + a.y * b.y; }
function midpoint(a: Point, b: Point): Point { return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; }
function clamp01(value: number): number { return Math.max(0, Math.min(1, value)); }

function segmentAngle(segment: DetectedLineSegment): number {
  return ((Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * 180 / Math.PI) + 180) % 180;
}
function angleDelta(a: number, b: number): number {
  const raw = Math.abs(a - b) % 180;
  return Math.min(raw, 180 - raw);
}

function mergeIntervals(intervals: readonly Interval[]): Interval[] {
  const sorted = [...intervals].sort((a, b) => a.start - b.start || a.end - b.end);
  const result: Interval[] = [];
  for (const interval of sorted) {
    const previous = result.at(-1);
    if (!previous || interval.start > previous.end + 8) result.push({ ...interval });
    else previous.end = Math.max(previous.end, interval.end);
  }
  return result;
}

function pixelPoint(point: NormalizedPoint, widthPx: number, heightPx: number): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

export function buildOpeningHypotheses(input: BuildOpeningHypothesesInput): RecognitionOpeningCandidate[] {
  const results: RecognitionOpeningCandidate[] = [];
  for (const wall of input.wallCandidates) {
    const start = pixelPoint(wall.start, input.widthPx, input.heightPx);
    const end = pixelPoint(wall.end, input.widthPx, input.heightPx);
    const wallLength = length(start, end);
    if (wallLength < 80) continue;
    const tangent = { x: (end.x - start.x) / wallLength, y: (end.y - start.y) / wallLength };
    const normal = { x: -tangent.y, y: tangent.x };
    const wallAngle = ((Math.atan2(tangent.y, tangent.x) * 180 / Math.PI) + 180) % 180;
    const expectedHalfThickness = Math.max(3, (wall.estimatedThicknessPx ?? 20) / 2);
    const edgeTolerance = Math.max(8, expectedHalfThickness * 0.7);

    const intervals: Interval[] = [];
    for (const segment of input.segments) {
      if (angleDelta(segmentAngle(segment), wallAngle) > 8) continue;
      const a = { x: segment.x1, y: segment.y1 }, b = { x: segment.x2, y: segment.y2 };
      const center = midpoint(a, b);
      const relative = { x: center.x - start.x, y: center.y - start.y };
      const across = Math.abs(dot(relative, normal));
      if (Math.abs(across - expectedHalfThickness) > edgeTolerance) continue;
      const pa = dot({ x: a.x - start.x, y: a.y - start.y }, tangent);
      const pb = dot({ x: b.x - start.x, y: b.y - start.y }, tangent);
      const interval = { start: Math.max(0, Math.min(pa, pb)), end: Math.min(wallLength, Math.max(pa, pb)) };
      if (interval.end - interval.start >= 20) intervals.push(interval);
    }
    const merged = mergeIntervals(intervals);
    for (let index = 0; index < merged.length - 1; index += 1) {
      const gapStart = merged[index]!.end;
      const gapEnd = merged[index + 1]!.start;
      const widthPx = gapEnd - gapStart;
      if (widthPx < 30 || widthPx > 240 || gapStart < 12 || wallLength - gapEnd < 12) continue;
      const gapCenterAlong = (gapStart + gapEnd) / 2;
      const centerPx = { x: start.x + tangent.x * gapCenterAlong, y: start.y + tangent.y * gapCenterAlong };

      let angledEvidence = 0;
      let perpendicularEvidence = 0;
      for (const segment of input.segments) {
        const a = { x: segment.x1, y: segment.y1 }, b = { x: segment.x2, y: segment.y2 };
        const segmentCenter = midpoint(a, b);
        if (length(segmentCenter, centerPx) > Math.max(widthPx * 1.1, 90)) continue;
        const delta = angleDelta(segmentAngle(segment), wallAngle);
        const segmentLength = length(a, b);
        if (delta >= 20 && delta <= 75 && segmentLength >= 25 && segmentLength <= widthPx * 1.6) angledEvidence += 1;
        if (delta >= 75 && delta <= 90 && segmentLength <= Math.max(80, expectedHalfThickness * 5)) perpendicularEvidence += 1;
      }

      const kind = angledEvidence > 0 ? "door" : perpendicularEvidence >= 2 ? "window" : "unknown-opening";
      const confidence = kind === "unknown-opening" ? "low" : "medium";
      results.push({
        id: `local-opening-${results.length + 1}`,
        kind,
        hostWallCandidateId: wall.id,
        center: { x: clamp01(centerPx.x / input.widthPx), y: clamp01(centerPx.y / input.heightPx) },
        widthPx,
        orientationDeg: wallAngle,
        confidence,
        evidence: {
          localScore: kind === "unknown-opening" ? 0.45 : 0.72,
          cloudScore: null,
          reasons: kind === "door" ? ["wall-gap", "door-arc-like-line"] : kind === "window" ? ["wall-gap", "paired-cross-lines"] : ["wall-gap"],
        },
        origin: "local",
        conflict: null,
      });
    }
  }
  return results;
}

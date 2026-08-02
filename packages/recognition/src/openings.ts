import type { DetectedLineSegment } from "./local-lines";
import type { NormalizedPoint, RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

export type BuildOpeningHypothesesInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  segments?: readonly DetectedLineSegment[];
  wallSegments?: readonly DetectedLineSegment[];
  symbolSegments?: readonly DetectedLineSegment[];
}>;

type Point = { x: number; y: number };
type Interval = { start: number; end: number };
type ProjectedRail = Readonly<{
  startAlong: number;
  endAlong: number;
  centerAlong: number;
  across: number;
  lengthPx: number;
}>;

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

function mergeProjectedRails(rails: readonly ProjectedRail[]): ProjectedRail[] {
  const sorted = [...rails].sort((first, second) =>
    first.across - second.across
    || first.startAlong - second.startAlong
    || first.endAlong - second.endAlong);
  const merged: Array<{
    startAlong: number;
    endAlong: number;
    acrossWeighted: number;
    weight: number;
  }> = [];

  for (const rail of sorted) {
    const existing = merged.find((candidate) => {
      const candidateAcross = candidate.acrossWeighted / candidate.weight;
      return Math.abs(candidateAcross - rail.across) <= 3
        && rail.startAlong <= candidate.endAlong + 12
        && rail.endAlong >= candidate.startAlong - 12;
    });
    if (!existing) {
      merged.push({
        startAlong: rail.startAlong,
        endAlong: rail.endAlong,
        acrossWeighted: rail.across * rail.lengthPx,
        weight: rail.lengthPx,
      });
      continue;
    }
    existing.startAlong = Math.min(existing.startAlong, rail.startAlong);
    existing.endAlong = Math.max(existing.endAlong, rail.endAlong);
    existing.acrossWeighted += rail.across * rail.lengthPx;
    existing.weight += rail.lengthPx;
  }

  return merged.map((rail): ProjectedRail => ({
    startAlong: rail.startAlong,
    endAlong: rail.endAlong,
    centerAlong: (rail.startAlong + rail.endAlong) / 2,
    across: rail.acrossWeighted / rail.weight,
    lengthPx: rail.endAlong - rail.startAlong,
  })).sort((first, second) =>
    first.centerAlong - second.centerAlong
    || first.across - second.across
    || first.lengthPx - second.lengthPx);
}

function pixelPoint(point: NormalizedPoint, widthPx: number, heightPx: number): Point {
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function candidateCenterAlong(
  candidate: RecognitionOpeningCandidate,
  start: Point,
  tangent: Point,
  widthPx: number,
  heightPx: number,
): number {
  const center = pixelPoint(candidate.center, widthPx, heightPx);
  return dot({ x: center.x - start.x, y: center.y - start.y }, tangent);
}

function hasNearbyOpening(
  candidates: readonly RecognitionOpeningCandidate[],
  wallId: string,
  centerAlong: number,
  widthPx: number,
  start: Point,
  tangent: Point,
  imageWidthPx: number,
  imageHeightPx: number,
): boolean {
  return candidates.some((candidate) =>
    candidate.hostWallCandidateId === wallId
    && Math.abs(candidateCenterAlong(candidate, start, tangent, imageWidthPx, imageHeightPx) - centerAlong)
      <= Math.max(12, widthPx * 0.25));
}

export function buildOpeningHypotheses(input: BuildOpeningHypothesesInput): RecognitionOpeningCandidate[] {
  const wallSegments = input.wallSegments ?? input.segments ?? [];
  const symbolSegments = input.symbolSegments ?? input.segments ?? [];
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
    const edgeTolerance = Math.max(2.5, expectedHalfThickness * 0.35);

    const intervals: Interval[] = [];
    for (const segment of wallSegments) {
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
      for (const segment of symbolSegments) {
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

    const rawRails = symbolSegments.flatMap((segment): ProjectedRail[] => {
      if (angleDelta(segmentAngle(segment), wallAngle) > 8) return [];
      const a = { x: segment.x1, y: segment.y1 };
      const b = { x: segment.x2, y: segment.y2 };
      const segmentLength = length(a, b);
      if (segmentLength < 18 || segmentLength > 240) return [];
      const pa = dot({ x: a.x - start.x, y: a.y - start.y }, tangent);
      const pb = dot({ x: b.x - start.x, y: b.y - start.y }, tangent);
      const startAlong = Math.min(pa, pb);
      const endAlong = Math.max(pa, pb);
      if (startAlong < 12 || wallLength - endAlong < 12) return [];
      const center = midpoint(a, b);
      const relative = { x: center.x - start.x, y: center.y - start.y };
      const across = dot(relative, normal);
      if (Math.abs(across) > expectedHalfThickness + 6) return [];
      return [{
        startAlong,
        endAlong,
        centerAlong: (startAlong + endAlong) / 2,
        across,
        lengthPx: endAlong - startAlong,
      }];
    });
    const rails = mergeProjectedRails(rawRails);

    const railWindows: Array<Readonly<{ centerAlong: number; widthPx: number }>> = [];
    for (let firstIndex = 0; firstIndex < rails.length; firstIndex += 1) {
      const first = rails[firstIndex]!;
      for (let secondIndex = firstIndex + 1; secondIndex < rails.length; secondIndex += 1) {
        const second = rails[secondIndex]!;
        const centerDelta = Math.abs(first.centerAlong - second.centerAlong);
        if (centerDelta > 12) {
          if (second.centerAlong > first.centerAlong) break;
          continue;
        }
        const startDelta = Math.abs(first.startAlong - second.startAlong);
        const endDelta = Math.abs(first.endAlong - second.endAlong);
        if (startDelta > 12 || endDelta > 12) continue;
        const separation = Math.abs(first.across - second.across);
        const minimumRailSeparation = Math.max(3, expectedHalfThickness * 0.35);
        const maximumRailSeparation = Math.max(16, expectedHalfThickness * 1.8);
        if (separation < minimumRailSeparation || separation > maximumRailSeparation) continue;
        const averageAcross = (first.across + second.across) / 2;
        if (Math.abs(averageAcross) > Math.max(4, expectedHalfThickness * 0.55)) continue;
        const lengthRatio = Math.min(first.lengthPx, second.lengthPx) / Math.max(first.lengthPx, second.lengthPx);
        if (lengthRatio < 0.82) continue;
        const widthPx = (first.lengthPx + second.lengthPx) / 2;
        if (widthPx < Math.max(50, expectedHalfThickness * 3)) continue;
        const centerAlong = (first.centerAlong + second.centerAlong) / 2;
        if (railWindows.some((candidate) =>
          Math.abs(candidate.centerAlong - centerAlong) <= Math.max(10, widthPx * 0.2))) continue;
        railWindows.push({ centerAlong, widthPx });
      }
    }

    for (const railWindow of railWindows) {
      if (hasNearbyOpening(
        results,
        wall.id,
        railWindow.centerAlong,
        railWindow.widthPx,
        start,
        tangent,
        input.widthPx,
        input.heightPx,
      )) continue;
      const centerPx = {
        x: start.x + tangent.x * railWindow.centerAlong,
        y: start.y + tangent.y * railWindow.centerAlong,
      };
      results.push({
        id: `local-opening-${results.length + 1}`,
        kind: "window",
        hostWallCandidateId: wall.id,
        center: { x: clamp01(centerPx.x / input.widthPx), y: clamp01(centerPx.y / input.heightPx) },
        widthPx: railWindow.widthPx,
        orientationDeg: wallAngle,
        confidence: "medium",
        evidence: {
          localScore: 0.72,
          cloudScore: null,
          reasons: ["paired-window-rails", "paired-cross-lines"],
        },
        origin: "local",
        conflict: null,
      });
    }
  }
  return results;
}

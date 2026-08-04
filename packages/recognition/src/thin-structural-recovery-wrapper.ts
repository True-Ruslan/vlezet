import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionDiagnostic, RecognitionWallCandidate } from "./model";
import {
  recoverThinStructuralWalls as recoverBase,
} from "./thin-structural-recovery";
import type { StructuralMaskView } from "./wall-completion";

type RecoveryInput = Parameters<typeof recoverBase>[0];
type Point = Readonly<{ x: number; y: number }>;
type MeasuredEdge = Readonly<{
  index: number;
  sourceIndexes: readonly number[];
  angleDeg: number;
  tangent: Point;
  normal: Point;
  rawAxis: number;
  axis: number;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
  supportRatio: number;
}>;
type RawRun = Readonly<{
  tangent: Point;
  normal: Point;
  axis: number;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
  supportRatio: number;
  sourceIndexes: readonly number[];
}>;
type ProjectedWall = Readonly<{
  id: string;
  axis: number;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
}>;

const MAX_SEGMENTS = 512;
const MAX_PAIR_COMPARISONS = 4096;
const MAX_ADDITIONAL_RUNS = 8;
const MAX_CROSS_SECTION_OFFSET_PX = 80;
const MAX_ANGLE_DELTA_DEG = 8;
const MAX_EDGE_AXIS_DELTA_PX = 5;
const MIN_EDGE_OVERLAP_RATIO = 0.8;
const MIN_EDGE_LENGTH_RATIO = 0.8;
const MAX_EDGE_THICKNESS_RATIO = 1.5;
const MIN_THICKNESS_PX = 8;
const MIN_MEASURED_EDGE_LENGTH_PX = 10;
const MIN_RUN_LENGTH_PX = 24;
const MAX_RUN_LENGTH_PX = 180;
const MIN_RUN_SUPPORT_RATIO = 0.82;
const MAX_BOUNDARY_FRAGMENT_ANGLE_DELTA_DEG = 4;
const MAX_BOUNDARY_FRAGMENT_RAW_AXIS_DELTA_PX = 3;
const MAX_BOUNDARY_FRAGMENT_GAP_PX = 12;
const MIN_ANCHOR_LENGTH_PX = 80;
const MAX_ANCHOR_THICKNESS_RATIO = 1.8;
const MIN_OPENING_GAP_PX = 30;
const MAX_OPENING_GAP_PX = 240;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[middle - 1]! + sorted[middle]!) / 2
    : sorted[middle]!;
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
}

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function scale(point: Point, amount: number): Point {
  return { x: point.x * amount, y: point.y * amount };
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function angle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function intervalAt(
  point: Point,
  normal: Point,
  mask: StructuralMaskView,
): Readonly<{ centerOffset: number; thicknessPx: number }> | null {
  const values: boolean[] = [];
  try {
    for (let offset = -MAX_CROSS_SECTION_OFFSET_PX; offset <= MAX_CROSS_SECTION_OFFSET_PX; offset += 1) {
      const x = clamp(Math.round(point.x + normal.x * offset), 0, mask.widthPx - 1);
      const y = clamp(Math.round(point.y + normal.y * offset), 0, mask.heightPx - 1);
      values.push(mask.isStructural(x, y));
    }
  } catch {
    return null;
  }

  const intervals: Array<{ start: number; end: number }> = [];
  let start: number | null = null;
  for (let index = 0; index < values.length; index += 1) {
    if (values[index]) {
      if (start === null) start = index;
    } else if (start !== null) {
      intervals.push({ start, end: index - 1 });
      start = null;
    }
  }
  if (start !== null) intervals.push({ start, end: values.length - 1 });
  if (intervals.length === 0) return null;

  const centerIndex = MAX_CROSS_SECTION_OFFSET_PX;
  const ranked = intervals.map((interval) => {
    const containsCenter = interval.start <= centerIndex && interval.end >= centerIndex;
    const distanceToCenter = containsCenter
      ? 0
      : Math.min(Math.abs(interval.start - centerIndex), Math.abs(interval.end - centerIndex));
    return { interval, containsCenter, distanceToCenter };
  }).sort((first, second) =>
    Number(second.containsCenter) - Number(first.containsCenter)
    || first.distanceToCenter - second.distanceToCenter
    || (second.interval.end - second.interval.start) - (first.interval.end - first.interval.start));
  const selected = ranked[0]!;
  if (!selected.containsCenter && selected.distanceToCenter > 6) return null;
  return {
    centerOffset: (selected.interval.start + selected.interval.end) / 2 - centerIndex,
    thicknessPx: selected.interval.end - selected.interval.start + 1,
  };
}

function measureEdge(
  segment: DetectedLineSegment,
  index: number,
  mask: StructuralMaskView,
): MeasuredEdge | null {
  const start = { x: segment.x1, y: segment.y1 };
  const end = { x: segment.x2, y: segment.y2 };
  const lengthPx = distance(start, end);
  if (!Number.isFinite(lengthPx) || lengthPx < MIN_MEASURED_EDGE_LENGTH_PX) return null;
  const angleDeg = angle(start, end);
  const radians = angleDeg * Math.PI / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  const normal = { x: -tangent.y, y: tangent.x };
  const rawAxis = (dot(start, normal) + dot(end, normal)) / 2;
  const offsets: number[] = [];
  const thicknesses: number[] = [];
  const sampleCount = 5;
  for (let sampleIndex = 0; sampleIndex < sampleCount; sampleIndex += 1) {
    const ratio = (sampleIndex + 0.5) / sampleCount;
    const point = {
      x: start.x + (end.x - start.x) * ratio,
      y: start.y + (end.y - start.y) * ratio,
    };
    const measurement = intervalAt(point, normal, mask);
    if (!measurement) continue;
    offsets.push(measurement.centerOffset);
    thicknesses.push(measurement.thicknessPx);
  }
  const supportRatio = offsets.length / sampleCount;
  if (supportRatio < 0.6) return null;
  const firstAlong = dot(start, tangent);
  const secondAlong = dot(end, tangent);
  return {
    index,
    sourceIndexes: [index],
    angleDeg,
    tangent,
    normal,
    rawAxis,
    axis: rawAxis + median(offsets),
    minimum: Math.min(firstAlong, secondAlong),
    maximum: Math.max(firstAlong, secondAlong),
    lengthPx,
    thicknessPx: median(thicknesses),
    supportRatio,
  };
}

function boundaryFragmentsCompatible(first: MeasuredEdge, second: MeasuredEdge): boolean {
  if (angleDelta(first.angleDeg, second.angleDeg) > MAX_BOUNDARY_FRAGMENT_ANGLE_DELTA_DEG) return false;
  if (Math.abs(first.rawAxis - second.rawAxis) > MAX_BOUNDARY_FRAGMENT_RAW_AXIS_DELTA_PX) return false;
  const thicknessRatio = Math.max(first.thicknessPx, second.thicknessPx)
    / Math.max(1, Math.min(first.thicknessPx, second.thicknessPx));
  if (thicknessRatio > MAX_EDGE_THICKNESS_RATIO) return false;
  const gap = Math.max(
    0,
    Math.max(first.minimum, second.minimum) - Math.min(first.maximum, second.maximum),
  );
  return gap <= MAX_BOUNDARY_FRAGMENT_GAP_PX;
}

function mergeBoundaryFragments(edges: readonly MeasuredEdge[]): MeasuredEdge[] {
  const pending = [...edges].sort((first, second) =>
    first.angleDeg - second.angleDeg
    || first.rawAxis - second.rawAxis
    || first.minimum - second.minimum
    || first.maximum - second.maximum
    || first.index - second.index);
  const merged: MeasuredEdge[] = [];

  for (const edge of pending) {
    const existingIndex = merged.findIndex((candidate) => boundaryFragmentsCompatible(candidate, edge));
    if (existingIndex < 0) {
      merged.push(edge);
      continue;
    }
    const existing = merged[existingIndex]!;
    const totalWeight = existing.lengthPx + edge.lengthPx;
    const minimum = Math.min(existing.minimum, edge.minimum);
    const maximum = Math.max(existing.maximum, edge.maximum);
    merged[existingIndex] = {
      index: Math.min(existing.index, edge.index),
      sourceIndexes: [...new Set([...existing.sourceIndexes, ...edge.sourceIndexes])].sort((first, second) => first - second),
      angleDeg: (
        existing.angleDeg * existing.lengthPx
        + edge.angleDeg * edge.lengthPx
      ) / totalWeight,
      tangent: existing.tangent,
      normal: existing.normal,
      rawAxis: (
        existing.rawAxis * existing.lengthPx
        + edge.rawAxis * edge.lengthPx
      ) / totalWeight,
      axis: (
        existing.axis * existing.lengthPx
        + edge.axis * edge.lengthPx
      ) / totalWeight,
      minimum,
      maximum,
      lengthPx: maximum - minimum,
      thicknessPx: (
        existing.thicknessPx * existing.lengthPx
        + edge.thicknessPx * edge.lengthPx
      ) / totalWeight,
      supportRatio: Math.min(existing.supportRatio, edge.supportRatio),
    };
  }
  return merged.sort((first, second) =>
    first.angleDeg - second.angleDeg
    || first.rawAxis - second.rawAxis
    || first.minimum - second.minimum
    || first.maximum - second.maximum
    || first.index - second.index);
}

function pairRun(first: MeasuredEdge, second: MeasuredEdge): RawRun | null {
  if (angleDelta(first.angleDeg, second.angleDeg) > MAX_ANGLE_DELTA_DEG) return null;
  if (Math.abs(first.axis - second.axis) > MAX_EDGE_AXIS_DELTA_PX) return null;
  if (Math.min(first.thicknessPx, second.thicknessPx) < MIN_THICKNESS_PX) return null;
  const thicknessRatio = Math.max(first.thicknessPx, second.thicknessPx)
    / Math.max(1, Math.min(first.thicknessPx, second.thicknessPx));
  if (thicknessRatio > MAX_EDGE_THICKNESS_RATIO) return null;
  const overlapStart = Math.max(first.minimum, second.minimum);
  const overlapEnd = Math.min(first.maximum, second.maximum);
  const overlap = overlapEnd - overlapStart;
  if (overlap <= 0) return null;
  if (overlap / Math.min(first.lengthPx, second.lengthPx) < MIN_EDGE_OVERLAP_RATIO) return null;
  if (Math.min(first.lengthPx, second.lengthPx) / Math.max(first.lengthPx, second.lengthPx) < MIN_EDGE_LENGTH_RATIO) return null;
  const minimum = Math.min(first.minimum, second.minimum);
  const maximum = Math.max(first.maximum, second.maximum);
  const lengthPx = maximum - minimum;
  if (lengthPx < MIN_RUN_LENGTH_PX || lengthPx > MAX_RUN_LENGTH_PX) return null;
  return {
    tangent: first.tangent,
    normal: first.normal,
    axis: (first.axis + second.axis) / 2,
    minimum,
    maximum,
    lengthPx,
    thicknessPx: median([first.thicknessPx, second.thicknessPx]),
    supportRatio: Math.min(first.supportRatio, second.supportRatio),
    sourceIndexes: [...new Set([...first.sourceIndexes, ...second.sourceIndexes])]
      .sort((firstIndex, secondIndex) => firstIndex - secondIndex),
  };
}

function runCenterSupport(run: RawRun, mask: StructuralMaskView): number {
  const sampleCount = Math.max(8, Math.min(32, Math.ceil(run.lengthPx / 4)));
  let supported = 0;
  try {
    for (let index = 0; index < sampleCount; index += 1) {
      const along = run.minimum + run.lengthPx * ((index + 0.5) / sampleCount);
      const point = add(scale(run.tangent, along), scale(run.normal, run.axis));
      if (mask.isStructural(Math.round(point.x), Math.round(point.y))) supported += 1;
    }
  } catch {
    return 0;
  }
  return supported / sampleCount;
}

function wallPixels(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): Readonly<{ id: string; start: Point; end: Point; thicknessPx: number }> {
  return {
    id: candidate.id,
    start: { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx },
    end: { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx },
    thicknessPx: Math.max(1, candidate.estimatedThicknessPx ?? 20),
  };
}

function projectWall(
  candidate: RecognitionWallCandidate,
  run: RawRun,
  widthPx: number,
  heightPx: number,
): ProjectedWall | null {
  if (candidate.conflict !== null) return null;
  const wall = wallPixels(candidate, widthPx, heightPx);
  if (angleDelta(angle(wall.start, wall.end), angle(
    add(scale(run.tangent, run.minimum), scale(run.normal, run.axis)),
    add(scale(run.tangent, run.maximum), scale(run.normal, run.axis)),
  )) > MAX_ANGLE_DELTA_DEG) return null;
  const axis = (dot(wall.start, run.normal) + dot(wall.end, run.normal)) / 2;
  const axisTolerance = Math.max(6, Math.min(wall.thicknessPx, run.thicknessPx) * 0.4);
  if (Math.abs(axis - run.axis) > axisTolerance) return null;
  const thicknessRatio = Math.max(wall.thicknessPx, run.thicknessPx)
    / Math.max(1, Math.min(wall.thicknessPx, run.thicknessPx));
  if (thicknessRatio > MAX_ANCHOR_THICKNESS_RATIO) return null;
  const first = dot(wall.start, run.tangent);
  const second = dot(wall.end, run.tangent);
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);
  const lengthPx = maximum - minimum;
  if (lengthPx < MIN_ANCHOR_LENGTH_PX) return null;
  return { id: wall.id, axis, minimum, maximum, lengthPx, thicknessPx: wall.thicknessPx };
}

function boundedByPrimaryWalls(
  run: RawRun,
  primaryWalls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  const projected = primaryWalls
    .map((candidate) => projectWall(candidate, run, widthPx, heightPx))
    .filter((wall): wall is ProjectedWall => wall !== null);
  const before = projected.filter((wall) => wall.maximum <= run.minimum + EPSILON);
  const after = projected.filter((wall) => wall.minimum >= run.maximum - EPSILON);
  return before.some((left) => after.some((right) => {
    if (left.id === right.id) return false;
    const leftGap = run.minimum - left.maximum;
    const rightGap = right.minimum - run.maximum;
    return leftGap >= MIN_OPENING_GAP_PX
      && leftGap <= MAX_OPENING_GAP_PX
      && rightGap >= MIN_OPENING_GAP_PX
      && rightGap <= MAX_OPENING_GAP_PX;
  }));
}

function overlapsExistingWall(
  run: RawRun,
  walls: readonly RecognitionWallCandidate[],
  widthPx: number,
  heightPx: number,
): boolean {
  return walls.some((candidate) => {
    const projected = projectWall(candidate, run, widthPx, heightPx);
    if (!projected) return false;
    const overlap = Math.max(0, Math.min(projected.maximum, run.maximum) - Math.max(projected.minimum, run.minimum));
    return overlap / Math.max(1, Math.min(projected.lengthPx, run.lengthPx)) >= 0.6;
  });
}

function runKey(run: RawRun): string {
  return [run.axis, run.minimum, run.maximum, run.thicknessPx]
    .map((value) => Math.round(value * 10))
    .join(":");
}

function candidateForRun(
  run: RawRun,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const start = add(scale(run.tangent, run.minimum), scale(run.normal, run.axis));
  const end = add(scale(run.tangent, run.maximum), scale(run.normal, run.axis));
  const idValues = [start.x, start.y, end.x, end.y, run.thicknessPx]
    .map((value) => Math.round(value * 10));
  return {
    id: `thin-wall-post-${idValues.join("-")}`,
    start: { x: clamp(start.x / widthPx, 0, 1), y: clamp(start.y / heightPx, 0, 1) },
    end: { x: clamp(end.x / widthPx, 0, 1), y: clamp(end.y / heightPx, 0, 1) },
    estimatedThicknessPx: run.thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.78, 0.66 + run.supportRatio * 0.14),
      cloudScore: null,
      reasons: [
        "bounded-short-structural-run",
        "raw-thick-run-post-recovery",
        "thin-ink-structural-component",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function postRecoverRuns(
  input: RecoveryInput,
  existingWalls: readonly RecognitionWallCandidate[],
): readonly RecognitionWallCandidate[] {
  if (
    input.segments.length > MAX_SEGMENTS
    || input.inkMask.widthPx !== input.widthPx
    || input.inkMask.heightPx !== input.heightPx
  ) return [];
  const measuredFragments = input.segments
    .map((segment, index) => measureEdge(segment, index, input.inkMask))
    .filter((edge): edge is MeasuredEdge => edge !== null);
  const measurements = mergeBoundaryFragments(measuredFragments);
  if (measurements.length * Math.max(0, measurements.length - 1) / 2 > MAX_PAIR_COMPARISONS) return [];

  const runs = new Map<string, RawRun>();
  for (let firstIndex = 0; firstIndex < measurements.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < measurements.length; secondIndex += 1) {
      const run = pairRun(measurements[firstIndex]!, measurements[secondIndex]!);
      if (!run || runCenterSupport(run, input.inkMask) < MIN_RUN_SUPPORT_RATIO) continue;
      runs.set(runKey(run), run);
    }
  }

  const accepted: RecognitionWallCandidate[] = [];
  for (const run of [...runs.values()].sort((first, second) => runKey(first).localeCompare(runKey(second)))) {
    if (accepted.length >= MAX_ADDITIONAL_RUNS) break;
    if (!boundedByPrimaryWalls(run, input.primaryWalls, input.widthPx, input.heightPx)) continue;
    if (overlapsExistingWall(run, [...existingWalls, ...accepted], input.widthPx, input.heightPx)) continue;
    accepted.push(candidateForRun(run, input.widthPx, input.heightPx));
  }
  return accepted;
}

export function recoverThinStructuralWalls(input: RecoveryInput) {
  const base = recoverBase(input);
  const additional = postRecoverRuns(input, base.walls);
  if (additional.length === 0) return base;
  const diagnostic: RecognitionDiagnostic = {
    code: "thin-wall-short-run-post-recovered",
    severity: "info",
    message: `После основного recovery восстановлено коротких заполненных структурных разделителей: ${additional.length}.`,
    candidateId: null,
  };
  return {
    ...base,
    walls: [...base.walls, ...additional].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [...base.recoveredWalls, ...additional].sort((first, second) => first.id.localeCompare(second.id)),
    acceptedComponentCount: base.acceptedComponentCount + additional.length,
    diagnostics: [...base.diagnostics, diagnostic].sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

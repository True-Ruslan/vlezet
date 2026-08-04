import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionDiagnostic } from "./model";
import {
  recoverThinStructuralWalls as recoverThinStructuralWallsBase,
} from "./thin-structural-recovery";
import type { StructuralMaskView } from "./wall-completion";

type RecoveryInput = Parameters<typeof recoverThinStructuralWallsBase>[0];
type SegmentMeasurement = Readonly<{
  index: number;
  angleDeg: number;
  tangentX: number;
  tangentY: number;
  normalX: number;
  normalY: number;
  axis: number;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
}>;

const MIN_SEGMENT_LENGTH_PX = 18;
const MAX_CROSS_SECTION_OFFSET_PX = 48;
const MAX_THIN_RAIL_THICKNESS_PX = 4;
const MIN_STRUCTURAL_RUN_THICKNESS_PX = 8;
const MIN_SYMBOL_BRIDGE_LENGTH_PX = 30;
const MAX_SYMBOL_BRIDGE_LENGTH_PX = 240;
const MAX_ANGLE_DELTA_DEG = 8;
const MAX_AXIS_DELTA_PX = 6;
const MAX_ENDPOINT_GAP_PX = 18;

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function segmentAngle(segment: DetectedLineSegment): number {
  return ((Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * 180 / Math.PI) + 180) % 180;
}

function crossSectionThickness(
  segment: DetectedLineSegment,
  normalX: number,
  normalY: number,
  mask: StructuralMaskView,
): Readonly<{ centerOffsetPx: number; thicknessPx: number }> | null {
  const centerX = (segment.x1 + segment.x2) / 2;
  const centerY = (segment.y1 + segment.y2) / 2;
  const values: boolean[] = [];
  try {
    for (let offset = -MAX_CROSS_SECTION_OFFSET_PX; offset <= MAX_CROSS_SECTION_OFFSET_PX; offset += 1) {
      const x = Math.max(0, Math.min(mask.widthPx - 1, Math.round(centerX + normalX * offset)));
      const y = Math.max(0, Math.min(mask.heightPx - 1, Math.round(centerY + normalY * offset)));
      values.push(mask.isStructural(x, y));
    }
  } catch {
    return null;
  }

  const centerIndex = MAX_CROSS_SECTION_OFFSET_PX;
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
    centerOffsetPx: (selected.interval.start + selected.interval.end) / 2 - centerIndex,
    thicknessPx: selected.interval.end - selected.interval.start + 1,
  };
}

function measureSegment(
  segment: DetectedLineSegment,
  index: number,
  mask: StructuralMaskView,
): SegmentMeasurement | null {
  const lengthPx = Math.hypot(segment.x2 - segment.x1, segment.y2 - segment.y1);
  if (!Number.isFinite(lengthPx) || lengthPx < MIN_SEGMENT_LENGTH_PX) return null;
  const angleDeg = segmentAngle(segment);
  const radians = angleDeg * Math.PI / 180;
  const tangentX = Math.cos(radians);
  const tangentY = Math.sin(radians);
  const normalX = -tangentY;
  const normalY = tangentX;
  const thickness = crossSectionThickness(segment, normalX, normalY, mask);
  if (!thickness) return null;
  const firstAlong = segment.x1 * tangentX + segment.y1 * tangentY;
  const secondAlong = segment.x2 * tangentX + segment.y2 * tangentY;
  const centerX = (segment.x1 + segment.x2) / 2;
  const centerY = (segment.y1 + segment.y2) / 2;
  const axis = centerX * normalX + centerY * normalY + thickness.centerOffsetPx;
  return {
    index,
    angleDeg,
    tangentX,
    tangentY,
    normalX,
    normalY,
    axis,
    minimum: Math.min(firstAlong, secondAlong),
    maximum: Math.max(firstAlong, secondAlong),
    lengthPx,
    thicknessPx: thickness.thicknessPx,
  };
}

function compatibleStructuralRun(
  rail: SegmentMeasurement,
  candidate: SegmentMeasurement,
): boolean {
  if (candidate.thicknessPx < MIN_STRUCTURAL_RUN_THICKNESS_PX) return false;
  if (angleDelta(rail.angleDeg, candidate.angleDeg) > MAX_ANGLE_DELTA_DEG) return false;
  return Math.abs(rail.axis - candidate.axis) <= MAX_AXIS_DELTA_PX;
}

function isThinSymbolBridge(
  rail: SegmentMeasurement,
  measurements: readonly SegmentMeasurement[],
): boolean {
  if (
    rail.thicknessPx > MAX_THIN_RAIL_THICKNESS_PX
    || rail.lengthPx < MIN_SYMBOL_BRIDGE_LENGTH_PX
    || rail.lengthPx > MAX_SYMBOL_BRIDGE_LENGTH_PX
  ) return false;

  const structural = measurements.filter((candidate) =>
    candidate.index !== rail.index && compatibleStructuralRun(rail, candidate));
  const before = structural.filter((candidate) => {
    const gap = rail.minimum - candidate.maximum;
    return gap >= -MAX_ENDPOINT_GAP_PX && gap <= MAX_ENDPOINT_GAP_PX;
  });
  const after = structural.filter((candidate) => {
    const gap = candidate.minimum - rail.maximum;
    return gap >= -MAX_ENDPOINT_GAP_PX && gap <= MAX_ENDPOINT_GAP_PX;
  });
  return before.some((first) => after.some((second) => first.index !== second.index));
}

function filterThinSymbolBridges(
  segments: readonly DetectedLineSegment[],
  mask: StructuralMaskView,
): Readonly<{ segments: readonly DetectedLineSegment[]; filteredCount: number }> {
  const measurements = segments
    .map((segment, index) => measureSegment(segment, index, mask))
    .filter((measurement): measurement is SegmentMeasurement => measurement !== null);
  const filteredIndexes = new Set(
    measurements
      .filter((measurement) => isThinSymbolBridge(measurement, measurements))
      .map((measurement) => measurement.index),
  );
  if (filteredIndexes.size === 0) return { segments, filteredCount: 0 };
  return {
    segments: segments.filter((_segment, index) => !filteredIndexes.has(index)),
    filteredCount: filteredIndexes.size,
  };
}

export function recoverThinStructuralWalls(input: RecoveryInput) {
  const filtered = filterThinSymbolBridges(input.segments, input.inkMask);
  const result = recoverThinStructuralWallsBase({
    ...input,
    segments: filtered.segments,
  });
  if (filtered.filteredCount === 0) return result;
  const diagnostic: RecognitionDiagnostic = {
    code: "thin-wall-symbol-bridge-filtered",
    severity: "info",
    message: `Из wall-recovery исключено тонких направляющих между двумя заполненными структурными участками: ${filtered.filteredCount}.`,
    candidateId: null,
  };
  return {
    ...result,
    diagnostics: [...result.diagnostics, diagnostic].sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

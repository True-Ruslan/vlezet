import type { DetectedLineSegment } from "./local-lines";
import type {
  RecognitionDiagnostic,
  RecognitionWallCandidate,
} from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type ThinStructuralRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  acceptedComponentCount: number;
  dominantFrameDeg: number | null;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

export type ThinStructuralRecoveryOptions = Readonly<{
  maximumSegments: number;
  maximumCandidates: number;
  maximumPairComparisons: number;
  maximumRecoveredWalls: number;
  angleToleranceDeg: number;
  minimumSegmentLengthPx: number;
  minimumSupportedSampleRatio: number;
  endpointTolerancePx: number;
  boundaryMarginPx: number;
}>;

export const DEFAULT_THIN_STRUCTURAL_RECOVERY_OPTIONS: ThinStructuralRecoveryOptions = Object.freeze({
  maximumSegments: 512,
  maximumCandidates: 96,
  maximumPairComparisons: 4096,
  maximumRecoveredWalls: 32,
  angleToleranceDeg: 10,
  minimumSegmentLengthPx: 36,
  minimumSupportedSampleRatio: 0.68,
  endpointTolerancePx: 18,
  boundaryMarginPx: 12,
});

type Point = Readonly<{ x: number; y: number }>;
type MeasuredLine = Readonly<{
  sourceKey: string;
  family: 0 | 1;
  frameDeg: number;
  tangent: Point;
  normal: Point;
  axis: number;
  minimum: number;
  maximum: number;
  lengthPx: number;
  thicknessPx: number;
  supportRatio: number;
  start: Point;
  end: Point;
}>;
type PrimaryPixelWall = Readonly<{
  id: string;
  start: Point;
  end: Point;
  thicknessPx: number;
}>;
type ProjectedPrimaryWall = Readonly<{
  source: PrimaryPixelWall;
  minimum: number;
  maximum: number;
  axis: number;
  lengthPx: number;
}>;

const EPSILON = 1e-7;
const MAX_CROSS_SECTION_PX = 80;
const MAX_ALONG_SAMPLES = 48;
const PARALLEL_RAIL_MAX_DISTANCE_PX = 32;
const MIN_SHORT_SEPARATOR_GAP_PX = 30;
const MAX_SHORT_SEPARATOR_GAP_PX = 240;
const MIN_SHORT_SEPARATOR_LENGTH_PX = 24;
const MAX_SHORT_SEPARATOR_LENGTH_PX = 180;
const MIN_SHORT_SEPARATOR_SUPPORT_RATIO = 0.82;
const MIN_SHORT_SEPARATOR_LENGTH_THICKNESS_RATIO = 1.5;
const MIN_PRIMARY_ANCHOR_LENGTH_PX = 80;
const MAX_PRIMARY_THICKNESS_RATIO = 1.8;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} должен быть положительным конечным числом.`);
  return value;
}

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function add(first: Point, second: Point): Point {
  return { x: first.x + second.x, y: first.y + second.y };
}

function subtract(first: Point, second: Point): Point {
  return { x: first.x - second.x, y: first.y - second.y };
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

function median(values: readonly number[]): number {
  if (values.length === 0) return 0;
  const ordered = [...values].sort((first, second) => first - second);
  const middle = Math.floor(ordered.length / 2);
  return ordered.length % 2 === 0
    ? (ordered[middle - 1]! + ordered[middle]!) / 2
    : ordered[middle]!;
}

function canonicalSegment(segment: DetectedLineSegment): DetectedLineSegment {
  if (segment.x1 < segment.x2 || (segment.x1 === segment.x2 && segment.y1 <= segment.y2)) return segment;
  return { x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 };
}

function segmentKey(segment: DetectedLineSegment): string {
  const canonical = canonicalSegment(segment);
  return [canonical.x1, canonical.y1, canonical.x2, canonical.y2]
    .map((value) => Math.round(value * 10) / 10)
    .join(":");
}

function normalizedFrameAngle(angle: number): number {
  let value = angle % 90;
  if (value < 0) value += 90;
  if (value > 45) value -= 90;
  return value;
}

function dominantFrame(
  segments: readonly DetectedLineSegment[],
  minimumLengthPx: number,
): number | null {
  const bins = new Map<number, number>();
  let totalWeight = 0;
  for (const segment of segments) {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const lengthPx = distance(start, end);
    if (lengthPx < minimumLengthPx) continue;
    const frame = normalizedFrameAngle(angleDeg(start, end));
    const bin = Math.round(frame / 2) * 2;
    bins.set(bin, (bins.get(bin) ?? 0) + lengthPx);
    totalWeight += lengthPx;
  }
  if (bins.size === 0 || totalWeight <= 0) return null;
  const ranked = [...bins.entries()].sort((first, second) =>
    second[1] - first[1] || Math.abs(first[0]) - Math.abs(second[0]) || first[0] - second[0]);
  const [angle, weight] = ranked[0]!;
  if (weight / totalWeight < 0.34) return null;
  return Math.abs(angle) <= 6 ? 0 : angle;
}

function frameAxes(frameDeg: number, family: 0 | 1): Readonly<{ tangent: Point; normal: Point; angle: number }> {
  const angle = frameDeg + family * 90;
  const radians = angle * Math.PI / 180;
  const tangent = { x: Math.cos(radians), y: Math.sin(radians) };
  return {
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    angle: ((angle % 180) + 180) % 180,
  };
}

function nearestFamily(segmentAngle: number, frameDeg: number): Readonly<{ family: 0 | 1; delta: number }> {
  const first = ((frameDeg % 180) + 180) % 180;
  const second = (first + 90) % 180;
  const firstDelta = angleDelta(segmentAngle, first);
  const secondDelta = angleDelta(segmentAngle, second);
  return firstDelta <= secondDelta
    ? { family: 0, delta: firstDelta }
    : { family: 1, delta: secondDelta };
}

function inkIntervals(values: readonly boolean[]): readonly Readonly<{ start: number; end: number }>[] {
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
  return intervals;
}

function measureCrossSection(
  point: Point,
  normal: Point,
  mask: StructuralMaskView,
): Readonly<{ centerOffset: number; thickness: number }> | null {
  const offsets = Array.from({ length: MAX_CROSS_SECTION_PX * 2 + 1 }, (_value, index) => index - MAX_CROSS_SECTION_PX);
  const values = offsets.map((offset) => {
    const sample = add(point, scale(normal, offset));
    return mask.isStructural(Math.round(sample.x), Math.round(sample.y));
  });
  const intervals = inkIntervals(values);
  if (intervals.length === 0) return null;
  const centerIndex = MAX_CROSS_SECTION_PX;
  const ranked = intervals.map((interval) => {
    const intervalCenter = (interval.start + interval.end) / 2;
    const containsAxis = interval.start <= centerIndex && interval.end >= centerIndex;
    const distanceToAxis = containsAxis
      ? 0
      : Math.min(Math.abs(interval.start - centerIndex), Math.abs(interval.end - centerIndex));
    return { interval, intervalCenter, containsAxis, distanceToAxis };
  }).sort((first, second) =>
    Number(second.containsAxis) - Number(first.containsAxis)
    || first.distanceToAxis - second.distanceToAxis
    || (second.interval.end - second.interval.start) - (first.interval.end - first.interval.start));
  const selected = ranked[0]!;
  if (!selected.containsAxis && selected.distanceToAxis > 6) return null;
  return {
    centerOffset: selected.intervalCenter - centerIndex,
    thickness: selected.interval.end - selected.interval.start + 1,
  };
}

function measureSegment(
  segment: DetectedLineSegment,
  frameDeg: number,
  options: ThinStructuralRecoveryOptions,
  mask: StructuralMaskView,
): MeasuredLine | null {
  const sourceStart = { x: segment.x1, y: segment.y1 };
  const sourceEnd = { x: segment.x2, y: segment.y2 };
  const sourceLength = distance(sourceStart, sourceEnd);
  if (sourceLength < options.minimumSegmentLengthPx) return null;
  const familyMatch = nearestFamily(angleDeg(sourceStart, sourceEnd), frameDeg);
  if (familyMatch.delta > options.angleToleranceDeg) return null;
  const axes = frameAxes(frameDeg, familyMatch.family);
  const startAlong = dot(sourceStart, axes.tangent);
  const endAlong = dot(sourceEnd, axes.tangent);
  const minimum = Math.min(startAlong, endAlong);
  const maximum = Math.max(startAlong, endAlong);
  const baseAxis = (dot(sourceStart, axes.normal) + dot(sourceEnd, axes.normal)) / 2;
  const sampleCount = Math.max(5, Math.min(MAX_ALONG_SAMPLES, Math.ceil((maximum - minimum) / 8)));
  const centerOffsets: number[] = [];
  const thicknesses: number[] = [];
  for (let index = 0; index < sampleCount; index += 1) {
    const along = minimum + (maximum - minimum) * (index + 0.5) / sampleCount;
    const point = add(scale(axes.tangent, along), scale(axes.normal, baseAxis));
    const measurement = measureCrossSection(point, axes.normal, mask);
    if (!measurement) continue;
    centerOffsets.push(measurement.centerOffset);
    thicknesses.push(measurement.thickness);
  }
  const supportRatio = centerOffsets.length / sampleCount;
  if (supportRatio < options.minimumSupportedSampleRatio) return null;
  const axis = baseAxis + median(centerOffsets);
  const thicknessPx = median(thicknesses);
  if (thicknessPx < 1 || thicknessPx > 140) return null;
  const start = add(scale(axes.tangent, minimum), scale(axes.normal, axis));
  const end = add(scale(axes.tangent, maximum), scale(axes.normal, axis));
  return {
    sourceKey: segmentKey(segment),
    family: familyMatch.family,
    frameDeg,
    tangent: axes.tangent,
    normal: axes.normal,
    axis,
    minimum,
    maximum,
    lengthPx: maximum - minimum,
    thicknessPx,
    supportRatio,
    start,
    end,
  };
}

function overlapLength(first: MeasuredLine, second: MeasuredLine): number {
  return Math.max(0, Math.min(first.maximum, second.maximum) - Math.max(first.minimum, second.minimum));
}

function corridorFillRatio(first: MeasuredLine, second: MeasuredLine, mask: StructuralMaskView): number {
  if (first.family !== second.family) return 0;
  const minimum = Math.max(first.minimum, second.minimum);
  const maximum = Math.min(first.maximum, second.maximum);
  if (maximum <= minimum) return 0;
  const axisMinimum = Math.min(first.axis, second.axis);
  const axisMaximum = Math.max(first.axis, second.axis);
  const alongSamples = Math.max(5, Math.min(32, Math.ceil((maximum - minimum) / 10)));
  const acrossSamples = Math.max(3, Math.min(24, Math.ceil(axisMaximum - axisMinimum + 1)));
  let total = 0;
  let ink = 0;
  for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
    const along = minimum + (maximum - minimum) * (alongIndex + 0.5) / alongSamples;
    for (let acrossIndex = 0; acrossIndex < acrossSamples; acrossIndex += 1) {
      const axis = axisMinimum + (axisMaximum - axisMinimum) * (acrossIndex + 0.5) / acrossSamples;
      const point = add(scale(first.tangent, along), scale(first.normal, axis));
      total += 1;
      if (mask.isStructural(Math.round(point.x), Math.round(point.y))) ink += 1;
    }
  }
  return ink / Math.max(1, total);
}

function mergeMeasuredLines(lines: readonly MeasuredLine[]): MeasuredLine[] {
  const pending = [...lines].sort((first, second) =>
    first.family - second.family
    || first.axis - second.axis
    || first.minimum - second.minimum
    || first.maximum - second.maximum
    || first.sourceKey.localeCompare(second.sourceKey));
  const merged: MeasuredLine[] = [];
  for (const line of pending) {
    const existingIndex = merged.findIndex((existing) =>
      existing.family === line.family
      && Math.abs(existing.axis - line.axis) <= Math.max(3, Math.min(existing.thicknessPx, line.thicknessPx) * 0.35)
      && line.minimum <= existing.maximum + 18
      && line.maximum >= existing.minimum - 18);
    if (existingIndex < 0) {
      merged.push(line);
      continue;
    }
    const existing = merged[existingIndex]!;
    const totalWeight = existing.lengthPx + line.lengthPx;
    const axis = (existing.axis * existing.lengthPx + line.axis * line.lengthPx) / totalWeight;
    const minimum = Math.min(existing.minimum, line.minimum);
    const maximum = Math.max(existing.maximum, line.maximum);
    merged[existingIndex] = {
      ...existing,
      sourceKey: [existing.sourceKey, line.sourceKey].sort().join("+"),
      axis,
      minimum,
      maximum,
      lengthPx: maximum - minimum,
      thicknessPx: Math.max(existing.thicknessPx, line.thicknessPx),
      supportRatio: Math.min(existing.supportRatio, line.supportRatio),
      start: add(scale(existing.tangent, minimum), scale(existing.normal, axis)),
      end: add(scale(existing.tangent, maximum), scale(existing.normal, axis)),
    };
  }
  return merged.sort((first, second) =>
    first.family - second.family
    || first.axis - second.axis
    || first.minimum - second.minimum
    || first.maximum - second.maximum);
}

function removeParallelSymbolRails(
  lines: readonly MeasuredLine[],
  mask: StructuralMaskView,
  diagnostics: RecognitionDiagnostic[],
): MeasuredLine[] {
  const rejected = new Set<number>();
  for (let firstIndex = 0; firstIndex < lines.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < lines.length; secondIndex += 1) {
      const first = lines[firstIndex]!;
      const second = lines[secondIndex]!;
      if (first.family !== second.family) continue;
      const axisDistance = Math.abs(first.axis - second.axis);
      if (axisDistance < 4 || axisDistance > PARALLEL_RAIL_MAX_DISTANCE_PX) continue;
      const overlap = overlapLength(first, second);
      const overlapRatio = overlap / Math.max(1, Math.min(first.lengthPx, second.lengthPx));
      if (overlapRatio < 0.8) continue;
      if (corridorFillRatio(first, second, mask) >= 0.55) continue;
      rejected.add(firstIndex);
      rejected.add(secondIndex);
      diagnostics.push({
        code: "thin-wall-parallel-symbol-rails-rejected",
        severity: "info",
        message: "Близкие параллельные линии с пустым промежутком оставлены как оконные/условные направляющие, а не стены.",
        candidateId: null,
      });
    }
  }
  return lines.filter((_line, index) => !rejected.has(index));
}

function pointToSegmentDistance(point: Point, start: Point, end: Point): number {
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= EPSILON) return distance(point, start);
  const ratio = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1);
  return distance(point, { x: start.x + dx * ratio, y: start.y + dy * ratio });
}

function primaryPixels(candidate: RecognitionWallCandidate, widthPx: number, heightPx: number): PrimaryPixelWall {
  return {
    id: candidate.id,
    start: { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx },
    end: { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx },
    thicknessPx: Math.max(1, candidate.estimatedThicknessPx ?? 20),
  };
}

function physicalDuplicate(
  line: MeasuredLine,
  primaries: readonly PrimaryPixelWall[],
): boolean {
  return primaries.some((primary) => {
    const primaryAngle = angleDeg(primary.start, primary.end);
    const lineAngle = angleDeg(line.start, line.end);
    if (angleDelta(primaryAngle, lineAngle) > 8) return false;
    const lineMidpoint = scale(add(line.start, line.end), 0.5);
    if (pointToSegmentDistance(lineMidpoint, primary.start, primary.end) > Math.max(10, line.thicknessPx)) return false;
    const primaryLength = distance(primary.start, primary.end);
    const overlapProxy = Math.min(
      pointToSegmentDistance(line.start, primary.start, primary.end),
      pointToSegmentDistance(line.end, primary.start, primary.end),
    );
    return primaryLength > 0 && overlapProxy <= Math.max(12, line.thicknessPx);
  });
}

function linesConnected(first: MeasuredLine, second: MeasuredLine, tolerancePx: number): boolean {
  if (distance(first.start, second.start) <= tolerancePx
    || distance(first.start, second.end) <= tolerancePx
    || distance(first.end, second.start) <= tolerancePx
    || distance(first.end, second.end) <= tolerancePx) return true;
  return pointToSegmentDistance(first.start, second.start, second.end) <= tolerancePx
    || pointToSegmentDistance(first.end, second.start, second.end) <= tolerancePx
    || pointToSegmentDistance(second.start, first.start, first.end) <= tolerancePx
    || pointToSegmentDistance(second.end, first.start, first.end) <= tolerancePx;
}

function components(lines: readonly MeasuredLine[], tolerancePx: number): number[][] {
  const visited = new Set<number>();
  const output: number[][] = [];
  for (let seed = 0; seed < lines.length; seed += 1) {
    if (visited.has(seed)) continue;
    const stack = [seed];
    const component: number[] = [];
    while (stack.length > 0) {
      const current = stack.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      component.push(current);
      for (let candidate = 0; candidate < lines.length; candidate += 1) {
        if (!visited.has(candidate) && linesConnected(lines[current]!, lines[candidate]!, tolerancePx)) {
          stack.push(candidate);
        }
      }
    }
    output.push(component.sort((first, second) => first - second));
  }
  return output;
}

function endpointAnchoredToPrimary(
  endpoint: Point,
  primaries: readonly PrimaryPixelWall[],
  tolerancePx: number,
): boolean {
  return primaries.some((primary) =>
    pointToSegmentDistance(endpoint, primary.start, primary.end) <= tolerancePx);
}

function boundaryAnchor(point: Point, widthPx: number, heightPx: number, marginPx: number): boolean {
  return point.x <= marginPx
    || point.y <= marginPx
    || point.x >= widthPx - marginPx
    || point.y >= heightPx - marginPx;
}

function projectPrimaryToLine(
  primary: PrimaryPixelWall,
  line: MeasuredLine,
): ProjectedPrimaryWall | null {
  if (angleDelta(angleDeg(primary.start, primary.end), angleDeg(line.start, line.end)) > 8) return null;
  const axis = (dot(primary.start, line.normal) + dot(primary.end, line.normal)) / 2;
  const axisTolerance = Math.max(6, Math.min(primary.thicknessPx, line.thicknessPx) * 0.4);
  if (Math.abs(axis - line.axis) > axisTolerance) return null;
  const thicknessRatio = Math.max(primary.thicknessPx, line.thicknessPx)
    / Math.max(1, Math.min(primary.thicknessPx, line.thicknessPx));
  if (thicknessRatio > MAX_PRIMARY_THICKNESS_RATIO) return null;
  const first = dot(primary.start, line.tangent);
  const second = dot(primary.end, line.tangent);
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);
  const lengthPx = maximum - minimum;
  if (lengthPx < MIN_PRIMARY_ANCHOR_LENGTH_PX) return null;
  return { source: primary, minimum, maximum, axis, lengthPx };
}

function boundedShortStructuralRun(
  line: MeasuredLine,
  primaries: readonly PrimaryPixelWall[],
): boolean {
  if (
    line.lengthPx < Math.max(
      MIN_SHORT_SEPARATOR_LENGTH_PX,
      line.thicknessPx * MIN_SHORT_SEPARATOR_LENGTH_THICKNESS_RATIO,
    )
    || line.lengthPx > MAX_SHORT_SEPARATOR_LENGTH_PX
    || line.supportRatio < MIN_SHORT_SEPARATOR_SUPPORT_RATIO
  ) return false;

  const projected = primaries
    .map((primary) => projectPrimaryToLine(primary, line))
    .filter((primary): primary is ProjectedPrimaryWall => primary !== null);
  const before = projected.filter((primary) => primary.maximum <= line.minimum + EPSILON);
  const after = projected.filter((primary) => primary.minimum >= line.maximum - EPSILON);
  return before.some((left) => after.some((right) => {
    if (left.source.id === right.source.id) return false;
    const leftGap = line.minimum - left.maximum;
    const rightGap = right.minimum - line.maximum;
    return leftGap >= MIN_SHORT_SEPARATOR_GAP_PX
      && leftGap <= MAX_SHORT_SEPARATOR_GAP_PX
      && rightGap >= MIN_SHORT_SEPARATOR_GAP_PX
      && rightGap <= MAX_SHORT_SEPARATOR_GAP_PX;
  }));
}

function componentBounds(lines: readonly MeasuredLine[]) {
  const points = lines.flatMap((line) => [line.start, line.end]);
  return {
    minimumX: Math.min(...points.map((point) => point.x)),
    maximumX: Math.max(...points.map((point) => point.x)),
    minimumY: Math.min(...points.map((point) => point.y)),
    maximumY: Math.max(...points.map((point) => point.y)),
  };
}

function smallEnclosure(lines: readonly MeasuredLine[], shortSide: number): boolean {
  if (lines.length < 3) return false;
  const bounds = componentBounds(lines);
  const width = bounds.maximumX - bounds.minimumX;
  const height = bounds.maximumY - bounds.minimumY;
  const totalLength = lines.reduce((sum, line) => sum + line.lengthPx, 0);
  return width <= shortSide * 0.25
    && height <= shortSide * 0.25
    && totalLength <= shortSide * 0.65;
}

function geometryId(line: MeasuredLine): string {
  const values = [line.start.x, line.start.y, line.end.x, line.end.y, line.thicknessPx]
    .map((value) => Math.round(value * 10));
  return `thin-wall-${values.join("-")}`;
}

function recoveredCandidate(
  line: MeasuredLine,
  widthPx: number,
  heightPx: number,
  reasons: readonly string[],
): RecognitionWallCandidate {
  return {
    id: geometryId(line),
    start: { x: clamp(line.start.x / widthPx, 0, 1), y: clamp(line.start.y / heightPx, 0, 1) },
    end: { x: clamp(line.end.x / widthPx, 0, 1), y: clamp(line.end.y / heightPx, 0, 1) },
    estimatedThicknessPx: line.thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.78, 0.64 + line.supportRatio * 0.18),
      cloudScore: null,
      reasons: [...new Set([
        "thin-ink-structural-component",
        ...reasons,
      ])].sort(),
    },
    origin: "local",
    conflict: null,
  };
}

function preserve(
  primaryWalls: readonly RecognitionWallCandidate[],
  diagnostic: RecognitionDiagnostic | null,
): ThinStructuralRecoveryResult {
  return {
    walls: [...primaryWalls].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls: [],
    acceptedComponentCount: 0,
    dominantFrameDeg: null,
    diagnostics: diagnostic ? [diagnostic] : [],
  };
}

export function recoverThinStructuralWalls(input: Readonly<{
  widthPx: number;
  heightPx: number;
  primaryWalls: readonly RecognitionWallCandidate[];
  segments: readonly DetectedLineSegment[];
  inkMask: StructuralMaskView;
  options?: Partial<ThinStructuralRecoveryOptions>;
}>): ThinStructuralRecoveryResult {
  const widthPx = finitePositive(input.widthPx, "Ширина изображения");
  const heightPx = finitePositive(input.heightPx, "Высота изображения");
  const options = { ...DEFAULT_THIN_STRUCTURAL_RECOVERY_OPTIONS, ...input.options };
  if (input.inkMask.widthPx !== widthPx || input.inkMask.heightPx !== heightPx) {
    return preserve(input.primaryWalls, {
      code: "thin-wall-recovery-invalid-mask",
      severity: "warning",
      message: "Восстановление тонких стен пропущено из-за несовпадающих размеров ink mask.",
      candidateId: null,
    });
  }
  const comparisons = input.segments.length * Math.max(0, input.segments.length - 1) / 2;
  if (input.segments.length > options.maximumSegments || comparisons > options.maximumPairComparisons * 40) {
    return preserve(input.primaryWalls, {
      code: "thin-wall-recovery-budget-exceeded",
      severity: "warning",
      message: "Восстановление тонких стен пропущено из-за безопасного лимита исходных линий.",
      candidateId: null,
    });
  }
  const orderedSegments = [...input.segments].sort((first, second) => segmentKey(first).localeCompare(segmentKey(second)));
  const frameDeg = dominantFrame(orderedSegments, options.minimumSegmentLengthPx);
  if (frameDeg === null) return preserve(input.primaryWalls, null);

  const diagnostics: RecognitionDiagnostic[] = [];
  const measured = orderedSegments
    .map((segment) => measureSegment(segment, frameDeg, options, input.inkMask))
    .filter((line): line is MeasuredLine => line !== null);
  let canonical = mergeMeasuredLines(measured);
  canonical = removeParallelSymbolRails(canonical, input.inkMask, diagnostics);
  if (canonical.length > options.maximumCandidates) {
    return preserve(input.primaryWalls, {
      code: "thin-wall-recovery-budget-exceeded",
      severity: "warning",
      message: "Восстановление тонких стен пропущено из-за безопасного лимита измеренных кандидатов.",
      candidateId: null,
    });
  }

  const primaryPixelWalls = input.primaryWalls
    .filter((candidate) => candidate.conflict === null)
    .map((candidate) => primaryPixels(candidate, widthPx, heightPx));
  canonical = canonical.filter((line) => !physicalDuplicate(line, primaryPixelWalls));
  const componentIndexes = components(canonical, options.endpointTolerancePx);
  const shortSide = Math.min(widthPx, heightPx);
  const acceptedLines: MeasuredLine[] = [];
  let acceptedComponentCount = 0;

  for (const indexes of componentIndexes) {
    const componentLines = indexes.map((index) => canonical[index]!);
    if (smallEnclosure(componentLines, shortSide)) {
      diagnostics.push({
        code: "thin-wall-small-enclosure-rejected",
        severity: "info",
        message: "Малый замкнутый компонент оставлен как условное обозначение, а не стена.",
        candidateId: null,
      });
      continue;
    }
    const endpoints = componentLines.flatMap((line) => [line.start, line.end]);
    const primaryAnchorCount = endpoints.filter((endpoint) =>
      endpointAnchoredToPrimary(endpoint, primaryPixelWalls, options.endpointTolerancePx)).length;
    const boundaryAnchorCount = endpoints.filter((endpoint) =>
      boundaryAnchor(endpoint, widthPx, heightPx, options.boundaryMarginPx)).length;
    const totalLength = componentLines.reduce((sum, line) => sum + line.lengthPx, 0);
    const longSingleBoundaryWall = componentLines.length === 1
      && primaryAnchorCount >= 1
      && boundaryAnchorCount >= 1
      && totalLength >= shortSide * 0.35;
    const boundedNetworkComponent = componentLines.length >= 2
      && primaryAnchorCount >= 1
      && totalLength >= shortSide * 0.5;
    const doublyAnchoredSingle = componentLines.length === 1
      && primaryAnchorCount >= 2
      && totalLength >= shortSide * 0.25;
    const boundedShortRun = componentLines.length === 1
      && boundedShortStructuralRun(componentLines[0]!, primaryPixelWalls);
    if (!longSingleBoundaryWall && !boundedNetworkComponent && !doublyAnchoredSingle && !boundedShortRun) continue;
    acceptedComponentCount += 1;
    const reasons = [
      ...(componentLines.length >= 2 ? ["bounded-thin-wall-component"] : []),
      ...(boundaryAnchorCount > 0 ? ["image-boundary-anchor"] : []),
      ...(primaryAnchorCount > 0 ? ["primary-wall-anchor"] : []),
      ...(boundedShortRun ? ["bounded-short-structural-run"] : []),
    ];
    for (const line of componentLines) {
      if (acceptedLines.length >= options.maximumRecoveredWalls) break;
      acceptedLines.push({ ...line, sourceKey: `${line.sourceKey}|${reasons.join("|")}` });
    }
  }

  const recoveredWalls = acceptedLines.map((line) => {
    const reasons = line.sourceKey.split("|").slice(1);
    return recoveredCandidate(line, widthPx, heightPx, reasons);
  }).sort((first, second) => first.id.localeCompare(second.id));
  return {
    walls: [...input.primaryWalls, ...recoveredWalls].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls,
    acceptedComponentCount,
    dominantFrameDeg: frameDeg,
    diagnostics: diagnostics.sort((first, second) =>
      first.code.localeCompare(second.code)
      || (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import type { WindowHostProposalEvidence } from "./window-host-consolidation";

export type WindowBoundaryBandRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  proposalEvidence: readonly WindowHostProposalEvidence[];
  diagnostics: readonly string[];
}>;

type Axis = "horizontal" | "vertical";
type Segment = Readonly<{
  source: DetectedLineSegment;
  axis: Axis;
  start: number;
  end: number;
  across: number;
  length: number;
}>;
type Wall = Readonly<{
  candidate: RecognitionWallCandidate;
  axis: Axis;
  start: number;
  end: number;
  acrossStart: number;
  acrossEnd: number;
  length: number;
  thicknessPx: number;
}>;
type Rails = Readonly<{
  axis: Axis;
  start: number;
  end: number;
  across: number;
  minimumAcross: number;
  maximumAcross: number;
  count: number;
}>;
type Jamb = Readonly<{
  side: "start" | "end";
  innerAlong: number;
  centerAlong: number;
  thicknessPx: number;
}>;
type Recovery = Readonly<{ wall: RecognitionWallCandidate; evidence: WindowHostProposalEvidence }>;

const MAX_WALLS = 64;
const MAX_SEGMENTS = 512;
const MAX_RECOVERIES = 8;
const AXIS_TOLERANCE_DEG = 8;
const MIN_RAIL_LENGTH = 30;
const MAX_RAIL_LENGTH = 240;
const MIN_RAIL_COUNT = 4;
const ENDPOINT_TOLERANCE = 18;
const MIN_RAIL_SPREAD = 6;
const MAX_RAIL_SPREAD = 40;
const ACROSS_DEDUP = 1.5;
const MAX_RAIL_MASK_SUPPORT = 0.35;
const MIN_JAMB_LENGTH = 18;
const MAX_JAMB_LENGTH = 47;
const MIN_JAMB_SEPARATION = 3;
const MAX_JAMB_SEPARATION = 12;
const MAX_JAMB_ENDPOINT_DISTANCE = 14;
const MIN_JAMB_OVERLAP = 0.7;
const MIN_JAMB_MASK_SUPPORT = 0.75;
const MIN_ANCHOR_LENGTH = 80;
const MIN_ANCHOR_DISTANCE = 12;
const MAX_ANCHOR_DISTANCE = 60;
const MIN_DOWNSTREAM_LENGTH = 60;
const MIN_DOWNSTREAM_DISTANCE = 40;
const MAX_DOWNSTREAM_DISTANCE = 220;
const MAX_AXIS_DISTANCE = 8;
const MIN_DUPLICATE_OVERLAP = 40;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}
function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : (sorted[middle - 1]! + sorted[middle]!) / 2;
}
function angle(segment: DetectedLineSegment): number {
  return ((Math.atan2(segment.y2 - segment.y1, segment.x2 - segment.x1) * 180 / Math.PI) + 180) % 180;
}
function axisFor(segment: DetectedLineSegment): Axis | null {
  const value = angle(segment);
  if (Math.min(value, 180 - value) <= AXIS_TOLERANCE_DEG) return "horizontal";
  if (Math.abs(value - 90) <= AXIS_TOLERANCE_DEG) return "vertical";
  return null;
}
function coordinate(axis: Axis, x: number, y: number): Readonly<{ along: number; across: number }> {
  return axis === "horizontal" ? { along: x, across: y } : { along: y, across: x };
}
function point(axis: Axis, along: number, across: number): Readonly<{ x: number; y: number }> {
  return axis === "horizontal" ? { x: along, y: across } : { x: across, y: along };
}
function segmentGeometry(source: DetectedLineSegment): Segment | null {
  const axis = axisFor(source);
  if (!axis) return null;
  const first = coordinate(axis, source.x1, source.y1);
  const second = coordinate(axis, source.x2, source.y2);
  const start = Math.min(first.along, second.along);
  const end = Math.max(first.along, second.along);
  if (end - start <= EPSILON) return null;
  return { source, axis, start, end, across: (first.across + second.across) / 2, length: end - start };
}
function wallGeometry(candidate: RecognitionWallCandidate, widthPx: number, heightPx: number): Wall | null {
  const source = {
    x1: candidate.start.x * widthPx,
    y1: candidate.start.y * heightPx,
    x2: candidate.end.x * widthPx,
    y2: candidate.end.y * heightPx,
  };
  const segment = segmentGeometry(source);
  if (!segment) return null;
  const first = coordinate(segment.axis, source.x1, source.y1);
  const second = coordinate(segment.axis, source.x2, source.y2);
  return {
    candidate,
    axis: segment.axis,
    start: segment.start,
    end: segment.end,
    acrossStart: first.across,
    acrossEnd: second.across,
    length: segment.length,
    thicknessPx: candidate.estimatedThicknessPx ?? 20,
  };
}
function support(mask: StructuralMaskView, source: DetectedLineSegment, samples = 17): number {
  let count = 0;
  for (let index = 0; index < samples; index += 1) {
    const ratio = (index + 0.5) / samples;
    const x = source.x1 + (source.x2 - source.x1) * ratio;
    const y = source.y1 + (source.y2 - source.y1) * ratio;
    if (mask.isStructural(Math.floor(x), Math.floor(y))) count += 1;
  }
  return count / samples;
}
function dedupeAcross(values: readonly Segment[]): Segment[] {
  const result: Segment[] = [];
  for (const value of [...values].sort((a, b) => a.across - b.across || b.length - a.length)) {
    const previous = result[result.length - 1];
    if (previous && Math.abs(previous.across - value.across) <= ACROSS_DEDUP) {
      if (value.length > previous.length) result[result.length - 1] = value;
    } else result.push(value);
  }
  return result;
}
function railGroups(symbols: readonly DetectedLineSegment[], mask: StructuralMaskView): Rails[] {
  const rails = symbols.map(segmentGeometry)
    .filter((value): value is Segment => value !== null)
    .filter(({ length, source }) =>
      length >= MIN_RAIL_LENGTH && length <= MAX_RAIL_LENGTH && support(mask, source) <= MAX_RAIL_MASK_SUPPORT);
  const byKey = new Map<string, Rails>();
  for (const seed of rails) {
    const group = dedupeAcross(rails.filter((candidate) =>
      candidate.axis === seed.axis
      && Math.abs(candidate.start - seed.start) <= ENDPOINT_TOLERANCE
      && Math.abs(candidate.end - seed.end) <= ENDPOINT_TOLERANCE
      && Math.abs(candidate.across - seed.across) <= MAX_RAIL_SPREAD));
    if (group.length < MIN_RAIL_COUNT) continue;
    const across = group.map((item) => item.across);
    const minimumAcross = Math.min(...across);
    const maximumAcross = Math.max(...across);
    if (maximumAcross - minimumAcross < MIN_RAIL_SPREAD || maximumAcross - minimumAcross > MAX_RAIL_SPREAD) continue;
    const candidate: Rails = {
      axis: seed.axis,
      start: median(group.map((item) => item.start)),
      end: median(group.map((item) => item.end)),
      across: median(across),
      minimumAcross,
      maximumAcross,
      count: group.length,
    };
    const key = [candidate.axis, Math.round(candidate.start), Math.round(candidate.end), Math.round(candidate.across)].join(":");
    const old = byKey.get(key);
    if (!old || candidate.count > old.count) byKey.set(key, candidate);
  }
  return [...byKey.values()].sort((a, b) =>
    a.axis.localeCompare(b.axis) || a.start - b.start || a.end - b.end || a.across - b.across);
}
function jambPair(group: Rails, symbols: readonly DetectedLineSegment[], mask: StructuralMaskView): Jamb | null {
  const perpendicular: Axis = group.axis === "horizontal" ? "vertical" : "horizontal";
  const jambs = symbols.map(segmentGeometry)
    .filter((value): value is Segment => value !== null && value.axis === perpendicular)
    .filter(({ source, length }) =>
      length >= MIN_JAMB_LENGTH && length <= MAX_JAMB_LENGTH && support(mask, source) >= MIN_JAMB_MASK_SUPPORT)
    .sort((a, b) => a.across - b.across || a.start - b.start);
  const result: Jamb[] = [];
  for (let i = 0; i < jambs.length; i += 1) {
    for (let j = i + 1; j < jambs.length; j += 1) {
      const first = jambs[i]!;
      const second = jambs[j]!;
      const separation = Math.abs(first.across - second.across);
      if (separation < MIN_JAMB_SEPARATION || separation > MAX_JAMB_SEPARATION) continue;
      const overlapStart = Math.max(first.start, second.start);
      const overlapEnd = Math.min(first.end, second.end);
      const overlap = overlapEnd - overlapStart;
      if (overlap <= 0 || overlap / Math.min(first.length, second.length) < MIN_JAMB_OVERLAP) continue;
      if (overlapStart > group.minimumAcross - 4 || overlapEnd < group.maximumAcross + 4) continue;
      const centerAlong = (first.across + second.across) / 2;
      const startDistance = Math.abs(centerAlong - group.start);
      const endDistance = Math.abs(centerAlong - group.end);
      if (Math.min(startDistance, endDistance) > MAX_JAMB_ENDPOINT_DISTANCE) continue;
      const side = startDistance < endDistance ? "start" as const : "end" as const;
      result.push({
        side,
        innerAlong: side === "end" ? Math.min(first.across, second.across) : Math.max(first.across, second.across),
        centerAlong,
        thicknessPx: (first.length + second.length) / 2,
      });
    }
  }
  return result.sort((a, b) =>
    Math.abs(a.centerAlong - (a.side === "end" ? group.end : group.start))
    - Math.abs(b.centerAlong - (b.side === "end" ? group.end : group.start)))[0] ?? null;
}
function anchorFor(group: Rails, jamb: Jamb, walls: readonly Wall[]): Readonly<{ wall: Wall; along: number }> | null {
  const perpendicular: Axis = group.axis === "horizontal" ? "vertical" : "horizontal";
  const railEdge = jamb.side === "end" ? group.start : group.end;
  const values = walls.flatMap((wall) => {
    if (wall.candidate.conflict !== null || wall.axis !== perpendicular || wall.length < MIN_ANCHOR_LENGTH) return [];
    if (group.across < wall.start - MAX_AXIS_DISTANCE || group.across > wall.end + MAX_AXIS_DISTANCE) return [];
    const along = (wall.acrossStart + wall.acrossEnd) / 2;
    const distance = jamb.side === "end" ? railEdge - along : along - railEdge;
    if (distance < MIN_ANCHOR_DISTANCE || distance > MAX_ANCHOR_DISTANCE) return [];
    return [{ wall, along }];
  });
  return values.sort((a, b) => Math.abs(a.along - railEdge) - Math.abs(b.along - railEdge))[0] ?? null;
}
function downstreamFor(group: Rails, jamb: Jamb, walls: readonly Wall[]): Wall | null {
  return walls.filter((wall) => {
    if (wall.candidate.conflict !== null || wall.axis !== group.axis || wall.length < MIN_DOWNSTREAM_LENGTH) return false;
    if (Math.abs((wall.acrossStart + wall.acrossEnd) / 2 - group.across) > MAX_AXIS_DISTANCE) return false;
    const nearest = jamb.side === "end" ? wall.start : wall.end;
    const distance = jamb.side === "end" ? nearest - jamb.centerAlong : jamb.centerAlong - nearest;
    return distance >= MIN_DOWNSTREAM_DISTANCE && distance <= MAX_DOWNSTREAM_DISTANCE;
  }).sort((a, b) => {
    const da = jamb.side === "end" ? a.start - jamb.centerAlong : jamb.centerAlong - a.end;
    const db = jamb.side === "end" ? b.start - jamb.centerAlong : jamb.centerAlong - b.end;
    return da - db || a.candidate.id.localeCompare(b.candidate.id);
  })[0] ?? null;
}
function overlapsExisting(group: Rails, walls: readonly Wall[]): boolean {
  return walls.some((wall) => {
    if (wall.candidate.conflict !== null || wall.axis !== group.axis) return false;
    if (Math.abs((wall.acrossStart + wall.acrossEnd) / 2 - group.across) > MAX_AXIS_DISTANCE) return false;
    const overlap = Math.min(wall.end, group.end) - Math.max(wall.start, group.start);
    return overlap >= Math.min(MIN_DUPLICATE_OVERLAP, (group.end - group.start) * 0.4);
  });
}
function recover(
  group: Rails,
  walls: readonly Wall[],
  symbols: readonly DetectedLineSegment[],
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): Recovery | null {
  if (overlapsExisting(group, walls)) return null;
  const jamb = jambPair(group, symbols, mask);
  if (!jamb) return null;
  const anchor = anchorFor(group, jamb, walls);
  const downstream = downstreamFor(group, jamb, walls);
  if (!anchor || !downstream) return null;
  const hostStartAlong = Math.min(anchor.along, jamb.centerAlong);
  const hostEndAlong = Math.max(anchor.along, jamb.centerAlong);
  const gapStartAlong = jamb.side === "end" ? group.start : jamb.innerAlong;
  const gapEndAlong = jamb.side === "end" ? jamb.innerAlong : group.end;
  const width = gapEndAlong - gapStartAlong;
  if (width < MIN_RAIL_LENGTH || width > MAX_RAIL_LENGTH) return null;
  const startPx = point(group.axis, hostStartAlong, group.across);
  const endPx = point(group.axis, hostEndAlong, group.across);
  const gapStart = point(group.axis, gapStartAlong, group.across);
  const gapEnd = point(group.axis, gapEndAlong, group.across);
  const center = point(group.axis, (gapStartAlong + gapEndAlong) / 2, group.across);
  const id = `local-window-band-${anchor.wall.candidate.id}--${downstream.candidate.id}-${Math.round(group.across * 10)}`;
  const evidence: WindowHostProposalEvidence = {
    sourceWallCandidateIds: [anchor.wall.candidate.id, downstream.candidate.id],
    bridgeKind: "symbol",
    openingEligible: true,
    gap: { start: gapStart, end: gapEnd, center, widthPx: width, orientationDeg: group.axis === "horizontal" ? 0 : 90 },
    generatedHost: { candidateId: id, start: startPx, end: endPx },
  };
  const wall: RecognitionWallCandidate & Readonly<{
    windowHostProposalEvidence: WindowHostProposalEvidence;
    windowHostProposalEvidenceList: readonly WindowHostProposalEvidence[];
  }> = {
    id,
    start: { x: clamp(startPx.x / widthPx, 0, 1), y: clamp(startPx.y / heightPx, 0, 1) },
    end: { x: clamp(endPx.x / widthPx, 0, 1), y: clamp(endPx.y / heightPx, 0, 1) },
    estimatedThicknessPx: clamp((jamb.thicknessPx + downstream.thicknessPx) / 2, 8, 80),
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: [
        "paired-window-rails",
        "perpendicular-structural-anchor",
        "short-terminal-jamb-evidence",
        "window-boundary-band-recovery",
        "window-host-proposal-evidence",
      ],
    },
    origin: "local",
    conflict: null,
    windowHostProposalEvidence: evidence,
    windowHostProposalEvidenceList: [evidence],
  };
  return { wall, evidence };
}

export function recoverWindowBoundaryBands(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  structuralMask: StructuralMaskView;
}>): WindowBoundaryBandRecoveryResult {
  if (
    !Number.isFinite(input.widthPx) || input.widthPx <= 0
    || !Number.isFinite(input.heightPx) || input.heightPx <= 0
    || input.structuralMask.widthPx !== input.widthPx
    || input.structuralMask.heightPx !== input.heightPx
  ) throw new Error("Boundary-band recovery requires matching positive raster dimensions.");
  if (input.wallCandidates.length > MAX_WALLS || input.symbolSegments.length > MAX_SEGMENTS) {
    return { walls: input.wallCandidates, recoveredWalls: [], proposalEvidence: [], diagnostics: ["window-boundary-band-budget-exceeded"] };
  }
  const walls = input.wallCandidates.map((candidate) => wallGeometry(candidate, input.widthPx, input.heightPx))
    .filter((value): value is Wall => value !== null);
  const recovered: Recovery[] = [];
  const seen = new Set<string>();
  for (const group of railGroups(input.symbolSegments, input.structuralMask)) {
    if (recovered.length >= MAX_RECOVERIES) break;
    const value = recover(group, walls, input.symbolSegments, input.structuralMask, input.widthPx, input.heightPx);
    if (!value || seen.has(value.wall.id)) continue;
    seen.add(value.wall.id);
    recovered.push(value);
  }
  recovered.sort((a, b) => a.wall.id.localeCompare(b.wall.id));
  return {
    walls: recovered.length ? [...input.wallCandidates, ...recovered.map((item) => item.wall)] : input.wallCandidates,
    recoveredWalls: recovered.map((item) => item.wall),
    proposalEvidence: recovered.map((item) => item.evidence),
    diagnostics: recovered.length >= MAX_RECOVERIES ? ["window-boundary-band-recovery-budget-reached"] : [],
  };
}

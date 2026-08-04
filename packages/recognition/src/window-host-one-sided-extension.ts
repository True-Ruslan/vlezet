import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type OneSidedWindowHostExtensionInput = Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  symbolSegments: readonly DetectedLineSegment[];
  structuralMask: StructuralMaskView;
}>;

export type OneSidedWindowHostExtensionResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  acceptedExtensionCount: number;
  diagnostics: readonly string[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type Interval = Readonly<{ start: number; end: number }>;
type Side = "start" | "end";
type WallGeometry = Readonly<{
  index: number;
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  length: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type ProjectedRail = Readonly<{
  start: number;
  end: number;
  across: number;
  length: number;
}>;
type RailPair = Readonly<{
  start: number;
  end: number;
  separation: number;
}>;
type ExtensionProposal = Readonly<{
  wallIndex: number;
  wallId: string;
  side: Side;
  extensionAlong: number;
  extensionLengthPx: number;
  key: string;
}>;

const MAX_EXTENSIONS = 8;
const MAX_SYMBOL_SEGMENTS = 512;
const MIN_RAIL_LENGTH_PX = 30;
const MAX_RAIL_LENGTH_PX = 280;
const MAX_RAIL_ENDPOINT_OFFSET_PX = 36;
const MIN_RAIL_OUTSIDE_LENGTH_PX = 30;
const MAX_SEPARATOR_SEARCH_GAP_PX = 24;
const MIN_SEPARATOR_LENGTH_PX = 24;
const MAX_SEPARATOR_LENGTH_PX = 180;
const MIN_SEPARATOR_THICKNESS_RATIO = 1.25;
const MIN_MASK_CROSS_SECTION_SUPPORT = 0.55;
const MAX_ANCHOR_AXIS_ANGLE_DELTA_DEG = 8;
const MIN_ANCHOR_LENGTH_PX = 80;
const MIN_ANCHOR_GAP_PX = 30;
const MAX_ANCHOR_GAP_PX = 240;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function dot(first: Point, second: Point): number {
  return first.x * second.x + first.y * second.y;
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

function distance(first: Point, second: Point): number {
  return Math.hypot(second.x - first.x, second.y - first.y);
}

function segmentAngle(start: Point, end: Point): number {
  return ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
}

function angleDelta(first: number, second: number): number {
  const raw = Math.abs(first - second) % 180;
  return Math.min(raw, 180 - raw);
}

function pixelPoint(
  candidate: RecognitionWallCandidate,
  endpoint: "start" | "end",
  widthPx: number,
  heightPx: number,
): Point {
  const point = candidate[endpoint];
  return { x: point.x * widthPx, y: point.y * heightPx };
}

function geometry(
  candidate: RecognitionWallCandidate,
  index: number,
  widthPx: number,
  heightPx: number,
): WallGeometry | null {
  if (candidate.conflict !== null) return null;
  let start = pixelPoint(candidate, "start", widthPx, heightPx);
  let end = pixelPoint(candidate, "end", widthPx, heightPx);
  const sourceLength = distance(start, end);
  if (!Number.isFinite(sourceLength) || sourceLength < EPSILON) return null;
  if (start.x > end.x || (Math.abs(start.x - end.x) <= EPSILON && start.y > end.y)) {
    [start, end] = [end, start];
  }
  const length = distance(start, end);
  const tangent = { x: (end.x - start.x) / length, y: (end.y - start.y) / length };
  return {
    index,
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    length,
    angleDeg: segmentAngle(start, end),
    thicknessPx: clamp(candidate.estimatedThicknessPx ?? 20, 3, 160),
  };
}

function projectInterval(wall: WallGeometry, other: WallGeometry): Interval {
  const first = dot(subtract(other.start, wall.start), wall.tangent);
  const second = dot(subtract(other.end, wall.start), wall.tangent);
  return { start: Math.min(first, second), end: Math.max(first, second) };
}

function mergeRails(
  rails: readonly ProjectedRail[],
  acrossTolerancePx: number,
  gapTolerancePx: number,
): ProjectedRail[] {
  const pending = [...rails].sort((first, second) =>
    first.across - second.across || first.start - second.start || first.end - second.end);
  const merged: Array<{ start: number; end: number; weightedAcross: number; weight: number }> = [];
  for (const rail of pending) {
    const target = merged.find((candidate) => {
      const across = candidate.weightedAcross / candidate.weight;
      return Math.abs(across - rail.across) <= acrossTolerancePx
        && rail.start <= candidate.end + gapTolerancePx
        && rail.end >= candidate.start - gapTolerancePx;
    });
    if (!target) {
      merged.push({
        start: rail.start,
        end: rail.end,
        weightedAcross: rail.across * rail.length,
        weight: rail.length,
      });
      continue;
    }
    target.start = Math.min(target.start, rail.start);
    target.end = Math.max(target.end, rail.end);
    target.weightedAcross += rail.across * rail.length;
    target.weight += rail.length;
  }
  return merged.map((rail) => ({
    start: rail.start,
    end: rail.end,
    across: rail.weightedAcross / rail.weight,
    length: rail.end - rail.start,
  })).sort((first, second) =>
    (first.start + first.end) / 2 - (second.start + second.end) / 2
    || first.across - second.across);
}

function railPairForSide(
  wall: WallGeometry,
  side: Side,
  symbolSegments: readonly DetectedLineSegment[],
): RailPair | null {
  const halfThickness = wall.thicknessPx / 2;
  const rails: ProjectedRail[] = [];
  for (const segment of symbolSegments) {
    const start = { x: segment.x1, y: segment.y1 };
    const end = { x: segment.x2, y: segment.y2 };
    const segmentLength = distance(start, end);
    if (!Number.isFinite(segmentLength) || segmentLength < MIN_RAIL_LENGTH_PX || segmentLength > MAX_RAIL_LENGTH_PX) continue;
    if (angleDelta(segmentAngle(start, end), wall.angleDeg) > 8) continue;
    const firstAlong = dot(subtract(start, wall.start), wall.tangent);
    const secondAlong = dot(subtract(end, wall.start), wall.tangent);
    const interval = { start: Math.min(firstAlong, secondAlong), end: Math.max(firstAlong, secondAlong) };
    const midpoint = scale(add(start, end), 0.5);
    const across = dot(subtract(midpoint, wall.start), wall.normal);
    if (Math.abs(across) > Math.max(4, halfThickness * 0.8)) continue;
    if (side === "end") {
      if (interval.start < wall.length - MAX_RAIL_ENDPOINT_OFFSET_PX) continue;
      if (interval.start > wall.length + MAX_RAIL_ENDPOINT_OFFSET_PX) continue;
      if (interval.end - wall.length < MIN_RAIL_OUTSIDE_LENGTH_PX) continue;
    } else {
      if (interval.end < -MAX_RAIL_ENDPOINT_OFFSET_PX) continue;
      if (interval.end > MAX_RAIL_ENDPOINT_OFFSET_PX) continue;
      if (-interval.start < MIN_RAIL_OUTSIDE_LENGTH_PX) continue;
    }
    rails.push({ ...interval, across, length: interval.end - interval.start });
  }

  const merged = mergeRails(
    rails,
    Math.max(1.5, halfThickness * 0.12),
    Math.max(20, Math.min(32, halfThickness * 2.5)),
  );
  const candidates: RailPair[] = [];
  for (let firstIndex = 0; firstIndex < merged.length; firstIndex += 1) {
    const first = merged[firstIndex]!;
    for (let secondIndex = firstIndex + 1; secondIndex < merged.length; secondIndex += 1) {
      const second = merged[secondIndex]!;
      const firstCenter = (first.start + first.end) / 2;
      const secondCenter = (second.start + second.end) / 2;
      if (Math.abs(firstCenter - secondCenter) > 14) continue;
      if (Math.abs(first.start - second.start) > 18 || Math.abs(first.end - second.end) > 18) continue;
      const separation = Math.abs(first.across - second.across);
      if (separation < Math.max(3, halfThickness * 0.3)) continue;
      if (separation > Math.max(14, halfThickness * 1.6)) continue;
      if (Math.abs((first.across + second.across) / 2) > Math.max(3, halfThickness * 0.35)) continue;
      const lengthRatio = Math.min(first.length, second.length) / Math.max(first.length, second.length);
      if (lengthRatio < 0.75) continue;
      candidates.push({
        start: Math.min(first.start, second.start),
        end: Math.max(first.end, second.end),
        separation,
      });
    }
  }
  return candidates.sort((first, second) =>
    second.separation - first.separation
    || (second.end - second.start) - (first.end - first.start)
    || first.start - second.start)[0] ?? null;
}

function crossSectionSupport(
  wall: WallGeometry,
  along: number,
  mask: StructuralMaskView,
): number | null {
  const samples = Math.max(5, Math.min(11, Math.round(wall.thicknessPx)));
  const halfThickness = wall.thicknessPx / 2;
  let supported = 0;
  try {
    for (let index = 0; index < samples; index += 1) {
      const across = -halfThickness + ((index + 0.5) / samples) * wall.thicknessPx;
      const point = add(wall.start, add(scale(wall.tangent, along), scale(wall.normal, across)));
      const x = Math.round(clamp(point.x, 0, mask.widthPx - 1));
      const y = Math.round(clamp(point.y, 0, mask.heightPx - 1));
      if (mask.isStructural(x, y)) supported += 1;
    }
  } catch {
    return null;
  }
  return supported / samples;
}

function separatorBoundary(
  wall: WallGeometry,
  side: Side,
  railPair: RailPair,
  mask: StructuralMaskView,
): number | null {
  const railBoundary = side === "end" ? railPair.end : railPair.start;
  const direction = side === "end" ? 1 : -1;
  let firstSupported: number | null = null;
  for (let offset = -2; offset <= MAX_SEPARATOR_SEARCH_GAP_PX; offset += 1) {
    const along = railBoundary + direction * offset;
    const support = crossSectionSupport(wall, along, mask);
    if (support === null) return null;
    if (support >= MIN_MASK_CROSS_SECTION_SUPPORT) {
      firstSupported = along;
      break;
    }
  }
  if (firstSupported === null) return null;

  let lastSupported = firstSupported;
  for (let step = 1; step <= MAX_SEPARATOR_LENGTH_PX + 1; step += 1) {
    const along = firstSupported + direction * step;
    const support = crossSectionSupport(wall, along, mask);
    if (support === null) return null;
    if (support < MIN_MASK_CROSS_SECTION_SUPPORT) break;
    lastSupported = along;
  }
  const separatorLength = Math.abs(lastSupported - firstSupported);
  if (separatorLength < Math.max(MIN_SEPARATOR_LENGTH_PX, wall.thicknessPx * MIN_SEPARATOR_THICKNESS_RATIO)) return null;
  if (separatorLength > MAX_SEPARATOR_LENGTH_PX) return null;
  return lastSupported;
}

function compatibleAnchor(
  wall: WallGeometry,
  anchor: WallGeometry,
): boolean {
  if (anchor.index === wall.index) return false;
  if (angleDelta(wall.angleDeg, anchor.angleDeg) > MAX_ANCHOR_AXIS_ANGLE_DELTA_DEG) return false;
  const averageThickness = (wall.thicknessPx + anchor.thicknessPx) / 2;
  if (Math.max(wall.thicknessPx, anchor.thicknessPx) / Math.min(wall.thicknessPx, anchor.thicknessPx) > 1.8) return false;
  const anchorOffset = dot(subtract(anchor.start, wall.start), wall.normal);
  return Math.abs(anchorOffset) <= Math.max(4, averageThickness * 0.35)
    && anchor.length >= MIN_ANCHOR_LENGTH_PX;
}

function hasAnchorAfterSeparator(
  wall: WallGeometry,
  side: Side,
  separator: number,
  geometries: readonly WallGeometry[],
): boolean {
  return geometries.some((anchor) => {
    if (!compatibleAnchor(wall, anchor)) return false;
    const interval = projectInterval(wall, anchor);
    const gap = side === "end"
      ? interval.start - separator
      : separator - interval.end;
    return gap >= MIN_ANCHOR_GAP_PX && gap <= MAX_ANCHOR_GAP_PX;
  });
}

function proposals(
  walls: readonly RecognitionWallCandidate[],
  symbolSegments: readonly DetectedLineSegment[],
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): ExtensionProposal[] {
  const geometries = walls
    .map((candidate, index) => geometry(candidate, index, widthPx, heightPx))
    .filter((candidate): candidate is WallGeometry => candidate !== null);
  const output: ExtensionProposal[] = [];
  for (const wall of geometries) {
    for (const side of ["start", "end"] as const) {
      const railPair = railPairForSide(wall, side, symbolSegments);
      if (!railPair) continue;
      const separator = separatorBoundary(wall, side, railPair, mask);
      if (separator === null) continue;
      if (!hasAnchorAfterSeparator(wall, side, separator, geometries)) continue;
      const extensionLengthPx = side === "end" ? separator - wall.length : -separator;
      if (extensionLengthPx <= 0) continue;
      output.push({
        wallIndex: wall.index,
        wallId: wall.candidate.id,
        side,
        extensionAlong: separator,
        extensionLengthPx,
        key: `${wall.candidate.id}|${side}|${separator.toFixed(4)}`,
      });
    }
  }
  return output.sort((first, second) =>
    first.extensionLengthPx - second.extensionLengthPx
    || first.key.localeCompare(second.key));
}

function applyProposal(
  candidate: RecognitionWallCandidate,
  proposal: ExtensionProposal,
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const wall = geometry(candidate, proposal.wallIndex, widthPx, heightPx);
  if (!wall) return candidate;
  const extensionPoint = add(wall.start, scale(wall.tangent, proposal.extensionAlong));
  const start = proposal.side === "start" ? extensionPoint : wall.start;
  const end = proposal.side === "end" ? extensionPoint : wall.end;
  return {
    ...candidate,
    start: { x: clamp(start.x / widthPx, 0, 1), y: clamp(start.y / heightPx, 0, 1) },
    end: { x: clamp(end.x / widthPx, 0, 1), y: clamp(end.y / heightPx, 0, 1) },
    confidence: candidate.confidence === "high" ? "medium" : candidate.confidence,
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.72, 0.74),
      reasons: [...new Set([
        ...candidate.evidence.reasons,
        "one-sided-window-host-extension",
        "paired-window-rails",
        "mask-backed-window-separator",
      ])].sort(),
    },
  };
}

export function extendOneSidedWindowHosts(
  input: OneSidedWindowHostExtensionInput,
): OneSidedWindowHostExtensionResult {
  if (input.symbolSegments.length > MAX_SYMBOL_SEGMENTS) {
    return { walls: input.wallCandidates, acceptedExtensionCount: 0, diagnostics: [] };
  }
  const proposed = proposals(
    input.wallCandidates,
    input.symbolSegments,
    input.structuralMask,
    input.widthPx,
    input.heightPx,
  );
  if (proposed.length === 0) {
    return { walls: input.wallCandidates, acceptedExtensionCount: 0, diagnostics: [] };
  }

  const selected = new Map<number, ExtensionProposal>();
  for (const proposal of proposed) {
    if (selected.size >= MAX_EXTENSIONS) break;
    if (!selected.has(proposal.wallIndex)) selected.set(proposal.wallIndex, proposal);
  }
  const walls = input.wallCandidates.map((candidate, index) => {
    const proposal = selected.get(index);
    return proposal
      ? applyProposal(candidate, proposal, input.widthPx, input.heightPx)
      : candidate;
  });
  return {
    walls,
    acceptedExtensionCount: selected.size,
    diagnostics: selected.size > 0 ? ["window-host-one-sided-extension"] : [],
  };
}

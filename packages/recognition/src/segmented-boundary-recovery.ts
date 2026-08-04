import type {
  RecognitionDiagnostic,
  RecognitionWallCandidate,
} from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type SegmentedBoundaryRecoveryResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  recoveredWalls: readonly RecognitionWallCandidate[];
  acceptedChainCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  tangent: Point;
  normal: Point;
  lengthPx: number;
  angleDeg: number;
  thicknessPx: number;
}>;
type DownstreamAnchor = Readonly<{
  wall: PixelWall;
  distancePx: number;
  kind: "collinear" | "perpendicular";
  scanAllowancePx: number;
  key: string;
}>;
type SupportSample = Readonly<{
  distancePx: number;
  ratio: number;
}>;
type SupportRun = Readonly<{
  startDistancePx: number;
  endDistancePx: number;
  supportRatio: number;
}>;
type RecoveryProposal = Readonly<{
  host: PixelWall;
  origin: Point;
  tangent: Point;
  normal: Point;
  anchor: DownstreamAnchor;
  runs: readonly SupportRun[];
  key: string;
}>;

const MAX_WALL_CANDIDATES = 96;
const MAX_RECOVERED_WALLS = 24;
const MAX_ACCEPTED_CHAINS = 12;
const MIN_HOST_LENGTH_PX = 80;
const MIN_ANCHOR_LENGTH_PX = 80;
const MIN_CORRIDOR_LENGTH_PX = 60;
const MAX_CORRIDOR_SHORT_SIDE_RATIO = 0.58;
const MIN_OPENING_GAP_PX = 30;
const MAX_OPENING_GAP_PX = 240;
const MERGE_MASK_HOLE_PX = 4;
const MIN_MASK_SUPPORT_RATIO = 0.55;
const MIN_RUN_AVERAGE_SUPPORT_RATIO = 0.72;
const MIN_RUN_LENGTH_PX = 8;
const MIN_RUN_THICKNESS_RATIO = 0.3;
const MAX_COLLINEAR_ANGLE_DELTA_DEG = 8;
const MIN_PERPENDICULAR_ANGLE_DELTA_DEG = 70;
const MAX_AXIS_TOLERANCE_PX = 10;
const MAX_CROSS_SECTION_HALF_SPAN_PX = 60;
const CROSS_SECTION_SAMPLES = 17;
const TERMINAL_BAND_ALLOWANCE_PX = 12;
const EPSILON = 1e-7;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

function cross(first: Point, second: Point): number {
  return first.x * second.y - first.y * second.x;
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

function pixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall | null {
  const start = pixelPoint(candidate, "start", widthPx, heightPx);
  const end = pixelPoint(candidate, "end", widthPx, heightPx);
  const lengthPx = distance(start, end);
  if (!Number.isFinite(lengthPx) || lengthPx <= EPSILON) return null;
  const tangent = {
    x: (end.x - start.x) / lengthPx,
    y: (end.y - start.y) / lengthPx,
  };
  return {
    candidate,
    start,
    end,
    tangent,
    normal: { x: -tangent.y, y: tangent.x },
    lengthPx,
    angleDeg: segmentAngle(start, end),
    thicknessPx: clamp(candidate.estimatedThicknessPx ?? 20, 3, 120),
  };
}

function axisTolerance(first: PixelWall, second: PixelWall): number {
  return Math.max(
    4,
    Math.min(
      MAX_AXIS_TOLERANCE_PX,
      Math.min(first.thicknessPx, second.thicknessPx) * 0.4,
    ),
  );
}

function collinearAnchor(
  host: PixelWall,
  origin: Point,
  outward: Point,
  candidate: PixelWall,
): DownstreamAnchor | null {
  if (angleDelta(host.angleDeg, candidate.angleDeg) > MAX_COLLINEAR_ANGLE_DELTA_DEG) return null;
  const startRelative = subtract(candidate.start, origin);
  const endRelative = subtract(candidate.end, origin);
  if (
    Math.abs(dot(startRelative, host.normal)) > axisTolerance(host, candidate)
    || Math.abs(dot(endRelative, host.normal)) > axisTolerance(host, candidate)
  ) return null;
  const first = dot(startRelative, outward);
  const second = dot(endRelative, outward);
  const minimum = Math.min(first, second);
  const maximum = Math.max(first, second);
  if (maximum < MIN_CORRIDOR_LENGTH_PX || minimum < MIN_CORRIDOR_LENGTH_PX) return null;
  return {
    wall: candidate,
    distancePx: minimum,
    kind: "collinear",
    scanAllowancePx: 0,
    key: `collinear|${minimum.toFixed(4)}|${candidate.candidate.id}`,
  };
}

function perpendicularAnchor(
  host: PixelWall,
  origin: Point,
  outward: Point,
  candidate: PixelWall,
): DownstreamAnchor | null {
  if (angleDelta(host.angleDeg, candidate.angleDeg) < MIN_PERPENDICULAR_ANGLE_DELTA_DEG) return null;
  const candidateVector = subtract(candidate.end, candidate.start);
  const denominator = cross(outward, candidateVector);
  if (Math.abs(denominator) <= EPSILON) return null;
  const relative = subtract(candidate.start, origin);
  const rayDistance = cross(relative, candidateVector) / denominator;
  const candidateRatio = cross(relative, outward) / denominator;
  if (
    rayDistance < MIN_CORRIDOR_LENGTH_PX
    || candidateRatio < -EPSILON
    || candidateRatio > 1 + EPSILON
  ) return null;
  return {
    wall: candidate,
    distancePx: rayDistance,
    kind: "perpendicular",
    scanAllowancePx: Math.min(TERMINAL_BAND_ALLOWANCE_PX, candidate.thicknessPx / 2),
    key: `perpendicular|${rayDistance.toFixed(4)}|${candidate.candidate.id}`,
  };
}

function nearestAnchor(
  host: PixelWall,
  origin: Point,
  outward: Point,
  walls: readonly PixelWall[],
  maximumCorridorPx: number,
): DownstreamAnchor | null {
  const candidates: DownstreamAnchor[] = [];
  for (const candidate of walls) {
    if (
      candidate.candidate.id === host.candidate.id
      || candidate.candidate.conflict !== null
      || candidate.lengthPx < MIN_ANCHOR_LENGTH_PX
    ) continue;
    const anchor = collinearAnchor(host, origin, outward, candidate)
      ?? perpendicularAnchor(host, origin, outward, candidate);
    if (!anchor || anchor.distancePx > maximumCorridorPx) continue;
    candidates.push(anchor);
  }
  return candidates.sort((first, second) =>
    first.distancePx - second.distancePx
    || first.key.localeCompare(second.key))[0] ?? null;
}

function pointOnAxis(origin: Point, tangent: Point, normal: Point, along: number, across: number): Point {
  return add(origin, add(scale(tangent, along), scale(normal, across)));
}

function crossSectionSupport(
  origin: Point,
  tangent: Point,
  normal: Point,
  distancePx: number,
  thicknessPx: number,
  mask: StructuralMaskView,
): number {
  const halfSpan = Math.min(
    MAX_CROSS_SECTION_HALF_SPAN_PX,
    Math.max(4, thicknessPx * 0.65),
  );
  let structural = 0;
  for (let index = 0; index < CROSS_SECTION_SAMPLES; index += 1) {
    const across = -halfSpan + halfSpan * 2 * index / (CROSS_SECTION_SAMPLES - 1);
    const point = pointOnAxis(origin, tangent, normal, distancePx, across);
    if (mask.isStructural(Math.round(point.x), Math.round(point.y))) structural += 1;
  }
  return structural / CROSS_SECTION_SAMPLES;
}

function supportSamples(
  host: PixelWall,
  origin: Point,
  outward: Point,
  anchor: DownstreamAnchor,
  mask: StructuralMaskView,
): SupportSample[] {
  const scanEnd = anchor.distancePx + anchor.scanAllowancePx;
  const samples: SupportSample[] = [];
  for (let distancePx = 0; distancePx <= Math.ceil(scanEnd); distancePx += 1) {
    samples.push({
      distancePx,
      ratio: crossSectionSupport(
        origin,
        outward,
        host.normal,
        distancePx,
        host.thicknessPx,
        mask,
      ),
    });
  }
  return samples;
}

function mergeSmallMaskHoles(values: readonly boolean[]): boolean[] {
  const output = [...values];
  let index = 0;
  while (index < output.length) {
    if (output[index]) {
      index += 1;
      continue;
    }
    const start = index;
    while (index < output.length && !output[index]) index += 1;
    const end = index - 1;
    const bounded = start > 0 && index < output.length && output[start - 1] && output[index];
    if (bounded && end - start + 1 <= MERGE_MASK_HOLE_PX) {
      for (let current = start; current <= end; current += 1) output[current] = true;
    }
  }
  return output;
}

function extractRuns(
  samples: readonly SupportSample[],
  thicknessPx: number,
): SupportRun[] {
  const structural = mergeSmallMaskHoles(
    samples.map((sample) => sample.ratio >= MIN_MASK_SUPPORT_RATIO),
  );
  const minimumLength = Math.max(MIN_RUN_LENGTH_PX, thicknessPx * MIN_RUN_THICKNESS_RATIO);
  const runs: SupportRun[] = [];
  let startIndex: number | null = null;
  for (let index = 0; index <= structural.length; index += 1) {
    if (index < structural.length && structural[index]) {
      if (startIndex === null) startIndex = index;
      continue;
    }
    if (startIndex === null) continue;
    const endIndex = index - 1;
    const startDistancePx = samples[startIndex]!.distancePx;
    const endDistancePx = samples[endIndex]!.distancePx;
    const supportRatio = samples
      .slice(startIndex, endIndex + 1)
      .reduce((sum, sample) => sum + sample.ratio, 0) / Math.max(1, endIndex - startIndex + 1);
    if (
      endDistancePx - startDistancePx >= minimumLength
      && supportRatio >= MIN_RUN_AVERAGE_SUPPORT_RATIO
    ) {
      runs.push({ startDistancePx, endDistancePx, supportRatio });
    }
    startIndex = null;
  }
  return runs;
}

function validOpeningGaps(
  runs: readonly SupportRun[],
  anchorDistancePx: number,
): boolean {
  if (runs.length === 0) return false;
  let cursor = 0;
  let openingGapCount = 0;
  for (const run of runs) {
    const gap = run.startDistancePx - cursor;
    if (gap > MERGE_MASK_HOLE_PX) {
      if (gap < MIN_OPENING_GAP_PX || gap > MAX_OPENING_GAP_PX) return false;
      openingGapCount += 1;
    }
    cursor = Math.max(cursor, run.endDistancePx);
  }
  const terminalGap = anchorDistancePx - cursor;
  if (terminalGap > MERGE_MASK_HOLE_PX) {
    if (terminalGap < MIN_OPENING_GAP_PX || terminalGap > MAX_OPENING_GAP_PX) return false;
    openingGapCount += 1;
  }
  return openingGapCount > 0;
}

function candidateProjection(
  wall: PixelWall,
  origin: Point,
  tangent: Point,
  normal: Point,
): Readonly<{ start: number; end: number; axis: number }> {
  const first = subtract(wall.start, origin);
  const second = subtract(wall.end, origin);
  return {
    start: Math.min(dot(first, tangent), dot(second, tangent)),
    end: Math.max(dot(first, tangent), dot(second, tangent)),
    axis: (dot(first, normal) + dot(second, normal)) / 2,
  };
}

function duplicatedByActiveWall(
  run: SupportRun,
  proposal: RecoveryProposal,
  walls: readonly PixelWall[],
): boolean {
  return walls.some((wall) => {
    if (wall.candidate.conflict !== null) return false;
    if (angleDelta(wall.angleDeg, proposal.host.angleDeg) > MAX_COLLINEAR_ANGLE_DELTA_DEG) return false;
    const projected = candidateProjection(wall, proposal.origin, proposal.tangent, proposal.normal);
    if (Math.abs(projected.axis) > axisTolerance(proposal.host, wall)) return false;
    const overlap = Math.max(
      0,
      Math.min(run.endDistancePx, projected.end) - Math.max(run.startDistancePx, projected.start),
    );
    return overlap / Math.max(1, run.endDistancePx - run.startDistancePx) >= 0.7;
  });
}

function runThickness(
  proposal: RecoveryProposal,
  run: SupportRun,
  mask: StructuralMaskView,
): number {
  const sampleDistances = [0.2, 0.5, 0.8].map((ratio) =>
    run.startDistancePx + (run.endDistancePx - run.startDistancePx) * ratio);
  const thicknesses: number[] = [];
  const maximumOffset = Math.min(MAX_CROSS_SECTION_HALF_SPAN_PX, Math.ceil(proposal.host.thicknessPx * 1.6));
  for (const distancePx of sampleDistances) {
    const values: boolean[] = [];
    for (let offset = -maximumOffset; offset <= maximumOffset; offset += 1) {
      const point = pointOnAxis(
        proposal.origin,
        proposal.tangent,
        proposal.normal,
        distancePx,
        offset,
      );
      values.push(mask.isStructural(Math.round(point.x), Math.round(point.y)));
    }
    const center = maximumOffset;
    if (!values[center]) continue;
    let minimum = center;
    let maximum = center;
    while (minimum > 0 && values[minimum - 1]) minimum -= 1;
    while (maximum + 1 < values.length && values[maximum + 1]) maximum += 1;
    thicknesses.push(maximum - minimum + 1);
  }
  if (thicknesses.length === 0) return proposal.host.thicknessPx;
  return [...thicknesses].sort((first, second) => first - second)[Math.floor(thicknesses.length / 2)]!;
}

function geometryId(start: Point, end: Point, thicknessPx: number): string {
  return `segmented-boundary-${[start.x, start.y, end.x, end.y, thicknessPx]
    .map((value) => Math.round(value * 10))
    .join("-")}`;
}

function recoveredCandidate(
  proposal: RecoveryProposal,
  run: SupportRun,
  widthPx: number,
  heightPx: number,
  mask: StructuralMaskView,
): RecognitionWallCandidate {
  const start = pointOnAxis(proposal.origin, proposal.tangent, proposal.normal, run.startDistancePx, 0);
  const end = pointOnAxis(proposal.origin, proposal.tangent, proposal.normal, run.endDistancePx, 0);
  const thicknessPx = runThickness(proposal, run, mask);
  return {
    id: geometryId(start, end, thicknessPx),
    start: {
      x: clamp(start.x / widthPx, 0, 1),
      y: clamp(start.y / heightPx, 0, 1),
    },
    end: {
      x: clamp(end.x / widthPx, 0, 1),
      y: clamp(end.y / heightPx, 0, 1),
    },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: Math.min(0.78, 0.64 + run.supportRatio * 0.16),
      cloudScore: null,
      reasons: [
        "bounded-by-structural-anchors",
        "mask-supported-wall-run",
        "segmented-structural-boundary",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function proposals(
  walls: readonly PixelWall[],
  mask: StructuralMaskView,
  widthPx: number,
  heightPx: number,
): RecoveryProposal[] {
  const maximumCorridorPx = Math.min(widthPx, heightPx) * MAX_CORRIDOR_SHORT_SIDE_RATIO;
  const output: RecoveryProposal[] = [];
  for (const host of walls) {
    if (
      host.candidate.conflict !== null
      || host.lengthPx < MIN_HOST_LENGTH_PX
      || host.candidate.confidence === "low"
    ) continue;
    for (const endpoint of ["start", "end"] as const) {
      const origin = endpoint === "end" ? host.end : host.start;
      const tangent = endpoint === "end" ? host.tangent : scale(host.tangent, -1);
      const normal = { x: -tangent.y, y: tangent.x };
      const anchor = nearestAnchor(host, origin, tangent, walls, maximumCorridorPx);
      if (!anchor) continue;
      const runs = extractRuns(
        supportSamples(host, origin, tangent, anchor, mask),
        host.thicknessPx,
      );
      if (!validOpeningGaps(runs, anchor.distancePx)) continue;
      output.push({
        host,
        origin,
        tangent,
        normal,
        anchor,
        runs,
        key: `${host.candidate.id}|${endpoint}|${anchor.key}`,
      });
    }
  }
  return output.sort((first, second) => first.key.localeCompare(second.key));
}

export function recoverSegmentedBoundaryWalls(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
}>): SegmentedBoundaryRecoveryResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
    || input.wallCandidates.length > MAX_WALL_CANDIDATES
  ) {
    return {
      walls: [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id)),
      recoveredWalls: [],
      acceptedChainCount: 0,
      diagnostics: [],
    };
  }

  const walls = [...input.wallCandidates]
    .sort((first, second) => first.id.localeCompare(second.id))
    .map((candidate) => pixelWall(candidate, input.widthPx, input.heightPx))
    .filter((wall): wall is PixelWall => wall !== null);
  const recovered = new Map<string, RecognitionWallCandidate>();
  let acceptedChainCount = 0;

  for (const proposal of proposals(walls, input.mask, input.widthPx, input.heightPx)) {
    let acceptedInChain = 0;
    for (const run of proposal.runs) {
      if (
        recovered.size >= MAX_RECOVERED_WALLS
        || duplicatedByActiveWall(run, proposal, walls)
      ) continue;
      const candidate = recoveredCandidate(
        proposal,
        run,
        input.widthPx,
        input.heightPx,
        input.mask,
      );
      if (!recovered.has(candidate.id)) {
        recovered.set(candidate.id, candidate);
        acceptedInChain += 1;
      }
    }
    if (acceptedInChain > 0) acceptedChainCount += 1;
    if (acceptedChainCount >= MAX_ACCEPTED_CHAINS || recovered.size >= MAX_RECOVERED_WALLS) break;
  }

  const recoveredWalls = [...recovered.values()].sort((first, second) => first.id.localeCompare(second.id));
  const diagnostics: RecognitionDiagnostic[] = recoveredWalls.length > 0
    ? [{
        code: "segmented-structural-boundary-recovered",
        severity: "info",
        message: `По структурному растру восстановлено сегментов стен между подтверждёнными опорами: ${recoveredWalls.length}.`,
        candidateId: null,
      }]
    : [];
  return {
    walls: [...input.wallCandidates, ...recoveredWalls].sort((first, second) => first.id.localeCompare(second.id)),
    recoveredWalls,
    acceptedChainCount,
    diagnostics,
  };
}

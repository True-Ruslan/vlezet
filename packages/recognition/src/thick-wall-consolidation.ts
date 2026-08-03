import type {
  RecognitionConfidence,
  RecognitionDiagnostic,
  RecognitionOrigin,
  RecognitionWallCandidate,
} from "./model";
import type { StructuralMaskView } from "./wall-completion";

export type ThickWallConsolidationResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  mergedGroupCount: number;
  diagnostics: readonly RecognitionDiagnostic[];
}>;

type Point = Readonly<{ x: number; y: number }>;
type AxisOrientation = "horizontal" | "vertical" | "diagonal";
type PixelWall = Readonly<{
  candidate: RecognitionWallCandidate;
  start: Point;
  end: Point;
  orientation: AxisOrientation;
  axis: number | null;
  minimum: number;
  maximum: number;
  thicknessPx: number;
  lengthPx: number;
}>;

const MAX_WALL_CANDIDATES = 96;
const MAX_PAIR_COMPARISONS = 4096;
const MAX_GROUP_SIZE = 6;
const AXIS_TOLERANCE_DEG = 8;
const MIN_OVERLAP_RATIO = 0.72;
const MAX_BAND_GAP_PX = 8;
const MIN_STRUCTURAL_FILL_RATIO = 0.72;
const MAX_COMBINED_THICKNESS_PX = 420;
const MAX_THICKNESS_MULTIPLIER = 3.2;
const MAX_ALONG_SAMPLES = 80;
const MAX_ACROSS_SAMPLES = 24;

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function axisOrientation(start: Point, end: Point): AxisOrientation {
  const angle = ((Math.atan2(end.y - start.y, end.x - start.x) * 180 / Math.PI) + 180) % 180;
  const horizontalDelta = Math.min(angle, 180 - angle);
  const verticalDelta = Math.abs(angle - 90);
  if (horizontalDelta <= AXIS_TOLERANCE_DEG) return "horizontal";
  if (verticalDelta <= AXIS_TOLERANCE_DEG) return "vertical";
  return "diagonal";
}

function toPixelWall(
  candidate: RecognitionWallCandidate,
  widthPx: number,
  heightPx: number,
): PixelWall {
  const sourceStart = { x: candidate.start.x * widthPx, y: candidate.start.y * heightPx };
  const sourceEnd = { x: candidate.end.x * widthPx, y: candidate.end.y * heightPx };
  const orientation = axisOrientation(sourceStart, sourceEnd);
  const thicknessPx = Math.max(1, candidate.estimatedThicknessPx ?? 20);

  if (orientation === "horizontal") {
    const axis = (sourceStart.y + sourceEnd.y) / 2;
    return {
      candidate,
      start: { x: sourceStart.x, y: axis },
      end: { x: sourceEnd.x, y: axis },
      orientation,
      axis,
      minimum: Math.min(sourceStart.x, sourceEnd.x),
      maximum: Math.max(sourceStart.x, sourceEnd.x),
      thicknessPx,
      lengthPx: Math.abs(sourceEnd.x - sourceStart.x),
    };
  }

  if (orientation === "vertical") {
    const axis = (sourceStart.x + sourceEnd.x) / 2;
    return {
      candidate,
      start: { x: axis, y: sourceStart.y },
      end: { x: axis, y: sourceEnd.y },
      orientation,
      axis,
      minimum: Math.min(sourceStart.y, sourceEnd.y),
      maximum: Math.max(sourceStart.y, sourceEnd.y),
      thicknessPx,
      lengthPx: Math.abs(sourceEnd.y - sourceStart.y),
    };
  }

  return {
    candidate,
    start: sourceStart,
    end: sourceEnd,
    orientation,
    axis: null,
    minimum: 0,
    maximum: 0,
    thicknessPx,
    lengthPx: Math.hypot(sourceEnd.x - sourceStart.x, sourceEnd.y - sourceStart.y),
  };
}

function intervalOverlap(first: PixelWall, second: PixelWall): number {
  return Math.max(0, Math.min(first.maximum, second.maximum) - Math.max(first.minimum, second.minimum));
}

function bandBounds(wall: PixelWall): readonly [number, number] {
  return [wall.axis! - wall.thicknessPx / 2, wall.axis! + wall.thicknessPx / 2];
}

function structuralFillRatio(
  first: PixelWall,
  second: PixelWall,
  mask: StructuralMaskView,
): number {
  const overlapMinimum = Math.max(first.minimum, second.minimum);
  const overlapMaximum = Math.min(first.maximum, second.maximum);
  if (overlapMaximum <= overlapMinimum) return 0;
  const [firstBandMinimum, firstBandMaximum] = bandBounds(first);
  const [secondBandMinimum, secondBandMaximum] = bandBounds(second);
  const acrossMinimum = Math.min(firstBandMinimum, secondBandMinimum);
  const acrossMaximum = Math.max(firstBandMaximum, secondBandMaximum);
  const alongSampleCount = Math.max(3, Math.min(
    MAX_ALONG_SAMPLES,
    Math.ceil((overlapMaximum - overlapMinimum) / 5),
  ));
  const acrossSampleCount = Math.max(3, Math.min(
    MAX_ACROSS_SAMPLES,
    Math.ceil((acrossMaximum - acrossMinimum) / 2),
  ));
  let structural = 0;
  let total = 0;

  for (let alongIndex = 0; alongIndex < alongSampleCount; alongIndex += 1) {
    const along = overlapMinimum
      + (overlapMaximum - overlapMinimum) * (alongIndex + 0.5) / alongSampleCount;
    for (let acrossIndex = 0; acrossIndex < acrossSampleCount; acrossIndex += 1) {
      const across = acrossMinimum
        + (acrossMaximum - acrossMinimum) * (acrossIndex + 0.5) / acrossSampleCount;
      const x = first.orientation === "horizontal" ? along : across;
      const y = first.orientation === "horizontal" ? across : along;
      total += 1;
      if (mask.isStructural(Math.floor(x), Math.floor(y))) structural += 1;
    }
  }

  return structural / Math.max(1, total);
}

function siblingPair(
  first: PixelWall,
  second: PixelWall,
  mask: StructuralMaskView,
): boolean {
  if (first.candidate.conflict !== null || second.candidate.conflict !== null) return false;
  if (first.orientation === "diagonal" || second.orientation !== first.orientation) return false;
  if (first.axis === null || second.axis === null) return false;
  const overlapRatio = intervalOverlap(first, second) / Math.max(1, Math.min(first.lengthPx, second.lengthPx));
  if (overlapRatio < MIN_OVERLAP_RATIO) return false;

  const [firstMinimum, firstMaximum] = bandBounds(first);
  const [secondMinimum, secondMaximum] = bandBounds(second);
  const bandGap = Math.max(0, Math.max(firstMinimum, secondMinimum) - Math.min(firstMaximum, secondMaximum));
  if (bandGap > MAX_BAND_GAP_PX) return false;
  const combinedThickness = Math.max(firstMaximum, secondMaximum) - Math.min(firstMinimum, secondMinimum);
  if (combinedThickness > MAX_COMBINED_THICKNESS_PX) return false;
  if (combinedThickness > Math.max(first.thicknessPx, second.thicknessPx) * MAX_THICKNESS_MULTIPLIER) return false;
  return structuralFillRatio(first, second, mask) >= MIN_STRUCTURAL_FILL_RATIO;
}

function confidenceForGroup(group: readonly PixelWall[]): RecognitionConfidence {
  return group.every((wall) => wall.candidate.confidence === "low") ? "low" : "medium";
}

function originForGroup(group: readonly PixelWall[]): RecognitionOrigin {
  const origins = new Set(group.map((wall) => wall.candidate.origin));
  return origins.size === 1 ? group[0]!.candidate.origin : "merged";
}

function mergedCandidate(
  group: readonly PixelWall[],
  widthPx: number,
  heightPx: number,
): RecognitionWallCandidate {
  const orientation = group[0]!.orientation;
  const bandMinimum = Math.min(...group.map((wall) => wall.axis! - wall.thicknessPx / 2));
  const bandMaximum = Math.max(...group.map((wall) => wall.axis! + wall.thicknessPx / 2));
  const axis = (bandMinimum + bandMaximum) / 2;
  const minimum = Math.min(...group.map((wall) => wall.minimum));
  const maximum = Math.max(...group.map((wall) => wall.maximum));
  const start = orientation === "horizontal"
    ? { x: minimum, y: axis }
    : { x: axis, y: minimum };
  const end = orientation === "horizontal"
    ? { x: maximum, y: axis }
    : { x: axis, y: maximum };
  const sourceIds = group.map((wall) => wall.candidate.id).sort();
  const localScores = group
    .map((wall) => wall.candidate.evidence.localScore)
    .filter((score): score is number => score !== null);
  const cloudScores = group
    .map((wall) => wall.candidate.evidence.cloudScore)
    .filter((score): score is number => score !== null);
  const geometryKey = [
    orientation,
    Math.round(start.x),
    Math.round(start.y),
    Math.round(end.x),
    Math.round(end.y),
    Math.round(bandMaximum - bandMinimum),
  ].join("-");

  return {
    id: `thick-wall-${geometryKey}-${sourceIds.join("-")}`,
    start: { x: clamp01(start.x / widthPx), y: clamp01(start.y / heightPx) },
    end: { x: clamp01(end.x / widthPx), y: clamp01(end.y / heightPx) },
    estimatedThicknessPx: bandMaximum - bandMinimum,
    confidence: confidenceForGroup(group),
    evidence: {
      localScore: localScores.length > 0 ? Math.min(0.78, Math.max(...localScores)) : 0.72,
      cloudScore: cloudScores.length > 0 ? Math.max(...cloudScores) : null,
      reasons: [...new Set([
        ...group.flatMap((wall) => wall.candidate.evidence.reasons),
        "thick-wall-sibling-consolidation",
      ])].sort(),
    },
    origin: originForGroup(group),
    conflict: null,
  };
}

function preserveResult(
  candidates: readonly RecognitionWallCandidate[],
  diagnostic: RecognitionDiagnostic | null,
): ThickWallConsolidationResult {
  return {
    walls: [...candidates].sort((first, second) => first.id.localeCompare(second.id)),
    mergedGroupCount: 0,
    diagnostics: diagnostic ? [diagnostic] : [],
  };
}

export function consolidateThickWallSiblings(input: Readonly<{
  widthPx: number;
  heightPx: number;
  wallCandidates: readonly RecognitionWallCandidate[];
  mask: StructuralMaskView;
}>): ThickWallConsolidationResult {
  if (
    !Number.isFinite(input.widthPx)
    || input.widthPx <= 0
    || !Number.isFinite(input.heightPx)
    || input.heightPx <= 0
    || input.mask.widthPx !== input.widthPx
    || input.mask.heightPx !== input.heightPx
  ) {
    return preserveResult(input.wallCandidates, {
      code: "thick-wall-consolidation-invalid-mask",
      severity: "warning",
      message: "Объединение толстых стен пропущено из-за несовпадающих размеров структурного растра.",
      candidateId: null,
    });
  }

  const comparisonCount = input.wallCandidates.length * (input.wallCandidates.length - 1) / 2;
  if (input.wallCandidates.length > MAX_WALL_CANDIDATES || comparisonCount > MAX_PAIR_COMPARISONS) {
    return preserveResult(input.wallCandidates, {
      code: "thick-wall-consolidation-budget-exceeded",
      severity: "warning",
      message: "Объединение толстых стен пропущено из-за безопасного лимита кандидатов.",
      candidateId: null,
    });
  }

  const candidates = [...input.wallCandidates].sort((first, second) => first.id.localeCompare(second.id));
  const walls = candidates.map((candidate) => toPixelWall(candidate, input.widthPx, input.heightPx));
  const parents = walls.map((_, index) => index);
  const sizes = walls.map(() => 1);
  const find = (index: number): number => {
    let root = index;
    while (parents[root] !== root) root = parents[root]!;
    while (parents[index] !== index) {
      const parent = parents[index]!;
      parents[index] = root;
      index = parent;
    }
    return root;
  };
  const union = (firstIndex: number, secondIndex: number) => {
    const firstRoot = find(firstIndex);
    const secondRoot = find(secondIndex);
    if (firstRoot === secondRoot) return;
    if (sizes[firstRoot]! + sizes[secondRoot]! > MAX_GROUP_SIZE) return;
    const lower = Math.min(firstRoot, secondRoot);
    const higher = Math.max(firstRoot, secondRoot);
    parents[higher] = lower;
    sizes[lower] = sizes[firstRoot]! + sizes[secondRoot]!;
  };

  for (let firstIndex = 0; firstIndex < walls.length; firstIndex += 1) {
    for (let secondIndex = firstIndex + 1; secondIndex < walls.length; secondIndex += 1) {
      if (siblingPair(walls[firstIndex]!, walls[secondIndex]!, input.mask)) {
        union(firstIndex, secondIndex);
      }
    }
  }

  const groups = new Map<number, PixelWall[]>();
  for (let index = 0; index < walls.length; index += 1) {
    const root = find(index);
    const group = groups.get(root) ?? [];
    group.push(walls[index]!);
    groups.set(root, group);
  }

  const output: RecognitionWallCandidate[] = [];
  const diagnostics: RecognitionDiagnostic[] = [];
  let mergedGroupCount = 0;
  for (const group of [...groups.values()].sort((first, second) =>
    first[0]!.candidate.id.localeCompare(second[0]!.candidate.id))) {
    if (group.length === 1) {
      output.push(group[0]!.candidate);
      continue;
    }
    const merged = mergedCandidate(group, input.widthPx, input.heightPx);
    output.push(merged);
    mergedGroupCount += 1;
    diagnostics.push({
      code: "thick-wall-sibling-consolidated",
      severity: "info",
      message: `Параллельные оси одной заполненной толстой стены объединены: ${group.length}.`,
      candidateId: merged.id,
    });
  }

  return {
    walls: output.sort((first, second) => first.id.localeCompare(second.id)),
    mergedGroupCount,
    diagnostics: diagnostics.sort((first, second) =>
      (first.candidateId ?? "").localeCompare(second.candidateId ?? "")),
  };
}

export type { StructuralMaskView } from "./wall-completion";

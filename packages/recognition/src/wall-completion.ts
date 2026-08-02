import type { RecognitionConfidence } from "./model";
import type { LocalWallCenterline, LocalWallPoint } from "./wall-topology";

export interface StructuralMaskView {
  readonly widthPx: number;
  readonly heightPx: number;
  isStructural(x: number, y: number): boolean;
}

export type WallCompletionDiagnosticCode =
  | "bridge-accepted"
  | "bridge-gap-too-large"
  | "bridge-offset-mismatch"
  | "bridge-thickness-mismatch"
  | "bridge-insufficient-raster-support"
  | "bridge-likely-opening"
  | "bridge-ambiguous-target"
  | "junction-extension-accepted"
  | "junction-extension-ambiguous"
  | "completion-budget-exceeded"
  | "completion-invalid-input";

export interface WallCompletionOptions {
  readonly maximumInputCenterlines: number;
  readonly maximumPairComparisons: number;
  readonly maximumHypotheses: number;
  readonly maximumAcceptedCompletions: number;
  readonly maximumSamplesPerHypothesis: number;
  readonly maximumAngleDeltaDeg: number;
  readonly maximumOffsetThicknessRatio: number;
  readonly maximumThicknessDeltaRatio: number;
  readonly maximumGapThicknessRatio: number;
  readonly maximumGapShortSideRatio: number;
  readonly maximumGapPx: number;
  readonly minimumOccupancyRatio: number;
  readonly minimumContinuousRunRatio: number;
  readonly likelyOpeningMaximumOccupancyRatio: number;
  readonly junctionExtensionThicknessRatio: number;
}

export interface CompleteWallCenterlinesInput {
  readonly centerlines: readonly LocalWallCenterline[];
  readonly mask: StructuralMaskView;
  readonly options: WallCompletionOptions;
}

export interface WallCompletionDiagnostic {
  readonly code: WallCompletionDiagnosticCode;
  readonly firstIndex: number | null;
  readonly secondIndex: number | null;
  readonly message: string;
}

export interface WallCompletionResult {
  readonly centerlines: readonly LocalWallCenterline[];
  readonly diagnostics: readonly WallCompletionDiagnostic[];
  readonly acceptedCompletionCount: number;
}

export const DEFAULT_WALL_COMPLETION_OPTIONS: WallCompletionOptions = Object.freeze({
  maximumInputCenterlines: 80,
  maximumPairComparisons: 512,
  maximumHypotheses: 64,
  maximumAcceptedCompletions: 16,
  maximumSamplesPerHypothesis: 4096,
  maximumAngleDeltaDeg: 3,
  maximumOffsetThicknessRatio: 0.35,
  maximumThicknessDeltaRatio: 0.35,
  maximumGapThicknessRatio: 1.25,
  maximumGapShortSideRatio: 0.08,
  maximumGapPx: 36,
  minimumOccupancyRatio: 0.64,
  minimumContinuousRunRatio: 0.72,
  likelyOpeningMaximumOccupancyRatio: 0.2,
  junctionExtensionThicknessRatio: 0.85,
});

const EPSILON = 1e-9;

type AxisOrientation = "horizontal" | "vertical";
type EndpointName = "start" | "end";

type IndexedLine = Readonly<{
  index: number;
  line: LocalWallCenterline;
  axis: AxisOrientation | null;
}>;

type CorridorEvidence = Readonly<{
  occupancyRatio: number;
  continuousRunRatio: number;
}>;

type BridgeHypothesis = Readonly<{
  firstIndex: number;
  secondIndex: number;
  gapPx: number;
  occupancyRatio: number;
  continuousRunRatio: number;
  merged: LocalWallCenterline;
}>;

type JunctionHypothesis = Readonly<{
  sourceIndex: number;
  targetIndex: number;
  endpoint: EndpointName;
  extensionPx: number;
  occupancyRatio: number;
  intersection: LocalWallPoint;
}>;

type Budget = {
  comparisons: number;
  hypotheses: number;
};

function finitePoint(point: LocalWallPoint): boolean {
  return Number.isFinite(point.x) && Number.isFinite(point.y);
}

function pointOrder(first: LocalWallPoint, second: LocalWallPoint): number {
  if (Math.abs(first.x - second.x) > EPSILON) return first.x - second.x;
  return first.y - second.y;
}

function canonicalCenterline(line: LocalWallCenterline): LocalWallCenterline | null {
  if (!finitePoint(line.startPx) || !finitePoint(line.endPx)) return null;
  if (!Number.isFinite(line.evidenceCount) || line.evidenceCount <= 0) return null;
  if (line.thicknessPx !== null && (!Number.isFinite(line.thicknessPx) || line.thicknessPx <= 0)) return null;
  const [startPx, endPx] = pointOrder(line.startPx, line.endPx) <= 0
    ? [line.startPx, line.endPx]
    : [line.endPx, line.startPx];
  return {
    startPx: { ...startPx },
    endPx: { ...endPx },
    thicknessPx: line.thicknessPx,
    evidenceCount: line.evidenceCount,
    confidence: line.confidence,
    reasons: [...new Set(line.reasons)].sort(),
  };
}

function canonicalCenterlines(lines: readonly LocalWallCenterline[]): LocalWallCenterline[] {
  return lines
    .map(canonicalCenterline)
    .filter((line): line is LocalWallCenterline => line !== null)
    .sort((first, second) =>
      pointOrder(first.startPx, second.startPx)
      || pointOrder(first.endPx, second.endPx)
      || (first.thicknessPx ?? 0) - (second.thicknessPx ?? 0)
      || first.evidenceCount - second.evidenceCount
      || first.confidence.localeCompare(second.confidence)
      || first.reasons.join("|").localeCompare(second.reasons.join("|")));
}

function validPositiveInteger(value: number): boolean {
  return Number.isInteger(value) && value > 0;
}

function validNonNegative(value: number): boolean {
  return Number.isFinite(value) && value >= 0;
}

function validUnitInterval(value: number): boolean {
  return Number.isFinite(value) && value >= 0 && value <= 1;
}

function optionsAreValid(options: WallCompletionOptions): boolean {
  return validPositiveInteger(options.maximumInputCenterlines)
    && validPositiveInteger(options.maximumPairComparisons)
    && validPositiveInteger(options.maximumHypotheses)
    && validPositiveInteger(options.maximumAcceptedCompletions)
    && validPositiveInteger(options.maximumSamplesPerHypothesis)
    && validNonNegative(options.maximumAngleDeltaDeg)
    && validNonNegative(options.maximumOffsetThicknessRatio)
    && validNonNegative(options.maximumThicknessDeltaRatio)
    && validNonNegative(options.maximumGapThicknessRatio)
    && validUnitInterval(options.maximumGapShortSideRatio)
    && validNonNegative(options.maximumGapPx)
    && validUnitInterval(options.minimumOccupancyRatio)
    && validUnitInterval(options.minimumContinuousRunRatio)
    && validUnitInterval(options.likelyOpeningMaximumOccupancyRatio)
    && validNonNegative(options.junctionExtensionThicknessRatio);
}

function invalidDiagnostic(message: string): WallCompletionDiagnostic {
  return {
    code: "completion-invalid-input",
    firstIndex: null,
    secondIndex: null,
    message,
  };
}

function diagnostic(
  code: WallCompletionDiagnosticCode,
  firstIndex: number | null,
  secondIndex: number | null,
  message: string,
): WallCompletionDiagnostic {
  return { code, firstIndex, secondIndex, message };
}

function orientation(line: LocalWallCenterline, maximumAngleDeltaDeg: number): AxisOrientation | null {
  const dx = line.endPx.x - line.startPx.x;
  const dy = line.endPx.y - line.startPx.y;
  const angle = Math.atan2(Math.abs(dy), Math.abs(dx)) * 180 / Math.PI;
  if (angle <= maximumAngleDeltaDeg + EPSILON) return "horizontal";
  if (Math.abs(90 - angle) <= maximumAngleDeltaDeg + EPSILON) return "vertical";
  return null;
}

function alongStart(line: LocalWallCenterline, axis: AxisOrientation): number {
  return axis === "horizontal" ? line.startPx.x : line.startPx.y;
}

function alongEnd(line: LocalWallCenterline, axis: AxisOrientation): number {
  return axis === "horizontal" ? line.endPx.x : line.endPx.y;
}

function perpendicularCenter(line: LocalWallCenterline, axis: AxisOrientation): number {
  return axis === "horizontal"
    ? (line.startPx.y + line.endPx.y) / 2
    : (line.startPx.x + line.endPx.x) / 2;
}

function effectiveThickness(first: LocalWallCenterline, second: LocalWallCenterline): number | null {
  if (first.thicknessPx === null) return second.thicknessPx;
  if (second.thicknessPx === null) return first.thicknessPx;
  return (
    first.thicknessPx * first.evidenceCount + second.thicknessPx * second.evidenceCount
  ) / (first.evidenceCount + second.evidenceCount);
}

function thicknessesCompatible(
  first: LocalWallCenterline,
  second: LocalWallCenterline,
  options: WallCompletionOptions,
): boolean {
  if (first.thicknessPx === null || second.thicknessPx === null) return true;
  return Math.abs(first.thicknessPx - second.thicknessPx)
    / Math.max(first.thicknessPx, second.thicknessPx) <= options.maximumThicknessDeltaRatio + EPSILON;
}

function cappedConfidence(
  first: RecognitionConfidence,
  second: RecognitionConfidence,
  evidence: CorridorEvidence,
  options: WallCompletionOptions,
): RecognitionConfidence {
  if (first === "low" || second === "low") return "low";
  const occupancyMargin = evidence.occupancyRatio - options.minimumOccupancyRatio;
  const continuityMargin = evidence.continuousRunRatio - options.minimumContinuousRunRatio;
  return occupancyMargin >= 0.15 && continuityMargin >= 0.15 ? "medium" : "low";
}

function adaptiveMaximumGap(
  thicknessPx: number,
  mask: StructuralMaskView,
  options: WallCompletionOptions,
): number {
  return Math.min(
    options.maximumGapPx,
    thicknessPx * options.maximumGapThicknessRatio,
    Math.min(mask.widthPx, mask.heightPx) * options.maximumGapShortSideRatio,
  );
}

function sampleAxisCorridor({
  axis,
  startAlong,
  endAlong,
  perpendicular,
  thicknessPx,
  mask,
  maximumSamples,
}: Readonly<{
  axis: AxisOrientation;
  startAlong: number;
  endAlong: number;
  perpendicular: number;
  thicknessPx: number;
  mask: StructuralMaskView;
  maximumSamples: number;
}>): CorridorEvidence | null {
  const distance = Math.abs(endAlong - startAlong);
  const alongSamples = Math.max(1, Math.ceil(distance) - 1);
  const acrossSamples = Math.max(3, Math.min(11, Math.round(thicknessPx)));
  if (alongSamples * acrossSamples > maximumSamples) return null;

  const minimumAlong = Math.min(startAlong, endAlong);
  const maximumAlong = Math.max(startAlong, endAlong);
  const half = thicknessPx / 2;
  let structuralSamples = 0;
  let longestSupportedRun = 0;
  let currentSupportedRun = 0;

  try {
    for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
      const along = minimumAlong
        + ((alongIndex + 1) / (alongSamples + 1)) * (maximumAlong - minimumAlong);
      let structuralAcross = 0;
      for (let acrossIndex = 0; acrossIndex < acrossSamples; acrossIndex += 1) {
        const cross = perpendicular - half
          + ((acrossIndex + 0.5) / acrossSamples) * thicknessPx;
        const x = axis === "horizontal" ? along : cross;
        const y = axis === "horizontal" ? cross : along;
        const sampleX = Math.max(0, Math.min(mask.widthPx - 1, Math.round(x)));
        const sampleY = Math.max(0, Math.min(mask.heightPx - 1, Math.round(y)));
        if (mask.isStructural(sampleX, sampleY)) {
          structuralSamples += 1;
          structuralAcross += 1;
        }
      }
      if (structuralAcross / acrossSamples >= 0.5) {
        currentSupportedRun += 1;
        longestSupportedRun = Math.max(longestSupportedRun, currentSupportedRun);
      } else {
        currentSupportedRun = 0;
      }
    }
  } catch {
    return null;
  }

  return {
    occupancyRatio: structuralSamples / (alongSamples * acrossSamples),
    continuousRunRatio: longestSupportedRun / alongSamples,
  };
}

function mergedCenterline(
  first: LocalWallCenterline,
  second: LocalWallCenterline,
  axis: AxisOrientation,
  evidence: CorridorEvidence,
  options: WallCompletionOptions,
): LocalWallCenterline {
  const evidenceCount = first.evidenceCount + second.evidenceCount;
  const perpendicular = (
    perpendicularCenter(first, axis) * first.evidenceCount
    + perpendicularCenter(second, axis) * second.evidenceCount
  ) / evidenceCount;
  const start = Math.min(alongStart(first, axis), alongStart(second, axis));
  const end = Math.max(alongEnd(first, axis), alongEnd(second, axis));
  return {
    startPx: axis === "horizontal" ? { x: start, y: perpendicular } : { x: perpendicular, y: start },
    endPx: axis === "horizontal" ? { x: end, y: perpendicular } : { x: perpendicular, y: end },
    thicknessPx: effectiveThickness(first, second),
    evidenceCount,
    confidence: cappedConfidence(first.confidence, second.confidence, evidence, options),
    reasons: [...new Set([
      ...first.reasons,
      ...second.reasons,
      "completion-raster-bridge",
    ])].sort(),
  };
}

function buildIndexedLines(
  centerlines: readonly LocalWallCenterline[],
  options: WallCompletionOptions,
): IndexedLine[] {
  return centerlines.map((line, index) => ({
    index,
    line,
    axis: orientation(line, options.maximumAngleDeltaDeg),
  }));
}

function evaluateBridgeHypotheses(
  indexed: readonly IndexedLine[],
  mask: StructuralMaskView,
  options: WallCompletionOptions,
  budget: Budget,
): Readonly<{
  hypotheses: readonly BridgeHypothesis[];
  diagnostics: readonly WallCompletionDiagnostic[];
  budgetExceeded: boolean;
}> {
  const hypotheses: BridgeHypothesis[] = [];
  const diagnostics: WallCompletionDiagnostic[] = [];

  for (let firstPosition = 0; firstPosition < indexed.length; firstPosition += 1) {
    const firstEntry = indexed[firstPosition]!;
    if (firstEntry.axis === null) continue;
    for (let secondPosition = firstPosition + 1; secondPosition < indexed.length; secondPosition += 1) {
      const secondEntry = indexed[secondPosition]!;
      if (secondEntry.axis !== firstEntry.axis) continue;
      const axis = firstEntry.axis;
      const thicknessPx = effectiveThickness(firstEntry.line, secondEntry.line);
      if (thicknessPx === null) continue;
      const offset = Math.abs(
        perpendicularCenter(firstEntry.line, axis) - perpendicularCenter(secondEntry.line, axis),
      );
      if (offset > thicknessPx * options.maximumOffsetThicknessRatio + EPSILON) continue;

      budget.comparisons += 1;
      if (budget.comparisons > options.maximumPairComparisons) {
        return { hypotheses: [], diagnostics, budgetExceeded: true };
      }
      if (!thicknessesCompatible(firstEntry.line, secondEntry.line, options)) {
        diagnostics.push(diagnostic(
          "bridge-thickness-mismatch",
          firstEntry.index,
          secondEntry.index,
          "Фрагменты не объединены: толщина стен несовместима.",
        ));
        continue;
      }

      const ordered = alongStart(firstEntry.line, axis) <= alongStart(secondEntry.line, axis)
        ? [firstEntry, secondEntry] as const
        : [secondEntry, firstEntry] as const;
      const gapPx = alongStart(ordered[1].line, axis) - alongEnd(ordered[0].line, axis);
      if (gapPx <= EPSILON) continue;
      if (gapPx > adaptiveMaximumGap(thicknessPx, mask, options) + EPSILON) {
        diagnostics.push(diagnostic(
          "bridge-gap-too-large",
          ordered[0].index,
          ordered[1].index,
          "Фрагменты не объединены: разрыв превышает безопасный предел.",
        ));
        continue;
      }

      const perpendicular = (
        perpendicularCenter(ordered[0].line, axis) * ordered[0].line.evidenceCount
        + perpendicularCenter(ordered[1].line, axis) * ordered[1].line.evidenceCount
      ) / (ordered[0].line.evidenceCount + ordered[1].line.evidenceCount);
      const evidence = sampleAxisCorridor({
        axis,
        startAlong: alongEnd(ordered[0].line, axis),
        endAlong: alongStart(ordered[1].line, axis),
        perpendicular,
        thicknessPx,
        mask,
        maximumSamples: options.maximumSamplesPerHypothesis,
      });
      if (!evidence) {
        diagnostics.push(diagnostic(
          "bridge-insufficient-raster-support",
          ordered[0].index,
          ordered[1].index,
          "Фрагменты не объединены: структурный коридор нельзя безопасно оценить.",
        ));
        continue;
      }
      if (evidence.occupancyRatio <= options.likelyOpeningMaximumOccupancyRatio + EPSILON) {
        diagnostics.push(diagnostic(
          "bridge-likely-opening",
          ordered[0].index,
          ordered[1].index,
          "Фрагменты не объединены: чистый разрыв сохранён как вероятный проём.",
        ));
        continue;
      }
      if (evidence.occupancyRatio + EPSILON < options.minimumOccupancyRatio
        || evidence.continuousRunRatio + EPSILON < options.minimumContinuousRunRatio) {
        diagnostics.push(diagnostic(
          "bridge-insufficient-raster-support",
          ordered[0].index,
          ordered[1].index,
          "Фрагменты не объединены: структурного заполнения недостаточно.",
        ));
        continue;
      }

      budget.hypotheses += 1;
      if (budget.hypotheses > options.maximumHypotheses) {
        return { hypotheses: [], diagnostics, budgetExceeded: true };
      }
      hypotheses.push({
        firstIndex: ordered[0].index,
        secondIndex: ordered[1].index,
        gapPx,
        occupancyRatio: evidence.occupancyRatio,
        continuousRunRatio: evidence.continuousRunRatio,
        merged: mergedCenterline(ordered[0].line, ordered[1].line, axis, evidence, options),
      });
    }
  }

  return {
    hypotheses: hypotheses.sort((first, second) =>
      first.gapPx - second.gapPx
      || second.occupancyRatio - first.occupancyRatio
      || second.continuousRunRatio - first.continuousRunRatio
      || first.firstIndex - second.firstIndex
      || first.secondIndex - second.secondIndex),
    diagnostics,
    budgetExceeded: false,
  };
}

function mutualBestBridges(hypotheses: readonly BridgeHypothesis[]): readonly BridgeHypothesis[] {
  const bestByLine = new Map<number, BridgeHypothesis>();
  for (const hypothesis of hypotheses) {
    for (const lineIndex of [hypothesis.firstIndex, hypothesis.secondIndex]) {
      const existing = bestByLine.get(lineIndex);
      if (!existing) {
        bestByLine.set(lineIndex, hypothesis);
        continue;
      }
      const comparison = hypothesis.gapPx - existing.gapPx
        || existing.occupancyRatio - hypothesis.occupancyRatio
        || hypothesis.firstIndex - existing.firstIndex
        || hypothesis.secondIndex - existing.secondIndex;
      if (comparison < 0) bestByLine.set(lineIndex, hypothesis);
    }
  }
  return hypotheses.filter((hypothesis) =>
    bestByLine.get(hypothesis.firstIndex) === hypothesis
    && bestByLine.get(hypothesis.secondIndex) === hypothesis);
}

function targetContainsIntersection(
  target: LocalWallCenterline,
  targetAxis: AxisOrientation,
  intersectionAlong: number,
): boolean {
  const margin = (target.thicknessPx ?? 0) / 2;
  return intersectionAlong >= alongStart(target, targetAxis) - margin - EPSILON
    && intersectionAlong <= alongEnd(target, targetAxis) + margin + EPSILON;
}

function possibleJunctionExtension({
  source,
  target,
  sourceIndex,
  targetIndex,
  sourceAxis,
  targetAxis,
  mask,
  options,
}: Readonly<{
  source: LocalWallCenterline;
  target: LocalWallCenterline;
  sourceIndex: number;
  targetIndex: number;
  sourceAxis: AxisOrientation;
  targetAxis: AxisOrientation;
  mask: StructuralMaskView;
  options: WallCompletionOptions;
}>): JunctionHypothesis | null {
  if (!thicknessesCompatible(source, target, options)) return null;
  const thicknessPx = effectiveThickness(source, target);
  if (thicknessPx === null) return null;

  const targetCoordinate = perpendicularCenter(target, targetAxis);
  const sourcePerpendicular = perpendicularCenter(source, sourceAxis);
  if (!targetContainsIntersection(target, targetAxis, sourcePerpendicular)) return null;

  const sourceStart = alongStart(source, sourceAxis);
  const sourceEnd = alongEnd(source, sourceAxis);
  let endpoint: EndpointName;
  let sourceCoordinate: number;
  if (targetCoordinate < sourceStart - EPSILON) {
    endpoint = "start";
    sourceCoordinate = sourceStart;
  } else if (targetCoordinate > sourceEnd + EPSILON) {
    endpoint = "end";
    sourceCoordinate = sourceEnd;
  } else {
    return null;
  }

  const extensionPx = Math.abs(targetCoordinate - sourceCoordinate);
  if (extensionPx > thicknessPx * options.junctionExtensionThicknessRatio + EPSILON) return null;
  const evidence = sampleAxisCorridor({
    axis: sourceAxis,
    startAlong: sourceCoordinate,
    endAlong: targetCoordinate,
    perpendicular: sourcePerpendicular,
    thicknessPx,
    mask,
    maximumSamples: options.maximumSamplesPerHypothesis,
  });
  if (!evidence) return null;
  if (evidence.occupancyRatio + EPSILON < options.minimumOccupancyRatio
    || evidence.continuousRunRatio + EPSILON < options.minimumContinuousRunRatio) return null;

  return {
    sourceIndex,
    targetIndex,
    endpoint,
    extensionPx,
    occupancyRatio: evidence.occupancyRatio,
    intersection: sourceAxis === "horizontal"
      ? { x: targetCoordinate, y: sourcePerpendicular }
      : { x: sourcePerpendicular, y: targetCoordinate },
  };
}

function evaluateJunctionHypotheses(
  indexed: readonly IndexedLine[],
  mask: StructuralMaskView,
  options: WallCompletionOptions,
  budget: Budget,
): Readonly<{
  hypotheses: readonly JunctionHypothesis[];
  diagnostics: readonly WallCompletionDiagnostic[];
  budgetExceeded: boolean;
}> {
  const byEndpoint = new Map<string, JunctionHypothesis[]>();
  const diagnostics: WallCompletionDiagnostic[] = [];

  for (let firstPosition = 0; firstPosition < indexed.length; firstPosition += 1) {
    const first = indexed[firstPosition]!;
    if (first.axis === null) continue;
    for (let secondPosition = firstPosition + 1; secondPosition < indexed.length; secondPosition += 1) {
      const second = indexed[secondPosition]!;
      if (second.axis === null || second.axis === first.axis) continue;
      budget.comparisons += 1;
      if (budget.comparisons > options.maximumPairComparisons) {
        return { hypotheses: [], diagnostics, budgetExceeded: true };
      }

      const candidates = [
        possibleJunctionExtension({
          source: first.line,
          target: second.line,
          sourceIndex: first.index,
          targetIndex: second.index,
          sourceAxis: first.axis,
          targetAxis: second.axis,
          mask,
          options,
        }),
        possibleJunctionExtension({
          source: second.line,
          target: first.line,
          sourceIndex: second.index,
          targetIndex: first.index,
          sourceAxis: second.axis,
          targetAxis: first.axis,
          mask,
          options,
        }),
      ].filter((candidate): candidate is JunctionHypothesis => candidate !== null);

      for (const candidate of candidates) {
        const key = `${candidate.sourceIndex}:${candidate.endpoint}`;
        const existing = byEndpoint.get(key) ?? [];
        existing.push(candidate);
        byEndpoint.set(key, existing);
        budget.hypotheses += 1;
        if (budget.hypotheses > options.maximumHypotheses) {
          return { hypotheses: [], diagnostics, budgetExceeded: true };
        }
      }
    }
  }

  const accepted: JunctionHypothesis[] = [];
  for (const [key, candidates] of [...byEndpoint.entries()].sort(([first], [second]) => first.localeCompare(second))) {
    const sorted = [...candidates].sort((first, second) =>
      first.extensionPx - second.extensionPx
      || second.occupancyRatio - first.occupancyRatio
      || first.targetIndex - second.targetIndex);
    if (sorted.length !== 1) {
      const first = sorted[0]!;
      diagnostics.push(diagnostic(
        "junction-extension-ambiguous",
        first.sourceIndex,
        first.targetIndex,
        `Продление ${key} отклонено: найдено несколько равноправных целей.`,
      ));
      continue;
    }
    accepted.push(sorted[0]!);
  }

  return {
    hypotheses: accepted.sort((first, second) =>
      first.sourceIndex - second.sourceIndex
      || first.endpoint.localeCompare(second.endpoint)
      || first.targetIndex - second.targetIndex),
    diagnostics,
    budgetExceeded: false,
  };
}

function extendLine(
  line: LocalWallCenterline,
  hypothesis: JunctionHypothesis,
): LocalWallCenterline {
  const startPx = hypothesis.endpoint === "start" ? hypothesis.intersection : line.startPx;
  const endPx = hypothesis.endpoint === "end" ? hypothesis.intersection : line.endPx;
  return canonicalCenterline({
    ...line,
    startPx,
    endPx,
    confidence: line.confidence === "high" ? "medium" : line.confidence,
    reasons: [...new Set([...line.reasons, "completion-junction-extension"])].sort(),
  })!;
}

function sortedDiagnostics(diagnostics: readonly WallCompletionDiagnostic[]): WallCompletionDiagnostic[] {
  return [...diagnostics].sort((first, second) =>
    (first.firstIndex ?? -1) - (second.firstIndex ?? -1)
    || (first.secondIndex ?? -1) - (second.secondIndex ?? -1)
    || first.code.localeCompare(second.code));
}

export function completeWallCenterlines(input: CompleteWallCenterlinesInput): WallCompletionResult {
  const centerlines = canonicalCenterlines(input.centerlines);
  const hasInvalidGeometry = centerlines.length !== input.centerlines.length;

  if (!Number.isFinite(input.mask.widthPx)
    || !Number.isFinite(input.mask.heightPx)
    || input.mask.widthPx <= 0
    || input.mask.heightPx <= 0
    || typeof input.mask.isStructural !== "function") {
    return {
      centerlines,
      diagnostics: [invalidDiagnostic("Структурная маска имеет недопустимые размеры или интерфейс.")],
      acceptedCompletionCount: 0,
    };
  }
  if (!optionsAreValid(input.options)) {
    return {
      centerlines,
      diagnostics: [invalidDiagnostic("Параметры восстановления стен недопустимы.")],
      acceptedCompletionCount: 0,
    };
  }
  if (input.centerlines.length > input.options.maximumInputCenterlines) {
    return {
      centerlines,
      diagnostics: [diagnostic(
        "completion-budget-exceeded",
        null,
        null,
        `Восстановление пропущено: получено ${input.centerlines.length} осей при лимите ${input.options.maximumInputCenterlines}.`,
      )],
      acceptedCompletionCount: 0,
    };
  }
  if (hasInvalidGeometry) {
    return {
      centerlines,
      diagnostics: [invalidDiagnostic("Некорректные оси стен исключены; восстановление выполнено в безопасном режиме без изменений.")],
      acceptedCompletionCount: 0,
    };
  }

  const indexed = buildIndexedLines(centerlines, input.options);
  const budget: Budget = { comparisons: 0, hypotheses: 0 };
  const bridgeEvaluation = evaluateBridgeHypotheses(indexed, input.mask, input.options, budget);
  if (bridgeEvaluation.budgetExceeded) {
    return {
      centerlines,
      diagnostics: [diagnostic(
        "completion-budget-exceeded",
        null,
        null,
        "Восстановление пропущено: превышен безопасный бюджет мостов.",
      )],
      acceptedCompletionCount: 0,
    };
  }
  const junctionEvaluation = evaluateJunctionHypotheses(indexed, input.mask, input.options, budget);
  if (junctionEvaluation.budgetExceeded) {
    return {
      centerlines,
      diagnostics: [diagnostic(
        "completion-budget-exceeded",
        null,
        null,
        "Восстановление пропущено: превышен безопасный бюджет примыканий.",
      )],
      acceptedCompletionCount: 0,
    };
  }

  const acceptedBridges = mutualBestBridges(bridgeEvaluation.hypotheses)
    .slice(0, input.options.maximumAcceptedCompletions);
  const consumedByBridge = new Set<number>();
  const output: LocalWallCenterline[] = [];
  const diagnostics: WallCompletionDiagnostic[] = [
    ...bridgeEvaluation.diagnostics,
    ...junctionEvaluation.diagnostics,
  ];
  let acceptedCompletionCount = 0;

  for (const hypothesis of acceptedBridges) {
    if (consumedByBridge.has(hypothesis.firstIndex) || consumedByBridge.has(hypothesis.secondIndex)) continue;
    consumedByBridge.add(hypothesis.firstIndex);
    consumedByBridge.add(hypothesis.secondIndex);
    output.push(hypothesis.merged);
    acceptedCompletionCount += 1;
    diagnostics.push(diagnostic(
      "bridge-accepted",
      hypothesis.firstIndex,
      hypothesis.secondIndex,
      "Малый разрыв стены восстановлен по непрерывному структурному растру.",
    ));
  }

  const updatedByJunction = new Map<number, LocalWallCenterline>();
  for (const hypothesis of junctionEvaluation.hypotheses) {
    if (acceptedCompletionCount >= input.options.maximumAcceptedCompletions) break;
    if (consumedByBridge.has(hypothesis.sourceIndex)) continue;
    const current = updatedByJunction.get(hypothesis.sourceIndex) ?? centerlines[hypothesis.sourceIndex]!;
    updatedByJunction.set(hypothesis.sourceIndex, extendLine(current, hypothesis));
    acceptedCompletionCount += 1;
    diagnostics.push(diagnostic(
      "junction-extension-accepted",
      hypothesis.sourceIndex,
      hypothesis.targetIndex,
      "Конец стены продлён до единственного подтверждённого перпендикулярного примыкания.",
    ));
  }

  for (let index = 0; index < centerlines.length; index += 1) {
    if (consumedByBridge.has(index)) continue;
    output.push(updatedByJunction.get(index) ?? centerlines[index]!);
  }

  return {
    centerlines: canonicalCenterlines(output),
    diagnostics: sortedDiagnostics(diagnostics),
    acceptedCompletionCount,
  };
}

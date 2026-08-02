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
const MAX_NEIGHBOURS_PER_LINE = 8;

type AxisOrientation = "horizontal" | "vertical";

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

function compatibleThickness(first: LocalWallCenterline, second: LocalWallCenterline): number | null {
  if (first.thicknessPx === null) return second.thicknessPx;
  if (second.thicknessPx === null) return first.thicknessPx;
  return (
    first.thicknessPx * first.evidenceCount + second.thicknessPx * second.evidenceCount
  ) / (first.evidenceCount + second.evidenceCount);
}

function confidenceAfterBridge(first: RecognitionConfidence, second: RecognitionConfidence): RecognitionConfidence {
  if (first === "low" || second === "low") return "low";
  return "medium";
}

function mergedCenterline(
  first: LocalWallCenterline,
  second: LocalWallCenterline,
  axis: AxisOrientation,
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
    thicknessPx: compatibleThickness(first, second),
    evidenceCount,
    confidence: confidenceAfterBridge(first.confidence, second.confidence),
    reasons: [...new Set([
      ...first.reasons,
      ...second.reasons,
      "completion-raster-bridge",
    ])].sort(),
  };
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

function corridorEvidence({
  first,
  second,
  axis,
  mask,
  thicknessPx,
  options,
}: Readonly<{
  first: LocalWallCenterline;
  second: LocalWallCenterline;
  axis: AxisOrientation;
  mask: StructuralMaskView;
  thicknessPx: number;
  options: WallCompletionOptions;
}>): CorridorEvidence | null {
  const gapStart = alongEnd(first, axis);
  const gapEnd = alongStart(second, axis);
  const alongSamples = Math.max(1, Math.ceil(gapEnd - gapStart) - 1);
  const acrossSamples = Math.max(3, Math.min(11, Math.round(thicknessPx)));
  if (alongSamples * acrossSamples > options.maximumSamplesPerHypothesis) return null;

  const center = (
    perpendicularCenter(first, axis) * first.evidenceCount
    + perpendicularCenter(second, axis) * second.evidenceCount
  ) / (first.evidenceCount + second.evidenceCount);
  const half = thicknessPx / 2;
  let structuralSamples = 0;
  let supportedColumns = 0;
  let longestSupportedRun = 0;
  let currentSupportedRun = 0;

  try {
    for (let alongIndex = 0; alongIndex < alongSamples; alongIndex += 1) {
      const along = gapStart + ((alongIndex + 1) / (alongSamples + 1)) * (gapEnd - gapStart);
      let structuralAcross = 0;
      for (let acrossIndex = 0; acrossIndex < acrossSamples; acrossIndex += 1) {
        const perpendicular = center - half + ((acrossIndex + 0.5) / acrossSamples) * thicknessPx;
        const x = axis === "horizontal" ? along : perpendicular;
        const y = axis === "horizontal" ? perpendicular : along;
        const sampleX = Math.max(0, Math.min(mask.widthPx - 1, Math.round(x)));
        const sampleY = Math.max(0, Math.min(mask.heightPx - 1, Math.round(y)));
        if (mask.isStructural(sampleX, sampleY)) {
          structuralSamples += 1;
          structuralAcross += 1;
        }
      }
      const supported = structuralAcross / acrossSamples >= 0.5;
      if (supported) {
        supportedColumns += 1;
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

function diagnostic(
  code: WallCompletionDiagnosticCode,
  firstIndex: number,
  secondIndex: number,
  message: string,
): WallCompletionDiagnostic {
  return { code, firstIndex, secondIndex, message };
}

function bridgeHypotheses(
  centerlines: readonly LocalWallCenterline[],
  mask: StructuralMaskView,
  options: WallCompletionOptions,
): Readonly<{
  hypotheses: readonly BridgeHypothesis[];
  diagnostics: readonly WallCompletionDiagnostic[];
  budgetExceeded: boolean;
}> {
  const diagnostics: WallCompletionDiagnostic[] = [];
  const hypotheses: BridgeHypothesis[] = [];
  let comparisons = 0;

  const indexed = centerlines.map((line, index) => ({
    line,
    index,
    axis: orientation(line, options.maximumAngleDeltaDeg),
  }));

  for (const axis of ["horizontal", "vertical"] as const) {
    const candidates = indexed
      .filter((entry): entry is typeof entry & { axis: AxisOrientation } => entry.axis === axis)
      .sort((first, second) =>
        perpendicularCenter(first.line, axis) - perpendicularCenter(second.line, axis)
        || alongStart(first.line, axis) - alongStart(second.line, axis)
        || alongEnd(first.line, axis) - alongEnd(second.line, axis)
        || first.index - second.index);

    for (let firstPosition = 0; firstPosition < candidates.length; firstPosition += 1) {
      const firstEntry = candidates[firstPosition]!;
      const neighbourLimit = Math.min(candidates.length, firstPosition + 1 + MAX_NEIGHBOURS_PER_LINE);
      for (let secondPosition = firstPosition + 1; secondPosition < neighbourLimit; secondPosition += 1) {
        comparisons += 1;
        if (comparisons > options.maximumPairComparisons) {
          return { hypotheses: [], diagnostics, budgetExceeded: true };
        }
        const secondEntry = candidates[secondPosition]!;
        const first = firstEntry.line;
        const second = secondEntry.line;
        const thicknessPx = compatibleThickness(first, second);
        if (thicknessPx === null) continue;

        const offset = Math.abs(perpendicularCenter(first, axis) - perpendicularCenter(second, axis));
        if (offset > thicknessPx * options.maximumOffsetThicknessRatio + EPSILON) {
          continue;
        }
        if (first.thicknessPx !== null && second.thicknessPx !== null) {
          const thicknessDelta = Math.abs(first.thicknessPx - second.thicknessPx)
            / Math.max(first.thicknessPx, second.thicknessPx);
          if (thicknessDelta > options.maximumThicknessDeltaRatio + EPSILON) {
            diagnostics.push(diagnostic(
              "bridge-thickness-mismatch",
              firstEntry.index,
              secondEntry.index,
              "Фрагменты не объединены: толщина стен несовместима.",
            ));
            continue;
          }
        }

        const ordered = alongStart(first, axis) <= alongStart(second, axis)
          ? [firstEntry, secondEntry] as const
          : [secondEntry, firstEntry] as const;
        const left = ordered[0].line;
        const right = ordered[1].line;
        const gapPx = alongStart(right, axis) - alongEnd(left, axis);
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

        const evidence = corridorEvidence({
          first: left,
          second: right,
          axis,
          mask,
          thicknessPx,
          options,
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
        if (hypotheses.length >= options.maximumHypotheses) {
          return { hypotheses: [], diagnostics, budgetExceeded: true };
        }
        hypotheses.push({
          firstIndex: ordered[0].index,
          secondIndex: ordered[1].index,
          gapPx,
          occupancyRatio: evidence.occupancyRatio,
          continuousRunRatio: evidence.continuousRunRatio,
          merged: mergedCenterline(left, right, axis),
        });
      }
    }
  }

  return {
    hypotheses: hypotheses.sort((first, second) =>
      first.gapPx - second.gapPx
      || second.occupancyRatio - first.occupancyRatio
      || second.continuousRunRatio - first.continuousRunRatio
      || first.firstIndex - second.firstIndex
      || first.secondIndex - second.secondIndex),
    diagnostics: diagnostics.sort((first, second) =>
      (first.firstIndex ?? -1) - (second.firstIndex ?? -1)
      || (first.secondIndex ?? -1) - (second.secondIndex ?? -1)
      || first.code.localeCompare(second.code)),
    budgetExceeded: false,
  };
}

function mutualBestHypotheses(hypotheses: readonly BridgeHypothesis[]): readonly BridgeHypothesis[] {
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
      diagnostics: [{
        code: "completion-budget-exceeded",
        firstIndex: null,
        secondIndex: null,
        message: `Восстановление пропущено: получено ${input.centerlines.length} осей при лимите ${input.options.maximumInputCenterlines}.`,
      }],
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

  const evaluated = bridgeHypotheses(centerlines, input.mask, input.options);
  if (evaluated.budgetExceeded) {
    return {
      centerlines,
      diagnostics: [{
        code: "completion-budget-exceeded",
        firstIndex: null,
        secondIndex: null,
        message: "Восстановление пропущено: превышен безопасный бюджет гипотез.",
      }],
      acceptedCompletionCount: 0,
    };
  }

  const accepted = mutualBestHypotheses(evaluated.hypotheses)
    .slice(0, input.options.maximumAcceptedCompletions);
  const consumed = new Set<number>();
  const completed: LocalWallCenterline[] = [];
  const acceptedDiagnostics: WallCompletionDiagnostic[] = [];

  for (const hypothesis of accepted) {
    if (consumed.has(hypothesis.firstIndex) || consumed.has(hypothesis.secondIndex)) continue;
    consumed.add(hypothesis.firstIndex);
    consumed.add(hypothesis.secondIndex);
    completed.push(hypothesis.merged);
    acceptedDiagnostics.push(diagnostic(
      "bridge-accepted",
      hypothesis.firstIndex,
      hypothesis.secondIndex,
      "Малый разрыв стены восстановлен по непрерывному структурному растру.",
    ));
  }
  for (let index = 0; index < centerlines.length; index += 1) {
    if (!consumed.has(index)) completed.push(centerlines[index]!);
  }

  return {
    centerlines: canonicalCenterlines(completed),
    diagnostics: [...evaluated.diagnostics, ...acceptedDiagnostics].sort((first, second) =>
      (first.firstIndex ?? -1) - (second.firstIndex ?? -1)
      || (first.secondIndex ?? -1) - (second.secondIndex ?? -1)
      || first.code.localeCompare(second.code)),
    acceptedCompletionCount: acceptedDiagnostics.length,
  };
}

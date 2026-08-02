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
  maximumGapShortSideRatio: 0.018,
  maximumGapPx: 36,
  minimumOccupancyRatio: 0.64,
  minimumContinuousRunRatio: 0.72,
  likelyOpeningMaximumOccupancyRatio: 0.2,
  junctionExtensionThicknessRatio: 0.85,
});

const EPSILON = 1e-9;

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

  return {
    centerlines,
    diagnostics: [],
    acceptedCompletionCount: 0,
  };
}

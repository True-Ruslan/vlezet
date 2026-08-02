import type { DetectedLineSegment } from "./local-lines";

export type StructuralWallOrientation = "horizontal" | "vertical";

export type StructuralWallRegion = Readonly<{
  orientation: StructuralWallOrientation;
  startPx: Readonly<{ x: number; y: number }>;
  endPx: Readonly<{ x: number; y: number }>;
  thicknessPx: number;
  evidenceLineCount: number;
}>;

export type StructuralWallRegionOptions = Readonly<{
  minimumLengthPx: number;
  minimumThicknessPx: number;
  maximumThicknessPx: number;
  minimumRunOverlapRatio: number;
  minimumRunLengthSimilarityRatio: number;
  minimumAspectRatio: number;
}>;

export type ExtractStructuralWallRegionsInput = Readonly<{
  widthPx: number;
  heightPx: number;
  pixels: ArrayLike<number>;
  options: StructuralWallRegionOptions;
}>;

export type StructuralWallRegionExtraction = Readonly<{
  regions: readonly StructuralWallRegion[];
  boundarySegments: readonly DetectedLineSegment[];
}>;

type Run = Readonly<{ start: number; end: number }>;
type MutableBand = {
  scanIndexes: number[];
  runs: Run[];
  lastRun: Run;
  lastScanIndex: number;
};

const EPSILON = 1e-9;

function finitePositive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} должен быть положительным конечным числом.`);
  }
  return value;
}

function unitInterval(value: number, label: string): number {
  if (!Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} должен находиться в диапазоне от 0 до 1.`);
  }
  return value;
}

function runLength(run: Run): number {
  return run.end - run.start + 1;
}

function overlapRatio(first: Run, second: Run): number {
  const overlap = Math.max(0, Math.min(first.end, second.end) - Math.max(first.start, second.start) + 1);
  return overlap / Math.max(1, Math.min(runLength(first), runLength(second)));
}

function lengthSimilarity(first: Run, second: Run): number {
  return Math.min(runLength(first), runLength(second)) / Math.max(runLength(first), runLength(second));
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((first, second) => first - second);
  const middle = Math.floor(sorted.length / 2);
  if (sorted.length % 2 === 1) return sorted[middle]!;
  return (sorted[middle - 1]! + sorted[middle]!) / 2;
}

function pixelAt(
  input: ExtractStructuralWallRegionsInput,
  orientation: StructuralWallOrientation,
  scanIndex: number,
  offset: number,
): boolean {
  const x = orientation === "horizontal" ? offset : scanIndex;
  const y = orientation === "horizontal" ? scanIndex : offset;
  return (input.pixels[y * input.widthPx + x] ?? 0) > 0;
}

function runsForScanLine(
  input: ExtractStructuralWallRegionsInput,
  orientation: StructuralWallOrientation,
  scanIndex: number,
  minimumLengthPx: number,
): Run[] {
  const scanLength = orientation === "horizontal" ? input.widthPx : input.heightPx;
  const runs: Run[] = [];
  let start: number | null = null;
  for (let offset = 0; offset < scanLength; offset += 1) {
    if (pixelAt(input, orientation, scanIndex, offset)) {
      if (start === null) start = offset;
      continue;
    }
    if (start !== null && offset - start >= minimumLengthPx) {
      runs.push({ start, end: offset - 1 });
    }
    start = null;
  }
  if (start !== null && scanLength - start >= minimumLengthPx) {
    runs.push({ start, end: scanLength - 1 });
  }
  return runs;
}

function extractBands(
  input: ExtractStructuralWallRegionsInput,
  orientation: StructuralWallOrientation,
  options: StructuralWallRegionOptions,
): MutableBand[] {
  const scanCount = orientation === "horizontal" ? input.heightPx : input.widthPx;
  let active: MutableBand[] = [];
  const completed: MutableBand[] = [];

  for (let scanIndex = 0; scanIndex < scanCount; scanIndex += 1) {
    const runs = runsForScanLine(input, orientation, scanIndex, options.minimumLengthPx);
    const usedActiveIndexes = new Set<number>();
    const nextActive: MutableBand[] = [];

    for (const run of runs) {
      let bestIndex = -1;
      let bestScore = Number.NEGATIVE_INFINITY;
      for (let index = 0; index < active.length; index += 1) {
        if (usedActiveIndexes.has(index)) continue;
        const candidate = active[index]!;
        if (scanIndex - candidate.lastScanIndex > 1) continue;
        const overlap = overlapRatio(run, candidate.lastRun);
        const similarity = lengthSimilarity(run, candidate.lastRun);
        if (overlap + EPSILON < options.minimumRunOverlapRatio) continue;
        if (similarity + EPSILON < options.minimumRunLengthSimilarityRatio) continue;
        const score = overlap * 2 + similarity;
        if (score > bestScore) {
          bestIndex = index;
          bestScore = score;
        }
      }

      if (bestIndex < 0) {
        nextActive.push({
          scanIndexes: [scanIndex],
          runs: [run],
          lastRun: run,
          lastScanIndex: scanIndex,
        });
        continue;
      }

      usedActiveIndexes.add(bestIndex);
      const matched = active[bestIndex]!;
      nextActive.push({
        scanIndexes: [...matched.scanIndexes, scanIndex],
        runs: [...matched.runs, run],
        lastRun: run,
        lastScanIndex: scanIndex,
      });
    }

    for (let index = 0; index < active.length; index += 1) {
      if (!usedActiveIndexes.has(index)) completed.push(active[index]!);
    }
    active = nextActive;
  }

  return [...completed, ...active];
}

function regionFromBand(
  band: MutableBand,
  orientation: StructuralWallOrientation,
  options: StructuralWallRegionOptions,
): StructuralWallRegion | null {
  const scanMinimum = Math.min(...band.scanIndexes);
  const scanMaximum = Math.max(...band.scanIndexes);
  const thicknessPx = scanMaximum - scanMinimum + 1;
  if (thicknessPx < options.minimumThicknessPx || thicknessPx > options.maximumThicknessPx) return null;

  const runStart = median(band.runs.map((run) => run.start));
  const runEnd = median(band.runs.map((run) => run.end));
  const lengthPx = runEnd - runStart + 1;
  if (lengthPx < options.minimumLengthPx) return null;
  if (lengthPx / thicknessPx + EPSILON < options.minimumAspectRatio) return null;

  const center = (scanMinimum + scanMaximum) / 2;
  if (orientation === "horizontal") {
    return {
      orientation,
      startPx: { x: runStart, y: center },
      endPx: { x: runEnd, y: center },
      thicknessPx,
      evidenceLineCount: band.scanIndexes.length,
    };
  }
  return {
    orientation,
    startPx: { x: center, y: runStart },
    endPx: { x: center, y: runEnd },
    thicknessPx,
    evidenceLineCount: band.scanIndexes.length,
  };
}

function boundarySegments(region: StructuralWallRegion): readonly DetectedLineSegment[] {
  const halfSpan = (region.thicknessPx - 1) / 2;
  if (region.orientation === "horizontal") {
    return [
      {
        x1: region.startPx.x,
        y1: region.startPx.y - halfSpan,
        x2: region.endPx.x,
        y2: region.endPx.y - halfSpan,
      },
      {
        x1: region.startPx.x,
        y1: region.startPx.y + halfSpan,
        x2: region.endPx.x,
        y2: region.endPx.y + halfSpan,
      },
    ];
  }
  return [
    {
      x1: region.startPx.x - halfSpan,
      y1: region.startPx.y,
      x2: region.endPx.x - halfSpan,
      y2: region.endPx.y,
    },
    {
      x1: region.startPx.x + halfSpan,
      y1: region.startPx.y,
      x2: region.endPx.x + halfSpan,
      y2: region.endPx.y,
    },
  ];
}

export function extractStructuralWallRegions(
  input: ExtractStructuralWallRegionsInput,
): StructuralWallRegionExtraction {
  const widthPx = Math.round(finitePositive(input.widthPx, "Ширина растра"));
  const heightPx = Math.round(finitePositive(input.heightPx, "Высота растра"));
  if (input.pixels.length < widthPx * heightPx) {
    throw new Error("Структурный растр короче заявленных размеров.");
  }
  const options: StructuralWallRegionOptions = {
    minimumLengthPx: finitePositive(input.options.minimumLengthPx, "Минимальная длина"),
    minimumThicknessPx: finitePositive(input.options.minimumThicknessPx, "Минимальная толщина"),
    maximumThicknessPx: finitePositive(input.options.maximumThicknessPx, "Максимальная толщина"),
    minimumRunOverlapRatio: unitInterval(input.options.minimumRunOverlapRatio, "Перекрытие штрихов"),
    minimumRunLengthSimilarityRatio: unitInterval(
      input.options.minimumRunLengthSimilarityRatio,
      "Сходство длины штрихов",
    ),
    minimumAspectRatio: finitePositive(input.options.minimumAspectRatio, "Минимальное соотношение сторон"),
  };
  if (options.maximumThicknessPx < options.minimumThicknessPx) {
    throw new Error("Максимальная толщина не может быть меньше минимальной.");
  }

  const regions = (["horizontal", "vertical"] as const)
    .flatMap((orientation) => extractBands({ ...input, widthPx, heightPx }, orientation, options)
      .map((band) => regionFromBand(band, orientation, options))
      .filter((region): region is StructuralWallRegion => region !== null))
    .sort((first, second) =>
      first.orientation.localeCompare(second.orientation)
      || first.startPx.x - second.startPx.x
      || first.startPx.y - second.startPx.y
      || first.endPx.x - second.endPx.x
      || first.endPx.y - second.endPx.y);

  return {
    regions,
    boundarySegments: regions.flatMap(boundarySegments),
  };
}

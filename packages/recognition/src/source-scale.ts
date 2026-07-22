import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";

export function sourceRasterPixelScale(input: Readonly<{
  analysisWidthPx: number;
  analysisHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
}>): number {
  const values = [input.analysisWidthPx, input.analysisHeightPx, input.sourceWidthPx, input.sourceHeightPx];
  if (values.some((value) => !Number.isFinite(value) || value <= 0)) throw new Error("Размеры растра должны быть положительными конечными числами.");
  const scaleX = input.sourceWidthPx / input.analysisWidthPx;
  const scaleY = input.sourceHeightPx / input.analysisHeightPx;
  const divergence = Math.abs(scaleX - scaleY) / Math.max(scaleX, scaleY);
  if (divergence > 0.01) throw new Error("Аналитическая копия должна сохранять пропорции исходного растра.");
  return (scaleX + scaleY) / 2;
}

export function rescaleRecognitionPixelEvidence(input: Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
  analysisWidthPx: number;
  analysisHeightPx: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
}>): Readonly<{ walls: RecognitionWallCandidate[]; openings: RecognitionOpeningCandidate[] }> {
  const scale = sourceRasterPixelScale(input);
  return {
    walls: input.walls.map((wall) => ({
      ...wall,
      estimatedThicknessPx: wall.estimatedThicknessPx == null ? null : wall.estimatedThicknessPx * scale,
    })),
    openings: input.openings.map((opening) => ({
      ...opening,
      widthPx: opening.widthPx == null ? null : opening.widthPx * scale,
    })),
  };
}

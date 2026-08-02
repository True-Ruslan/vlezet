import type { LocalWallCenterline } from "./wall-topology";

function length(line: LocalWallCenterline): number {
  return Math.hypot(
    line.endPx.x - line.startPx.x,
    line.endPx.y - line.startPx.y,
  );
}

function stableLineKey(line: LocalWallCenterline): string {
  return [
    line.startPx.x,
    line.startPx.y,
    line.endPx.x,
    line.endPx.y,
    line.thicknessPx ?? -1,
  ].map((value) => value.toFixed(6)).join(":");
}

export function selectDominantWallThicknessCenterlines(input: Readonly<{
  centerlines: readonly LocalWallCenterline[];
  binWidthPx: number;
}>): LocalWallCenterline[] {
  if (!Number.isFinite(input.binWidthPx) || input.binWidthPx <= 0) {
    throw new Error("Ширина полосы толщин должна быть положительным конечным числом.");
  }
  if (input.centerlines.length <= 1) return [...input.centerlines];

  const bins = new Map<number, { weightedThickness: number; weight: number }>();
  for (const line of input.centerlines) {
    if (line.thicknessPx === null || !Number.isFinite(line.thicknessPx) || line.thicknessPx <= 0) continue;
    const bin = Math.round(line.thicknessPx / input.binWidthPx);
    const weight = length(line) * Math.sqrt(Math.max(1, line.evidenceCount));
    const existing = bins.get(bin) ?? { weightedThickness: 0, weight: 0 };
    existing.weightedThickness += line.thicknessPx * weight;
    existing.weight += weight;
    bins.set(bin, existing);
  }
  if (bins.size === 0) return [...input.centerlines];

  const dominant = [...bins.entries()]
    .sort((first, second) =>
      second[1].weight - first[1].weight
      || first[0] - second[0])[0]![1];
  const dominantThicknessPx = dominant.weightedThickness / dominant.weight;
  const minimumThicknessPx = dominantThicknessPx * 0.55;
  const maximumThicknessPx = dominantThicknessPx * 1.75;
  const filtered = input.centerlines
    .filter((line) => line.thicknessPx === null || (
      line.thicknessPx >= minimumThicknessPx
      && line.thicknessPx <= maximumThicknessPx
    ))
    .map((line): LocalWallCenterline => ({
      ...line,
      reasons: [...new Set([...line.reasons, "dominant-wall-thickness-band"])].sort(),
    }))
    .sort((first, second) => stableLineKey(first).localeCompare(stableLineKey(second)));

  return filtered.length >= 2 ? filtered : [...input.centerlines];
}

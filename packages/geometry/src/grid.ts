const GRID_STEPS_MM = [50, 100, 250, 500, 1000, 2000, 5000, 10000] as const;
const MIN_GRID_SPACING_PX = 28;

export function chooseGridStep(pixelsPerMillimeter: number): number {
  for (const step of GRID_STEPS_MM) {
    if (step * pixelsPerMillimeter >= MIN_GRID_SPACING_PX) {
      return step;
    }
  }

  return GRID_STEPS_MM[GRID_STEPS_MM.length - 1];
}

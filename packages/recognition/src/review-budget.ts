import type { RecognitionWallCandidate } from "./model";

export const DEFAULT_MAX_REVIEWABLE_LOCAL_WALLS = 80;

export type LocalWallReviewBudgetResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  overloaded: boolean;
  originalWallCount: number;
  droppedWallCount: number;
}>;

export function enforceLocalWallReviewBudget(input: Readonly<{
  walls: readonly RecognitionWallCandidate[];
  maximumWalls?: number;
}>): LocalWallReviewBudgetResult {
  const maximumWalls = input.maximumWalls ?? DEFAULT_MAX_REVIEWABLE_LOCAL_WALLS;
  if (!Number.isInteger(maximumWalls) || maximumWalls <= 0) {
    throw new Error("Лимит кандидатов стен должен быть положительным целым числом.");
  }
  const originalWallCount = input.walls.length;
  if (originalWallCount <= maximumWalls) {
    return {
      walls: input.walls,
      overloaded: false,
      originalWallCount,
      droppedWallCount: 0,
    };
  }
  return {
    walls: [],
    overloaded: true,
    originalWallCount,
    droppedWallCount: originalWallCount,
  };
}

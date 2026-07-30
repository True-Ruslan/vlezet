import type { VlezetDocument } from "@vlezet/domain";
import {
  minimumGapWitnessBetweenOrientedRectangles,
  objectRectangle,
  type Point2,
} from "@vlezet/geometry";
import type { PlanningCandidate } from "@vlezet/planning";
import { planningPairIds, planningPairKey } from "./planning-pair-key";

const EXACT_SPATIAL_EPSILON_MM = 1e-6;

export type ExactGapAnnotation = Readonly<{
  pairKey: string;
  firstPoint: Point2;
  secondPoint: Point2;
  actualMm: number;
  requiredMm: number;
  satisfied: boolean;
  zeroLength: boolean;
  label: string;
}>;

function compactMm(value: number): number {
  return Number(value.toFixed(2));
}

export function deriveExactGapAnnotation(
  previewDocument: VlezetDocument,
  candidate: PlanningCandidate | null,
  activePairKey: string | null,
): ExactGapAnnotation | null {
  const ids = activePairKey ? planningPairIds(activePairKey) : null;
  if (!candidate || !activePairKey || !ids) return null;

  const constraint = (candidate.constraints ?? []).find((item) =>
    item.kind === "pair-min-gap" &&
    planningPairKey(item.objectIds[0], item.objectIds[1]) === activePairKey,
  );
  if (!constraint || constraint.kind !== "pair-min-gap") return null;

  const first = previewDocument.placedObjects.find((object) => object.id === ids[0]);
  const second = previewDocument.placedObjects.find((object) => object.id === ids[1]);
  if (!first || !second) return null;

  const witness = minimumGapWitnessBetweenOrientedRectangles(
    objectRectangle(first),
    objectRectangle(second),
  );
  if (witness.relation === "overlapping" || !witness.firstPoint || !witness.secondPoint) return null;

  const actualMm = witness.distanceMm;
  return {
    pairKey: activePairKey,
    firstPoint: witness.firstPoint,
    secondPoint: witness.secondPoint,
    actualMm,
    requiredMm: constraint.minimumMm,
    satisfied: actualMm + EXACT_SPATIAL_EPSILON_MM >= constraint.minimumMm,
    zeroLength: actualMm <= EXACT_SPATIAL_EPSILON_MM,
    label: `↔ Зазор ${compactMm(actualMm)} мм`,
  };
}

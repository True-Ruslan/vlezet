import { normalizeRotationDeg, type VlezetDocument } from "@vlezet/domain";
import { PlanningError, type PlanningCandidate } from "./contracts";
import { evaluatePlanningCandidate } from "./evaluation";

export function applyPlanningCandidateToDocument(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): VlezetDocument {
  const evaluation = evaluatePlanningCandidate(document, candidate);
  if (!evaluation.valid) {
    throw new PlanningError("candidate-invalid", "Planning candidate is no longer valid for the current document.");
  }

  const placements = new Map(candidate.placements.map((placement) => [placement.objectId, placement]));
  return {
    ...document,
    placedObjects: document.placedObjects.map((object) => {
      const placement = placements.get(object.id);
      return placement ? {
        ...object,
        position: { ...placement.position },
        rotationDeg: normalizeRotationDeg(placement.rotationDeg),
      } : object;
    }),
  };
}

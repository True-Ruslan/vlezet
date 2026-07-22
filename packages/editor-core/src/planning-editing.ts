import type { VlezetDocument } from "@vlezet/domain";
import { applyPlanningCandidateToDocument, type PlanningCandidate } from "@vlezet/planning";

export function applyPlanningCandidate(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): VlezetDocument {
  return applyPlanningCandidateToDocument(document, candidate);
}

import type { VlezetDocument } from "@vlezet/domain";
import { placementOptionsForObject } from "./anchors";
import {
  MAX_DISPLAYED_PLANNING_CANDIDATES,
  MAX_PLANNING_EVALUATIONS,
  type PlanningCandidate,
  type PlanningPlacement,
  type PlanningRequest,
  validatePlanningRequest,
} from "./contracts";
import {
  comparePlanningCandidateEvaluations,
  evaluatePlanningCandidate,
  stableCandidateKey,
  type PlanningCandidateEvaluation,
} from "./evaluation";

export type RankedPlanningCandidate = Readonly<{
  candidate: PlanningCandidate;
  evaluation: PlanningCandidateEvaluation;
}>;

export type PlanningResult = Readonly<{
  roomId: string;
  evaluatedCandidateCount: number;
  validCandidateCount: number;
  candidates: readonly RankedPlanningCandidate[];
}>;

function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return (hash >>> 0).toString(36);
}

function sameRotation(first: number, second: number): boolean {
  return ((first - second) % 360 + 360) % 360 === 0;
}

function changesAnyObject(document: VlezetDocument, placements: readonly PlanningPlacement[]): boolean {
  return placements.some((placement) => {
    const source = document.placedObjects.find((object) => object.id === placement.objectId);
    return !source || source.position.x !== placement.position.x || source.position.y !== placement.position.y ||
      !sameRotation(source.rotationDeg, placement.rotationDeg);
  });
}

export function planLayoutAlternatives(
  document: VlezetDocument,
  request: PlanningRequest,
): PlanningResult {
  const context = validatePlanningRequest(document, request);
  const optionSets = context.selectedObjects.map((object) => placementOptionsForObject(context.room, object));
  const seen = new Set<string>();
  const valid: RankedPlanningCandidate[] = [];
  let evaluatedCandidateCount = 0;

  const visit = (objectIndex: number, placements: PlanningPlacement[]) => {
    if (evaluatedCandidateCount >= MAX_PLANNING_EVALUATIONS) return;
    if (objectIndex === context.selectedObjects.length) {
      evaluatedCandidateCount += 1;
      if (!changesAnyObject(document, placements)) return;
      const provisional: PlanningCandidate = { id: "candidate:pending", roomId: context.room.id, placements: placements.map((placement) => ({
        ...placement,
        position: { ...placement.position },
      })) };
      const key = stableCandidateKey(provisional);
      if (seen.has(key)) return;
      seen.add(key);
      const candidate: PlanningCandidate = { ...provisional, id: `candidate:${hashKey(key)}` };
      const evaluation = evaluatePlanningCandidate(document, candidate);
      if (evaluation.valid) valid.push({ candidate, evaluation });
      return;
    }

    const object = context.selectedObjects[objectIndex]!;
    for (const option of optionSets[objectIndex] ?? []) {
      if (evaluatedCandidateCount >= MAX_PLANNING_EVALUATIONS) break;
      visit(objectIndex + 1, [...placements, {
        objectId: object.id,
        position: { ...option.position },
        rotationDeg: option.rotationDeg,
      }]);
    }
  };

  visit(0, []);
  valid.sort((first, second) => comparePlanningCandidateEvaluations(first.evaluation, second.evaluation));

  return {
    roomId: context.room.id,
    evaluatedCandidateCount,
    validCandidateCount: valid.length,
    candidates: valid.slice(0, MAX_DISPLAYED_PLANNING_CANDIDATES),
  };
}

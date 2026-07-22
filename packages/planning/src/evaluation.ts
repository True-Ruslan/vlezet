import type { VlezetDocument } from "@vlezet/domain";
import { evaluateObjectFits } from "@vlezet/geometry";
import type { PlanningCandidate } from "./contracts";

export type PlanningCandidateEvaluation = Readonly<{
  candidateId: string;
  valid: boolean;
  tightObjectCount: number;
  recommendationCount: number;
  rotatedObjectCount: number;
  totalMovementMm: number;
  reasons: readonly string[];
  stableKey: string;
}>;

function stableNumber(value: number): string {
  return Number(value.toFixed(6)).toString();
}

export function stableCandidateKey(candidate: PlanningCandidate): string {
  return [candidate.roomId, ...candidate.placements.map((placement) => [
    placement.objectId,
    stableNumber(placement.position.x),
    stableNumber(placement.position.y),
    stableNumber(placement.rotationDeg),
  ].join(":"))].join("|");
}

function candidateDocument(document: VlezetDocument, candidate: PlanningCandidate): VlezetDocument | null {
  if (candidate.placements.length < 1) return null;
  const ids = candidate.placements.map((placement) => placement.objectId);
  if (new Set(ids).size !== ids.length) return null;
  const placements = new Map(candidate.placements.map((placement) => [placement.objectId, placement]));
  if (candidate.placements.some((placement) =>
    !Number.isFinite(placement.position.x) || !Number.isFinite(placement.position.y) || !Number.isFinite(placement.rotationDeg) ||
    !document.placedObjects.some((object) => object.id === placement.objectId)
  )) return null;

  return {
    ...document,
    placedObjects: document.placedObjects.map((object) => {
      const placement = placements.get(object.id);
      return placement ? {
        ...object,
        position: { ...placement.position },
        rotationDeg: placement.rotationDeg,
      } : object;
    }),
  };
}

export function evaluatePlanningCandidate(
  document: VlezetDocument,
  candidate: PlanningCandidate,
): PlanningCandidateEvaluation {
  const stableKey = stableCandidateKey(candidate);
  const evaluationDocument = candidateDocument(document, candidate);
  if (!evaluationDocument) {
    return {
      candidateId: candidate.id, valid: false, tightObjectCount: 0, recommendationCount: 0,
      rotatedObjectCount: 0, totalMovementMm: Number.POSITIVE_INFINITY,
      reasons: ["Вариант содержит некорректные данные размещения."], stableKey,
    };
  }

  const fit = evaluateObjectFits(evaluationDocument);
  const placementIds = new Set(candidate.placements.map((placement) => placement.objectId));
  let tightObjectCount = 0;
  let recommendationCount = 0;
  let rotatedObjectCount = 0;
  let totalMovementMm = 0;
  let valid = fit.planValid;
  const diagnosticMessages: string[] = [];

  for (const placement of candidate.placements) {
    const source = document.placedObjects.find((object) => object.id === placement.objectId)!;
    const result = fit.byObjectId.get(placement.objectId);
    if (!result || result.status === "blocked" || result.roomId !== candidate.roomId) valid = false;
    if (result?.status === "tight") tightObjectCount += 1;
    for (const diagnostic of result?.diagnostics ?? []) {
      if (diagnostic.severity === "recommendation") recommendationCount += 1;
      if (!diagnosticMessages.includes(diagnostic.message)) diagnosticMessages.push(diagnostic.message);
    }
    if (((placement.rotationDeg - source.rotationDeg) % 360 + 360) % 360 !== 0) rotatedObjectCount += 1;
    totalMovementMm += Math.hypot(placement.position.x - source.position.x, placement.position.y - source.position.y);
  }

  const reasons: string[] = [];
  if (valid) {
    reasons.push("Все выбранные предметы помещаются без столкновений.");
    reasons.push("Открывание дверей не перекрыто.");
    reasons.push(...diagnosticMessages);
    if (placementIds.size > 0 && totalMovementMm === 0 && rotatedObjectCount === 0) {
      reasons.push("Текущая расстановка сохранена для выбранных предметов.");
    }
  } else {
    reasons.push(...diagnosticMessages);
    if (reasons.length === 0) reasons.push("Вариант не проходит обязательные геометрические ограничения.");
  }

  return {
    candidateId: candidate.id,
    valid,
    tightObjectCount,
    recommendationCount,
    rotatedObjectCount,
    totalMovementMm,
    reasons,
    stableKey,
  };
}

export function comparePlanningCandidateEvaluations(
  first: PlanningCandidateEvaluation,
  second: PlanningCandidateEvaluation,
): number {
  return first.tightObjectCount - second.tightObjectCount ||
    first.recommendationCount - second.recommendationCount ||
    first.rotatedObjectCount - second.rotatedObjectCount ||
    first.totalMovementMm - second.totalMovementMm ||
    first.stableKey.localeCompare(second.stableKey);
}

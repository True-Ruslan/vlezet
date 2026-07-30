import {
  planningConstraintsFromResolvedIntentDraft,
  resolvePlanningObjectReference,
  type PlanningIntentClause,
  type PlanningIntentInterpretation,
  type PlanningObjectReferenceResolution,
  type PlanningObjectReferenceTarget,
  type ResolvedPlanningIntentClause,
  type ResolvedPlanningIntentDraft,
} from "@vlezet/planning";
import { planningPairKey } from "./planning-pair-key";

export type PlanningIntentReviewReference = Readonly<{
  key: string;
  objectRef: string;
  resolution: PlanningObjectReferenceResolution;
  selectedObjectId: string | null;
}>;

export type PlanningIntentReviewClause = Readonly<{
  id: string;
  clause: PlanningIntentClause;
  references: readonly PlanningIntentReviewReference[];
}>;

export type PlanningIntentReviewUnsupportedFragment = Readonly<{
  text: string;
  acknowledged: boolean;
}>;

export type PlanningIntentReviewDraft = Readonly<{
  clauses: readonly PlanningIntentReviewClause[];
  unsupportedFragments: readonly PlanningIntentReviewUnsupportedFragment[];
  warnings: readonly string[];
}>;

export type PlanningIntentControlState = Readonly<{
  selectedObjectIds: readonly string[];
  lockedObjectIds: readonly string[];
  boundaryPreferences: Readonly<Record<string, "wall" | "corner">>;
  pairPreferences: Readonly<Record<string, "near" | "far">>;
  pairMinimumGapInputs: Readonly<Record<string, string>>;
}>;

function clauseObjectReferences(clause: PlanningIntentClause): readonly string[] {
  switch (clause.kind) {
    case "lock-object":
    case "prefer-room-boundary":
      return [clause.objectRef];
    case "pair-distance":
    case "pair-min-gap":
      return clause.objectRefs;
  }
}

function reviewReference(
  clauseId: string,
  slot: number,
  objectRef: string,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentReviewReference {
  const resolution = resolvePlanningObjectReference(objectRef, roomObjects);
  return {
    key: `${clauseId}:${slot}`,
    objectRef,
    resolution,
    selectedObjectId: resolution.status === "resolved" ? resolution.objectId : null,
  };
}

export function buildPlanningIntentReviewDraft(
  interpretation: PlanningIntentInterpretation,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentReviewDraft {
  return {
    clauses: interpretation.clauses.map((clause, index) => {
      const id = `clause-${index}`;
      return {
        id,
        clause,
        references: clauseObjectReferences(clause).map((objectRef, slot) =>
          reviewReference(id, slot, objectRef, roomObjects)),
      };
    }),
    unsupportedFragments: interpretation.unsupportedFragments.map((text) => ({ text, acknowledged: false })),
    warnings: [...interpretation.warnings],
  };
}

export function planningControlStateFromIntentReview(
  _draft: PlanningIntentReviewDraft,
  _roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentControlState {
  throw new Error("Not implemented");
}

export function resolvePlanningIntentReviewReference(
  _draft: PlanningIntentReviewDraft,
  _referenceKey: string,
  _objectId: string,
  _roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentReviewDraft {
  throw new Error("Not implemented");
}

export function toggleUnsupportedIntentAcknowledgement(
  _draft: PlanningIntentReviewDraft,
  _index: number,
): PlanningIntentReviewDraft {
  throw new Error("Not implemented");
}

export function removePlanningIntentReviewClause(
  _draft: PlanningIntentReviewDraft,
  _clauseId: string,
): PlanningIntentReviewDraft {
  throw new Error("Not implemented");
}

void planningConstraintsFromResolvedIntentDraft;
void planningPairKey;
void (null as unknown as ResolvedPlanningIntentClause);
void (null as unknown as ResolvedPlanningIntentDraft);

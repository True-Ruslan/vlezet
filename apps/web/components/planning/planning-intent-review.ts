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

export type PlanningIntentReviewDraft = Readonly<{
  clauses: readonly PlanningIntentReviewClause[];
  unsupportedFragments: readonly Readonly<{ text: string; acknowledged: boolean }>[];
  warnings: readonly string[];
}>;

export type PlanningIntentControlState = Readonly<{
  selectedObjectIds: readonly string[];
  lockedObjectIds: readonly string[];
  boundaryPreferences: Readonly<Record<string, "wall" | "corner">>;
  pairPreferences: Readonly<Record<string, "near" | "far">>;
  pairMinimumGapInputs: Readonly<Record<string, string>>;
}>;

function clauseReferences(clause: PlanningIntentClause): readonly string[] {
  return clause.kind === "pair-distance" || clause.kind === "pair-min-gap"
    ? clause.objectRefs
    : [clause.objectRef];
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
        references: clauseReferences(clause).map((objectRef, slot) => {
          const resolution = resolvePlanningObjectReference(objectRef, roomObjects);
          return {
            key: `${id}:${slot}`,
            objectRef,
            resolution,
            selectedObjectId: resolution.status === "resolved" ? resolution.objectId : null,
          };
        }),
      };
    }),
    unsupportedFragments: interpretation.unsupportedFragments.map((text) => ({ text, acknowledged: false })),
    warnings: [...interpretation.warnings],
  };
}

function allowedSelection(reference: PlanningIntentReviewReference, objectId: string): boolean {
  if (reference.resolution.status === "resolved") return reference.resolution.objectId === objectId;
  if (reference.resolution.status === "ambiguous") {
    return reference.resolution.candidateObjectIds.includes(objectId);
  }
  return true;
}

export function resolvePlanningIntentReviewReference(
  draft: PlanningIntentReviewDraft,
  referenceKey: string,
  objectId: string,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentReviewDraft {
  if (!roomObjects.some((object) => object.id === objectId)) {
    throw new Error("Selected planning intent object is outside the current room.");
  }
  let found = false;
  const clauses = draft.clauses.map((reviewClause) => ({
    ...reviewClause,
    references: reviewClause.references.map((reference) => {
      if (reference.key !== referenceKey) return reference;
      found = true;
      if (!allowedSelection(reference, objectId)) {
        throw new Error("Selected object is not a candidate for this planning intent reference.");
      }
      return { ...reference, selectedObjectId: objectId };
    }),
  }));
  if (!found) throw new Error("Planning intent reference no longer exists.");
  return { ...draft, clauses };
}

export function toggleUnsupportedIntentAcknowledgement(
  draft: PlanningIntentReviewDraft,
  index: number,
): PlanningIntentReviewDraft {
  if (!draft.unsupportedFragments[index]) {
    throw new Error("Unsupported planning intent fragment no longer exists.");
  }
  return {
    ...draft,
    unsupportedFragments: draft.unsupportedFragments.map((fragment, fragmentIndex) =>
      fragmentIndex === index ? { ...fragment, acknowledged: !fragment.acknowledged } : fragment),
  };
}

export function removePlanningIntentReviewClause(
  draft: PlanningIntentReviewDraft,
  clauseId: string,
): PlanningIntentReviewDraft {
  const clauses = draft.clauses.filter((clause) => clause.id !== clauseId);
  if (clauses.length === draft.clauses.length) throw new Error("Planning intent clause no longer exists.");
  return { ...draft, clauses };
}

function selectedId(reference: PlanningIntentReviewReference): string {
  if (!reference.selectedObjectId) {
    throw new Error("Resolve every planning intent object reference before transfer.");
  }
  return reference.selectedObjectId;
}

function resolvedClause(reviewClause: PlanningIntentReviewClause): ResolvedPlanningIntentClause {
  const clause = reviewClause.clause;
  const first = selectedId(reviewClause.references[0]!);
  switch (clause.kind) {
    case "lock-object":
      return { kind: clause.kind, objectId: first, sourceText: clause.sourceText };
    case "prefer-room-boundary":
      return { kind: clause.kind, objectId: first, target: clause.target, sourceText: clause.sourceText };
    case "pair-distance":
      return {
        kind: clause.kind,
        objectIds: [first, selectedId(reviewClause.references[1]!)],
        preference: clause.preference,
        sourceText: clause.sourceText,
      };
    case "pair-min-gap":
      return {
        kind: clause.kind,
        objectIds: [first, selectedId(reviewClause.references[1]!)],
        minimumMm: clause.minimumMm,
        sourceText: clause.sourceText,
      };
  }
}

export function planningControlStateFromIntentReview(
  draft: PlanningIntentReviewDraft,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): PlanningIntentControlState {
  const resolvedDraft: ResolvedPlanningIntentDraft = {
    clauses: draft.clauses.map(resolvedClause),
    unsupportedFragments: [],
    warnings: draft.warnings,
  };
  if (draft.unsupportedFragments.some((fragment) => !fragment.acknowledged)) {
    throw new Error("Acknowledge every unsupported planning intent fragment before transfer.");
  }

  const roomIds = new Set(roomObjects.map((object) => object.id));
  for (const clause of resolvedDraft.clauses) {
    const ids = clause.kind === "pair-distance" || clause.kind === "pair-min-gap"
      ? clause.objectIds
      : [clause.objectId];
    if (ids.some((id) => !roomIds.has(id))) throw new Error("Planning intent object is stale.");
  }

  const transfer = planningConstraintsFromResolvedIntentDraft(resolvedDraft);
  const lockedObjectIds: string[] = [];
  const boundaryPreferences: Record<string, "wall" | "corner"> = {};
  const pairPreferences: Record<string, "near" | "far"> = {};
  const pairMinimumGapInputs: Record<string, string> = {};

  for (const constraint of transfer.constraints) {
    if (constraint.kind === "lock-object") lockedObjectIds.push(constraint.objectId);
    if (constraint.kind === "prefer-room-boundary") {
      boundaryPreferences[constraint.objectId] = constraint.target;
    }
    if (constraint.kind === "pair-distance") {
      pairPreferences[planningPairKey(constraint.objectIds[0], constraint.objectIds[1])] = constraint.preference;
    }
    if (constraint.kind === "pair-min-gap") {
      pairMinimumGapInputs[planningPairKey(constraint.objectIds[0], constraint.objectIds[1])] =
        Number(constraint.minimumMm.toFixed(6)).toString();
    }
  }

  return {
    selectedObjectIds: transfer.objectIds,
    lockedObjectIds: lockedObjectIds.sort((first, second) => first.localeCompare(second)),
    boundaryPreferences,
    pairPreferences,
    pairMinimumGapInputs,
  };
}

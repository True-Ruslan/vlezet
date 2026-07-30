import {
  MAX_PLANNING_CONSTRAINTS,
  validatePlanningConstraintSet,
  type PlanningConstraint,
} from "./constraints";
import { MAX_SELECTED_PLANNING_OBJECTS } from "./contracts";

export type PlanningIntentClause =
  | Readonly<{
      kind: "lock-object";
      objectRef: string;
      sourceText: string;
    }>
  | Readonly<{
      kind: "prefer-room-boundary";
      objectRef: string;
      target: "wall" | "corner";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-distance";
      objectRefs: readonly [string, string];
      preference: "near" | "far";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-min-gap";
      objectRefs: readonly [string, string];
      minimumMm: number;
      sourceText: string;
    }>;

export type PlanningIntentInterpretation = Readonly<{
  clauses: readonly PlanningIntentClause[];
  unsupportedFragments: readonly string[];
  warnings: readonly string[];
}>;

export type PlanningObjectReferenceTarget = Readonly<{
  id: string;
  name: string;
}>;

export type PlanningObjectReferenceResolution =
  | Readonly<{ status: "resolved"; objectId: string }>
  | Readonly<{ status: "ambiguous"; candidateObjectIds: readonly string[] }>
  | Readonly<{ status: "unresolved" }>;

export type ResolvedPlanningIntentClause =
  | Readonly<{
      kind: "lock-object";
      objectId: string;
      sourceText: string;
    }>
  | Readonly<{
      kind: "prefer-room-boundary";
      objectId: string;
      target: "wall" | "corner";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-distance";
      objectIds: readonly [string, string];
      preference: "near" | "far";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-min-gap";
      objectIds: readonly [string, string];
      minimumMm: number;
      sourceText: string;
    }>;

export type ResolvedPlanningIntentDraft = Readonly<{
  clauses: readonly ResolvedPlanningIntentClause[];
  unsupportedFragments: readonly string[];
  warnings: readonly string[];
}>;

export type PlanningIntentTransfer = Readonly<{
  objectIds: readonly string[];
  constraints: readonly PlanningConstraint[];
}>;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredText(value: unknown, field: string): string {
  if (typeof value !== "string" || value.trim().length === 0) {
    throw new Error(`Invalid planning intent ${field}.`);
  }
  return value.trim();
}

function stringList(value: unknown, field: string): readonly string[] {
  if (!Array.isArray(value)) throw new Error(`Invalid planning intent ${field}.`);
  return value.map((item) => requiredText(item, field));
}

function objectReferencePair(value: unknown): readonly [string, string] {
  if (!Array.isArray(value) || value.length !== 2) {
    throw new Error("Planning intent pair requires exactly two object references.");
  }
  const first = requiredText(value[0], "object reference");
  const second = requiredText(value[1], "object reference");
  if (normalizePlanningObjectReference(first) === normalizePlanningObjectReference(second)) {
    throw new Error("Planning intent pair requires two distinct object references.");
  }
  return [first, second];
}

export function normalizePlanningObjectReference(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function containsTokenSequence(source: readonly string[], query: readonly string[]): boolean {
  if (query.length === 0 || query.length > source.length) return false;
  for (let start = 0; start <= source.length - query.length; start += 1) {
    let matches = true;
    for (let offset = 0; offset < query.length; offset += 1) {
      if (source[start + offset] !== query[offset]) {
        matches = false;
        break;
      }
    }
    if (matches) return true;
  }
  return false;
}

function referenceCandidates(
  reference: string,
  targets: readonly PlanningObjectReferenceTarget[],
  exactOnly: boolean,
): readonly string[] {
  const referenceTokens = reference.split(" ");
  return targets
    .filter((target) => {
      const normalizedName = normalizePlanningObjectReference(target.name);
      if (exactOnly) return normalizedName === reference;
      return containsTokenSequence(normalizedName.split(" "), referenceTokens);
    })
    .map((target) => target.id)
    .sort((first, second) => first.localeCompare(second));
}

export function resolvePlanningObjectReference(
  objectRef: string,
  targets: readonly PlanningObjectReferenceTarget[],
): PlanningObjectReferenceResolution {
  const reference = normalizePlanningObjectReference(objectRef);
  if (!reference) return { status: "unresolved" };

  const exact = referenceCandidates(reference, targets, true);
  const candidates = exact.length > 0 ? exact : referenceCandidates(reference, targets, false);
  if (candidates.length === 1) return { status: "resolved", objectId: candidates[0]! };
  if (candidates.length > 1) return { status: "ambiguous", candidateObjectIds: candidates };
  return { status: "unresolved" };
}

export function normalizePlanningDistanceToMillimetres(value: number, unit: string): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new Error("Planning intent distance must be a finite non-negative number.");
  }
  const normalizedUnit = unit.normalize("NFKC").toLocaleLowerCase("ru-RU").trim();
  const factor = normalizedUnit === "mm" || normalizedUnit === "мм"
    ? 1
    : normalizedUnit === "cm" || normalizedUnit === "см"
      ? 10
      : normalizedUnit === "m" || normalizedUnit === "м"
        ? 1000
        : null;
  if (factor === null) throw new Error(`Unsupported planning intent distance unit: ${unit}`);
  const millimetres = value * factor;
  if (!Number.isFinite(millimetres)) {
    throw new Error("Planning intent distance exceeds the supported numeric range.");
  }
  return Number(millimetres.toFixed(6));
}

function normalizeClause(value: unknown): PlanningIntentClause {
  if (!isRecord(value)) throw new Error("Invalid planning intent clause.");
  const sourceText = requiredText(value.sourceText, "source text");
  switch (value.kind) {
    case "lock-object":
      return {
        kind: "lock-object",
        objectRef: requiredText(value.objectRef, "object reference"),
        sourceText,
      };
    case "prefer-room-boundary": {
      if (value.target !== "wall" && value.target !== "corner") {
        throw new Error("Invalid planning intent room-boundary target.");
      }
      return {
        kind: "prefer-room-boundary",
        objectRef: requiredText(value.objectRef, "object reference"),
        target: value.target,
        sourceText,
      };
    }
    case "pair-distance": {
      if (value.preference !== "near" && value.preference !== "far") {
        throw new Error("Invalid planning intent pair-distance preference.");
      }
      return {
        kind: "pair-distance",
        objectRefs: objectReferencePair(value.objectRefs),
        preference: value.preference,
        sourceText,
      };
    }
    case "pair-min-gap": {
      const objectRefs = objectReferencePair(value.objectRefs);
      let minimumMm: number;
      if (typeof value.minimumMm === "number") {
        minimumMm = normalizePlanningDistanceToMillimetres(value.minimumMm, "mm");
      } else {
        if (!isRecord(value.minimum) || typeof value.minimum.value !== "number") {
          throw new Error("Invalid planning intent minimum distance.");
        }
        minimumMm = normalizePlanningDistanceToMillimetres(
          value.minimum.value,
          requiredText(value.minimum.unit, "distance unit"),
        );
      }
      return { kind: "pair-min-gap", objectRefs, minimumMm, sourceText };
    }
    default:
      throw new Error("Unsupported planning intent clause.");
  }
}

export function normalizePlanningIntentInterpretation(value: unknown): PlanningIntentInterpretation {
  if (!isRecord(value) || !Array.isArray(value.clauses)) {
    throw new Error("Invalid planning intent interpretation.");
  }
  if (value.clauses.length > MAX_PLANNING_CONSTRAINTS) {
    throw new Error(`At most ${MAX_PLANNING_CONSTRAINTS} planning intent clauses are supported.`);
  }
  return {
    clauses: value.clauses.map(normalizeClause),
    unsupportedFragments: stringList(value.unsupportedFragments, "unsupported fragments"),
    warnings: stringList(value.warnings, "warnings"),
  };
}

function constraintFromResolvedClause(clause: ResolvedPlanningIntentClause): PlanningConstraint {
  switch (clause.kind) {
    case "lock-object":
      return { kind: "lock-object", objectId: clause.objectId };
    case "prefer-room-boundary":
      return { kind: "prefer-room-boundary", objectId: clause.objectId, target: clause.target };
    case "pair-distance":
      return { kind: "pair-distance", objectIds: clause.objectIds, preference: clause.preference };
    case "pair-min-gap":
      return { kind: "pair-min-gap", objectIds: clause.objectIds, minimumMm: clause.minimumMm };
  }
}

function referencedObjectIds(clause: ResolvedPlanningIntentClause): readonly string[] {
  if (clause.kind === "pair-distance" || clause.kind === "pair-min-gap") return clause.objectIds;
  return [clause.objectId];
}

export function planningConstraintsFromResolvedIntentDraft(
  draft: ResolvedPlanningIntentDraft,
): PlanningIntentTransfer {
  if (draft.unsupportedFragments.length > 0) {
    throw new Error("Unsupported planning intent fragments must be acknowledged before transfer.");
  }
  const objectIds = [...new Set(draft.clauses.flatMap(referencedObjectIds))]
    .sort((first, second) => first.localeCompare(second));
  if (objectIds.length < 1 || objectIds.length > MAX_SELECTED_PLANNING_OBJECTS) {
    throw new Error(`Select 1-${MAX_SELECTED_PLANNING_OBJECTS} objects for planning.`);
  }
  const constraints = validatePlanningConstraintSet(
    draft.clauses.map(constraintFromResolvedClause),
    new Set(objectIds),
  );
  return { objectIds, constraints };
}

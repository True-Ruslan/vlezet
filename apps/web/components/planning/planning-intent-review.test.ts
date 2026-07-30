import { describe, expect, it } from "vitest";
import type { PlanningIntentInterpretation } from "@vlezet/planning";
import { planningPairKey } from "./planning-pair-key";
import {
  buildPlanningIntentReviewDraft,
  planningControlStateFromIntentReview,
  removePlanningIntentReviewClause,
  resolvePlanningIntentReviewReference,
  toggleUnsupportedIntentAcknowledgement,
} from "./planning-intent-review";

const roomObjects = [
  { id: "sofa", name: "Диван" },
  { id: "chair", name: "Кресло" },
  { id: "work-table", name: "Рабочий стол" },
  { id: "dining-table", name: "Обеденный стол" },
] as const;

const interpretation: PlanningIntentInterpretation = {
  clauses: [
    { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
    {
      kind: "prefer-room-boundary",
      objectRef: "Кресло",
      target: "corner",
      sourceText: "Кресло ближе к углу",
    },
    {
      kind: "pair-min-gap",
      objectRefs: ["Кресло", "стол"],
      minimumMm: 800,
      sourceText: "Между креслом и столом минимум 800 мм",
    },
  ],
  unsupportedFragments: ["Стол ближе к окну"],
  warnings: ["Окно пока не поддерживается"],
};

describe("planning intent review draft", () => {
  it("resolves unique references and leaves ambiguous references explicit", () => {
    const draft = buildPlanningIntentReviewDraft(interpretation, roomObjects);
    expect(draft.clauses[0]?.references[0]).toMatchObject({ selectedObjectId: "sofa" });
    expect(draft.clauses[1]?.references[0]).toMatchObject({ selectedObjectId: "chair" });
    expect(draft.clauses[2]?.references[1]).toEqual({
      key: "clause-2:1",
      objectRef: "стол",
      resolution: { status: "ambiguous", candidateObjectIds: ["dining-table", "work-table"] },
      selectedObjectId: null,
    });
  });

  it("requires explicit ambiguity resolution and unsupported acknowledgement before transfer", () => {
    const draft = buildPlanningIntentReviewDraft(interpretation, roomObjects);
    expect(() => planningControlStateFromIntentReview(draft, roomObjects)).toThrow(/resolve/i);

    const resolved = resolvePlanningIntentReviewReference(draft, "clause-2:1", "work-table", roomObjects);
    expect(() => planningControlStateFromIntentReview(resolved, roomObjects)).toThrow(/acknowledge/i);

    const acknowledged = toggleUnsupportedIntentAcknowledgement(resolved, 0);
    expect(planningControlStateFromIntentReview(acknowledged, roomObjects)).toEqual({
      selectedObjectIds: ["chair", "sofa", "work-table"],
      lockedObjectIds: ["sofa"],
      boundaryPreferences: { chair: "corner" },
      pairPreferences: {},
      pairMinimumGapInputs: { [planningPairKey("chair", "work-table")]: "800" },
    });
  });

  it("does not accept an object outside an ambiguous candidate set", () => {
    const draft = buildPlanningIntentReviewDraft(interpretation, roomObjects);
    expect(() => resolvePlanningIntentReviewReference(
      draft,
      "clause-2:1",
      "sofa",
      roomObjects,
    )).toThrow(/candidate/i);
  });

  it("removes a clause without mutating the original draft", () => {
    const draft = buildPlanningIntentReviewDraft(interpretation, roomObjects);
    const next = removePlanningIntentReviewClause(draft, "clause-1");
    expect(next.clauses).toHaveLength(2);
    expect(draft.clauses).toHaveLength(3);
    expect(next.clauses.map((clause) => clause.id)).toEqual(["clause-0", "clause-2"]);
  });
});

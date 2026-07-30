import { describe, expect, it } from "vitest";
import {
  normalizePlanningDistanceToMillimetres,
  normalizePlanningIntentInterpretation,
  normalizePlanningObjectReference,
  planningConstraintsFromResolvedIntentDraft,
  resolvePlanningObjectReference,
  type ResolvedPlanningIntentDraft,
} from "./intent-draft";

const roomObjects = [
  { id: "sofa", name: "Диван" },
  { id: "chair", name: "Кресло" },
  { id: "work-table", name: "Рабочий стол" },
  { id: "dining-table", name: "Обеденный стол" },
] as const;

describe("planning intent reference normalization", () => {
  it("normalizes unicode, case, punctuation, whitespace and Russian ё", () => {
    expect(normalizePlanningObjectReference("  «ЖЁЛТЫЙ   Диван!»  ")).toBe("желтый диван");
  });

  it("resolves an exact normalized object name", () => {
    expect(resolvePlanningObjectReference("диван", roomObjects)).toEqual({
      status: "resolved",
      objectId: "sofa",
    });
  });

  it("resolves a unique full token sequence inside an object name", () => {
    expect(resolvePlanningObjectReference("рабочий стол", roomObjects)).toEqual({
      status: "resolved",
      objectId: "work-table",
    });
  });

  it("does not guess an ambiguous short object reference", () => {
    expect(resolvePlanningObjectReference("стол", roomObjects)).toEqual({
      status: "ambiguous",
      candidateObjectIds: ["dining-table", "work-table"],
    });
  });

  it("does not fuzzy-match a typo", () => {
    expect(resolvePlanningObjectReference("дивам", roomObjects)).toEqual({ status: "unresolved" });
  });
});

describe("planning intent distance normalization", () => {
  it.each([
    [800, "mm", 800],
    [800, "мм", 800],
    [80, "cm", 800],
    [80, "см", 800],
    [0.8, "m", 800],
    [0.8, "м", 800],
    [0, "мм", 0],
  ] as const)("normalizes %s %s to %s millimetres", (value, unit, expected) => {
    expect(normalizePlanningDistanceToMillimetres(value, unit)).toBe(expected);
  });

  it.each([
    [-1, "мм"],
    [Number.NaN, "мм"],
    [Number.POSITIVE_INFINITY, "мм"],
    [100, "inch"],
  ] as const)("rejects invalid distance %s %s", (value, unit) => {
    expect(() => normalizePlanningDistanceToMillimetres(value, unit)).toThrow();
  });
});

describe("planning intent interpretation normalization", () => {
  it("normalizes supported clauses and preserves unsupported fragments", () => {
    expect(normalizePlanningIntentInterpretation({
      clauses: [
        { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
        {
          kind: "prefer-room-boundary",
          objectRef: "Кресло",
          target: "corner",
          sourceText: "Кресло ближе к углу",
        },
        {
          kind: "pair-distance",
          objectRefs: ["Кресло", "Стол"],
          preference: "near",
          sourceText: "Кресло и стол ближе",
        },
        {
          kind: "pair-min-gap",
          objectRefs: ["Кресло", "Стол"],
          minimum: { value: 80, unit: "см" },
          sourceText: "Оставить 80 см",
        },
      ],
      unsupportedFragments: ["Стол ближе к окну"],
      warnings: ["Окно не поддерживается"],
    })).toEqual({
      clauses: [
        { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
        {
          kind: "prefer-room-boundary",
          objectRef: "Кресло",
          target: "corner",
          sourceText: "Кресло ближе к углу",
        },
        {
          kind: "pair-distance",
          objectRefs: ["Кресло", "Стол"],
          preference: "near",
          sourceText: "Кресло и стол ближе",
        },
        {
          kind: "pair-min-gap",
          objectRefs: ["Кресло", "Стол"],
          minimumMm: 800,
          sourceText: "Оставить 80 см",
        },
      ],
      unsupportedFragments: ["Стол ближе к окну"],
      warnings: ["Окно не поддерживается"],
    });
  });

  it.each([
    null,
    {},
    { clauses: [{ kind: "unsupported", sourceText: "x" }], unsupportedFragments: [], warnings: [] },
    { clauses: [{ kind: "lock-object", objectRef: "", sourceText: "x" }], unsupportedFragments: [], warnings: [] },
    {
      clauses: [{ kind: "pair-min-gap", objectRefs: ["a", "b"], minimum: { value: -1, unit: "мм" }, sourceText: "x" }],
      unsupportedFragments: [],
      warnings: [],
    },
  ])("rejects malformed interpreter payload %#", (payload) => {
    expect(() => normalizePlanningIntentInterpretation(payload)).toThrow();
  });
});

describe("resolved planning intent conversion", () => {
  it("converts a confirmed draft through existing planning validation", () => {
    const draft: ResolvedPlanningIntentDraft = {
      clauses: [
        { kind: "lock-object", objectId: "sofa", sourceText: "Диван не двигать" },
        { kind: "prefer-room-boundary", objectId: "chair", target: "corner", sourceText: "Кресло к углу" },
        {
          kind: "pair-min-gap",
          objectIds: ["chair", "work-table"],
          minimumMm: 800,
          sourceText: "Минимум 800 мм",
        },
      ],
      unsupportedFragments: [],
      warnings: [],
    };

    expect(planningConstraintsFromResolvedIntentDraft(draft)).toEqual({
      objectIds: ["chair", "sofa", "work-table"],
      constraints: [
        { kind: "prefer-room-boundary", objectId: "chair", target: "corner" },
        { kind: "pair-min-gap", objectIds: ["chair", "work-table"], minimumMm: 800 },
        { kind: "lock-object", objectId: "sofa" },
      ],
    });
  });

  it("fails closed when every referenced object is locked", () => {
    const draft: ResolvedPlanningIntentDraft = {
      clauses: [
        { kind: "lock-object", objectId: "sofa", sourceText: "Диван не двигать" },
        { kind: "lock-object", objectId: "chair", sourceText: "Кресло не двигать" },
      ],
      unsupportedFragments: [],
      warnings: [],
    };
    expect(() => planningConstraintsFromResolvedIntentDraft(draft)).toThrow(/movable/i);
  });

  it("rejects more than three referenced objects before planning", () => {
    const draft: ResolvedPlanningIntentDraft = {
      clauses: [
        { kind: "prefer-room-boundary", objectId: "a", target: "wall", sourceText: "a" },
        { kind: "prefer-room-boundary", objectId: "b", target: "wall", sourceText: "b" },
        { kind: "prefer-room-boundary", objectId: "c", target: "wall", sourceText: "c" },
        { kind: "prefer-room-boundary", objectId: "d", target: "wall", sourceText: "d" },
      ],
      unsupportedFragments: [],
      warnings: [],
    };
    expect(() => planningConstraintsFromResolvedIntentDraft(draft)).toThrow(/1-3/);
  });
});

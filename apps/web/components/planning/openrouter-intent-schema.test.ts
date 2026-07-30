import { describe, expect, it } from "vitest";
import {
  OPENROUTER_PLANNING_INTENT_JSON_SCHEMA,
  normalizeOpenRouterPlanningIntentPayload,
} from "./openrouter-intent-schema";

describe("OpenRouter planning intent schema", () => {
  it("contains only the accepted symbolic intent vocabulary", () => {
    const serialized = JSON.stringify(OPENROUTER_PLANNING_INTENT_JSON_SCHEMA);
    expect(serialized).toContain("lock-object");
    expect(serialized).toContain("prefer-room-boundary");
    expect(serialized).toContain("pair-distance");
    expect(serialized).toContain("pair-min-gap");
    expect(serialized).not.toMatch(/coordinate|position|rotation|placement|geometry/i);
  });

  it("normalizes exact-gap units and keeps unsupported fragments visible", () => {
    expect(normalizeOpenRouterPlanningIntentPayload({
      clauses: [
        { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
        {
          kind: "pair-min-gap",
          objectRefs: ["Кресло", "стол"],
          minimum: { value: 0.8, unit: "м" },
          sourceText: "Оставить 0,8 м",
        },
      ],
      unsupportedFragments: ["Стол ближе к окну"],
      warnings: [],
    })).toEqual({
      clauses: [
        { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
        {
          kind: "pair-min-gap",
          objectRefs: ["Кресло", "стол"],
          minimumMm: 800,
          sourceText: "Оставить 0,8 м",
        },
      ],
      unsupportedFragments: ["Стол ближе к окну"],
      warnings: [],
    });
  });

  it("surfaces a malformed clause instead of silently changing its meaning", () => {
    expect(normalizeOpenRouterPlanningIntentPayload({
      clauses: [
        { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
        { kind: "pair-min-gap", objectRefs: ["Кресло"], sourceText: "Неполная пара" },
      ],
      unsupportedFragments: [],
      warnings: [],
    })).toEqual({
      clauses: [{ kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" }],
      unsupportedFragments: ["Неполная пара"],
      warnings: ["Один фрагмент ответа модели не прошёл структурную проверку и не будет применён."],
    });
  });

  it("rejects a structurally invalid top-level payload", () => {
    expect(() => normalizeOpenRouterPlanningIntentPayload({ clauses: "invalid" })).toThrow(/структур/i);
  });
});

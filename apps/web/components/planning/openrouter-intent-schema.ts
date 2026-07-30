import {
  normalizePlanningIntentInterpretation,
  type PlanningIntentInterpretation,
} from "@vlezet/planning";

export const OPENROUTER_PLANNING_INTENT_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["clauses", "unsupportedFragments", "warnings"],
  properties: {
    clauses: {
      type: "array",
      maxItems: 9,
      items: {
        oneOf: [
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "objectRef", "sourceText"],
            properties: {
              kind: { const: "lock-object" },
              objectRef: { type: "string", minLength: 1 },
              sourceText: { type: "string", minLength: 1 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "objectRef", "target", "sourceText"],
            properties: {
              kind: { const: "prefer-room-boundary" },
              objectRef: { type: "string", minLength: 1 },
              target: { enum: ["wall", "corner"] },
              sourceText: { type: "string", minLength: 1 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "objectRefs", "preference", "sourceText"],
            properties: {
              kind: { const: "pair-distance" },
              objectRefs: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "string", minLength: 1 },
              },
              preference: { enum: ["near", "far"] },
              sourceText: { type: "string", minLength: 1 },
            },
          },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "objectRefs", "minimum", "sourceText"],
            properties: {
              kind: { const: "pair-min-gap" },
              objectRefs: {
                type: "array",
                minItems: 2,
                maxItems: 2,
                items: { type: "string", minLength: 1 },
              },
              minimum: {
                type: "object",
                additionalProperties: false,
                required: ["value", "unit"],
                properties: {
                  value: { type: "number", minimum: 0 },
                  unit: { enum: ["mm", "мм", "cm", "см", "m", "м"] },
                },
              },
              sourceText: { type: "string", minLength: 1 },
            },
          },
        ],
      },
    },
    unsupportedFragments: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
    warnings: {
      type: "array",
      items: { type: "string", minLength: 1 },
    },
  },
} as const;

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function visibleMalformedFragment(value: unknown): string {
  if (isRecord(value) && typeof value.sourceText === "string" && value.sourceText.trim()) {
    return value.sourceText.trim();
  }
  try {
    const serialized = JSON.stringify(value);
    if (serialized && serialized !== "{}") return serialized.slice(0, 300);
  } catch {
    // Fall through to the generic visible marker.
  }
  return "Нераспознанный фрагмент ответа модели";
}

export function normalizeOpenRouterPlanningIntentPayload(value: unknown): PlanningIntentInterpretation {
  if (!isRecord(value) || !Array.isArray(value.clauses) ||
    !Array.isArray(value.unsupportedFragments) || !Array.isArray(value.warnings)) {
    throw new Error("Ответ OpenRouter не прошёл структурную проверку planning intent.");
  }

  const clauses: PlanningIntentInterpretation["clauses"][number][] = [];
  const malformedFragments: string[] = [];
  for (const candidate of value.clauses) {
    try {
      const normalized = normalizePlanningIntentInterpretation({
        clauses: [candidate],
        unsupportedFragments: [],
        warnings: [],
      });
      clauses.push(normalized.clauses[0]!);
    } catch {
      malformedFragments.push(visibleMalformedFragment(candidate));
    }
  }

  const unsupportedFragments = [
    ...value.unsupportedFragments,
    ...malformedFragments,
  ];
  const warnings = [
    ...value.warnings,
    ...(malformedFragments.length > 0
      ? ["Один фрагмент ответа модели не прошёл структурную проверку и не будет применён."]
      : []),
  ];

  return normalizePlanningIntentInterpretation({ clauses, unsupportedFragments, warnings });
}

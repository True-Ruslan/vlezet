import { validateRecognitionProviderResult, type RecognitionProviderResult } from "@vlezet/recognition";

const pointSchema = {
  type: "object",
  additionalProperties: false,
  properties: {
    x: { type: "integer", minimum: 0, maximum: 10000 },
    y: { type: "integer", minimum: 0, maximum: 10000 },
  },
  required: ["x", "y"],
} as const;

export const OPENROUTER_RECOGNITION_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    walls: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          start: pointSchema,
          end: pointSchema,
          estimatedThicknessPx: { type: ["number", "null"], minimum: 0 },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          score: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["id", "start", "end", "estimatedThicknessPx", "confidence", "score"],
      },
    },
    openings: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          kind: { type: "string", enum: ["door", "window", "unknown-opening"] },
          hostWallCandidateId: { type: ["string", "null"] },
          center: pointSchema,
          widthPx: { type: ["number", "null"], minimum: 0 },
          orientationDeg: { type: ["number", "null"] },
          confidence: { type: "string", enum: ["high", "medium", "low"] },
          score: { type: "number", minimum: 0, maximum: 1 },
        },
        required: ["id", "kind", "hostWallCandidateId", "center", "widthPx", "orientationDeg", "confidence", "score"],
      },
    },
    roomLabels: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          id: { type: "string", minLength: 1 },
          text: { type: "string", minLength: 1 },
          anchor: pointSchema,
          confidence: { type: "string", enum: ["high", "medium", "low"] },
        },
        required: ["id", "text", "anchor", "confidence"],
      },
    },
  },
  required: ["walls", "openings", "roomLabels"],
} as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} содержит некорректные данные.`);
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} должен быть списком.`);
  return value;
}

function normalizePoint(value: unknown): { x: number; y: number } {
  const input = record(value, "Координата AI");
  if (typeof input.x !== "number" || typeof input.y !== "number" || !Number.isInteger(input.x) || !Number.isInteger(input.y)) {
    throw new Error("AI вернул некорректные целочисленные координаты.");
  }
  if (input.x < 0 || input.x > 10000 || input.y < 0 || input.y > 10000) throw new Error("AI вернул координаты вне допустимого диапазона.");
  return { x: input.x / 10000, y: input.y / 10000 };
}

export function normalizeOpenRouterRecognitionPayload(value: unknown): RecognitionProviderResult {
  const input = record(value, "Ответ AI");
  return validateRecognitionProviderResult({
    walls: array(input.walls, "Стены AI").map((entry) => {
      const wall = record(entry, "Стена AI");
      return { ...wall, start: normalizePoint(wall.start), end: normalizePoint(wall.end) };
    }),
    openings: array(input.openings, "Проёмы AI").map((entry) => {
      const opening = record(entry, "Проём AI");
      return { ...opening, center: normalizePoint(opening.center) };
    }),
    roomLabels: array(input.roomLabels, "Названия комнат AI").map((entry) => {
      const label = record(entry, "Название комнаты AI");
      return { ...label, anchor: normalizePoint(label.anchor) };
    }),
  });
}

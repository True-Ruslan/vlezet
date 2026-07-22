import {
  validateNormalizedPoint,
  type RecognitionOpeningCandidate,
  type RecognitionRoomLabelCandidate,
  type RecognitionWallCandidate,
} from "./model";

export type RecognitionProviderInput = Readonly<{
  imageDataUrl: string;
  imageWidthPx: number;
  imageHeightPx: number;
  localSummary: Readonly<{
    walls: readonly RecognitionWallCandidate[];
    openings: readonly RecognitionOpeningCandidate[];
  }> | null;
}>;

export type RecognitionProviderResult = Readonly<{
  walls: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
  roomLabels: readonly RecognitionRoomLabelCandidate[];
}>;

export interface RecognitionProvider {
  readonly id: string;
  readonly displayName: string;
  recognize(input: RecognitionProviderInput, signal: AbortSignal): Promise<RecognitionProviderResult>;
}

function requireRecord(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error(`${label} содержит некорректные данные.`);
  return value as Record<string, unknown>;
}

function requireArray(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new Error(`${label} должен быть списком.`);
  return value;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) throw new Error(`${label} должен быть непустой строкой.`);
  return value.trim();
}

function confidence(value: unknown): "high" | "medium" | "low" {
  if (value === "high" || value === "medium" || value === "low") return value;
  throw new Error("Confidence должен быть high, medium или low.");
}

function optionalFinite(value: unknown, label: string): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} должен быть конечным числом или null.`);
  return value;
}

export function validateRecognitionProviderResult(value: unknown): RecognitionProviderResult {
  const input = requireRecord(value, "Ответ провайдера");
  const walls = requireArray(input.walls, "Стены провайдера").map((entry, index): RecognitionWallCandidate => {
    const wall = requireRecord(entry, `Стена ${index + 1}`);
    return {
      id: requireString(wall.id, `Стена ${index + 1}.id`),
      start: validateNormalizedPoint(wall.start, `Стена ${index + 1}.start`),
      end: validateNormalizedPoint(wall.end, `Стена ${index + 1}.end`),
      estimatedThicknessPx: optionalFinite(wall.estimatedThicknessPx, `Стена ${index + 1}.estimatedThicknessPx`),
      confidence: confidence(wall.confidence),
      evidence: {
        localScore: null,
        cloudScore: typeof wall.score === "number" && Number.isFinite(wall.score) ? Math.min(1, Math.max(0, wall.score)) : null,
        reasons: ["cloud-vision"],
      },
      origin: "cloud",
      conflict: null,
    };
  });
  const openings = requireArray(input.openings, "Проёмы провайдера").map((entry, index): RecognitionOpeningCandidate => {
    const opening = requireRecord(entry, `Проём ${index + 1}`);
    const kind = opening.kind;
    if (kind !== "door" && kind !== "window" && kind !== "unknown-opening") throw new Error(`Проём ${index + 1}.kind не поддерживается.`);
    return {
      id: requireString(opening.id, `Проём ${index + 1}.id`),
      kind,
      hostWallCandidateId: opening.hostWallCandidateId === null ? null : requireString(opening.hostWallCandidateId, `Проём ${index + 1}.hostWallCandidateId`),
      center: validateNormalizedPoint(opening.center, `Проём ${index + 1}.center`),
      widthPx: optionalFinite(opening.widthPx, `Проём ${index + 1}.widthPx`),
      orientationDeg: optionalFinite(opening.orientationDeg, `Проём ${index + 1}.orientationDeg`),
      confidence: confidence(opening.confidence),
      evidence: { localScore: null, cloudScore: typeof opening.score === "number" && Number.isFinite(opening.score) ? Math.min(1, Math.max(0, opening.score)) : null, reasons: ["cloud-vision"] },
      origin: "cloud",
      conflict: null,
    };
  });
  const roomLabels = requireArray(input.roomLabels, "Названия комнат провайдера").map((entry, index): RecognitionRoomLabelCandidate => {
    const label = requireRecord(entry, `Название комнаты ${index + 1}`);
    return {
      id: requireString(label.id, `Название комнаты ${index + 1}.id`),
      text: requireString(label.text, `Название комнаты ${index + 1}.text`),
      anchor: validateNormalizedPoint(label.anchor, `Название комнаты ${index + 1}.anchor`),
      confidence: confidence(label.confidence),
      origin: "cloud",
    };
  });
  return { walls, openings, roomLabels };
}

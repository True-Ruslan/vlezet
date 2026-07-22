export type NormalizedPoint = Readonly<{ x: number; y: number }>;
export type RecognitionConfidence = "high" | "medium" | "low";
export type RecognitionOrigin = "local" | "cloud" | "merged";
export type RecognitionDecision = "pending" | "accepted" | "rejected" | "edited";
export type RecognitionDraftStatus = "local-complete" | "cloud-complete" | "reconciled" | "applied";
export type RecognitionConflictKind =
  | "duplicate-existing"
  | "geometry-conflict"
  | "classification-conflict"
  | "invalid-host"
  | "unsupported";

export type RecognitionEvidenceSummary = Readonly<{
  localScore: number | null;
  cloudScore: number | null;
  reasons: readonly string[];
}>;

export type RecognitionWallCandidate = Readonly<{
  id: string;
  start: NormalizedPoint;
  end: NormalizedPoint;
  estimatedThicknessPx: number | null;
  confidence: RecognitionConfidence;
  evidence: RecognitionEvidenceSummary;
  origin: RecognitionOrigin;
  conflict: RecognitionConflictKind | null;
}>;

export type RecognitionOpeningCandidate = Readonly<{
  id: string;
  kind: "door" | "window" | "unknown-opening";
  hostWallCandidateId: string | null;
  center: NormalizedPoint;
  widthPx: number | null;
  orientationDeg: number | null;
  confidence: RecognitionConfidence;
  evidence: RecognitionEvidenceSummary;
  origin: RecognitionOrigin;
  conflict: RecognitionConflictKind | null;
}>;

export type RecognitionRoomLabelCandidate = Readonly<{
  id: string;
  text: string;
  anchor: NormalizedPoint;
  confidence: RecognitionConfidence;
  origin: "cloud";
}>;

export type RecognitionDiagnostic = Readonly<{
  code: string;
  severity: "info" | "warning" | "error";
  message: string;
  candidateId: string | null;
}>;

export type RecognitionDecisionMap = Readonly<Record<string, RecognitionDecision>>;

export type RecognitionSourceSummary = Readonly<{
  local: boolean;
  cloud: boolean;
}>;

export type RecognitionDraft = Readonly<{
  id: string;
  projectId: string;
  referenceAssetId: string;
  referenceRevision: string;
  engineVersion: string;
  status: RecognitionDraftStatus;
  walls: readonly RecognitionWallCandidate[];
  openings: readonly RecognitionOpeningCandidate[];
  roomLabels: readonly RecognitionRoomLabelCandidate[];
  diagnostics: readonly RecognitionDiagnostic[];
  decisions: RecognitionDecisionMap;
  source: RecognitionSourceSummary;
  createdAt: string;
  updatedAt: string;
}>;

export type RecognitionCloudMetadata = Readonly<{
  providerId: string;
  modelId: string;
  completedAt: string;
}>;

export type RecognitionSessionRecord = Readonly<{
  id: string;
  projectId: string;
  referenceAssetId: string;
  referenceRevision: string;
  engineVersion: string;
  draft: RecognitionDraft;
  cloudMetadata: RecognitionCloudMetadata | null;
  createdAt: string;
  updatedAt: string;
}>;

export class RecognitionValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecognitionValidationError";
  }
}

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecognitionValidationError(`${label} содержит некорректные данные.`);
  }
  return value as Record<string, unknown>;
}

function array(value: unknown, label: string): unknown[] {
  if (!Array.isArray(value)) throw new RecognitionValidationError(`${label} должен быть списком.`);
  return value;
}

function text(value: unknown, label: string): string {
  if (typeof value !== "string" || !value.trim()) {
    throw new RecognitionValidationError(`${label} должен быть непустой строкой.`);
  }
  return value.trim();
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new RecognitionValidationError(`${label} должен быть конечным числом.`);
  }
  return value;
}

function bounded(value: unknown, min: number, max: number, label: string): number {
  const number = finite(value, label);
  if (number < min || number > max) {
    throw new RecognitionValidationError(`${label} должен быть от ${min} до ${max}.`);
  }
  return number;
}

function nullableBounded(value: unknown, min: number, max: number, label: string): number | null {
  return value === null ? null : bounded(value, min, max, label);
}

function nullableFinite(value: unknown, label: string): number | null {
  return value === null ? null : finite(value, label);
}

function timestamp(value: unknown, label: string): string {
  const result = text(value, label);
  if (Number.isNaN(Date.parse(result))) throw new RecognitionValidationError(`${label} содержит некорректную дату.`);
  return result;
}

function oneOf<T extends string>(value: unknown, allowed: readonly T[], label: string): T {
  if (typeof value !== "string" || !allowed.includes(value as T)) {
    throw new RecognitionValidationError(`${label} содержит неподдерживаемое значение.`);
  }
  return value as T;
}

function nullableText(value: unknown, label: string): string | null {
  return value === null ? null : text(value, label);
}

export function validateNormalizedPoint(value: unknown, label = "Координата"): NormalizedPoint {
  const input = record(value, label);
  return {
    x: bounded(input.x, 0, 1, `${label}.x`),
    y: bounded(input.y, 0, 1, `${label}.y`),
  };
}

function validateEvidence(value: unknown, label: string): RecognitionEvidenceSummary {
  const input = record(value, label);
  return {
    localScore: nullableBounded(input.localScore, 0, 1, `${label}.localScore`),
    cloudScore: nullableBounded(input.cloudScore, 0, 1, `${label}.cloudScore`),
    reasons: array(input.reasons, `${label}.reasons`).map((reason, index) => text(reason, `${label}.reasons[${index}]`)),
  };
}

function validateConflict(value: unknown, label: string): RecognitionConflictKind | null {
  if (value === null) return null;
  return oneOf(value, ["duplicate-existing", "geometry-conflict", "classification-conflict", "invalid-host", "unsupported"] as const, label);
}

function validateWall(value: unknown, index: number): RecognitionWallCandidate {
  const input = record(value, `Стена ${index + 1}`);
  return {
    id: text(input.id, `Стена ${index + 1}.id`),
    start: validateNormalizedPoint(input.start, `Стена ${index + 1}.start`),
    end: validateNormalizedPoint(input.end, `Стена ${index + 1}.end`),
    estimatedThicknessPx: nullableBounded(input.estimatedThicknessPx, 0, Number.MAX_SAFE_INTEGER, `Стена ${index + 1}.estimatedThicknessPx`),
    confidence: oneOf(input.confidence, ["high", "medium", "low"] as const, `Стена ${index + 1}.confidence`),
    evidence: validateEvidence(input.evidence, `Стена ${index + 1}.evidence`),
    origin: oneOf(input.origin, ["local", "cloud", "merged"] as const, `Стена ${index + 1}.origin`),
    conflict: validateConflict(input.conflict, `Стена ${index + 1}.conflict`),
  };
}

function validateOpening(value: unknown, index: number): RecognitionOpeningCandidate {
  const input = record(value, `Проём ${index + 1}`);
  return {
    id: text(input.id, `Проём ${index + 1}.id`),
    kind: oneOf(input.kind, ["door", "window", "unknown-opening"] as const, `Проём ${index + 1}.kind`),
    hostWallCandidateId: nullableText(input.hostWallCandidateId, `Проём ${index + 1}.hostWallCandidateId`),
    center: validateNormalizedPoint(input.center, `Проём ${index + 1}.center`),
    widthPx: nullableBounded(input.widthPx, 0, Number.MAX_SAFE_INTEGER, `Проём ${index + 1}.widthPx`),
    orientationDeg: nullableFinite(input.orientationDeg, `Проём ${index + 1}.orientationDeg`),
    confidence: oneOf(input.confidence, ["high", "medium", "low"] as const, `Проём ${index + 1}.confidence`),
    evidence: validateEvidence(input.evidence, `Проём ${index + 1}.evidence`),
    origin: oneOf(input.origin, ["local", "cloud", "merged"] as const, `Проём ${index + 1}.origin`),
    conflict: validateConflict(input.conflict, `Проём ${index + 1}.conflict`),
  };
}

function validateRoomLabel(value: unknown, index: number): RecognitionRoomLabelCandidate {
  const input = record(value, `Название комнаты ${index + 1}`);
  if (input.origin !== "cloud") throw new RecognitionValidationError(`Название комнаты ${index + 1}.origin должно быть cloud.`);
  return {
    id: text(input.id, `Название комнаты ${index + 1}.id`),
    text: text(input.text, `Название комнаты ${index + 1}.text`),
    anchor: validateNormalizedPoint(input.anchor, `Название комнаты ${index + 1}.anchor`),
    confidence: oneOf(input.confidence, ["high", "medium", "low"] as const, `Название комнаты ${index + 1}.confidence`),
    origin: "cloud",
  };
}

function validateDiagnostic(value: unknown, index: number): RecognitionDiagnostic {
  const input = record(value, `Диагностика ${index + 1}`);
  return {
    code: text(input.code, `Диагностика ${index + 1}.code`),
    severity: oneOf(input.severity, ["info", "warning", "error"] as const, `Диагностика ${index + 1}.severity`),
    message: text(input.message, `Диагностика ${index + 1}.message`),
    candidateId: nullableText(input.candidateId, `Диагностика ${index + 1}.candidateId`),
  };
}

export function validateRecognitionDraft(value: unknown): RecognitionDraft {
  const input = record(value, "Черновик распознавания");
  const walls = array(input.walls, "Стены").map(validateWall);
  const openings = array(input.openings, "Проёмы").map(validateOpening);
  const roomLabels = array(input.roomLabels, "Названия комнат").map(validateRoomLabel);
  const candidateIds = new Set([...walls, ...openings, ...roomLabels].map((candidate) => candidate.id));
  if (candidateIds.size !== walls.length + openings.length + roomLabels.length) {
    throw new RecognitionValidationError("Идентификаторы кандидатов должны быть уникальными.");
  }
  const decisionsInput = record(input.decisions, "Решения по кандидатам");
  const decisions: Record<string, RecognitionDecision> = {};
  for (const [candidateId, decision] of Object.entries(decisionsInput)) {
    if (!candidateIds.has(candidateId)) throw new RecognitionValidationError(`Решение ссылается на неизвестный кандидат ${candidateId}.`);
    decisions[candidateId] = oneOf(decision, ["pending", "accepted", "rejected", "edited"] as const, `Решение ${candidateId}`);
  }
  const source = record(input.source, "Источник распознавания");
  if (typeof source.local !== "boolean" || typeof source.cloud !== "boolean") {
    throw new RecognitionValidationError("Источник распознавания должен содержать логические флаги local/cloud.");
  }
  return {
    id: text(input.id, "Идентификатор черновика"),
    projectId: text(input.projectId, "Идентификатор проекта"),
    referenceAssetId: text(input.referenceAssetId, "Идентификатор подложки"),
    referenceRevision: text(input.referenceRevision, "Ревизия подложки"),
    engineVersion: text(input.engineVersion, "Версия движка"),
    status: oneOf(input.status, ["local-complete", "cloud-complete", "reconciled", "applied"] as const, "Статус черновика"),
    walls,
    openings,
    roomLabels,
    diagnostics: array(input.diagnostics, "Диагностика").map(validateDiagnostic),
    decisions,
    source: { local: source.local, cloud: source.cloud },
    createdAt: timestamp(input.createdAt, "Дата создания черновика"),
    updatedAt: timestamp(input.updatedAt, "Дата изменения черновика"),
  };
}

function validateCloudMetadata(value: unknown): RecognitionCloudMetadata | null {
  if (value === null) return null;
  const input = record(value, "Метаданные облачного распознавания");
  return {
    providerId: text(input.providerId, "Провайдер"),
    modelId: text(input.modelId, "Модель"),
    completedAt: timestamp(input.completedAt, "Дата облачного распознавания"),
  };
}

export function validateRecognitionSession(value: unknown): RecognitionSessionRecord {
  const input = record(value, "Сессия распознавания");
  const session = {
    id: text(input.id, "Идентификатор сессии"),
    projectId: text(input.projectId, "Идентификатор проекта"),
    referenceAssetId: text(input.referenceAssetId, "Идентификатор подложки"),
    referenceRevision: text(input.referenceRevision, "Ревизия подложки"),
    engineVersion: text(input.engineVersion, "Версия движка"),
    draft: validateRecognitionDraft(input.draft),
    cloudMetadata: validateCloudMetadata(input.cloudMetadata),
    createdAt: timestamp(input.createdAt, "Дата создания сессии"),
    updatedAt: timestamp(input.updatedAt, "Дата изменения сессии"),
  } satisfies RecognitionSessionRecord;
  if (
    session.projectId !== session.draft.projectId ||
    session.referenceAssetId !== session.draft.referenceAssetId ||
    session.referenceRevision !== session.draft.referenceRevision ||
    session.engineVersion !== session.draft.engineVersion
  ) {
    throw new RecognitionValidationError("Сессия распознавания не согласована с черновиком.");
  }
  return session;
}

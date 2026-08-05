import {
  AI_OPENING_REASON_CODES,
  AI_PROPOSAL_MAX_DIAGNOSTICS,
  AI_PROPOSAL_MAX_OPENINGS,
  AI_PROPOSAL_MAX_WALL_REVIEWS,
  AI_PROPOSAL_SCHEMA_VERSION,
  AI_WALL_REVIEW_REASON_CODES,
  type AiOpeningAdditionProposal,
  type AiOpeningReasonCode,
  type AiProposalBatch,
  type AiProviderDiagnostic,
  type AiLocalWallReviewProposal,
  type AiRecognitionProposal,
  type AiWallReviewReasonCode,
  type NormalizedBox,
  type NormalizedPoint,
} from "@vlezet/recognition";

const SCHEMA_COORDINATE_MAX = 10_000;
const MAX_PROPOSALS = AI_PROPOSAL_MAX_OPENINGS + AI_PROPOSAL_MAX_WALL_REVIEWS;
const MAX_HOST_HINTS = 8;
const MAX_REASON_CODES = 8;
const MAX_ID_LENGTH = 160;
const MAX_MESSAGE_LENGTH = 1_000;
const FINGERPRINT_PATTERN = "^recognition-local-draft-v1:[a-f0-9]{64}$";

const schemaPoint = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y"],
  properties: {
    x: { type: "integer", minimum: 0, maximum: SCHEMA_COORDINATE_MAX },
    y: { type: "integer", minimum: 0, maximum: SCHEMA_COORDINATE_MAX },
  },
} as const;

const schemaRegion = {
  type: "object",
  additionalProperties: false,
  required: ["x", "y", "width", "height"],
  properties: {
    x: { type: "integer", minimum: 0, maximum: SCHEMA_COORDINATE_MAX },
    y: { type: "integer", minimum: 0, maximum: SCHEMA_COORDINATE_MAX },
    width: { type: "integer", minimum: 1, maximum: SCHEMA_COORDINATE_MAX },
    height: { type: "integer", minimum: 1, maximum: SCHEMA_COORDINATE_MAX },
  },
} as const;

const openingProposalSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "kind",
    "openingKind",
    "center",
    "widthNormalized",
    "orientationDeg",
    "hostWallHintIds",
    "sourceRegion",
    "modelConfidence",
    "reasonCodes",
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
    kind: { const: "opening-addition" },
    openingKind: { type: "string", enum: ["door", "window"] },
    center: schemaPoint,
    widthNormalized: { type: "integer", minimum: 1, maximum: SCHEMA_COORDINATE_MAX },
    orientationDeg: { type: "number", minimum: 0, exclusiveMaximum: 180 },
    hostWallHintIds: {
      type: "array",
      maxItems: MAX_HOST_HINTS,
      uniqueItems: true,
      items: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
    },
    sourceRegion: schemaRegion,
    modelConfidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCodes: {
      type: "array",
      maxItems: MAX_REASON_CODES,
      uniqueItems: true,
      items: { type: "string", enum: AI_OPENING_REASON_CODES },
    },
  },
} as const;

const wallReviewProposalSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "id",
    "kind",
    "targetWallCandidateId",
    "recommendation",
    "sourceRegion",
    "modelConfidence",
    "reasonCodes",
  ],
  properties: {
    id: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
    kind: { const: "local-wall-review" },
    targetWallCandidateId: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
    recommendation: { const: "likely-clutter" },
    sourceRegion: schemaRegion,
    modelConfidence: { type: "number", minimum: 0, maximum: 1 },
    reasonCodes: {
      type: "array",
      maxItems: MAX_REASON_CODES,
      uniqueItems: true,
      items: { type: "string", enum: AI_WALL_REVIEW_REASON_CODES },
    },
  },
} as const;

export const OPENROUTER_PROPOSAL_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "schemaVersion",
    "requestId",
    "referenceRevision",
    "localDraftFingerprint",
    "proposals",
    "diagnostics",
  ],
  properties: {
    schemaVersion: { const: AI_PROPOSAL_SCHEMA_VERSION },
    requestId: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
    referenceRevision: { type: "string", minLength: 1, maxLength: 240 },
    localDraftFingerprint: { type: "string", pattern: FINGERPRINT_PATTERN },
    proposals: {
      type: "array",
      maxItems: MAX_PROPOSALS,
      items: { oneOf: [openingProposalSchema, wallReviewProposalSchema] },
    },
    diagnostics: {
      type: "array",
      maxItems: AI_PROPOSAL_MAX_DIAGNOSTICS,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["code", "severity", "message"],
        properties: {
          code: { type: "string", minLength: 1, maxLength: MAX_ID_LENGTH },
          severity: { type: "string", enum: ["info", "warning", "error"] },
          message: { type: "string", minLength: 1, maxLength: MAX_MESSAGE_LENGTH },
        },
      },
    },
  },
} as const;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} содержит некорректные данные.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(input: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const allowedSet = new Set(allowed);
  for (const key of Object.keys(input)) {
    if (!allowedSet.has(key)) throw new Error(`${label} содержит неподдерживаемое поле.`);
  }
  for (const key of allowed) {
    if (!Object.prototype.hasOwnProperty.call(input, key)) throw new Error(`${label} не содержит обязательное поле.`);
  }
}

function array(value: unknown, label: string, maximum: number): unknown[] {
  if (!Array.isArray(value) || value.length > maximum) {
    throw new Error(`${label} содержит некорректное количество элементов.`);
  }
  return value;
}

function text(value: unknown, label: string, maximum = MAX_MESSAGE_LENGTH): string {
  if (typeof value !== "string") throw new Error(`${label} должен быть строкой.`);
  const result = value.trim();
  if (!result || result.length > maximum) throw new Error(`${label} имеет недопустимую длину.`);
  return result;
}

function finite(value: unknown, label: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) throw new Error(`${label} должен быть конечным числом.`);
  return value;
}

function bounded(value: unknown, minimum: number, maximum: number, label: string): number {
  const result = finite(value, label);
  if (result < minimum || result > maximum) throw new Error(`${label} выходит за допустимый диапазон.`);
  return result;
}

function schemaInteger(value: unknown, label: string, minimum = 0): number {
  const result = bounded(value, minimum, SCHEMA_COORDINATE_MAX, label);
  if (!Number.isInteger(result)) throw new Error(`${label} должен быть целым числом.`);
  return result;
}

function normalizedCoordinate(value: unknown, label: string): number {
  return schemaInteger(value, label) / SCHEMA_COORDINATE_MAX;
}

function normalizedPoint(value: unknown, label: string): NormalizedPoint {
  const input = record(value, label);
  exactKeys(input, ["x", "y"], label);
  return {
    x: normalizedCoordinate(input.x, `${label}.x`),
    y: normalizedCoordinate(input.y, `${label}.y`),
  };
}

function normalizedRegion(value: unknown, label: string): NormalizedBox {
  const input = record(value, label);
  exactKeys(input, ["x", "y", "width", "height"], label);
  const x = schemaInteger(input.x, `${label}.x`);
  const y = schemaInteger(input.y, `${label}.y`);
  const width = schemaInteger(input.width, `${label}.width`, 1);
  const height = schemaInteger(input.height, `${label}.height`, 1);
  if (x + width > SCHEMA_COORDINATE_MAX || y + height > SCHEMA_COORDINATE_MAX) {
    throw new Error(`${label} выходит за границы нормализованного изображения.`);
  }
  return {
    x: x / SCHEMA_COORDINATE_MAX,
    y: y / SCHEMA_COORDINATE_MAX,
    width: width / SCHEMA_COORDINATE_MAX,
    height: height / SCHEMA_COORDINATE_MAX,
  };
}

function uniqueTextList<T extends string>(
  value: unknown,
  label: string,
  maximum: number,
  allowed?: readonly T[],
): T[] {
  const result = array(value, label, maximum).map((entry, index) => text(
    entry,
    `${label}[${index}]`,
    MAX_ID_LENGTH,
  ));
  if (new Set(result).size !== result.length) throw new Error(`${label} содержит повторяющиеся значения.`);
  if (allowed && result.some((entry) => !allowed.includes(entry as T))) {
    throw new Error(`${label} содержит неподдерживаемое значение.`);
  }
  return result as T[];
}

function openingProposal(value: unknown, index: number): AiOpeningAdditionProposal {
  const label = `Предложение проёма ${index + 1}`;
  const input = record(value, label);
  exactKeys(input, [
    "id",
    "kind",
    "openingKind",
    "center",
    "widthNormalized",
    "orientationDeg",
    "hostWallHintIds",
    "sourceRegion",
    "modelConfidence",
    "reasonCodes",
  ], label);
  if (input.kind !== "opening-addition") throw new Error(`${label}.kind не поддерживается.`);
  if (input.openingKind !== "door" && input.openingKind !== "window") {
    throw new Error(`${label}.openingKind не поддерживается.`);
  }
  const orientationDeg = bounded(input.orientationDeg, 0, 180, `${label}.orientationDeg`);
  if (orientationDeg >= 180) throw new Error(`${label}.orientationDeg должен быть меньше 180.`);
  return {
    id: text(input.id, `${label}.id`, MAX_ID_LENGTH),
    kind: "opening-addition",
    openingKind: input.openingKind,
    center: normalizedPoint(input.center, `${label}.center`),
    widthNormalized: schemaInteger(input.widthNormalized, `${label}.widthNormalized`, 1) / SCHEMA_COORDINATE_MAX,
    orientationDeg,
    hostWallHintIds: uniqueTextList(input.hostWallHintIds, `${label}.hostWallHintIds`, MAX_HOST_HINTS),
    sourceRegion: normalizedRegion(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList<AiOpeningReasonCode>(
      input.reasonCodes,
      `${label}.reasonCodes`,
      MAX_REASON_CODES,
      AI_OPENING_REASON_CODES,
    ),
  };
}

function wallReviewProposal(value: unknown, index: number): AiLocalWallReviewProposal {
  const label = `Рекомендация по стене ${index + 1}`;
  const input = record(value, label);
  exactKeys(input, [
    "id",
    "kind",
    "targetWallCandidateId",
    "recommendation",
    "sourceRegion",
    "modelConfidence",
    "reasonCodes",
  ], label);
  if (input.kind !== "local-wall-review" || input.recommendation !== "likely-clutter") {
    throw new Error(`${label} содержит неподдерживаемый тип.`);
  }
  return {
    id: text(input.id, `${label}.id`, MAX_ID_LENGTH),
    kind: "local-wall-review",
    targetWallCandidateId: text(input.targetWallCandidateId, `${label}.targetWallCandidateId`, MAX_ID_LENGTH),
    recommendation: "likely-clutter",
    sourceRegion: normalizedRegion(input.sourceRegion, `${label}.sourceRegion`),
    modelConfidence: bounded(input.modelConfidence, 0, 1, `${label}.modelConfidence`),
    reasonCodes: uniqueTextList<AiWallReviewReasonCode>(
      input.reasonCodes,
      `${label}.reasonCodes`,
      MAX_REASON_CODES,
      AI_WALL_REVIEW_REASON_CODES,
    ),
  };
}

function proposal(value: unknown, index: number): AiRecognitionProposal {
  const input = record(value, `AI-предложение ${index + 1}`);
  if (input.kind === "opening-addition") return openingProposal(input, index);
  if (input.kind === "local-wall-review") return wallReviewProposal(input, index);
  throw new Error(`AI-предложение ${index + 1} содержит неподдерживаемый тип.`);
}

function diagnostic(value: unknown, index: number): AiProviderDiagnostic {
  const label = `Диагностика ${index + 1}`;
  const input = record(value, label);
  exactKeys(input, ["code", "severity", "message"], label);
  if (input.severity !== "info" && input.severity !== "warning" && input.severity !== "error") {
    throw new Error(`${label}.severity не поддерживается.`);
  }
  return {
    code: text(input.code, `${label}.code`, MAX_ID_LENGTH),
    severity: input.severity,
    message: text(input.message, `${label}.message`, MAX_MESSAGE_LENGTH),
  };
}

export function normalizeOpenRouterProposalPayload(value: unknown): AiProposalBatch {
  const input = record(value, "Ответ OpenRouter Stage 1");
  exactKeys(input, [
    "schemaVersion",
    "requestId",
    "referenceRevision",
    "localDraftFingerprint",
    "proposals",
    "diagnostics",
  ], "Ответ OpenRouter Stage 1");
  if (input.schemaVersion !== AI_PROPOSAL_SCHEMA_VERSION) {
    throw new Error("Ответ OpenRouter использует неподдерживаемую версию схемы.");
  }
  const localDraftFingerprint = text(input.localDraftFingerprint, "Fingerprint локального черновика", 96);
  if (!new RegExp(FINGERPRINT_PATTERN).test(localDraftFingerprint)) {
    throw new Error("Fingerprint локального черновика имеет неподдерживаемый формат.");
  }
  const proposals = array(input.proposals, "AI-предложения", MAX_PROPOSALS).map(proposal);
  const ids = proposals.map((entry) => entry.id);
  if (new Set(ids).size !== ids.length) throw new Error("Идентификаторы AI-предложений должны быть уникальными.");
  const openingCount = proposals.filter((entry) => entry.kind === "opening-addition").length;
  const wallReviewCount = proposals.filter((entry) => entry.kind === "local-wall-review").length;
  if (openingCount > AI_PROPOSAL_MAX_OPENINGS || wallReviewCount > AI_PROPOSAL_MAX_WALL_REVIEWS) {
    throw new Error("Ответ OpenRouter превышает безопасные лимиты категорий.");
  }
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: text(input.requestId, "Идентификатор запроса", MAX_ID_LENGTH),
    referenceRevision: text(input.referenceRevision, "Ревизия подложки", 240),
    localDraftFingerprint,
    proposals,
    diagnostics: array(
      input.diagnostics,
      "Диагностика OpenRouter",
      AI_PROPOSAL_MAX_DIAGNOSTICS,
    ).map(diagnostic),
  };
}

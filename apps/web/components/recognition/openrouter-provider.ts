import {
  assertAiProposalBatchIdentity,
  sanitizeCloudRecognitionResult,
  type RecognitionAiProviderEnvelope,
  type RecognitionAiProviderUsage,
  type RecognitionAiProposalRequest,
  type RecognitionDiagnostic,
  type RecognitionProvider,
  type RecognitionProviderInput,
  type RecognitionProviderResult,
} from "@vlezet/recognition";
import { recognitionError, recognitionInfo } from "./recognition-debug";
import { recognitionAiProposalImageInputs } from "./recognition-ai-request";
import {
  OPENROUTER_PROPOSAL_JSON_SCHEMA,
  normalizeOpenRouterProposalPayload,
} from "./openrouter-proposal-schema";
import {
  OPENROUTER_RECOGNITION_JSON_SCHEMA,
  OPENROUTER_VERIFICATION_JSON_SCHEMA,
  normalizeOpenRouterRecognitionPayload,
  normalizeOpenRouterVerificationPayload,
} from "./openrouter-schema";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const DEFAULT_RECOGNITION_TIMEOUT_MS = 90_000;
const VERIFICATION_MAX_TOKENS = 2048;
const DISCOVERY_MAX_TOKENS = 4096;
const MIN_LOCAL_HIGH_CONFIDENCE_FOR_PROFILE_WARNING = 3;
const MIN_ACCEPTABLE_CONFIRMED_HIGH_RATIO = 0.4;
const PROPOSAL_REPAIR_CONTENT_LIMIT = 32 * 1024;

export const OPENROUTER_PROPOSAL_PRIMARY_TIMEOUT_MS = 45_000;
export const OPENROUTER_PROPOSAL_SCHEMA_REPAIR_TIMEOUT_MS = 15_000;
export const OPENROUTER_PROPOSAL_MAX_ATTEMPTS = 2;
export const OPENROUTER_PROPOSAL_MAX_RESPONSE_BYTES = 96 * 1024;
export const OPENROUTER_PROPOSAL_MAX_TOKENS = 4096;

const defaultBrowserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);
const proposalProviderPreferences = Object.freeze({ require_parameters: true });

export type OpenRouterModelOption = Readonly<{
  id: string;
  name: string;
  contextLength: number | null;
}>;

export type OpenRouterVerificationModelProfile =
  | "unqualified-for-floor-plan-verification"
  | "unreviewed";

export function classifyOpenRouterVerificationModel(
  modelId: string,
): OpenRouterVerificationModelProfile {
  const canonical = modelId.trim().toLowerCase().split(":", 1)[0] ?? "";
  const modelName = canonical.includes("/") ? canonical.slice(canonical.lastIndexOf("/") + 1) : canonical;
  if (/^gemini-2\.5-flash(?:-preview(?:-\d{2}-\d{2})?)?$/.test(modelName)) {
    return "unqualified-for-floor-plan-verification";
  }
  return "unreviewed";
}

export class OpenRouterRecognitionError extends Error {
  readonly code: "invalid-key" | "insufficient-funds" | "rate-limit" | "unsupported-model" | "invalid-response" | "request-failed" | "timeout";

  constructor(code: OpenRouterRecognitionError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenRouterRecognitionError";
    this.code = code;
  }
}

class RepairableProposalResponseError extends OpenRouterRecognitionError {
  readonly repairCode: "invalid-json" | "invalid-structure";

  constructor(repairCode: RepairableProposalResponseError["repairCode"], message: string, options?: ErrorOptions) {
    super("invalid-response", message, options);
    this.name = "RepairableProposalResponseError";
    this.repairCode = repairCode;
  }
}

function authHeaders(apiKey: string): HeadersInit {
  return {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
}

async function responseError(response: Response): Promise<never> {
  if (response.status === 401 || response.status === 403) throw new OpenRouterRecognitionError("invalid-key", "OpenRouter отклонил API key.");
  if (response.status === 402) throw new OpenRouterRecognitionError("insufficient-funds", "На балансе OpenRouter недостаточно средств для выбранной модели.");
  if (response.status === 429) throw new OpenRouterRecognitionError("rate-limit", "OpenRouter временно ограничил частоту запросов. Повторите позже.");
  throw new OpenRouterRecognitionError("request-failed", `OpenRouter вернул ошибку ${response.status}.`);
}

export async function listCompatibleOpenRouterModels(
  apiKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = defaultBrowserFetch,
): Promise<readonly OpenRouterModelOption[]> {
  const key = apiKey.trim();
  if (!key) throw new OpenRouterRecognitionError("invalid-key", "Введите OpenRouter API key.");
  const startedAt = performance.now();
  recognitionInfo("openrouter.models.start");
  try {
    const response = await fetcher(`${OPENROUTER_BASE_URL}/models?input_modalities=image&supported_parameters=structured_outputs&sort=pricing-low-to-high`, {
      method: "GET",
      headers: authHeaders(key),
      signal,
    });
    recognitionInfo("openrouter.models.response", { status: response.status, durationMs: Math.round(performance.now() - startedAt) });
    if (!response.ok) return responseError(response);
    const payload = await response.json() as { data?: unknown };
    if (!Array.isArray(payload.data)) throw new OpenRouterRecognitionError("invalid-response", "OpenRouter вернул некорректный список моделей.");
    const models = payload.data.flatMap((entry): OpenRouterModelOption[] => {
      if (!entry || typeof entry !== "object") return [];
      const model = entry as Record<string, unknown>;
      const architecture = model.architecture && typeof model.architecture === "object" ? model.architecture as Record<string, unknown> : {};
      const modalities = Array.isArray(architecture.input_modalities) ? architecture.input_modalities : [];
      const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
      const supportsVision = modalities.includes("image");
      const supportsStructured = parameters.includes("structured_outputs") || parameters.includes("response_format");
      if (!supportsVision || !supportsStructured || typeof model.id !== "string" || !model.id) return [];
      return [{
        id: model.id,
        name: typeof model.name === "string" && model.name.trim() ? model.name : model.id,
        contextLength: typeof model.context_length === "number" && Number.isFinite(model.context_length) ? model.context_length : null,
      }];
    });
    recognitionInfo("openrouter.models.complete", { compatibleModels: models.length, durationMs: Math.round(performance.now() - startedAt) });
    return models;
  } catch (cause) {
    recognitionError("openrouter.models.error", cause, { durationMs: Math.round(performance.now() - startedAt) });
    throw cause;
  }
}

function schemaCoordinate(value: number): number {
  return Math.round(Math.min(1, Math.max(0, value)) * 10_000);
}

function verificationPrompt(input: RecognitionProviderInput): string {
  const localWalls = input.localSummary?.walls ?? [];
  const localOpenings = input.localSummary?.openings ?? [];
  const wallLines = localWalls.map((wall) => [
    `${wall.id}:`,
    `start=(${schemaCoordinate(wall.start.x)},${schemaCoordinate(wall.start.y)}),`,
    `end=(${schemaCoordinate(wall.end.x)},${schemaCoordinate(wall.end.y)}),`,
    `localConfidence=${wall.confidence}`,
  ].join(" "));
  const openingLines = localOpenings.map((opening) => [
    `${opening.id}:`,
    `kind=${opening.kind},`,
    `hostWallId=${opening.hostWallCandidateId ?? "null"},`,
    `center=(${schemaCoordinate(opening.center.x)},${schemaCoordinate(opening.center.y)}),`,
    `localConfidence=${opening.confidence}`,
  ].join(" "));

  return [
    "Режим: только проверка локального Draft, не повторное распознавание плана.",
    `Размер исходного нормализованного растра: ${input.imageWidthPx} × ${input.imageHeightPx} px.`,
    "Проверь каждый локальный кандидат стены и проёма по изображению.",
    "Не добавляй новые стены и не создавай новые wall id.",
    "Не добавляй новые проёмы и не создавай новые opening id.",
    "Возвращай только подтверждённые локальные id; неподтверждённые полностью пропускай.",
    "Для стены возвращай только id, confidence и score.",
    "Для проёма возвращай только id, kind, confidence и score.",
    "Геометрия, толщина, host wall, центр, ширина и ориентация принадлежат локальному движку и не передаются обратно AI.",
    "Не возвращай мебель, сантехнику, цифры, подписи, дверные дуги, штриховку, рамку изображения или границы пустого поля как стены.",
    "Не выполняй OCR и не возвращай названия комнат в режиме проверки.",
    "Локальные кандидаты стен в координатах 0..10000:",
    ...wallLines,
    "Локальные кандидаты проёмов в координатах 0..10000:",
    ...openingLines,
  ].join("\n");
}

function discoveryPrompt(input: RecognitionProviderInput): string {
  return [
    "Проанализируй архитектурный план квартиры.",
    `Размер исходного нормализованного растра: ${input.imageWidthPx} × ${input.imageHeightPx} px.`,
    "Верни только структурированные стены и необязательные подписи комнат по заданной JSON Schema.",
    "Координаты start/end/anchor используй в системе 0..10000 относительно всего изображения: x слева направо, y сверху вниз.",
    "Каждая wall должна совпадать с видимой осевой линией реальной строительной стены на плане.",
    "НЕ возвращай границу изображения, рамку листа, crop/page boundary, bounding box квартиры, прямоугольник вокруг плана или границы пустого белого поля как стены.",
    "Не создавай enclosing rectangle только потому, что квартира визуально занимает прямоугольную область.",
    "Если стена не видна достаточно уверенно, лучше не возвращай её вовсе.",
    "Не придумывай метрические размеры и не реконструируй элементы, которых не видно уверенно.",
    "Верни openings пустым списком: без локальных host-validated гипотез AI не может создавать проёмы.",
    "Для сомнительных элементов снижай confidence.",
  ].join("\n");
}

function isVerification(input: RecognitionProviderInput): input is RecognitionProviderInput & {
  localSummary: NonNullable<RecognitionProviderInput["localSummary"]>;
} {
  return Boolean(input.localSummary && (input.localSummary.walls.length > 0 || input.localSummary.openings.length > 0));
}

function prompt(input: RecognitionProviderInput): string {
  return isVerification(input) ? verificationPrompt(input) : discoveryPrompt(input);
}

function weakVerificationDiagnostic(input: Readonly<{
  modelId: string;
  localSummary: NonNullable<RecognitionProviderInput["localSummary"]>;
  result: RecognitionProviderResult;
}>): RecognitionDiagnostic | null {
  if (classifyOpenRouterVerificationModel(input.modelId) !== "unqualified-for-floor-plan-verification") return null;
  const localHighCount = [...input.localSummary.walls, ...input.localSummary.openings]
    .filter((candidate) => candidate.confidence === "high" && candidate.conflict === null)
    .length;
  if (localHighCount < MIN_LOCAL_HIGH_CONFIDENCE_FOR_PROFILE_WARNING) return null;
  const confirmedHighCount = [...input.result.walls, ...input.result.openings]
    .filter((candidate) => candidate.confidence === "high" && candidate.conflict === null)
    .length;
  if (confirmedHighCount / localHighCount >= MIN_ACCEPTABLE_CONFIRMED_HIGH_RATIO) return null;
  return {
    code: "weak-ai-verification-profile",
    severity: "warning",
    message: "Модель резко снизила уверенность локального черновика. Это не исправляет геометрию; сравните результат с локальным слоем или выберите другую vision-модель.",
    candidateId: null,
  };
}

function boundedSignal(externalSignal: AbortSignal, timeoutMs: number): Readonly<{
  signal: AbortSignal;
  timedOut: () => boolean;
  dispose: () => void;
}> {
  const controller = new AbortController();
  let timeoutReached = false;
  const relayAbort = () => controller.abort(externalSignal.reason);
  if (externalSignal.aborted) relayAbort();
  else externalSignal.addEventListener("abort", relayAbort, { once: true });
  const timer = setTimeout(() => {
    timeoutReached = true;
    controller.abort(new DOMException("AI recognition timed out", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timeoutReached,
    dispose: () => {
      clearTimeout(timer);
      externalSignal.removeEventListener("abort", relayAbort);
    },
  };
}

function finiteUsage(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function proposalUsage(value: unknown): RecognitionAiProviderUsage {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return { promptTokens: null, completionTokens: null, totalTokens: null };
  }
  const usage = value as Record<string, unknown>;
  return {
    promptTokens: finiteUsage(usage.prompt_tokens),
    completionTokens: finiteUsage(usage.completion_tokens),
    totalTokens: finiteUsage(usage.total_tokens),
  };
}

function proposalPrompt(request: RecognitionAiProposalRequest): string {
  return [
    "mode=proposal-discovery-stage1",
    "Найди только пропущенные двери, пропущенные окна и вероятный мусор среди локальных кандидатов стен.",
    "Не изменяй и не возвращай существующую геометрию локального Draft.",
    "Не предлагай новые стены, подписи комнат, мебель, сантехнику или иные типы объектов.",
    "Первое изображение — исходный план. Второе — прозрачный overlay с локальными ID W/D/O.",
    "Все координаты и размеры в ответе используй в целой системе 0..10000 относительно полного исходного изображения.",
    `requestId=${request.requestId}`,
    `referenceRevision=${request.referenceRevision}`,
    `localDraftFingerprint=${request.localDraftFingerprint}`,
    `budgets=${JSON.stringify(request.budgets)}`,
    `localSummary=${JSON.stringify(request.localSummary)}`,
  ].join("\n");
}

function proposalResponseFormat() {
  return {
    type: "json_schema",
    json_schema: {
      name: "vlezet_floor_plan_proposals_stage1",
      strict: true,
      schema: OPENROUTER_PROPOSAL_JSON_SCHEMA,
    },
  } as const;
}

function primaryProposalBody(modelId: string, request: RecognitionAiProposalRequest) {
  return {
    model: modelId,
    messages: [{
      role: "user",
      content: [
        { type: "text", text: proposalPrompt(request) },
        ...recognitionAiProposalImageInputs(request),
      ],
    }],
    response_format: proposalResponseFormat(),
    provider: proposalProviderPreferences,
    max_tokens: OPENROUTER_PROPOSAL_MAX_TOKENS,
    temperature: 0,
    stream: false,
  };
}

function repairProposalBody(
  modelId: string,
  request: RecognitionAiProposalRequest,
  repairCode: RepairableProposalResponseError["repairCode"],
  invalidContent: string,
) {
  const boundedContent = invalidContent.slice(0, PROPOSAL_REPAIR_CONTENT_LIMIT);
  return {
    model: modelId,
    messages: [{
      role: "user",
      content: [{
        type: "text",
        text: [
          "schema-repair",
          `repairCode=${repairCode}`,
          "Исправь только JSON ниже по той же строгой Stage 1 schema.",
          "Не добавляй новые типы, не меняй requestId, referenceRevision или localDraftFingerprint.",
          `requestId=${request.requestId}`,
          `referenceRevision=${request.referenceRevision}`,
          `localDraftFingerprint=${request.localDraftFingerprint}`,
          "invalidResponse:",
          boundedContent,
        ].join("\n"),
      }],
    }],
    response_format: proposalResponseFormat(),
    provider: proposalProviderPreferences,
    max_tokens: OPENROUTER_PROPOSAL_MAX_TOKENS,
    temperature: 0,
    stream: false,
  };
}

type ProposalAttemptResult = Readonly<{
  batch: RecognitionAiProviderEnvelope["batch"];
  usage: RecognitionAiProviderUsage;
  invalidContent: string;
}>;

function responseByteLength(value: string): number {
  return new TextEncoder().encode(value).byteLength;
}

function safeProposalError(cause: unknown): OpenRouterRecognitionError {
  if (cause instanceof OpenRouterRecognitionError) return cause;
  return new OpenRouterRecognitionError(
    "request-failed",
    "Не удалось выполнить AI-поиск пропущенных элементов. Локальный черновик сохранён без изменений.",
  );
}

export class OpenRouterDirectProvider implements RecognitionProvider {
  readonly id = "openrouter-direct";
  readonly displayName = "OpenRouter";
  readonly #apiKey: string;
  readonly #modelId: string;
  readonly #fetcher: typeof fetch;
  readonly #timeoutMs: number;

  constructor(input: Readonly<{ apiKey: string; modelId: string; fetcher?: typeof fetch; timeoutMs?: number }>) {
    this.#apiKey = input.apiKey.trim();
    this.#modelId = input.modelId.trim();
    this.#fetcher = input.fetcher ?? defaultBrowserFetch;
    this.#timeoutMs = input.timeoutMs ?? DEFAULT_RECOGNITION_TIMEOUT_MS;
    if (!this.#apiKey) throw new OpenRouterRecognitionError("invalid-key", "Введите OpenRouter API key.");
    if (!this.#modelId) throw new OpenRouterRecognitionError("unsupported-model", "Выберите модель OpenRouter.");
    if (!Number.isFinite(this.#timeoutMs) || this.#timeoutMs <= 0) {
      throw new OpenRouterRecognitionError("request-failed", "Тайм-аут AI-проверки должен быть положительным числом.");
    }
  }

  async #proposalAttempt(
    request: RecognitionAiProposalRequest,
    signal: AbortSignal,
    timeoutMs: number,
    body: unknown,
    repairable: boolean,
  ): Promise<ProposalAttemptResult> {
    const bounded = boundedSignal(signal, timeoutMs);
    try {
      const response = await this.#fetcher(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: authHeaders(this.#apiKey),
        signal: bounded.signal,
        body: JSON.stringify(body),
      });
      recognitionInfo("openrouter.proposals.response", {
        modelId: this.#modelId,
        status: response.status,
        repair: !repairable,
      });
      if (!response.ok) return responseError(response);
      const responseText = await response.text();
      if (responseByteLength(responseText) > OPENROUTER_PROPOSAL_MAX_RESPONSE_BYTES) {
        throw new OpenRouterRecognitionError(
          "invalid-response",
          "Ответ OpenRouter превысил безопасный размер.",
        );
      }
      let envelope: unknown;
      try {
        envelope = JSON.parse(responseText);
      } catch {
        throw new OpenRouterRecognitionError(
          "invalid-response",
          "OpenRouter вернул некорректный HTTP JSON envelope.",
        );
      }
      if (!envelope || typeof envelope !== "object" || Array.isArray(envelope)) {
        throw new OpenRouterRecognitionError("invalid-response", "OpenRouter вернул некорректный HTTP envelope.");
      }
      const outer = envelope as Record<string, unknown>;
      const choices = Array.isArray(outer.choices) ? outer.choices : [];
      const choice = choices[0];
      const message = choice && typeof choice === "object" && !Array.isArray(choice)
        ? (choice as Record<string, unknown>).message
        : null;
      const content = message && typeof message === "object" && !Array.isArray(message)
        ? (message as Record<string, unknown>).content
        : null;
      if (typeof content !== "string" || !content.trim()) {
        throw new OpenRouterRecognitionError(
          "invalid-response",
          "OpenRouter не вернул структурированный Stage 1 результат.",
        );
      }
      let parsed: unknown;
      try {
        parsed = JSON.parse(content);
      } catch {
        if (repairable) {
          throw new RepairableProposalResponseError(
            "invalid-json",
            "OpenRouter вернул некорректный Stage 1 JSON.",
          );
        }
        throw new OpenRouterRecognitionError("invalid-response", "Schema repair вернул некорректный JSON.");
      }
      let batch: RecognitionAiProviderEnvelope["batch"];
      try {
        batch = normalizeOpenRouterProposalPayload(parsed);
      } catch {
        if (repairable) {
          throw new RepairableProposalResponseError(
            "invalid-structure",
            "Ответ OpenRouter не прошёл строгую Stage 1 schema.",
          );
        }
        throw new OpenRouterRecognitionError("invalid-response", "Schema repair не прошёл строгую Stage 1 schema.");
      }
      try {
        assertAiProposalBatchIdentity(batch, {
          requestId: request.requestId,
          referenceRevision: request.referenceRevision,
          localDraftFingerprint: request.localDraftFingerprint,
        });
      } catch {
        throw new OpenRouterRecognitionError(
          "invalid-response",
          "Ответ OpenRouter относится к другому запросу или локальному черновику.",
        );
      }
      return { batch, usage: proposalUsage(outer.usage), invalidContent: content };
    } catch (cause) {
      if (bounded.timedOut()) {
        throw new OpenRouterRecognitionError(
          "timeout",
          `AI-поиск пропусков не завершился за ${Math.round(timeoutMs / 1000)} сек. Локальный черновик сохранён без изменений.`,
        );
      }
      throw cause;
    } finally {
      bounded.dispose();
    }
  }

  async recognizeProposals(
    request: RecognitionAiProposalRequest,
    signal: AbortSignal,
  ): Promise<RecognitionAiProviderEnvelope> {
    const startedAt = performance.now();
    recognitionInfo("openrouter.proposals.start", {
      modelId: this.#modelId,
      mode: request.mode,
      imageWidthPx: request.imageWidthPx,
      imageHeightPx: request.imageHeightPx,
      localWalls: request.localSummary.walls.length,
      localOpenings: request.localSummary.openings.length,
      maxAttempts: OPENROUTER_PROPOSAL_MAX_ATTEMPTS,
    });
    try {
      try {
        const primary = await this.#proposalAttempt(
          request,
          signal,
          OPENROUTER_PROPOSAL_PRIMARY_TIMEOUT_MS,
          primaryProposalBody(this.#modelId, request),
          true,
        );
        const latencyMs = Math.round(performance.now() - startedAt);
        recognitionInfo("openrouter.proposals.complete", {
          modelId: this.#modelId,
          attemptCount: 1,
          proposals: primary.batch.proposals.length,
          diagnostics: primary.batch.diagnostics.length,
          durationMs: latencyMs,
        });
        return {
          batch: primary.batch,
          providerId: this.id,
          modelId: this.#modelId,
          latencyMs,
          usage: primary.usage,
          attemptCount: 1,
        };
      } catch (cause) {
        if (!(cause instanceof RepairableProposalResponseError)) throw cause;
        const repaired = await this.#proposalAttempt(
          request,
          signal,
          OPENROUTER_PROPOSAL_SCHEMA_REPAIR_TIMEOUT_MS,
          repairProposalBody(this.#modelId, request, cause.repairCode, cause.message),
          false,
        );
        const latencyMs = Math.round(performance.now() - startedAt);
        recognitionInfo("openrouter.proposals.complete", {
          modelId: this.#modelId,
          attemptCount: 2,
          proposals: repaired.batch.proposals.length,
          diagnostics: repaired.batch.diagnostics.length,
          durationMs: latencyMs,
        });
        return {
          batch: repaired.batch,
          providerId: this.id,
          modelId: this.#modelId,
          latencyMs,
          usage: repaired.usage,
          attemptCount: 2,
        };
      }
    } catch (cause) {
      const mapped = safeProposalError(cause);
      recognitionError("openrouter.proposals.error", mapped, {
        modelId: this.#modelId,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw mapped;
    }
  }

  async recognize(input: RecognitionProviderInput, signal: AbortSignal): Promise<RecognitionProviderResult> {
    const startedAt = performance.now();
    const verification = isVerification(input);
    const bounded = boundedSignal(signal, this.#timeoutMs);
    recognitionInfo("openrouter.request.start", {
      modelId: this.#modelId,
      mode: verification ? "verification" : "discovery",
      imageWidthPx: input.imageWidthPx,
      imageHeightPx: input.imageHeightPx,
      localWalls: input.localSummary?.walls.length ?? 0,
      localOpenings: input.localSummary?.openings.length ?? 0,
      timeoutMs: this.#timeoutMs,
    });
    try {
      const fetcher = this.#fetcher;
      const response = await fetcher(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: authHeaders(this.#apiKey),
        signal: bounded.signal,
        body: JSON.stringify({
          model: this.#modelId,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: prompt(input) },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ],
          }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: verification ? "vlezet_floor_plan_verification" : "vlezet_floor_plan_recognition",
              strict: true,
              schema: verification ? OPENROUTER_VERIFICATION_JSON_SCHEMA : OPENROUTER_RECOGNITION_JSON_SCHEMA,
            },
          },
          plugins: [{ id: "response-healing" }],
          provider: { require_parameters: true },
          max_tokens: verification ? VERIFICATION_MAX_TOKENS : DISCOVERY_MAX_TOKENS,
          temperature: 0,
          stream: false,
        }),
      });
      recognitionInfo("openrouter.request.response", {
        modelId: this.#modelId,
        status: response.status,
        durationMs: Math.round(performance.now() - startedAt),
      });
      if (!response.ok) return responseError(response);
      const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
      const content = payload.choices?.[0]?.message?.content;
      if (typeof content !== "string" || !content.trim()) {
        throw new OpenRouterRecognitionError("invalid-response", "OpenRouter не вернул структурированный результат распознавания.");
      }
      let parsed: unknown;
      try { parsed = JSON.parse(content); }
      catch (cause) { throw new OpenRouterRecognitionError("invalid-response", "OpenRouter вернул некорректный JSON.", { cause }); }

      let normalized: RecognitionProviderResult;
      try {
        normalized = verification
          ? normalizeOpenRouterVerificationPayload(parsed, input.localSummary)
          : normalizeOpenRouterRecognitionPayload(parsed);
      } catch (cause) {
        throw new OpenRouterRecognitionError("invalid-response", "Ответ OpenRouter не прошёл проверку структуры ответа.", { cause });
      }

      const sanitized = sanitizeCloudRecognitionResult({ result: normalized, localSummary: input.localSummary });
      const profileDiagnostic = verification
        ? weakVerificationDiagnostic({ modelId: this.#modelId, localSummary: input.localSummary, result: sanitized })
        : null;
      const result: RecognitionProviderResult = profileDiagnostic
        ? { ...sanitized, diagnostics: [...(sanitized.diagnostics ?? []), profileDiagnostic] }
        : sanitized;
      recognitionInfo("openrouter.request.complete", {
        modelId: this.#modelId,
        walls: result.walls.length,
        openings: result.openings.length,
        roomLabels: result.roomLabels.length,
        diagnostics: result.diagnostics?.length ?? 0,
        durationMs: Math.round(performance.now() - startedAt),
      });
      return result;
    } catch (cause) {
      const mappedCause = bounded.timedOut()
        ? new OpenRouterRecognitionError(
            "timeout",
            `AI-проверка не завершилась за ${Math.round(this.#timeoutMs / 1000)} сек. Локальный черновик сохранён без изменений.`,
            { cause },
          )
        : cause;
      recognitionError("openrouter.request.error", mappedCause, {
        modelId: this.#modelId,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw mappedCause;
    } finally {
      bounded.dispose();
    }
  }
}

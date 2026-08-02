import {
  sanitizeCloudRecognitionResult,
  type RecognitionProvider,
  type RecognitionProviderInput,
  type RecognitionProviderResult,
} from "@vlezet/recognition";
import { recognitionError, recognitionInfo } from "./recognition-debug";
import { OPENROUTER_RECOGNITION_JSON_SCHEMA, normalizeOpenRouterRecognitionPayload } from "./openrouter-schema";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";

const defaultBrowserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export type OpenRouterModelOption = Readonly<{
  id: string;
  name: string;
  contextLength: number | null;
}>;

export class OpenRouterRecognitionError extends Error {
  readonly code: "invalid-key" | "insufficient-funds" | "rate-limit" | "unsupported-model" | "invalid-response" | "request-failed";

  constructor(code: OpenRouterRecognitionError["code"], message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenRouterRecognitionError";
    this.code = code;
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
  let detail = "";
  try { detail = JSON.stringify(await response.json()); } catch { detail = await response.text().catch(() => ""); }
  throw new OpenRouterRecognitionError("request-failed", `OpenRouter вернул ошибку ${response.status}${detail ? `: ${detail.slice(0, 300)}` : "."}`);
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
    `thicknessPx=${wall.estimatedThicknessPx ?? "null"},`,
    `localConfidence=${wall.confidence}`,
  ].join(" "));
  const openingLines = localOpenings.map((opening) => [
    `${opening.id}:`,
    `kind=${opening.kind},`,
    `hostWallId=${opening.hostWallCandidateId ?? "null"},`,
    `center=(${schemaCoordinate(opening.center.x)},${schemaCoordinate(opening.center.y)}),`,
    `widthPx=${opening.widthPx ?? "null"},`,
    `orientationDeg=${opening.orientationDeg ?? "null"},`,
    `localConfidence=${opening.confidence}`,
  ].join(" "));

  return [
    "Режим: только проверка локального Draft, не повторное распознавание плана.",
    `Размер исходного нормализованного растра: ${input.imageWidthPx} × ${input.imageHeightPx} px.`,
    "Проверь каждый локальный кандидат стены и проёма по изображению.",
    "Не добавляй новые стены и не создавай новые wall id.",
    "Не добавляй новые проёмы и не создавай новые opening id.",
    "Возвращай только те стены из списка ниже, которые действительно подтверждаются изображением.",
    "Сохраняй исходный id и координаты без изменений; меняй только confidence и score.",
    "Для проёмов сохраняй host wall, center, widthPx и orientationDeg без изменений; разрешено уточнить только kind, confidence и score.",
    "Не переноси проём на другую стену, не двигай, не расширяй и не поворачивай его.",
    "Если локальный проём не подтверждается, полностью пропусти его в массиве openings.",
    "Не возвращай мебель, сантехнику, цифры, подписи, дверные дуги, штриховку, рамку изображения или границы пустого поля как стены.",
    "Если кандидат стены не подтверждается, полностью пропусти его в массиве walls.",
    "Подписи комнат допускаются только при явном прочтении текста на изображении.",
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

function prompt(input: RecognitionProviderInput): string {
  return input.localSummary
    && (input.localSummary.walls.length > 0 || input.localSummary.openings.length > 0)
    ? verificationPrompt(input)
    : discoveryPrompt(input);
}

export class OpenRouterDirectProvider implements RecognitionProvider {
  readonly id = "openrouter-direct";
  readonly displayName = "OpenRouter";
  readonly #apiKey: string;
  readonly #modelId: string;
  readonly #fetcher: typeof fetch;

  constructor(input: Readonly<{ apiKey: string; modelId: string; fetcher?: typeof fetch }>) {
    this.#apiKey = input.apiKey.trim();
    this.#modelId = input.modelId.trim();
    this.#fetcher = input.fetcher ?? defaultBrowserFetch;
    if (!this.#apiKey) throw new OpenRouterRecognitionError("invalid-key", "Введите OpenRouter API key.");
    if (!this.#modelId) throw new OpenRouterRecognitionError("unsupported-model", "Выберите модель OpenRouter.");
  }

  async recognize(input: RecognitionProviderInput, signal: AbortSignal): Promise<RecognitionProviderResult> {
    const startedAt = performance.now();
    recognitionInfo("openrouter.request.start", {
      modelId: this.#modelId,
      imageWidthPx: input.imageWidthPx,
      imageHeightPx: input.imageHeightPx,
      localWalls: input.localSummary?.walls.length ?? 0,
      localOpenings: input.localSummary?.openings.length ?? 0,
    });
    try {
      const fetcher = this.#fetcher;
      const response = await fetcher(`${OPENROUTER_BASE_URL}/chat/completions`, {
        method: "POST",
        headers: authHeaders(this.#apiKey),
        signal,
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
              name: "vlezet_floor_plan_recognition",
              strict: true,
              schema: OPENROUTER_RECOGNITION_JSON_SCHEMA,
            },
          },
          plugins: [{ id: "response-healing" }],
          provider: { require_parameters: true },
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
      try { normalized = normalizeOpenRouterRecognitionPayload(parsed); }
      catch (cause) { throw new OpenRouterRecognitionError("invalid-response", "Ответ OpenRouter не прошёл проверку структуры ответа.", { cause }); }

      const result = sanitizeCloudRecognitionResult({ result: normalized, localSummary: input.localSummary });
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
      recognitionError("openrouter.request.error", cause, {
        modelId: this.#modelId,
        durationMs: Math.round(performance.now() - startedAt),
      });
      throw cause;
    }
  }
}

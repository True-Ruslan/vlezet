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

function prompt(input: RecognitionProviderInput): string {
  const localContext = input.localSummary
    ? `Локальный детектор уже предложил ${input.localSummary.walls.length} стен и ${input.localSummary.openings.length} проёмов. Используй это как геометрическую подсказку, но проверяй по самому изображению.`
    : "Локальных геометрических подсказок нет.";
  return [
    "Проанализируй архитектурный план квартиры.",
    `Размер исходного нормализованного растра: ${input.imageWidthPx} × ${input.imageHeightPx} px.`,
    "Верни только структурированные стены, двери/окна и необязательные подписи комнат по заданной JSON Schema.",
    "Координаты start/end/center/anchor используй в системе 0..10000 относительно всего изображения: x слева направо, y сверху вниз.",
    "Каждая wall должна совпадать с видимой осевой линией реальной строительной стены на плане.",
    "НЕ возвращай границу изображения, рамку листа, crop/page boundary, bounding box квартиры, прямоугольник вокруг плана или границы пустого белого поля как стены.",
    "Не создавай enclosing rectangle только потому, что квартира визуально занимает прямоугольную область.",
    "Если стена не видна достаточно уверенно, лучше не возвращай её вовсе.",
    "Проём должен находиться на реально возвращённой стене; не придумывай двери/окна в пустом поле.",
    "Не придумывай метрические размеры и не реконструируй элементы, которых не видно уверенно.",
    "Для сомнительных элементов снижай confidence.",
    localContext,
  ].join("\n");
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

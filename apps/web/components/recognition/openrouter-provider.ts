import type { RecognitionProvider, RecognitionProviderInput, RecognitionProviderResult } from "@vlezet/recognition";
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

function prompt(localSummary: RecognitionProviderInput["localSummary"]): string {
  const localContext = localSummary
    ? `Локальный детектор уже предложил ${localSummary.walls.length} стен и ${localSummary.openings.length} проёмов. Используй это только как подсказку, проверяй по изображению.`
    : "Локальных подсказок нет.";
  return [
    "Проанализируй архитектурный план квартиры.",
    "Верни только структурированные стены, двери/окна и необязательные подписи комнат по заданной JSON Schema.",
    "Координаты используй в нормализованной целочисленной системе 0..10000 относительно всего изображения: x слева направо, y сверху вниз.",
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
              { type: "text", text: prompt(input.localSummary) },
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
      let result: RecognitionProviderResult;
      try { result = normalizeOpenRouterRecognitionPayload(parsed); }
      catch (cause) { throw new OpenRouterRecognitionError("invalid-response", "Ответ OpenRouter не прошёл проверку геометрического контракта.", { cause }); }
      recognitionInfo("openrouter.request.complete", {
        modelId: this.#modelId,
        walls: result.walls.length,
        openings: result.openings.length,
        roomLabels: result.roomLabels.length,
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

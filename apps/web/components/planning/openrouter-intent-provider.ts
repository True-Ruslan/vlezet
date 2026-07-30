import type {
  PlanningIntentInterpretation,
  PlanningObjectReferenceTarget,
} from "@vlezet/planning";
import {
  OPENROUTER_PLANNING_INTENT_JSON_SCHEMA,
  normalizeOpenRouterPlanningIntentPayload,
} from "./openrouter-intent-schema";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
const defaultBrowserFetch: typeof fetch = (input, init) => globalThis.fetch(input, init);

export type OpenRouterTextModelOption = Readonly<{
  id: string;
  name: string;
  contextLength: number | null;
}>;

export type OpenRouterPlanningIntentErrorCode =
  | "invalid-key"
  | "insufficient-funds"
  | "rate-limit"
  | "unsupported-model"
  | "invalid-response"
  | "invalid-request"
  | "request-failed";

export class OpenRouterPlanningIntentError extends Error {
  readonly code: OpenRouterPlanningIntentErrorCode;

  constructor(code: OpenRouterPlanningIntentErrorCode, message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "OpenRouterPlanningIntentError";
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
  if (response.status === 401 || response.status === 403) {
    throw new OpenRouterPlanningIntentError("invalid-key", "OpenRouter отклонил API key.");
  }
  if (response.status === 402) {
    throw new OpenRouterPlanningIntentError(
      "insufficient-funds",
      "На балансе OpenRouter недостаточно средств для выбранной модели.",
    );
  }
  if (response.status === 429) {
    throw new OpenRouterPlanningIntentError(
      "rate-limit",
      "OpenRouter временно ограничил частоту запросов. Повторите позже.",
    );
  }
  const detail = await response.text().catch(() => "");
  throw new OpenRouterPlanningIntentError(
    "request-failed",
    `OpenRouter вернул ошибку ${response.status}${detail ? `: ${detail.slice(0, 300)}` : "."}`,
  );
}

export async function listCompatibleOpenRouterTextModels(
  apiKey: string,
  signal: AbortSignal,
  fetcher: typeof fetch = defaultBrowserFetch,
): Promise<readonly OpenRouterTextModelOption[]> {
  const key = apiKey.trim();
  if (!key) throw new OpenRouterPlanningIntentError("invalid-key", "Введите OpenRouter API key.");

  const response = await fetcher(
    `${OPENROUTER_BASE_URL}/models?input_modalities=text&supported_parameters=structured_outputs&sort=pricing-low-to-high`,
    { method: "GET", headers: authHeaders(key), signal },
  );
  if (!response.ok) return responseError(response);

  const payload = await response.json() as { data?: unknown };
  if (!Array.isArray(payload.data)) {
    throw new OpenRouterPlanningIntentError("invalid-response", "OpenRouter вернул некорректный список моделей.");
  }

  return payload.data.flatMap((entry): OpenRouterTextModelOption[] => {
    if (!entry || typeof entry !== "object") return [];
    const model = entry as Record<string, unknown>;
    const architecture = model.architecture && typeof model.architecture === "object"
      ? model.architecture as Record<string, unknown>
      : {};
    const modalities = Array.isArray(architecture.input_modalities) ? architecture.input_modalities : [];
    const parameters = Array.isArray(model.supported_parameters) ? model.supported_parameters : [];
    const supportsText = modalities.includes("text");
    const supportsStructured = parameters.includes("structured_outputs") || parameters.includes("response_format");
    if (!supportsText || !supportsStructured || typeof model.id !== "string" || !model.id) return [];
    return [{
      id: model.id,
      name: typeof model.name === "string" && model.name.trim() ? model.name : model.id,
      contextLength: typeof model.context_length === "number" && Number.isFinite(model.context_length)
        ? model.context_length
        : null,
    }];
  });
}

function interpretationPrompt(
  requestText: string,
  roomObjects: readonly PlanningObjectReferenceTarget[],
): string {
  const objectList = roomObjects
    .map((object) => `- ${object.name} [${object.id}]`)
    .join("\n");
  return [
    "Разбери пожелания пользователя к перестановке мебели только в поддерживаемые символические правила.",
    "Поддерживаются: не двигать предмет; ближе к стене; ближе к углу; два предмета ближе/дальше; минимальный зазор между двумя предметами.",
    "Используй названия предметов в objectRef/objectRefs. Не считай ID окончательным выбором: приложение проверит ссылки самостоятельно.",
    "Любое пожелание про окно, дверь, конкретную сторону комнаты, свободную точку или иной неподдерживаемый смысл перенеси в unsupportedFragments.",
    "Не придумывай отсутствующие предметы, числовые значения или единицы.",
    "Сохрани исходный фрагмент каждого правила в sourceText.",
    "Предметы выбранной комнаты:",
    objectList || "- нет предметов",
    "Пожелания пользователя:",
    requestText,
  ].join("\n");
}

export type InterpretPlanningIntentWithOpenRouterInput = Readonly<{
  apiKey: string;
  modelId: string;
  requestText: string;
  roomObjects: readonly PlanningObjectReferenceTarget[];
  signal: AbortSignal;
  fetcher?: typeof fetch;
}>;

export async function interpretPlanningIntentWithOpenRouter(
  input: InterpretPlanningIntentWithOpenRouterInput,
): Promise<PlanningIntentInterpretation> {
  const apiKey = input.apiKey.trim();
  const modelId = input.modelId.trim();
  const requestText = input.requestText.trim();
  if (!apiKey) throw new OpenRouterPlanningIntentError("invalid-key", "Введите OpenRouter API key.");
  if (!modelId) throw new OpenRouterPlanningIntentError("unsupported-model", "Выберите модель OpenRouter.");
  if (!requestText) throw new OpenRouterPlanningIntentError("invalid-request", "Опишите пожелания к расстановке.");

  const fetcher = input.fetcher ?? defaultBrowserFetch;
  const response = await fetcher(`${OPENROUTER_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: authHeaders(apiKey),
    signal: input.signal,
    body: JSON.stringify({
      model: modelId,
      messages: [{
        role: "user",
        content: interpretationPrompt(requestText, input.roomObjects),
      }],
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "vlezet_planning_intent",
          strict: true,
          schema: OPENROUTER_PLANNING_INTENT_JSON_SCHEMA,
        },
      },
      provider: { require_parameters: true },
      stream: false,
    }),
  });
  if (!response.ok) return responseError(response);

  const payload = await response.json() as { choices?: Array<{ message?: { content?: unknown } }> };
  const content = payload.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new OpenRouterPlanningIntentError(
      "invalid-response",
      "OpenRouter не вернул структурированный результат разбора пожеланий.",
    );
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (cause) {
    throw new OpenRouterPlanningIntentError(
      "invalid-response",
      "OpenRouter вернул некорректный JSON.",
      { cause },
    );
  }

  try {
    return normalizeOpenRouterPlanningIntentPayload(parsed);
  } catch (cause) {
    throw new OpenRouterPlanningIntentError(
      "invalid-response",
      "Ответ OpenRouter не прошёл проверку структуры planning intent.",
      { cause },
    );
  }
}

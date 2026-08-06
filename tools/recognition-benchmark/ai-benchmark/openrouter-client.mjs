const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODEL_URL = "https://openrouter.ai/api/v1/model";
const CONFIDENCE_VALUES = new Set(["high", "medium", "low"]);
const OPENING_KINDS = new Set(["door", "window", "unknown-opening"]);
const WALL_KEYS = new Set(["id", "confidence", "score"]);
const OPENING_KEYS = new Set(["id", "kind", "confidence", "score"]);
const PRICE_KEYS = ["prompt", "completion", "image", "request"];

function exactObject(value, label) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value;
}

function exactKeys(value, allowed, label) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      throw new Error(`${label} contains forbidden geometry or field '${key}'.`);
    }
  }
}

function finiteScore(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    throw new Error(`${label} must be a number between 0 and 1.`);
  }
  return value;
}

function positiveFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
  return value;
}

function candidateId(value, knownIds, label) {
  if (typeof value !== "string" || !knownIds.has(value)) {
    throw new Error(`${label} references unknown candidate '${String(value)}'.`);
  }
  return value;
}

function confidence(value, label) {
  if (typeof value !== "string" || !CONFIDENCE_VALUES.has(value)) {
    throw new Error(`${label} must be high, medium or low.`);
  }
  return value;
}

function stringArray(value, label) {
  if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
    throw new Error(`${label} must be a string array.`);
  }
  return value;
}

function modelLookupUrl(modelId) {
  if (typeof modelId !== "string") throw new Error("modelId must be a string.");
  const separator = modelId.indexOf("/");
  if (separator <= 0 || separator === modelId.length - 1) {
    throw new Error(`Model '${modelId}' must use author/slug format.`);
  }
  return `${OPENROUTER_MODEL_URL}/${encodeURIComponent(modelId.slice(0, separator))}/${encodeURIComponent(modelId.slice(separator + 1))}`;
}

function normalizeProviderMaxPrice(value) {
  const input = exactObject(value, "providerMaxPrice");
  return Object.freeze(Object.fromEntries(
    PRICE_KEYS.map((key) => [key, positiveFinite(input[key], `providerMaxPrice.${key}`)]),
  ));
}

function normalizeModelDescriptor(payload, requestedModelId) {
  const root = exactObject(payload, "OpenRouter model response");
  const model = exactObject(root.data, "OpenRouter model response.data");
  if (typeof model.id !== "string" || model.id.length === 0) {
    throw new Error("OpenRouter model response.data.id must be a non-empty string.");
  }
  if (!Number.isInteger(model.context_length) || model.context_length <= 0) {
    throw new Error(`Model '${requestedModelId}' has no bounded context length.`);
  }
  const architecture = exactObject(model.architecture, `Model '${requestedModelId}' architecture`);
  const inputModalities = stringArray(architecture.input_modalities, `Model '${requestedModelId}' input modalities`);
  const outputModalities = stringArray(architecture.output_modalities, `Model '${requestedModelId}' output modalities`);
  if (!inputModalities.includes("text") || !inputModalities.includes("image")) {
    throw new Error(`Model '${requestedModelId}' must accept text and image input.`);
  }
  if (!outputModalities.includes("text")) {
    throw new Error(`Model '${requestedModelId}' must produce text output.`);
  }
  const supportedParameters = new Set(stringArray(
    model.supported_parameters,
    `Model '${requestedModelId}' supported parameters`,
  ));
  if (!supportedParameters.has("max_tokens")) {
    throw new Error(`Model '${requestedModelId}' must support max_tokens.`);
  }
  if (!supportedParameters.has("response_format") && !supportedParameters.has("structured_outputs")) {
    throw new Error(`Model '${requestedModelId}' must support structured output.`);
  }
  const reasoning = model.reasoning == null
    ? null
    : exactObject(model.reasoning, `Model '${requestedModelId}' reasoning`);
  if (reasoning?.mandatory === true) {
    throw new Error(`Model '${requestedModelId}' requires paid reasoning and is not eligible for this benchmark.`);
  }
  const topProvider = model.top_provider == null
    ? null
    : exactObject(model.top_provider, `Model '${requestedModelId}' top provider`);
  const maximumCompletionTokens = Number.isInteger(topProvider?.max_completion_tokens)
    && topProvider.max_completion_tokens > 0
    ? topProvider.max_completion_tokens
    : null;
  return Object.freeze({
    requestedModelId,
    modelId: model.id,
    contextLength: model.context_length,
    maximumCompletionTokens,
    supportsReasoning: supportedParameters.has("reasoning") || reasoning !== null,
  });
}

export function normalizeVerificationResponse(payload, localSummary) {
  const root = exactObject(payload, "AI verification response");
  exactKeys(root, new Set(["walls", "openings"]), "AI verification response");
  if (!Array.isArray(root.walls) || !Array.isArray(root.openings)) {
    throw new Error("AI verification response must contain walls and openings arrays.");
  }
  const knownWallIds = new Set((localSummary?.walls ?? []).map((candidate) => candidate.id));
  const knownOpeningIds = new Set((localSummary?.openings ?? []).map((candidate) => candidate.id));
  const seenWallIds = new Set();
  const seenOpeningIds = new Set();
  const walls = root.walls.map((entry, index) => {
    const item = exactObject(entry, `walls[${index}]`);
    exactKeys(item, WALL_KEYS, `walls[${index}]`);
    const id = candidateId(item.id, knownWallIds, `walls[${index}].id`);
    if (seenWallIds.has(id)) throw new Error(`Duplicate wall id '${id}'.`);
    seenWallIds.add(id);
    return {
      id,
      confidence: confidence(item.confidence, `walls[${index}].confidence`),
      score: finiteScore(item.score, `walls[${index}].score`),
    };
  });
  const openings = root.openings.map((entry, index) => {
    const item = exactObject(entry, `openings[${index}]`);
    exactKeys(item, OPENING_KEYS, `openings[${index}]`);
    const id = candidateId(item.id, knownOpeningIds, `openings[${index}].id`);
    if (seenOpeningIds.has(id)) throw new Error(`Duplicate opening id '${id}'.`);
    seenOpeningIds.add(id);
    if (typeof item.kind !== "string" || !OPENING_KINDS.has(item.kind)) {
      throw new Error(`openings[${index}].kind must be door, window or unknown-opening.`);
    }
    return {
      id,
      kind: item.kind,
      confidence: confidence(item.confidence, `openings[${index}].confidence`),
      score: finiteScore(item.score, `openings[${index}].score`),
    };
  });
  return {
    walls: walls.sort((first, second) => first.id.localeCompare(second.id)),
    openings: openings.sort((first, second) => first.id.localeCompare(second.id)),
  };
}

export function redactAiBenchmarkText(value) {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, "[REDACTED]");
}

function verificationPrompt(localSummary, mode) {
  const walls = (localSummary.walls ?? []).map((candidate) => ({
    id: candidate.id,
    confidence: candidate.confidence,
    conflict: candidate.conflict,
  }));
  const openings = (localSummary.openings ?? []).map((candidate) => ({
    id: candidate.id,
    kind: candidate.kind,
    confidence: candidate.confidence,
    conflict: candidate.conflict,
  }));
  return [
    "Verify only the supplied local floor-plan candidate IDs.",
    "Do not create IDs and do not return coordinates, geometry, dimensions, thickness, host wall or orientation.",
    "Omit candidates that are not supported by the image.",
    mode === "disputed-zones"
      ? "Focus on disputed walls, windows, doors, kitchen fixtures and sanitary symbols."
      : "Review every supplied candidate.",
    JSON.stringify({ walls, openings }),
  ].join("\n");
}

function structuredSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["walls", "openings"],
    properties: {
      walls: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "confidence", "score"],
          properties: {
            id: { type: "string" },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            score: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
      openings: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "kind", "confidence", "score"],
          properties: {
            id: { type: "string" },
            kind: { type: "string", enum: ["door", "window", "unknown-opening"] },
            confidence: { type: "string", enum: ["high", "medium", "low"] },
            score: { type: "number", minimum: 0, maximum: 1 },
          },
        },
      },
    },
  };
}

function withTimeout(externalSignal, timeoutMs) {
  const controller = new AbortController();
  let timedOut = false;
  const relay = () => controller.abort(externalSignal?.reason);
  if (externalSignal?.aborted) relay();
  else externalSignal?.addEventListener("abort", relay, { once: true });
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("AI benchmark request timed out", "TimeoutError"));
  }, timeoutMs);
  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    dispose: () => {
      clearTimeout(timer);
      externalSignal?.removeEventListener("abort", relay);
    },
  };
}

function responseContent(payload) {
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || content.trim().length === 0) {
    throw new Error("OpenRouter returned an empty structured response.");
  }
  return content;
}

function normalizedUsage(value) {
  if (!value || typeof value !== "object") return null;
  const promptTokens = Number.isFinite(value.prompt_tokens) ? value.prompt_tokens : null;
  const completionTokens = Number.isFinite(value.completion_tokens) ? value.completion_tokens : null;
  const totalTokens = Number.isFinite(value.total_tokens) ? value.total_tokens : null;
  const costUsd = Number.isFinite(value.cost) ? value.cost : null;
  return { promptTokens, completionTokens, totalTokens, costUsd };
}

export function createOpenRouterBenchmarkClient({ apiKey, fetcher = globalThis.fetch }) {
  const key = typeof apiKey === "string" ? apiKey.trim() : "";
  if (!key) throw new Error("OPENROUTER_API_KEY is required before any AI benchmark request.");
  if (typeof fetcher !== "function") throw new Error("A fetch implementation is required.");

  const authorizedHeaders = { Authorization: `Bearer ${key}` };
  return Object.freeze({
    async describeModel(input) {
      const bounded = withTimeout(input.signal, input.timeoutMs);
      try {
        const response = await fetcher(modelLookupUrl(input.modelId), {
          method: "GET",
          headers: authorizedHeaders,
          signal: bounded.signal,
        });
        if (!response.ok) {
          const text = redactAiBenchmarkText(await response.text().catch(() => ""));
          throw new Error(`OpenRouter model lookup HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
        }
        return normalizeModelDescriptor(await response.json(), input.modelId);
      } catch (cause) {
        if (bounded.timedOut()) throw new Error(`AI model lookup exceeded ${input.timeoutMs} ms.`, { cause });
        throw new Error(redactAiBenchmarkText(cause instanceof Error ? cause.message : String(cause)), { cause });
      } finally {
        bounded.dispose();
      }
    },

    async verify(input) {
      const bounded = withTimeout(input.signal, input.timeoutMs);
      const startedAt = Date.now();
      try {
        const providerMaxPrice = normalizeProviderMaxPrice(input.providerMaxPrice);
        const body = {
          model: input.modelId,
          messages: [{
            role: "user",
            content: [
              { type: "text", text: verificationPrompt(input.localSummary, input.mode) },
              { type: "image_url", image_url: { url: input.imageDataUrl } },
            ],
          }],
          response_format: {
            type: "json_schema",
            json_schema: {
              name: "vlezet_ai_benchmark_verification",
              strict: true,
              schema: structuredSchema(),
            },
          },
          provider: {
            require_parameters: true,
            allow_fallbacks: false,
            sort: "price",
            max_price: providerMaxPrice,
          },
          ...(input.disableReasoning
            ? { reasoning: { effort: "none", exclude: true } }
            : {}),
          max_tokens: input.maximumTokens,
          stream: false,
        };
        const response = await fetcher(OPENROUTER_URL, {
          method: "POST",
          headers: {
            ...authorizedHeaders,
            "Content-Type": "application/json",
          },
          signal: bounded.signal,
          body: JSON.stringify(body),
        });
        if (!response.ok) {
          const text = redactAiBenchmarkText(await response.text().catch(() => ""));
          throw new Error(`OpenRouter HTTP ${response.status}${text ? `: ${text.slice(0, 300)}` : ""}`);
        }
        const payload = await response.json();
        let parsed;
        try {
          parsed = JSON.parse(responseContent(payload));
        } catch (cause) {
          throw new Error("OpenRouter returned invalid JSON.", { cause });
        }
        return {
          response: normalizeVerificationResponse(parsed, input.localSummary),
          latencyMs: Date.now() - startedAt,
          usage: normalizedUsage(payload.usage),
          modelId: input.modelId,
        };
      } catch (cause) {
        if (bounded.timedOut()) throw new Error(`AI benchmark request exceeded ${input.timeoutMs} ms.`, { cause });
        throw new Error(redactAiBenchmarkText(cause instanceof Error ? cause.message : String(cause)), { cause });
      } finally {
        bounded.dispose();
      }
    },
  });
}

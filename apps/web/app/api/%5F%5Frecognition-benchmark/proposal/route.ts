import {
  AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS,
  DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS,
  type RecognitionAiProposalRequest,
} from "@vlezet/recognition";
import { OpenRouterDirectProvider } from "../../../../components/recognition/openrouter-provider";

export const runtime = "nodejs";

const MAX_REQUEST_BYTES = 40 * 1024 * 1024;
const IMAGE_DATA_URL_PATTERN = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;
const PRICE_KEYS = ["prompt", "completion", "image", "request"] as const;
const BODY_KEYS = ["modelId", "request", "providerMaxPrice", "allocationUsd", "maximumTokens", "maximumPromptTokens", "timeoutMs", "disableReasoning"] as const;
const REQUEST_KEYS = [
  "mode",
  "requestId",
  "referenceRevision",
  "localDraftFingerprint",
  "imageWidthPx",
  "imageHeightPx",
  "sourceImageDataUrl",
  "overlayImageDataUrl",
  "localSummary",
  "budgets",
] as const;

type ProviderMaxPrice = Readonly<Record<typeof PRICE_KEYS[number], number>>;

type LiveProposalBody = Readonly<{
  modelId: string;
  request: RecognitionAiProposalRequest;
  providerMaxPrice: ProviderMaxPrice;
  allocationUsd: number;
  maximumTokens: number;
  maximumPromptTokens: number;
  timeoutMs: number;
  disableReasoning: boolean;
}>;

function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label} must be an object.`);
  }
  return value as Record<string, unknown>;
}

function exactKeys(value: Record<string, unknown>, allowed: readonly string[], label: string): void {
  const expected = [...allowed].sort();
  const actual = Object.keys(value).sort();
  if (actual.length !== expected.length || actual.some((key, index) => key !== expected[index])) {
    throw new Error(`${label} contains unsupported or missing fields.`);
  }
}

function text(value: unknown, label: string, maximum = 240): string {
  if (typeof value !== "string" || !value.trim() || value.trim().length > maximum) {
    throw new Error(`${label} must be a non-empty bounded string.`);
  }
  return value.trim();
}

function positiveFinite(value: unknown, label: string, maximum = Number.POSITIVE_INFINITY): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0 || value > maximum) {
    throw new Error(`${label} must be a positive finite number no greater than ${maximum}.`);
  }
  return value;
}

function boolean(value: unknown, label: string): boolean {
  if (typeof value !== "boolean") throw new Error(`${label} must be a boolean.`);
  return value;
}

function providerMaxPrice(value: unknown): ProviderMaxPrice {
  const input = record(value, "providerMaxPrice");
  const keys = Object.keys(input).sort();
  if (keys.join(",") !== [...PRICE_KEYS].sort().join(",")) {
    throw new Error("providerMaxPrice must contain exactly prompt, completion, image and request.");
  }
  return Object.freeze(Object.fromEntries(
    PRICE_KEYS.map((key) => [key, positiveFinite(input[key], `providerMaxPrice.${key}`)]),
  )) as ProviderMaxPrice;
}

function imageDataUrl(value: unknown, label: string): string {
  const result = text(value, label, 18 * 1024 * 1024);
  if (!IMAGE_DATA_URL_PATTERN.test(result)) throw new Error(`${label} must be a bounded image data URL.`);
  return result;
}

function validateBody(value: unknown): LiveProposalBody {
  const input = record(value, "live proposal request");
  exactKeys(input, BODY_KEYS, "live proposal request");
  const requestRecord = record(input.request, "live proposal request.request");
  exactKeys(requestRecord, REQUEST_KEYS, "live proposal request.request");
  const request = requestRecord as unknown as RecognitionAiProposalRequest;
  if (request.mode !== "proposal-discovery-stage1") {
    throw new Error("Only proposal-discovery-stage1 is supported by this benchmark route.");
  }
  text(request.requestId, "request.requestId", 160);
  text(request.referenceRevision, "request.referenceRevision", 240);
  text(request.localDraftFingerprint, "request.localDraftFingerprint", 96);
  imageDataUrl(request.sourceImageDataUrl, "request.sourceImageDataUrl");
  imageDataUrl(request.overlayImageDataUrl, "request.overlayImageDataUrl");
  const imageWidthPx = positiveInteger(request.imageWidthPx, "request.imageWidthPx", AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS);
  const imageHeightPx = positiveInteger(request.imageHeightPx, "request.imageHeightPx", AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS);
  if (imageWidthPx * imageHeightPx > AI_LOCAL_EVIDENCE_MAX_MASK_PIXELS) {
    throw new Error("Live proposal request exceeds the product pixel budget.");
  }
  if (JSON.stringify(request.budgets) !== JSON.stringify(DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS)) {
    throw new Error("Live proposal request must preserve the exact product Stage 1 budgets.");
  }
  return {
    modelId: text(input.modelId, "modelId", 240),
    request,
    providerMaxPrice: providerMaxPrice(input.providerMaxPrice),
    allocationUsd: positiveFinite(input.allocationUsd, "allocationUsd", 5),
    maximumTokens: positiveInteger(input.maximumTokens, "maximumTokens", request.budgets.maxTokens),
    maximumPromptTokens: positiveInteger(
      input.maximumPromptTokens,
      "maximumPromptTokens",
      10_000_000,
    ),
    timeoutMs: positiveInteger(input.timeoutMs, "timeoutMs", 90_000),
    disableReasoning: boolean(input.disableReasoning, "disableReasoning"),
  };
}

function positiveInteger(value: unknown, label: string, maximum: number): number {
  if (!Number.isInteger(value) || (value as number) <= 0 || (value as number) > maximum) {
    throw new Error(`${label} must be an integer between 1 and ${maximum}.`);
  }
  return value as number;
}

function finiteInteger(value: unknown): number | null {
  return Number.isInteger(value) && (value as number) >= 0 ? value as number : null;
}

function finiteCost(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) && value >= 0 ? value : null;
}

function redact(value: unknown): string {
  return String(value)
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/sk-or-v1-[A-Za-z0-9_-]+/gi, "[REDACTED]")
    .replace(/sk-[A-Za-z0-9_-]{12,}/gi, "[REDACTED]");
}

function jsonResponse(value: unknown, status = 200): Response {
  return new Response(JSON.stringify(value), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}

export async function POST(request: Request): Promise<Response> {
  if (process.env.RECOGNITION_BENCHMARK_HARNESS !== "1") {
    return jsonResponse({ error: "Not found." }, 404);
  }
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return jsonResponse({ error: "OPENROUTER_API_KEY is required; no paid request was sent." }, 503);
  }

  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).byteLength > MAX_REQUEST_BYTES) {
      return jsonResponse({ error: "Live proposal request exceeds the safe body limit." }, 413);
    }
    const input = validateBody(JSON.parse(raw));
    const maximumBoundedCostUsd =
      input.providerMaxPrice.prompt * input.maximumPromptTokens / 1_000_000
      + input.providerMaxPrice.completion * input.maximumTokens / 1_000_000
      + input.providerMaxPrice.image * 2
      + input.providerMaxPrice.request;
    if (maximumBoundedCostUsd > input.allocationUsd + Number.EPSILON) {
      return jsonResponse({ error: "Provider max-price bounds exceed the per-request hard cost allocation." }, 400);
    }
    const resolvedModelIds = new Set<string>();
    const safetyViolations: string[] = [];
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;
    let costUsd = 0;
    let completeUsage = true;

    const boundedFetcher: typeof fetch = async (url, init) => {
      if (typeof init?.body !== "string") throw new Error("OpenRouter proposal request body is unavailable.");
      const body = record(JSON.parse(init.body), "OpenRouter proposal body");
      body.provider = {
        ...record(body.provider, "OpenRouter proposal body.provider"),
        require_parameters: true,
        allow_fallbacks: false,
        sort: "price",
        max_price: input.providerMaxPrice,
      };
      body.max_tokens = input.maximumTokens;
      if (input.disableReasoning) {
        body.reasoning = { effort: "none", exclude: true };
      }
      const response = await fetch(url, { ...init, body: JSON.stringify(body) });
      if (response.ok) {
        const payload = await response.clone().json().catch(() => null) as Record<string, unknown> | null;
        const usage = payload?.usage && typeof payload.usage === "object" && !Array.isArray(payload.usage)
          ? payload.usage as Record<string, unknown>
          : null;
        const currentPrompt = finiteInteger(usage?.prompt_tokens);
        const currentCompletion = finiteInteger(usage?.completion_tokens);
        const currentTotal = finiteInteger(usage?.total_tokens);
        const currentCost = finiteCost(usage?.cost);
        if (
          currentPrompt === null
          || currentCompletion === null
          || currentTotal === null
          || currentTotal < currentPrompt + currentCompletion
          || currentCost === null
        ) {
          completeUsage = false;
        } else {
          promptTokens += currentPrompt;
          completionTokens += currentCompletion;
          totalTokens += currentTotal;
          costUsd += currentCost;
        }
        if (typeof payload?.model === "string" && payload.model.trim()) {
          resolvedModelIds.add(payload.model.trim());
        } else {
          safetyViolations.push("missing-resolved-provider-model");
        }
      }
      return response;
    };

    const provider = new OpenRouterDirectProvider({
      apiKey,
      modelId: input.modelId,
      fetcher: boundedFetcher,
      timeoutMs: input.timeoutMs,
    });
    const envelope = await provider.recognizeProposals(input.request, request.signal);
    if (resolvedModelIds.size !== 1) safetyViolations.push("unstable-resolved-provider-route");
    if (completeUsage && costUsd > input.allocationUsd + Number.EPSILON) {
      safetyViolations.push("hard-cost-allocation-exceeded");
    }

    return jsonResponse({
      batch: envelope.batch,
      providerId: envelope.providerId,
      modelId: envelope.modelId,
      latencyMs: envelope.latencyMs,
      attemptCount: envelope.attemptCount,
      usage: completeUsage
        ? { promptTokens, completionTokens, totalTokens, costUsd }
        : null,
      providerRoute: {
        providerId: envelope.providerId,
        requestedModelId: input.modelId,
        resolvedModelId: resolvedModelIds.size === 1
          ? [...resolvedModelIds][0]
          : "unresolved-provider-route",
        fallbacksAllowed: false,
        reasoningDisabled: true,
      },
      safetyViolations,
    });
  } catch (cause) {
    return jsonResponse({
      error: redact(cause instanceof Error ? cause.message : String(cause)),
    }, 400);
  }
}

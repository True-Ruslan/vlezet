import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS,
  type RecognitionAiProposalRequest,
} from "@vlezet/recognition";
import {
  OPENROUTER_PROPOSAL_MAX_ATTEMPTS,
  OPENROUTER_PROPOSAL_MAX_RESPONSE_BYTES,
  OPENROUTER_PROPOSAL_MAX_TOKENS,
  OPENROUTER_PROPOSAL_PRIMARY_TIMEOUT_MS,
  OPENROUTER_PROPOSAL_SCHEMA_REPAIR_TIMEOUT_MS,
  OpenRouterDirectProvider,
} from "./openrouter-provider";
import {
  normalizeOpenRouterProposalPayload,
  OPENROUTER_PROPOSAL_JSON_SCHEMA,
} from "./openrouter-proposal-schema";

const signal = new AbortController().signal;
const fingerprint = `recognition-local-draft-v1:${"a".repeat(64)}`;

function request(overrides: Partial<RecognitionAiProposalRequest> = {}): RecognitionAiProposalRequest {
  return {
    mode: "proposal-discovery-stage1",
    requestId: "request-1",
    referenceRevision: "revision-1",
    localDraftFingerprint: fingerprint,
    imageWidthPx: 1200,
    imageHeightPx: 800,
    sourceImageDataUrl: "data:image/png;base64,U09VUkNF",
    overlayImageDataUrl: "data:image/png;base64,T1ZFUkxBWQ==",
    localSummary: {
      activeWallIds: ["wall-1"],
      planBounds: { x: 0.1, y: 0.1, width: 0.8, height: 0.8 },
      walls: [{
        id: "wall-1",
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 18,
        confidence: "high",
        conflict: null,
        localScore: 0.94,
        reasonCodes: ["parallel-edges"],
      }],
      openings: [],
      doorEvidence: [],
      windowEvidence: [],
      clutterEvidence: [],
    },
    budgets: DEFAULT_RECOGNITION_AI_PROPOSAL_BUDGETS,
    ...overrides,
  };
}

function validProviderBatch(overrides: Record<string, unknown> = {}) {
  return {
    schemaVersion: "recognition-ai-proposals-v1",
    requestId: "request-1",
    referenceRevision: "revision-1",
    localDraftFingerprint: fingerprint,
    proposals: [{
      id: "door-proposal-1",
      kind: "opening-addition",
      openingKind: "door",
      center: { x: 5000, y: 2000 },
      widthNormalized: 800,
      orientationDeg: 0,
      hostWallHintIds: ["wall-1"],
      sourceRegion: { x: 4500, y: 1700, width: 1000, height: 600 },
      modelConfidence: 0.82,
      reasonCodes: ["visible-gap", "door-leaf"],
    }],
    diagnostics: [],
    ...overrides,
  };
}

function completion(content: string, usage = { prompt_tokens: 100, completion_tokens: 50, total_tokens: 150 }): Response {
  return new Response(JSON.stringify({
    id: "generation-1",
    choices: [{ message: { content } }],
    usage,
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describe("bounded OpenRouter Stage 1 proposal mode", () => {
  it("locks exact time, attempt, byte and token budgets", () => {
    expect(OPENROUTER_PROPOSAL_PRIMARY_TIMEOUT_MS).toBe(45_000);
    expect(OPENROUTER_PROPOSAL_SCHEMA_REPAIR_TIMEOUT_MS).toBe(15_000);
    expect(OPENROUTER_PROPOSAL_MAX_ATTEMPTS).toBe(2);
    expect(OPENROUTER_PROPOSAL_MAX_RESPONSE_BYTES).toBe(96 * 1024);
    expect(OPENROUTER_PROPOSAL_MAX_TOKENS).toBe(4096);
  });

  it("sends exactly source and overlay images with a strict Stage 1 schema", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const images = body.messages[0].content.filter((item: { type: string }) => item.type === "image_url");
      expect(images).toEqual([
        { type: "image_url", image_url: { url: "data:image/png;base64,U09VUkNF" } },
        { type: "image_url", image_url: { url: "data:image/png;base64,T1ZFUkxBWQ==" } },
      ]);
      expect(body.model).toBe("vision/model");
      expect(body.temperature).toBe(0);
      expect(body.stream).toBe(false);
      expect(body.max_tokens).toBe(4096);
      expect(body.response_format).toMatchObject({
        type: "json_schema",
        json_schema: { strict: true, schema: OPENROUTER_PROPOSAL_JSON_SCHEMA },
      });
      expect(body.response_format.json_schema.schema.properties).not.toHaveProperty("walls");
      expect(body.response_format.json_schema.schema.properties).not.toHaveProperty("roomLabels");
      return completion(JSON.stringify(validProviderBatch()));
    });
    const provider = new OpenRouterDirectProvider({
      apiKey: "secret-key",
      modelId: "vision/model",
      fetcher: fetcher as unknown as typeof fetch,
    });

    const envelope = await provider.recognizeProposals(request(), signal);

    expect(envelope.batch.proposals[0]).toMatchObject({
      kind: "opening-addition",
      openingKind: "door",
      center: { x: 0.5, y: 0.2 },
      widthNormalized: 0.08,
    });
    expect(envelope).toMatchObject({
      providerId: "openrouter-direct",
      modelId: "vision/model",
      attemptCount: 1,
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
    });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects legacy geometry, labels and Stage 2 proposal types", () => {
    expect(() => normalizeOpenRouterProposalPayload({
      ...validProviderBatch(),
      walls: [],
    })).toThrow();
    expect(() => normalizeOpenRouterProposalPayload({
      ...validProviderBatch(),
      roomLabels: [],
    })).toThrow();
    expect(() => normalizeOpenRouterProposalPayload({
      ...validProviderBatch(),
      proposals: [{
        id: "thin-wall-1",
        kind: "thin-wall-addition",
        start: { x: 1000, y: 1000 },
        end: { x: 5000, y: 1000 },
      }],
    })).toThrow();
  });

  it("performs one text-only schema repair with the same model and provider", async () => {
    const bodies: unknown[] = [];
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      bodies.push(body);
      return bodies.length === 1
        ? completion('{"schemaVersion":')
        : completion(JSON.stringify(validProviderBatch()));
    });
    const provider = new OpenRouterDirectProvider({
      apiKey: "secret-key",
      modelId: "vision/model",
      fetcher: fetcher as unknown as typeof fetch,
    });

    const envelope = await provider.recognizeProposals(request(), signal);

    expect(envelope.attemptCount).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const repair = bodies[1] as {
      model: string;
      provider: unknown;
      messages: Array<{ content: Array<{ type: string; text?: string }> }>;
    };
    expect(repair.model).toBe("vision/model");
    expect(repair.provider).toEqual((bodies[0] as { provider: unknown }).provider);
    expect(repair.messages[0].content.filter((item) => item.type === "image_url")).toEqual([]);
    expect(repair.messages[0].content[0]?.text).toContain("schema-repair");
  });

  it("does not repair semantic identity mismatches", async () => {
    const fetcher = vi.fn(async () => completion(JSON.stringify(validProviderBatch({ requestId: "request-other" }))));
    const provider = new OpenRouterDirectProvider({
      apiKey: "key",
      modelId: "vision/model",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(provider.recognizeProposals(request(), signal)).rejects.toMatchObject({ code: "invalid-response" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("rejects an oversized HTTP response before JSON parsing", async () => {
    const oversized = "x".repeat(OPENROUTER_PROPOSAL_MAX_RESPONSE_BYTES + 1);
    const fetcher = vi.fn(async () => new Response(oversized, { status: 200 }));
    const provider = new OpenRouterDirectProvider({
      apiKey: "key",
      modelId: "vision/model",
      fetcher: fetcher as unknown as typeof fetch,
    });

    await expect(provider.recognizeProposals(request(), signal)).rejects.toMatchObject({ code: "invalid-response" });
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it("redacts API key, authorization, image data and raw provider body from failures and logs", async () => {
    const rawSecret = "RAW_PROVIDER_SECRET";
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ error: rawSecret }), { status: 429 }));
    const provider = new OpenRouterDirectProvider({
      apiKey: "top-secret-key",
      modelId: "vision/model",
      fetcher: fetcher as unknown as typeof fetch,
    });

    let captured: unknown;
    try {
      await provider.recognizeProposals(request({
        sourceImageDataUrl: "data:image/png;base64,SENSITIVE_SOURCE",
      }), signal);
    } catch (error) {
      captured = error;
    }

    expect(captured).toMatchObject({ code: "rate-limit" });
    const serialized = JSON.stringify({
      message: captured instanceof Error ? captured.message : String(captured),
      logs: consoleError.mock.calls,
    });
    expect(serialized).not.toContain("top-secret-key");
    expect(serialized).not.toContain("Authorization");
    expect(serialized).not.toContain("SENSITIVE_SOURCE");
    expect(serialized).not.toContain(rawSecret);
  });

  it("maps the primary proposal timeout without a repair attempt", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({ apiKey: "key", modelId: "vision/model", fetcher });
    const pending = provider.recognizeProposals(request(), signal);
    const rejection = expect(pending).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(OPENROUTER_PROPOSAL_PRIMARY_TIMEOUT_MS);
    await rejection;
    expect(fetcher).toHaveBeenCalledOnce();
  });
});

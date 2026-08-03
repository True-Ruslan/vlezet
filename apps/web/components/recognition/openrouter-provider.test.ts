import { afterEach, describe, expect, it, vi } from "vitest";
import { OpenRouterDirectProvider, listCompatibleOpenRouterModels } from "./openrouter-provider";

const signal = new AbortController().signal;
const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.useRealTimers();
  vi.stubGlobal("fetch", originalFetch);
});

function successfulDiscoveryResponse(
  wallId = "w1",
  openings: readonly Record<string, unknown>[] = [],
): Response {
  return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
    walls: [{ id: wallId, start: { x: 1000, y: 2000 }, end: { x: 9000, y: 2000 }, estimatedThicknessPx: 20, confidence: "high", score: 0.95 }],
    openings,
    roomLabels: [],
  }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function localSummary() {
  return {
    walls: [{
      id: "local-wall-1",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 20,
      confidence: "medium" as const,
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["structural-region"] },
      origin: "local" as const,
      conflict: null,
    }],
    openings: [{
      id: "local-opening-1",
      kind: "unknown-opening" as const,
      hostWallCandidateId: "local-wall-1",
      center: { x: 0.5, y: 0.2 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "low" as const,
      evidence: { localScore: 0.62, cloudScore: null, reasons: ["wall-gap"] },
      origin: "local" as const,
      conflict: null,
    }],
  };
}

describe("OpenRouter direct recognition provider", () => {
  it("uses strict structured output, response healing, image input and request-only bearer key", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer secret-key");
      expect(JSON.stringify(body)).not.toContain("secret-key");
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.strict).toBe(true);
      expect(body.plugins).toEqual([{ id: "response-healing" }]);
      expect(body.provider.require_parameters).toBe(true);
      expect(body.messages[0].content[0].type).toBe("text");
      expect(body.messages[0].content[1]).toEqual({ type: "image_url", image_url: { url: "data:image/png;base64,AAAA" } });
      return successfulDiscoveryResponse();
    });

    const provider = new OpenRouterDirectProvider({ apiKey: "secret-key", modelId: "vision/model", fetcher: fetcher as unknown as typeof fetch });
    const result = await provider.recognize({ imageDataUrl: "data:image/png;base64,AAAA", imageWidthPx: 1000, imageHeightPx: 800, localSummary: null }, signal);
    expect(result.walls[0]?.start).toEqual({ x: 0.1, y: 0.2 });
    expect(fetcher).toHaveBeenCalledWith("https://openrouter.ai/api/v1/chat/completions", expect.objectContaining({ method: "POST", signal: expect.any(AbortSignal) }));
  });

  it("uses a compact verification response and reconstructs immutable local geometry by id", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      const prompt = String(body.messages[0].content[0].text);
      expect(prompt).toContain("Режим: только проверка локального Draft");
      expect(prompt).toContain("Не добавляй новые стены");
      expect(prompt).toContain("Не добавляй новые проёмы");
      expect(prompt).toContain("local-wall-1: start=(1000,2000), end=(9000,2000)");
      expect(prompt).toContain("local-opening-1: kind=unknown-opening, hostWallId=local-wall-1, center=(5000,2000)");
      expect(prompt).not.toContain("thicknessPx=");
      expect(prompt).not.toContain("widthPx=");
      expect(body.response_format.json_schema.schema.properties.walls.items.required).toEqual(["id", "confidence", "score"]);
      expect(body.response_format.json_schema.schema.properties.openings.items.required).toEqual(["id", "kind", "confidence", "score"]);
      expect(body.max_tokens).toBeLessThanOrEqual(2048);
      return new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({
        walls: [{ id: "local-wall-1", confidence: "high", score: 0.95 }],
        openings: [{ id: "local-opening-1", kind: "door", confidence: "high", score: 0.88 }],
      }) } }] }), { status: 200, headers: { "Content-Type": "application/json" } });
    });

    const provider = new OpenRouterDirectProvider({ apiKey: "secret-key", modelId: "vision/model", fetcher: fetcher as unknown as typeof fetch });
    const result = await provider.recognize({
      imageDataUrl: "data:image/png;base64,AAAA",
      imageWidthPx: 1000,
      imageHeightPx: 800,
      localSummary: localSummary(),
    }, signal);

    expect(result.walls[0]).toMatchObject({
      id: "local-wall-1",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 20,
      confidence: "high",
    });
    expect(result.openings[0]).toMatchObject({
      id: "local-opening-1",
      kind: "door",
      hostWallCandidateId: "local-wall-1",
      center: { x: 0.5, y: 0.2 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "high",
    });
  });

  it("bounds a stalled AI verification request with a product-safe timeout", async () => {
    vi.useFakeTimers();
    const fetcher = vi.fn((_url: string | URL | Request, init?: RequestInit) => new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")), { once: true });
    })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({ apiKey: "key", modelId: "vision/model", fetcher, timeoutMs: 1000 });
    const pending = provider.recognize({
      imageDataUrl: "data:image/png;base64,AAAA",
      imageWidthPx: 1000,
      imageHeightPx: 800,
      localSummary: localSummary(),
    }, signal);
    const rejection = expect(pending).rejects.toMatchObject({ code: "timeout" });

    await vi.advanceTimersByTimeAsync(1000);
    await rejection;
  });

  it("preserves the browser receiver when using native global fetch", async () => {
    const receiverSensitiveFetch = vi.fn(function (this: unknown, _url: string | URL | Request, _init?: RequestInit) {
      if (this !== globalThis) throw new TypeError("Failed to execute 'fetch' on 'Window': Illegal invocation");
      return Promise.resolve(successfulDiscoveryResponse());
    });
    vi.stubGlobal("fetch", receiverSensitiveFetch as unknown as typeof fetch);

    const provider = new OpenRouterDirectProvider({ apiKey: "secret-key", modelId: "vision/model" });
    const result = await provider.recognize({ imageDataUrl: "data:image/png;base64,AAAA", imageWidthPx: 1000, imageHeightPx: 800, localSummary: null }, signal);

    expect(result.walls).toHaveLength(1);
    expect(receiverSensitiveFetch).toHaveBeenCalledOnce();
  });

  it("filters discovered models to image + structured output capabilities and requests low-cost ordering", async () => {
    const fetcherSpy = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ data: [
      { id: "good", name: "Good", context_length: 100000, architecture: { input_modalities: ["text", "image"] }, supported_parameters: ["structured_outputs", "response_format"] },
      { id: "text-only", name: "Text", architecture: { input_modalities: ["text"] }, supported_parameters: ["structured_outputs"] },
      { id: "vision-json-object", name: "No schema", architecture: { input_modalities: ["image", "text"] }, supported_parameters: ["temperature"] },
    ] }), { status: 200 }));
    const models = await listCompatibleOpenRouterModels("key", signal, fetcherSpy as unknown as typeof fetch);
    expect(models).toEqual([{ id: "good", name: "Good", contextLength: 100000 }]);
    expect(String(fetcherSpy.mock.calls[0]?.[0])).toContain("sort=pricing-low-to-high");
  });

  it("maps payment failures to a product-safe error", async () => {
    const fetcher = vi.fn(async () => new Response("payment required", { status: 402 })) as unknown as typeof fetch;
    const provider = new OpenRouterDirectProvider({ apiKey: "key", modelId: "vision/model", fetcher });
    await expect(provider.recognize({ imageDataUrl: "data:image/png;base64,AAAA", imageWidthPx: 1, imageHeightPx: 1, localSummary: null }, signal)).rejects.toMatchObject({ code: "insufficient-funds" });
  });
});

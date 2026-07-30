import { afterEach, describe, expect, it, vi } from "vitest";
import {
  OpenRouterPlanningIntentError,
  interpretPlanningIntentWithOpenRouter,
  listCompatibleOpenRouterTextModels,
} from "./openrouter-intent-provider";

const signal = new AbortController().signal;
const originalFetch = globalThis.fetch;

afterEach(() => {
  vi.stubGlobal("fetch", originalFetch);
});

function successfulIntentResponse(): Response {
  return new Response(JSON.stringify({
    choices: [{
      message: {
        content: JSON.stringify({
          clauses: [{ kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" }],
          unsupportedFragments: [],
          warnings: [],
        }),
      },
    }],
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

describe("OpenRouter planning intent provider", () => {
  it("uses strict text-only structured output and a request-only bearer key", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      const body = JSON.parse(String(init?.body));
      expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer runtime-key");
      expect(JSON.stringify(body)).not.toContain("runtime-key");
      expect(body.response_format.type).toBe("json_schema");
      expect(body.response_format.json_schema.strict).toBe(true);
      expect(body.provider.require_parameters).toBe(true);
      expect(body.messages[0].content).toEqual(expect.any(String));
      expect(JSON.stringify(body)).not.toMatch(/image_url|coordinate|position|rotation|placement|geometry/i);
      return successfulIntentResponse();
    });

    const result = await interpretPlanningIntentWithOpenRouter({
      apiKey: "runtime-key",
      modelId: "text/model",
      requestText: "Диван не двигать",
      roomObjects: [{ id: "sofa", name: "Диван" }],
      signal,
      fetcher: fetcher as unknown as typeof fetch,
    });

    expect(result.clauses).toEqual([
      { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
    ]);
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({ method: "POST", signal }),
    );
  });

  it("preserves the browser receiver when using native global fetch", async () => {
    const receiverSensitiveFetch = vi.fn(function (this: unknown) {
      if (this !== globalThis) throw new TypeError("Illegal invocation");
      return Promise.resolve(successfulIntentResponse());
    });
    vi.stubGlobal("fetch", receiverSensitiveFetch as unknown as typeof fetch);

    const result = await interpretPlanningIntentWithOpenRouter({
      apiKey: "key",
      modelId: "text/model",
      requestText: "Диван не двигать",
      roomObjects: [{ id: "sofa", name: "Диван" }],
      signal,
    });

    expect(result.clauses).toHaveLength(1);
    expect(receiverSensitiveFetch).toHaveBeenCalledOnce();
  });

  it("discovers text models with structured-output support in low-cost order", async () => {
    const fetcher = vi.fn(async (_url: string | URL | Request) => new Response(JSON.stringify({ data: [
      {
        id: "good",
        name: "Good",
        context_length: 100000,
        architecture: { input_modalities: ["text"] },
        supported_parameters: ["structured_outputs", "response_format"],
      },
      {
        id: "vision-only",
        name: "Vision",
        architecture: { input_modalities: ["image"] },
        supported_parameters: ["structured_outputs"],
      },
      {
        id: "text-no-schema",
        name: "No schema",
        architecture: { input_modalities: ["text"] },
        supported_parameters: ["temperature"],
      },
    ] }), { status: 200 }));

    const models = await listCompatibleOpenRouterTextModels(
      "key",
      signal,
      fetcher as unknown as typeof fetch,
    );

    expect(models).toEqual([{ id: "good", name: "Good", contextLength: 100000 }]);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("input_modalities=text");
    expect(String(fetcher.mock.calls[0]?.[0])).toContain("sort=pricing-low-to-high");
  });

  it.each([
    [401, "invalid-key"],
    [402, "insufficient-funds"],
    [429, "rate-limit"],
  ] as const)("maps HTTP %s to %s", async (status, code) => {
    const fetcher = vi.fn(async () => new Response("failure", { status })) as unknown as typeof fetch;
    await expect(interpretPlanningIntentWithOpenRouter({
      apiKey: "key",
      modelId: "text/model",
      requestText: "Диван не двигать",
      roomObjects: [{ id: "sofa", name: "Диван" }],
      signal,
      fetcher,
    })).rejects.toMatchObject<Partial<OpenRouterPlanningIntentError>>({ code });
  });

  it("rejects an empty request before a network call", async () => {
    const fetcher = vi.fn();
    await expect(interpretPlanningIntentWithOpenRouter({
      apiKey: "key",
      modelId: "text/model",
      requestText: "   ",
      roomObjects: [{ id: "sofa", name: "Диван" }],
      signal,
      fetcher: fetcher as unknown as typeof fetch,
    })).rejects.toMatchObject({ code: "invalid-request" });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

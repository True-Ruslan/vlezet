import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { validateAiBenchmarkConfig } from "../../../tools/recognition-benchmark/ai-benchmark/config.mjs";
import { runAiBenchmark } from "../../../tools/recognition-benchmark/ai-benchmark/run.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createFixtureWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "vlezet-ai-cost-boundary-"));
  temporaryDirectories.push(root);
  const fixturesRoot = join(root, "fixtures");
  const predictionsRoot = join(root, "predictions");
  const fixtureDirectory = join(fixturesRoot, "public-fixture");
  mkdirSync(fixtureDirectory, { recursive: true });
  mkdirSync(predictionsRoot, { recursive: true });
  writeFileSync(join(fixtureDirectory, "source.png"), Buffer.from([137, 80, 78, 71]));
  writeFileSync(join(fixtureDirectory, "fixture.json"), JSON.stringify({
    fixtureId: "public-fixture",
    calibration: {
      sourceWidthPx: 1_000,
      sourceHeightPx: 600,
      millimetersPerPixel: 10,
      originPx: { x: 0, y: 0 },
    },
    expectedOpenings: [],
  }));
  writeFileSync(join(predictionsRoot, "public-fixture.json"), JSON.stringify({
    walls: [],
    openings: [],
  }));
  return {
    fixturesRoot,
    predictionsRoot,
    outputPath: join(root, "recognition-ai-benchmark.json"),
  };
}

function jsonResponse(body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

describe("manual AI benchmark hard cost boundary", () => {
  it("preflights model context and sends every paid request through a no-fallback max-price allocation", async () => {
    const workspace = createFixtureWorkspace();
    const fetcher = vi.fn(async (_url: string | URL | Request, init?: RequestInit) => {
      if ((init?.method ?? "GET") === "GET") {
        return jsonResponse({
          data: {
            id: "google/gemini-2.5-flash",
            context_length: 1_000_000,
            architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
            supported_parameters: ["max_tokens", "response_format", "structured_outputs", "reasoning"],
            reasoning: { mandatory: false },
          },
        });
      }
      return jsonResponse({
        provider: "bounded-provider",
        choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) } }],
        usage: { prompt_tokens: 100, completion_tokens: 10, total_tokens: 110, cost: 0.001 },
      });
    });

    await runAiBenchmark({
      config: validateAiBenchmarkConfig({
        modelIds: ["google/gemini-2.5-flash"],
        fixtureIds: ["public-fixture"],
        repetitions: 1,
        maximumTokens: 100,
        timeoutMs: 10_000,
        maximumCostUsd: 1,
        mode: "verification",
      }),
      fixturesRoot: workspace.fixturesRoot,
      predictionsRoot: workspace.predictionsRoot,
      outputPath: workspace.outputPath,
      apiKey: "test-key",
      fetcher,
      commitSha: "cost-boundary-red",
    });

    expect(fetcher).toHaveBeenCalledTimes(2);
    const [modelUrl, modelInit] = fetcher.mock.calls[0]!;
    expect(String(modelUrl)).toContain("/api/v1/model/google/gemini-2.5-flash");
    expect(modelInit?.method ?? "GET").toBe("GET");

    const [, paidInit] = fetcher.mock.calls[1]!;
    expect(paidInit?.method).toBe("POST");
    const request = JSON.parse(String(paidInit?.body));
    expect(request.reasoning).toEqual({ effort: "none", exclude: true });
    expect(request.provider).toMatchObject({
      require_parameters: true,
      allow_fallbacks: false,
      sort: "price",
      max_price: {
        prompt: expect.any(Number),
        completion: expect.any(Number),
        image: expect.any(Number),
        request: expect.any(Number),
      },
    });
    const maximumPromptTokens = 1_000_000 - 100;
    const maximumRequestCost = request.provider.max_price.prompt * maximumPromptTokens / 1_000_000
      + request.provider.max_price.completion * 100 / 1_000_000
      + request.provider.max_price.image
      + request.provider.max_price.request;
    expect(maximumRequestCost).toBeLessThanOrEqual(1);

    const artifact = readFileSync(workspace.outputPath, "utf8");
    expect(artifact).not.toMatch(/test-key|Authorization|rawProviderResponse|data:image|base64/i);
  });
});

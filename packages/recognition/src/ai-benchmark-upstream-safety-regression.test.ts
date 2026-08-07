import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { validateAiBenchmarkConfig } from "../../../tools/recognition-benchmark/ai-benchmark/config.mjs";
import type {
  AiBenchmarkFetchInit,
  AiBenchmarkFetcher,
} from "../../../tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs";
import { runAiBenchmark } from "../../../tools/recognition-benchmark/ai-benchmark/run.mjs";

const temporaryDirectories: string[] = [];

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) {
    rmSync(directory, { recursive: true, force: true });
  }
});

function createFixtureWorkspace() {
  const root = mkdtempSync(join(tmpdir(), "vlezet-ai-upstream-safety-"));
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

function modelResponse() {
  return new Response(JSON.stringify({
    data: {
      id: "google/gemini-2.5-flash",
      context_length: 1_000_000,
      architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
      supported_parameters: ["max_tokens", "response_format", "structured_outputs", "reasoning"],
      reasoning: { mandatory: false },
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function verificationResponse(cost: number | null) {
  return new Response(JSON.stringify({
    choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) } }],
    usage: {
      prompt_tokens: 100,
      completion_tokens: 10,
      total_tokens: 110,
      ...(cost === null ? {} : { cost }),
    },
  }), { status: 200, headers: { "Content-Type": "application/json" } });
}

function config(maximumCostUsd = 1) {
  return validateAiBenchmarkConfig({
    modelIds: ["google/gemini-2.5-flash"],
    fixtureIds: ["public-fixture"],
    repetitions: 3,
    maximumTokens: 100,
    timeoutMs: 10_000,
    maximumCostUsd,
    mode: "verification",
  });
}

describe("upstream AI benchmark safety guards", () => {
  it("stops paid execution when observed usage cost is unavailable", async () => {
    const workspace = createFixtureWorkspace();
    let paidCalls = 0;
    const fetcher: AiBenchmarkFetcher = async (_url, init) => {
      if ((init?.method ?? "GET") === "GET") return modelResponse();
      paidCalls += 1;
      return verificationResponse(null);
    };

    const report = await runAiBenchmark({
      config: config(),
      fixturesRoot: workspace.fixturesRoot,
      predictionsRoot: workspace.predictionsRoot,
      outputPath: workspace.outputPath,
      apiKey: "test-key",
      fetcher,
      commitSha: "upstream-safety-red",
    }) as { execution?: unknown };

    expect(paidCalls).toBe(1);
    expect(report.execution).toEqual({
      plannedRunCount: 3,
      completedRunCount: 1,
      maximumCostUsd: 1,
      observedCostUsd: 0,
      complete: false,
      stopReason: "usage-cost-missing",
    });
    expect(JSON.parse(readFileSync(workspace.outputPath, "utf8")).execution).toEqual(report.execution);
  });

  it("caps dynamic provider prices by the immutable prompt and completion ceilings", async () => {
    const workspace = createFixtureWorkspace();
    const requestBodies: Record<string, unknown>[] = [];
    const fetcher: AiBenchmarkFetcher = async (_url, init) => {
      if ((init?.method ?? "GET") === "GET") return modelResponse();
      requestBodies.push(JSON.parse(String(init?.body)) as Record<string, unknown>);
      return verificationResponse(0.001);
    };

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
    });

    const requestBody = requestBodies.at(-1);
    const provider = requestBody?.provider as { max_price?: { prompt?: number; completion?: number }; data_collection?: string } | undefined;
    expect(provider?.max_price?.prompt).toBeLessThanOrEqual(3);
    expect(provider?.max_price?.completion).toBeLessThanOrEqual(15);
    expect(provider?.data_collection).toBe("deny");
  });

  it("keeps verification qualification in the manual workflow beside Stage 1 qualification", () => {
    const workflow = readFileSync(
      new URL("../../../.github/workflows/recognition-ai-benchmark.yml", import.meta.url),
      "utf8",
    );
    expect(workflow).toContain("Evaluate verification benchmark qualification");
    expect(workflow).toContain("benchmark:recognition:ai-qualify");
    expect(workflow).toContain("recognition-ai-verification-qualification.md");
    expect(workflow).toContain("inputs.mode != 'proposal-discovery-stage1'");
    expect(workflow).toContain("tools/recognition-benchmark/artifacts/ai/*.md");
  });
});

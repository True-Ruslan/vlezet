import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { runAiBenchmark } from "../../../tools/recognition-benchmark/ai-benchmark/run.mjs";

const temporaryRoots: string[] = [];

async function prepareWorkspace(): Promise<Readonly<{
  root: string;
  fixturesRoot: string;
  predictionsRoot: string;
  outputPath: string;
}>> {
  const root = await mkdtemp(join(tmpdir(), "vlezet-ai-cost-bound-"));
  temporaryRoots.push(root);
  const fixturesRoot = join(root, "fixtures");
  const predictionsRoot = join(root, "predictions");
  const fixtureDirectory = join(fixturesRoot, "fixture-a");
  await mkdir(fixtureDirectory, { recursive: true });
  await mkdir(predictionsRoot, { recursive: true });
  await writeFile(join(fixtureDirectory, "fixture.json"), JSON.stringify({
    calibration: {
      millimetersPerPixel: 1,
      sourceWidthPx: 10,
      sourceHeightPx: 10,
      originPx: { x: 0, y: 0 },
    },
    expectedOpenings: [],
  }), "utf8");
  await writeFile(join(fixtureDirectory, "source.png"), Buffer.from([0x89, 0x50, 0x4e, 0x47]));
  await writeFile(join(predictionsRoot, "fixture-a.json"), JSON.stringify({ walls: [], openings: [] }), "utf8");
  return {
    root,
    fixturesRoot,
    predictionsRoot,
    outputPath: join(root, "output", "recognition-ai-benchmark.json"),
  };
}

function config(maximumCostUsd: number) {
  return Object.freeze({
    schemaVersion: "recognition-ai-benchmark-config-v1",
    modelIds: Object.freeze(["test/model"]),
    fixtureIds: Object.freeze(["fixture-a"]),
    repetitions: 3,
    maximumTokens: 128,
    timeoutMs: 10_000,
    maximumCostUsd,
    maximumPromptPricePerMillionUsd: 3,
    maximumCompletionPricePerMillionUsd: 15,
    mode: "verification",
    qualified: false,
  });
}

function modelResponse() {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        data: {
          id: "test/model",
          context_length: 16_384,
          architecture: { input_modalities: ["text", "image"], output_modalities: ["text"] },
          supported_parameters: ["max_tokens", "response_format", "reasoning"],
          reasoning: { mandatory: false },
        },
      };
    },
    async text() { return ""; },
  };
}

function successfulResponse(cost: number | null) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        choices: [{ message: { content: JSON.stringify({ walls: [], openings: [] }) } }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 2,
          total_tokens: 12,
          ...(cost === null ? {} : { cost }),
        },
      };
    },
    async text() { return ""; },
  };
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })));
});

describe("AI benchmark observed-cost guard", () => {
  it("stops before the next paid request once the observed budget is consumed", async () => {
    const workspace = await prepareWorkspace();
    let paidCalls = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: { method?: string }) => {
      if ((init?.method ?? "GET") === "GET") return modelResponse();
      paidCalls += 1;
      return successfulResponse(0.01);
    });
    const report = await runAiBenchmark({
      config: config(0.01),
      fixturesRoot: workspace.fixturesRoot,
      predictionsRoot: workspace.predictionsRoot,
      outputPath: workspace.outputPath,
      apiKey: "test-key",
      fetcher,
      commitSha: "test-sha",
    });

    expect(paidCalls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(report.execution).toEqual({
      plannedRunCount: 3,
      completedRunCount: 1,
      maximumCostUsd: 0.01,
      observedCostUsd: 0.01,
      complete: false,
      stopReason: "cost-budget-reached",
    });
    expect(JSON.parse(await readFile(workspace.outputPath, "utf8")).execution).toEqual(report.execution);
  });

  it("fails closed and sends no further paid requests when usage cost is missing", async () => {
    const workspace = await prepareWorkspace();
    let paidCalls = 0;
    const fetcher = vi.fn(async (_url: unknown, init?: { method?: string }) => {
      if ((init?.method ?? "GET") === "GET") return modelResponse();
      paidCalls += 1;
      return successfulResponse(null);
    });
    const report = await runAiBenchmark({
      config: config(1),
      fixturesRoot: workspace.fixturesRoot,
      predictionsRoot: workspace.predictionsRoot,
      outputPath: workspace.outputPath,
      apiKey: "test-key",
      fetcher,
      commitSha: "test-sha",
    });

    expect(paidCalls).toBe(1);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(report.execution).toEqual({
      plannedRunCount: 3,
      completedRunCount: 1,
      maximumCostUsd: 1,
      observedCostUsd: 0,
      complete: false,
      stopReason: "usage-cost-missing",
    });
  });
});

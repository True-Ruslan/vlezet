import { expect, test } from "@playwright/test";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { configFromEnvironment } from "./ai-benchmark/run.mjs";
import { createOpenRouterBenchmarkClient } from "./ai-benchmark/openrouter-client.mjs";
import { runLiveProposalBenchmark } from "./ai-benchmark/proposal-live-runner.mjs";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const repositoryRoot = resolve(toolDirectory, "../..");
const corpusRoot = join(repositoryRoot, "packages/recognition/benchmarks/real-analogues");
const recordedRoot = join(corpusRoot, "recorded-ai-proposals");
const fixturesRoot = join(corpusRoot, "fixtures");
const outputPath = join(toolDirectory, "artifacts/ai/recognition-ai-benchmark.json");
const baseUrl = process.env.RECOGNITION_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000";

async function loadFixtures(config) {
  const manifest = JSON.parse(await readFile(join(recordedRoot, "manifest.json"), "utf8"));
  const byAnalogueId = new Map(manifest.fixtures.map((entry) => [entry.analogueFixtureId, entry]));
  return Promise.all(config.fixtureIds.map(async (fixtureId) => {
    const entry = byAnalogueId.get(fixtureId);
    if (!entry) throw new Error(`Fixture '${fixtureId}' has no reviewed Stage 1 proposal context.`);
    const context = JSON.parse(await readFile(join(recordedRoot, entry.contextPath), "utf8"));
    const source = await readFile(join(fixturesRoot, fixtureId, "source.png"));
    return {
      fixtureId,
      context,
      sourceImageDataUrl: `data:image/png;base64,${source.toString("base64")}`,
    };
  }));
}

test("runs the bounded Stage 1 live proposal benchmark through product sanitation", async ({ page }) => {
  test.setTimeout(42 * 60 * 1000);
  const config = configFromEnvironment(process.env);
  expect(config.mode).toBe("proposal-discovery-stage1");
  const fixtures = await loadFixtures(config);
  const apiKey = process.env.OPENROUTER_API_KEY?.trim() ?? "";
  if (!apiKey) throw new Error("OPENROUTER_API_KEY is required; no paid request was sent.");
  const modelClient = createOpenRouterBenchmarkClient({ apiKey });

  await page.goto("/__recognition-benchmark");
  await expect(page.getByRole("heading", { name: "Recognition Benchmark Harness" })).toBeVisible();

  const report = await runLiveProposalBenchmark({
    config,
    fixtures,
    commitSha: process.env.GITHUB_SHA ?? null,
    outputPath,
    describeModel: ({ modelId, timeoutMs }) => modelClient.describeModel({ modelId, timeoutMs }),
    prepareProposal: ({ fixture, requestId }) => page.evaluate(
      async ({ fixture: currentFixture, requestId: currentRequestId }) => {
        const harness = window.__vlezetRecognitionBenchmark;
        if (!harness) throw new Error("Recognition benchmark harness is unavailable.");
        return harness.prepareProposal({
          requestId: currentRequestId,
          sourceImageDataUrl: currentFixture.sourceImageDataUrl,
          context: currentFixture.context,
        });
      },
      { fixture, requestId },
    ),
    requestProposal: async (input) => {
      const response = await fetch(`${baseUrl}/api/__recognition-benchmark/proposal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = body && typeof body.error === "string"
          ? body.error
          : `Live proposal route returned HTTP ${response.status}.`;
        throw new Error(message);
      }
      return body;
    },
    sanitizeProposal: ({ request, envelope }) => page.evaluate(
      ({ request: currentRequest, envelope: currentEnvelope }) => {
        const harness = window.__vlezetRecognitionBenchmark;
        if (!harness) throw new Error("Recognition benchmark harness is unavailable.");
        return harness.sanitizeProposal({
          requestId: currentRequest.requestId,
          batch: currentEnvelope.batch,
          providerId: currentEnvelope.providerId,
          modelId: currentEnvelope.modelId,
        });
      },
      { request, envelope },
    ),
  });

  expect(report.runs).toHaveLength(config.modelIds.length * config.fixtureIds.length * config.repetitions);
  expect(report.qualified).toBe(false);
  expect(JSON.stringify(report)).not.toMatch(
    /data:image|base64|authorization|bearer|rawProviderResponse|sourceImageDataUrl|overlayImageDataUrl/i,
  );
});

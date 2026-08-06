import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const root = resolve(new URL("../../..", import.meta.url).pathname);
function source(path) { return readFileSync(resolve(root, path), "utf8"); }

test("browser harness prepares requests and replays the real product sanitizer", () => {
  const value = source("apps/web/components/recognition/recognition-benchmark-harness.tsx");
  assert.match(value, /buildRecognitionAiProposalRequest/);
  assert.match(value, /sanitizeAiProposalBatch/);
  assert.match(value, /registerAiRejectedOpeningEvidenceForDraft/);
  assert.match(value, /const first = sanitize\(\)/);
  assert.match(value, /const second = sanitize\(\)/);
  assert.doesNotMatch(value, /OPENROUTER_API_KEY/);
});

test("server-only route reuses the product provider with hard routing and cost bounds", () => {
  const value = source("apps/web/app/api/%5F%5Frecognition-benchmark/proposal/route.ts");
  assert.match(value, /RECOGNITION_BENCHMARK_HARNESS/);
  assert.match(value, /OpenRouterDirectProvider/);
  assert.match(value, /allow_fallbacks:\s*false/);
  assert.match(value, /max_price:\s*input\.providerMaxPrice/);
  assert.match(value, /body\.max_tokens = input\.maximumTokens/);
  assert.match(value, /maximumBoundedCostUsd/);
  assert.match(value, /Provider max-price bounds exceed the per-request hard cost allocation/);
  assert.match(value, /timeoutMs:\s*input\.timeoutMs/);
  assert.match(value, /hard-cost-allocation-exceeded/);
  assert.doesNotMatch(value, /return jsonResponse\(\{\s*apiKey/);
});

test("manual workflow runs live proposals only in explicit proposal mode and feeds the evaluator", () => {
  const value = source(".github/workflows/recognition-ai-benchmark.yml");
  assert.match(value, /recognition-ai-proposal-live\.spec\.mjs/);
  assert.match(value, /inputs\.mode == 'proposal-discovery-stage1'/);
  assert.match(value, /benchmark:recognition:ai-proposal-qualify/);
  assert.match(value, /OPENROUTER_API_KEY: \$\{\{ inputs\.mode == 'proposal-discovery-stage1'/);
  assert.match(value, /contents:\s*read/);
  assert.match(value, /proposal_fixtures:/);
  assert.match(value, /steps\.artifact_safety\.outcome == 'success'/);
  assert.doesNotMatch(value, /pull_request:/);
});

test("Playwright discovery includes the dedicated live proposal spec", () => {
  const value = source("tools/recognition-benchmark/playwright.config.mjs");
  assert.match(value, /ai-proposal-live/);
});

test("reviewed context identifies the washbasin target by local wall id", () => {
  const context = JSON.parse(source("packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/contexts/product-owner-current-plan-stage1.json"));
  assert.deepEqual(context.groundTruth.washbasinWallCandidateIds, ["wall-washbasin"]);
});

test("package scripts expose deterministic runner tests without sending paid requests", () => {
  const rootPackage = JSON.parse(source("package.json"));
  const toolsPackage = JSON.parse(source("tools/recognition-benchmark/package.json"));
  assert.equal(rootPackage.scripts["test:recognition:ai-proposal-live"], "node --test tools/recognition-benchmark/ai-benchmark/proposal-live-runner.test.mjs tools/recognition-benchmark/ai-benchmark/proposal-live-integration.test.mjs");
  assert.equal(toolsPackage.scripts["test:ai-proposal-live"], "node --test ai-benchmark/proposal-live-runner.test.mjs ai-benchmark/proposal-live-integration.test.mjs");
});

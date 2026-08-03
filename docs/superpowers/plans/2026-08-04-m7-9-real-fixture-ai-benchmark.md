# M7.9 Real Fixture Dataset and AI Benchmark Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a privacy-safe, deterministic twelve-plan real-world recognition corpus and a cost-bounded OpenRouter model benchmark that turns observed product defects into reproducible gates.

**Architecture:** Original user-supplied rasters remain local and are represented in git only by immutable SHA-256 metadata. Public CI consumes repository-owned vector redrawn analogues linked one-to-one to those hashes, complete ground truth, forbidden false-positive regions and scenario assertions. A separate manually dispatched workflow benchmarks AI as a strict immutable-ID verifier and produces artifacts without changing baselines or product geometry.

**Tech Stack:** Node.js 22, TypeScript, Vitest, Playwright Chromium, pnpm, GitHub Actions, OpenRouter structured outputs, existing `@vlezet/recognition` benchmark and sanitizer contracts.

## Global Constraints

- Keep PR #42 draft and unmerged; M7.9 uses `feat/m7-9-real-fixture-ai-benchmark` stacked on the approved M7.8C head.
- Never commit the twelve original rasters, provider keys, raw Authorization headers or private URLs.
- Canonical private source identity is SHA-256 plus width, height and media type.
- Public fixtures use only `redrawn-anonymized` or repository-owned synthetic provenance.
- AI remains verification-only: no new IDs, coordinates, thickness, opening centers, widths or host walls.
- Public deterministic CI has no network or secret dependency.
- Paid AI jobs run only through `workflow_dispatch`; they are never pull-request-triggered.
- Bound AI input to at most 3 models, 12 fixtures, 5 repetitions, 2048 output tokens and 90 seconds per request.
- Missing `OPENROUTER_API_KEY` must fail closed with a clear message and no request attempt.
- Baselines and model qualification are never updated automatically.
- All source and generated artifacts remain below 2400 × 2400 pixels and 5 MiB.

---

## File Structure

### New corpus files

- `packages/recognition/benchmarks/real-analogues/private-source-manifest.json` — immutable metadata for the twelve supplied files.
- `packages/recognition/benchmarks/real-analogues/analogue-manifest.json` — maps every private source to exactly one public analogue.
- `packages/recognition/benchmarks/real-analogues/source-definitions.mjs` — twelve repository-owned vector definitions.
- `packages/recognition/benchmarks/real-analogues/schema.mjs` — manifest and failure-expectation validators.
- `packages/recognition/benchmarks/real-analogues/fixtures/<id>/...` — generated source, fixture, segments and failure expectations.

### New benchmark tooling

- `tools/recognition-benchmark/real-fixture-renderer.mjs` — renders public analogue definitions.
- `tools/recognition-benchmark/generate-real-fixture-assets.mjs` — deterministic corpus generator.
- `tools/recognition-benchmark/verify-real-fixtures.mjs` — provenance, hash, private-byte and schema guard.
- `tools/recognition-benchmark/score-failure-expectations.mjs` — critical per-fixture assertions.
- `tools/recognition-benchmark/real-fixture-gate.mjs` — combines aggregate metrics and scenario failures.
- `tools/recognition-benchmark/private-source-check.mjs` — local digest verifier for ignored source files.

### New AI tooling

- `tools/recognition-benchmark/ai-benchmark/config.mjs` — bounded workflow input parsing.
- `tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs` — secret-safe structured-output client.
- `tools/recognition-benchmark/ai-benchmark/run.mjs` — model × fixture × repetition execution.
- `tools/recognition-benchmark/ai-benchmark/score.mjs` — verifier stability, precision and downgrade metrics.
- `tools/recognition-benchmark/ai-benchmark/report.mjs` — deterministic JSON and Markdown artifacts.
- `.github/workflows/recognition-ai-benchmark.yml` — manual cost-bounded workflow.

### Modified integration files

- `.gitignore` — ignore `.local/recognition-private-sources/` and annotation workspaces.
- `package.json` — root commands for generation, verification, real gate and AI benchmark.
- `tools/recognition-benchmark/package.json` — tool-level commands and test entrypoints.
- `.github/workflows/recognition-benchmark.yml` — run deterministic real-analogue verification and gate.
- `packages/recognition/benchmarks/README.md` — corpus v1 vs real-analogue corpus documentation.

---

### Task 1: Isolate the stacked branch and register the private source inventory

**Files:**
- Create: `packages/recognition/benchmarks/real-analogues/private-source-manifest.json`
- Create: `packages/recognition/benchmarks/real-analogues/schema.mjs`
- Test: `tools/recognition-benchmark/real-source-manifest.test.mjs`

**Interfaces:**
- Produces: `validatePrivateSourceManifest(value): Readonly<{ valid: boolean; errors: readonly string[] }>`.
- Produces: canonical source IDs `real-plan-001` through `real-plan-012`.

- [ ] **Step 1: Create the stacked branch from the approved design commit**

```bash
git switch feat/m7-8c-opening-classification-host-wall-validation
git pull --ff-only
git switch -c feat/m7-9-real-fixture-ai-benchmark
```

Expected base includes commit `a8f91aeaf19ba4558619235e30f00f70e7331f9e`.

- [ ] **Step 2: Write the failing manifest tests**

Test all of these properties:

```js
assert.equal(manifest.sources.length, 12);
assert.equal(new Set(manifest.sources.map(({ sourceId }) => sourceId)).size, 12);
assert.equal(new Set(manifest.sources.map(({ sha256 }) => sha256)).size, 12);
assert.deepEqual(manifest.sources.map(({ sourceId }) => sourceId),
  Array.from({ length: 12 }, (_, index) => `real-plan-${String(index + 1).padStart(3, "0")}`));
assert.equal(validatePrivateSourceManifest(manifest).valid, true);
```

Also reject malformed SHA-256, zero dimensions, unsupported media type, duplicate ID/hash, non-`registered` annotation status and redistribution other than `not-committed`.

- [ ] **Step 3: Run the RED test**

Run:

```bash
node --test tools/recognition-benchmark/real-source-manifest.test.mjs
```

Expected: FAIL because the manifest and validator do not exist.

- [ ] **Step 4: Implement the validator and exact twelve-entry manifest**

Every source entry must contain:

```ts
type PrivateSource = Readonly<{
  sourceId: `real-plan-${string}`;
  sha256: string;
  widthPx: number;
  heightPx: number;
  mediaType: "image/jpeg" | "image/png";
  tags: readonly string[];
  annotationStatus: "registered";
  redistribution: "not-committed";
}>;
```

Use the exact hashes and dimensions from the approved design specification.

- [ ] **Step 5: Run the GREEN test**

```bash
node --test tools/recognition-benchmark/real-source-manifest.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/benchmarks/real-analogues tools/recognition-benchmark/real-source-manifest.test.mjs
git commit -m "test: register private recognition source inventory"
```

---

### Task 2: Add privacy guards and local source verification

**Files:**
- Modify: `.gitignore`
- Create: `tools/recognition-benchmark/private-source-check.mjs`
- Test: `tools/recognition-benchmark/private-source-check.test.mjs`

**Interfaces:**
- Consumes: private source manifest from Task 1.
- Produces: `verifyPrivateSourceDirectory({ root, manifest }): Promise<PrivateSourceCheckReport>`.
- Produces: `assertNoPrivateSourceBytes({ repositoryRoot, manifest }): Promise<void>`.

- [ ] **Step 1: Write failing tests**

Cover:

```js
await assert.rejects(() => verifyPrivateSourceDirectory({ root: missingRoot, manifest }), /missing/i);
await assert.rejects(() => verifyPrivateSourceDirectory({ root: wrongDigestRoot, manifest }), /digest/i);
assert.equal((await verifyPrivateSourceDirectory({ root: validRoot, manifest })).verified, 12);
await assert.rejects(() => assertNoPrivateSourceBytes({ repositoryRoot: leakedRoot, manifest }), /private source/i);
```

Also assert log messages contain source IDs but never file bytes or environment values.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/private-source-check.test.mjs
```

Expected: FAIL because functions do not exist.

- [ ] **Step 3: Implement minimal safe verification**

Rules:

- recursively inspect only regular files;
- compute SHA-256 incrementally;
- reject a digest that matches any private source anywhere outside `.local/recognition-private-sources/`;
- local verification accepts arbitrary local file names but maps by digest;
- reject duplicates and dimension/media-type mismatch;
- return exact missing source IDs.

- [ ] **Step 4: Add ignore rules**

```gitignore
.local/recognition-private-sources/
.local/recognition-annotations/
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tools/recognition-benchmark/private-source-check.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .gitignore tools/recognition-benchmark/private-source-check*
git commit -m "feat: guard private recognition source files"
```

---

### Task 3: Define and validate the twelve public redrawn analogues

**Files:**
- Create: `packages/recognition/benchmarks/real-analogues/analogue-manifest.json`
- Create: `packages/recognition/benchmarks/real-analogues/source-definitions.mjs`
- Extend: `packages/recognition/benchmarks/real-analogues/schema.mjs`
- Test: `tools/recognition-benchmark/real-analogue-definitions.test.mjs`

**Interfaces:**
- Produces: `realAnalogueDefinitions: readonly RealAnalogueDefinition[]`.
- Produces: `validateAnalogueManifest(value, privateManifest)`.
- Produces: `validateFailureExpectations(value, fixture)`.

- [ ] **Step 1: Write failing one-to-one and coverage tests**

Required assertions:

```js
assert.equal(realAnalogueDefinitions.length, 12);
assert.equal(analogueManifest.fixtures.length, 12);
assert.deepEqual(
  new Set(analogueManifest.fixtures.map(({ privateSourceId }) => privateSourceId)),
  new Set(privateManifest.sources.map(({ sourceId }) => sourceId)),
);
for (const definition of realAnalogueDefinitions) {
  assert.equal(definition.provenance.kind, "redrawn-anonymized");
  assert.ok(definition.walls.length > 0);
  assert.ok(definition.failureExpectations.mustDetect.length
    + definition.failureExpectations.mustNotDetectRegions.length > 0);
}
```

Scenario requirements:

- 001: thin loggia wall, all visible windows/doors, kitchen and toilet forbidden wall regions.
- 002–004: portrait plans and entrance/interior door variants.
- 005–007: thick external walls, loggias, service blocks and multiple windows.
- 008: diagonal geometry and rotation invariance.
- 009–012: irregular footprints, two wet zones, multiple balconies and openings-heavy layouts.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/real-analogue-definitions.test.mjs
```

Expected: FAIL because definitions do not exist.

- [ ] **Step 3: Implement focused vector primitives**

Create helpers with explicit contracts:

```js
wall({ id, startMm, endMm, thicknessMm, kind });
door({ id, hostWallId, centerMm, widthMm, orientationDeg, swing });
windowOpening({ id, hostWallId, centerMm, widthMm, orientationDeg });
forbiddenRegion({ id, kind, polygonNormalized, reason });
```

Do not embed original room labels or exact listing identifiers. Preserve only geometry and recognition failure characteristics.

- [ ] **Step 4: Implement all twelve definitions**

Every definition declares:

```js
{
  id,
  privateSourceId,
  privateSourceSha256,
  description,
  provenance,
  tags,
  sourceWidthPx,
  sourceHeightPx,
  millimetersPerPixel,
  walls,
  openings,
  decorations,
  rooms,
  metricApplicability,
  failureExpectations,
}
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tools/recognition-benchmark/real-analogue-definitions.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/benchmarks/real-analogues tools/recognition-benchmark/real-analogue-definitions.test.mjs
git commit -m "feat: define twelve anonymized real-plan analogues"
```

---

### Task 4: Generate and verify immutable public fixture assets

**Files:**
- Create: `tools/recognition-benchmark/real-fixture-renderer.mjs`
- Create: `tools/recognition-benchmark/generate-real-fixture-assets.mjs`
- Create: `tools/recognition-benchmark/verify-real-fixtures.mjs`
- Test: `tools/recognition-benchmark/verify-real-fixtures.test.mjs`
- Generate: `packages/recognition/benchmarks/real-analogues/fixtures/**`

**Interfaces:**
- Consumes: `realAnalogueDefinitions`.
- Produces: generated `source.png`, `source.sha256`, `fixture.json`, `segments.json`, `failure-expectations.json`.
- Produces: `verifyRealFixtures({ root }): Promise<RealFixtureVerificationReport>`.

- [ ] **Step 1: Write failing generator and verifier tests**

Cover:

```js
assert.equal(report.fixtureCount, 12);
assert.equal(report.hashMismatches.length, 0);
assert.equal(report.provenanceViolations.length, 0);
assert.equal(report.privateDigestLeaks.length, 0);
assert.equal(report.failureExpectationErrors.length, 0);
```

Delete or corrupt one generated hash in a temporary copy and assert rejection.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/verify-real-fixtures.test.mjs
```

Expected: FAIL because generator/verifier do not exist.

- [ ] **Step 3: Implement deterministic SVG/PNG rendering**

Reuse established fixture conventions:

- white or light-gray background;
- filled wall polygons with centerline ground truth independent from raster strokes;
- thin door arcs and window rails as decorations;
- optional large numeric labels to reproduce clutter;
- no source metadata chunks or external fonts.

- [ ] **Step 4: Generate all assets**

```bash
node tools/recognition-benchmark/generate-real-fixture-assets.mjs
```

Expected: exactly twelve fixture directories.

- [ ] **Step 5: Verify deterministic regeneration**

Run generator twice and verify `git diff --exit-code` after the second run.

- [ ] **Step 6: Run GREEN**

```bash
node --test tools/recognition-benchmark/verify-real-fixtures.test.mjs
node tools/recognition-benchmark/verify-real-fixtures.mjs
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add packages/recognition/benchmarks/real-analogues/fixtures tools/recognition-benchmark/real-fixture* tools/recognition-benchmark/generate-real-fixture-assets.mjs tools/recognition-benchmark/verify-real-fixtures*
git commit -m "feat: generate immutable real-plan analogue corpus"
```

---

### Task 5: Enforce scenario-specific failures in the recognition benchmark

**Files:**
- Create: `tools/recognition-benchmark/score-failure-expectations.mjs`
- Create: `tools/recognition-benchmark/real-fixture-gate.mjs`
- Test: `tools/recognition-benchmark/score-failure-expectations.test.mjs`
- Modify: `tools/recognition-benchmark/package.json`
- Modify: root `package.json`

**Interfaces:**
- Produces: `scoreFailureExpectations({ fixture, recognitionResult }): FailureExpectationScore`.
- Produces: `enforceRealFixtureGate({ benchmarkResult, scenarioScores, thresholds })`.

- [ ] **Step 1: Write RED tests for hidden aggregate regressions**

Fixtures must fail when:

- aggregate wall F1 passes but `balcony-thin-wall` is missed;
- aggregate opening F1 passes but one designated window is missed;
- a wall intersects `kitchen-sink-symbol` or `toilet-service-symbols` forbidden regions;
- a thick wall is represented by two substantial parallel axes;
- accepted opening has unknown host;
- diagonal fixture rotates or mirrors unexpectedly.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/score-failure-expectations.test.mjs
```

Expected: FAIL because scorer does not exist.

- [ ] **Step 3: Implement geometric scoring**

Use normalized geometry and bounded tolerances:

- must-detect wall: centerline overlap and angle tolerance;
- must-detect opening: kind, host and center-span match;
- forbidden region: candidate segment/polygon intersection;
- duplicate wall: parallel overlap with physical-band proximity;
- orientation invariant: compare normalized source-space coordinates without auto-rotation.

- [ ] **Step 4: Add commands**

Root scripts:

```json
{
  "benchmark:recognition:real:generate": "node tools/recognition-benchmark/generate-real-fixture-assets.mjs",
  "benchmark:recognition:real:verify": "node tools/recognition-benchmark/verify-real-fixtures.mjs",
  "benchmark:recognition:real:gate": "node tools/recognition-benchmark/real-fixture-gate.mjs"
}
```

- [ ] **Step 5: Run GREEN**

```bash
node --test tools/recognition-benchmark/score-failure-expectations.test.mjs
pnpm benchmark:recognition:real:verify
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add package.json tools/recognition-benchmark/package.json tools/recognition-benchmark/score-failure-expectations* tools/recognition-benchmark/real-fixture-gate.mjs
git commit -m "feat: gate critical real-plan recognition scenarios"
```

---

### Task 6: Add bounded OpenRouter AI benchmark core

**Files:**
- Create: `tools/recognition-benchmark/ai-benchmark/config.mjs`
- Create: `tools/recognition-benchmark/ai-benchmark/openrouter-client.mjs`
- Create: `tools/recognition-benchmark/ai-benchmark/run.mjs`
- Create: `tools/recognition-benchmark/ai-benchmark/score.mjs`
- Create: `tools/recognition-benchmark/ai-benchmark/report.mjs`
- Test: `tools/recognition-benchmark/ai-benchmark/*.test.mjs`

**Interfaces:**
- Produces: `parseAiBenchmarkConfig(env, inputs): AiBenchmarkConfig`.
- Produces: `verifyWithOpenRouter({ apiKey, modelId, imageDataUrl, localSummary, signal })`.
- Produces: `scoreAiVerificationRuns(runs): AiModelBenchmarkScore`.

- [ ] **Step 1: Write failing config/security tests**

Assert:

```js
assert.throws(() => parseAiBenchmarkConfig({}, validInputs), /OPENROUTER_API_KEY/);
assert.throws(() => parseAiBenchmarkConfig(env, { models: "a,b,c,d" }), /maximum 3/i);
assert.throws(() => parseAiBenchmarkConfig(env, { repetitions: "6" }), /maximum 5/i);
assert.equal(config.maxOutputTokens, 2048);
assert.equal(config.timeoutMs, 90_000);
```

Also assert error serialization redacts strings matching `sk-or-v1-` and `Bearer `.

- [ ] **Step 2: Write failing immutable-geometry tests**

Reject provider results that create IDs or include geometry fields:

```js
await assert.rejects(() => verifyWithOpenRouter(inputWithUnknownId), /unknown candidate/i);
await assert.rejects(() => verifyWithOpenRouter(inputWithCoordinates), /geometry/i);
```

- [ ] **Step 3: Run RED**

```bash
node --test tools/recognition-benchmark/ai-benchmark/*.test.mjs
```

Expected: FAIL because modules do not exist.

- [ ] **Step 4: Implement bounded client and runner**

Requirements:

- structured JSON schema;
- `temperature: 0`;
- verification-only prompt with exact local IDs;
- AbortController timeout;
- response body limit;
- no raw headers in errors;
- write one normalized result per repetition;
- public redrawn raster only in CI.

- [ ] **Step 5: Implement scoring and reports**

Per model report includes:

```ts
type AiModelBenchmarkScore = Readonly<{
  modelId: string;
  runs: number;
  schemaFailureRate: number;
  safetyViolationCount: number;
  highConfidenceConfirmationRate: number;
  falseDowngradeRate: number;
  unsupportedConfirmationRate: number;
  openingClassificationAccuracy: number | null;
  stableDecisionRate: number;
  medianLatencyMs: number;
  totalPromptTokens: number | null;
  totalCompletionTokens: number | null;
  estimatedCostUsd: number | null;
  qualified: false;
}>;
```

M7.9 reports always set `qualified: false`; qualification remains a reviewed later decision.

- [ ] **Step 6: Run GREEN**

```bash
node --test tools/recognition-benchmark/ai-benchmark/*.test.mjs
```

Expected: PASS without making network requests.

- [ ] **Step 7: Commit**

```bash
git add tools/recognition-benchmark/ai-benchmark
git commit -m "feat: add bounded OpenRouter recognition benchmark"
```

---

### Task 7: Add manual GitHub Actions AI benchmark workflow

**Files:**
- Create: `.github/workflows/recognition-ai-benchmark.yml`
- Test: `tools/recognition-benchmark/ai-benchmark/workflow-contract.test.mjs`
- Modify: root `package.json`

**Interfaces:**
- Consumes: `OPENROUTER_API_KEY` GitHub Actions secret.
- Produces: `recognition-ai-benchmark-evidence` artifact.

- [ ] **Step 1: Write failing workflow source contract test**

Assert the workflow:

- contains `workflow_dispatch`;
- does not contain `pull_request`, `push` or unapproved `schedule`;
- permissions equal `contents: read`;
- references `${{ secrets.OPENROUTER_API_KEY }}`;
- never echoes the secret;
- clamps models, fixtures and repetitions through the Node config parser;
- uploads normalized artifacts with retention 14 days.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/ai-benchmark/workflow-contract.test.mjs
```

Expected: FAIL because workflow does not exist.

- [ ] **Step 3: Implement the manual workflow**

Inputs:

```yaml
models:
  default: google/gemini-2.5-flash
fixtures:
  default: representative
repetitions:
  default: "3"
mode:
  default: disputed-zones
```

The first step checks secret presence without printing it. The runner uses generated public analogue assets only.

- [ ] **Step 4: Run GREEN**

```bash
node --test tools/recognition-benchmark/ai-benchmark/workflow-contract.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/recognition-ai-benchmark.yml package.json tools/recognition-benchmark/ai-benchmark/workflow-contract.test.mjs
git commit -m "ci: add manual recognition AI benchmark"
```

---

### Task 8: Integrate deterministic real fixtures into required CI

**Files:**
- Modify: `.github/workflows/recognition-benchmark.yml`
- Modify: `packages/recognition/benchmarks/README.md`
- Test: `tools/recognition-benchmark/real-workflow-contract.test.mjs`

**Interfaces:**
- Consumes: real fixture generator/verifier and scenario gate.
- Produces: required public CI evidence with no secret dependency.

- [ ] **Step 1: Write RED workflow contract test**

Assert required workflow runs:

```text
verify-real-fixtures
run-real-source-benchmark
score-failure-expectations
enforce-real-fixture-gate
assert-no-private-source-bytes
```

Assert it does not reference `OPENROUTER_API_KEY`.

- [ ] **Step 2: Run RED**

```bash
node --test tools/recognition-benchmark/real-workflow-contract.test.mjs
```

Expected: FAIL because the required steps are absent.

- [ ] **Step 3: Extend the benchmark workflow**

Keep existing corpus v1 steps unchanged. Add real-analogue verification before starting Chromium, execute the source benchmark for both manifests, score failure expectations and include real artifacts in the existing evidence upload.

- [ ] **Step 4: Update documentation**

Document:

- original rasters are local-only;
- exact local directory and digest verification command;
- public analogue provenance;
- deterministic vs paid AI workflows;
- baseline promotion policy;
- how to add a thirteenth source safely.

- [ ] **Step 5: Run GREEN**

```bash
node --test tools/recognition-benchmark/real-workflow-contract.test.mjs
pnpm benchmark:recognition:real:verify
pnpm --filter @vlezet/recognition test
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/recognition-benchmark.yml packages/recognition/benchmarks/README.md tools/recognition-benchmark/real-workflow-contract.test.mjs
git commit -m "ci: require deterministic real-plan regression gate"
```

---

### Task 9: Run exact-head verification and open the stacked Draft PR

**Files:**
- No product code changes.
- Update: PR description after evidence exists.

- [ ] **Step 1: Run full local verification**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm benchmark:recognition:real:verify
pnpm benchmark:recognition:core
```

Expected: all pass.

- [ ] **Step 2: Push and open Draft PR**

```bash
git push -u origin feat/m7-9-real-fixture-ai-benchmark
gh pr create \
  --draft \
  --base feat/m7-8c-opening-classification-host-wall-validation \
  --head feat/m7-9-real-fixture-ai-benchmark \
  --title "test: M7.9 real fixture and AI benchmark foundation"
```

- [ ] **Step 3: Verify exact-head GitHub Actions**

Required checks:

- Standard CI;
- Recognition Benchmark with real-analogue gate;
- M7 Browser Audit;
- workflow-contract tests.

- [ ] **Step 4: Manually dispatch the AI benchmark**

Use one inexpensive baseline model first:

```text
models: google/gemini-2.5-flash
fixtures: representative
repetitions: 3
mode: disputed-zones
```

Do not qualify the model from this run. Record cost, latency, schema failures, safety violations, confirmation and false-downgrade rates.

- [ ] **Step 5: Preserve evidence and update Draft PR**

Include exact head SHA, workflow run IDs, artifact IDs, corpus hashes and first AI benchmark metrics. Keep the PR Draft until the product owner reviews generated analogue overlays and confirms that they reproduce the supplied plans' failure characteristics.

---

## Plan Self-Review

- **Spec coverage:** All design requirements map to Tasks 1–9: source registration, privacy, twelve analogues, ground truth, scenario gates, private local check, bounded AI runner, manual workflow, deterministic CI and evidence.
- **Placeholder scan:** No `TBD`, `TODO`, unspecified validation or generic test instructions remain.
- **Type consistency:** Manifest validators, fixture definitions, failure scorer and AI score types are named once and consumed consistently by later tasks.
- **Scope:** This plan establishes benchmark infrastructure and corpus only. Local CV algorithm rewriting remains M7.10 and is intentionally excluded until the new baseline exists.

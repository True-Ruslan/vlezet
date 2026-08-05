# M7.8C.1 Hybrid AI Proposal Recovery — Stage 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover missing doors and windows as transparent AI proposals and let AI advise on exact suspicious local wall candidates, without allowing provider output to mutate local recognition geometry or bypass deterministic validation, explicit review, atomic Apply, and semantic history.

**Architecture:** A dedicated stacked implementation branch introduces a provider-neutral `AiProposalBatch`, a separate sanitized proposal namespace on `RecognitionDraft`, and bounded local evidence needed to validate proposals. The request contains exactly two images—the bounded source and an aligned ID overlay—plus a canonical local summary and batch identity. Raw provider data is parsed and budgeted, then door/window proposals and false-wall advisories pass deterministic raster/topology checks. Only eligible proposals are reviewable; accepted geometry is revalidated and materialized transiently at the single existing Apply boundary.

**Tech Stack:** TypeScript 6, React/Next.js 16, Vitest 4, Playwright Chromium/WebKit, `@vlezet/recognition`, `@vlezet/domain`, `@vlezet/editor-core`, `@vlezet/geometry`, OpenRouter structured outputs, pnpm 11/Turborepo.

## Global Constraints

- Canonical slice label: **M7.8C.1 Hybrid AI Proposal Recovery**. Do not consume canonical roadmap milestone M7.9.
- Implement on a dedicated stacked branch `feat/m7-8c-1-hybrid-ai-proposal-recovery` created from the reviewed exact PR #44 planning head. Keep PR #44 Draft / DO NOT MERGE.
- Stage 1 supports only `opening-addition` (`door` / `window`) and exact-ID `local-wall-review` proposals.
- `thin-wall-addition` is rejected by the Stage 1 parser and belongs to a separate Stage 2 plan after Stage 1 product acceptance.
- `VlezetDocument` remains the sole persistent apartment truth.
- Raw provider output is never represented as `RecognitionWallCandidate` or `RecognitionOpeningCandidate`.
- AI cannot mutate local IDs, geometry, thickness, classifications, host IDs, confidence, conflict, evidence, or decisions.
- Raw proposals are non-applicable. Only sanitized state `eligible` can be accepted; `blocked` and `duplicate` remain non-applicable.
- Eligible AI geometry has deterministic confidence `medium` or `low`, never `high`.
- A door/window is eligible only after exactly one active local host wall is selected and the unchanged common opening validation, overlap, duplicate, raster-evidence, corner, and junction rules pass.
- Host hints narrow deterministic selection; they never override geometry.
- A false-wall advisory cannot alter a local candidate automatically. Explicit user agreement rejects only that local Draft candidate and never removes an already applied document wall.
- Every batch is bound to exact `requestId`, `referenceRevision`, `localDraftFingerprint`, provider ID, and model ID. Any identity mismatch rejects the whole batch.
- Stage 1 hard budgets:
  - opening proposals: `12`;
  - local-wall review proposals: `12`;
  - provider diagnostics: `20`;
  - source images: exactly `2`;
  - primary timeout: `45_000 ms`;
  - schema-repair timeout: `15_000 ms`;
  - maximum attempts: `2`;
  - maximum response body: `96 KiB`;
  - maximum generated tokens: `4096`.
- Attempt 2 is schema repair only: same provider/model, no images, exact schema, and bounded structural error summary.
- Public pull-request CI uses repository-owned redrawn analogues and recorded batches only. Live paid AI never runs automatically on pull requests.
- Existing Core, Source, real-fixture thresholds, and reviewed baselines must not be lowered.
- Stage 1 product acceptance requires material improvement on the original product-owner plan: at least one previously missed unambiguous door and one previously missed unambiguous window become eligible; blocked explanations alone do not pass.
- The thin balcony/loggia wall is a Stage 2 product gate, not a Stage 1 requirement.
- Every production task follows RED → GREEN and ends with focused tests plus a small commit.

---

## File Structure

### Recognition domain and sanitation

- Create `packages/recognition/src/ai-proposals.ts`: raw/sanitized proposal types, validators, reason-code allow-lists, budgets.
- Create `packages/recognition/src/draft-fingerprint.ts`: canonical local Draft fingerprint.
- Create `packages/recognition/src/ai-local-evidence.ts`: runtime-only evidence snapshot and lookup.
- Create `packages/recognition/src/ai-proposal-sanity.ts`: whole-batch identity/budget/schema sanitation.
- Create `packages/recognition/src/ai-opening-sanitizer.ts`: door/window host selection, snapping, evidence, duplicate/overlap validation.
- Create `packages/recognition/src/ai-wall-review-sanitizer.ts`: exact-ID false-wall advisory checks and structural protection.
- Create `packages/recognition/src/ai-proposal-reconcile.ts`: immutable local Draft preservation and separate proposal namespace.
- Create `packages/recognition/src/ai-proposal-apply.ts`: conversion of accepted eligible proposals to transient ordinary Draft input for existing Apply validation.
- Modify `packages/recognition/src/model.ts`: proposal collections, metadata, decisions, migration defaults.
- Modify `packages/recognition/src/provider.ts`: provider-neutral proposal request/result interfaces without removing verifier compatibility.
- Modify `packages/recognition/src/recognition-runtime-context.ts`: evidence registration and non-destructive request lookup.
- Modify `packages/recognition/src/index.ts`: public exports.

### Web request, provider, controller, UI, Apply

- Create `apps/web/components/recognition/recognition-ai-overlay.ts`: stable aligned ID overlay.
- Create `apps/web/components/recognition/recognition-ai-request.ts`: exact two-image request and local summary.
- Modify `apps/web/components/recognition/openrouter-schema.ts`: Stage 1 proposal schema.
- Modify `apps/web/components/recognition/openrouter-provider.ts`: bounded proposal mode and one schema-repair attempt.
- Modify `apps/web/components/recognition/recognition-controller.ts`: request identity, cancellation/race protection, proposal decisions, advisory action.
- Modify `apps/web/components/recognition/recognition-panel.tsx`: transparent source filters, proposal states, evidence and blockers.
- Modify `apps/web/components/recognition/recognition-apply.ts`: strict atomic preflight including accepted proposals.
- Modify `apps/web/components/projects/project-app.tsx`: wire the proposal flow to the existing controller and Apply/history path.

### Benchmark and browser acceptance

- Create `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/manifest.json`.
- Create `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/schema.json`.
- Create recorded Stage 1 response fixtures under `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/fixtures/`.
- Create `tools/recognition-benchmark/ai-proposal-gate.mjs` and test.
- Extend `tools/recognition-benchmark/ai-benchmark/{run,score,report}.mjs` for proposal metrics.
- Modify `.github/workflows/recognition-benchmark.yml` and `.github/workflows/recognition-ai-benchmark.yml`.
- Create `apps/web/e2e/recognition-ai-proposals.spec.ts`.

---

### Task 1: Create the implementation branch and lock the Stage 0 recorded scenario contract

**Files:**
- Create branch: `feat/m7-8c-1-hybrid-ai-proposal-recovery`
- Create: `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/manifest.json`
- Create: `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/schema.json`
- Create: `packages/recognition/benchmarks/real-analogues/recorded-ai-proposals/fixtures/product-owner-current-plan-stage1.json`
- Create: `packages/recognition/src/ai-proposal-recorded-fixtures.test.ts`

**Interfaces:**
- Produces a versioned recorded-provider corpus consumed by Tasks 6, 16, and 19.
- Records expected recovery scenarios without committing the private source raster.

- [ ] **Step 1: Create the dedicated stacked branch from the reviewed planning head**

```bash
git fetch origin
git switch feat/m7-9-real-fixture-ai-benchmark
git pull --ff-only
git rev-parse HEAD
git switch -c feat/m7-8c-1-hybrid-ai-proposal-recovery
```

Expected starting head is the exact documentation/plan head recorded in PR #44 immediately before implementation. Do not branch from `main` or PR #42 directly.

- [ ] **Step 2: Write the failing recorded-fixture contract**

The manifest must use:

```json
{
  "schemaVersion": "recognition-recorded-ai-proposals-v1",
  "fixtures": [
    {
      "id": "product-owner-current-plan-stage1",
      "analogueFixtureId": "real-plan-001-anonymized",
      "mode": "stage1-proposal-discovery",
      "responsePath": "fixtures/product-owner-current-plan-stage1.json",
      "expected": {
        "eligibleDoorsMinimum": 1,
        "eligibleWindowsMinimum": 1,
        "eligibleWashbasinAdvisory": true,
        "eligibleUnknownHostOpenings": 0,
        "eligibleOutsideHostOpenings": 0,
        "directLocalMutationCount": 0,
        "protectedStrongWallAdvisories": 0,
        "forbiddenRegionEligibleProposals": 0
      }
    }
  ]
}
```

The recorded response initially contains a valid batch envelope but empty proposals, so the scenario assertion is RED before implementation.

- [ ] **Step 3: Run the test and verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-recorded-fixtures.test.ts
```

Expected: FAIL because recorded proposal parsing/scoring APIs do not exist and the fixture cannot satisfy required recovered door/window/advisory scenarios.

- [ ] **Step 4: Commit only the RED contract**

```bash
git add packages/recognition/benchmarks/real-analogues/recorded-ai-proposals packages/recognition/src/ai-proposal-recorded-fixtures.test.ts
git commit -m "test: lock Stage 1 AI proposal scenarios"
```

---

### Task 2: Add raw and sanitized proposal types plus deterministic Draft migration

**Files:**
- Create: `packages/recognition/src/ai-proposals.ts`
- Create: `packages/recognition/src/ai-proposals.test.ts`
- Modify: `packages/recognition/src/model.ts`
- Modify: `packages/recognition/src/session.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces:

```ts
validateAiProposalBatch(value: unknown): AiProposalBatch
validateSanitizedRecognitionProposal(value: unknown): SanitizedRecognitionProposal
emptyAiProposalDraftState(): Pick<RecognitionDraft, "aiProposals" | "proposalDecisions" | "aiProposalMetadata">
```

- `RecognitionDraft` gains exact separate proposal fields from the approved design.
- Stage 1 rejects `thin-wall-addition`.

- [ ] **Step 1: Write RED schema and migration tests**

Cover:

```ts
expect(validateAiProposalBatch(validStage1Batch)).toEqual(validStage1Batch);
expect(() => validateAiProposalBatch({ ...validStage1Batch, schemaVersion: "v2" })).toThrow();
expect(() => validateAiProposalBatch(batchWithDuplicateProposalIds)).toThrow();
expect(() => validateAiProposalBatch(batchWithNaNCoordinate)).toThrow();
expect(() => validateAiProposalBatch(batchWithUnknownReasonCode)).toThrow();
expect(() => validateAiProposalBatch(batchWithThinWall)).toThrow();
expect(validateRecognitionDraft(oldDraftWithoutProposalFields)).toMatchObject({
  aiProposals: [],
  proposalDecisions: {},
  aiProposalMetadata: null,
});
expect(() => validateRecognitionDraft(draftWithUnknownProposalDecision)).toThrow();
```

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposals.test.ts
```

Expected: FAIL because proposal types/validators and migration defaults do not exist.

- [ ] **Step 3: Implement exact Stage 1 contracts**

Use these exported constants:

```ts
export const AI_PROPOSAL_SCHEMA_VERSION = "recognition-ai-proposals-v1" as const;
export const AI_PROPOSAL_MAX_OPENINGS = 12;
export const AI_PROPOSAL_MAX_WALL_REVIEWS = 12;
export const AI_PROPOSAL_MAX_DIAGNOSTICS = 20;
```

Define `NormalizedBox`, allow-listed reason codes, provider diagnostics, raw batch, sanitized geometry, sanitized proposal, metadata and proposal decision types. Validate finite normalized values and unique IDs. `validateRecognitionDraft` must supply empty defaults when all three new fields are absent, but reject partially supplied malformed state.

- [ ] **Step 4: Verify GREEN and existing model/session tests**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposals.test.ts session
pnpm --filter @vlezet/recognition typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/ai-proposals.ts packages/recognition/src/ai-proposals.test.ts packages/recognition/src/model.ts packages/recognition/src/session.ts packages/recognition/src/index.ts
git commit -m "feat: add Stage 1 AI proposal contracts"
```

---

### Task 3: Add canonical Draft fingerprint and batch identity

**Files:**
- Create: `packages/recognition/src/draft-fingerprint.ts`
- Create: `packages/recognition/src/draft-fingerprint.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces:

```ts
createLocalDraftFingerprint(draft: RecognitionDraft): string
createAiProposalRequestIdentity(input: {
  requestId: string;
  referenceRevision: string;
  localDraft: RecognitionDraft;
}): AiProposalRequestIdentity
assertAiProposalBatchIdentity(batch: AiProposalBatch, expected: AiProposalRequestIdentity): void
```

- Fingerprint includes local walls/openings and their structural fields, but excludes timestamps, diagnostics, local decisions, AI proposal fields and provider metadata.

- [ ] **Step 1: Write RED identity tests**

Assert:

- input order does not change the fingerprint after canonical ID sort;
- changing a local wall endpoint, thickness, conflict, confidence or opening host changes the fingerprint;
- changing `updatedAt`, diagnostics, decisions or proposal state does not;
- request, revision and fingerprint mismatch each reject the whole batch.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- draft-fingerprint.test.ts
```

Expected: FAIL because fingerprint APIs do not exist.

- [ ] **Step 3: Implement deterministic canonical serialization**

Use explicit ordered records and a small repository-local hash implementation already compatible with browser and Node execution. Do not use object insertion order or environment-dependent JSON. Prefix the digest with `recognition-local-draft-v1:`.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter @vlezet/recognition test -- draft-fingerprint.test.ts ai-proposals.test.ts
pnpm --filter @vlezet/recognition typecheck
```

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/draft-fingerprint.ts packages/recognition/src/draft-fingerprint.test.ts packages/recognition/src/index.ts
git commit -m "feat: fingerprint local recognition drafts"
```

---

### Task 4: Expose bounded runtime-only local evidence

**Files:**
- Create: `packages/recognition/src/ai-local-evidence.ts`
- Create: `packages/recognition/src/ai-local-evidence.test.ts`
- Modify: `packages/recognition/src/recognition-runtime-context.ts`
- Modify: `packages/recognition/src/opening-analysis-runtime.ts`
- Modify: `packages/recognition/src/index.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`
- Create: `apps/web/components/recognition/local-recognition-ai-evidence-source.test.ts`

**Interfaces:**
- Produces:

```ts
type RecognitionAiLocalEvidenceSnapshot = Readonly<{
  widthPx: number;
  heightPx: number;
  localDraftFingerprint: string;
  activeWallIds: readonly string[];
  planBounds: NormalizedBox | null;
  structuralMask: StructuralMaskView;
  doorEvidence: readonly RecognitionAiDoorEvidence[];
  windowEvidence: readonly RecognitionAiWindowEvidence[];
  clutterEvidence: readonly RecognitionAiClutterEvidence[];
}>;

registerAiLocalEvidenceForDraft(draft: RecognitionDraft, evidence: RecognitionAiLocalEvidenceSnapshot): void
peekAiLocalEvidenceForDraft(draft: RecognitionDraft): RecognitionAiLocalEvidenceSnapshot | null
clearAiLocalEvidenceForDraft(draft: RecognitionDraft): void
```

- Evidence is runtime-only and keyed by exact fingerprint, not persisted in `RecognitionDraft`.

- [ ] **Step 1: Write RED evidence tests**

Cover:

- active wall IDs exclude conflicts;
- mask dimensions match the source;
- evidence points to known local wall/opening IDs;
- snapshot budgets reject excessive evidence;
- `peek` does not consume evidence;
- changed fingerprint returns `null`;
- explicit clear removes it.

Add source-level test proving `local-recognition-engine.ts` registers evidence after final active topology/opening analysis and before returning the Draft.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-local-evidence.test.ts
pnpm --filter web test -- local-recognition-ai-evidence-source.test.ts
```

Expected: FAIL because the evidence snapshot and non-consuming lookup do not exist.

- [ ] **Step 3: Implement bounded evidence extraction**

Reuse existing structural mask, door-host evidence, window-host proposal evidence and clutter diagnostics. Do not rescan the raster in the request builder. Keep fixed per-category limits and emit a local diagnostic when evidence is truncated/rejected; do not silently reinterpret an incomplete set as complete.

- [ ] **Step 4: Verify GREEN and local recognition regression tests**

```bash
pnpm --filter @vlezet/recognition test -- ai-local-evidence.test.ts recognition-runtime-context.test.ts opening-analysis
pnpm --filter web test -- local-recognition-ai-evidence-source.test.ts local-recognition-engine
```

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/ai-local-evidence.ts packages/recognition/src/ai-local-evidence.test.ts packages/recognition/src/recognition-runtime-context.ts packages/recognition/src/opening-analysis-runtime.ts packages/recognition/src/index.ts apps/web/components/recognition/local-recognition-engine.ts apps/web/components/recognition/local-recognition-ai-evidence-source.test.ts
git commit -m "feat: expose bounded local proposal evidence"
```

---

### Task 5: Build the provider-neutral request and aligned overlay

**Files:**
- Create: `apps/web/components/recognition/recognition-ai-overlay.ts`
- Create: `apps/web/components/recognition/recognition-ai-overlay.test.ts`
- Create: `apps/web/components/recognition/recognition-ai-request.ts`
- Create: `apps/web/components/recognition/recognition-ai-request.test.ts`
- Modify: `packages/recognition/src/provider.ts`

**Interfaces:**
- Produces:

```ts
type RecognitionAiProposalRequest = Readonly<{
  mode: "proposal-discovery-stage1";
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  imageWidthPx: number;
  imageHeightPx: number;
  sourceImageDataUrl: string;
  overlayImageDataUrl: string;
  localSummary: RecognitionAiLocalSummary;
  budgets: RecognitionAiProposalBudgets;
}>;

renderRecognitionAiOverlay(input: {
  sourceImage: CanvasImageSource;
  widthPx: number;
  heightPx: number;
  localDraft: RecognitionDraft;
}): string

buildRecognitionAiProposalRequest(input: {
  requestId: string;
  sourceImageDataUrl: string;
  sourceImage: CanvasImageSource;
  referenceRevision: string;
  localDraft: RecognitionDraft;
  evidence: RecognitionAiLocalEvidenceSnapshot;
}): RecognitionAiProposalRequest
```

- [ ] **Step 1: Write RED request/overlay tests**

Assert:

- exactly two `image_url` inputs are possible downstream;
- overlay dimensions exactly match source dimensions;
- stable wall labels use local IDs and do not depend on array order;
- overlay does not include provider result geometry;
- request includes fingerprint, revision, allowed proposal kinds, evidence codes and hard budgets;
- missing/mismatched local evidence fails closed before network access.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- recognition-ai-overlay.test.ts recognition-ai-request.test.ts
```

- [ ] **Step 3: Implement the overlay and request**

Use a transparent canvas over the same normalized raster. Render stable short ID labels and candidate centre/axis marks, but keep original source pixels in the first image. The structured summary must be canonical and bounded. Do not include base64 image data in logs or thrown error text.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web test -- recognition-ai-overlay.test.ts recognition-ai-request.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/recognition-ai-overlay.ts apps/web/components/recognition/recognition-ai-overlay.test.ts apps/web/components/recognition/recognition-ai-request.ts apps/web/components/recognition/recognition-ai-request.test.ts packages/recognition/src/provider.ts
git commit -m "feat: build bounded AI proposal requests"
```

---

### Task 6: Implement strict OpenRouter parsing, budgets, and one schema-repair attempt

**Files:**
- Modify: `apps/web/components/recognition/openrouter-schema.ts`
- Modify: `apps/web/components/recognition/openrouter-provider.ts`
- Modify: `apps/web/components/recognition/openrouter-provider.test.ts`
- Create: `apps/web/components/recognition/openrouter-ai-proposal-source.test.ts`
- Preserve: `apps/web/components/recognition/openrouter-model-profile.test.ts`

**Interfaces:**
- Produces:

```ts
recognizeProposals(
  request: RecognitionAiProposalRequest,
  signal: AbortSignal,
): Promise<RecognitionAiProviderEnvelope>
```

- Envelope contains untrusted `AiProposalBatch` plus safe provider/model/latency/usage metadata.
- Existing verifier-only `recognize()` remains available during transition.

- [ ] **Step 1: Write RED provider tests**

Cover exact constants:

```ts
PRIMARY_TIMEOUT_MS === 45_000;
SCHEMA_REPAIR_TIMEOUT_MS === 15_000;
MAX_ATTEMPTS === 2;
MAX_RESPONSE_BYTES === 96 * 1024;
MAX_TOKENS === 4096;
```

Cover:

- first request has exactly two images;
- strict Stage 1 schema rejects walls, labels and thin-wall proposal types;
- invalid structural JSON permits one repair call only;
- repair call contains no image and uses the same model/provider;
- semantic identity mismatch is not repairable;
- response over 96 KiB fails before JSON parsing;
- abort/timeout/rate-limit preserve redacted errors;
- API key, Authorization header, data URLs and raw body never appear in logs/errors.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- openrouter-provider.test.ts openrouter-ai-proposal-source.test.ts
```

- [ ] **Step 3: Implement proposal mode without weakening verifier mode**

Add an explicit method or provider capability rather than overloading `recognize()` ambiguously. Use `temperature: 0`, strict JSON schema, `max_tokens: 4096`, no hidden model substitution, and response streaming disabled. The repair prompt receives the schema and bounded validation error codes only.

- [ ] **Step 4: Verify GREEN and legacy provider tests**

```bash
pnpm --filter web test -- openrouter-provider.test.ts openrouter-ai-proposal-source.test.ts openrouter-model-profile.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/openrouter-schema.ts apps/web/components/recognition/openrouter-provider.ts apps/web/components/recognition/openrouter-provider.test.ts apps/web/components/recognition/openrouter-ai-proposal-source.test.ts
git commit -m "feat: add bounded OpenRouter proposal mode"
```

---

### Task 7: Sanitize whole-batch identity and category budgets

**Files:**
- Create: `packages/recognition/src/ai-proposal-sanity.ts`
- Create: `packages/recognition/src/ai-proposal-sanity.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces:

```ts
type SanitizeAiProposalBatchInput = Readonly<{
  batch: AiProposalBatch;
  expectedIdentity: AiProposalRequestIdentity;
  provider: RecognitionAiProviderIdentity;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
}>;

type SanitizeAiProposalBatchResult = Readonly<{
  sanitized: readonly SanitizedRecognitionProposal[];
  diagnostics: readonly RecognitionDiagnostic[];
}>;

sanitizeAiProposalBatch(input: SanitizeAiProposalBatchInput): SanitizeAiProposalBatchResult
```

- This task implements envelope/identity/category handling and delegates individual opening/advisory sanitation added in Tasks 8–10.

- [ ] **Step 1: Write RED batch tests**

Assert whole batch rejection for:

- wrong schema/request/revision/fingerprint;
- duplicate proposal IDs;
- more than 12 openings;
- more than 12 wall reviews;
- more than 20 diagnostics;
- unsupported type;
- structurally invalid top level.

Assert a single independently malformed proposal can become `blocked` without discarding unrelated valid proposals, only when envelope identity and budgets are valid.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-sanity.test.ts
```

- [ ] **Step 3: Implement fail-closed envelope sanitation**

Do not silently truncate overloaded categories. Return one batch diagnostic and no sanitized proposal for whole-batch failures. Preserve provider reason codes only after allow-list parsing.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-sanity.test.ts ai-proposals.test.ts draft-fingerprint.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/ai-proposal-sanity.ts packages/recognition/src/ai-proposal-sanity.test.ts packages/recognition/src/index.ts
git commit -m "feat: sanitize AI proposal batches"
```

---

### Task 8: Sanitize AI door proposals through existing opening authority

**Files:**
- Create: `packages/recognition/src/ai-opening-sanitizer.ts`
- Create: `packages/recognition/src/ai-door-proposal-sanitizer.test.ts`
- Modify: `packages/recognition/src/ai-proposal-sanity.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces:

```ts
sanitizeAiOpeningProposal(input: {
  proposal: AiOpeningAdditionProposal;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
  provider: RecognitionAiProviderIdentity;
  acceptedSiblingProposals: readonly SanitizedRecognitionProposal[];
}): SanitizedRecognitionProposal
```

- Reuses existing opening validator semantics; it must not introduce a second threshold set.

- [ ] **Step 1: Write RED positive door contract**

Create a local host wall plus bounded mask gap and leaf evidence. Expect:

```ts
expect(result).toMatchObject({
  kind: "door",
  state: "eligible",
  hostWallCandidateId: "wall-1",
  deterministicConfidence: "medium",
});
expect(result.geometry).toMatchObject({ type: "opening", openingKind: "door" });
```

Also assert raw centre/width remain recorded separately from snapped geometry.

- [ ] **Step 2: Write RED fail-closed negatives**

Cover:

- no host, unknown hint, ambiguous two hosts;
- outside span or existing end margin;
- invalid width/orientation;
- absent gap/leaf/arc evidence;
- strong structural mask through the proposed opening;
- text/dimension/sanitary/furniture evidence dominates;
- corner or junction conflict;
- overlap with local opening or prior eligible proposal;
- model confidence `1` cannot bypass any blocker or produce deterministic high confidence.

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-door-proposal-sanitizer.test.ts
```

- [ ] **Step 4: Implement bounded deterministic host selection and validation**

Normalize width using source image dimensions and calibrated host orientation. Host hints may filter candidates, then geometry/evidence chooses exactly one host. Re-run the common opening validator and common duplicate/overlap/corner checks. Block if any authority cannot be evaluated from local evidence.

- [ ] **Step 5: Verify GREEN and current opening tests**

```bash
pnpm --filter @vlezet/recognition test -- ai-door-proposal-sanitizer.test.ts opening-analysis opening-host opening-reconcile
```

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/src/ai-opening-sanitizer.ts packages/recognition/src/ai-door-proposal-sanitizer.test.ts packages/recognition/src/ai-proposal-sanity.ts packages/recognition/src/index.ts
git commit -m "feat: validate AI door proposals"
```

---

### Task 9: Add window evidence, duplicate state, and door/window separation

**Files:**
- Create: `packages/recognition/src/ai-window-proposal-sanitizer.test.ts`
- Modify: `packages/recognition/src/ai-opening-sanitizer.ts`
- Modify: `packages/recognition/src/ai-proposal-sanity.ts`

**Interfaces:** same `sanitizeAiOpeningProposal`; supports `openingKind: "window"`.

- [ ] **Step 1: Write RED positive window contract**

Create one exterior/balcony-compatible active host plus a valid gap and paired rail/frame evidence. Expect eligible medium-confidence window with known host.

- [ ] **Step 2: Write RED duplicate and negative contracts**

Cover:

- geometric duplicate of a local opening returns `state: "duplicate"`, not eligible;
- window proposal over door leaf/gap evidence is blocked;
- arbitrary unexplained gap is blocked;
- interior host without exterior/balcony compatibility is blocked;
- one rail only, furniture/sanitary edge, source frame and dimension line are blocked;
- ambiguous host chain, endpoint margin, overlap and forbidden region are blocked.

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-window-proposal-sanitizer.test.ts
```

- [ ] **Step 4: Implement window-specific evidence and common dedupe**

Use existing window-host/rail proposal evidence. Do not accept a provider window from confidence or a bare gap. Reuse the same host-chain and duplicate logic as local openings.

- [ ] **Step 5: Verify GREEN**

```bash
pnpm --filter @vlezet/recognition test -- ai-window-proposal-sanitizer.test.ts window-host window-mask opening-analysis
```

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/src/ai-window-proposal-sanitizer.test.ts packages/recognition/src/ai-opening-sanitizer.ts packages/recognition/src/ai-proposal-sanity.ts
git commit -m "feat: validate AI window proposals"
```

---

### Task 10: Add exact-ID false-wall advisory with structural protection

**Files:**
- Create: `packages/recognition/src/ai-wall-review-sanitizer.ts`
- Create: `packages/recognition/src/ai-wall-review-sanitizer.test.ts`
- Modify: `packages/recognition/src/ai-proposal-sanity.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Produces:

```ts
sanitizeAiLocalWallReviewProposal(input: {
  proposal: AiLocalWallReviewProposal;
  localDraft: RecognitionDraft;
  localEvidence: RecognitionAiLocalEvidenceSnapshot;
  provider: RecognitionAiProviderIdentity;
}): SanitizedRecognitionProposal
```

- Eligible advisory has `geometry: null`, exact `targetLocalCandidateId`, and low deterministic confidence.

- [ ] **Step 1: Write RED washbasin/sanitary positive**

Use a short target wall whose source region overlaps, structural-mask support is weak, fewer than two anchors exist, and local symbol-clutter evidence is present. Expect eligible `local-wall-review` advisory.

- [ ] **Step 2: Write RED protected-wall negatives**

Block:

- unknown/changed target ID or fingerprint;
- source region not overlapping target;
- long structural wall;
- strong mask-backed wall;
- two-anchor partition;
- candidate outside bounded clutter profile;
- provider asking to delete/move geometry rather than `likely-clutter`.

- [ ] **Step 3: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-wall-review-sanitizer.test.ts
```

- [ ] **Step 4: Implement exact-ID advisory only**

Do not modify target conflict/confidence/evidence/decision. Store reasons explaining both eligible and protected/blocked outcomes.

- [ ] **Step 5: Verify GREEN and clutter-veto regressions**

```bash
pnpm --filter @vlezet/recognition test -- ai-wall-review-sanitizer.test.ts structural-clutter-veto topology-sanity
```

- [ ] **Step 6: Commit**

```bash
git add packages/recognition/src/ai-wall-review-sanitizer.ts packages/recognition/src/ai-wall-review-sanitizer.test.ts packages/recognition/src/ai-proposal-sanity.ts packages/recognition/src/index.ts
git commit -m "feat: add protected AI wall advisories"
```

---

### Task 11: Reconcile proposals idempotently without local mutation

**Files:**
- Create: `packages/recognition/src/ai-proposal-reconcile.ts`
- Create: `packages/recognition/src/ai-proposal-reconcile.test.ts`
- Modify: `packages/recognition/src/index.ts`
- Preserve verifier behavior in: `packages/recognition/src/reconcile.ts`

**Interfaces:**
- Produces:

```ts
reconcileAiProposalBatch(input: {
  localDraft: RecognitionDraft;
  sanitized: readonly SanitizedRecognitionProposal[];
  metadata: RecognitionAiProposalMetadata;
  now: string;
}): RecognitionDraft
```

- [ ] **Step 1: Write RED immutability/idempotence tests**

Assert byte-equivalence for local `walls`, `openings`, `roomLabels`, `decisions`, `source`, `createdAt` and all local candidate nested fields before/after reconciliation. Assert:

- eligible/blocked/duplicate remain separate;
- decisions default to pending only for eligible proposals;
- blocked/duplicate cannot receive accepted decision;
- local IDs and proposal IDs cannot share decision namespace;
- identical batch is idempotent;
- changed local Draft fingerprint invalidates old proposals and decisions;
- provider failure preserves the previous valid proposal batch and all local state.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-reconcile.test.ts
```

- [ ] **Step 3: Implement separate immutable collections**

Never append proposals to `walls` or `openings`. Sort proposal storage deterministically by ID. On a new valid batch, replace only proposal collections/metadata. On stale identity, retain local Draft and append a bounded diagnostic; do not apply partial state.

- [ ] **Step 4: Verify GREEN and legacy reconcile tests**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-reconcile.test.ts opening-reconcile reconcile
```

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/ai-proposal-reconcile.ts packages/recognition/src/ai-proposal-reconcile.test.ts packages/recognition/src/index.ts
git commit -m "feat: reconcile AI proposals separately"
```

---

### Task 12: Make controller runs race-safe and implement explicit advisory actions

**Files:**
- Modify: `apps/web/components/recognition/recognition-controller.ts`
- Create: `apps/web/components/recognition/recognition-controller-ai-proposals.test.ts`

**Interfaces:**
- Add controller state `running-ai-proposals` with exact request identity.
- Add:

```ts
startAiProposalDiscovery(run: RecognitionAiProposalRunner): Promise<void>
updateProposalDecision(proposalId: string, decision: RecognitionProposalDecision): Promise<void>
agreeWithWallAdvisory(proposalId: string): Promise<void>
```

- `agreeWithWallAdvisory` explicitly sets the targeted local Draft decision to `rejected` and proposal decision to `accepted` only after rechecking exact target/fingerprint.

- [ ] **Step 1: Write RED controller tests**

Cover:

- missing session/evidence/key produces no mutation;
- cancellation and a newer run prevent an older response from replacing state;
- stale reference/fingerprint rejects the response;
- timeout/error returns to review with prior Draft/proposals intact and redacted diagnostic;
- proposal decisions only target eligible known proposals;
- agreeing with advisory rejects only the local Draft candidate;
- no existing document entity is touched;
- editing/rerunning local recognition invalidates proposal state.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- recognition-controller-ai-proposals.test.ts
```

- [ ] **Step 3: Implement request tokens and explicit state transitions**

Use an `AbortController` plus monotonic request ID/current identity check before persistence. Do not reuse `replaceDraft` with raw provider data. Persist only fully validated/reconciled Drafts.

- [ ] **Step 4: Verify GREEN and existing controller tests**

```bash
pnpm --filter web test -- recognition-controller-ai-proposals.test.ts recognition-controller
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/recognition-controller.ts apps/web/components/recognition/recognition-controller-ai-proposals.test.ts
git commit -m "feat: control AI proposal sessions safely"
```

---

### Task 13: Build transparent proposal UI and source filters

**Files:**
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Create: `apps/web/components/recognition/recognition-ai-proposal-review.test.tsx`
- Modify: `apps/web/components/recognition/recognition-opening-review.test.tsx`
- Modify: `apps/web/components/recognition/recognition-panel-ai-warning-source.test.ts`

**Interfaces:**
- UI filters: `all`, `local`, `ai-proposals`, `questioned-local`.
- Eligible AI geometry is drawn dashed and labeled `Предложение AI`.
- Blocked/duplicate proposals appear only as diagnostics/evidence cards, never normal selectable geometry.

- [ ] **Step 1: Write RED review/UI contracts**

Assert Russian copy and behavior:

- action text distinguishes immutable verification from omission search;
- cards display provider/model confidence separately from deterministic confidence;
- eligible proposal explains host/evidence/reasons;
- blocked proposal explains exact blocker and has no Accept action;
- duplicate proposal explains that geometry already exists;
- false-wall advisory displays:

```text
AI считает эту локальную линию вероятным обозначением сантехники или мебели. Согласие отклонит только кандидат локального черновика и не удалит уже существующую стену квартиры.
```

- narrow viewport and keyboard focus keep controls reachable;
- local candidates remain visually unchanged after proposal reconciliation.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- recognition-ai-proposal-review.test.tsx recognition-opening-review.test.tsx
```

- [ ] **Step 3: Implement source badges, filters and evidence cards**

Keep the existing Review panel structure. Add a separate proposal renderer rather than branching ordinary wall/opening cards into mixed authority. Use semantic buttons and visible focus. Do not color blocked proposals as active geometry.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web test -- recognition-ai-proposal-review.test.tsx recognition-opening-review.test.tsx recognition-panel-ai-warning-source.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/recognition-panel.tsx apps/web/components/recognition/recognition-ai-proposal-review.test.tsx apps/web/components/recognition/recognition-opening-review.test.tsx apps/web/components/recognition/recognition-panel-ai-warning-source.test.ts
git commit -m "feat: review AI proposals transparently"
```

---

### Task 14: Revalidate and apply accepted proposals atomically

**Files:**
- Create: `packages/recognition/src/ai-proposal-apply.ts`
- Create: `packages/recognition/src/ai-proposal-apply.test.ts`
- Modify: `packages/recognition/src/index.ts`
- Modify: `apps/web/components/recognition/recognition-apply.ts`
- Modify: `apps/web/components/recognition/recognition-apply.test.ts`
- Modify: `apps/web/components/recognition/recognition-incremental-apply.test.ts`
- Modify: `apps/web/components/recognition/recognition-history-sync.test.ts`

**Interfaces:**
- Produces:

```ts
type RecognitionAtomicApplyPreflight = Readonly<{
  applicableDraft: RecognitionDraft;
  acceptedProposalIds: readonly string[];
  diagnostics: readonly RecognitionApplyDiagnostic[];
}>;

prepareAtomicRecognitionApply(input: {
  draft: RecognitionDraft;
  referencePlan: ReferencePlan;
  document: VlezetDocument;
}): RecognitionAtomicApplyPreflight
```

- The applicable Draft is transient; accepted proposal openings are converted to ordinary opening candidates only after complete revalidation.

- [ ] **Step 1: Write RED atomicity tests**

Cover:

- accepted eligible proposed opening maps to an existing/accepted host and applies;
- local new wall plus dependent proposal applies in one batch;
- unresolved/stale host blocks the entire geometry batch;
- one invalid accepted local/proposal geometry item leaves the document byte-equivalent;
- blocked/duplicate proposal cannot apply;
- false-wall advisory emits no domain command;
- repeated Apply creates no duplicate opening;
- two successful Apply batches remain independent semantic Undo/Redo units;
- document change between review and Apply is detected in preflight.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-apply.test.ts
pnpm --filter web test -- recognition-apply.test.ts recognition-incremental-apply.test.ts recognition-history-sync.test.ts
```

- [ ] **Step 3: Implement preflight before any mutation**

Build all host mappings, topology sanitation, widths, offsets, duplicate/conflict checks and expected commands against an isolated document value. Treat any error-severity diagnostic for an accepted geometry item as a batch failure and return the original document. Only after all checks pass should the existing planner produce one final immutable result. Do not create a parallel history command path.

- [ ] **Step 4: Verify GREEN and history semantics**

```bash
pnpm --filter @vlezet/recognition test -- ai-proposal-apply.test.ts
pnpm --filter web test -- recognition-apply.test.ts recognition-incremental-apply.test.ts recognition-history-sync.test.ts recognition-applied-state.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/ai-proposal-apply.ts packages/recognition/src/ai-proposal-apply.test.ts packages/recognition/src/index.ts apps/web/components/recognition/recognition-apply.ts apps/web/components/recognition/recognition-apply.test.ts apps/web/components/recognition/recognition-incremental-apply.test.ts apps/web/components/recognition/recognition-history-sync.test.ts
git commit -m "feat: apply AI proposals atomically"
```

---

### Task 15: Wire the complete flow without a second document mutation path

**Files:**
- Modify: `apps/web/components/projects/project-app.tsx`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Create: `apps/web/components/recognition/recognition-ai-workflow-source.test.ts`

**Interfaces:**
- Connect local Draft → evidence → request → provider → batch sanitation → proposal reconciliation → review → existing Apply/history.

- [ ] **Step 1: Write RED source/integration contract**

Assert:

- proposal runner is injected into the controller;
- raw provider result never reaches `replaceDraft`, `walls`, `openings` or document setters;
- UI action requires current non-stale local Draft and selected provider/model;
- local-only flow remains fully available without a key;
- proposal Apply calls only the existing atomic recognition Apply boundary.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- recognition-ai-workflow-source.test.ts
```

- [ ] **Step 3: Implement orchestration**

Generate one exact identity per run, keep provider/model metadata visible, and preserve previous proposals until a new valid batch replaces them. A provider error must not clear the local Draft or previous valid proposals.

- [ ] **Step 4: Verify GREEN plus build/typecheck**

```bash
pnpm --filter web test -- recognition-ai-workflow-source.test.ts recognition-controller-ai-proposals.test.ts recognition-ai-proposal-review.test.tsx
pnpm --filter web typecheck
pnpm --filter web build
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/projects/project-app.tsx apps/web/components/recognition/recognition-panel.tsx apps/web/components/recognition/recognition-ai-workflow-source.test.ts
git commit -m "feat: wire hybrid AI proposal recovery"
```

---

### Task 16: Complete deterministic proposal scoring and merge-blocking safety gate

**Files:**
- Modify: `tools/recognition-benchmark/ai-benchmark/score.d.mts`
- Modify: `tools/recognition-benchmark/ai-benchmark/score.mjs`
- Modify: `tools/recognition-benchmark/ai-benchmark/report.mjs`
- Create: `tools/recognition-benchmark/ai-proposal-gate.mjs`
- Create: `tools/recognition-benchmark/ai-proposal-gate.test.mjs`
- Modify: `package.json`
- Modify: recorded proposal fixtures from Task 1.
- Create: `packages/recognition/src/ai-proposal-benchmark-contract.test.ts`

**Interfaces:**
- Adds script:

```json
"benchmark:recognition:ai-proposal-gate": "node tools/recognition-benchmark/ai-proposal-gate.mjs"
```

- Report counters:
  - eligible/recovered door/window TP, FP, FN;
  - sanitizer acceptance precision;
  - eligible unknown-host/outside-host;
  - direct local mutations;
  - stale decisions;
  - protected strong-wall advisories;
  - forbidden-region eligible proposals;
  - repeated replay determinism.

- [ ] **Step 1: Write RED scoring/gate tests**

Create suppressed-local-opening scenarios so proposal recall is measured. Assert current empty recorded batch fails recovered door/window/advisory expectations. Assert every safety counter is merge-blocking at zero from the first green implementation.

- [ ] **Step 2: Verify RED**

```bash
node --test tools/recognition-benchmark/ai-proposal-gate.test.mjs
pnpm --filter @vlezet/recognition test -- ai-proposal-benchmark-contract.test.ts ai-proposal-recorded-fixtures.test.ts
```

- [ ] **Step 3: Implement deterministic scoring and reviewed recorded batches**

Record sanitized provider responses for public analogues. Do not use live provider calls. Keep local metrics separate. Do not promote a numerical proposal F1 threshold until the first reviewed baseline; scenario safety and material recovery assertions are mandatory immediately.

- [ ] **Step 4: Verify GREEN and no local metric regression**

```bash
pnpm benchmark:recognition:ai-proposal-gate
pnpm benchmark:recognition:core
pnpm benchmark:recognition:m7-8c-gate
pnpm benchmark:recognition:real:verify
pnpm benchmark:recognition:real-source-score
```

Expected: existing Core/Source gates unchanged; proposal gate recovers at least one true door and one true window; all safety counters zero. The existing immutable real-fixture threshold remains honestly reported until its independent conditions are met.

- [ ] **Step 5: Commit**

```bash
git add tools/recognition-benchmark/ai-benchmark tools/recognition-benchmark/ai-proposal-gate.mjs tools/recognition-benchmark/ai-proposal-gate.test.mjs package.json packages/recognition/benchmarks/real-analogues/recorded-ai-proposals packages/recognition/src/ai-proposal-benchmark-contract.test.ts packages/recognition/src/ai-proposal-recorded-fixtures.test.ts
git commit -m "test: gate deterministic AI proposal recovery"
```

---

### Task 17: Preserve CI, secret, privacy, and paid-run boundaries

**Files:**
- Modify: `.github/workflows/recognition-benchmark.yml`
- Modify: `.github/workflows/recognition-ai-benchmark.yml`
- Modify: `packages/recognition/src/ai-benchmark-contract.test.ts`
- Modify: `packages/recognition/src/ai-benchmark-workflow.test.ts`

**Interfaces:** no runtime API.

- [ ] **Step 1: Write RED workflow/security tests**

Assert:

- proposal gate runs on pull requests without secrets/network;
- live OpenRouter proposal benchmark is only `workflow_dispatch`/approved schedule;
- fork/PR events cannot access paid AI;
- workflow permissions remain `contents: read`;
- model/fixture/repetition/token/time/cost bounds are fixed;
- artifacts contain sanitized proposal records, not source base64/raw private raster/provider headers;
- secret absence fails closed with clear result.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/recognition test -- ai-benchmark-contract.test.ts ai-benchmark-workflow.test.ts
```

- [ ] **Step 3: Update workflows**

Add `pnpm benchmark:recognition:ai-proposal-gate` to deterministic benchmark CI. Extend manual AI workflow inputs with `mode: proposal-discovery-stage1`; enforce existing hard maxima and bounded artifact retention. Do not add write permissions.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter @vlezet/recognition test -- ai-benchmark-contract.test.ts ai-benchmark-workflow.test.ts
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/recognition-benchmark.yml .github/workflows/recognition-ai-benchmark.yml packages/recognition/src/ai-benchmark-contract.test.ts packages/recognition/src/ai-benchmark-workflow.test.ts
git commit -m "ci: gate hybrid AI proposals safely"
```

---

### Task 18: Add Chromium/WebKit acceptance for review, recovery, restore, and history

**Files:**
- Create: `apps/web/e2e/recognition-ai-proposals.spec.ts`
- Modify Playwright configuration only if the current project list cannot target this spec.

**Interfaces:** browser-level product contract.

- [ ] **Step 1: Write RED Chromium full-flow test**

Use a public analogue and a stubbed recorded provider batch. Cover:

1. local-only operation with no key;
2. start proposal discovery;
3. progress and cancellation;
4. retry with eligible door/window and washbasin advisory;
5. local geometry snapshot unchanged;
6. source filters and distinct dashed AI geometry;
7. blocker explanations without Accept;
8. advisory wording and explicit agreement;
9. atomic Apply;
10. repeated Apply no-op;
11. two Apply batches with independent Undo/Redo;
12. restored project retains proposal metadata/decisions;
13. stale local rerun invalidates old proposals;
14. narrow viewport/keyboard reachability.

- [ ] **Step 2: Write RED WebKit representative test**

Cover local-only, eligible proposal review, atomic Apply and restore. Avoid duplicating every Chromium scenario.

- [ ] **Step 3: Verify RED**

Run the repository’s existing browser audit command targeting `recognition-ai-proposals.spec.ts`. Expected: FAIL until UI/orchestration/Apply are complete.

- [ ] **Step 4: Implement only test harness support needed for deterministic provider stubbing**

Do not add production-only test switches. Use existing network interception or dependency injection patterns.

- [ ] **Step 5: Verify GREEN**

Run Chromium full flow and WebKit representative flow. Capture screenshots/traces as CI artifacts. Then run existing M7 browser tests to ensure no workflow regression.

- [ ] **Step 6: Commit**

```bash
git add apps/web/e2e/recognition-ai-proposals.spec.ts
git commit -m "test: cover AI proposal recovery in browsers"
```

---

### Task 19: Exact-head verification, live-model qualification, and product-owner gate

**Files after explicit PASS only:**
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Create: `docs/milestones/m7-8c-1-hybrid-ai-proposal-recovery-acceptance.md`
- Update PR metadata to canonical M7.8C.1 naming.

**Interfaces:** no runtime API.

- [ ] **Step 1: Run all deterministic gates**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm validate:m7-docs
pnpm benchmark:recognition:core
pnpm benchmark:recognition:m7-8c-gate
pnpm benchmark:recognition:real:verify
pnpm benchmark:recognition:real-source-score
pnpm benchmark:recognition:ai-proposal-gate
```

Expected:
- Core/Source stay green;
- local-only predictions remain unchanged unless a separately reviewed local fix exists;
- no threshold/baseline reduction;
- all Stage 1 safety counters are zero;
- deterministic recorded replay recovers a true door and window.

- [ ] **Step 2: Push exact head and collect Actions evidence**

Require Standard CI, Core/Source, proposal gate, Chromium, and WebKit PASS. Report current immutable real-fixture gate honestly. Record exact head, run IDs, artifact IDs, and digests.

- [ ] **Step 3: Run manual live-model benchmark**

At least three repetitions per selected public analogue fixture. Qualification requires stable normalized proposals, no contract violation, measurable sanitized recall gain, reviewed false-proposal rate, latency, token use, cost, and explicit provider/model route. A single run cannot choose the default model.

- [ ] **Step 4: Product-owner retest on original plan**

On exact head:
1. rotation `0°`;
2. rerun local and capture screenshot;
3. run selected AI omission search and capture screenshot before Apply;
4. verify no local geometry moved or changed;
5. at least one previously missed unambiguous door is eligible;
6. at least one previously missed unambiguous window is eligible;
7. every other marked unambiguous window is eligible or has a specific reviewed blocker;
8. washbasin wall has eligible advisory or an independently tested local fix;
9. no automatic Apply;
10. source/confidence/evidence are understandable;
11. local Draft survives provider failure;
12. two Apply batches, repeated Apply, Undo, and Redo remain correct.

Stage 1 remains FAIL if only blocked explanations are returned.

- [ ] **Step 5: Update canonical docs only after explicit PASS and merge sequencing decision**

Document the thin balcony/loggia wall as Stage 2. Resolve whether PR #42 is independently accepted or explicitly superseded before retargeting/merging. Rename PR metadata from M7.9 to canonical M7.8C.1 before merge.

- [ ] **Step 6: Commit acceptance docs**

```bash
git add docs/PROJECT_STATE.md docs/ROADMAP.md docs/CHANGELOG.md docs/milestones
git commit -m "docs: accept M7.8C.1 hybrid AI proposal recovery"
```

Do not mark Ready or merge before explicit product-owner PASS.

---

## Stop / Revert Criteria

Stop the current slice and revert its implementation commit if any condition occurs:

1. provider output directly becomes an ordinary local wall/opening candidate before sanitation;
2. an AI run changes local geometry, host, classification, confidence, conflict, evidence, or decisions without explicit user action;
3. unknown, inactive, ambiguous, outside-span, stale, or unsupported-host proposal becomes eligible/applied;
4. an AI proposal reaches deterministic `high`;
5. strong/two-anchor/long structural wall becomes an eligible false-wall advisory;
6. one invalid accepted geometry item allows partial document mutation;
7. repeated AI, Apply, Undo, or Redo creates duplicates or stale decisions;
8. existing Core/Source accepted metrics regress;
9. a designated forbidden region gains an eligible/applied proposal;
10. paid AI becomes reachable from a pull-request event;
11. Stage 1 begins creating walls or editing local wall geometry;
12. implementation lowers a current threshold or rewrites a baseline to make CI green.

## Stage 1 Completion Record

Stage 1 is complete only on one exact head where:

- unit, typecheck, lint, build, docs, Core, Source, proposal gate, Chromium, and WebKit pass;
- eligible unknown-host openings = `0`;
- eligible outside-host openings = `0`;
- direct local mutation count = `0`;
- stale proposal decisions = `0`;
- protected strong-wall false advisory count = `0`;
- forbidden-region eligible proposals = `0`;
- deterministic recorded replay passes;
- atomic Apply and semantic Undo/Redo pass;
- the product-owner plan materially recovers at least one missed true door and one missed true window;
- washbasin advisory behavior is transparent and non-destructive;
- thin balcony/loggia wall remains explicitly deferred to Stage 2;
- no PR is merged before explicit product-owner acceptance.

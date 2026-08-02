# M7.8B Evidence-Gated Wall Completion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Recover short, visually supported wall gaps and nearby junctions without bridging doors, empty space, furniture, or ambiguous geometry.

**Architecture:** Add a pure `wall-completion` domain module that consumes immutable centerlines and a read-only structural-mask view, emits bounded completed centerlines plus deterministic diagnostics, and never mutates input. Integrate it only in the browser engine’s region-first path before `buildLocalWallTopology()`. Keep Hough fallback, verification-only AI, document authority, persistence, Apply/Undo, M2, planner, and 3D unchanged.

**Tech Stack:** TypeScript, Vitest, OpenCV.js structural mask adapter, existing `@vlezet/recognition` package, Chromium source benchmark, GitHub Actions.

## Global Constraints

- Fail closed: ambiguous or weak evidence leaves the wall fragmented.
- One completion pass only; accepted bridges cannot become evidence for further bridges in the same run.
- No random values or insertion-order dependence.
- Maximum 80 input centerlines, 512 pair comparisons, 64 hypotheses, 16 accepted completions, and 4096 mask samples per hypothesis.
- Completed geometry cannot receive `high` confidence from local completion.
- Door/window classification remains out of scope.
- No changes to `VlezetDocument`, IndexedDB, project formats, Apply/Undo, M2, planner, 3D, or provider-secret handling.
- Engine version changes from `5` to `6` only after exact-head Source benchmark improvement and no protected-fixture regression.

---

### Task 1: Pure completion contracts and fail-closed validation

**Files:**
- Create: `packages/recognition/src/wall-completion.ts`
- Create: `packages/recognition/src/wall-completion.test.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Consumes: `LocalWallCenterline` from `wall-topology.ts`.
- Produces:

```ts
export interface StructuralMaskView {
  widthPx: number;
  heightPx: number;
  isStructural(x: number, y: number): boolean;
}

export type WallCompletionDiagnosticCode =
  | "bridge-accepted"
  | "bridge-gap-too-large"
  | "bridge-offset-mismatch"
  | "bridge-thickness-mismatch"
  | "bridge-insufficient-raster-support"
  | "bridge-likely-opening"
  | "bridge-ambiguous-target"
  | "junction-extension-accepted"
  | "junction-extension-ambiguous"
  | "completion-budget-exceeded"
  | "completion-invalid-input";

export interface WallCompletionOptions {
  maximumInputCenterlines: number;
  maximumPairComparisons: number;
  maximumHypotheses: number;
  maximumAcceptedCompletions: number;
  maximumSamplesPerHypothesis: number;
  maximumAngleDeltaDeg: number;
  maximumOffsetThicknessRatio: number;
  maximumThicknessDeltaRatio: number;
  maximumGapThicknessRatio: number;
  maximumGapShortSideRatio: number;
  maximumGapPx: number;
  minimumOccupancyRatio: number;
  minimumContinuousRunRatio: number;
  likelyOpeningMaximumOccupancyRatio: number;
  junctionExtensionThicknessRatio: number;
}

export interface CompleteWallCenterlinesInput {
  centerlines: readonly LocalWallCenterline[];
  mask: StructuralMaskView;
  options: WallCompletionOptions;
}

export interface WallCompletionResult {
  centerlines: readonly LocalWallCenterline[];
  diagnostics: readonly {
    code: WallCompletionDiagnosticCode;
    firstIndex: number | null;
    secondIndex: number | null;
    message: string;
  }[];
  acceptedCompletionCount: number;
}

export function completeWallCenterlines(input: CompleteWallCenterlinesInput): WallCompletionResult;
```

- [ ] **Step 1: Write RED validation tests**

Add tests that invalid mask dimensions, non-finite centerline coordinates, negative thresholds, and more than 80 centerlines return the original canonical centerlines with deterministic `completion-invalid-input` or `completion-budget-exceeded` diagnostics and no partial output.

- [ ] **Step 2: Run the focused tests**

Run: `pnpm --filter @vlezet/recognition test -- wall-completion.test.ts`
Expected: FAIL because `wall-completion.ts` and exports do not exist.

- [ ] **Step 3: Implement immutable contracts and validation**

Implement canonical endpoint ordering, stable sorting, option validation, immutable copies, and budget fallback. Do not implement bridge acceptance yet.

- [ ] **Step 4: Re-run focused tests**

Expected: PASS for validation and determinism scaffolding.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-completion.ts packages/recognition/src/wall-completion.test.ts packages/recognition/src/index.ts
git commit -m "feat: add bounded wall completion contracts"
```

### Task 2: Evidence-gated collinear micro-gap bridges

**Files:**
- Modify: `packages/recognition/src/wall-completion.ts`
- Modify: `packages/recognition/src/wall-completion.test.ts`

**Interfaces:**
- Consumes: contracts from Task 1.
- Produces: deterministic collinear bridge hypotheses and completed centerlines with `completion-raster-bridge` reason.

- [ ] **Step 1: Write RED bridge tests**

Add fixtures for:

```ts
const left = line(20, 40, 80, 40, 10);
const right = line(88, 40, 150, 40, 10);
```

Require a bridge when the mask contains a continuous 10 px thick band across `x=20..150`, and reject when the gap `x=81..87` is structurally empty. Require identical results for reversed endpoints and permuted input.

- [ ] **Step 2: Run focused tests**

Expected: FAIL because no hypotheses are accepted.

- [ ] **Step 3: Implement pair discovery and corridor sampling**

Implement:

- stable orientation grouping and bounded pair iteration;
- angle, perpendicular offset, thickness compatibility, and adaptive maximum-gap checks;
- fixed-step raster sampling bounded by `maximumSamplesPerHypothesis`;
- occupancy ratio and longest continuous run ratio;
- clean-gap rejection as `bridge-likely-opening`;
- mutual-best pair selection;
- one-pass application using only original centerlines;
- merged confidence capped at `medium` and reasons including `completion-raster-bridge`.

- [ ] **Step 4: Re-run focused tests**

Expected: PASS for supported bridge, opening rejection, and permutation stability.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-completion.ts packages/recognition/src/wall-completion.test.ts
git commit -m "feat: bridge raster-supported wall micro-gaps"
```

### Task 3: Safe corner and T-junction completion

**Files:**
- Modify: `packages/recognition/src/wall-completion.ts`
- Modify: `packages/recognition/src/wall-completion.test.ts`

**Interfaces:**
- Consumes: original centerlines and mask; does not consume newly bridged output as evidence.
- Produces: endpoint-adjusted original centerlines with `completion-junction-extension` reason.

- [ ] **Step 1: Write RED junction tests**

Add:

- one horizontal line ending 6 px before one vertical thick region: extend to the unique intersection;
- two equally close vertical targets: reject with `junction-extension-ambiguous`;
- target with incompatible thickness: reject;
- two sequential weak gaps: ensure one pass cannot cascade through both.

- [ ] **Step 2: Run focused tests**

Expected: FAIL because endpoint extension is absent.

- [ ] **Step 3: Implement unique-target extension**

Generate nearby perpendicular targets from original input only. Accept exactly one target within `junctionExtensionThicknessRatio * compatibleThickness`, require direct mask support or termination in a confirmed structural band, cap confidence at `medium`, and never create a free-standing new wall.

- [ ] **Step 4: Re-run focused tests**

Expected: PASS for corner/T completion, ambiguity rejection, and no cascade.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-completion.ts packages/recognition/src/wall-completion.test.ts
git commit -m "feat: complete supported wall junctions"
```

### Task 4: Region-first browser-engine integration and diagnostics

**Files:**
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-region-source.test.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-source.test.ts`

**Interfaces:**
- Consumes: `completeWallCenterlines()` and the existing OpenCV `structuralMask.data`.
- Produces: region-first completed centerlines before topology plus debug counts.

- [ ] **Step 1: Write RED integration tests**

Require source text and browser behavior to prove:

- completion runs only when `selectedMode === "regions"`;
- the structural-mask adapter bounds-checks coordinates;
- Hough strict/adaptive flow remains unchanged;
- debug output includes `completionAcceptedCount` and aggregate diagnostic codes;
- Worker/shared-engine result remains deterministic.

- [ ] **Step 2: Run web unit tests**

Run: `pnpm --filter @vlezet/web test -- local-recognition-engine-region-source.test.ts local-recognition-engine-source.test.ts`
Expected: FAIL because integration fields and call are absent.

- [ ] **Step 3: Integrate without changing fallback authority**

Adapt `structuralMask.data` to `StructuralMaskView`, call completion on region-derived centerlines before final topology construction, and expose only aggregate debug diagnostics. Do not call completion for strict/adaptive Hough modes.

- [ ] **Step 4: Run recognition and web tests**

Run:

```bash
pnpm --filter @vlezet/recognition test
pnpm --filter @vlezet/web test -- local-recognition-engine-region-source.test.ts local-recognition-engine-source.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/local-recognition-engine.ts apps/web/components/recognition/local-recognition-engine-region-source.test.ts apps/web/components/recognition/local-recognition-engine-source.test.ts
git commit -m "feat: apply wall completion in region-first recognition"
```

### Task 5: Confidence calibration and protected regressions

**Files:**
- Modify: `packages/recognition/src/wall-completion.test.ts`
- Modify: `packages/recognition/src/wall-topology.test.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine-region-source.test.ts`

**Interfaces:**
- Consumes: completion reasons and topology output.
- Produces: confidence capped by observed/completed ratio and topology support.

- [ ] **Step 1: Write RED confidence tests**

Require:

- short supported completion remains `medium`;
- near-threshold occupancy becomes `low`;
- unsupported disconnected result remains `low`;
- completion never produces `high` without later AI verification;
- accepted AI verification still cannot move geometry.

- [ ] **Step 2: Run focused tests**

Expected: FAIL on missing calibration.

- [ ] **Step 3: Implement deterministic calibration**

Compute completed-span ratio, raster margin above threshold, thickness consistency, and junction support. Assign only `low` or `medium`; preserve verification-only AI contracts.

- [ ] **Step 4: Run full unit suites**

Run:

```bash
pnpm --filter @vlezet/recognition test
pnpm --filter @vlezet/web test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-completion.test.ts packages/recognition/src/wall-topology.test.ts apps/web/components/recognition/local-recognition-engine-region-source.test.ts
git commit -m "test: lock conservative wall completion confidence"
```

### Task 6: Exact-head benchmark decision and engine migration

**Files:**
- Modify only if metrics justify migration: `packages/recognition/src/engine-version.ts`
- Modify only after reviewed result: `packages/recognition/benchmarks/baselines/recognition-v1.json`
- Modify stale version/SHA contracts only after exact-head result: benchmark acceptance tests and docs.

**Interfaces:**
- Consumes: exact-head Core and Chromium Source reports.
- Produces: either engine `6` reviewed baseline or rollback to engine `5` with no baseline change.

- [ ] **Step 1: Run exact-head benchmark before version change**

Run:

```bash
pnpm recognition:benchmark
pnpm recognition:benchmark:source
```

Required gates:

- `clutter-symbol-regression` remains `TP 12 / FP 0 / FN 0`;
- no fixture gains incorrect high-confidence candidates;
- unknown-host openings and stale decisions remain `0`;
- aggregate Source geometry/topology F1 must not decrease;
- at least one previously fragmented fixture must improve geometry or topology evidence.

- [ ] **Step 2: Inspect overlays and per-fixture evidence**

Reject migration if a metric increase comes from bridging a clean door-sized gap or adding false long walls.

- [ ] **Step 3: Migrate engine only on PASS**

Change:

```ts
export const LOCAL_RECOGNITION_ENGINE_VERSION = "6" as const;
```

Then create a reviewed baseline from the exact-head Core report. Never auto-update baseline.

- [ ] **Step 4: Run all exact-head gates**

Run Standard CI, Recognition Benchmark, Chromium M7 audit, and WebKit smoke on the same SHA. Verify evidence ZIP with `sha256sum -c SHA256SUMS`.

- [ ] **Step 5: Commit migration or rollback**

PASS commit:

```bash
git commit -am "feat: migrate recognition engine to evidence-gated completion v6"
```

FAIL action: revert completion integration commits, retain tests/design evidence, keep engine `5`, and document why the measured change was rejected.

### Task 7: Acceptance documentation and product-owner gate

**Files:**
- Modify: `docs/milestones/m7-8b-acceptance.md`
- Modify: `docs/changelog/2026-08-02-m7-8b.md`
- Modify: PR #41 body

- [ ] **Step 1: Record exact implementation head and evidence**

Include run IDs, artifact ID/digest, Core/Source aggregate metrics, dense/clutter per-fixture evidence, completion accepted/rejected counts, and known limitations.

- [ ] **Step 2: Preserve partial-PASS semantics**

Do not mark M7.8B complete until the representative real plan confirms improved continuity without closing openings or adding false walls.

- [ ] **Step 3: Request the focused product check**

The user must repeat local recognition and GPT-4o verification on the same plan, checking exterior continuity, principal internal walls, preserved gaps, unchanged AI geometry, Apply, and Undo.

- [ ] **Step 4: Final merge gate**

Only literal Product Owner PASS permits Draft → Ready, final exact-head rerun, and squash merge.

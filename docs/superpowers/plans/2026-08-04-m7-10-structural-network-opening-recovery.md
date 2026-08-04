# M7.10 Structural Network and Opening Recovery — Implementation Plan

> Execute inline with strict RED → GREEN commits. Keep PR #43 Draft and do not merge.

**Goal:** Raise the twelve-fixture deterministic wall/opening baseline to the existing `0.85` gates by recovering bounded thin structural components, rotated orthogonal plans and their host-bound openings without weakening safety.

**Architecture:** Reuse raw grayscale Hough segments and a pre-morphology binary ink mask. A pure module estimates ink bands, derives a dominant orthogonal frame, constructs bounded connected components and returns medium-confidence structural candidates. The browser engine integrates this stage before thick-wall consolidation. Opening recovery is rerun against sanitized recovered hosts. Diagonal plans use an internal tangent/normal frame only; persisted source orientation is unchanged.

## Task 1 — Pure thin-ink structural recovery

**Create:**
- `packages/recognition/src/thin-structural-recovery.ts`
- `packages/recognition/src/thin-structural-recovery.test.ts`
- exports in `packages/recognition/src/index.ts`

**RED contracts:**
- accept one long primary-to-boundary thin wall;
- accept a bounded two-fragment component with one primary anchor;
- reject paired white-space window rails;
- reject one-corner sanitary rectangle;
- reject unanchored underline;
- merge filled-band edge duplicates;
- deterministic under segment ordering;
- fail closed on budgets.

**GREEN implementation:**
- dominant angle modulo 90;
- bounded perpendicular ink-band sampling;
- canonical frame snapping/merge;
- original-evidence component graph;
- primary/boundary anchor admission;
- symbol-rail, enclosure and support vetoes.

## Task 2 — Rotated orthogonal frame

Extend Task 1 tests and implementation:
- recover a 35–45° orthogonal outer network and partition;
- inverse-project output to original coordinates;
- reject arbitrary diagonal text/noise;
- require dominant vote share, component span and boundary anchors.

## Task 3 — Browser/OpenCV integration

**Modify:**
- `apps/web/components/recognition/local-recognition-engine.ts`
- engine source-contract tests.

**Order:**

```text
filled regions + strict Hough
→ thin-ink component recovery using structuralBinary
→ thick-wall consolidation
→ clutter veto
→ host consolidation
→ topology sanitation
→ openings
```

Add debug fields and diagnostics. Blocked/rejected recovery evidence remains diagnostic only.

## Task 4 — Host-chain opening validation

**Modify/Create:**
- opening analysis/validation modules and tests.

Support deterministic collinear host chains while preserving:
- active-only hosts;
- bounded gaps/thickness/orientation;
- one opening candidate after deduplication;
- door/window evidence mutual exclusion;
- zero unknown-host openings.

## Task 5 — Exact-head corpus iteration

After every production slice:
- run full CI and browser audit;
- run Core/Source and twelve-fixture benchmark;
- inspect per-fixture overlays/debug;
- do not weaken thresholds;
- add focused RED cases for remaining named failures.

Priority order from the calibrated baseline:
1. thin balcony/loggia walls;
2. missing host-bound doors/windows;
3. diagonal plan;
4. remaining active sanitary false axes;
5. high-confidence false positives.

## Task 6 — Manual AI benchmark

When deterministic real gate is green:
- manually dispatch `.github/workflows/recognition-ai-benchmark.yml`;
- start with Gemini 2.5 Flash and bounded representative fixtures;
- compare at most three current vision/structured-output models;
- preserve latency/token/cost/stability evidence;
- assert no secret leakage;
- leave every model `qualified: false` pending product-owner review.

## Task 7 — Finalization

- remove temporary M7.9 marker files;
- update benchmark README, roadmap/state/changelog only after acceptance rules allow;
- update PR #43 body with exact SHA/run IDs/artifact digests and known residuals;
- retarget PR #43 to the PR #42 feature branch;
- keep Draft and do not merge until same-plan product retest and explicit acceptance.

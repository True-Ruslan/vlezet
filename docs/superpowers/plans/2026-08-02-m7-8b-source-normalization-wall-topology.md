# M7.8B Source Normalisation and Wall Topology Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Improve local recognition from the accepted M7.8A baseline by extracting more reliable architectural line evidence and converting wall centre-lines into a deterministic transient topology graph.

**Architecture:** Keep the production and benchmark path shared. Add one pure segment-normalisation module and one pure wall-topology module in `@vlezet/recognition`; refactor `buildWallCandidates()` to compose them; upgrade the browser engine to bounded strict/permissive equalised edge passes; integrate the same options into Core Benchmark; migrate the explicit baseline only after exact-head evidence is reviewed.

**Tech Stack:** TypeScript 6, Vitest 4, OpenCV.js, Next.js 16, Playwright Chromium/WebKit, GitHub Actions.

## Global Constraints

- `VlezetDocument`, migrations, IndexedDB and project formats remain unchanged.
- Recognition remains editable Draft plus explicit Apply.
- No new runtime dependency or live provider call.
- The private product-owner plan and screenshots are never committed.
- All output ordering and IDs are deterministic and independent of input order/direction.
- OpenCV temporary matrices are deleted in `finally`.
- Engine version changes from `3` to `4`; baseline migration is explicit.
- M7.8B does not claim final M7.8 thresholds or implement openings/rooms/OCR/reconciliation UX.

---

## File structure

### New files

- `packages/recognition/src/architectural-lines.ts` — validate, canonicalise, classify, filter and deduplicate Hough segments.
- `packages/recognition/src/architectural-lines.test.ts` — RED/GREEN contract for source-line evidence.
- `packages/recognition/src/wall-topology.ts` — snap, extend, split, merge and diagnose transient wall graph.
- `packages/recognition/src/wall-topology.test.ts` — RED/GREEN topology contract.
- `docs/changelog/2026-08-02-m7-8b.md` — milestone implementation record, updated during acceptance.

### Modified files

- `packages/recognition/src/index.ts` — export new pure modules.
- `packages/recognition/src/local-lines.ts` — compose normalisation, centreline extraction and topology conversion; engine version `4`.
- `packages/recognition/src/local-lines.test.ts` — integration and dense-plan regression tests.
- `apps/web/components/recognition/local-recognition-engine.ts` — equalised strict/permissive Canny/Hough passes and topology diagnostics.
- `apps/web/components/recognition/local-recognition-engine-source.test.ts` — source-contract regression for multi-pass processing and cleanup.
- `packages/recognition/benchmarks/src/core-benchmark.ts` — use calibrated adaptive options matching production.
- `packages/recognition/benchmarks/baselines/recognition-v1.json` — reviewed version-4 baseline after evidence.
- `tools/recognition-benchmark/recognition-source.spec.mjs` — expect engine version `4` and assert non-empty dense regression walls.
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md` — canonical state after product acceptance, not during initial RED work.

---

### Task 1: Architectural-line normalisation RED → GREEN

**Files:**
- Create: `packages/recognition/src/architectural-lines.test.ts`
- Create: `packages/recognition/src/architectural-lines.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**
- Consumes: `DetectedLineSegment` from `local-lines.ts`.
- Produces:

```ts
export type ArchitecturalLineOrientation = "horizontal" | "vertical" | "diagonal";

export type ArchitecturalLineOptions = Readonly<{
  minimumSegmentLengthPx: number;
  axisToleranceDeg: number;
  duplicateEndpointTolerancePx: number;
  borderMarginPx: number;
  borderSpanRatio: number;
}>;

export type NormalisedLineSegment = Readonly<{
  start: Readonly<{ x: number; y: number }>;
  end: Readonly<{ x: number; y: number }>;
  lengthPx: number;
  angleDeg: number;
  orientation: ArchitecturalLineOrientation;
  sourceCount: number;
}>;

export function normaliseArchitecturalLineSegments(input: Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
  options: ArchitecturalLineOptions;
}>): readonly NormalisedLineSegment[];
```

- [ ] **Step 1: Write failing tests**

Cover these exact cases:

```ts
it("canonicalises reversed duplicates into one stable segment", () => {
  const result = normaliseArchitecturalLineSegments({
    widthPx: 1000,
    heightPx: 800,
    options: TEST_OPTIONS,
    segments: [
      { x1: 100, y1: 200, x2: 900, y2: 200 },
      { x1: 900.5, y1: 200.4, x2: 99.7, y2: 199.8 },
    ],
  });
  expect(result).toHaveLength(1);
  expect(result[0]?.sourceCount).toBe(2);
  expect(result[0]?.orientation).toBe("horizontal");
});

it("rejects full-frame borders but keeps nearby architectural walls", () => {
  const result = normaliseArchitecturalLineSegments({
    widthPx: 1000,
    heightPx: 800,
    options: TEST_OPTIONS,
    segments: [
      { x1: 0, y1: 1, x2: 999, y2: 1 },
      { x1: 40, y1: 30, x2: 960, y2: 30 },
    ],
  });
  expect(result).toHaveLength(1);
  expect(result[0]?.start.y).toBeCloseTo(30);
});

it("is stable under permutation and direction reversal", () => {
  expect(run(FORWARD)).toEqual(run(REVERSED_PERMUTATION));
});
```

Also test non-finite input rejection, short-noise filtering, vertical classification and diagonal classification.

- [ ] **Step 2: Run package tests and verify RED**

Run:

```bash
pnpm --filter @vlezet/recognition test -- architectural-lines.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement minimal deterministic normaliser**

Implementation rules:

1. validate positive finite dimensions and option values;
2. canonicalise each segment so `(start.x,start.y)` is lexicographically before `end`;
3. calculate direction-independent angle in `[0,180)`;
4. classify horizontal within `axisToleranceDeg` of `0/180`, vertical within tolerance of `90`, otherwise diagonal;
5. reject length below `minimumSegmentLengthPx`;
6. reject a near-border segment only when it is axis-aligned, lies within `borderMarginPx`, and spans at least `borderSpanRatio` of the relevant image dimension;
7. deduplicate by quantised canonical endpoints using `duplicateEndpointTolerancePx` and increment `sourceCount`;
8. sort by orientation, quantised start and end geometry.

- [ ] **Step 4: Run focused and package tests**

```bash
pnpm --filter @vlezet/recognition test -- architectural-lines.test.ts
pnpm --filter @vlezet/recognition test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/architectural-lines.ts packages/recognition/src/architectural-lines.test.ts packages/recognition/src/index.ts
git commit -m "feat: normalize architectural line evidence"
```

---

### Task 2: Transient wall topology RED → GREEN

**Files:**
- Create: `packages/recognition/src/wall-topology.test.ts`
- Create: `packages/recognition/src/wall-topology.ts`
- Modify: `packages/recognition/src/index.ts`

**Interfaces:**

```ts
export type LocalWallJunction = Readonly<{
  id: string;
  positionPx: Readonly<{ x: number; y: number }>;
  degree: number;
}>;

export type LocalWallTopologyEdge = Readonly<{
  id: string;
  startJunctionId: string;
  endJunctionId: string;
  startPx: Readonly<{ x: number; y: number }>;
  endPx: Readonly<{ x: number; y: number }>;
  thicknessPx: number | null;
  evidenceCount: number;
  confidence: RecognitionConfidence;
  reasons: readonly string[];
}>;

export type LocalWallTopologyDiagnostic = Readonly<{
  code: "disconnected-components" | "isolated-edge" | "unresolved-near-junction";
  edgeId: string | null;
  message: string;
}>;

export type LocalWallTopology = Readonly<{
  junctions: readonly LocalWallJunction[];
  edges: readonly LocalWallTopologyEdge[];
  diagnostics: readonly LocalWallTopologyDiagnostic[];
}>;
```

Internal input uses pixel centre-lines, not normalized Draft candidates:

```ts
export type LocalWallCenterline = Readonly<{
  startPx: Readonly<{ x: number; y: number }>;
  endPx: Readonly<{ x: number; y: number }>;
  thicknessPx: number | null;
  evidenceCount: number;
  confidence: RecognitionConfidence;
  reasons: readonly string[];
}>;
```

Functions:

```ts
export function buildLocalWallTopology(input: Readonly<{
  centerlines: readonly LocalWallCenterline[];
  endpointSnapTolerancePx: number;
  endpointExtensionTolerancePx: number;
  intersectionTolerancePx: number;
  minimumEdgeLengthPx: number;
}>): LocalWallTopology;

export function topologyWallCandidates(input: Readonly<{
  topology: LocalWallTopology;
  widthPx: number;
  heightPx: number;
}>): RecognitionWallCandidate[];
```

- [ ] **Step 1: Write failing topology tests**

Required cases:

```ts
it("snaps a noisy corner into one degree-2 junction", () => {
  const topology = buildLocalWallTopology({
    ...OPTIONS,
    centerlines: [
      line(100, 100, 500, 100),
      line(503, 97, 503, 500),
    ],
  });
  expect(topology.junctions.filter((junction) => junction.degree === 2)).toHaveLength(1);
});

it("extends and splits a T-junction deterministically", () => {
  const topology = buildLocalWallTopology({
    ...OPTIONS,
    centerlines: [
      line(100, 200, 900, 200),
      line(500, 500, 500, 207),
    ],
  });
  expect(topology.edges).toHaveLength(3);
  expect(topology.junctions.some((junction) => junction.degree === 3)).toBe(true);
});

it("splits both walls at a cross intersection", () => {
  expect(crossTopology.edges).toHaveLength(4);
  expect(crossTopology.junctions.some((junction) => junction.degree === 4)).toBe(true);
});

it("produces identical IDs for reversed and permuted inputs", () => {
  expect(semanticTopology(FORWARD)).toEqual(semanticTopology(REVERSED_PERMUTATION));
});
```

Also cover collinear overlap merge, disconnected diagnostics and zero-length suppression.

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter @vlezet/recognition test -- wall-topology.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement topology builder**

Algorithm order is normative:

1. canonicalise and reject short centre-lines;
2. merge collinear overlapping/gapped fragments within topology tolerance;
3. calculate bounded segment intersections;
4. extend only endpoints whose nearest perpendicular intersection is within `endpointExtensionTolerancePx`;
5. collect endpoints and interior intersections as split points;
6. cluster split points within `endpointSnapTolerancePx` using deterministic centroid ordering;
7. split each line at sorted projected cluster points;
8. reject fragments below `minimumEdgeLengthPx`;
9. deduplicate direction-independent fragments;
10. derive quantised geometry IDs (`junction-x-y`, `edge-x1-y1-x2-y2`);
11. calculate degrees and connected components;
12. emit stable diagnostics.

- [ ] **Step 4: Run focused and package tests**

```bash
pnpm --filter @vlezet/recognition test -- wall-topology.test.ts
pnpm --filter @vlezet/recognition test
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/wall-topology.ts packages/recognition/src/wall-topology.test.ts packages/recognition/src/index.ts
git commit -m "feat: build deterministic wall topology"
```

---

### Task 3: Integrate normalisation and topology into wall candidates

**Files:**
- Modify: `packages/recognition/src/local-lines.ts`
- Modify: `packages/recognition/src/local-lines.test.ts`

**Interfaces:**
- `buildWallCandidates()` keeps its current public input and output types.
- Add optional topology values to `LocalRecognitionOptions`:

```ts
axisToleranceDeg: number;
duplicateEndpointTolerancePx: number;
borderMarginPx: number;
borderSpanRatio: number;
endpointSnapTolerancePx: number;
endpointExtensionTolerancePx: number;
intersectionTolerancePx: number;
minimumTopologyEdgeLengthPx: number;
```

- [ ] **Step 1: Add failing integration tests**

Required tests:

1. four paired exterior wall edges produce four topology-connected candidates;
2. a long crop-border line plus valid wall edges does not add a wall;
3. a dense synthetic developer-plan segment set produces more than zero walls;
4. candidates contain reasons `architectural-line-filter`, `topology-edge` and `junction-degree:<n>`;
5. candidate IDs and order are stable under segment permutation;
6. existing simple wall and adaptive-thickness tests remain valid.

- [ ] **Step 2: Run local-line tests and verify RED**

```bash
pnpm --filter @vlezet/recognition test -- local-lines.test.ts
```

Expected: new topology assertions fail.

- [ ] **Step 3: Refactor `buildWallCandidates()`**

Implementation sequence:

```ts
const normalised = normaliseArchitecturalLineSegments(...);
const centerlines = pairAndMergeWallEdges(normalised, options);
const topology = buildLocalWallTopology({ centerlines, ... });
return topologyWallCandidates({ topology, widthPx, heightPx });
```

Preserve thickness/evidence weighting from paired edges. Confidence rules:

- high only when `evidenceCount >= 3` and both endpoint junction degrees are at least `2`;
- medium when paired evidence exists and the edge contributes to a connected component;
- low for isolated or unresolved fragments.

Bump `LOCAL_RECOGNITION_ENGINE_VERSION` to `"4"`.

- [ ] **Step 4: Run recognition package tests**

```bash
pnpm --filter @vlezet/recognition test
pnpm --filter @vlezet/recognition typecheck
```

Expected: PASS except benchmark baseline tests that intentionally detect engine-version drift.

- [ ] **Step 5: Commit**

```bash
git add packages/recognition/src/local-lines.ts packages/recognition/src/local-lines.test.ts
git commit -m "feat: derive wall candidates from topology"
```

---

### Task 4: Browser source normalisation RED → GREEN

**Files:**
- Modify: `apps/web/components/recognition/local-recognition-engine-source.test.ts`
- Modify: `apps/web/components/recognition/local-recognition-engine.ts`

**Interfaces:**

Add focused helpers inside the browser module or a browser-only sibling:

```ts
function appendHoughSegments(input: Readonly<{
  cv: ResolvedCv;
  edges: CvMat;
  output: DetectedLineSegment[];
  minimumLengthPx: number;
  maximumGapPx: number;
  threshold: number;
}>): void;

function deduplicateDetectedSegments(
  segments: readonly DetectedLineSegment[],
  tolerancePx: number,
): DetectedLineSegment[];
```

- [ ] **Step 1: Add failing source-contract assertions**

Assert source contains:

- `cv.equalizeHist(gray, equalized)`;
- two `cv.Canny` calls with distinct threshold pairs;
- two Hough append calls;
- deterministic segment deduplication before `buildWallCandidates`;
- deletion of `equalized`, strict/permissive blurred/edge and line matrices;
- engine version inherited from `LOCAL_RECOGNITION_ENGINE_VERSION`.

- [ ] **Step 2: Run web tests and verify RED**

```bash
pnpm --dir apps/web test -- local-recognition-engine-source.test.ts
```

Expected: FAIL on missing multi-pass source operations.

- [ ] **Step 3: Implement bounded multi-pass extraction**

Use this sequence:

```text
RGBA source
→ grayscale
→ equalizeHist
→ strict blur 5×5 → Canny 50/150 → Hough threshold 50
→ permissive blur 3×3 → Canny 25/90 → Hough threshold 32
→ combine and direction-independent deduplicate segments
→ buildWallCandidates
```

Reuse adaptive minimum length and maximum gap. Do not exceed two passes.

Diagnostics:

- add `multi-pass-source-normalisation` info diagnostic when permissive evidence increases the unique segment count;
- add `disconnected-wall-topology` warning when final wall evidence contains more than one connected component, derived from candidate evidence reasons;
- retain existing zero-wall warning.

- [ ] **Step 4: Run web unit tests and typecheck**

```bash
pnpm --dir apps/web test -- local-recognition-engine-source.test.ts
pnpm --dir apps/web test
pnpm --dir apps/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/local-recognition-engine.ts apps/web/components/recognition/local-recognition-engine-source.test.ts
git commit -m "feat: normalize recognition source evidence"
```

---

### Task 5: Benchmark integration and first exact-head evidence

**Files:**
- Modify: `packages/recognition/benchmarks/src/core-benchmark.ts`
- Modify: `tools/recognition-benchmark/recognition-source.spec.mjs`
- Test: existing benchmark command tests

**Interfaces:**
- Core Benchmark derives `analysisMillimetersPerPixel` from fixture calibration and calls `createAdaptiveLocalRecognitionOptions()`.
- Source Benchmark expects engine version `4`.

- [ ] **Step 1: Add failing benchmark assertions**

Update source spec:

```js
expect(draft.engineVersion).toBe("4");
if (fixtureId === "m7-3-regression-anonymized") {
  expect(draft.walls.length).toBeGreaterThan(0);
}
```

Add/adjust Core command contract to require calibrated adaptive options.

- [ ] **Step 2: Run tests and verify RED**

```bash
pnpm --filter @vlezet/recognition test -- core-benchmark.command.test.ts
npm --prefix tools/recognition-benchmark test
```

Expected: engine-version and baseline drift failures before migration.

- [ ] **Step 3: Update Core Benchmark production-equivalent options**

For every fixture:

```ts
const options = createAdaptiveLocalRecognitionOptions({
  analysisMillimetersPerPixel: fixture.calibration.millimetersPerPixel,
  widthPx: segments.widthPx,
  heightPx: segments.heightPx,
});
const wallPredictions = buildWallCandidates({ ...segments, options });
```

- [ ] **Step 4: Push RED implementation head and inspect CI evidence**

Required workflows:

- Standard CI;
- Recognition Benchmark;
- M7 Browser Audit.

Expected initial result: Standard/source tests may pass, but baseline comparison must fail because engine version changed and metrics differ.

- [ ] **Step 5: Download and review benchmark artifact**

Review:

- Core aggregate metrics;
- Source aggregate metrics;
- `m7-3-regression-anonymized` prediction and overlay;
- furniture-heavy false positives;
- checksum manifest.

Do not migrate baseline unless:

- Core wall geometry F1 > `0.131737`;
- Core topology F1 > `0.131737`;
- Source wall geometry/topology F1 > `0`;
- dense regression source walls > `0`;
- incorrect high-confidence, unknown-host and stale-decision metrics do not regress beyond accepted allowances.

- [ ] **Step 6: Commit benchmark integration**

```bash
git add packages/recognition/benchmarks/src/core-benchmark.ts tools/recognition-benchmark/recognition-source.spec.mjs
git commit -m "test: measure M7.8B recognition quality"
```

---

### Task 6: Explicit baseline migration

**Files:**
- Modify: `packages/recognition/benchmarks/baselines/recognition-v1.json`
- Modify/add tests if result applicability changes.

- [ ] **Step 1: Copy reviewed exact-head aggregate and fixture metrics**

Set:

- `recognitionEngineVersion` to `4`;
- `sourceCommitSha` to the reviewed product implementation head;
- all metric values to exact canonical artifact values;
- `reviewedAt` to `2026-08-02T00:00:00.000Z` or the schema-required deterministic value;
- reviewer note describing M7.8B source normalisation and topology migration.

- [ ] **Step 2: Run benchmark locally/CI and verify GREEN**

```bash
pnpm benchmark:recognition:core
npm --prefix tools/recognition-benchmark run verify:fixtures
```

Expected: baseline comparison PASS.

- [ ] **Step 3: Commit baseline migration**

```bash
git add packages/recognition/benchmarks/baselines/recognition-v1.json
git commit -m "test: accept M7.8B recognition baseline"
```

---

### Task 7: Documentation, Draft PR and product acceptance

**Files:**
- Create: `docs/changelog/2026-08-02-m7-8b.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/CHANGELOG.md`
- Create later: `docs/milestones/m7-8b-acceptance.md`

- [ ] **Step 1: Create implementation changelog**

Record:

- why zero-wall recognition occurred;
- pure line/topology modules;
- multi-pass browser source normalisation;
- exact benchmark delta from M7.8A;
- remaining M7.8C scope;
- authority boundaries.

- [ ] **Step 2: Open Draft PR**

Title:

```text
feat: M7.8B source normalization and wall topology
```

Body must contain:

- implementation summary;
- RED/GREEN commits and runs;
- baseline before/after table;
- known limitations;
- product-owner test instructions;
- exact-head workflow status.

- [ ] **Step 3: Run exact-head gates**

Require PASS:

- Standard CI;
- Recognition Benchmark;
- Chromium full M7 audit;
- WebKit core smoke;
- no unresolved review threads.

- [ ] **Step 4: Product-owner browser acceptance**

Required manual checks:

1. upload and calibrate the representative clear plan;
2. run local recognition;
3. confirm the Draft contains wall candidates instead of `0` walls;
4. confirm candidates materially follow exterior/internal wall axes better than M7.8A;
5. confirm noise remains reviewable and nothing mutates before Apply;
6. run optional AI review and verify Draft/Apply workflow remains usable.

- [ ] **Step 5: Write acceptance record and canonical state**

After literal acceptance:

- add exact quote;
- add final head, run IDs, artifact ID/digest and metric table;
- mark M7.8B DONE;
- select M7.8C Openings, Rooms, Labels and Area Constraints as NOW;
- rerun exact-head checks if documentation changes the head.

- [ ] **Step 6: Mark Ready and squash merge**

Use expected head SHA and squash title:

```text
feat: deliver M7.8B source normalization and wall topology (#<PR>)
```

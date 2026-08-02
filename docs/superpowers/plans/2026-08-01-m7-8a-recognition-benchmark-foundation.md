# M7.8A Recognition Benchmark Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a versioned, anonymised and deterministic recognition benchmark corpus, scorer, baseline and Chromium/OpenCV workflow before changing recognition quality algorithms.

**Architecture:** Benchmark contracts and pure scorers live under `packages/recognition/benchmarks` and remain separate from persistent `RecognitionDraft`. The current browser recognition algorithm is extracted without behavioural change into one shared engine used by both the production Worker and a benchmark-only browser harness; Core Benchmark runs in Standard CI and Source Benchmark runs in a dedicated Playwright workflow.

**Tech Stack:** TypeScript 6.0.3, Vitest 4.1.10, Node.js 22.16.0, pnpm 11.15.1, Next.js 16.2.10, OpenCV.js `5.0.0-release.1`, Playwright 1.54.2, GitHub Actions.

## Global Constraints

- Base commit is `039ddba143cd03ddec0b090606dfdde752446014`.
- Work only on `feat/m7-8a-recognition-benchmark-foundation`.
- Open a Draft PR before the first product/tooling implementation commit.
- M7.8A measures current quality; it does not tune Canny, Hough, wall merging, openings, prompts or confidence thresholds.
- Do not change `VlezetDocument`, domain schema, migrations, IndexedDB, portable backup, recognition-session persistence, Apply semantics, semantic Undo/Redo, planning, M2 fit or 3D authority.
- Do not add runtime wall graphs or room polygons to `RecognitionDraft` during M7.8A.
- Benchmark ground truth uses reference-local millimetres: top-left origin, x right, y down.
- Matching is deterministic maximum-cardinality, then minimum-total-cost, with stable geometry-derived tie-breakers.
- Room IoU uses the benchmark-only deterministic raster method defined in Task 6; it is not product geometry authority.
- Corpus v1 contains exactly eight public-safe fixtures named in the approved specification.
- The original private M7.3 plan must never be committed; use a redrawn anonymised analogue.
- Live OpenRouter calls are forbidden in merge-blocking CI.
- Baseline updates are explicit reviewed commits; CI must never write or approve a new baseline automatically.
- Source Benchmark must execute the same shared OpenCV engine used by the production Worker.
- Final merge requires exact-head Standard CI, exact-head Recognition Benchmark, existing M7 Browser Audit where triggered, review-thread clearance and product-owner acceptance of the benchmark report.

---

## File Map

### Benchmark contracts and scoring

- Create `packages/recognition/benchmarks/README.md` — corpus purpose, privacy, commands and baseline policy.
- Create `packages/recognition/benchmarks/schema/fixture-v1.ts` — fixture types and fail-closed validator.
- Create `packages/recognition/benchmarks/schema/result-v1.ts` — result, metric and baseline types.
- Create `packages/recognition/benchmarks/schema/fixture-v1.test.ts` — schema and privacy/provenance contract tests.
- Create `packages/recognition/benchmarks/src/coordinates.ts` — normalized/source/reference-mm conversion and stable geometry keys.
- Create `packages/recognition/benchmarks/src/coordinates.test.ts`.
- Create `packages/recognition/benchmarks/src/optimal-assignment.ts` — deterministic maximum-cardinality minimum-cost bipartite assignment.
- Create `packages/recognition/benchmarks/src/optimal-assignment.test.ts`.
- Create `packages/recognition/benchmarks/src/match-walls.ts` and test.
- Create `packages/recognition/benchmarks/src/score-wall-topology.ts` and test.
- Create `packages/recognition/benchmarks/src/match-openings.ts` and test.
- Create `packages/recognition/benchmarks/src/score-rooms.ts` and test.
- Create `packages/recognition/benchmarks/src/score-confidence.ts` and test.
- Create `packages/recognition/benchmarks/src/score-reconciliation.ts` and test.
- Create `packages/recognition/benchmarks/src/score-fixture.ts` and test.
- Create `packages/recognition/benchmarks/src/aggregate-report.ts` and test.
- Create `packages/recognition/benchmarks/src/compare-baseline.ts` and test.
- Create `packages/recognition/benchmarks/src/canonical-json.ts` and test.
- Create `packages/recognition/benchmarks/src/core-benchmark.benchmark.ts` — explicit Vitest benchmark command entry.
- Create `packages/recognition/benchmarks/src/report-command.benchmark.ts` — combines Core and Source reports.

### Corpus

- Create `packages/recognition/benchmarks/fixtures/manifest.json`.
- Create `packages/recognition/benchmarks/fixtures/source-definitions.mjs` — deterministic vector definitions for public-safe sources.
- Create eight fixture directories, each with `fixture.json`, `segments.json`, optional `cloud-response.json`, `source.png` and `source.sha256`.
- Create `tools/recognition-benchmark/generate-fixture-assets.mjs` — manual deterministic PNG generator.
- Create `tools/recognition-benchmark/verify-fixture-assets.mjs` — hashes and metadata verification used by CI.

### Shared engine and source harness

- Create `apps/web/components/recognition/local-recognition-engine.ts` — current OpenCV algorithm extracted without semantic change.
- Create `apps/web/components/recognition/local-recognition-engine.test.ts` — source/contract tests around extraction boundaries.
- Modify `apps/web/components/recognition/recognition.worker.ts` — delegate to shared engine and retain message protocol.
- Modify `apps/web/components/recognition/local-recognition-client.test.ts` — worker seam regression where needed.
- Create `apps/web/app/__recognition-benchmark/page.tsx` — benchmark-only, env-gated page.
- Create `apps/web/components/recognition/recognition-benchmark-harness.tsx` — direct-engine and Worker bridge.
- Create `apps/web/components/recognition/recognition-benchmark-harness.test.tsx`.
- Create `tools/recognition-benchmark/package.json`.
- Create `tools/recognition-benchmark/playwright.config.mjs`.
- Create `tools/recognition-benchmark/recognition-source.spec.ts`.

### Scripts, workflows and records

- Modify `packages/recognition/package.json` — Core/report scripts.
- Modify `packages/recognition/tsconfig.json` — include benchmark TypeScript.
- Modify root `package.json` — public benchmark commands.
- Modify `pnpm-lock.yaml` only if workspace/package metadata requires it; no new runtime dependency is planned.
- Modify `.github/workflows/ci.yml` — explicit Core Benchmark step and diagnostics artifact.
- Create `.github/workflows/recognition-benchmark.yml` — source benchmark and immutable evidence.
- Create `docs/milestones/m7-8a-acceptance.md`.
- Create `docs/changelog/2026-08-01-m7-8a.md` only after implementation evidence exists.

---

### Task 0: Open the Draft PR and Freeze Scope

**Files:**
- No repository file changes.
- GitHub metadata: new Draft PR from `feat/m7-8a-recognition-benchmark-foundation` to `main`.

**Interfaces:**
- Consumes: approved design spec at `docs/superpowers/specs/2026-08-01-m7-8a-recognition-benchmark-foundation-design.md` and this plan.
- Produces: one Draft PR used for all exact-head CI evidence and review.

- [ ] **Step 1: Confirm the branch base and diff**

Run through GitHub connector or local git:

```bash
git merge-base --is-ancestor 039ddba143cd03ddec0b090606dfdde752446014 HEAD
git diff --name-status 039ddba143cd03ddec0b090606dfdde752446014...HEAD
```

Expected before implementation: only the design specification and implementation plan are added.

- [ ] **Step 2: Open a Draft PR**

Use this exact title:

```text
feat: M7.8A recognition benchmark foundation
```

Use this body:

```markdown
## M7.8A — Recognition Benchmark Foundation

Benchmark-first foundation for issue #27.

### Planned delivery

- versioned eight-fixture anonymised corpus;
- fail-closed fixture/result schemas;
- deterministic wall, topology, opening, room, area, confidence and reconciliation metrics;
- current-main baseline with explicit update policy;
- behaviour-preserving shared OpenCV engine extraction;
- Chromium Source Benchmark using the production engine;
- dedicated merge-blocking Recognition Benchmark workflow;
- no live OpenRouter calls in CI.

### Authority boundaries

No `VlezetDocument`, schema, migration, IndexedDB, backup, recognition-session persistence, Apply/history, planning, M2 fit or 3D changes. Benchmark room polygons and topology remain test-only ground truth.

### Approved documents

- `docs/superpowers/specs/2026-08-01-m7-8a-recognition-benchmark-foundation-design.md`
- `docs/superpowers/plans/2026-08-01-m7-8a-recognition-benchmark-foundation.md`

PR remains Draft until exact-head benchmark evidence and product-owner acceptance are recorded.
```

- [ ] **Step 3: Confirm Draft state**

Expected: PR targets `main`, head is `feat/m7-8a-recognition-benchmark-foundation`, `draft=true`.

---

### Task 1: Fixture and Result Contracts

**Files:**
- Create: `packages/recognition/benchmarks/schema/fixture-v1.ts`
- Create: `packages/recognition/benchmarks/schema/result-v1.ts`
- Create: `packages/recognition/benchmarks/schema/fixture-v1.test.ts`
- Modify: `packages/recognition/tsconfig.json`

**Interfaces:**
- Consumes: no previous implementation task.
- Produces:

```ts
export type BenchmarkPointMm = Readonly<{ x: number; y: number }>;
export type RecognitionBenchmarkFixtureV1 = Readonly<{ /* approved fields */ }>;
export type RecognitionBenchmarkResultV1 = Readonly<{ /* approved fields */ }>;
export function validateRecognitionBenchmarkFixtureV1(value: unknown): RecognitionBenchmarkFixtureV1;
export function validateRecognitionBenchmarkResultV1(value: unknown): RecognitionBenchmarkResultV1;
```

- [ ] **Step 1: Write failing schema tests**

Create tests proving:

```ts
import { describe, expect, it } from "vitest";
import { validateRecognitionBenchmarkFixtureV1 } from "./fixture-v1";

it("accepts a calibrated fixture with one wall, opening and room", () => {
  const fixture = validFixture();
  expect(validateRecognitionBenchmarkFixtureV1(fixture)).toEqual(fixture);
});

it.each([
  ["duplicate wall ids", (fixture: any) => fixture.expectedWalls.push({ ...fixture.expectedWalls[0] })],
  ["zero-length wall", (fixture: any) => fixture.expectedWalls[0].endMm = fixture.expectedWalls[0].startMm],
  ["unknown opening host", (fixture: any) => fixture.expectedOpenings[0].hostWallId = "missing"],
  ["self-intersecting room", (fixture: any) => fixture.expectedRooms[0].polygonMm = [{x:0,y:0},{x:1000,y:1000},{x:0,y:1000},{x:1000,y:0}]],
  ["missing provenance note", (fixture: any) => fixture.provenance.note = ""],
])("rejects %s", (_name, mutate) => {
  const fixture = structuredClone(validFixture());
  mutate(fixture);
  expect(() => validateRecognitionBenchmarkFixtureV1(fixture)).toThrow();
});
```

Also test:

- `schemaVersion` exact value;
- finite positive source dimensions and scale;
- finite origin;
- bounded tolerances;
- unique wall/opening/room/label IDs;
- junction references exist;
- swing exists only on doors;
- room polygon has at least three vertices, positive area and no self-intersection;
- enabled metric cannot lack required ground truth;
- disabled metrics remain valid and later report `not-applicable`.

- [ ] **Step 2: Run the focused tests and verify RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/schema/fixture-v1.test.ts
```

Expected: FAIL because schema modules do not exist.

- [ ] **Step 3: Implement fixture types and validation**

Use existing geometry primitives:

```ts
import { polygonSelfIntersects, signedPolygonArea } from "@vlezet/geometry";
```

Implement exact fixture types from the specification, including:

```ts
export type BenchmarkProvenanceV1 = Readonly<{
  kind: "synthetic" | "redrawn-anonymized" | "licensed";
  note: string;
  license: string | null;
}>;

export type BenchmarkMetricApplicabilityV1 = Readonly<{
  wallGeometry: boolean;
  wallTopology: boolean;
  openings: boolean;
  rooms: boolean;
  roomLabels: boolean;
  roomAreas: boolean;
  totalArea: boolean;
  confidence: boolean;
}>;
```

Validation is fail-closed and returns a fully rebuilt immutable value rather than casting the input.

- [ ] **Step 4: Implement result types and validation**

Define a reusable metric representation:

```ts
export type BenchmarkMetricValue =
  | Readonly<{ status: "measured"; value: number }>
  | Readonly<{ status: "not-applicable" }>;

export type BenchmarkCountMetric = Readonly<{
  truePositive: number;
  falsePositive: number;
  falseNegative: number;
  precision: number;
  recall: number;
  f1: number;
}>;
```

Result validation must reject:

- NaN/Infinity;
- precision/recall/F1 outside `[0,1]`;
- negative counts;
- duplicate fixture IDs;
- aggregate fixture count mismatches;
- baseline comparison referencing absent metrics.

- [ ] **Step 5: Expand `tsconfig.json`**

Replace include with:

```json
{
  "extends": "../../tsconfig.base.json",
  "include": ["src/**/*.ts", "benchmarks/**/*.ts"]
}
```

- [ ] **Step 6: Run tests, typecheck and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/schema/fixture-v1.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/schema packages/recognition/tsconfig.json
git commit -m "test: define recognition benchmark contracts"
```

Expected: PASS.

---

### Task 2: Coordinates, Canonical Keys and Optimal Assignment

**Files:**
- Create: `packages/recognition/benchmarks/src/coordinates.ts`
- Create: `packages/recognition/benchmarks/src/coordinates.test.ts`
- Create: `packages/recognition/benchmarks/src/optimal-assignment.ts`
- Create: `packages/recognition/benchmarks/src/optimal-assignment.test.ts`

**Interfaces:**
- Consumes: `BenchmarkCalibrationV1`, `BenchmarkPointMm`.
- Produces:

```ts
export function normalizedPointToReferenceMm(point: NormalizedPoint, calibration: BenchmarkCalibrationV1): BenchmarkPointMm;
export function stablePointKey(point: BenchmarkPointMm): string;
export function stableSegmentKey(start: BenchmarkPointMm, end: BenchmarkPointMm): string;

export type AssignmentEdge = Readonly<{
  leftIndex: number;
  rightIndex: number;
  costKey: readonly number[];
  tieKey: string;
}>;

export function solveOptimalAssignment(input: Readonly<{
  leftCount: number;
  rightCount: number;
  edges: readonly AssignmentEdge[];
}>): readonly Readonly<{ leftIndex: number; rightIndex: number }>[];
```

- [ ] **Step 1: Write coordinate RED tests**

```ts
it("converts normalized source coordinates to reference-local millimetres", () => {
  expect(normalizedPointToReferenceMm(
    { x: 0.5, y: 0.25 },
    { sourceWidthPx: 2000, sourceHeightPx: 1000, millimetersPerPixel: 2, originPx: { x: 100, y: 50 } },
  )).toEqual({ x: 1800, y: 400 });
});

it("canonicalises reversed segments to the same key", () => {
  expect(stableSegmentKey({x: 0, y: 0}, {x: 1000, y: 0}))
    .toBe(stableSegmentKey({x: 1000, y: 0}, {x: 0, y: 0}));
});
```

Also reject normalized points outside `[0,1]` and non-finite calibration.

- [ ] **Step 2: Write assignment RED tests**

Include a graph where greedy cheapest-first produces one match but the optimum produces two:

```ts
it("maximises cardinality before minimising cost", () => {
  const result = solveOptimalAssignment({
    leftCount: 2,
    rightCount: 2,
    edges: [
      { leftIndex: 0, rightIndex: 0, costKey: [0], tieKey: "a" },
      { leftIndex: 0, rightIndex: 1, costKey: [1], tieKey: "b" },
      { leftIndex: 1, rightIndex: 0, costKey: [1], tieKey: "c" },
    ],
  });
  expect(result).toEqual([
    { leftIndex: 0, rightIndex: 1 },
    { leftIndex: 1, rightIndex: 0 },
  ]);
});
```

Also prove invariance to input edge order and stable tie resolution.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/coordinates.test.ts benchmarks/src/optimal-assignment.test.ts
```

Expected: FAIL on missing modules.

- [ ] **Step 4: Implement coordinate conversion and keys**

Round only for keys, never for metric geometry:

```ts
const KEY_PRECISION_MM = 0.1;
const keyNumber = (value: number) => Math.round(value / KEY_PRECISION_MM) * KEY_PRECISION_MM;
```

`stableSegmentKey` sorts the two point keys lexicographically.

- [ ] **Step 5: Implement exact assignment**

Use deterministic successive shortest augmenting paths over a unit-capacity bipartite residual graph:

1. validate all indices and finite cost tuple values;
2. sort edges by `costKey`, then `tieKey`, then indices;
3. convert each unique complete pair ordering to integer rank `0..N-1`;
4. add source→left, left→right, right→sink unit-capacity edges;
5. run Bellman-Ford on residual edges until no augmenting path exists;
6. cardinality is therefore maximal;
7. path cost minimises total ranked pair cost;
8. equal distances choose the lexicographically smaller predecessor edge key;
9. return pairs sorted by `leftIndex`, then `rightIndex`.

Do not use floating epsilon comparisons after rank conversion.

- [ ] **Step 6: Run tests and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/coordinates.test.ts benchmarks/src/optimal-assignment.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/src/coordinates* packages/recognition/benchmarks/src/optimal-assignment*
git commit -m "feat: add deterministic benchmark assignment"
```

---

### Task 3: Wall Geometry Matching

**Files:**
- Create: `packages/recognition/benchmarks/src/match-walls.ts`
- Create: `packages/recognition/benchmarks/src/match-walls.test.ts`

**Interfaces:**
- Consumes: fixture walls/tolerances, predicted `RecognitionWallCandidate[]`, coordinate conversion and optimal assignment.
- Produces:

```ts
export type WallMatch = Readonly<{
  expectedWallId: string;
  predictedIndex: number;
  endpointDistanceMm: number;
  orientationDeltaDeg: number;
  overlapRatio: number;
  relativeLengthError: number;
}>;

export type WallMatchResult = Readonly<{
  matches: readonly WallMatch[];
  unmatchedExpectedWallIds: readonly string[];
  unmatchedPredictedIndices: readonly number[];
  metrics: BenchmarkCountMetric;
  duplicatePredictionCount: number;
}>;

export function matchWalls(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionWallCandidate[];
}>): WallMatchResult;
```

- [ ] **Step 1: Write RED tests**

Cover:

- reversed predicted direction matches;
- endpoint distance outside tolerance is false positive/negative;
- poor overlap is rejected even when midpoint is close;
- one prediction cannot satisfy two expected walls;
- order invariance;
- global optimum case uses Task 2 solver;
- duplicate collinear predictions count explicitly.

Use this boundary assertion:

```ts
expect(result.metrics).toEqual({
  truePositive: 1,
  falsePositive: 1,
  falseNegative: 0,
  precision: 0.5,
  recall: 1,
  f1: 2 / 3,
});
```

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/match-walls.test.ts
```

- [ ] **Step 3: Implement geometry measures**

For each expected/predicted pair:

- convert prediction to reference-local millimetres;
- calculate direction-independent mean endpoint distance using direct/reversed minimum;
- calculate undirected orientation delta in `[0,90]`;
- project both segments onto the expected tangent and calculate overlap / shorter length;
- calculate absolute relative length error;
- admit only pairs satisfying all fixture tolerances.

Cost tuple:

```ts
[
  endpointDistanceMm,
  orientationDeltaDeg,
  1 - overlapRatio,
  relativeLengthError,
]
```

Tie key is `expectedWallId + ":" + stableSegmentKey(predictedStart, predictedEnd)`.

- [ ] **Step 4: Implement duplicate counting**

An unmatched prediction counts as duplicate when it is admissible to an already matched expected wall. It remains a false positive and increments `duplicatePredictionCount`; do not suppress it.

- [ ] **Step 5: Run tests and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/match-walls.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/src/match-walls*
git commit -m "feat: score recognition wall geometry"
```

---

### Task 4: Predicted Wall Topology Scoring

**Files:**
- Create: `packages/recognition/benchmarks/src/score-wall-topology.ts`
- Create: `packages/recognition/benchmarks/src/score-wall-topology.test.ts`

**Interfaces:**
- Consumes: predicted wall geometry in reference-local millimetres, expected junction IDs and `solveOptimalAssignment`.
- Produces:

```ts
export type PredictedTopology = Readonly<{
  junctions: readonly Readonly<{ id: string; pointMm: BenchmarkPointMm; memberKeys: readonly string[] }>[];
  edges: readonly Readonly<{ wallIndex: number; startJunctionId: string; endJunctionId: string }>[];
  selfLoopWallIndices: readonly number[];
  duplicateEdgeWallIndices: readonly number[];
}>;

export function derivePredictedTopology(input: Readonly<{
  predictions: readonly RecognitionWallCandidate[];
  calibration: BenchmarkCalibrationV1;
  junctionToleranceMm: number;
}>): PredictedTopology;

export function scoreWallTopology(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionWallCandidate[];
}>): WallTopologyScore;
```

- [ ] **Step 1: Write RED tests**

Prove:

- endpoints within 120 mm cluster;
- connected-component clustering is transitive and deterministic;
- input order does not change stable junction IDs;
- wall whose two endpoints cluster together is reported as self-loop;
- duplicate predicted edges remain explicit;
- close wall geometry with wrong connectivity loses edge/topology credit;
- junction matching uses one-to-one optimal assignment.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/score-wall-topology.test.ts
```

- [ ] **Step 3: Implement deterministic endpoint clustering**

Use union-find over endpoints sorted by `stablePointKey`. Union every pair within `junctionToleranceMm`. For each component:

- sort member keys;
- use arithmetic mean of unrounded points for score geometry;
- ID is `junction:` plus joined sorted rounded member keys;
- sort resulting junctions by ID.

- [ ] **Step 4: Implement topology metrics**

Expected junction position is the mean of all declared wall endpoints using that junction ID. Match predicted to expected junctions within tolerance. A predicted edge is correct only when both predicted junctions map to the two expected junction IDs of an expected edge, direction-independent.

Report:

- junction precision/recall/F1;
- edge precision/recall/F1;
- connected-component count error;
- missing/extra edge count;
- self-loop count;
- duplicate edge count;
- `topologyF1 = edgeF1` for corpus v1, while junction F1 remains separately visible.

- [ ] **Step 5: Run and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/score-wall-topology.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/src/score-wall-topology*
git commit -m "feat: score recognition wall topology"
```

---

### Task 5: Opening Matching and Host-Wall Correctness

**Files:**
- Create: `packages/recognition/benchmarks/src/match-openings.ts`
- Create: `packages/recognition/benchmarks/src/match-openings.test.ts`

**Interfaces:**
- Consumes: `WallMatchResult`, expected/predicted openings, coordinate conversion and assignment.
- Produces:

```ts
export type OpeningMatchResult = Readonly<{
  matches: readonly Readonly<{
    expectedOpeningId: string;
    predictedIndex: number;
    centerErrorMm: number;
    widthErrorMm: number;
  }>[];
  combined: BenchmarkCountMetric;
  doors: BenchmarkCountMetric;
  windows: BenchmarkCountMetric;
  hostWallAccuracy: BenchmarkMetricValue;
  unknownHostOpeningCount: number;
  duplicateOpeningCount: number;
}>;

export function matchOpenings(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly RecognitionOpeningCandidate[];
  wallMatches: WallMatchResult;
}>): OpeningMatchResult;
```

- [ ] **Step 1: Write RED tests**

Cover:

- correct type/position/width/host is TP;
- correct position with wrong type is FP + FN;
- correct position with wrong host is FP + FN;
- `null` host increments unknown-host count;
- host candidate ID resolves through matched predicted wall index, not string similarity;
- duplicate openings remain false positives;
- order invariance.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/match-openings.test.ts
```

- [ ] **Step 3: Implement host resolution**

Build:

```ts
Map<predictedWallCandidateId, expectedWallId>
```

from wall matches. Opening pair is admissible only when:

- `predicted.kind === expected.kind`;
- center distance ≤ `openingCenterMm`;
- absolute width error ≤ `openingWidthMm`;
- resolved predicted host equals `expected.hostWallId`.

Unknown/absent/non-matched hosts never receive TP credit.

- [ ] **Step 4: Implement metrics and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/match-openings.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/src/match-openings*
git commit -m "feat: score recognition openings"
```

---

### Task 6: Rooms, Areas, Confidence and Reconciliation Metrics

**Files:**
- Create: `packages/recognition/benchmarks/src/score-rooms.ts`
- Create: `packages/recognition/benchmarks/src/score-rooms.test.ts`
- Create: `packages/recognition/benchmarks/src/score-confidence.ts`
- Create: `packages/recognition/benchmarks/src/score-confidence.test.ts`
- Create: `packages/recognition/benchmarks/src/score-reconciliation.ts`
- Create: `packages/recognition/benchmarks/src/score-reconciliation.test.ts`

**Interfaces:**
- Consumes: fixture rooms/labels/areas, optional benchmark-only room predictions, matched wall/opening entities and `RecognitionDraft`.
- Produces:

```ts
export type BenchmarkRoomPredictionV1 = Readonly<{
  id: string;
  polygonMm: readonly BenchmarkPointMm[];
  name: string | null;
  classification: BenchmarkRoomV1["classification"];
  statedAreaM2: number | null;
  confidence: RecognitionConfidence;
}>;

export function scoreRooms(input: Readonly<{
  fixture: RecognitionBenchmarkFixtureV1;
  predictions: readonly BenchmarkRoomPredictionV1[];
}>): RoomScore;

export function scoreConfidence(input: Readonly<{
  matchedPredictionKeys: ReadonlySet<string>;
  predictions: readonly Readonly<{ key: string; confidence: RecognitionConfidence }>[];
}>): ConfidenceScore;

export function scoreReconciliation(draft: RecognitionDraft): ReconciliationScore;
```

- [ ] **Step 1: Write room/area RED tests**

Use simple rectangles and an L-shaped polygon. Prove:

- exact zone count;
- empty prediction set with expected rooms gives zero recall, not `not-applicable`;
- disabled room metric gives `not-applicable`;
- identical polygons produce IoU 1;
- disjoint polygons produce IoU 0;
- stated and computed areas remain separate;
- total-area absolute percentage error and per-room errors use the correct denominators;
- room matching is one-to-one and order invariant.

- [ ] **Step 2: Define deterministic raster IoU**

Implement benchmark-only constant:

```ts
export const ROOM_IOU_CELL_MM = 10;
```

Algorithm:

1. validate simple positive-area polygons using `polygonSelfIntersects` and `signedPolygonArea`;
2. compute union bounds;
3. align grid bounds down/up to 10 mm;
4. visit cell centres in stable y-major/x-minor order;
5. use existing `pointInPolygon` for each polygon;
6. count intersection and union cells;
7. `IoU = intersection / max(1, union)`.

Document in code that this is benchmark approximation only, not product room geometry.

- [ ] **Step 3: Write confidence RED tests**

```ts
expect(scoreConfidence({
  matchedPredictionKeys: new Set(["wall:0"]),
  predictions: [
    { key: "wall:0", confidence: "high" },
    { key: "wall:1", confidence: "high" },
  ],
}).incorrectHighConfidenceRate).toBe(0.5);
```

Also cover no high-confidence predictions → `0`, not NaN.

- [ ] **Step 4: Write reconciliation RED tests**

Prove all invariant counts are zero for a valid draft and non-zero for a deliberately malformed raw snapshot analysed without calling `validateRecognitionDraft` first:

- stale decision;
- missing pending decision for new candidate;
- duplicate candidate ID;
- unknown decision reference.

The scorer must accept `unknown` input and diagnose it; it must not hide these metrics by throwing before counting.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/score-rooms.test.ts benchmarks/src/score-confidence.test.ts benchmarks/src/score-reconciliation.test.ts
```

- [ ] **Step 6: Implement and commit**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/score-rooms.test.ts benchmarks/src/score-confidence.test.ts benchmarks/src/score-reconciliation.test.ts
pnpm --filter @vlezet/recognition typecheck
git add packages/recognition/benchmarks/src/score-rooms* packages/recognition/benchmarks/src/score-confidence* packages/recognition/benchmarks/src/score-reconciliation*
git commit -m "feat: score recognition rooms and confidence"
```

---

### Task 7: Versioned Eight-Fixture Corpus

**Files:**
- Create: `packages/recognition/benchmarks/README.md`
- Create: `packages/recognition/benchmarks/fixtures/manifest.json`
- Create: `packages/recognition/benchmarks/fixtures/source-definitions.mjs`
- Create eight fixture directories and their files.
- Create: `tools/recognition-benchmark/generate-fixture-assets.mjs`
- Create: `tools/recognition-benchmark/verify-fixture-assets.mjs`
- Create: `tools/recognition-benchmark/package.json`

**Interfaces:**
- Consumes: fixture schema validator.
- Produces: exactly eight fixture IDs and committed public-safe PNG sources.

- [ ] **Step 1: Add the tooling package**

Create:

```json
{
  "name": "vlezet-recognition-benchmark",
  "private": true,
  "type": "module",
  "scripts": {
    "generate:fixtures": "node generate-fixture-assets.mjs",
    "verify:fixtures": "node verify-fixture-assets.mjs",
    "benchmark": "playwright test"
  },
  "devDependencies": {
    "@playwright/test": "1.54.2"
  }
}
```

Use `npm install --no-package-lock` in workflow, matching existing browser-audit tooling. Do not add this tool to the pnpm workspace.

- [ ] **Step 2: Write the source definitions**

`source-definitions.mjs` exports exactly these IDs:

```js
export const fixtureSourceDefinitions = [
  "clean-studio",
  "clean-multi-room",
  "openings-heavy",
  "labels-and-areas",
  "furniture-heavy",
  "low-resolution",
  "perspective-photo",
  "m7-3-regression-anonymized",
];
```

Each definition contains explicit canvas width/height, background, wall rectangles, door arcs, window double-lines, labels, dimensions and non-architectural symbols. Use only deterministic SVG primitives and system-independent fonts (`Arial, sans-serif`).

Required distinguishing geometry:

- `clean-studio`: 6000×4500 mm outer rectangle, one door, two windows.
- `clean-multi-room`: 9000×6500 mm outer rectangle, two partitions, four zones.
- `openings-heavy`: six doors/windows across at least four host walls.
- `labels-and-areas`: five zones with room names, per-room areas and a stated total.
- `furniture-heavy`: bed, sofa, table, sanitary contours, hatching and dimension lines that are not ground-truth walls.
- `low-resolution`: same structural complexity as a two-room flat but rendered to a 480 px long side.
- `perspective-photo`: synthetic quadrilateral/perspective transform and image-frame edges.
- `m7-3-regression-anonymized`: redrawn dense two-room analogue with changed labels/areas/proportions, multiple openings and strong symbol noise.

- [ ] **Step 3: Generate committed PNGs deterministically**

`generate-fixture-assets.mjs`:

- launches Chromium from `@playwright/test`;
- renders each SVG definition in a fixed viewport/device scale 1;
- screenshots only the SVG root to `source.png`;
- writes SHA-256 to `source.sha256`;
- strips metadata by browser screenshot generation;
- exits non-zero if duplicate fixture IDs exist.

Run:

```bash
cd tools/recognition-benchmark
npm install --no-package-lock --no-audit --no-fund
npx playwright install chromium
npm run generate:fixtures
```

- [ ] **Step 4: Create fixture JSON and evidence snapshots**

Every fixture directory contains:

```text
fixture.json
segments.json
source.png
source.sha256
```

Add `cloud-response.json` only where cloud reconciliation is evaluated. `segments.json` records deterministic line evidence for Core Benchmark, not a substitute for Source Benchmark.

All `fixture.json` files use `schemaVersion: recognition-benchmark-fixture-v1`, explicit provenance and explicit metric applicability.

- [ ] **Step 5: Write asset verification**

`verify-fixture-assets.mjs` checks:

- manifest contains exactly eight approved IDs;
- every directory contains required files;
- no extra fixture directories exist;
- SHA-256 matches;
- PNG dimensions are finite and bounded to maximum 2400×2400;
- file size is below 5 MiB;
- `fixture.json` has no keys matching `/name|address|apartment|phone|email|qr/i` outside approved room-name fields;
- provenance kind/note are present;
- original private source is not referenced by filename or hash.

- [ ] **Step 6: Add corpus README**

Document:

- corpus version `recognition-corpus-v1`;
- public-safety rules;
- fixture generation command;
- source PNGs are committed and CI only verifies them;
- baseline cannot be regenerated by ordinary CI;
- live network/cloud calls are forbidden.

- [ ] **Step 7: Validate and commit**

```bash
node tools/recognition-benchmark/verify-fixture-assets.mjs
pnpm --filter @vlezet/recognition test -- benchmarks/schema/fixture-v1.test.ts
git add packages/recognition/benchmarks/fixtures packages/recognition/benchmarks/README.md tools/recognition-benchmark/generate-fixture-assets.mjs tools/recognition-benchmark/verify-fixture-assets.mjs tools/recognition-benchmark/package.json
git commit -m "test: add recognition benchmark corpus"
```

---

### Task 8: Fixture Scoring, Aggregate Report and Baseline

**Files:**
- Create: `packages/recognition/benchmarks/src/score-fixture.ts`
- Create: `packages/recognition/benchmarks/src/score-fixture.test.ts`
- Create: `packages/recognition/benchmarks/src/aggregate-report.ts`
- Create: `packages/recognition/benchmarks/src/aggregate-report.test.ts`
- Create: `packages/recognition/benchmarks/src/compare-baseline.ts`
- Create: `packages/recognition/benchmarks/src/compare-baseline.test.ts`
- Create: `packages/recognition/benchmarks/src/canonical-json.ts`
- Create: `packages/recognition/benchmarks/src/canonical-json.test.ts`
- Create: `packages/recognition/benchmarks/src/core-benchmark.benchmark.ts`
- Create: `packages/recognition/benchmarks/src/report-command.benchmark.ts`
- Create: `packages/recognition/benchmarks/baselines/recognition-v1.json`
- Modify: `packages/recognition/package.json`
- Modify: root `package.json`

**Interfaces:**
- Consumes: all previous scorers and corpus.
- Produces:

```ts
export function scoreRecognitionFixture(input: RecognitionFixtureScoringInput): RecognitionFixtureResultV1;
export function aggregateRecognitionResults(fixtures: readonly RecognitionFixtureResultV1[]): RecognitionAggregateResultV1;
export function compareRecognitionBaseline(current: RecognitionBenchmarkResultV1, baseline: RecognitionBenchmarkResultV1): RecognitionBaselineComparisonV1;
export function canonicalBenchmarkJson(value: RecognitionBenchmarkResultV1): string;
```

- [ ] **Step 1: Write fixture-scoring RED tests**

Prove:

- all enabled metrics appear;
- disabled metrics appear as `not-applicable`;
- failed fixture is retained with diagnostics;
- candidate IDs do not affect scores;
- current absent room channel produces zero recall for room-enabled fixtures;
- reconciliation metrics are attached.

- [ ] **Step 2: Write aggregate RED tests**

Prove:

- micro precision/recall/F1 uses summed TP/FP/FN;
- medians use all measured fixture distributions;
- failed fixture increments `failedFixtures` and is not excluded;
- `not-applicable` does not enter denominators;
- exact zone-count rate denominator includes all room-enabled fixtures.

- [ ] **Step 3: Write baseline RED tests**

Regression policy for M7.8A:

```ts
export const BASELINE_REGRESSION_TOLERANCE = Object.freeze({
  f1: 1e-9,
  count: 0,
  error: 1e-9,
});
```

Fail when:

- F1/rate metric decreases;
- error/count metric increases where lower is better;
- metric is absent;
- corpus/schema version changes without migration;
- fixture disappears;
- baseline has uncommitted generated marker.

The first baseline may be created only by explicit command with `RECOGNITION_BENCHMARK_WRITE_BASELINE=1`; ordinary command refuses to write.

- [ ] **Step 4: Write canonical JSON RED test**

Canonicalisation must:

- remove `generatedAt` from semantic comparison;
- sort fixture results by fixture ID;
- sort diagnostics and match arrays;
- round report numbers to 6 decimal places;
- emit a trailing newline.

Run twice and assert byte equality.

- [ ] **Step 5: Run RED**

```bash
pnpm --filter @vlezet/recognition test -- benchmarks/src/score-fixture.test.ts benchmarks/src/aggregate-report.test.ts benchmarks/src/compare-baseline.test.ts benchmarks/src/canonical-json.test.ts
```

- [ ] **Step 6: Implement explicit benchmark commands**

Update `packages/recognition/package.json` scripts:

```json
{
  "benchmark:core": "vitest run benchmarks/src/core-benchmark.benchmark.ts --reporter=verbose",
  "benchmark:report": "vitest run benchmarks/src/report-command.benchmark.ts --reporter=verbose"
}
```

Update root scripts:

```json
{
  "benchmark:recognition:core": "pnpm --filter @vlezet/recognition benchmark:core",
  "benchmark:recognition:source": "npm --prefix tools/recognition-benchmark run benchmark",
  "benchmark:recognition:report": "pnpm --filter @vlezet/recognition benchmark:report"
}
```

Core command writes:

```text
artifacts/recognition-benchmark/core-result.json
artifacts/recognition-benchmark/core-summary.md
```

- [ ] **Step 7: Generate the explicit current-main baseline**

The baseline records:

- `corpusVersion: recognition-corpus-v1`;
- `recognitionEngineVersion: "3"`;
- `productBaseCommitSha: 039ddba143cd03ddec0b090606dfdde752446014`;
- the implementation commit used to generate scorer output;
- all eight fixtures and metrics;
- no claim that final M7.8 thresholds pass.

Run only in the implementation branch:

```bash
RECOGNITION_BENCHMARK_WRITE_BASELINE=1 pnpm benchmark:recognition:core
pnpm benchmark:recognition:core
```

Second command must compare against the committed baseline without writing it.

- [ ] **Step 8: Run and commit**

```bash
pnpm benchmark:recognition:core
pnpm --filter @vlezet/recognition test
pnpm --filter @vlezet/recognition typecheck
git add package.json packages/recognition/package.json packages/recognition/benchmarks/src packages/recognition/benchmarks/baselines
[ -f pnpm-lock.yaml ] && git add pnpm-lock.yaml
git commit -m "feat: add recognition benchmark reporting"
```

---

### Task 9: Extract the Shared Production OpenCV Engine

**Files:**
- Create: `apps/web/components/recognition/local-recognition-engine.ts`
- Create: `apps/web/components/recognition/local-recognition-engine.test.ts`
- Modify: `apps/web/components/recognition/recognition.worker.ts`
- Modify: `apps/web/components/recognition/local-recognition-client.test.ts`

**Interfaces:**
- Consumes: current Worker algorithm and existing recognition types.
- Produces:

```ts
export type LocalRecognitionEngineOptions = Readonly<{
  onProgress?: (progress: LocalRecognitionProgress) => void;
  createDraftId?: () => string;
}>;

export async function runLocalRecognitionEngine(
  input: MaterializedLocalRecognitionInput,
  options?: LocalRecognitionEngineOptions,
): Promise<RecognitionDraft>;
```

- [ ] **Step 1: Write extraction RED contracts**

Source-level test asserts:

- `recognition.worker.ts` imports `runLocalRecognitionEngine`;
- Worker no longer owns Canny/Hough/wall/opening algorithm constants;
- Worker still owns `self.onmessage`, request filtering, progress/result/error messages;
- shared engine imports the same `@techstark/opencv-js`, `resolveOpenCvModule`, wall/opening builders and source scaling.

Behaviour test uses deterministic `createDraftId: () => "benchmark-draft"` and a fake progress collector where practical.

- [ ] **Step 2: Run RED**

```bash
pnpm --dir apps/web test -- components/recognition/local-recognition-engine.test.ts components/recognition/local-recognition-client.test.ts
```

- [ ] **Step 3: Move the algorithm without tuning**

Move these values and operations byte-for-byte in behaviour:

- `MIN_STRICT_WALLS = 3`;
- adaptive option formulas;
- grayscale conversion;
- `GaussianBlur(5×5)`;
- `Canny(50,150,3,false)`;
- Hough rho/theta/threshold/min-length/max-gap;
- strict/adaptive wall selection;
- opening hypothesis construction;
- source evidence rescaling;
- diagnostics and decisions;
- engine version and draft status.

Use `options.onProgress?.(...)` at the same phases/progress values. Default draft ID remains `crypto.randomUUID()`.

- [ ] **Step 4: Reduce Worker to a protocol adapter**

Worker implementation becomes structurally:

```ts
context.onmessage = async (event) => {
  const request = event.data;
  if (!request || request.type !== "recognize") return;
  try {
    const draft = await runLocalRecognitionEngine(request.input, {
      onProgress: (progress) => post({ type: "progress", requestId: request.requestId, progress }),
    });
    post({ type: "result", requestId: request.requestId, draft });
  } catch (cause) {
    post({ type: "error", requestId: request.requestId, message: cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание." });
  }
};
```

- [ ] **Step 5: Verify no behavioural drift**

```bash
pnpm --dir apps/web test -- components/recognition/local-recognition-engine.test.ts components/recognition/local-recognition-client.test.ts components/recognition/opencv-loader.test.ts
pnpm --dir apps/web typecheck
pnpm lint
pnpm build
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/recognition/local-recognition-engine* apps/web/components/recognition/recognition.worker.ts apps/web/components/recognition/local-recognition-client.test.ts
git commit -m "refactor: share local recognition engine"
```

---

### Task 10: Benchmark-Only Browser Harness and Source Benchmark

**Files:**
- Create: `apps/web/app/__recognition-benchmark/page.tsx`
- Create: `apps/web/components/recognition/recognition-benchmark-harness.tsx`
- Create: `apps/web/components/recognition/recognition-benchmark-harness.test.tsx`
- Create: `tools/recognition-benchmark/playwright.config.mjs`
- Create: `tools/recognition-benchmark/recognition-source.spec.ts`

**Interfaces:**
- Consumes: shared engine, production `runLocalRecognition`, fixture schemas/scorers.
- Produces a benchmark-only browser API:

```ts
export type RecognitionBenchmarkBrowserApi = Readonly<{
  runDirect(input: SerializedBenchmarkRecognitionInput): Promise<RecognitionDraft>;
  runWorker(input: SerializedBenchmarkRecognitionInput): Promise<RecognitionDraft>;
}>;
```

- [ ] **Step 1: Write harness RED test**

Assert:

- page returns `notFound()` unless `RECOGNITION_BENCHMARK=1`;
- harness does not import project repository, editor store or IndexedDB;
- harness exposes direct and Worker execution only;
- no navigation link points to the route.

- [ ] **Step 2: Write a real failing Playwright source test**

Create the test before the harness implementation. The first assertion should fail because `window.__vlezetRecognitionBenchmark` is absent:

```ts
const apiReady = await page.evaluate(() => Boolean(window.__vlezetRecognitionBenchmark));
expect(apiReady).toBe(true);
```

Run against the current branch application:

```bash
RECOGNITION_BENCHMARK=1 pnpm --dir apps/web dev
npm --prefix tools/recognition-benchmark run benchmark -- --grep "shared engine"
```

Expected: functional RED on missing benchmark bridge, not missing test/config files.

- [ ] **Step 3: Implement the env-gated page**

Server page:

```tsx
import { notFound } from "next/navigation";
import { RecognitionBenchmarkHarness } from "../../components/recognition/recognition-benchmark-harness";

export default function RecognitionBenchmarkPage() {
  if (process.env.RECOGNITION_BENCHMARK !== "1") notFound();
  return <RecognitionBenchmarkHarness />;
}
```

Do not add the route to any app navigation.

- [ ] **Step 4: Implement browser bridge**

The harness:

- loads a copied fixture PNG from `/__recognition-benchmark-assets/<fixture>/source.png`;
- converts it to `ImageData` using a canvas;
- constructs `MaterializedLocalRecognitionInput` with fixed IDs/time;
- calls `runLocalRecognitionEngine` for direct mode;
- calls production `runLocalRecognition` for Worker mode;
- exposes the API on `window` only while mounted;
- removes it on unmount;
- displays only a minimal `Recognition benchmark harness` marker.

- [ ] **Step 5: Implement Playwright config**

Use:

```js
export default defineConfig({
  testDir: ".",
  testMatch: /recognition-source\.spec\.ts/,
  timeout: 120_000,
  workers: 1,
  use: {
    baseURL: process.env.RECOGNITION_BENCHMARK_BASE_URL ?? "http://127.0.0.1:3000",
    browserName: "chromium",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  outputDir: "test-results",
});
```

- [ ] **Step 6: Implement Source Benchmark flow**

For each manifest fixture:

1. open harness route;
2. run direct shared engine with fixed project/reference IDs and `now = "2026-08-01T00:00:00.000Z"`;
3. score returned walls/openings against ground truth;
4. write fixture metrics JSON;
5. generate an SVG overlay with text labels for expected, matched, false-positive and missed entities; do not depend on colour alone;
6. on representative `clean-studio`, also run Worker mode;
7. canonicalise both drafts after removing only random draft ID;
8. assert direct and Worker outputs are equal;
9. write `artifacts/source-result.json` and `artifacts/source-summary.md`.

- [ ] **Step 7: Run Source Benchmark locally**

Copy assets before starting Next:

```bash
rm -rf apps/web/public/__recognition-benchmark-assets
mkdir -p apps/web/public/__recognition-benchmark-assets
cp -R packages/recognition/benchmarks/fixtures/* apps/web/public/__recognition-benchmark-assets/
RECOGNITION_BENCHMARK=1 NEXT_TELEMETRY_DISABLED=1 pnpm --dir apps/web exec next dev --hostname 127.0.0.1
```

In another shell:

```bash
npm --prefix tools/recognition-benchmark install --no-package-lock --no-audit --no-fund
npm --prefix tools/recognition-benchmark exec playwright install chromium
pnpm benchmark:recognition:source
```

Expected: all eight fixtures execute; `clean-studio` direct/Worker seam equality passes.

- [ ] **Step 8: Ensure generated public copies are not committed**

Delete `apps/web/public/__recognition-benchmark-assets` after the run and add a repository ignore rule only if needed. The committed source of truth remains under `packages/recognition/benchmarks/fixtures`.

- [ ] **Step 9: Commit**

```bash
git add apps/web/app/__recognition-benchmark apps/web/components/recognition/recognition-benchmark-harness* tools/recognition-benchmark/playwright.config.mjs tools/recognition-benchmark/recognition-source.spec.ts
git commit -m "test: add browser recognition benchmark"
```

---

### Task 11: Standard CI and Dedicated Recognition Benchmark Workflow

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/recognition-benchmark.yml`
- Modify: root `package.json`, `packages/recognition/package.json`, `pnpm-lock.yaml` only if needed.

**Interfaces:**
- Consumes: Core and Source commands.
- Produces: two merge-blocking exact-head checks and immutable evidence artifact.

- [ ] **Step 1: Add Core Benchmark to Standard CI**

Insert after Unit tests:

```yaml
      - name: Recognition Core Benchmark
        id: recognition_benchmark_core
        shell: bash
        run: |
          set +e
          pnpm benchmark:recognition:core 2>&1 | tee recognition-benchmark-core.log
          status=${PIPESTATUS[0]}
          exit "$status"

      - name: Upload recognition benchmark diagnostics
        if: failure() && steps.recognition_benchmark_core.outcome == 'failure'
        uses: actions/upload-artifact@v4
        with:
          name: recognition-benchmark-core-diagnostics
          path: |
            recognition-benchmark-core.log
            artifacts/recognition-benchmark
          if-no-files-found: warn
          retention-days: 7
```

- [ ] **Step 2: Create the dedicated workflow**

Triggers:

```yaml
on:
  pull_request:
    branches: [main]
    paths:
      - "packages/recognition/**"
      - "apps/web/components/recognition/**"
      - "apps/web/app/__recognition-benchmark/**"
      - "tools/recognition-benchmark/**"
      - ".github/workflows/recognition-benchmark.yml"
      - "package.json"
      - "pnpm-lock.yaml"
  workflow_dispatch:
```

Permissions: `contents: read` only.

- [ ] **Step 3: Implement workflow steps**

Exact order:

1. checkout;
2. setup pnpm 11.15.1;
3. setup Node 22.16.0;
4. frozen pnpm install;
5. install benchmark tool with `npm install --no-package-lock --no-audit --no-fund`;
6. install Chromium with deps;
7. verify fixture assets/privacy/provenance;
8. run Core Benchmark;
9. copy fixture directories to temporary public benchmark path;
10. start Next with `RECOGNITION_BENCHMARK=1`;
11. run Source Benchmark;
12. run report command;
13. calculate SHA-256 for final JSON and Markdown report using `sha256sum`;
14. write `artifacts/recognition-benchmark/SHA256SUMS`;
15. upload artifact named `recognition-benchmark-evidence` for 14 days;
16. stop Next in `always()` step.

No secret or network-provider environment variable is present.

- [ ] **Step 4: Add report merge command**

`pnpm benchmark:recognition:report` reads:

```text
artifacts/recognition-benchmark/core-result.json
artifacts/recognition-benchmark/source-result.json
```

and writes:

```text
artifacts/recognition-benchmark/recognition-benchmark-result.json
artifacts/recognition-benchmark/recognition-benchmark-summary.md
```

It fails if either input is absent, corpus/engine versions disagree or baseline comparison is incomplete.

- [ ] **Step 5: Verify workflow syntax and local full gate**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
node tools/recognition-benchmark/verify-fixture-assets.mjs
```

Then push and require:

- Standard CI PASS;
- Recognition Benchmark PASS;
- existing M7 Browser Audit PASS if path filters trigger it.

- [ ] **Step 6: Commit**

```bash
git add .github/workflows/ci.yml .github/workflows/recognition-benchmark.yml package.json packages/recognition/package.json pnpm-lock.yaml
git commit -m "ci: enforce recognition benchmark"
```

---

### Task 12: Acceptance Record, Final Review and Protected Delivery

**Files:**
- Create: `docs/milestones/m7-8a-acceptance.md`
- Create after evidence: `docs/changelog/2026-08-01-m7-8a.md`
- Modify PR body only; canonical `PROJECT_STATE.md`/roadmaps remain for a separate post-merge docs PR.

**Interfaces:**
- Consumes: actual PR number, exact head SHA, CI run IDs, artifact ID and digest.
- Produces: auditable M7.8A acceptance candidate.

- [ ] **Step 1: Perform scope review**

Compare against base:

```bash
git diff --name-status 039ddba143cd03ddec0b090606dfdde752446014...HEAD
```

Reject the candidate if the diff changes:

- `packages/domain`;
- project schema/migrations/IndexedDB;
- recognition Apply behaviour;
- planner/M2/3D;
- Canny/Hough/threshold formulas beyond file movement;
- OpenRouter production behaviour.

- [ ] **Step 2: Run final exact local commands**

```bash
pnpm install --frozen-lockfile
pnpm validate:m7-docs
pnpm test
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
node tools/recognition-benchmark/verify-fixture-assets.mjs
```

For browser source benchmark, run the documented harness path and confirm eight fixtures plus direct/Worker seam.

- [ ] **Step 3: Request code review**

Use `superpowers:requesting-code-review`. Review specifically:

- assignment optimality and determinism;
- topology clustering/edge scoring;
- host-wall matching;
- privacy/provenance enforcement;
- baseline write protection;
- shared-engine extraction behavioural equivalence;
- route gating and absence from navigation;
- workflow permissions and absence of secrets.

Every actionable defect receives a focused RED test before correction.

- [ ] **Step 4: Record actual automated evidence**

Create `docs/milestones/m7-8a-acceptance.md` with literal values returned by GitHub. Do not use angle-bracket placeholders.

Required fields:

```text
Status: AUTOMATED ACCEPTANCE PASS / PRODUCT OWNER REVIEW PENDING
PR number
final product head
Standard CI run ID/number
Recognition Benchmark run ID/number
M7 Browser Audit run ID/number when applicable
fixture count
corpus version
engine version
aggregate baseline metrics
artifact ID
digest
```

Also record that the baseline is expected to be below final M7.8 thresholds and that M7.8A makes the gap measurable rather than claiming quality completion.

- [ ] **Step 5: Re-run exact-head workflows after acceptance record**

The acceptance-document commit becomes the new head. Require fresh:

- Standard CI PASS;
- Recognition Benchmark PASS;
- M7 Browser Audit PASS where triggered.

- [ ] **Step 6: Product-owner acceptance gate**

Provide a concise report containing:

- the eight source overlays;
- aggregate baseline table;
- example false positives/negatives;
- proof the private original plan was not committed;
- proof live AI was not called;
- proof the product recognition flow still works.

Keep PR Draft until the product owner confirms the benchmark evidence and workflow.

- [ ] **Step 7: Final acceptance and merge**

After product-owner confirmation:

1. update acceptance record with exact confirmation text;
2. obtain fresh exact-head Standard CI and Recognition Benchmark;
3. verify no unresolved review threads;
4. mark PR Ready;
5. squash-merge with expected-head protection;
6. record merge SHA.

- [ ] **Step 8: Separate post-merge canonical docs PR**

Create a docs-only branch from updated `main` and update:

- `docs/PROJECT_STATE.md` — M7.8A DONE, M7.8B NOW;
- `docs/ROADMAP.md`;
- `docs/product/UX_ROADMAP.md`;
- `docs/milestones/m7-8a-acceptance.md`;
- `docs/changelog/2026-08-01-m7-8a.md`.

Preserve issue #27 as open because M7.8B–M7.8D remain.

---

## Final Verification Matrix

| Gate | Command / evidence | Required result |
|---|---|---|
| Fixture contracts | `pnpm --filter @vlezet/recognition test -- benchmarks/schema/fixture-v1.test.ts` | PASS |
| Pure scorer suite | `pnpm --filter @vlezet/recognition test -- benchmarks/src` | PASS |
| Corpus privacy/integrity | `node tools/recognition-benchmark/verify-fixture-assets.mjs` | PASS, exactly 8 fixtures |
| Core benchmark | `pnpm benchmark:recognition:core` | PASS, baseline reproduced |
| Unit regression | `pnpm test` | PASS |
| Type safety | `pnpm typecheck` | PASS |
| Lint | `pnpm lint` | PASS |
| Production build | `pnpm build` | PASS |
| Worker seam | representative direct vs Worker canonical draft | equal |
| Source benchmark | Chromium, all 8 source fixtures | PASS |
| Network safety | workflow/code review | no live provider calls |
| Runtime authority | base/head diff review | unchanged |
| Exact-head CI | GitHub Standard CI | PASS |
| Exact-head benchmark | GitHub Recognition Benchmark | PASS |
| Review | unresolved threads | 0 |
| Product-owner gate | benchmark report/overlays | accepted |

## Expected Next Slice

After accepted M7.8A, the only recommended `NOW` slice is **M7.8B Source Normalisation and Wall Topology**. Its first RED benchmark should target furniture/dimension-line false walls and disconnected/missing wall junctions using the committed corpus; it must not start from arbitrary threshold tuning.
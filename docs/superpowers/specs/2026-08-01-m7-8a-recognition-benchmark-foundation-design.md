# M7.8A — Recognition Benchmark Foundation Design

**Status:** WRITTEN SPECIFICATION — PRODUCT DESIGN APPROVED, IMPLEMENTATION PLAN PENDING  
**Date:** 2026-08-01  
**Repository:** `True-Ruslan/vlezet`  
**Branch:** `feat/m7-8a-recognition-benchmark-foundation`  
**Base:** `039ddba143cd03ddec0b090606dfdde752446014`  
**Parent programme:** M7.8 Reference and Recognition Workflow  
**Backlog authority:** `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md`, issue #27

## 1. Purpose

M7.8A establishes a versioned, anonymised and deterministic benchmark system for Vlezet recognition before any further algorithm tuning.

The milestone does **not** attempt to improve recognition quality itself. It creates the measurement authority that later M7.8 slices must use to prove improvements and prevent regressions.

The design addresses the current product problem:

- the assisted-recognition pipeline can complete local and OpenRouter-assisted checks;
- JSON and candidate lifecycle failures have been hardened;
- a syntactically valid draft may still reconstruct walls, openings, rooms and areas incorrectly;
- current quality observations are mostly visual and fixture-specific;
- tuning Canny, Hough, line merging or model prompts without a corpus can improve one plan while degrading others.

M7.8A therefore makes benchmark evidence a prerequisite for M7.8B–M7.8D.

## 2. Programme decomposition

M7.8 is decomposed into independently reviewable slices:

1. **M7.8A Recognition Benchmark Foundation** — corpus, schemas, scorers, baseline, reports and CI;
2. **M7.8B Source Normalisation and Wall Topology** — architectural-line filtering, wall graph construction and deterministic post-processing;
3. **M7.8C Openings, Rooms, Labels and Area Constraints** — host-wall classification, room faces, label association and area validation;
4. **M7.8D Room-Oriented Review Workflow and Acceptance** — structural review UX, conflict navigation, final benchmark thresholds and product-owner acceptance.

Only M7.8A is authorised by this specification.

## 3. Existing authority to preserve

The current recognition architecture already has the correct product-safety boundary:

- `RecognitionDraft` is a reviewable proposal;
- recognition candidates are not `VlezetDocument` entities;
- local and cloud candidates retain provenance;
- repeated cloud checks reconcile ephemeral candidates and discard stale decisions;
- Apply is explicit;
- Apply converts accepted candidates through editor-core and geometry validation;
- one applied batch remains one semantic Undo/Redo operation;
- OpenRouter keys and raw interactions remain runtime-only;
- recognition sessions remain outside portable project backup/duplicate/import authority.

M7.8A must not weaken or bypass these boundaries.

## 4. Current pipeline facts

The current local browser pipeline is approximately:

```text
source raster
→ grayscale
→ Gaussian blur
→ Canny edges
→ HoughLinesP segments
→ paired parallel-edge wall centre-lines
→ collinear merging
→ wall-gap opening hypotheses
→ RecognitionDraft
```

Cloud results are schema-validated, sanitised and reconciled against the local draft.

Current runtime recognition types contain:

- wall candidates;
- opening candidates;
- room-label candidates;
- diagnostics;
- confidence and provenance;
- candidate decisions.

They do not yet contain authoritative wall graphs, room polygons or room-area structures. M7.8A benchmark ground truth must therefore remain separate from the persistent runtime recognition model.

## 5. Design decision

M7.8A uses a **two-level benchmark system**.

### 5.1 Core Benchmark

A framework-independent Node/Vitest benchmark exercises deterministic recognition modules without browser image decoding.

Inputs may include:

- calibrated source metadata;
- synthetic or recorded line-segment evidence;
- local candidate snapshots;
- sanitised cloud-provider snapshots;
- benchmark ground truth.

The Core Benchmark evaluates:

- fixture schema validation;
- coordinate conversion;
- wall matching;
- wall topology scoring;
- opening matching and host-wall correctness;
- room and area scoring;
- confidence scoring;
- reconciliation integrity;
- aggregation and baseline comparison.

It runs in Standard CI.

### 5.2 Source Benchmark

A Chromium/Playwright benchmark runs the real browser OpenCV recognition path over committed source images.

It covers:

```text
source image
→ browser image preparation
→ OpenCV preprocessing
→ Hough segments
→ local candidates
→ deterministic post-processing
→ benchmark scoring
```

It catches regressions that candidate-only fixtures cannot detect, including changes in:

- raster preparation;
- blur and edge detection;
- Hough parameters;
- browser OpenCV behaviour;
- analysis/source scaling;
- worker integration.

The current worker implementation keeps the recognition function private inside `recognition.worker.ts`. M7.8A may extract that behaviour into a browser-compatible function with this exact boundary:

```ts
export async function runLocalRecognitionEngine(
  input: LocalRecognitionInput,
  options: Readonly<{
    signal?: AbortSignal;
    onProgress?: (progress: LocalRecognitionProgress) => void;
  }>,
): Promise<RecognitionDraft>;
```

Normative requirements for this extraction:

- the Worker remains the production caller;
- the benchmark harness invokes the same function in Chromium;
- no algorithm, thresholds, candidate ordering or diagnostics change during extraction;
- equivalence tests compare Worker-visible output before and after extraction;
- the benchmark must not reimplement OpenCV recognition separately;
- the extracted function remains browser-only and is not imported into Node Core Benchmark execution.

The Source Benchmark runs in a dedicated `Recognition Benchmark` workflow and uploads immutable evidence.

## 6. Repository structure

The benchmark is colocated with `@vlezet/recognition` while browser execution remains in dedicated tooling.

Target structure:

```text
packages/recognition/
  benchmarks/
    README.md
    schema/
      fixture-v1.ts
      result-v1.ts
    fixtures/
      clean-studio/
        source.png
        fixture.json
        segments.json
        cloud-response.json
      clean-multi-room/
      openings-heavy/
      labels-and-areas/
      furniture-heavy/
      low-resolution/
      perspective-photo/
      m7-3-regression-anonymized/
    src/
      coordinates.ts
      validate-fixture.ts
      assignment.ts
      match-walls.ts
      score-wall-topology.ts
      match-openings.ts
      score-rooms.ts
      score-confidence.ts
      score-reconciliation.ts
      score-fixture.ts
      aggregate-report.ts
      compare-baseline.ts
    baselines/
      recognition-v1.json

apps/web/components/recognition/
  local-recognition-engine.ts
  recognition.worker.ts

tools/recognition-benchmark/
  playwright.config.mjs
  recognition-source.spec.mjs
  run-core.mjs
  write-report.mjs
  static-server.mjs

.github/workflows/
  recognition-benchmark.yml
```

Exact file decomposition may be adjusted during implementation planning if repository conventions require it, but the ownership boundaries must remain.

## 7. Corpus v1

Corpus v1 contains eight fixtures.

### 7.1 Required fixtures

1. `clean-studio`
   - simple closed exterior boundary;
   - one internal spatial zone;
   - minimal symbols;
   - clear calibration.

2. `clean-multi-room`
   - multiple connected wall chains;
   - internal partitions;
   - several closed spatial zones.

3. `openings-heavy`
   - multiple doors and windows;
   - different host walls;
   - at least one ambiguous opening symbol.

4. `labels-and-areas`
   - room names;
   - stated room areas;
   - stated total area;
   - labels placed near plausible room centres.

5. `furniture-heavy`
   - furniture, sanitary symbols and hatching;
   - deliberately strong non-architectural line evidence;
   - regression pressure against false wall promotion.

6. `low-resolution`
   - downscaled screenshot;
   - blurred or compressed line evidence;
   - readable but degraded geometry.

7. `perspective-photo`
   - photographed or synthetic perspective distortion;
   - non-axis-aligned image frame;
   - source-normalisation pressure.

8. `m7-3-regression-anonymized`
   - preserves the failure characteristics observed during M7.3 acceptance;
   - dense symbols and labels;
   - external and internal walls;
   - doors and windows;
   - multiple room areas;
   - altered names, dimensions and proportions;
   - contains no personal data or original private source raster.

### 7.2 Fixture file manifest

Every fixture directory must contain:

- `fixture.json` — validated ground truth and metadata;
- one source raster referenced by `fixture.json`;
- `segments.json` — deterministic Core Benchmark line-segment evidence generated from or designed for that fixture.

A fixture may additionally contain:

- `cloud-response.json` — sanitised provider result used for reconciliation tests;
- `notes.md` — human-readable construction/provenance notes.

A missing required file fails the benchmark. Optional files must be declared in `fixture.json`; undeclared extra machine-consumed files are ignored.

### 7.3 Fixture provenance

Every fixture must declare one of:

- `synthetic` — generated specifically for the repository;
- `redrawn-anonymized` — manually reconstructed from observed failure characteristics;
- `licensed` — source licence documented in fixture metadata.

Unverified web images must not enter the corpus.

### 7.4 Privacy and public-repository rules

Before commit, fixture assets must:

- contain no names, addresses, apartment numbers, QR codes or personal identifiers;
- contain no private developer/customer metadata;
- have EXIF and ancillary embedded metadata removed;
- avoid reproducing the original private plan exactly;
- have a documented legal provenance;
- use bounded raster dimensions and compressed lossless/lossy formats appropriate to the case.

The privacy validator inspects both fixture metadata and raster container metadata. A human review remains mandatory for visible content because automated metadata checks cannot prove visual anonymisation.

The original M7.3 user-supplied plan is not committed.

## 8. Canonical coordinate system

Benchmark ground truth uses **reference-local millimetres**.

```text
origin: top-left of calibrated source raster
x-axis: right
y-axis: down
unit: millimetres
```

This coordinate system is intentionally independent of:

- Canvas world origin;
- project placement origin;
- viewport pan/zoom;
- DOM or Konva coordinates;
- source raster resolution.

Each fixture defines:

```ts
export type BenchmarkCalibrationV1 = Readonly<{
  sourceWidthPx: number;
  sourceHeightPx: number;
  millimetersPerPixel: number;
  originPx: Readonly<{ x: number; y: number }>;
}>;
```

Prediction conversion order is normative:

1. validate normalized coordinates in `[0, 1]`;
2. convert to source pixels;
3. subtract fixture `originPx`;
4. multiply by `millimetersPerPixel`;
5. preserve top-left, x-right, y-down orientation.

No scorer may compare normalized coordinates directly when fixture-local millimetres are available.

## 9. Fixture schema v1

The fixture schema is versioned and validated fail-closed.

```ts
export type RecognitionBenchmarkFixtureV1 = Readonly<{
  schemaVersion: "recognition-benchmark-fixture-v1";
  id: string;
  description: string;
  provenance: BenchmarkProvenanceV1;
  tags: readonly BenchmarkTagV1[];
  source: BenchmarkSourceAssetV1;
  calibration: BenchmarkCalibrationV1;
  tolerances: BenchmarkTolerancesV1;
  expectedJunctions: readonly BenchmarkJunctionV1[];
  expectedWalls: readonly BenchmarkWallV1[];
  expectedOpenings: readonly BenchmarkOpeningV1[];
  expectedRooms: readonly BenchmarkRoomV1[];
  expectedLabels: readonly BenchmarkRoomLabelV1[];
  statedTotalAreaM2: number | null;
  metricApplicability: BenchmarkMetricApplicabilityV1;
}>;
```

### 9.1 Expected junctions and walls

```ts
export type BenchmarkJunctionV1 = Readonly<{
  id: string;
  positionMm: BenchmarkPointMm;
}>;

export type BenchmarkWallV1 = Readonly<{
  id: string;
  startMm: BenchmarkPointMm;
  endMm: BenchmarkPointMm;
  thicknessMm: number | null;
  kind: "external" | "partition" | "unknown";
  startJunctionId: string;
  endJunctionId: string;
}>;
```

Requirements:

- finite coordinates;
- non-zero wall length;
- unique wall and junction IDs;
- existing junction references;
- wall endpoint coordinates must equal their referenced junction coordinates within `0.001 mm` schema tolerance;
- thickness positive when present;
- wall direction is not semantically significant.

### 9.2 Expected openings

```ts
export type BenchmarkOpeningV1 = Readonly<{
  id: string;
  kind: "door" | "window";
  hostWallId: string;
  centerMm: BenchmarkPointMm;
  widthMm: number;
  orientationDeg: number | null;
  swing: BenchmarkDoorSwingV1 | null;
}>;
```

Requirements:

- host wall must exist;
- width must be finite and positive;
- swing may exist only for doors;
- orientation/swing may be `null` when not visibly recoverable.

### 9.3 Expected rooms

```ts
export type BenchmarkRoomV1 = Readonly<{
  id: string;
  polygonMm: readonly BenchmarkPointMm[];
  name: string | null;
  classification:
    | "living"
    | "bedroom"
    | "kitchen"
    | "bathroom"
    | "corridor"
    | "balcony"
    | "storage"
    | "other"
    | "unknown";
  statedAreaM2: number | null;
  computedAreaM2: number;
}>;
```

Requirements:

- at least three polygon vertices;
- simple, non-self-intersecting polygon;
- positive computed area;
- `computedAreaM2` must agree with polygon shoelace area within `0.001 m²`;
- stated area remains evidence, not geometry authority.

### 9.4 Metric applicability

Every fixture explicitly declares which metrics are meaningful.

```ts
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

A disabled metric is reported as `not-applicable`, never silently omitted or represented as zero.

## 10. Result schema v1

Every benchmark run emits a machine-readable result.

```ts
export type RecognitionBenchmarkResultV1 = Readonly<{
  schemaVersion: "recognition-benchmark-result-v1";
  corpusVersion: "recognition-corpus-v1";
  recognitionEngineVersion: string;
  commitSha: string;
  generatedAt: string;
  fixtures: readonly RecognitionFixtureResultV1[];
  aggregate: RecognitionAggregateResultV1;
  baselineComparison: RecognitionBaselineComparisonV1 | null;
}>;
```

`generatedAt` is excluded from deterministic semantic equality. All metric arrays and diagnostics use stable sorting.

## 11. Matching policy

All matching is deterministic, one-to-one and independent of ephemeral candidate IDs.

### 11.1 General rules

The scorer must not:

- match one prediction to multiple expected entities;
- use input array order as a semantic tie-breaker;
- require equal segment direction;
- treat close geometry as correct when topology or host relationships are wrong;
- use candidate IDs as matching evidence;
- mutate predictions or ground truth.

### 11.2 Stable optimal assignment

For each entity type:

1. build all admissible expected/predicted pairs;
2. encode the complete deterministic cost tuple as lexicographically comparable fixed-precision integers;
3. find a **maximum-cardinality** one-to-one matching;
4. among maximum-cardinality matchings, select the **minimum-total-cost** matching;
5. resolve any remaining equal-cost solution by stable geometry-derived expected and predicted keys;
6. report unmatched predictions as false positives;
7. report unmatched expected entities as false negatives.

A greedy pair-selection algorithm is explicitly forbidden because locally cheapest matches can reduce global cardinality or produce a worse total assignment.

The implementation may use an internal bounded bipartite assignment algorithm without adding a dependency. Corpus sizes are intentionally small. Any future assignment-algorithm change requires scorer equivalence tests or an explicit baseline migration.

### 11.3 Wall admissibility

A predicted wall may match an expected wall only when:

- orientation delta is within fixture tolerance;
- mean orientation-independent endpoint distance is within tolerance;
- projected overlap ratio meets the minimum;
- length ratio is within the permitted range.

The cost tuple is:

```text
endpoint distance
orientation delta
1 - overlap ratio
absolute length error
stable expected wall geometry key
stable predicted wall geometry key
```

### 11.4 Opening admissibility

A predicted opening may match an expected opening only when:

- kind matches exactly;
- centre distance is within tolerance;
- width error is within tolerance;
- the predicted host wall resolves through wall matching to the expected host wall.

An opening with correct position but wrong or unknown host wall is not a true positive.

### 11.5 Room admissibility

Room matching uses polygon intersection-over-union after both polygons are expressed in fixture-local millimetres.

A pair is admissible only when IoU meets the fixture threshold. Name/classification agreement is scored separately and cannot rescue poor geometry.

## 12. Tolerances

Corpus v1 centralises tolerances in fixture metadata with bounded defaults.

```ts
export type BenchmarkTolerancesV1 = Readonly<{
  wallEndpointMm: number;
  wallOrientationDeg: number;
  wallMinimumOverlapRatio: number;
  wallLengthRelativeError: number;
  junctionMm: number;
  openingCenterMm: number;
  openingWidthMm: number;
  roomMinimumIoU: number;
  labelAnchorMm: number;
}>;
```

Normative default values:

```text
wall endpoint distance:      120 mm
wall orientation delta:        5°
wall minimum overlap ratio:   0.70
wall relative length error:   0.20
junction distance:            120 mm
opening centre distance:      150 mm
opening width error:          150 mm
room minimum IoU:             0.75
label anchor distance:        500 mm
```

Fixtures may tighten or relax a tolerance only when the reason is stated in fixture metadata. Source degradation alone is not permission to make all metrics permissive.

## 13. Metrics

### 13.1 Wall geometry

Per fixture:

- precision;
- recall;
- F1;
- median endpoint distance;
- median orientation delta;
- median relative length error;
- duplicate prediction count.

### 13.2 Wall topology

Expected topology uses declared junction IDs.

Predicted topology is derived only for scoring and does not mutate runtime candidates:

1. convert predicted wall endpoints to fixture-local millimetres;
2. collect all endpoints with stable geometry keys;
3. cluster endpoints whose pairwise distance is within `junctionMm` using deterministic connected components;
4. assign each cluster a stable ID from its sorted, rounded member coordinates;
5. reject self-loop edges created by a wall whose endpoints fall into the same cluster;
6. create an undirected edge for each surviving predicted wall;
7. preserve duplicate predicted edges as duplicate/extra topology evidence rather than collapsing them silently.

Metrics:

- junction precision/recall/F1;
- edge precision/recall/F1;
- connected-component count error;
- missing edge count;
- extra edge count;
- self-loop count;
- duplicate edge count;
- topology F1.

Junction matching uses the same maximum-cardinality minimum-cost assignment policy with distance as the admissibility/cost measure. Predicted edge correctness is evaluated through the matched junction pair, not through wall candidate IDs.

A wall geometry match with wrong junction connectivity may pass geometry matching but fail topology scoring.

### 13.3 Openings

Metrics:

- door precision/recall/F1;
- window precision/recall/F1;
- combined opening precision/recall/F1;
- host-wall accuracy;
- median centre error;
- median width error;
- unknown-host opening count;
- duplicate opening count.

### 13.4 Rooms and areas

Metrics:

- exact spatial-zone count;
- absolute zone-count error;
- room polygon IoU distribution;
- median total-area absolute percentage error;
- median per-room absolute percentage error;
- median per-room absolute error in square metres;
- room name/classification accuracy;
- label-to-room association accuracy.

Computed geometry area and stated source area remain separate evidence fields.

Current M7.8A runtime predictions do not yet include room polygons. For source/current-main baseline fixtures where room predictions are absent:

- room metrics are reported as applicable with zero recall when the fixture expects rooms and the benchmark input contract says a future prediction channel is expected;
- they are `not-applicable` only for fixtures that explicitly disable room evaluation;
- the scorer does not fabricate room predictions from raw wall candidates during M7.8A.

This preserves an honest baseline for M7.8C.

### 13.5 Confidence

After deterministic matching:

- high-confidence true positives;
- high-confidence false positives;
- medium/low true positives;
- medium/low false positives;
- incorrect high-confidence rate;
- review-required candidate count.

Formula:

```text
incorrect high-confidence rate
= high-confidence false positives
  / max(1, all high-confidence predictions)
```

### 13.6 Reconciliation integrity

Contract metrics:

- stale decisions referencing removed candidates;
- new candidates without `pending` decisions;
- decisions transferred to non-equivalent candidates;
- unknown candidate references;
- duplicate final candidate IDs.

All must remain zero.

## 14. Aggregate report

The aggregate report contains:

```text
corpus version
recognition engine version
fixture count
wall geometry F1
wall topology F1
opening F1
exact zone-count rate
median total-area error
median room-area error
incorrect high-confidence rate
unknown-host openings
stale decisions
failed fixtures
```

It also contains one row per fixture:

```text
fixture
applicable metrics
baseline
current
absolute delta
relative delta
target
status
```

Aggregation rules:

- micro precision/recall/F1 for entity counts;
- median for geometric/area error distributions;
- exact-rate for binary fixture outcomes;
- `not-applicable` fixtures excluded from a metric denominator;
- failed fixture execution is never silently excluded.

## 15. Baseline policy

The initial baseline records current `main` recognition behaviour as exercised by the completed M7.8A harness.

It is expected to miss final M7.8 quality targets. M7.8A succeeds by making that quality measurable and reproducible.

### 15.1 Baseline file

`packages/recognition/benchmarks/baselines/recognition-v1.json` contains:

- corpus version;
- recognition engine version;
- product base commit SHA `039ddba143cd03ddec0b090606dfdde752446014` whose recognition behaviour is being measured;
- harness/scorer commit SHA used to generate the file;
- per-fixture metrics;
- aggregate metrics;
- expected deterministic diagnostics.

Because M7.8A does not alter recognition behaviour, the measured product behaviour must remain equivalent to the stated product base commit.

### 15.2 Regression gate

Until M7.8B final thresholds are activated, CI requires:

- fixture execution success;
- schema validity;
- deterministic report reproduction;
- no metric regression beyond explicit allowance;
- no increase in unknown-host openings;
- no increase in stale decisions;
- no silently missing metrics.

Continuous metrics use explicit non-regression allowances to avoid floating-point noise. Corpus v1 defaults:

```text
F1/rates:            maximum decrease 0.000001
millimetre errors:   maximum increase 0.001 mm
area errors:         maximum increase 0.000001 percentage points
counts:              no increase for defect counts
```

Because the pipeline and scorer are deterministic, these allowances are numerical tolerances, not product-quality budgets.

### 15.3 Updating the baseline

A baseline update must:

- be an explicit changed file;
- include a commit/PR explanation;
- include a generated before/after report;
- identify intended improvements and any regressions;
- never be bundled invisibly with unrelated product work;
- preserve corpus-version compatibility or perform an explicit corpus migration.

`--update-baseline` is a local/manual command and is never used automatically in CI.

## 16. Commands

Root scripts:

```text
pnpm benchmark:recognition:core
pnpm benchmark:recognition:source
pnpm benchmark:recognition:report
pnpm benchmark:recognition:compare
```

Expected semantics:

- `core` validates fixtures and executes deterministic non-browser scoring;
- `source` executes browser/OpenCV fixtures through the shared engine seam;
- `report` combines available result fragments into JSON and Markdown;
- `compare` compares the generated result with the committed baseline and exits non-zero on a regression.

Implementation planning may combine commands internally, but these user-facing capabilities must remain available.

## 17. Standard CI integration

Standard CI adds a bounded benchmark step after unit tests and before build completion.

It runs:

1. fixture schema validation;
2. scorer unit tests;
3. Core Benchmark fixtures;
4. deterministic repeatability check;
5. baseline comparison.

The Core Benchmark must not:

- require Chromium;
- download external models or data;
- call OpenRouter;
- require secrets;
- mutate committed fixture or baseline files.

## 18. Recognition Benchmark workflow

A dedicated workflow runs on pull requests that change:

- `packages/recognition/**`;
- browser recognition worker/engine/integration files;
- benchmark fixtures/tooling;
- workflow itself;
- relevant lockfiles.

It may also support manual dispatch.

Required steps:

1. checkout exact head;
2. frozen dependency install;
3. install Chromium;
4. validate fixture privacy/provenance metadata;
5. start a benchmark-only browser harness served from repository tooling;
6. load each source asset as browser `ImageData`;
7. invoke `runLocalRecognitionEngine()` directly in Chromium using the same OpenCV module as the Worker;
8. compare a representative fixture output with the Worker message-path output to preserve seam equivalence;
9. run all Source Benchmark fixtures;
10. combine Core and Source results;
11. compare baseline;
12. upload JSON report;
13. upload Markdown summary;
14. upload per-fixture overlays/diagnostics;
15. publish artifact SHA-256 digest.

The benchmark-only harness is not a user-facing product route, is not included in ordinary application navigation, and does not persist any recognition session or project data.

The workflow is merge-blocking for M7.8A and later recognition changes.

## 19. Source Benchmark evidence

Each source fixture produces:

- source preview;
- expected wall/opening/room overlay;
- predicted wall/opening overlay;
- matched/unmatched colour-independent annotations;
- fixture metrics JSON;
- deterministic diagnostics;
- worker/engine version.

Overlays are evidence only. They are not geometry authority and must not be consumed by the product runtime.

## 20. OpenRouter and cloud evaluation

Live cloud calls are forbidden in merge-blocking CI because they are:

- non-deterministic;
- secret-dependent;
- potentially billable;
- externally versioned;
- unsuitable as an exact-head regression authority.

Cloud-path benchmark coverage uses committed, sanitised provider-response snapshots validated by the existing provider schema.

A future manual, non-blocking provider evaluation workflow may be designed separately. It cannot replace deterministic benchmark results.

## 21. Determinism contract

Two runs on the same commit, environment and fixture corpus must produce semantically identical results.

Determinism requirements:

- stable fixture discovery order;
- stable candidate sorting before scoring;
- stable optimal-assignment tie-breakers;
- stable diagnostic ordering;
- fixed numeric rounding in reports;
- no random IDs in benchmark semantics;
- timestamps excluded from semantic equality;
- no wall-clock-dependent confidence;
- no network calls;
- no implicit operating-system path ordering.

The repeatability test runs the scorer twice and compares canonicalised result JSON.

## 22. Failure handling

The benchmark fails closed.

Examples:

- invalid fixture schema → fixture fails and whole command exits non-zero;
- missing source asset or `segments.json` → failure, not skip;
- missing applicable ground truth → failure;
- scorer exception → fixture recorded as failed and whole command exits non-zero;
- Source Benchmark browser crash → workflow failure;
- absent baseline metric → failure;
- new metric not represented in baseline schema → explicit baseline migration required;
- unavailable declared cloud snapshot → affected cloud test fails;
- `not-applicable` metric used in aggregate denominator → contract-test failure;
- Worker/shared-engine equivalence mismatch → failure.

## 23. Testing strategy

Implementation follows RED → GREEN.

Required focused tests include:

1. fixture validation rejects malformed IDs, coordinates, walls, hosts and polygons;
2. fixture validation rejects missing files and undeclared provenance;
3. coordinate conversion preserves calibration and top-left orientation;
4. reversed wall direction matches identically;
5. one prediction cannot satisfy two expected walls;
6. matching is invariant to input array order;
7. matching finds the maximum-cardinality global optimum where greedy selection would fail;
8. equal-cost matching resolves by stable geometry keys;
9. close wall with wrong junction topology loses topology credit;
10. predicted endpoint clustering is deterministic and reports self-loops/duplicates;
11. opening with wrong host wall is a false positive;
12. unknown-host opening count is explicit;
13. room IoU and zone-count metrics are deterministic;
14. missing room predictions produce honest zero recall rather than `not-applicable` where rooms are enabled;
15. stated and computed areas remain separate;
16. disabled metrics produce `not-applicable`;
17. high-confidence false-positive rate is correct;
18. stale reconciliation decisions remain zero;
19. report aggregation excludes only explicit `not-applicable` values;
20. repeated runs produce identical canonical JSON;
21. baseline comparison rejects regressions;
22. CI cannot update the baseline;
23. shared engine extraction preserves Worker-visible output;
24. Source Benchmark exercises the real OpenCV engine rather than fixture snapshots only.

## 24. Product and architecture non-goals

M7.8A does not authorise:

- changes to `VlezetDocument`;
- schema or migration changes;
- persistent room polygons in `RecognitionDraft`;
- persistent wall topology graphs in recognition sessions;
- changes to Apply semantics;
- automatic acceptance or Apply;
- OpenRouter prompt/model changes;
- live AI CI calls;
- Canny/Hough tuning;
- new image-normalisation algorithms;
- room-oriented review UI;
- direct mutation of project geometry from benchmark output;
- planning or 3D changes;
- claims that final recognition targets are already met.

The only permitted production-code refactor is extraction of the existing local engine into the shared browser seam defined in section 5.2, with strict behaviour-equivalence tests.

## 25. Initial target context

The approved quality requirements define the intended future release targets:

```text
exact spatial-zone count:                ≥ 90% of benchmark plans
total-area absolute percentage error:    median ≤ 5%
per-room area absolute percentage error: median ≤ 10%
wall topology F1:                         ≥ 0.90
door/window detection F1:                ≥ 0.85
incorrect high-confidence candidates:     ≤ 2%
unknown-host openings:                    0
stale decisions:                          0
```

M7.8A reports these targets but does not require current-main recognition to meet them.

M7.8B–M7.8D will progressively activate target gates only after the corresponding runtime capability exists.

## 26. Acceptance criteria

M7.8A is complete only when all conditions are satisfied.

### Corpus

- eight required fixtures are committed;
- every fixture contains `fixture.json`, a declared source raster and `segments.json`;
- all fixture assets are anonymised and provenance-documented;
- the M7.3 failure characteristics are represented without committing the private original;
- automated raster-metadata checks and manual visual privacy review pass;
- fixture schema v1 validates every fixture.

### Core benchmark

- coordinate conversion is implemented and tested;
- maximum-cardinality minimum-cost assignment is implemented and tested;
- wall, topology, opening, room, area, confidence and reconciliation scorers exist;
- matching is deterministic and order-invariant;
- predicted topology derivation is deterministic;
- metric applicability is explicit;
- Core Benchmark runs in Standard CI.

### Source benchmark

- the production Worker delegates to the shared browser engine seam;
- behaviour-equivalence tests pass;
- real Chromium/OpenCV engine execution is covered;
- all source fixtures complete;
- expected/predicted overlays and diagnostics are generated;
- no network/provider calls occur;
- dedicated workflow is merge-blocking.

### Baseline and reports

- current-main-equivalent baseline is committed;
- report contains per-fixture and aggregate metrics;
- baseline comparison fails on unapproved regression;
- repeated runs are semantically identical;
- JSON and Markdown reports are uploaded with artifact digest;
- exact-head CI evidence is recorded.

### Architecture

- product recognition behaviour is unchanged;
- runtime recognition persistence is unchanged;
- Apply and semantic history are unchanged;
- benchmark types do not become product source-of-truth types;
- no live AI evaluation is required.

### Acceptance gates

- Standard CI passes on the exact final head;
- Recognition Benchmark workflow passes on the exact final head;
- ordinary M7 Chromium/WebKit regression remains green;
- product-owner reviews the benchmark report and representative overlays;
- PR remains Draft until all gates are complete.

## 27. Implementation readiness

The approved implementation sequence is:

1. fixture/result schemas and fail-closed validation;
2. coordinate conversion and deterministic optimal assignment;
3. wall geometry matching and predicted topology derivation;
4. opening, room, area, confidence and reconciliation scoring;
5. aggregate report and canonical deterministic output;
6. initial synthetic/redrawn fixture set;
7. behaviour-preserving local-engine extraction;
8. current-main-equivalent baseline generation;
9. Core Benchmark commands and Standard CI gate;
10. Source Benchmark browser harness;
11. dedicated workflow, overlays and artifact evidence;
12. exact-head verification and product-owner report review.

No runtime recognition algorithm changes may be mixed into M7.8A implementation commits. Any production-code change beyond the explicitly permitted engine extraction requires a separate design amendment and user approval.

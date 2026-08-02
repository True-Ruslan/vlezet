# M7.8B — Source Normalisation and Wall Topology Design

**Status:** APPROVED BY PRODUCT OWNER AUTONOMY / READY FOR IMPLEMENTATION PLAN  
**Date:** 2026-08-02  
**Repository:** `True-Ruslan/vlezet`  
**Branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Base:** `d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d`  
**Parent programme:** M7.8 Reference and Recognition Workflow  
**Backlog authority:** `docs/product/RECOGNITION_QUALITY_REQUIREMENTS.md`, issue #27  
**Measurement authority:** M7.8A `recognition-corpus-v1`, Core Benchmark and Chromium Source Benchmark

## 1. Purpose

M7.8B must turn the accepted benchmark foundation into the first measurable recognition-quality improvement.

The milestone owns two consecutive stages:

1. source normalisation and architectural-line extraction;
2. deterministic wall snapping, merging and topology construction.

It does not own opening classification, room-face derivation, OCR, area constraints, cloud reconciliation or the final room-oriented review UX. Those remain M7.8C and M7.8D.

The immediate product failure to remove is:

> a clear dense grayscale developer plan with thick walls can produce `0` local walls, while model output may remain structurally unrelated to the source.

M7.8B must not tune one private image. The private raster and screenshots remain outside the repository. A repository-owned synthetic/redrawn analogue supplies equivalent pressure through the public benchmark.

## 2. Approaches considered

### Approach A — Prompt-first cloud reconstruction

Send a richer prompt and ask the model to return a complete wall graph.

Rejected for M7.8B because:

- it cannot explain whether source extraction or semantic interpretation failed;
- it is nondeterministic and provider-dependent;
- it cannot serve offline/manual workflows;
- it risks producing syntactically valid but structurally wrong geometry;
- it would bypass the accepted delivery order.

### Approach B — Retune only Canny/Hough constants

Change edge and line thresholds until current fixtures produce more segments.

Rejected as the primary design because:

- more segments can increase furniture/text false positives;
- one global threshold cannot cover clean plans, low-resolution screenshots and perspective images;
- the output remains a flat candidate list without junction authority;
- the change is difficult to explain and maintain.

### Approach C — Staged deterministic evidence pipeline

Run bounded multi-pass source normalisation, classify and consolidate architectural line evidence, then build an explicit transient wall topology graph before converting it back to ordinary `RecognitionWallCandidate` values.

Selected because it:

- separates image-extraction failure from topology-construction failure;
- remains deterministic and browser-local;
- improves the same shared engine used by production and Source Benchmark;
- keeps topology transient and outside `VlezetDocument`;
- allows focused unit tests and benchmark attribution;
- preserves Draft + explicit Apply authority.

## 3. Scope decomposition

M7.8B is delivered as one PR with four internally reviewable layers.

### B1. Source normalisation

The browser engine creates complementary edge evidence instead of one fixed Canny pass.

Required bounded passes:

1. grayscale conversion;
2. histogram equalisation;
3. light Gaussian denoise;
4. strict Canny pass for clean high-contrast boundaries;
5. permissive Canny pass for faded or compressed walls;
6. Hough extraction from both passes;
7. deterministic segment deduplication before geometry processing.

No external CV dependency is added. The implementation uses the existing OpenCV.js runtime.

The pipeline must keep memory bounded and delete every temporary `cv.Mat` in `finally`.

### B2. Architectural-line filtering

A pure framework-independent module receives Hough segments and source dimensions.

It must:

- reject non-finite and near-zero segments;
- reject segments below the calibrated/adaptive minimum length;
- reject crop/image-frame artefacts that lie within a bounded border margin and span most of the source dimension;
- classify near-horizontal and near-vertical evidence using an explicit angular tolerance;
- retain non-axis-aligned evidence only when it participates in a plausible paired-edge wall candidate;
- deduplicate direction-independent near-identical segments;
- preserve enough metadata to explain rejection or retention.

Text, dimension guides, furniture and sanitary symbols are not identified semantically in M7.8B. They are suppressed through structural evidence rules: paired parallel support, plausible thickness, continuity and topology contribution.

### B3. Wall topology construction

A pure transient graph is built from wall centreline candidates.

```ts
export type LocalWallTopology = Readonly<{
  junctions: readonly LocalWallJunction[];
  edges: readonly LocalWallTopologyEdge[];
  diagnostics: readonly LocalWallTopologyDiagnostic[];
}>;
```

The graph must:

- treat wall direction as non-semantic;
- snap endpoints within an explicit pixel tolerance;
- extend an endpoint to a nearby perpendicular wall intersection only within a bounded extension tolerance;
- split walls at interior T/cross intersections;
- merge duplicate or overlapping collinear fragments;
- remove zero/near-zero fragments created by splitting;
- assign deterministic geometry-derived junction and edge IDs;
- report connected-component count, isolated edges and unresolved near-junctions;
- never mutate persistent project geometry.

The topology output is converted back to `RecognitionWallCandidate[]` because the runtime Draft schema intentionally does not yet persist a wall graph. Candidate evidence records topology provenance and diagnostic reasons.

### B4. Benchmark integration

Core Benchmark must use the same adaptive physical-scale options and topology post-processing as production.

Source Benchmark continues to invoke the real browser engine.

M7.8B acceptance is based on comparison against the committed M7.8A baseline, not absolute final M7.8 thresholds.

## 4. Interfaces

### 4.1 Source segment normalisation

```ts
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
  orientation: "horizontal" | "vertical" | "diagonal";
  sourceCount: number;
}>;

export function normaliseArchitecturalLineSegments(input: Readonly<{
  widthPx: number;
  heightPx: number;
  segments: readonly DetectedLineSegment[];
  options: ArchitecturalLineOptions;
}>): readonly NormalisedLineSegment[];
```

The function is deterministic, side-effect free and stably sorted by geometry.

### 4.2 Topology construction

```ts
export type BuildLocalWallTopologyInput = Readonly<{
  widthPx: number;
  heightPx: number;
  walls: readonly RecognitionWallCandidate[];
  endpointSnapTolerancePx: number;
  endpointExtensionTolerancePx: number;
  intersectionTolerancePx: number;
  minimumEdgeLengthPx: number;
}>;

export function buildLocalWallTopology(
  input: BuildLocalWallTopologyInput,
): LocalWallTopology;

export function topologyWallCandidates(
  topology: LocalWallTopology,
  input: Readonly<{ widthPx: number; heightPx: number }>,
): RecognitionWallCandidate[];
```

Coordinates inside the topology module are analysis pixels. Conversion to normalized Draft coordinates happens only in `topologyWallCandidates()`.

### 4.3 Existing wall builder

`buildWallCandidates()` remains the public entry point for segment-to-wall conversion.

It is refactored into this sequence:

```text
raw Hough segments
→ normaliseArchitecturalLineSegments
→ paired-edge centreline extraction
→ collinear consolidation
→ buildLocalWallTopology
→ topologyWallCandidates
```

Existing callers do not receive a breaking signature change.

## 5. Determinism and identity

- all numeric tie-breaking uses fixed epsilon comparisons and stable geometry keys;
- input array order must not affect output IDs or ordering;
- wall and junction IDs derive from quantized geometry, not loop indices;
- reverse-direction input segments must produce identical output;
- duplicate Hough evidence increments `sourceCount` instead of creating duplicate walls;
- recognition candidate decisions remain ephemeral and are recreated for the final candidate set.

The local recognition engine version is bumped from `3` to `4`. Baseline migration is explicit and reviewed after exact-head benchmark evidence is available.

## 6. Error and diagnostic behaviour

M7.8B must fail soft in the product and fail closed in benchmark tooling.

Product behaviour:

- OpenCV failure remains a categorized recognition error;
- zero final walls produces the existing warning;
- multi-pass fallback adds one information diagnostic;
- disconnected topology adds a review diagnostic but does not auto-apply or invent missing walls;
- low-confidence fragments remain reviewable.

Benchmark behaviour:

- invalid options, non-finite dimensions or malformed segment snapshots throw;
- baseline engine-version drift fails until the baseline is explicitly migrated;
- result/report generation remains deterministic;
- no benchmark baseline is updated automatically.

## 7. Test strategy

### 7.1 Pure unit tests

Architectural-line tests cover:

- reversed and duplicate segments;
- border-frame rejection;
- short-noise rejection;
- horizontal/vertical classification;
- diagonal retention only through plausible paired evidence;
- stable output under input permutation.

Topology tests cover:

- corner endpoint snapping;
- T-junction extension and splitting;
- cross-intersection splitting;
- collinear overlap consolidation;
- deterministic IDs under reversed/permuted input;
- isolated-component diagnostics;
- no zero-length output edges.

### 7.2 Product-engine tests

Source-level tests assert:

- equalised strict and permissive passes are both present;
- segment deduplication happens before `buildWallCandidates()`;
- all temporary OpenCV matrices are deleted;
- engine version `4` is used;
- existing Worker protocol and progress phases remain unchanged.

### 7.3 Benchmark tests

The first RED fixture reproduces the accepted product-owner failure characteristics using repository-owned assets:

- dense grayscale developer plan;
- thick external/internal walls;
- door swings and windows;
- sanitary/furniture symbols;
- room labels and area values;
- decorative/dimension lines.

The fixture may be the existing `m7-3-regression-anonymized` asset if its source and segment evidence already cover these characteristics; otherwise it is revised through the existing fixture generator without copying the private plan.

Acceptance comparisons:

- Core wall geometry F1 must improve over `0.131737`;
- Core wall topology F1 must improve over `0.131737`;
- Source wall geometry and topology F1 must become greater than `0`;
- the dense regression fixture must no longer return zero source walls;
- furniture-heavy false positives must not increase beyond reviewed allowance;
- incorrect high-confidence rate, unknown-host openings and stale decisions must not regress;
- Standard CI, Recognition Benchmark, Chromium and WebKit must pass on the exact PR head.

These are M7.8B improvement gates, not the final M7.8 targets of wall topology F1 `≥ 0.90`.

## 8. Authority boundaries

M7.8B must not change:

- `VlezetDocument`, schema or migrations;
- IndexedDB or project backup/import/export formats;
- editor-core Apply/history authority;
- M2 fit/collision/door/clearance authority;
- planner or 3D projections;
- OpenRouter request/response contract;
- provider key or raw response persistence;
- explicit Draft review and Apply requirements.

Transient local topology is recognition evidence only.

## 9. Non-goals

M7.8B does not implement:

- door versus window classification;
- opening host-wall final validation;
- room polygons or face traversal;
- OCR or room-label association;
- total/per-room area reconciliation;
- cloud/local candidate reconciliation changes;
- room-oriented review UI;
- automatic Apply;
- diagonal/curved-wall completeness for every architectural style.

Diagonal evidence is preserved where structurally supported, but final irregular-plan coverage is not claimed in this slice.

## 10. Acceptance and integration

M7.8B is accepted only when:

1. the branch contains RED → GREEN evidence for line filtering and topology;
2. exact-head Core and Source benchmark reports show the required directional improvement;
3. overlays visibly show source plans plus materially closer wall geometry;
4. the ordinary import → calibration → local recognition → optional AI review → explicit Apply workflow remains reachable;
5. product-owner review confirms that local recognition no longer returns an empty wall draft on the representative clear plan or an equivalent repository-owned regression;
6. documentation records remaining M7.8C work without overstating recognition completion;
7. PR is squash-merged only after exact-head CI, benchmark, Chromium/WebKit and product-owner acceptance.

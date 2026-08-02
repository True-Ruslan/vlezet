# M7.8B — Source Normalisation and Wall Topology Acceptance

**Status:** AUTOMATED REMEDIATION PASS / PRODUCT OWNER RE-REVIEW REQUIRED  
**Date:** 2026-08-02  
**PR:** #41  
**Feature branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Base:** `d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d`  
**Final product implementation head:** `adc07f536bc1f99f908575e7b036ad7ef29ae8ef`

## Product-owner failure that blocked the first implementation

The first M7.8B candidate was not accepted. A representative clear apartment plan produced:

- 417 local wall candidates;
- 0 openings;
- furniture, sanitary symbols, labels, digits and door arcs promoted into the wall graph;
- no fully confident candidate;
- AI review that retained the polluted network and added unsupported long lines.

This is recorded in `m7-8b-product-owner-fail-2026-08-02.md`. PR #41 remains Draft and must not be merged until the same real plan passes a new product-owner review.

The private source plan and screenshots were not committed.

## Confirmed root cause

The line-first path ran Hough evidence over the complete raster. On the representative source it produced roughly 1,000 line segments. Pairwise parallel-line matching then created more than 12,000 possible centrelines. Dense symbol and furniture networks could become larger and more connected than the actual apartment shell.

The earlier largest-component and dominant-thickness filters were therefore downstream symptom filters. They could not reliably recover architectural meaning once the candidate space had already been polluted.

## Remediation delivered

### Region-first wall evidence

The browser engine now treats filled thick wall regions as primary evidence:

1. grayscale conversion;
2. Otsu binary inversion;
3. bounded morphological opening;
4. deterministic horizontal and vertical thick-region scan;
5. stable band grouping by overlap and run-length similarity;
6. thickness, length and aspect-ratio validation;
7. conversion of each accepted region into exactly two boundary segments;
8. existing centreline and topology construction.

Canny/Hough is now a bounded fallback only when fewer than three structural regions are available. On all orthogonal benchmark plans the selected mode is `regions`; Hough is not executed.

This directly prevents thin labels, dimensions, furniture outlines, sanitary symbols, hatching and door arcs from entering the wall-pair combinatorics.

### Fail-closed product boundaries

- more than 80 local walls are rejected as an unreviewable Draft;
- an overloaded Draft is not persisted or supplied to AI;
- previously persisted overloaded sessions are sanitised on restore;
- almost-full-frame unsupported AI walls are rejected;
- cloud candidate explosions are rejected fail-closed;
- local opening hypotheses remain deferred until M7.8C host-wall classification.

### Engine and corpus migration

- local recognition engine version: `5`;
- one public engine-version source for Worker, controller and benchmark;
- explicit reviewed baseline migration;
- corpus expanded from eight to nine fixtures;
- new `clutter-symbol-regression` fixture is repository-owned synthetic data with independently generated geometry and no user raster, dimensions or identifiers;
- generator preserves the manually reviewed clutter fixture instead of overwriting it;
- corpus verifier applies PNG metadata, size, schema, dimensions and SHA-256 checks to all nine fixtures.

## Measured result

### Aggregate

| Metric | Previous post-failure Source | Region-first Core | Region-first Source |
| --- | ---: | ---: | ---: |
| Wall geometry F1 | `0.492537` | `0.855615` | `0.837989` |
| Wall topology F1 | `0.462687` | `0.834225` | `0.837989` |
| Incorrect high-confidence rate | `0` | `0` | `0` |
| Unknown-host openings | `0` | `0` | `0` |
| Stale decisions | `0` | `0` | `0` |

### Dense anonymised regression

```text
Source wall geometry F1: 0.880000
Source wall topology F1: 0.880000
geometry evidence:       TP 11 / FP 2 / FN 1
```

### New clutter-symbol regression

```text
structural regions: 19
selected mode:       regions
source walls:        12
wall geometry F1:    1.000000
wall topology F1:    1.000000
geometry evidence:   TP 12 / FP 0 / FN 0
candidate overload:  false
```

The overlay confirms that the large digit, furniture, sanitary symbols, hatching, labels and door arcs are not promoted into wall candidates.

## Exact product-head verification

```text
head:                    adc07f536bc1f99f908575e7b036ad7ef29ae8ef
Standard CI:             30756866790 / #2752 — PASS
Recognition Benchmark:  30756866802 / #124 — PASS
M7 Browser Audit:        30756866789 / #577 — PASS
benchmark artifact:      8836204545
benchmark digest:        sha256:57f1627558ef171decf0ebc31f35063f8db282dcab84bf397709fddedd3582cb
```

Verified on the exact head:

- all unit tests;
- Core benchmark and explicit engine-5 baseline comparison;
- nine Chromium/OpenCV source fixtures;
- nine deterministic source overlays;
- clutter fixture constrained to 12 architectural walls;
- production Worker/shared-engine equivalence;
- TypeScript, ESLint and production build;
- Chromium full M7 regression;
- WebKit core smoke;
- portable `sha256sum -c SHA256SUMS` for Core/Source reports, aggregate evidence and all nine overlays;
- zero incorrect high-confidence candidates;
- zero unknown-host openings;
- zero stale decisions.

## Preserved authority

Unchanged:

- `VlezetDocument`, schemas and migrations;
- IndexedDB and project import/export formats;
- editor-core validation and semantic Undo/Redo;
- Draft → explicit Apply authority;
- M2 containment, collision, door-swing, clearance and fit authority;
- planner and 3D authority;
- OpenRouter runtime-only secrets and provider contract.

The wall topology remains transient recognition evidence. It is never persisted as a second document model.

## Known limitations

- final Source wall-topology target `≥ 0.90` is not yet reached globally;
- the perspective-photo fixture remains `0/0` and needs perspective/source rectification;
- doors and windows remain intentionally deferred to M7.8C;
- room faces, OCR labels and areas are not produced;
- AI output remains optional, non-authoritative and can still be structurally wrong;
- the benchmark improvement does not substitute for repeating the exact real-plan product review.

## Product-owner re-review gate

On the same representative real plan, verify:

1. local recognition no longer produces hundreds of candidates;
2. the Draft contains a reviewable set of exterior and principal internal walls;
3. furniture, sanitary symbols, digits, labels and door arcs are not presented as walls;
4. no document geometry changes before explicit Apply;
5. AI review does not reintroduce a large unsupported wall network;
6. Apply remains one semantic operation and Undo restores the prior document.

Only literal product-owner acceptance may change this document to PASS, mark PR #41 Ready and permit merge.

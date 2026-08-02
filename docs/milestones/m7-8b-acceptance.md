# M7.8B — Source Normalisation and Wall Topology Acceptance

**Status:** PRODUCT OWNER PARTIAL PASS — AI SAFETY ACCEPTED / LOCAL CV REFINEMENT REQUIRED  
**Date:** 2026-08-02  
**PR:** #41  
**Feature branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Base:** `d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d`  
**Final product implementation head:** `f2694519fce95ac02a3f43e916f5b6c96d133c36`

## Product-owner result after AI remediation

The representative real plan was repeated after the verification-only AI changes.

Product-owner result:

- local CV now identifies the plan broadly correctly and produces a reviewable Draft;
- GPT-4o confirms many valid local walls correctly;
- AI no longer creates the previous long unsupported wall network;
- AI no longer increases or moves local geometry;
- the result is materially better but is not yet geometrically complete or fully accurate.

This is a literal partial PASS for the AI safety and reconciliation remediation. The verification-only AI behaviour is accepted. PR #41 remains Draft because local CV still misses or fragments some architectural walls and confidence classification is not yet ideal.

The private source plan and screenshots were not committed.

## Product-owner failures that caused the remediation

The first M7.8B candidate produced 417 local wall candidates from a representative clear plan. Furniture, sanitary symbols, labels, digits and door arcs entered the wall graph. That failure caused the line-first pipeline to be replaced with region-first structural recognition.

After region-first remediation, the same real plan produced a materially better and reviewable local Draft: 35 walls, 3 provisional openings and no candidate explosion. One real wall remained missed. The optional GPT-4o review was then materially worse than the local Draft: it added long unsupported lines across the image and reconstructed unrelated topology.

## Confirmed local-recognition root cause

The old line-first path ran Hough evidence over the complete raster. Roughly 1,000 source segments could create more than 12,000 candidate parallel-edge centrelines. Dense symbol and furniture networks could therefore become larger than the apartment shell.

The browser engine now treats filled thick wall regions as primary evidence:

1. grayscale conversion;
2. Otsu binary inversion;
3. bounded morphological opening;
4. deterministic horizontal and vertical thick-region scan;
5. stable band grouping by overlap and run-length similarity;
6. thickness, length and aspect-ratio validation;
7. exactly two boundary segments per accepted wall region;
8. deterministic centreline and topology construction.

Canny/Hough is a bounded fallback only when fewer than three structural regions are available.

## Confirmed AI-review root cause

The OpenRouter request previously sent the source image and only a count such as “the local detector proposed 35 walls”. It did not send local candidate IDs or coordinates. GPT-4o was therefore effectively asked to recognise the plan from scratch instead of verifying the local Draft.

Reconciliation then accepted unmatched cloud-only walls and averaged matched local coordinates with AI coordinates. This allowed AI to add topology and move otherwise valid local geometry.

## AI verification-only remediation

AI review is now constrained by three independent layers.

### Request contract

When a local Draft exists, the prompt now:

- declares verification-only mode rather than repeat recognition;
- sends every local wall ID and exact `0..10000` start/end coordinates;
- forbids new wall IDs and new geometry;
- requires returned candidates to preserve the original ID and coordinates;
- allows only confidence/score verification;
- requires unconfirmed walls to be omitted;
- requires `openings: []` until M7.8C host-wall classification.

### Provider sanitation

Before reconciliation, the sanitizer rejects:

- wall IDs absent from the local verification set;
- a known local ID returned with mismatched geometry;
- almost-full-frame unsupported lines;
- frame artifacts outside local bounds;
- candidate explosions.

### Reconciliation authority

Reconciliation now:

- never adds an unmatched cloud-only wall;
- never adds a cloud-only opening;
- never moves local wall coordinates;
- uses matching AI evidence only to raise confidence and record agreement;
- preserves existing review decisions;
- emits explicit diagnostics for deferred cloud-only geometry.

The product-owner re-review confirms that these controls now work on the representative real plan. GPT-4o can confirm local candidates but cannot conceal missing local geometry by inventing new topology.

## Fail-closed product boundaries

- more than 80 local walls are rejected as an unreviewable Draft;
- an overloaded Draft is not persisted or supplied to AI;
- previously persisted overloaded sessions are sanitised on restore;
- almost-full-frame unsupported AI walls are rejected;
- cloud candidate explosions are rejected fail-closed;
- local opening hypotheses remain deferred until M7.8C host-wall classification.

## Engine and corpus migration

- local recognition engine version: `5`;
- one public engine-version source for Worker, controller and benchmark;
- explicit reviewed baseline migration;
- corpus expanded from eight to nine fixtures;
- `clutter-symbol-regression` is repository-owned synthetic data with no user raster, dimensions or identifiers;
- corpus verification enforces PNG metadata, size, schema, dimensions and SHA-256 checks.

## Measured local-recognition result

| Metric | Previous post-failure Source | Region-first Core | Region-first Source |
| --- | ---: | ---: | ---: |
| Wall geometry F1 | `0.492537` | `0.855615` | `0.837989` |
| Wall topology F1 | `0.462687` | `0.834225` | `0.837989` |
| Incorrect high-confidence rate | `0` | `0` | `0` |
| Unknown-host openings | `0` | `0` | `0` |
| Stale decisions | `0` | `0` | `0` |

Dense anonymised regression:

```text
Source wall geometry F1: 0.880000
Source wall topology F1: 0.880000
geometry evidence:       TP 11 / FP 2 / FN 1
```

Clutter-symbol regression:

```text
structural regions: 19
selected mode:       regions
source walls:        12
wall geometry F1:    1.000000
wall topology F1:    1.000000
geometry evidence:   TP 12 / FP 0 / FN 0
candidate overload:  false
```

## RED → GREEN evidence for AI review

```text
RED: 64d42f6110412d2871a961c2412e6a46ac93b7bc
     cloud-only walls remained in the Draft

GREEN: 6a32509a4b46582835095a9bb5321676c5429929
       unmatched walls/openings deferred

RED: 4194ffac2d89e0432119026a8d8404c11e73f7cc
     agreeing AI geometry still moved local endpoints

GREEN: c1df64a321b99090d06565c9a0debebe73fb7014
       local coordinates remain authoritative

RED: 8c0930499e4bec92bc4b659cf17b02dffab794cf
     provider prompt contained only candidate counts

GREEN: 8e7e68d70a61e8c5cde0cf3bd54efdcadc693e6b
       exact local IDs/coordinates and verification-only contract sent

RED: 19c6d06003e922258000053663a5495d84825d15
     unknown IDs and geometry substitutions survived sanitation

GREEN: f2694519fce95ac02a3f43e916f5b6c96d133c36
       provider output bound to local identity and geometry
```

## Exact product-head verification

```text
head:                    f2694519fce95ac02a3f43e916f5b6c96d133c36
Standard CI:             30758342299 / #2774 — PASS
Recognition Benchmark:  30758342317 / #135 — PASS
M7 Browser Audit:        30758342345 / #588 — PASS
benchmark artifact:      8836651302
benchmark digest:        sha256:24fae84aa1e3233aa87efdc1555643f0e749d0e8f0cc8eb68b2f3244af43bf5e
```

Verified on the exact head:

- complete unit suite, including verification-only prompt and reconciliation tests;
- Core benchmark and engine-5 baseline comparison;
- nine Chromium/OpenCV source fixtures and overlays;
- local benchmark metrics unchanged by AI-only remediation;
- production Worker/shared-engine equivalence;
- TypeScript, ESLint and production build;
- Chromium full M7 regression;
- WebKit core smoke;
- portable `sha256sum -c SHA256SUMS` evidence integrity;
- zero incorrect high-confidence benchmark candidates;
- zero unknown-host benchmark openings;
- zero stale benchmark decisions.

## Preserved authority

Unchanged:

- `VlezetDocument`, schemas and migrations;
- IndexedDB and project import/export formats;
- editor-core validation and semantic Undo/Redo;
- Draft → explicit Apply authority;
- M2 containment, collision, door-swing, clearance and fit authority;
- planner and 3D authority;
- OpenRouter runtime-only secrets.

The wall topology remains transient recognition evidence and is never persisted as a second document model.

## Remaining local-CV limitations

The latest real-plan result is usable for review but still shows the next precision targets:

- some true exterior or principal wall runs are still missed;
- some correct wall runs remain fragmented into short candidates around junctions and service blocks;
- confidence classification is uneven: several correct walls remain pending while nearby short segments are confirmed;
- aggregate Source wall-topology F1 remains below the final `≥ 0.90` target;
- the perspective-photo fixture remains `0/0`;
- doors and windows remain intentionally deferred to M7.8C;
- room faces, OCR labels and areas are not produced.

## Remaining acceptance gate

Before PR #41 becomes Ready, local CV must receive one bounded precision pass focused on:

1. continuity of long exterior/principal wall runs;
2. deterministic junction completion across small raster gaps;
3. merging collinear fragments without bridging doors or unrelated furniture;
4. confidence derived from region continuity, thickness consistency and topology support;
5. no regression on the nine-fixture benchmark or the accepted AI safety behaviour.

The AI verification-only portion is accepted. Final M7.8B acceptance remains blocked only by the local-CV precision work above.
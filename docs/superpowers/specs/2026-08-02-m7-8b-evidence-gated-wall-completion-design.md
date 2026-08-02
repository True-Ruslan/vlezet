# M7.8B — Evidence-Gated Wall Completion Design

**Status:** Approved for implementation planning  
**Date:** 2026-08-02  
**Branch:** `feat/m7-8b-source-normalization-wall-topology`  
**PR:** #41  

## 1. Context

M7.8B has moved local recognition from line-first Hough combinatorics to region-first structural wall extraction. This eliminated the severe 417-candidate clutter failure and made the representative real plan reviewable. Verification-only AI review is also accepted: GPT-4o may confirm local candidates but cannot add or move geometry.

The remaining failure mode is local geometric incompleteness:

- some long exterior or principal wall runs are interrupted by small raster defects;
- some valid walls are fragmented near corners, T-junctions and service blocks;
- the current collinear merge uses angle, offset and distance tolerances but does not inspect raster evidence inside the gap;
- increasing the merge tolerance globally would risk bridging doors, empty space, furniture or unrelated walls.

This design adds conservative evidence-gated completion without changing document authority, persistence or AI authority.

## 2. Goals

1. Recover short missing portions of real walls caused by antialiasing, print defects, scanning gaps or small region-extraction discontinuities.
2. Complete nearby corners and T-junctions when the missing extension is geometrically and visually supported.
3. Preserve real openings and empty space.
4. Keep output deterministic, bounded and reviewable.
5. Improve Source wall geometry/topology metrics without regressing clutter-heavy or dense fixtures.
6. Keep local recognition fail-closed: uncertainty leaves a gap rather than inventing a wall.

## 3. Non-goals

- door/window classification;
- room-face construction;
- OCR, labels or area reconciliation;
- perspective correction;
- free-form AI geometry generation;
- changes to `VlezetDocument`, IndexedDB, project formats, Apply/Undo, M2, planner or 3D;
- automatic acceptance of the PR without product-owner review.

## 4. Chosen approach

Use **evidence-gated wall completion** after structural regions are extracted and before final topology edges are emitted.

The completion layer will operate on candidate centrelines plus read-only structural-raster access. It will generate bounded hypotheses for:

1. collinear micro-gap bridges;
2. short endpoint extension to one nearby perpendicular wall;
3. deterministic corner/T-junction completion.

Every hypothesis must pass independent geometric, raster and topology checks. A hypothesis that is ambiguous, unsupported or over budget is rejected.

## 5. Component boundaries

### 5.1 `wall-completion.ts`

A new pure recognition module responsible for:

- candidate pair discovery;
- bridge corridor construction;
- evidence sampling;
- hypothesis scoring;
- accepted/rejected diagnostics;
- deterministic application of accepted completions.

It depends only on recognition-domain types and a read-only structural-mask abstraction. It does not depend on React, OpenCV, browser APIs or persistence.

### 5.2 Structural mask view

A small immutable interface:

```ts
interface StructuralMaskView {
  widthPx: number;
  heightPx: number;
  isStructural(x: number, y: number): boolean;
}
```

The browser engine will adapt OpenCV mask bytes to this interface. Tests can use plain arrays.

### 5.3 Topology integration

`buildLocalWallTopology()` remains the authority for splitting and junction IDs. Completion runs before final topology construction and returns a bounded set of completed centrelines plus diagnostics.

The topology module must not infer raster content itself.

### 5.4 Confidence calibration

Completion may add evidence reasons and adjust local scores, but it cannot directly assign `high` confidence. Final confidence is derived from:

- continuous raster support;
- thickness consistency;
- observed span versus completed span;
- valid junction support;
- ambiguity count;
- absence of conflicting hypotheses.

## 6. Collinear micro-gap completion

Two wall fragments are eligible only when all conditions hold:

1. angular difference is within the configured small tolerance;
2. perpendicular offset is within a thickness-relative tolerance;
3. thicknesses are both known and mutually compatible, or one is unknown and the other is within the dominant wall band;
4. projected spans do not overlap beyond a small numerical tolerance;
5. the gap length is below an adaptive limit;
6. the candidate pair is mutual-best, preventing chain-like arbitrary merges;
7. the bridge corridor contains sufficient structural evidence;
8. no competing wall or junction produces an equally plausible bridge.

### 6.1 Adaptive maximum gap

The maximum bridge length is the minimum of:

- a multiple of the median compatible wall thickness;
- a bounded fraction of the image short side;
- a hard absolute ceiling.

This prevents the same parameter from becoming unsafe on very small or very large images.

### 6.2 Raster corridor

Evidence is sampled inside a narrow rectangle centered on the proposed bridge axis. The corridor width is derived from compatible wall thickness.

Metrics:

- structural occupancy ratio;
- longest continuous structural run ratio;
- side-band consistency;
- central void ratio;
- contrast with adjacent non-wall bands.

A bridge is accepted only when occupancy and continuity exceed conservative thresholds. Wide clean gaps are rejected as likely openings or empty space.

## 7. Corner and T-junction completion

A fragment endpoint may extend to a nearby perpendicular wall only when:

1. there is exactly one plausible target within the extension tolerance;
2. the projected intersection is close to the endpoint;
3. both walls have compatible thickness ranges;
4. the extension corridor has structural evidence or terminates directly at a confirmed thick region;
5. the result increases graph connectivity without introducing a second competing junction;
6. extension length is bounded independently from collinear bridge length.

The extension creates a junction candidate, not a new arbitrary wall run.

## 8. Door/opening preservation

M7.8B has no authoritative opening classifier, so completion must protect likely openings conservatively.

A collinear gap is rejected when any of the following is true:

- the structural corridor is predominantly empty;
- the gap is wider than the micro-gap threshold for the observed thickness;
- there are stable perpendicular thin/curved features near one side of the gap and insufficient wall fill;
- multiple competing bridge targets exist;
- completing it would create a long uninterrupted wall through a known review-deferred gap.

The algorithm does not label the gap as a door. It only refuses to bridge it.

## 9. Determinism and stability

The implementation must satisfy:

- canonical endpoint ordering;
- stable sorting before hypothesis generation;
- geometry-derived IDs;
- identical output for reversed segments and input permutations;
- no dependence on map insertion order;
- no random values;
- no iterative completion using newly created bridges as fresh evidence in the same pass;
- one bounded completion pass per recognition run.

The last rule prevents cascade tunnelling through several weak gaps.

## 10. Resource and failure bounds

- maximum input centerlines;
- maximum pair comparisons after spatial bucketing;
- maximum bridge hypotheses;
- maximum accepted completions;
- maximum raster samples per hypothesis;
- invalid dimensions, non-finite coordinates or invalid options fail closed with deterministic diagnostics;
- exceeding any budget returns the original uncompleted set plus a warning diagnostic;
- no partial mutation of input structures.

The completion layer must remain synchronous and CPU-bounded for browser Worker execution.

## 11. Diagnostics

Each considered hypothesis receives a deterministic result code, including:

- `bridge-accepted`;
- `bridge-gap-too-large`;
- `bridge-offset-mismatch`;
- `bridge-thickness-mismatch`;
- `bridge-insufficient-raster-support`;
- `bridge-likely-opening`;
- `bridge-ambiguous-target`;
- `junction-extension-accepted`;
- `junction-extension-ambiguous`;
- `completion-budget-exceeded`.

User-facing UI does not need to render every diagnostic. Benchmark and debug evidence must expose aggregate counts.

## 12. Confidence rules

Completed geometry starts at no more than `medium` confidence.

A candidate may remain or become `medium` when:

- original observed spans have strong structural evidence;
- the completed fraction is small;
- thickness is consistent;
- the result connects to confirmed topology.

A candidate must be `low` when:

- raster support is near the acceptance threshold;
- thickness is partially unknown;
- only one side has strong evidence;
- topology remains disconnected.

Only later AI verification may raise confidence, and it still cannot change coordinates.

## 13. Test design

### 13.1 Pure unit RED cases

- bridge a small missing-ink gap in a long wall;
- bridge the same case with reversed and permuted inputs identically;
- complete a short T-junction extension;
- complete a nearby exterior corner;
- reject a door-width clean gap;
- reject a furniture-like parallel contour;
- reject incompatible thicknesses;
- reject excessive offset;
- reject competing targets;
- reject cascade completion across two weak gaps;
- preserve original input on budget overflow;
- fail closed for invalid mask dimensions or options.

### 13.2 Integration tests

- browser engine calls completion only in region-first mode initially;
- Hough fallback remains unchanged until separately proven;
- Worker/shared-engine equality remains exact;
- completed candidates retain deterministic IDs and reasons;
- verification-only AI behavior remains unchanged.

### 13.3 Benchmark gates

All nine fixtures must run in Chromium/OpenCV.

Required before baseline migration:

- no regression on `clutter-symbol-regression` from `TP 12 / FP 0 / FN 0`;
- no increase in incorrect high-confidence rate;
- no unknown-host openings;
- no stale decisions;
- no candidate-budget violation;
- aggregate Source geometry and topology F1 must not decrease;
- at least one currently fragmented/missed-wall fixture must improve;
- overlays must show no bridge through obvious openings.

The representative real plan must then be re-tested manually.

## 14. Engine and baseline migration

If the behavior changes and benchmark gates pass:

- increment local recognition engine version from `5` to `6`;
- generate exact-head Core and Source reports;
- review per-fixture diffs and overlays;
- commit the new baseline explicitly;
- forbid automated baseline updates;
- record artifact ID, digest and checksums;
- rerun Standard CI, Recognition Benchmark and M7 Browser Audit on the final documentation head.

If metrics do not improve or a safety regression appears, retain engine version `5` and do not migrate the baseline.

## 15. Product acceptance criteria

On the representative real plan:

1. the previously missed or fragmented long wall is more complete;
2. no new wall crosses a visible door opening;
3. furniture, fixtures and labels remain excluded;
4. wall count remains reviewable and below the fail-closed budget;
5. AI still only confirms local geometry;
6. no document mutation occurs before Apply;
7. Apply remains one semantic operation;
8. Undo restores the prior document exactly.

## 16. Rollback strategy

The new completion layer is isolated behind a deterministic engine option and version boundary. If exact-head tests or product review fail:

- disable completion and retain region-first engine version `5` behavior;
- preserve all new RED tests and diagnostics;
- do not merge the baseline migration;
- keep PR #41 Draft.

## 17. Security and privacy

- no source raster, screenshot, API key or provider response is persisted;
- no new network requests;
- no live AI calls in CI;
- all completion is local in the Worker/shared engine;
- synthetic benchmark fixtures remain repository-owned and privacy-verified;
- diagnostics contain geometry counts and reason codes only, not private image content.

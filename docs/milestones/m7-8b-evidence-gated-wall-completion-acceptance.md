# M7.8B — Evidence-Gated Wall Completion Acceptance

**Status:** AUTOMATED SAFETY PASS / BENCHMARK-NEUTRAL / PRODUCT OWNER RE-REVIEW REQUIRED  
**Date:** 2026-08-02  
**PR:** #41  
**Branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Implementation head:** `cc8e16368a9fdf430654bf0f21f470d350dc8ef3`  

## Scope

This sub-slice adds conservative completion for short, raster-supported wall interruptions and nearby unique perpendicular junctions. It does not classify openings, create rooms, change AI authority, or mutate persisted document models.

## Delivered behavior

### Collinear micro-gap completion

Two fragments may merge only when:

- both are axis-aligned within a small deterministic tolerance;
- perpendicular offset and thickness are compatible;
- the gap is bounded by wall thickness, image size, and a hard pixel ceiling;
- a sampled structural-mask corridor exceeds occupancy and continuity thresholds;
- the pair is mutual-best;
- the same completion pass does not reuse newly created geometry as evidence.

A clean raster gap remains split and emits `bridge-likely-opening` rather than being filled.

### Corner and T-junction completion

An endpoint may extend only to one unique nearby perpendicular wall when:

- thicknesses are compatible;
- the projected intersection lies on the target wall;
- extension distance is bounded relative to thickness;
- the structural-mask corridor supports the extension;
- there is no competing target.

Ambiguous extensions are rejected fail-closed.

### Confidence and authority

- local completion can emit only `low` or `medium` confidence;
- even two `high` input fragments cannot produce a `high` completed wall;
- near-threshold raster support is explicitly downgraded to `low`;
- verification-only AI may later confirm confidence but still cannot move or add geometry;
- `VlezetDocument`, IndexedDB, Apply/Undo, M2, planner, 3D, and provider-secret authority are unchanged.

## Resource and failure bounds

- maximum input centerlines: `80`;
- maximum pair comparisons: `512`;
- maximum hypotheses: `64`;
- maximum accepted completions: `16`;
- maximum mask samples per hypothesis: `4096`;
- invalid geometry, mask dimensions, options, or budget overflow return the original canonical wall set without partial completion;
- no randomness, iterative tunnelling, or insertion-order dependence.

## RED → GREEN evidence

- missing module and contracts failed before `wall-completion.ts` existed;
- supported micro-gap, opening-preservation, permutation, and no-cascade tests failed before bridge implementation;
- unique T-junction, ambiguity, and thickness tests failed before junction implementation;
- region-only browser integration test failed before the engine adapter existed;
- confidence tests lock `high → medium` caps and near-threshold `low` behavior.

The exact head passes `178` recognition tests and the complete web unit suite, including the new completion cases.

## Benchmark interpretation

The nine-fixture Chromium/OpenCV corpus remains exactly stable:

| Metric | Before completion | Exact-head completion |
| --- | ---: | ---: |
| Source wall geometry F1 | `0.837989` | `0.837989` |
| Source wall topology F1 | `0.837989` | `0.837989` |
| Incorrect high-confidence rate | `0` | `0` |
| Unknown-host openings | `0` | `0` |
| Stale decisions | `0` | `0` |

Protected fixtures:

```text
clutter-symbol-regression: TP 12 / FP 0 / FN 0
openings-heavy:            TP 12 / FP 0 / FN 0
m7-3-regression:           geometry/topology F1 0.88 / 0.88
```

Completion accepted bounded junction adjustments on several fixtures, but aggregate F1 did not increase. Inspection showed that the remaining orthogonal-corpus false negatives are host-wall segments interrupted by intentionally rendered windows. Bridging them would improve the current wall-only score while violating the approved requirement not to close real openings before M7.8C.

Therefore this result is intentionally classified as **benchmark-neutral**, not as an algorithmic metric improvement.

## Engine-version decision

Recognition engine remains version `5` on this Draft head.

The approved plan requires a measurable improvement or literal product evidence before migration to version `6`. Baseline auto-update is forbidden. Version and baseline migration are deferred until the same representative real plan confirms improved wall continuity without false bridges.

## Exact-head verification

```text
head:                    cc8e16368a9fdf430654bf0f21f470d350dc8ef3
Standard CI:             30761352668 / #2808 — PASS
Recognition Benchmark:  30761352665 / #152 — PASS
M7 Browser Audit:        30761352699 / #605 — PASS
benchmark artifact:      8837558768
benchmark digest:        sha256:686327c45a5e938dc59991da43581e4ffc84887d749d33acfe436d5c7be7be1b
```

Verified:

- complete unit suites;
- Core baseline comparison;
- nine Chromium/OpenCV source fixtures;
- nine deterministic overlays;
- production Worker/shared-engine equality;
- TypeScript, ESLint, and production build;
- Chromium full regression and WebKit smoke;
- `sha256sum -c SHA256SUMS` for all thirteen evidence files;
- no live provider calls.

## Product-owner re-review gate

Repeat the representative real plan and verify:

1. long exterior and principal internal walls have more complete endpoints and junctions;
2. genuine door/window gaps remain open;
3. no furniture, sanitary symbol, label, or empty corridor becomes a wall bridge;
4. the candidate set remains reviewable and below the overload limit;
5. GPT-4o verification does not add or move geometry;
6. no document change occurs before Apply;
7. Apply remains one semantic operation and Undo restores the previous document.

Outcomes:

- **PASS with visible continuity improvement and no false bridges:** migrate engine to `6`, create an explicit reviewed baseline, rerun exact-head gates, and continue final M7.8B acceptance.
- **Neutral:** retain the pure completion module/tests but do not enable or version-migrate it for merge.
- **Any false bridge:** disable integration and keep engine `5`; do not merge the behavior.

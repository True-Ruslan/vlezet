# M7.8B — Source Normalisation and Wall Topology Acceptance

**Status:** PRODUCT OWNER PASS / ACCEPTED WITH KNOWN PRECISION LIMITATIONS  
**Date:** 2026-08-03  
**PR:** #41  
**Feature branch:** `feat/m7-8b-source-normalization-wall-topology`  
**Base:** `d6e8668c5ad0780a0a28d9c1fef6e9d37e9bbe4d`  
**Accepted product head before documentation sync:** `d510621958004211f82545c1479c18a42262f510`

## Product-owner acceptance

The representative real apartment plan was tested again after the final runtime rollback of experimental wall completion.

Product-owner result:

> Все работает. Вот результат проверок. Все еще не идеально как видишь.

This is recorded as a literal Product Owner PASS for M7.8B with explicit known precision limitations.

Observed final real-plan result:

```text
local wall candidates: 27
confirmed after AI:     19
remaining for review:   8
openings:               0 (intentionally deferred)
```

The result is bounded, reviewable and materially follows the apartment shell. Furniture, sanitary symbols, large digits and door arcs no longer create a candidate explosion. Stronger provider models confirm more valid local candidates, but the AI remains verification-only and does not add or move geometry.

The private source plan and screenshots were not committed.

## Accepted behavior

### Region-first local recognition

- Otsu binary inversion and bounded morphological opening produce a structural raster.
- Deterministic horizontal and vertical filled wall regions are the primary evidence.
- Canny/Hough is used only as a bounded fallback when structural-region evidence is insufficient.
- Candidate sets above the review budget fail closed before persistence or AI review.
- Previously persisted overloaded Drafts are sanitised on restore.
- Recognition remains an editable Draft until explicit Apply.

### Verification-only AI

- every local wall ID and exact coordinates are sent to the provider;
- new IDs, moved geometry, unbounded lines and cloud-only walls are rejected;
- AI may confirm or reject local candidates and adjust confidence/evidence only;
- AI cannot add openings before M7.8C host-wall classification;
- local coordinates remain authoritative during reconciliation;
- repeated AI checks preserve valid decisions and remove stale references.

### Runtime rollback of experimental completion

Evidence-gated wall completion was designed and implemented with bounded tests, but the representative product check was neutral: it did not visibly improve the actual candidate geometry.

Therefore:

- production runtime completion is disabled;
- recognition engine remains version `5`;
- no version-6 or baseline migration was performed;
- the pure experimental implementation and tests are retained for future research;
- accepted runtime behavior is the proven region-first extraction plus verification-only AI.

## Safety and authority preserved

Unchanged:

- `VlezetDocument`, schemas and migrations;
- IndexedDB and project import/export formats;
- Draft → explicit Apply authority;
- semantic Undo/Redo;
- M2 containment, collision, door-swing, clearance and fit authority;
- planner and 3D authority;
- runtime-only provider keys and responses.

The recognition wall graph remains transient evidence and is never persisted as a second document model.

## Benchmark result

| Metric | Previous post-failure Source | Accepted Core | Accepted Source |
| --- | ---: | ---: | ---: |
| Wall geometry F1 | `0.492537` | `0.855615` | `0.837989` |
| Wall topology F1 | `0.462687` | `0.834225` | `0.837989` |
| Incorrect high-confidence rate | `0` | `0` | `0` |
| Unknown-host openings | `0` | `0` | `0` |
| Stale decisions | `0` | `0` | `0` |

Protected fixtures:

```text
clutter-symbol-regression: TP 12 / FP 0 / FN 0
openings-heavy:            TP 12 / FP 0 / FN 0
m7-3 regression:           geometry/topology F1 0.88 / 0.88
```

## Exact accepted-head verification

```text
head:                    d510621958004211f82545c1479c18a42262f510
Standard CI:             30764243357 / #2826 — PASS
Recognition Benchmark:  30764243366 / #161 — PASS
M7 Browser Audit:        30764243359 / #614 — PASS
```

Verified on the exact accepted head:

- complete unit suites;
- Core baseline comparison;
- nine Chromium/OpenCV source fixtures and deterministic overlays;
- production Worker/shared-engine equality;
- TypeScript, ESLint and production build;
- Chromium full regression and WebKit smoke;
- zero incorrect high-confidence benchmark candidates;
- zero unknown-host openings;
- zero stale decisions.

## Known accepted limitations

M7.8B is not claimed to provide perfect reconstruction:

- some exterior or principal wall runs can still be missed;
- some valid walls remain fragmented near junctions and service blocks;
- confidence classification remains imperfect;
- aggregate Source wall-topology F1 remains below the final M7.8 target of `0.90`;
- perspective-photo recognition remains unresolved;
- openings, rooms, labels and areas are not delivered by this slice;
- stronger provider models improve verification quality but cannot create missing geometry.

These limitations do not block M7.8B acceptance because the workflow is now safe, bounded, editable, non-authoritative and materially more useful than the previous line-first implementation.

## Next step

Proceed to M7.8C — opening classification, host-wall validation, room-facing structural constraints and further local-recognition refinement. The accepted safety boundaries from M7.8B must remain non-regressing.

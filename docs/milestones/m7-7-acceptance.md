# M7.7 — Furniture and Fit Workflow Acceptance

**Status:** ACCEPTED / MERGED  
**Date:** 2026-08-01  
**PR:** #35  
**Feature branch:** `feat/m7-7-furniture-fit-workflow`  
**Final accepted head:** `65c5fca7cbf75620e1411a7463811848009257a8`  
**Squash merge:** `4514950b35922e7a757c523baafd4c1287dfe2a6`

## Delivered scope

M7.7 resolves `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003` and the remaining `UX-FURN-004` work through one continuous catalogue → Canvas placement → selected-object editing workflow.

Delivered:

- deterministic Russian-aware catalogue search with category filtering;
- runtime-only catalogue state, stable result order/counts and empty-state recovery;
- non-colour placement fit labels derived from existing M2 evaluation;
- selected-object inspector prioritising fit, common parameters, use zones and exact position;
- one local draft and one atomic `object/update` Apply operation;
- all detectable local validation errors reported together without mutating invalid geometry;
- automatic reveal/focus recovery for invalid hidden clearance or coordinate fields;
- authoritative-value identity reset after selection changes, Undo and Redo;
- one focusable `Повернуть 90°` semantic action;
- store-free exact-angle orientation explanation for local front/right/back/left clearances;
- diagonal direction copy that preserves arbitrary-angle meaning;
- explicit `Рекомендуется` versus `Свободно сейчас` meanings;
- Canvas legend separating object dimensions, recommended zones and actual free distances;
- `Кратчайший зазор` terminology for nearest rotated contours;
- compact-width reachability without document-level horizontal overflow;
- shared helper typography and Chromium/WebKit acceptance coverage.

## Authority boundaries

Confirmed unchanged:

- `VlezetDocument`, schema, migrations, IndexedDB and portable backup;
- M2 containment, collision, door-conflict, clearance and fit-status algorithms;
- `measureObjectClearances()` authority;
- object snapping and Canvas gesture semantics;
- editor-core semantic commands and history grouping;
- planning, recognition and read-only 3D authority.

No automatic movement, rotation, resize or repair was introduced.

## TDD evidence

Representative RED → GREEN slices:

```text
Catalogue model/runtime state
RED:   a8018b3eb80b9d7c3faeb2031907bd79be3b7e1c — CI #2234 FAIL
GREEN: 9be429bcbfeb403c9448b0362f99eb0b0f050c65 — CI #2238 PASS

Searchable catalogue
RED:   b6e2c60bce750fcb21352c23234bd300312767e9 — CI #2242 FAIL
GREEN: fa0c04607692de22c09afb0b82bbcd09a0913800 — CI #2248 PASS

Object draft and diagnostic presentation
RED:   c51cd9501c1e9bb7ae9fc2556b665496f22f6410 — CI #2250 FAIL
GREEN: f68066181cecd2d927ca777b634fe4638d163c76 — CI #2252 PASS

Exact-angle orientation cue
RED:   216a29a9859a69d31aa1aa06758e0f9bd577f5d4 — CI #2256 FAIL
GREEN: b17338bcbf520c31ee9f74fe85d618aa37a00a57 — CI #2262 PASS

Selected-object inspector
RED:   a5574b2cd90550acd07f8413d59905f9c16c602a — CI #2264 FAIL
GREEN: 6132940c971cefa1a7d7d950393e1b76a3845c13 — CI #2272 PASS

Browser acceptance
RED:   a3304aad9b6f420c8d78318f2eba17890b3f5b09 — Browser Audit #354 FAIL
GREEN: ac802593f5ef47054b0f85fffb1df146ac8ad503 — Browser Audit #371 PASS
```

## Final exact-head verification

```text
head:          65c5fca7cbf75620e1411a7463811848009257a8
standard CI:   30715144250 / #2324 — PASS
browser audit: 30715144281 / #376 — PASS
artifact:      8823120889
digest:        sha256:a1e5e799679f5f4ea2aa9f52fe13576bfb3375f2c003874e94e6dc27d63a2656
merge:         4514950b35922e7a757c523baafd4c1287dfe2a6
```

The final accepted head passed 375 tests, the M7 documentation contract, TypeScript, ESLint, production build, Chromium full M7 regression, WebKit M7.7 coverage and review-thread checks.

## Product-owner acceptance

The product owner completed the documented manual browser checklist on 2026-08-01 and confirmed:

> Все проверки прошли, все круто.

Manual acceptance covered catalogue search/recovery, placement fit copy, inspector hierarchy, Canvas legend, atomic Apply/Undo, 90° and 45° orientation behaviour, recommended versus actual clearances, fail-closed validation, fit-state transitions and compact-width behaviour.

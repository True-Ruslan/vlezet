# M7.7 — Furniture and Fit Workflow Acceptance

**Status:** AUTOMATED ACCEPTANCE PASS / PRODUCT OWNER REVIEW PENDING  
**Date:** 2026-08-01  
**PR:** #35  
**Branch:** `feat/m7-7-furniture-fit-workflow`  
**Verified product head:** `ac802593f5ef47054b0f85fffb1df146ac8ad503`

## 1. Delivered scope

M7.7 resolves `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003` and the remaining `UX-FURN-004` work through one continuous catalogue → Canvas placement → selected-object editing workflow.

Delivered:

- deterministic catalogue search using Unicode NFKC, lowercase Russian text, `ё → е`, punctuation-to-space and all-token matching;
- compact category navigation combined with search through logical AND;
- runtime-only catalogue filters that never enter the document, project persistence or semantic history;
- result counts, stable preset order, empty-state recovery and keyboard-reachable controls;
- non-colour placement fit labels derived from the existing M2 preview result;
- selected-object inspector hierarchy prioritising fit, common parameters, use zones and exact position;
- one local draft and one atomic `object/update` Apply operation;
- field-local validation that reports all detectable errors, preserves entered text and performs no mutation while invalid;
- automatic disclosure and focus for invalid hidden clearance or coordinate fields;
- authoritative-value identity that clears stale drafts after selection changes, Undo, Redo or other accepted object commands;
- one focusable `Повернуть 90°` action using the existing semantic command;
- store-free exact-angle orientation cue for object-local front/right/back/left clearances;
- diagonal direction copy that preserves arbitrary-angle meaning instead of snapping it to one cardinal side;
- explicit distinction between `Рекомендуется` and `Свободно сейчас` values;
- Canvas legend separating object dimensions, recommended use zones and actual free distances;
- planning evidence renamed to `Кратчайший зазор` so it cannot be mistaken for furniture dimensions;
- compact-width behaviour without document-level horizontal overflow;
- shared 12 px helper typography instead of new microtext.

## 2. Authority boundaries

Confirmed unchanged:

- `VlezetDocument`, schema and migrations;
- IndexedDB project records and portable backup format;
- M2 containment, collision, door-conflict, recommended-clearance and fit-status algorithms;
- `measureObjectClearances()` authority;
- object snapping and Canvas transform gesture semantics;
- editor-core object commands and semantic-history grouping;
- planning candidate generation and Apply authority;
- recognition and source-plan workflows;
- read-only Three.js/3D authority.

Search/category/disclosure state is runtime-only. Presentation helpers do not import React, Konva, IndexedDB or editor store authority. No automatic move, rotate, resize or repair action was added.

## 3. TDD evidence

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
RED:   a3304aad9b6f420c8d78318f2eba17890b3f5b09 — Browser Audit #354 FAIL on missing M7.7 Canvas evidence
GREEN: ac802593f5ef47054b0f85fffb1df146ac8ad503 — Browser Audit #371 PASS
```

Final review additionally corrected empty required numeric values, diagonal direction copy, front-marker readability and helper typography before the accepted automated candidate.

## 4. Exact-head automated verification

```text
head:          ac802593f5ef47054b0f85fffb1df146ac8ad503
standard CI:   30708809014 / #2307 — PASS
browser audit: 30708808989 / #371 — PASS
artifact:      8821214664
digest:        sha256:a2e85ef8645359253201ffda7ef94b333b72a9b8f7a958b880e3972aa0b51edb
```

The exact product head passed:

- frozen dependency installation;
- M7 documentation contract;
- complete unit/component/source/layout suite: 375 tests;
- TypeScript typecheck;
- ESLint;
- production Next.js build;
- Chromium full M7 regression suite, including the complete M7.7 flow;
- WebKit suite, including the complete M7.7 flow;
- browser evidence upload.

## 5. Browser scenarios covered automatically

The automated M7.7 flow verifies:

1. deterministic search for `ТВ-тумба` and `Диван`;
2. visible result counts;
3. selected preset placement mode;
4. non-colour `Влезает` / `Влезает, но тесно` / `Не влезает` preview copy;
5. post-placement selected-object inspector hierarchy;
6. Canvas legend for dimensions, recommended zones and actual free distance;
7. field-local invalid-width recovery without losing entered text;
8. separate semantic `Повернуть 90°` and one-step Undo;
9. compact width without document-level horizontal overflow;
10. existing M7.1–M7.6 and design-system fit-state regressions.

## 6. Product-owner gate

Product-owner browser acceptance remains mandatory before PR #35 can leave Draft or merge.

After manual acceptance is recorded, the final acceptance-record head must independently pass Standard CI and Browser Audit. Merge must then use protected squash mode with exact-head verification and no unresolved review threads.

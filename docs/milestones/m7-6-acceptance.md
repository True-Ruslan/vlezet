# M7.6 — Geometry and Opening Inspector Acceptance

**Status:** ACCEPTED / READY FOR PROTECTED SQUASH MERGE  
**Date:** 2026-08-01  
**PR:** #33  
**Branch:** `feat/m7-6-geometry-opening-inspector`  
**Implementation head:** `f1c4c6355cde623b729e839eed48b252e7b97ab6`  
**Accepted documentation head:** `cbcdbecca72253bbf855ee78c81cf040cba2d2fb`  
**Verified product-and-changelog head:** `601d8b44614e1785ae4cd5647ddb327c883be51a`

## 1. Accepted scope

M7.6 owns `UX-GEO-001`, `UX-GEO-002` and `UX-GEO-003` and delivers:

- explicit horizontal and vertical room interior-span cards;
- one semantic Apply action and one local validation surface per room axis;
- wall centreline length with screen-stable visible endpoints;
- wall thickness with screen-stable physical surfaces;
- correct endpoint/face mapping for forward, reverse-directed and diagonal walls;
- opening width and position shown as separate physical quantities;
- opening position measured from either visible wall end without moving the opening;
- four accessible door-swing choices expressed as visible hinge side and opening side;
- four visually distinct runtime-only door previews on the authoritative Canvas renderer;
- runtime-only active-axis/door preview state that stores IDs and presentation choices only;
- fail-closed opening-draft presentation that falls back to last authoritative geometry;
- compact single-column door-choice layout without horizontal document overflow;
- one-step semantic Undo for every applied room, wall and opening edit.

## 2. Authority boundaries

Confirmed unchanged:

- `VlezetDocument`, schema, migrations and portable backup format;
- IndexedDB project records;
- topology and room derivation;
- room-area calculation;
- snapping, hit testing and opening validation authority;
- editor-core command semantics;
- semantic-history grouping and Undo/Redo authority;
- recognition and planning algorithms;
- Canvas geometry authority;
- read-only Three.js/3D authority.

The presentation model maps existing authoritative geometry into visible labels. Runtime preview state cannot create, move, validate or persist geometry and cannot mark an edit successful.

## 3. TDD and regression evidence

The implementation was delivered through explicit RED/GREEN slices covering:

- stable endpoint and wall-face orientation mapping;
- equivalent opening offset conversion from either visible end;
- four door-swing descriptions independent of directed-wall terminology;
- runtime-only preview-store lifecycle;
- store-free geometry cue components;
- room, wall and opening inspector contracts;
- Canvas active-axis and door-swing preview integration;
- invalid-draft fail-closed behavior;
- compact layout and horizontal-overflow constraints;
- Chromium and WebKit end-to-end behavior.

Release-candidate browser hardening corrected only the specialized test setup so that it follows real product behavior:

1. the room is closed through the already accepted M7.5 snapped-wall path;
2. completed onboarding uses its canonical `Завершить` action;
3. overlays are explicitly dismissed before covered Canvas interactions;
4. a newly created reverse-directed wall is verified while its authoritative inspector is already selected, instead of clearing and recreating selection after layout reflow.

These corrections did not alter product geometry or command behavior.

## 4. Exact-head automated verification

Implementation-bearing head:

```text
head:          f1c4c6355cde623b729e839eed48b252e7b97ab6
standard CI:   30700610937 / #2182 — PASS
browser audit: 30700610940 / #315 — PASS
artifact:      8818716707
digest:        sha256:7967ff419bd7a8b718da0584c722d4db55988fb25b34a945cabb57b889495838
```

Accepted documentation head:

```text
head:          cbcdbecca72253bbf855ee78c81cf040cba2d2fb
standard CI:   30700776396 / #2184 — PASS
browser audit: 30700776394 / #316 — PASS
artifact:      8818766838
digest:        sha256:48eb9f0f4a45192d2a4117c4e45eaab5f0356c863ee1c2f7e2acf8d5edfd0244
```

Verified product-and-changelog head:

```text
head:          601d8b44614e1785ae4cd5647ddb327c883be51a
standard CI:   30701504839 / #2188 — PASS
browser audit: 30701504841 / #318 — PASS
artifact:      8818986254
digest:        sha256:8e8220b41caec6fb96bec8f931db658f690381244e90447b1d6fa661089175ca
```

The verified head passed:

- frozen dependency installation and supply-chain policy verification;
- M7 documentation contract;
- complete unit/component/source/layout suite: 355 tests;
- TypeScript typecheck;
- ESLint;
- production Next.js build;
- Chromium full M7 regression suite, including the complete M7.6 flow;
- WebKit core smoke suite, including M7.6 room/wall/opening behavior;
- browser evidence upload.

The final acceptance-record commit must independently pass the same required workflows before protected merge. Its SHA and run IDs remain available in immutable GitHub Actions and PR history, avoiding a self-referential commit identifier inside this file.

## 5. Product-owner browser acceptance

The product owner completed the representative browser scenarios on 2026-08-01 in branch `feat/m7-6-geometry-opening-inspector` and confirmed:

> «Все работает четко строго по описанным тобой шага.»

This confirmation covers:

1. horizontal and vertical room dimension presentation;
2. Apply and one-step Undo for both room dimensions;
3. physical distinction between wall centreline length and wall thickness;
4. visible fixed endpoints and surfaces while editing walls;
5. Apply and one-step Undo for wall length and thickness;
6. equivalent opening offset measured from either visible wall end;
7. four visibly distinct door-swing previews;
8. one-step Apply and Undo for door-swing changes;
9. fail-closed handling of an invalid oversized opening draft;
10. compact single-column door choices without horizontal page overflow;
11. screen-stable endpoint and surface labels for a wall drawn from right to left.

## 6. Merge gate

All M7.6 merge conditions are satisfied subject to the immutable checks on the final PR head:

- product-owner browser acceptance is recorded;
- standard CI and browser audit passed on the verified product-and-changelog head;
- the final acceptance-record commit must pass the same two workflows;
- no unresolved review threads may remain;
- PR #33 must remain mergeable;
- merge must use squash mode with expected-head protection.

# M7.6 — Geometry and Opening Inspector Acceptance

**Status:** AUTOMATED ACCEPTANCE PASS / PRODUCT OWNER REVIEW PENDING  
**Date:** 2026-08-01  
**PR:** #33  
**Branch:** `feat/m7-6-geometry-opening-inspector`  
**Implementation head:** `f1c4c6355cde623b729e839eed48b252e7b97ab6`

## 1. Delivered scope

M7.6 owns `UX-GEO-001`, `UX-GEO-002` and `UX-GEO-003` and now delivers:

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

The new presentation model maps existing authoritative geometry into visible labels. Runtime preview state cannot create, move, validate or persist geometry and cannot mark an edit successful.

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

Release-candidate browser hardening also corrected the specialized test setup so that it follows real product behavior:

1. the room is closed through the already accepted M7.5 snapped-wall path;
2. completed onboarding uses its canonical `Завершить` action;
3. overlays are explicitly dismissed before covered Canvas interactions;
4. a newly created reverse-directed wall is verified while its authoritative inspector is already selected, instead of clearing and recreating selection after layout reflow.

These corrections did not alter product geometry or command behavior.

## 4. Exact implementation-head verification

```text
head:          f1c4c6355cde623b729e839eed48b252e7b97ab6
standard CI:   30700610937 / #2182 — PASS
browser audit: 30700610940 / #315 — PASS
artifact:      8818716707
digest:        sha256:7967ff419bd7a8b718da0584c722d4db55988fb25b34a945cabb57b889495838
```

The implementation head passed:

- frozen dependency installation and supply-chain policy verification;
- M7 documentation contract;
- complete unit/component/source/layout suite: 355 tests;
- TypeScript typecheck;
- ESLint;
- production Next.js build;
- Chromium full M7 regression suite, including the complete M7.6 flow;
- WebKit core smoke suite, including M7.6 room/wall/opening behavior;
- browser evidence upload.

## 5. Product-owner browser acceptance — pending

The product owner should complete the following representative path on the PR #33 deployment or local branch:

1. create a closed rectangular room and select its interior;
2. confirm that `Внутренние размеры` clearly separates `По горизонтали` and `По вертикали`;
3. change each room dimension from a chosen fixed side, Apply it, then Undo it;
4. select a wall and confirm that `Длина по оси` and `Толщина стены` explain different physical quantities and visible fixed points/surfaces;
5. change wall length and thickness with different anchors, Apply each change and Undo it;
6. add a door, switch its offset reference between the two visible wall ends and confirm that the physical opening does not move;
7. switch through all four hinge/opening choices and confirm that each Canvas preview is visibly distinct;
8. Apply the door choice and Undo it in one step;
9. enter an invalid oversized opening width and confirm that the inspector remains usable, shows a local error and does not corrupt or replace authoritative geometry;
10. narrow the browser to a compact width and confirm that all four door choices remain readable in one column with no horizontal page overflow;
11. create a wall from right to left and confirm that labels remain `Левый конец`, `Правый конец`, `Верхняя поверхность` and `Нижняя поверхность` rather than exposing directed-wall internals.

## 6. Merge gate

Current state:

- automated implementation verification: satisfied;
- Chromium full browser audit: satisfied;
- WebKit core smoke: satisfied;
- exact acceptance-documentation-head verification: pending this documentation commit;
- product-owner browser acceptance: pending;
- unresolved review-thread check: pending final review;
- protected squash merge: blocked until all preceding gates are satisfied.

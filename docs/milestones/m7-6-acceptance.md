# M7.6 — Geometry and Opening Inspector Acceptance

**Status:** ACCEPTED / MERGED  
**Date:** 2026-08-01  
**PR:** #33  
**Final accepted head:** `29b631fe43ba1a00e0ad48c71ee5429371d1faa8`  
**Squash merge:** `315828052edb483c34a68464acb70458bf4ff80d`

## 1. Accepted scope

M7.6 resolves `UX-GEO-001`, `UX-GEO-002` and `UX-GEO-003` and delivers:

- explicit horizontal and vertical room interior-dimension cards;
- one semantic Apply action and one local validation surface per room axis;
- wall centreline length with screen-stable visible endpoints;
- wall thickness with screen-stable physical surfaces;
- correct endpoint/face mapping for forward, reverse-directed and diagonal walls;
- opening width and position shown as separate physical quantities;
- opening position measured from either visible wall end without moving the opening;
- four accessible door-swing choices expressed through visible hinge and opening sides;
- four visually distinct runtime-only door previews on the authoritative Canvas renderer;
- runtime-only active-axis and door-preview state containing IDs and presentation choices only;
- fail-closed invalid opening drafts that retain the last authoritative geometry;
- compact single-column door-choice layout without horizontal document overflow;
- one-step semantic Undo for applied room, wall and opening edits.

## 2. Authority boundaries

Confirmed unchanged:

- `VlezetDocument`, schema, migrations and portable backup format;
- IndexedDB project records;
- topology, room derivation and room-area calculation;
- snapping, hit testing and opening-validation authority;
- editor-core command semantics;
- semantic-history grouping and Undo/Redo authority;
- recognition and planning algorithms;
- Canvas geometry authority;
- read-only Three.js/3D authority.

The presentation model maps existing authoritative geometry into visible labels. Runtime preview state cannot create, move, validate or persist geometry and cannot mark an edit successful.

## 3. TDD and regression evidence

The implementation was delivered through explicit RED/GREEN slices covering:

- stable endpoint and wall-face orientation mapping;
- equivalent opening-offset conversion from either visible end;
- four door-swing descriptions independent of directed-wall terminology;
- runtime-only preview-store lifecycle;
- store-free geometry cue components;
- room, wall and opening inspector contracts;
- Canvas active-axis and door-swing preview integration;
- invalid-draft fail-closed behavior;
- compact layout and horizontal-overflow constraints;
- Chromium and WebKit end-to-end behavior.

Release-candidate browser hardening corrected only test setup so it follows real product behavior:

1. room closure reuses the accepted M7.5 snapped-wall path;
2. completed onboarding uses its canonical `Завершить` action;
3. overlays are dismissed before covered Canvas interactions;
4. a reverse-directed wall is verified while its authoritative inspector is already selected.

These corrections did not alter product geometry or command behavior.

## 4. Final exact-head verification

```text
head:          29b631fe43ba1a00e0ad48c71ee5429371d1faa8
standard CI:   30701887262 / #2212 — PASS
browser audit: 30701887265 / #330 — PASS
artifact:      8819106567
digest:        sha256:069a3f8105d5123152f12e07b1a62c96809ac2caf02ab65b0fdee4d8a8569669
merge:         315828052edb483c34a68464acb70458bf4ff80d
```

The exact accepted head passed:

- frozen dependency installation and supply-chain policy verification;
- M7 documentation contract;
- complete unit/component/source/layout suite: 355 tests;
- TypeScript typecheck;
- ESLint;
- production Next.js build;
- Chromium full M7 regression suite, including the complete M7.6 flow;
- WebKit core smoke suite, including M7.6 room/wall/opening behavior;
- browser evidence upload.

## 5. Product-owner browser acceptance

The product owner completed the documented representative browser path on 2026-08-01 in branch `feat/m7-6-geometry-opening-inspector` and confirmed:

> «Все работает четко строго по описанным тобой шага.»

This confirmation covers:

1. horizontal and vertical room dimension presentation;
2. Apply and one-step Undo for both room dimensions;
3. the physical distinction between wall centreline length and wall thickness;
4. visible fixed endpoints and surfaces while editing walls;
5. Apply and one-step Undo for wall length and thickness;
6. equivalent opening offsets measured from either visible wall end;
7. four visibly distinct door-swing previews;
8. one-step Apply and Undo for door-swing changes;
9. fail-closed handling of an oversized invalid opening draft;
10. compact single-column door choices without horizontal page overflow;
11. screen-stable endpoint and surface labels for a wall drawn from right to left.

## 6. Integration outcome

All merge gates were satisfied:

- product-owner acceptance was recorded;
- Standard CI and Browser Audit passed on the exact final head;
- no unresolved review threads or submitted blocking reviews existed;
- PR #33 was mergeable;
- squash merge used expected-head protection.

M7.6 was squash-merged into `main` as `315828052edb483c34a68464acb70458bf4ff80d`. The next selected slice is M7.7 Furniture and Fit Workflow.

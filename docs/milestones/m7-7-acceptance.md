# M7.7 — Furniture and Fit Workflow Acceptance

**Status:** IMPLEMENTATION VERIFICATION IN PROGRESS / PRODUCT OWNER REVIEW PENDING  
**Date:** 2026-08-01  
**PR:** #35  
**Branch:** `feat/m7-7-furniture-fit-workflow`

## Accepted design scope

M7.7 owns `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003` and the remaining `UX-FURN-004` work.

The approved implementation scope includes:

- deterministic catalogue search and category filtering;
- runtime-only catalogue UI state;
- explicit placement fit status derived from existing M2 evaluation;
- selected-object inspector hierarchy centred on fit, common parameters, use zones and exact position;
- one atomic exact-edit Apply command;
- field-local validation with fail-closed recovery;
- exact-angle orientation explanation for object-local clearances;
- distinct Canvas meanings for dimensions, recommended use zones and actual free distances;
- explicit shortest-contour-gap terminology in planning evidence;
- compact-width and keyboard-reachable behaviour;
- Chromium and WebKit acceptance coverage.

## Authority boundaries

The implementation must not change:

- `VlezetDocument`, schema, migrations, IndexedDB or portable backup format;
- M2 containment, collision, door-conflict, clearance or fit-status algorithms;
- `measureObjectClearances()` authority;
- object snapping or Canvas gesture semantics;
- semantic history grouping;
- planning, recognition or read-only 3D authority.

## Verification state

TDD slices for catalogue discovery, runtime filter state, draft parsing, diagnostic grouping, exact-angle orientation and the selected-object inspector have passed focused Standard CI.

The integrated Canvas/browser candidate is now under exact-head Standard CI and Chromium/WebKit verification. Exact immutable run evidence will be recorded after both workflows pass.

## Product-owner gate

Product-owner browser acceptance has not yet been requested. PR #35 must remain Draft until automated verification passes and the documented manual path is confirmed.

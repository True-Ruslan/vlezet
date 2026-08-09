# M8.1 Editor Interaction Foundation — Acceptance

**Date:** 2026-08-09  
**Tracker:** #54  
**PR:** #85  
**Branch:** `feat/m8-1-editor-interaction-foundation`  
**Product-accepted head:** `db66de524783a43fa021db07a6b67808c4435e9b`  
**Status:** PRODUCT-OWNER ACCEPTED — PROTECTED MERGE PENDING

## Product outcome

M8.1 establishes the interaction substrate required before topology-sensitive structural editing expands in M8.2.

Accepted user-visible behavior:

- one semantic runtime selection model for wall/room/opening/placed-object references;
- primary and multi-selection with modifier toggle, marquee and Select All policy;
- capability-aware actions that fail closed for unsupported mixed/structural sets;
- deterministic rigid movement for multiple selected placed objects;
- semantic Copy/Cut/Paste/Duplicate for placed objects with fresh IDs and atomic history;
- central command registry shared by keyboard, explicit UI and context-menu consumers;
- ordinary wheel/trackpad pan and modified pointer-centred zoom;
- Space+drag and middle-button pan;
- fit-plan and fit-selection;
- compact multi-selection inspector and semantic context menu;
- compatibility with accepted single-entity inspectors;
- no arbitrary graphical group scaling.

Structural batch movement/clipboard and common-property editing for selected walls remain deliberately deferred to M8.2.

## Architecture acceptance

Verified boundaries:

- `VlezetDocument` remains the sole persistent document truth;
- millimetres remain canonical;
- no project schema or migration change;
- no IndexedDB/project/backup format change;
- selection, viewport, clipboard, gesture, marquee and context-menu state remain runtime-only;
- Konva remains a projection, not geometry authority;
- M2 fit/collision/door/clearance authority is unchanged;
- topology/opening authority is unchanged;
- placed-object batch transforms are atomic and editor-core-owned;
- structural/mixed batch mutation remains fail-closed;
- recognition thresholds and safety validators were not weakened;
- no AI/network dependency was introduced into core editing.

## TDD evidence

M8.1 was implemented task-by-task using genuine RED → GREEN evidence. The focused history is maintained in:

`docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md`.

The final product-owner defect concerned selected-furniture group drag around snap thresholds. Small cursor oscillations could leave the imperative Konva drag node visually diverged from the authoritative snapped preview/bounds.

Correction evidence:

```text
RED       fdc5902ab61d9152f93a0a5cbcfadb37bf59daa5
CI        #4807 — 509 prior web tests PASS; new reconciliation contracts FAIL

RED       98a2e053b5b705257e4f5e56307d46ea30c0e5ae
CI        #4808 — 510/511 web tests PASS; missing layout-time reconciliation FAIL

GREEN     94775496f5d0c7bc504ee9e371c845ef5e148a5e
```

The fix is projection-only: on every authoritative preview update, `PlacedObjectShape` reconciles the imperative Konva group position before paint. Snap tolerance, grid policy, store movement semantics, fit authority and semantic history were not changed.

Regression hardening head `88ec268653bb3034e3254421c8d9f28824b3488e` added three deterministic cursor-jitter profiles plus release stability and exact Undo → Redo → Undo visual equivalence. No synthetic RED was manufactured because this hardening introduced no new production behavior.

## Exact-head automated evidence before product acceptance

Accepted head `db66de524783a43fa021db07a6b67808c4435e9b`:

```text
CI #4813:                     PASS
Recognition Benchmark #1149: PASS
Browser Acceptance #1269:    PASS
  Chromium:                   PASS
  WebKit:                     PASS
```

The CI gate covered the documentation contract, full unit suite, Core Recognition Benchmark, typecheck, lint and production build. Browser acceptance covered the strengthened selected-group drag/snap regression in both Chromium and representative WebKit.

## Product-owner acceptance

On 2026-08-09 the product owner repeated the required focused scenarios on the accepted head and reported:

> «Все сценарии PASS.»

This closes the manual product acceptance gate for M8.1.

## Remaining delivery gate

Product acceptance does not by itself constitute merge. Before integration:

1. synchronize canonical M8.1 acceptance state in `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/product/UX_ROADMAP.md`;
2. run fresh exact-head CI, Recognition Benchmark and Chromium/WebKit Browser Acceptance after those documentation changes;
3. perform the repository's protected squash merge for PR #85 only after the delivery action is explicitly authorized;
4. record the actual squash-merge identity in the focused changelog/canonical state after integration.

M8.2 must not begin before M8.1 is integrated into `main`.

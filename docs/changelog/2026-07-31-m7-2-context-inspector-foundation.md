# 2026-07-31 — M7.2 Context Inspector Foundation

## Status

**DONE / ACCEPTED / MERGED**

```text
PR:                  #23
final verified head: d3231a09541c2c4cf10a48e69f4e485d15a06a0a
standard CI:         30625797753 — PASS
browser CI:          30625797756 — PASS
artifact:            8791323487
digest:              sha256:e167a0944674de6a99fc07dfaa7d5bcc0eea3b1c1cce575ce1d5b1ef961dfb12
merge:               66606356d69f96953f8afae7b914222a3f793777
```

## Why

M7.1 made the editor shell and responsive side surfaces reachable, but the right-side content still used inconsistent headers, section order, close/back semantics and destructive-action placement. Workflows could replace ordinary selection without a predictable way back.

## Delivered

- one semantic context anatomy for empty, wall, room, opening, furniture, reference, recognition and planning states;
- user-facing entity/workflow identity instead of raw IDs as dominant headings;
- explicit `К комнате…` and `К предмету…` return actions;
- preservation of the original ordinary context across workflow-to-workflow transitions;
- stale/deleted return targets fail closed to empty selection;
- compact panel close hides presentation without ending a workflow or destroying local draft state;
- common section, action and danger-zone hierarchy;
- accurate Undo and reference-removal consequence copy;
- internal milestone labels removed from ordinary UI;
- viewport-constrained context frame with an independently scrollable body.

## Manual regression found and fixed

During product-owner acceptance, a long room inspector could not scroll far enough to reach `Варианты расстановки`.

Root cause:

- the M7.2 `.context-panel-frame` grew with its content;
- the outer side surface clipped overflow;
- `.context-panel-body` therefore never received a bounded scroll area.

Fix:

- constrain the context frame to the available side-surface height;
- keep the header in the fixed grid row;
- make `.context-panel-body` the single vertical scroll owner;
- preserve the same behaviour in docked and compact side surfaces.

Regression evidence:

```text
RED head:   90b43f197dad3cc168ef50a2a43f8e4717b9b3cd
GREEN head: 376f38cafc0a46b67a04d7be54527a83d0220375
```

A dedicated Chromium/WebKit scenario now creates and selects a room, reduces viewport height, proves `scrollHeight > clientHeight`, scrolls the right panel and opens `Варианты расстановки`.

## Product-owner acceptance

> «Теперь все работает супер четко.»

The exact browser/version is not inferred beyond the confirmed manual run.

## Architecture preserved

No changes to domain schema, migrations, IndexedDB, backup format, geometry/fit authority, planner algorithms, recognition algorithms, semantic history or Canvas/Three.js geometry authority. Context return and visibility remain ephemeral React presentation state.

## Next

`M7.3 Design System and Content Components` is the only selected `NOW` slice.

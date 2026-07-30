# M7.0 Product and UX Audit — Acceptance

**Status:** ACCEPTED — source audit, target UX foundation and automated browser evidence complete  
**Date:** 2026-07-30  
**PR:** #19 `docs: M7.0 product and UX audit`

## 1. Purpose

M7.0 pauses speculative feature expansion after accepted M6.4 and documents the complete current product experience before broad redesign implementation begins.

The milestone is documentation- and evidence-first. It does not alter editor behaviour, geometry, persistence, planning authority or rendering authority.

## 2. Required package

- [x] `docs/product/PRODUCT_VISION.md`
- [x] `docs/product/USER_JOURNEYS.md`
- [x] `docs/product/UX_AUDIT.md`
- [x] `docs/product/UX_BROWSER_EVIDENCE.md`
- [x] `docs/product/INFORMATION_ARCHITECTURE.md`
- [x] `docs/product/INTERACTION_MODEL.md`
- [x] `docs/product/UX_ROADMAP.md`
- [x] `docs/design/DESIGN_SYSTEM.md`
- [x] `docs/design/COMPONENT_INVENTORY.md`
- [x] `docs/design/CONTENT_AND_TERMINOLOGY.md`
- [x] `docs/design/ACCESSIBILITY.md`
- [x] `scripts/validate-m7-docs.mjs`
- [x] reproducible Chromium/WebKit browser-audit harness

## 3. Product and source review

- [x] dashboard, loading and recovery inventoried;
- [x] editor shell, toolbar, Canvas and 3D inventoried;
- [x] furniture catalogue and context inspectors inventoried;
- [x] reference and recognition workflows inventoried;
- [x] deterministic planning and natural-language review inventoried;
- [x] save, Undo/Redo, export, import and recovery paths inventoried;
- [x] current CSS values, density and responsive breakpoints recorded;
- [x] existing strengths documented and protected from unnecessary redesign.

## 4. User journeys

- [x] `J01` create project and first room;
- [x] `J02` real dimensions and area;
- [x] `J03` door and window;
- [x] `J04` furniture and fit;
- [x] `J05` arbitrary measurement;
- [x] `J06` reference import and calibration;
- [x] `J07` assisted recognition;
- [x] `J08` spatial 3D inspection;
- [x] `J09` deterministic alternatives, Preview and Apply;
- [x] `J10` reviewed natural-language intent;
- [x] `J11` save, history, export and restore.

## 5. Combined finding ledger

`UX_AUDIT.md` contains 38 source-backed findings. `UX_BROWSER_EVIDENCE.md` adds one non-duplicate browser finding.

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

- [x] every finding has a stable ID;
- [x] every finding has severity, frequency and confidence;
- [x] every finding links an affected journey/surface;
- [x] every finding records evidence and root cause;
- [x] every finding defines a response and acceptance criterion;
- [x] every P1/P2 finding has a roadmap owner;
- [x] no unsupported data-loss/P0 claim was manufactured.

## 6. Browser evidence

### Chromium representative flow

**Run:** `30570626203` — PASS  
**Head:** `e3602296cf4382b88443e67616a69978b3f3bab0`

The first complete pass exercised dashboard, room creation, room inspector, sofa placement, object inspector, responsive states, planning, reference panel, 3D transition and project deletion.

### Final Chromium + WebKit pass

**Run:** `30571095361` — PASS  
**Head:** `7278a278f1a33d99d383a54139a20be987417c85`  
**Artifact:** `8770860354`  
**Digest:** `sha256:1d4991a03f6e8b4d6388119dc296fe4f9cd311cbf2c3dbc6099b730630a3ec61`

- [x] Chromium full representative workflow;
- [x] 1920×1080;
- [x] 1440×900;
- [x] 1366×768;
- [x] 1280×800;
- [x] effective 150% width;
- [x] effective 200% width;
- [x] selected room and object states;
- [x] planning panel;
- [x] reference panel;
- [x] 3D transition;
- [x] dashboard lifecycle and destructive dialog;
- [x] WebKit dashboard/editor/form/3D/dialog core smoke.

WebKit is recorded as an engine-level proxy, not as a manual run in the shipping Safari browser. Native Safari regression remains mandatory for M7.1 because M7.1 changes the shell and responsive presentation; M7.0 does not.

## 7. Browser-confirmed conclusions

- [x] toolbar horizontally escapes at 1440×900, 1366×768 and 1280×800;
- [x] context inspector disappears at effective 150% width;
- [x] catalogue and inspector disappear at effective 200% width;
- [x] save status is rendered at 9 px;
- [x] Canvas help is rendered at 11 px;
- [x] planning begins with provider/API controls rather than manual planning;
- [x] internal milestone labels are visible in planning UI;
- [x] default 3D perspective hides the interior behind opaque walls;
- [x] dashboard hierarchy and destructive confirmation are strengths to preserve.

Machine evidence recorded 15 Chromium states and 53 observations. Four additional WebKit screenshots confirm the core engine path.

## 8. Target foundation

- [x] four-layer information architecture defined;
- [x] selection and workflow return-context rules defined;
- [x] tools, commands and display toggles distinguished;
- [x] Escape hierarchy defined;
- [x] immediate edit versus explicit Apply rules defined;
- [x] Draft / Preview / Applied lifecycle defined;
- [x] mandatory / preference / recommendation semantics defined;
- [x] status and error hierarchy defined;
- [x] target design tokens and component families defined;
- [x] canonical Russian glossary defined;
- [x] accessibility and viewport matrix defined.

## 9. Selected first implementation slice

**M7.1 — Editor Shell and Responsive Context** is the only selected `NOW` slice.

It owns:

- `UX-SHELL-001`;
- `UX-SHELL-002`;
- `UX-DATA-001`;
- `UX-ACCESS-002`.

M7.1 must establish command hierarchy, readable local-save status and a reachable context surface before later visual/workflow redesign. The browser evidence confirmed rather than weakened this priority.

- [x] exact scope documented;
- [x] dependencies documented;
- [x] non-goals documented;
- [x] Chromium/WebKit automated gates documented;
- [x] native Safari M7.1 gate documented;
- [x] later M7.x slices remain reorderable from evidence.

## 10. Architecture and scope protection

- [x] no `VlezetDocument` change;
- [x] no domain schema or migration change;
- [x] no IndexedDB/project-format change;
- [x] no geometry semantics change;
- [x] no editor/planner/evaluator/Apply authority change;
- [x] no Canvas or Three.js authority change;
- [x] no new AI/autonomous functionality;
- [x] no product UI implementation in M7.0;
- [x] browser harness remains non-product test tooling.

## 11. Product-owner gate

The product owner explicitly approved the M7 programme, all recommendations, autonomous execution and continuation to the next step in this project conversation.

- [x] audit conclusions accepted;
- [x] finding priorities accepted;
- [x] M7.1 selection accepted;
- [x] browser evidence corrections incorporated;
- [x] PR may move from Draft after final exact-head verification.

## 12. Final merge gate

- [x] all required documentation exists;
- [x] combined finding count is 39;
- [x] browser review is recorded honestly;
- [x] scope contains no product implementation;
- [x] product-owner acceptance is recorded;
- [ ] final documentation contract passes on exact head;
- [ ] final standard CI passes on exact head;
- [ ] final browser audit passes on exact head;
- [ ] PR #19 is marked Ready for Review;
- [ ] squash merge SHA/date are added to canonical project state and changelog.

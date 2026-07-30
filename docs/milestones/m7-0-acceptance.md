# M7.0 Product and UX Audit — Acceptance

**Status:** RC — source audit and target UX foundation complete; representative full-product browser review and product-owner acceptance remain pending.  
**Date:** 2026-07-30  
**PR:** #19 `docs: M7.0 product and UX audit`

## 1. Purpose

M7.0 pauses speculative feature expansion after accepted M6.4 and documents the complete current product experience before any broad redesign implementation begins.

The audit is documentation-first. It does not alter editor behaviour, geometry, persistence or planning authority.

## 2. Required package

- [x] `docs/product/PRODUCT_VISION.md`
- [x] `docs/product/USER_JOURNEYS.md`
- [x] `docs/product/UX_AUDIT.md`
- [x] `docs/product/INFORMATION_ARCHITECTURE.md`
- [x] `docs/product/INTERACTION_MODEL.md`
- [x] `docs/product/UX_ROADMAP.md`
- [x] `docs/design/DESIGN_SYSTEM.md`
- [x] `docs/design/COMPONENT_INVENTORY.md`
- [x] `docs/design/CONTENT_AND_TERMINOLOGY.md`
- [x] `docs/design/ACCESSIBILITY.md`
- [x] `scripts/validate-m7-docs.mjs`

## 3. Product and source review

- [x] project dashboard, loading and recovery inventoried;
- [x] editor shell and toolbar inventoried;
- [x] furniture catalogue and ordinary context inspectors inventoried;
- [x] reference and recognition workflows inventoried;
- [x] 2D Canvas and read-only 3D surfaces inventoried;
- [x] deterministic planning and natural-language review inventoried;
- [x] save, Undo/Redo, export, import and recovery paths inventoried;
- [x] current CSS tokens, density and responsive breakpoints recorded;
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

## 5. Finding ledger

Current structured finding count:

```text
P0  0
P1 10
P2 22
P3  6
P4  0
TOTAL 38
```

- [x] every finding has a stable ID;
- [x] every finding has severity, frequency and confidence;
- [x] every finding links an affected journey/surface;
- [x] every finding records evidence and root cause;
- [x] every finding defines a recommended response;
- [x] every finding defines an acceptance criterion;
- [x] every P1/P2 finding has a roadmap owner;
- [x] no unsupported data-loss/P0 claim was manufactured to inflate urgency.

## 6. Highest-priority conclusions

- [x] project/tool/context actions need a stable hierarchy;
- [x] the context inspector must not disappear at reduced effective width;
- [x] local save state must be more readable;
- [x] essential 9–10 px text must be replaced by hierarchy/progressive disclosure;
- [x] hard constraints, preferences, recommendations, Draft, Preview and Applied need shared visual semantics;
- [x] pointer-first workflows require explicit keyboard/focus alternatives;
- [x] advanced workflows should be simplified without removing precision or deterministic authority.

## 7. Target foundation

- [x] four-layer information architecture defined;
- [x] selection and workflow return-context rules defined;
- [x] exclusive tools, commands and display toggles distinguished;
- [x] Escape hierarchy defined;
- [x] immediate edit versus explicit Apply rules defined;
- [x] Draft / Preview / Applied lifecycle defined;
- [x] mandatory / preference / recommendation semantics defined;
- [x] status and error hierarchy defined;
- [x] target design tokens and component families defined;
- [x] canonical Russian glossary defined;
- [x] accessibility and viewport matrix defined.

## 8. Selected first implementation slice

**M7.1 — Editor Shell and Responsive Context** is the only selected `NOW` implementation slice after M7.0 acceptance.

It addresses:

- `UX-SHELL-001`;
- `UX-SHELL-002`;
- `UX-DATA-001`;
- `UX-ACCESS-002`.

M7.1 must establish command hierarchy, readable local-save status and a reachable context surface across supported desktop widths and browser zoom before later visual/workflow redesign.

- [x] exact scope documented;
- [x] dependencies documented;
- [x] non-goals documented;
- [x] browser and automated acceptance gates documented;
- [x] later M7.x slices remain reorderable from evidence.

## 9. Architecture and scope protection

Verified by design and changed-file intent:

- [x] no `VlezetDocument` change;
- [x] no domain schema or migration change;
- [x] no IndexedDB/project-format change;
- [x] no geometry semantics change;
- [x] no editor/planner/evaluator/Apply authority change;
- [x] no Canvas or Three.js authority change;
- [x] no new AI/autonomous functionality;
- [x] no product UI implementation in M7.0;
- [x] only documentation and documentation-validation tooling are introduced.

## 10. Browser review gate — pending

The source-backed audit must be reviewed against the running product before acceptance.

Required representative matrix:

- [ ] 1920×1080 at 100% and 125%;
- [ ] 1440×900 at 100% and 125%;
- [ ] 1366×768 at 100%;
- [ ] 1280×800 at 100%;
- [ ] representative 150% zoom;
- [ ] representative 200% zoom;
- [ ] narrower width for graceful limitation;
- [ ] Yandex/Chromium full-product review;
- [ ] Safari core dashboard/editor/form/dialog regression.

Required workflow evidence:

- [ ] dashboard and project lifecycle;
- [ ] first room and active-tool clarity;
- [ ] room/wall/opening inspectors;
- [ ] furniture catalogue/object fit;
- [ ] reference calibration/tracing;
- [ ] recognition review;
- [ ] 3D transition/inspection;
- [ ] planning manual/language/Preview/Apply;
- [ ] save/export/restore and error/recovery states.

Browser evidence may confirm, reduce, merge or reprioritise findings. It must not silently introduce implementation into the audit PR.

## 11. Automated verification — pending final head

- [ ] `pnpm validate:m7-docs` — PASS;
- [ ] frozen dependency installation — PASS;
- [ ] full unit suite — PASS;
- [ ] TypeScript — PASS;
- [ ] ESLint — PASS;
- [ ] production build — PASS;
- [ ] exact branch head and workflow run recorded;
- [ ] changed-file scope inspected.

## 12. Product-owner gate

- [ ] product owner reviews the audit conclusions;
- [ ] product owner confirms finding priorities and M7.1 selection;
- [ ] any browser evidence corrections are incorporated;
- [ ] PR #19 moves from Draft only after the audit package is accepted.

## 13. Merge gate

Before merge:

- [ ] all required documentation exists and validates;
- [ ] finding counts in `UX_AUDIT.md`, this checklist and PR description match;
- [ ] browser review is recorded honestly;
- [ ] final exact-head CI passes;
- [ ] scope contains no product implementation;
- [ ] product-owner acceptance is recorded;
- [ ] PR #19 is marked Ready for Review;
- [ ] squash merge SHA/date are added to canonical project state and changelog.

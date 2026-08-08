# 2026-08-08 — M8 Public Beta Editor programme selected

**Status:** product direction approved; design/documentation checkpoint pending review and merge. No M8 product code is implemented by this record.

## Why

The unaccepted M7.8C automatic-recognition experiment passed deterministic benchmark/CI gates but failed product-owner usefulness acceptance on the original apartment plan. The real result still contained missed/fragmented structure, missing visible windows and ambiguous service-area geometry, while verification-only AI did not recover the missing geometry.

The important product conclusion is not that recognition has no value. It is that Vlezet must not depend on uncertain whole-plan recognition before its manual editor is strong enough for a first-time user to create the plan reliably themselves.

The target release is now explicitly a **public free beta for unfamiliar users**, not merely a private/internal build.

## Product decision

Vlezet will be developed as:

> a strict, millimetre-accurate apartment editor with familiar mature-canvas interaction quality, while keeping architectural topology and physical dimensions authoritative.

The interaction model may learn from tools such as Excalidraw/draw.io, but Vlezet is not becoming a generic diagram editor. Graphical operations that would destroy physical meaning remain forbidden.

Examples:

- walls remain topological walls with physical thickness;
- openings remain validated against host walls;
- rooms remain derived;
- furniture resize changes real dimensions;
- arbitrary group scaling of structural geometry is not allowed.

## New beta critical path

```text
M8.0  Public Beta Product Contract / roadmap reset
M8.1  Editor Interaction Foundation
M8.2  Precision Drawing and Structural Editing
M8.3  Precision Reference Calibration
M8.4  Assisted Tracing
M8.5  Furniture 2.0
M8.6  Export, Appearance and Presentation
M8.7  Public Beta Hardening
PUBLIC FREE BETA
```

Automatic whole-plan recognition remains R&D under #27 and no longer blocks the beta critical path.

The earlier Assisted Tracing PR #52 is closed without merge and preserved as design evidence. Issue #51 is reframed as M8.4 and intentionally depends on M8.1–M8.3.

## M8.1 selected first implementation slice

M8.1 establishes the substrate required by later editor work:

- unified semantic selection;
- multi-selection;
- capability-aware actions;
- rigid multi-furniture movement;
- safe semantic furniture Copy/Cut/Paste/Duplicate;
- command registry;
- mouse/trackpad/keyboard navigation;
- fit-plan and fit-selection;
- fail-closed mixed/structural selections;
- no arbitrary group scale.

Structural batch editing/clipboard is deliberately deferred to M8.2 because it requires topology dependency closure and must not be approximated inside M8.1.

Canonical trackers:

- #53 — M8 programme;
- #54 — M8.1 Editor Interaction Foundation;
- #51 — M8.4 Assisted Tracing;
- #27 — automatic recognition R&D.

## Calibration decision

The previous concern that calibration points can be misplaced by several pixels/millimetres is accepted as a core product risk.

Because world scale is not known before calibration, the solution is **source-feature snapping**, not world-grid snapping. M8.3 will add stronger magnification, line/edge/centre/intersection assistance, keyboard nudge, fractional source coordinates where justified, and a second known-distance verification with residual/error reporting.

The product must not claim millimetre certainty beyond the source raster's real resolution.

## Furniture direction

The current small preset catalogue remains a useful foundation but is insufficient for public beta. M8.5 will move toward a parameterised household library and more direct Canvas editing while keeping the inspector for exact values.

## Export/theme direction

M8.6 will add a renderer-neutral export path with PNG/SVG whole-plan and selection export. Application dark mode is allowed, but the canonical plan sheet remains light and export output does not depend on UI theme.

## Public beta acceptance journeys

- `BETA-01 Blank` — build a small exact apartment manually.
- `BETA-02 Reference` — import, calibrate, verify scale and trace a real plan.
- `BETA-03 Edit` — multi-select/move/copy/paste/duplicate and exact Undo/Redo.
- `BETA-04 Furnish` — place/edit common furniture and understand fit.
- `BETA-05 Export` — export whole plan and selection to PNG/SVG.

## Mandatory TDD policy

Every deterministic M8 behaviour must be developed through genuine **RED → GREEN → regression/refactor**.

Rules:

- write a focused failing behavioural test before production behaviour is added;
- run and verify the intended failure;
- implement the smallest correct production change;
- run focused and adjacent regressions;
- do not weaken validation, thresholds or existing tests merely to make CI green;
- browser gesture behaviour receives real Chromium coverage and representative WebKit coverage where engine differences matter;
- manual acceptance is reserved for genuinely observational/product evidence, not used as a replacement for automatable tests.

## Mandatory CHANGELOG policy

CHANGELOG quality is now an explicit engineering requirement.

Every accepted M8 slice must update:

- a focused `docs/changelog/YYYY-MM-DD-<slice>.md` record;
- `docs/CHANGELOG.md` with a concise canonical entry;
- `docs/PROJECT_STATE.md` and roadmap documents after acceptance/merge.

Focused records must clearly separate:

1. why the work was needed;
2. user-visible behaviour;
3. architecture/authority decisions;
4. meaningful RED/GREEN evidence;
5. regressions found and fixed;
6. intentional non-goals/deferrals;
7. exact-head automated evidence;
8. product-owner acceptance where required;
9. final merge identity.

A green pipeline alone is never sufficient evidence of product acceptance.

## Architecture preserved

This roadmap decision itself changes no product schema or runtime geometry.

The following remain non-negotiable:

- `VlezetDocument` sole persistent truth;
- millimetres canonical;
- semantic Undo/Redo;
- deterministic topology/opening/M2 authority;
- local-first core editing;
- no silent geometry repair/replacement;
- AI/CV optional and non-authoritative.

## Canonical design documents

- `docs/superpowers/specs/2026-08-08-public-beta-editor-program-design.md`;
- `docs/superpowers/specs/2026-08-08-m8-1-editor-interaction-foundation-design.md`.

No implementation plan or product code should begin until the written M8.1 design has passed product-owner review.

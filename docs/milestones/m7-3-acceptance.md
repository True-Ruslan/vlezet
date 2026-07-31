# M7.3 — Design System and Content Components Acceptance

**Status:** RC / MANUAL ACCEPTANCE PENDING.  
**Branch:** `feat/m7-3-design-system-implementation`  
**PR:** #26  
**Base:** `fb93744414e9d1faa291d187bb35d01022145d1f`

## Product goal

Create a governed, reusable presentation foundation for Vlezet without turning M7.3 into a product-wide visual rewrite or changing document, geometry, persistence, planning, recognition, history or Canvas authority.

The accepted density model is balanced rather than spacious or CAD-compact:

- ordinary interface text: 14 px;
- compact panel text: 13 px;
- meaningful helper, status and explanation text: at least 12 px;
- standard fields and primary actions: 40 px;
- compact secondary controls: 32–36 px where appropriate.

Density is achieved through grouping and hierarchy, not microtext.

## Delivered foundation

### Semantic style layers

The web application now loads governed layers in this order:

```text
design-tokens.css
ui-primitives.css
legacy and feature styles
bounded design-system migrations
```

The token layer defines semantic colors, typography, spacing, radii, shadows, control heights, focus treatment and motion durations. Existing legacy variables remain compatible aliases so migration can continue incrementally.

### Store-free UI primitives

Implemented reusable components under `apps/web/components/ui/`:

- `UiButton` — primary, secondary, quiet, danger and icon variants with native disabled and busy semantics;
- `UiField` and `UiFieldMessage` — label, control, unit, helper and error relationships;
- `UiNotice` — info, success, warning, error and local-first feedback with textual meaning and appropriate live-region roles;
- `UiBadge` — textual status badges including fit, draft, preview, applied, mandatory, preference and confidence states;
- `UiCard` — passive, selectable, result and evidence anatomy without owning domain interaction;
- `UiEmptyState` — title, description and explicit primary/secondary actions;
- `UiDialog` — labelled modal anatomy, Escape/backdrop policy, busy protection, focus trap and focus restoration.

These primitives contain no Zustand, repository, geometry, planner, recognition or persistence dependencies.

### Presentation formatting

Added presentation-only formatters for:

- millimetres with a non-breaking space before `мм` and no visual thousands grouping;
- square metres with Russian decimal comma and `м²`;
- degrees with `°`.

All internal dimensions remain numeric millimetres. Geometry and project data are unchanged.

## Representative migration

M7.3 intentionally migrates representative surfaces rather than every legacy component.

### Room context

- room-name and clear-dimension fields use shared field anatomy;
- primary room actions use governed button sizing;
- existing parse, validation and editor-store commands are preserved.

### Furniture catalogue and fit status

- catalogue presets use shared card anatomy while the existing button retains click and `aria-pressed` ownership;
- preset dimensions and category/helper text use the governed minimum typography;
- fit states use canonical textual badges:
  - `Влезает`;
  - `Влезает, но тесно`;
  - `Не влезает`;
- fit authority remains `evaluateObjectFits`.

### Dashboard and global feedback

- local-first explanation uses `UiNotice`;
- dashboard errors use alert semantics;
- the empty project state uses `UiEmptyState`;
- existing ephemeral error/toast ownership remains in `ProjectApp`, with token-governed visual presentation.

### Dialogs

- project deletion is adapted to `UiDialog` and shared actions;
- the OpenRouter form uses shared dialog, fields, notices and buttons;
- the API key remains local to the form and is never persisted;
- closing an active AI request preserves the existing cancellation flow.

### Recognition and Canvas help

- shared prerequisite, error, progress, empty, candidate, confidence and action visuals are used inside the recognition panel;
- recognition-specific layout moved from an inline style string to `recognition-panel.css`;
- recognition state-machine, candidate decisions, Apply and draft persistence remain unchanged;
- Canvas help now uses the 12 px helper-text token.

## TDD evidence

| Slice | RED evidence | GREEN evidence |
|---|---|---|
| Semantic tokens and style order | head `c3d1052b…`, tests referenced missing design-system layers | head `f9260cbe…`, CI `30631053067` PASS, browser `30631052998` PASS |
| Buttons, fields and field messages | head `d7ca415f…`, rendering contracts failed on missing primitives | head `da53a568…`, CI `30631416762` PASS, browser `30631416767` PASS |
| Notices, badges, cards and empty states | head `fa68557d…`, contracts failed on missing feedback/card modules | head `53d0ae36…`, CI `30631757582` PASS, browser `30631757594` PASS |
| Accessible dialog foundation | head `aacf6851…`, modal/focus contracts RED | head `3f4812ff…`, CI `30632068646` PASS, browser `30632068258` PASS |
| Russian presentation formatting | head `6bb6811c…`, formatter and legacy-string contracts RED | head `5e8549e5…`, CI `30632652687` PASS, browser `30632652716` PASS |
| Room, catalogue and fit migration | head `cacbde39…`, representative surface contracts RED | head `3d59acff…`, CI `30633692664` PASS, browser `30633691600` PASS |
| Dashboard feedback and existing dialogs | head `4e94f590…`, legacy markup failed shared contracts | head `7a5824f1…`, CI `30640697395` PASS, browser `30640697251` PASS |
| Recognition visuals and Canvas typography | head `bbfecdf9…`, legacy inline layout and missing feature stylesheet RED | head `c21789f9…`, CI `30641617092` PASS, browser `30641617822` PASS |
| Strict browser acceptance | head `c5a2b66d…` exposed an invalid test prerequisite while seven scenarios passed | head `77ec49591f40cdb2c971658f672f7db15f1bb0ba`, CI `30642682922` PASS, browser `30642684301` PASS |

## Automated browser acceptance

### Chromium full flow

Verified on head `77ec49591f40cdb2c971658f672f7db15f1bb0ba`:

1. shared local-first notice and empty-state anatomy on the dashboard;
2. meaningful dashboard text at or above 12 px;
3. 40 px primary dashboard action;
4. delete-dialog initial focus, Tab cycle, Escape close and opener-focus restoration;
5. 40 px room fields and primary actions;
6. long Russian room identity without document-level horizontal overflow;
7. furniture card text at or above 12 px;
8. all three canonical fit statuses through real editor changes;
9. compact equivalents of 150% and 200% zoom without document overflow;
10. Canvas-help typography at or above 12 px;
11. real reference image upload and calibration;
12. local recognition flow followed by the OpenRouter dialog;
13. API-key initial focus, 40 px field, disabled reason through native state, privacy notice, loading state and visible error feedback;
14. all pre-existing M7.1/M7.2 shell, scrolling, workflow-return, destructive-action and 3D regressions.

### WebKit core smoke

Independently verified:

- shared dashboard notice and empty state;
- minimum typography and 40 px primary controls;
- room editing with a long Russian name;
- planning return;
- fit badge;
- compact draft retention and workflow return;
- no document-level overflow;
- 3D transition;
- delete-dialog initial focus and Escape restoration.

WebKit remains an engine-level proxy rather than a claim of manual native-Safari acceptance.

## Exact-head evidence before acceptance record

```text
verified implementation head: 77ec49591f40cdb2c971658f672f7db15f1bb0ba
standard CI:                30642682922 — PASS
browser audit:              30642684301 — PASS
artifact:                   8798148740
digest:                     sha256:4f1009d3e4fe6207d33027cb387d232b0c91250b73d9ca1b67b8ea5f2dd46950
```

## Acceptance-record verification

```text
verified record head: edf13e8d7d3d9cd1ffe6fb031977a528da5fe0bf
standard CI:         30642980311 — PASS
browser audit:       30642980320 — PASS
artifact:            8798281505
digest:              sha256:18457a9425bbfcda2a73c606824be693068e9956a5d5aa84cc24540509f9fa09
```

This evidence was captured before the record-only commit that writes these identifiers. Both mandatory gates must therefore pass one final time on the resulting branch head before manual product-owner acceptance begins.

## Architecture preservation

The branch changes presentation components, CSS, presentation formatting, tests, plans and browser harness only.

No changes were made to:

- `VlezetDocument` or domain schema;
- migrations;
- IndexedDB or project/asset repositories;
- backup/import/export format;
- geometry or fit algorithms;
- planner generation, evaluation or Apply authority;
- recognition algorithms, provider protocol or draft persistence;
- semantic history implementation;
- Canvas hit-testing, snapping or drawing authority;
- Three.js geometry authority.

## Manual product-owner checklist

Before merge, verify the branch in a real browser:

1. Dashboard local-first message and empty state look coherent and readable.
2. Create a project, select a room and confirm fields/buttons have balanced rather than oversized or CAD-dense spacing.
3. Enter a long room name and confirm the right panel remains readable without horizontal scrolling.
4. Open the furniture catalogue and confirm card names/dimensions remain readable.
5. Place a sofa and inspect the fit badge and reasons.
6. Open project deletion and confirm focus starts on `Отмена`; Escape closes the dialog.
7. Install a plan, run recognition and inspect shared notices, candidate cards and confidence badges.
8. Open `Проверить с AI` and confirm the API-key field receives focus, privacy copy is clear and disabled/loading/error states are understandable.
9. At a narrow window, confirm context scrolling, compact hide/reopen and workflow return still work.
10. Confirm Canvas help is readable and no important content appears as microtext.

The PR remains Draft until this manual acceptance is recorded.

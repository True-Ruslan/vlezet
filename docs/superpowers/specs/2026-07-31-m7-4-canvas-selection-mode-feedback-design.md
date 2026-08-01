# M7.4 — Canvas Selection and Mode Feedback

**Date:** 2026-07-31  
**Status:** approved design; implementation not started  
**Branch:** `feat/m7-4-canvas-selection-mode-feedback`  
**Depends on:** accepted M7.1 editor shell, M7.2 context inspector and M7.3 design-system foundation

## 1. Product intent

M7.4 makes the current spatial interaction state understandable without changing how geometry is created or validated.

At every moment in 2D the user must be able to answer:

1. Which exclusive Canvas tool is active?
2. What pointer action is expected next?
3. What is selected, hovered, previewed or invalid?
4. What will Escape cancel on the next press?
5. Is visible geometry ordinary document state or a temporary preview?

The implementation is presentation and orchestration only. It must not introduce another document, geometry, selection, history or persistence authority.

## 2. Owned findings

M7.4 owns:

- `UX-SHELL-004` — active tool and temporary mode are not always obvious;
- `UX-CANVAS-001` — exclusive tools do not consistently communicate the next action and cancellation route;
- `UX-CANVAS-002` — selection, hover, preview and invalid-target semantics require stronger distinction.

## 3. Chosen approach

### Recommended and selected: derived Canvas feedback contract

A small pure contract derives user-facing mode feedback from existing editor state. React components consume that contract for:

- an authoritative Canvas status strip;
- active-tool semantics in the toolbar;
- cursor classes;
- hover/selection/preview visual roles;
- Escape-priority orchestration.

This approach is selected because it:

- keeps `VlezetDocument` unchanged;
- keeps `editorStore` as selection/tool authority;
- avoids a second persistent UI truth;
- permits deterministic unit tests;
- keeps Canvas-specific visual logic separate from geometry algorithms.

### Rejected: new global Canvas workflow store

A second Zustand store containing active mode, selection, hover and instructions would duplicate existing state and risk divergence. M7.4 may add ephemeral measurement phase to the existing measurement store, but it must not mirror ordinary editor selection or tool state.

### Rejected: CSS-only toolbar emphasis

Stronger button colour alone would not communicate the next action, Escape effect, preview validity or compact-width meaning. Colour-only changes also fail accessibility requirements.

## 4. Architecture

```text
existing editor/measurement/workflow state
                 │
                 ▼
       pure feedback derivation
       ├── active mode identity
       ├── next-action instruction
       ├── Escape instruction
       ├── cursor role
       └── visual semantic roles
                 │
       ┌─────────┴─────────┐
       ▼                   ▼
HTML Canvas status     Konva presentation
and toolbar state      hover/selection/preview
```

### New pure modules

`apps/web/components/editor/editor-canvas-feedback.ts`

- derives active mode/status copy from existing state;
- returns stable semantic IDs, not ad-hoc strings in components;
- owns no React, Konva, store or persistence dependency.

`apps/web/components/editor/editor-escape-priority.ts`

- derives exactly one cancellation action from current transient state;
- contains no side effects;
- preserves the canonical hierarchy from `INTERACTION_MODEL.md`.

`apps/web/components/editor/canvas-entity-visual.ts`

- maps `ordinary | hover | selected | preview-valid | preview-invalid` into presentation roles;
- exposes stroke, dash, emphasis and marker requirements;
- never computes geometry or hit targets.

### React integration

`EditorCanvasStatus` renders the current mode, next action and Escape effect as a compact HTML overlay. It uses `role="status"`, stable layout and M7.3 primitives/tokens.

`ApartmentEditor` owns Escape orchestration because it can see editor, measurement, tracing, workflow, planning and 2D/3D state together. One Escape press executes one derived action only.

`EditorCanvas` owns ephemeral hover identity because hover is Canvas-local and non-persistent. It must not be copied into `editorStore`.

`TapeMeasurementTool` continues owning measurement geometry. The existing measurement store gains an ephemeral phase so the parent can derive the next action and cancel only the incomplete/current measurement before exiting the Measure tool.

## 5. Active mode model

The status contract uses these semantic modes:

| Mode | Primary copy | Next action |
|---|---|---|
| `select` | `Выбор` | select an entity or click empty Canvas to clear selection |
| `wall-start` | `Стена` | choose the first point |
| `wall-finish` | `Стена · вторая точка` | choose the endpoint; snapping remains authoritative |
| `door` | `Дверь` | hover a wall and click a valid preview |
| `window` | `Окно` | hover a wall and click a valid preview |
| `measure-start` | `Измерить` | choose the first point |
| `measure-finish` | `Измерить · вторая точка` | choose the second point |
| `measure-complete` | `Измерение готово` | click to start a new measurement or Escape to clear it |
| `place-object` | `Размещение мебели` | choose a valid position |
| `tracing` | `Обводка` | create walls over the calibrated source plan |
| `recognition-review` | `Проверка распознавания` | review a draft candidate; document geometry is unchanged |
| `spatial` | `3D · только просмотр` | inspect the same document; Escape returns to 2D |

Priority is deterministic:

```text
3D
→ recognition review
→ tracing
→ furniture placement
→ measurement
→ wall/door/window
→ select
```

Workflow modes may suppress ordinary editing feedback, but they do not replace the underlying editor state.

## 6. Canvas status strip

The status strip appears inside the Canvas shell and contains:

- a labelled active-mode badge;
- one concise next-action sentence;
- one concise Escape sentence when meaningful;
- optional state marker `Предпросмотр` or `Недопустимо` for pointer previews.

Rules:

- no essential text below 12 px;
- no colour-only state;
- no pointer-event interception;
- compact widths wrap rather than cover the working area;
- status changes are announced politely without repeating pointer movement;
- hover changes do not continuously update live-region text.

Existing grid/zoom/pan help remains secondary and is reduced to stable reference hints. The active status strip becomes the authoritative next-action message.

## 7. Visual semantics

### Ordinary

- existing restrained entity styling;
- no additional outline.

### Hover

- visible secondary outline or dash;
- pointer cursor where the entity is selectable;
- never visually stronger than selection;
- applies only when the current tool permits semantic selection.

### Selected

- solid accent outline;
- selection handles or explicit outline where applicable;
- remains linked to the context inspector;
- does not rely on fill colour alone.

### Valid preview

- dashed accent outline;
- lower opacity than applied geometry;
- explicit `Предпросмотр` status text;
- remains non-authoritative until click/Apply.

### Invalid preview

- dashed danger outline;
- visible cross or `Недопустимо` marker;
- status text explains that click will not apply;
- colour is supplementary.

### Selection priority

M7.4 preserves existing hit testing and event order. It does not claim to solve all overlapping-entity navigation. The implementation may expose hover identity for current hit targets but must not alter semantic geometry or hit tolerances.

## 8. Cursor contract

Cursor is derived from the current mode:

- select/hovered selectable entity: `pointer`;
- select/empty Canvas: `default`;
- wall, door, window and measurement: `crosshair`;
- furniture placement: `copy` for valid preview and `not-allowed` for invalid preview;
- Space-pan ready: `grab`;
- active pan: `grabbing`;
- recognition candidate review: `pointer` over candidates;
- 3D remains owned by the spatial viewer.

Cursor presentation must not change hit testing.

## 9. Escape hierarchy

One Escape press processes one highest-priority action:

1. cancel object drag/transform gesture;
2. clear an incomplete or completed measurement, keeping Measure active;
3. cancel a wall draft, keeping Wall active;
4. cancel furniture placement;
5. finish tracing;
6. exit Measure;
7. close the active bounded workflow/temporary Preview when safe;
8. exit Wall/Door/Window to Select;
9. clear ordinary semantic selection;
10. in 3D, return to 2D after higher-priority spatial transient state.

A press must never both cancel a draft and clear unrelated selection. Repeated presses may move down the hierarchy.

The existing `cancelCurrentAction()` remains available for bounded command callers, but keyboard Escape uses the explicit M7.4 action derivation.

## 10. Measurement phase

The existing measurement store expands from `active` to:

```ts
type MeasurementPhase = "idle" | "measuring" | "complete";
```

It exposes:

```ts
setActive(active: boolean): void
setPhase(phase: MeasurementPhase): void
resetMeasurement(): void
```

Rules:

- inactive always implies `phase: "idle"`;
- first committed point sets `measuring`;
- second committed point sets `complete`;
- pointer preview alone does not move from `idle`;
- Escape reset returns to `idle` while keeping Measure active;
- switching another exclusive tool deactivates Measure and resets phase;
- phase is runtime-only and never persisted.

## 11. Error and stale-state handling

- switching tools clears stale opening/furniture preview and hover state;
- invalid opening preview remains visible and explicitly non-clickable;
- invalid furniture preview remains visible with blocked fit evidence;
- deleting selected entities continues to clear stale selection through existing store logic;
- workflow close uses the accepted M7.2 return-target contract;
- no status is inferred from missing geometry IDs without checking current document state.

## 12. Accessibility

- active toolbar buttons retain `aria-pressed` and receive `data-active-tool`/explicit mode metadata for testability;
- the Canvas status strip uses readable text and `aria-live="polite"`;
- selection/preview distinction uses dash/marker/text in addition to colour;
- status copy is concise Russian and follows canonical terminology;
- cursor is supplemental, never the only indication;
- compact layout provides the same semantic status.

## 13. Testing strategy

### Unit and static-render tests

- every active mode derives the expected label, instruction and cursor role;
- priority conflicts resolve deterministically;
- every Escape state derives exactly one action;
- measurement phase resets/deactivates correctly;
- visual roles differ through dash/marker as well as colour;
- toolbar active state and status-strip semantics render accessible markup.

### Store/component regression

- first measurement point updates phase to `measuring`;
- second point updates phase to `complete`;
- switching tools resets measurement state;
- wall draft Escape leaves Wall active;
- second Escape exits Wall;
- selection is cleared only after higher-priority temporary states are gone.

### Browser acceptance

Chromium full flow and WebKit core smoke must prove representative transitions:

1. Select → Wall status;
2. first wall point → second-point instruction;
3. Escape cancels draft but keeps Wall;
4. second Escape returns to Select;
5. Measure activation and phase feedback;
6. furniture placement preview semantics;
7. compact width preserves active mode and next action;
8. no M7.1–M7.3 shell/context/scrolling regressions.

## 14. Non-goals

M7.4 does not include:

- geometry or snapping algorithm changes;
- hit-tolerance changes;
- multi-selection;
- complete obscured-entity cycling/list UI;
- inspector redesign;
- onboarding;
- recognition-quality work from issue #27;
- mobile-first editing;
- persistence/schema/migration changes;
- 3D camera or interior-readability redesign;
- new domain capabilities.

## 15. Acceptance

M7.4 is accepted only when:

- active tool is identifiable without memory of the previous click;
- each representative tool communicates the next valid action;
- hover, selected, valid preview and invalid preview are distinguishable without colour alone;
- Escape cancels exactly one highest-priority state per press;
- tool switches remove stale preview/status state;
- compact widths preserve equivalent meaning;
- geometry, snapping, history, persistence, planning, recognition and 3D authority remain unchanged;
- full unit/type/lint/build CI passes;
- Chromium full flow and WebKit core smoke pass;
- product-owner browser acceptance is recorded before merge.

# M7.5 — Onboarding, Status and Recovery

**Date:** 2026-08-01  
**Status:** approved design; implementation not started  
**Branch:** `feat/m7-5-onboarding-status-recovery`  
**Depends on:** accepted M7.1 editor shell, M7.2 context inspector, M7.3 design-system foundation and M7.4 Canvas mode feedback

## 1. Product intent

M7.5 helps a new user reach the first successful closed room without a blocking tutorial and keeps important completion or recovery evidence available after transient notifications disappear.

The user must be able to understand:

1. how to begin an empty project;
2. that a room appears only after a valid closed wall topology exists;
3. what step remains before the first room is complete;
4. when the first room has been derived successfully;
5. which high-impact operation completed or failed;
6. what remained unchanged after a failure;
7. which valid next action is available.

The implementation is presentation and orchestration only. It must not create geometry, infer rooms independently, persist a copy of project progress or replace existing operation authority.

## 2. Owned findings

M7.5 owns:

- `UX-ONBOARD-001` — first-room success currently depends on discovering topology semantics without a complete guided path;
- `UX-DATA-003` — important success feedback may exist only as a short-lived toast.

## 3. Chosen approach

### Selected: derived onboarding plus scoped UI preference and runtime evidence

The first-project phase is derived from the current authoritative document:

```text
0 walls                  → empty
one or more walls,
0 derived rooms          → drawing
one or more derived rooms → room-created
```

Only the user preference to hide or finish the guide is stored separately per `projectId`. It is presentation state and never becomes part of `VlezetDocument`, project backup or geometry history.

High-impact completion and recovery messages use a runtime-only operation-evidence contract. Evidence describes the outcome of an existing authoritative operation but never determines whether that operation happened.

This approach is selected because it:

- preserves `VlezetDocument` as the only persistent apartment truth;
- uses existing wall and derived-room state rather than duplicating topology;
- survives normal UI rerenders without adding schema migrations;
- avoids replaying stale evidence after project switching or reload;
- keeps expert use unblocked;
- permits deterministic unit and browser tests.

### Rejected: transient-only onboarding

Keeping the guide entirely in React memory would show it again after every project reopen and would not solve the durable-evidence problem.

### Rejected: persisted onboarding workflow in the project document

Persisting checklist steps, completion events or tutorial state in `VlezetDocument` would create stale state after Undo/Redo, import, duplication and geometry edits. It would also require schema and migration work unrelated to apartment geometry.

### Rejected: automatic room completion

M7.5 must not close gaps, add walls or repair topology. Guidance may activate an existing tool but never performs a geometry command for the user.

## 4. Architecture

```text
VlezetDocument + derived rooms + existing operation results
                         │
                         ▼
              pure presentation derivation
              ├── first-project phase
              ├── checklist items
              ├── next valid action
              └── room-created transition
                         │
             ┌───────────┴───────────┐
             ▼                       ▼
 first-project guide         runtime operation evidence
             │                       │
             ▼                       ▼
 per-project UI dismissal    durable in-context UiNotice
```

### Authority boundaries

- wall count comes from the current document;
- room count and room details come from existing derived-room authority;
- room-created evidence is triggered only by an observed authoritative transition from zero rooms to one or more rooms;
- recognition, planning and export evidence is published only after the existing operation reports success;
- recovery evidence is published only from an existing categorized failure path;
- UI state cannot mark an operation successful or mutate the document.

## 5. First-project progress contract

New pure module:

`apps/web/components/editor/first-project-progress.ts`

```ts
type FirstProjectPhase = "empty" | "drawing" | "room-created";

type FirstProjectProgressInput = Readonly<{
  wallCount: number;
  roomCount: number;
}>;

type FirstProjectProgress = Readonly<{
  phase: FirstProjectPhase;
  completedSteps: readonly FirstProjectStepId[];
  currentStep: FirstProjectStepId;
  title: string;
  description: string;
  primaryAction: "activate-wall-tool" | "select-first-room" | null;
}>;
```

Step IDs are stable presentation identifiers:

```ts
type FirstProjectStepId =
  | "project-created"
  | "first-wall"
  | "closed-room"
  | "review-room";
```

Rules:

- numeric inputs must be finite non-negative integers;
- invalid input fails closed to `empty` and produces no completion claim;
- `project-created` is complete whenever the editor has a loaded project;
- `first-wall` is complete when `wallCount > 0`;
- `closed-room` is complete when `roomCount > 0`;
- `review-room` becomes the current next step after a room exists; it is not persisted as a domain milestone;
- Undo/Redo immediately recalculates progress;
- no room topology logic is reimplemented in this module.

## 6. Guide presentation

New component:

`apps/web/components/editor/first-project-guide.tsx`

The guide uses M7.3 primitives and appears as a non-modal in-context card inside the editor workspace. It does not intercept Canvas pointer input and does not replace the context inspector.

### Empty state

```text
Первый план

Выберите «Стена» и нарисуйте замкнутый контур.
Комната и площадь появятся после корректного соединения стен.

[Начать со стены] [Скрыть]
```

Primary action activates the existing Wall tool only.

### Drawing state

```text
Контур ещё не замкнут

Продолжайте соединять стены. Комната появится,
когда линии образуют корректный замкнутый контур.

[Продолжить рисование] [Скрыть]
```

The guide does not guess which endpoint should be connected and does not override M7.4 next-action feedback.

### Room-created state

```text
Первая комната готова

Площадь и размеры рассчитаны по внутреннему контуру.
Теперь можно проверить комнату или добавить мебель.

[Открыть комнату] [Завершить]
```

The primary action selects the first current derived room using existing editor selection authority. `Завершить` records the guide preference as dismissed for that project.

### Placement rules

- desktop: inside the workspace in a bounded area that does not cover primary Canvas status or side-panel actions;
- compact width: reflows to a full-width bounded card above the Canvas slot or into the accepted compact surface hierarchy without horizontal overflow;
- 3D: hidden because the first-room workflow is a 2D creation task;
- recognition/reference/planning workflow: hidden while a bounded workflow owns context;
- expert users can dismiss it immediately;
- dismissing does not change tool, selection, history or document state.

## 7. Per-project guide preference

The only persistent onboarding value is a local UI preference keyed by project identity.

New adapter:

`apps/web/components/editor/first-project-guide-preference.ts`

Storage key:

```text
vlezet.ui.first-project-guide.v1.<projectId>
```

Stored value:

```json
{"dismissed":true}
```

Rules:

- storage is browser-local and is not part of IndexedDB project data;
- it is not included in `.vlezet.json`, PNG or project duplication;
- a duplicated/imported project with a new ID receives independent guide state;
- storage access is guarded for SSR, privacy modes and quota/security failures;
- read failure fails open by showing the guide;
- write failure hides the guide for the current runtime session but must not interrupt editing;
- project switch reloads the preference for the new `projectId`;
- the preference never records checklist progress or room identity.

## 8. First-room completion evidence

`ApartmentEditor` observes the current authoritative room count per project.

Transition rule:

```text
previous room count === 0
current room count  > 0
same loaded project
```

Only that transition publishes first-room success evidence.

The initial render of an already completed project does not manufacture a new completion event. Project switching resets the transition baseline before observing the new document.

Evidence content includes:

- title: `Первая комната создана`;
- current room name or ordinary fallback `Комната`;
- formatted usable area from existing presentation helpers;
- clear dimensions only when the existing room model provides deterministic values;
- next action: select/open the room;
- optional Undo action only when the current history contract can safely expose the existing Undo command.

The evidence remains visible until:

- the user closes it;
- a later operation replaces it;
- the project changes;
- the referenced room no longer exists after Undo or editing.

If the referenced room disappears, evidence is cleared rather than rewritten as success.

## 9. Operation-evidence contract

New pure/runtime module:

`apps/web/components/editor/editor-operation-evidence-store.ts`

```ts
type EditorOperationKind =
  | "first-room-created"
  | "recognition-applied"
  | "planning-applied"
  | "project-backup-exported"
  | "recoverable-failure";

type EditorOperationEvidence = Readonly<{
  id: string;
  projectId: string;
  kind: EditorOperationKind;
  tone: "success" | "warning" | "error";
  title: string;
  description: string;
  sourceContext: "canvas" | "recognition" | "planning" | "project";
  entityId?: string;
  action?: EditorEvidenceAction;
}>;
```

Allowed actions:

```ts
type EditorEvidenceAction =
  | { kind: "select-room"; roomId: string }
  | { kind: "open-recognition-review" }
  | { kind: "undo" }
  | { kind: "dismiss" };
```

Rules:

- the store holds at most one active evidence item;
- publishing replaces older evidence intentionally;
- evidence is runtime-only and not serialized;
- every evidence item is scoped to one project;
- project mismatch returns no visible evidence;
- referenced entity/action validity is rechecked against current state before rendering or invoking;
- stale entity evidence is discarded;
- generated IDs need only be runtime-unique and are not domain IDs;
- the store does not contain raw provider responses, files or geometry snapshots.

## 10. Initial high-impact evidence scope

M7.5 covers the smallest useful set.

### First room created

Published from the authoritative room-count transition described above.

### Recognition applied

Published only after the existing recognition Apply path completes successfully.

The message may include counts returned by or derived immediately from the successful apply result. If the current operation does not expose trustworthy counts, the evidence states only that accepted candidates were applied. It must not estimate counts from stale draft state.

Recommended copy:

```text
Распознавание применено

Проверенные кандидаты добавлены как обычные стены и проёмы.
Результат можно отменить одним действием.
```

### Planning alternative applied

Published only after the existing revalidated atomic Apply succeeds.

Recommended copy:

```text
Вариант расстановки применён

Положение выбранной мебели обновлено.
Изменение можно отменить одним действием.
```

### Editable project backup exported

Published after the existing `.vlezet.json` export path successfully creates/downloads the file.

Recommended copy:

```text
Резервная копия сохранена

Файл содержит редактируемый проект и подходит для последующего восстановления.
```

PNG exports remain minor/transient unless browser evidence shows a stronger need.

## 11. Evidence presentation

New component:

`apps/web/components/editor/editor-operation-evidence.tsx`

It renders existing `UiNotice`; it does not define a parallel notice system.

Placement:

- inside the editor shell near the originating context;
- outside transient toast stacking;
- visible after the toast timeout;
- non-modal and dismissible;
- compact-safe and independently reachable;
- hidden in 3D only when the action cannot be completed there, while evidence itself remains in runtime for return to 2D.

Accessibility:

- success uses `role="status"` / polite announcement only once when published;
- errors use existing assertive `UiNotice` semantics;
- action labels describe the result, not generic `ОК`;
- colour is supplemental;
- dismiss control has an accessible name;
- focus is not moved automatically for success;
- recoverable errors may focus the action only when the existing workflow already uses an error focus contract.

## 12. Recovery evidence

High-impact failures use one content structure:

1. action that was attempted;
2. categorized outcome;
3. what remained unchanged or preserved;
4. one valid next step.

Example:

```text
Не удалось применить распознавание

Проект не изменён. Черновик проверки сохранён,
поэтому кандидаты можно проверить повторно.

[Вернуться к проверке]
```

Rules:

- never claim `Проект не изменён` unless the existing operation is atomic/fail-closed for that failure;
- never offer Retry when no valid retry path exists;
- preserve existing detailed field/provider diagnostics in their owning workflow;
- durable evidence summarizes the outcome and route back, not raw technical data;
- low-impact validation errors remain near their fields and do not enter the global evidence slot.

Initial recovery integration is limited to failures already categorized and safely attributable in recognition, planning Apply and project backup export. New failure categories or operation semantics are non-goals.

## 13. Interaction with toasts

Toast remains appropriate for:

- copied values;
- ordinary autosave status changes already visible in the shell;
- PNG export;
- low-impact immediate actions visible directly on Canvas;
- minor confirmation that does not need later verification.

Durable evidence is required for the selected high-impact operations in section 10.

A high-impact operation may still emit a toast for immediate acknowledgement, but the in-context evidence must remain after the toast expires.

## 14. Project and stale-state lifecycle

On project change:

1. clear active operation evidence;
2. reset previous room-count baseline;
3. load the new guide preference;
4. derive fresh progress from the loaded document;
5. do not replay completion events from the initial state.

On Undo/Redo or ordinary editing:

- guide progress recalculates immediately;
- first-room evidence clears if its room disappears;
- evidence never reverses a command or edits history itself;
- a later new `0 → >0` room transition may publish a new success event in the same session.

On workflow close:

- evidence remains if still valid and project-scoped;
- M7.2 workflow return behavior is unchanged.

## 15. Error handling

- localStorage exceptions are isolated and never block project startup;
- malformed stored preference is ignored;
- missing room/entity references fail closed by clearing the action/evidence;
- duplicate success publication for the same render transition is prevented;
- operation callbacks publish only after success, never optimistically;
- evidence action handlers re-read current stores before acting;
- unsupported or ambiguous recovery paths show explanation without a fake action.

## 16. Testing strategy

### Pure unit tests

- `0/0`, `1/0` and `n/>0` progress derivation;
- invalid counts fail closed;
- checklist completion/current-step mapping;
- preference key encoding and malformed-storage handling;
- storage read/write failures are isolated;
- evidence project scoping;
- replacement and dismissal;
- stale entity/action validation;
- room-count transition does not fire on initial completed-project load;
- project switch resets transition baseline;
- Undo deletion clears stale first-room evidence.

### Component/static-render tests

- empty, drawing and room-created guide copy/actions;
- guide action activates Wall without geometry mutation;
- room-created action selects an existing room;
- dismiss/finish behavior;
- guide hidden during 3D and bounded workflows;
- `UiNotice` reuse and accessible evidence markup;
- compact layout does not create document horizontal overflow;
- success does not steal focus;
- recovery action labels are specific.

### Integration tests

- first wall updates guide to drawing;
- closing a rectangle uses existing room derivation and publishes evidence;
- Undo removes room and clears stale evidence;
- Redo/new closure can publish valid evidence again;
- recognition Apply publishes only after successful apply;
- planning Apply publishes only after successful revalidation/apply;
- backup export success publishes durable evidence;
- failed operation publishes only supported recovery state;
- switching project removes old evidence and loads independent dismissal preference.

### Browser acceptance

Chromium full flow and WebKit core smoke must prove:

1. new empty project shows the dismissible guide;
2. `Начать со стены` activates the existing Wall tool;
3. first wall changes guidance to the incomplete-contour state;
4. closing a representative rectangle produces the ordinary derived room;
5. guide acknowledges first-room success;
6. durable room evidence remains after any transient toast expires;
7. room evidence opens/selects the current room;
8. Undo removes the room without leaving stale success evidence;
9. dismissing is project-specific and does not modify project backup;
10. compact width preserves guide/evidence reachability and no horizontal overflow;
11. recognition/planning/backup representative success evidence remains after toast expiry;
12. M7.1–M7.4 shell, context, status, Escape and Canvas regressions remain green.

## 17. Non-goals

M7.5 does not include:

- wall, topology, room or area algorithm changes;
- automatic geometry generation or gap closure;
- a blocking wizard, coach-mark tour or mandatory tutorial;
- onboarding fields in `VlezetDocument`;
- project schema, migration or IndexedDB repository changes;
- backup/import of UI onboarding preferences;
- dashboard/project lifecycle redesign;
- geometry/opening inspector redesign;
- furniture workflow redesign;
- recognition-quality work from issue #27;
- new planning algorithms or constraints;
- generalized notification center/history;
- persistence of operation evidence across reload;
- accessibility hardening owned by M7.9;
- mobile-first editing.

## 18. Acceptance

M7.5 is accepted only when:

- a first-time user can create and recognize a closed rectangular room without external instructions;
- the guide is dismissible and does not block expert operation;
- checklist progress is derived from authoritative state and follows Undo/Redo;
- no onboarding progress is added to `VlezetDocument`, schema or project backup;
- room-creation success remains understandable after transient notifications disappear;
- selected recognition, planning and editable-backup outcomes remain confirmable in context;
- recoverable failures identify the attempted action, preserved state and valid next step;
- stale evidence is removed on entity deletion, Undo or project switching;
- compact widths preserve task reachability without horizontal overflow;
- geometry, room derivation, snapping, history, persistence, recognition, planning and 3D authority remain unchanged;
- full unit/type/lint/build CI passes;
- Chromium full flow and WebKit core smoke pass;
- product-owner browser acceptance is recorded before merge.

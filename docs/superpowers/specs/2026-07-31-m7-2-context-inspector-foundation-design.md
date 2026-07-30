# M7.2 Context Inspector Foundation — Design

**Status:** approved direction  
**Date:** 2026-07-31  
**Branch:** `feat/m7-2-context-inspector-foundation`  
**Depends on:** accepted M7.0 audit and accepted M7.1 responsive editor shell

## 1. Purpose

M7.2 establishes one predictable semantic anatomy for the right-side context surface without changing apartment, geometry, persistence or workflow authority.

It owns:

- `UX-SHELL-003` — advanced workflows replace selection context without a shared navigation model;
- `UX-PATTERN-001` — destructive confirmation patterns are inconsistent;
- the selection-identity and action-language foundation of `UX-CONTENT-001`.

M7.1 made the context surface reachable in docked and compact layouts. M7.2 makes the contents of that surface understandable and navigable.

## 2. Evidence

Current source behaviour is inconsistent:

- wall, room, opening and object inspectors each build their own heading, section and action hierarchy;
- technical IDs appear directly in ordinary headings;
- planning replaces room context until a feature-local `Закрыть` action is pressed;
- reference and recognition each own a different close button and independently replace the same slot;
- the compact M7.1 sheet has its own close control, while child panels also expose close controls with different semantic effects;
- object/opening deletion is immediate, reference deletion uses inline confirmation and project deletion uses a modal;
- primary, secondary and destructive actions are interleaved differently in each panel.

The accepted target information architecture requires:

- one context header anatomy;
- visible selection or workflow identity;
- preserved return context for bounded workflows;
- separate destructive actions;
- the same semantic content in docked and compact presentation.

## 3. Goals

The user must always be able to answer:

1. What entity or workflow does this panel represent?
2. Which ordinary selection will I return to?
3. Does the close control hide the panel or end the workflow?
4. Which action commits the current section?
5. Is a destructive action undoable, auxiliary-only or irreversible?
6. Will hiding/reopening the panel preserve the current form or draft?

## 4. Non-goals

M7.2 does not:

- redesign every domain-specific field;
- move coordinates or advanced values into final progressive disclosures owned by M7.6/M7.7;
- complete the M7.3 typography, token and component-system migration;
- change wall, room, opening, object, reference, recognition or planning commands;
- change selection priority or Canvas hit-testing;
- add new recognition, planning or AI behaviour;
- change `VlezetDocument`, project schema, migrations, IndexedDB or backup format;
- persist workflow navigation or responsive presentation state;
- change 3D inspection, which remains owned by M7.10;
- introduce mobile-first editing.

## 5. Approaches considered

### 5.1 Style each existing panel independently

Rejected.

This would improve appearance but preserve feature-local headers, close semantics and action placement. It would not resolve the structural findings.

### 5.2 Replace all inspectors with one schema-driven form engine

Rejected for M7.2.

A schema-driven inspector could eventually reduce duplication, but it would couple the milestone to every domain field, validation path and command. The risk is disproportionate and would blur M7.2 with M7.3, M7.6, M7.7, M7.8 and M7.11.

### 5.3 Shared semantic frame around existing domain content

Selected.

M7.2 introduces:

- a pure context/workflow descriptor;
- an ephemeral workflow return target;
- shared panel frame, header, section and action-area primitives;
- explicit distinction between presentation close and workflow exit;
- a reversibility-based destructive-action pattern;
- incremental migration of current inspectors/workflows without changing their commands.

This solves navigation and hierarchy first while leaving later domain redesigns independent.

## 6. Canonical context model

### 6.1 Context kinds

```ts
export type ContextKind =
  | "empty"
  | "wall"
  | "room"
  | "opening-door"
  | "opening-window"
  | "object"
  | "reference"
  | "recognition"
  | "planning";
```

This refines the M7.1 presentation identity. It remains derived from existing stores and workflow flags.

### 6.2 Context descriptor

A framework-independent descriptor supplies semantic presentation only:

```ts
export type ContextDescriptor = Readonly<{
  kind: ContextKind;
  category: "selection" | "workflow" | "empty";
  eyebrow: string;
  title: string;
  subtitle?: string;
  phase?: string;
  returnLabel?: string;
}>;
```

Examples:

```text
Комната
Гостиная
11,72 м² · 3550 × 3300 мм внутри

Предмет
Диван
Влезает

Распознавание
Проверка черновика
Назад к комнате «Гостиная»
```

The descriptor does not contain commands, persistent state or geometry calculations. Titles and subtitles are derived from already-authoritative data.

### 6.3 Selection identity

Ordinary selection identity is always visible in the shared header:

- wall → `Стена` plus concise physical summary where available;
- room → room name, with `Комната` as type;
- opening → `Дверь` or `Окно`;
- object → object name, with `Предмет` as type;
- empty → `Свойства` / `Ничего не выбрано`.

Raw IDs are not primary identity. Existing IDs may remain temporarily available in a technical detail slot, but not compete with the user-facing title.

## 7. Workflow return context

### 7.1 Return-target snapshot

Entering a bounded workflow captures the current ordinary semantic context:

```ts
export type WorkflowReturnTarget = Readonly<{
  kind: "empty" | "wall" | "room" | "opening-door" | "opening-window" | "object";
  wallId?: string;
  roomId?: string;
  openingId?: string;
  objectId?: string;
  label: string;
}>;
```

Rules:

1. Planning opened from a room captures that room.
2. Reference or recognition opened from an ordinary selection captures that selection.
3. Switching directly between reference and recognition preserves the original ordinary return target rather than creating a nested workflow stack.
4. A return target is ephemeral React/editor-shell state.
5. It is never written to `VlezetDocument`, project UI persistence, IndexedDB or backup.
6. The target is validated against the current document before restoration.
7. A deleted or stale target fails closed to the empty context.

### 7.2 Approved navigation semantics

The approved model is:

- `Назад к комнате / предмету / стене` ends the active workflow and restores the captured ordinary selection when it is still valid;
- the compact sheet close control only hides the panel and does not close the workflow, clear selection or discard any draft;
- an explicit workflow-close action is used only when the user genuinely exits a workflow and no meaningful return target is available;
- hiding and reopening a compact sheet preserves mounted local form/draft state;
- no control labelled merely `Закрыть` may ambiguously perform both presentation hiding and workflow exit.

### 7.3 Header navigation rule

A workflow header renders exactly one semantic navigation action:

- valid return target → back action such as `К комнате «Гостиная»`;
- no valid target → explicit exit such as `Закрыть распознавание`;
- compact sheet presentation close remains owned by `EditorSideSurface` and is visually separate.

The docked panel does not need a presentation close control. It still exposes workflow back/exit where applicable.

## 8. Shared panel anatomy

```text
ContextPanelFrame
├── ContextPanelHeader
│   ├── navigation action for workflows
│   ├── eyebrow / entity or workflow type
│   ├── title
│   ├── optional subtitle / status
│   └── optional phase
├── ContextPanelBody
│   ├── ContextNotice
│   ├── ContextSection × N
│   └── ContextActionArea where required
└── ContextDangerZone when required
```

### 8.1 `ContextPanelFrame`

Responsibilities:

- one scroll container;
- semantic `aside` region and label;
- consistent internal width/spacing hooks;
- docked/compact presentation independence;
- no domain state and no persistence.

The M7.1 `EditorSideSurface` remains the outer responsive container. `ContextPanelFrame` is the inner semantic content frame.

### 8.2 `ContextPanelHeader`

Always contains:

- user-facing context/workflow type;
- primary title;
- optional status/summary;
- workflow navigation action when active.

It does not contain:

- destructive actions;
- long instructions;
- raw milestone labels;
- duplicate compact-sheet close controls;
- raw IDs as dominant copy.

### 8.3 `ContextSection`

A section has:

- optional title;
- optional concise description;
- related controls/content;
- field/section error near the affected controls;
- local commit action when that action applies only to this section.

M7.2 establishes anatomy and spacing. It does not force all fields into a final M7.3 component library.

### 8.4 `ContextActionArea`

Used for non-destructive workflow-level actions that must remain reachable after long scrolling, such as:

- planning Generate/Preview/Apply groups;
- recognition Apply/discard group;
- reference calibration save/cancel.

A sticky action area is allowed only for long workflow panels where browser evidence shows the main action otherwise becomes difficult to reach. Ordinary entity inspectors do not gain a generic sticky footer.

### 8.5 `ContextDangerZone`

Destructive actions live at the end of the panel and are visually separated from ordinary editing.

The zone includes:

- the destructive action;
- concise consequence copy;
- explicit reversibility/Undo statement where applicable;
- confirmation UI only when required by the risk model.

## 9. Entity-state mapping

### 9.1 Empty

Header:

```text
Свойства
Ничего не выбрано
```

Body preserves the current concise selection instruction. Goal-oriented first-room onboarding remains M7.5.

### 9.2 Wall

Header identity:

```text
Стена
Стена
<optional concise axis length / thickness summary>
```

Sections preserve current commands:

- axis length;
- thickness;
- facts/topology.

The milestone unifies presentation only. Final geometry grouping and orientation cues remain M7.6.

### 9.3 Room

Header identity:

```text
Комната
<room name>
<area and clear-size summary when supported>
```

Sections preserve:

- name;
- clear dimensions;
- facts;
- planning entry.

Planning entry captures the room as the return target.

### 9.4 Opening

Header identity:

```text
Дверь | Окно
<type name>
<width summary>
```

Editing controls remain unchanged. Door-swing redesign remains M7.6.

Deletion moves into the shared danger zone with explicit `Можно отменить` wording because the semantic editor history supports Undo.

### 9.5 Object

Header identity:

```text
Предмет
<object name>
<fit status>
```

Fit status remains prominent. Existing fields and commands remain authoritative.

Rotate and duplicate remain ordinary secondary commands. Delete moves into the danger zone with explicit Undo wording.

Final common-versus-advanced field hierarchy remains M7.7.

## 10. Workflow-state mapping

### 10.1 Reference

Header:

```text
Подложка
<current phase or installed-state title>
<local-browser processing summary>
```

Back/exit follows the approved return-target model.

The workflow retains all current import, calibration, display and removal commands. Final commitment grouping remains M7.8.

Reference removal remains inline-confirmed because it removes an auxiliary local asset but preserves apartment walls, openings and furniture. The confirmation must state this explicitly.

### 10.2 Recognition

Header:

```text
Распознавание
<current phase>
<local/optional external-processing status>
```

Phase is derived from the existing controller state, for example:

- ready to start;
- local analysis;
- review draft;
- stale draft;
- provider analysis;
- applied.

Back/exit does not silently apply or discard the draft. Hiding the compact panel preserves the current review state.

Recognition content redesign and translated candidate-state cleanup remain M7.8/M7.3.

### 10.3 Planning

Header:

```text
Варианты расстановки
<room name>
<current phase>
```

Phase is derived from existing state:

- wishes and constraints;
- ready to generate;
- alternatives;
- Preview.

The current feature-local `Закрыть` button is replaced by shared workflow navigation. Back restores the room selection and clears only workflow-specific ephemeral Preview according to existing close semantics.

Planning workflow simplification remains M7.11. M7.2 only gives it the common frame and navigation.

## 11. Destructive-action model

M7.2 implements the accepted reversibility model:

| Action | Pattern | Required copy |
|---|---|---|
| delete object/opening | immediate semantic command | `Можно отменить через «Отменить»` |
| remove reference asset | inline confirmation | walls/openings/furniture remain; only source plan is removed |
| delete project | existing modal, unchanged | irreversible local-project deletion |
| discard generated draft | workflow-level confirmation only when meaningful review work exists | document geometry remains unchanged |

Rules:

- destructive action is never the default Enter action;
- danger actions are not mixed into primary commit rows;
- the confirmation level follows reversibility rather than entity type;
- no new custom modal is introduced for undoable object/opening deletion;
- M7.2 does not change history semantics.

## 12. Action hierarchy

### Primary

The action that completes the current section or workflow phase.

Examples:

- apply wall length;
- save room name;
- apply object parameters;
- analyze recognition;
- generate planning alternatives;
- apply reviewed result.

### Secondary

Reversible/supporting commands:

- rotate;
- duplicate;
- fit reference;
- retry;
- preview;
- cancel a local form phase.

### Navigation

Back/exit controls change context/workflow navigation, not apartment data.

### Danger

Delete/remove/discard actions in a separate danger zone.

A button may not be styled as both navigation and destructive action.

## 13. Responsive behaviour

The same semantic frame is rendered in both M7.1 presentations.

### Docked

- panel remains visible;
- no outer presentation close control;
- workflow back/exit remains in the inner header;
- panel body scrolls independently.

### Compact sheet

- outer sheet header exposes `Закрыть панель` and only hides presentation;
- inner semantic header still exposes workflow back/exit;
- closing/reopening the sheet preserves local inputs and drafts;
- hidden sheet remains mounted but inert as established by M7.1;
- no duplicate X control exists inside migrated reference/recognition panels.

## 14. State and architecture

### Existing authority preserved

- `editorStore` remains selection/document/history authority;
- `planningUiStore` remains planning workflow/Preview authority;
- `ProjectApp` callbacks remain reference/recognition workflow authority;
- domain/editor-core/geometry/planning validation remains unchanged;
- `EditorSideSurface` remains responsive presentation authority.

### New ephemeral state

The editor shell may add:

- `WorkflowReturnTarget | null`;
- derived `ContextDescriptor`;
- presentation-only workflow phase labels.

No new state is serialized.

### Restoration

A pure helper validates and restores a return target:

1. verify referenced entity still exists;
2. clear conflicting selection IDs;
3. select exactly the valid target;
4. if invalid, clear to empty context;
5. do not create a semantic history entry because selection is ephemeral UI state.

## 15. Component boundaries

Expected shared components:

```text
apps/web/components/editor/context-panel-contract.ts
apps/web/components/editor/context-panel-frame.tsx
apps/web/components/editor/context-workflow-return.ts
apps/web/components/editor/context-panel.test.tsx
apps/web/app/context-panel.css
```

Expected representative migrations:

```text
apps/web/components/editor/wall-inspector.tsx
apps/web/components/editor/object-inspector.tsx
apps/web/components/reference/reference-panel.tsx
apps/web/components/recognition/recognition-panel.tsx
apps/web/components/planning/planning-panel.tsx
apps/web/components/editor/apartment-editor.tsx
```

Exact file decomposition may be adjusted by the implementation plan, but domain commands must not be moved into generic presentation components.

## 16. TDD strategy

### Slice A — descriptor and return-target contracts

RED tests cover:

- stable identity labels for empty/wall/room/opening/object;
- workflow phase/title mapping;
- return target captured from each ordinary selection;
- workflow-to-workflow transition preserves original ordinary target;
- stale/deleted target returns empty;
- no input/document mutation.

### Slice B — shared frame rendering

RED tests cover:

- shared header anatomy;
- selection identity visible;
- exactly one workflow navigation action;
- no ambiguous child close control;
- section/body/danger-zone order;
- docked/compact content equivalence.

### Slice C — workflow navigation integration

RED tests cover:

- room → planning → back restores room;
- selected entity → reference → back restores entity;
- reference → recognition preserves original ordinary return target;
- compact sheet X hides presentation but keeps active workflow and draft;
- explicit workflow exit closes workflow;
- stale target fails closed.

### Slice D — destructive hierarchy

RED tests cover:

- object/opening deletion in danger zone with Undo copy;
- reference removal uses inline confirmation and preserved-apartment copy;
- project modal remains unchanged;
- danger actions are separated from primary actions.

### Slice E — browser acceptance

Chromium representative flow verifies:

- empty, wall, room, opening and object headers;
- planning return to room;
- reference return to prior selection;
- recognition return semantics;
- compact sheet hide/reopen without workflow or draft loss;
- object/opening delete and Undo;
- reference inline confirmation;
- docked and compact semantic equivalence;
- no horizontal overflow/regression from M7.1.

WebKit core smoke verifies:

- room/object context identity;
- compact sheet hide/reopen;
- one workflow return path;
- destructive confirmation path;
- 2D/3D and dashboard regressions remain green.

## 17. Accessibility

M7.2 provides:

- one labelled complementary context region;
- heading hierarchy with one primary panel title;
- accessible names for back, workflow exit and presentation close;
- no two identical `Закрыть` controls with different effects;
- visible focus for context navigation and actions;
- hidden compact content remains inert;
- status/phase text is not colour-only;
- destructive consequence and Undo availability are textual.

Complete focus-management and screen-reader workflow hardening remains M7.9.

## 18. Risks and mitigations

### Risk: local form state is lost during migration

Mitigation: shared frames wrap existing mounted components; they do not recreate domain forms unnecessarily. Existing key semantics are reviewed explicitly.

### Risk: workflow exit accidentally discards a draft

Mitigation: back/exit calls only the existing workflow-close path; discard remains a separate explicit action. Compact close never invokes workflow close.

### Risk: stale return target restores invalid selection

Mitigation: fail-closed document validation before restoration.

### Risk: generic component absorbs domain authority

Mitigation: shared primitives receive presentation descriptors and children only. Commands and validation remain in current feature components.

### Risk: M7.2 expands into full visual redesign

Mitigation: only anatomy, navigation, action order and minimal styling are in scope. Typography/tokens and domain-specific form restructuring remain later milestones.

## 19. Acceptance gate

M7.2 is complete only when:

- one shared semantic anatomy is used by representative entity and workflow contexts;
- selection/workflow identity is always visible;
- the approved back/hide/exit distinction is implemented;
- valid prior context is restored and stale context fails closed;
- compact hiding preserves workflow and uncommitted draft state;
- destructive action level matches reversibility;
- existing actions remain reachable in docked and compact layouts;
- no document/schema/migration/persistence/geometry/planner authority changes exist;
- full unit/type/lint/build CI passes on exact head;
- Chromium representative flow and WebKit core smoke pass on exact head;
- product-owner browser acceptance is recorded before merge.

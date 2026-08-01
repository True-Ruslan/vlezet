# M7.7 — Furniture and Fit Workflow Design

**Status:** approved design specification  
**Date:** 2026-08-01  
**Branch:** `feat/m7-7-furniture-fit-workflow`  
**Base:** `259182852157d7552b37c8a10a3bcebcb31e086c`  
**Owned findings:** `UX-FURN-001`, `UX-FURN-002`, `UX-FURN-003`, remaining `UX-FURN-004`

## 1. Goal

M7.7 makes furniture discovery, placement, orientation, exact editing and fit explanation feel like one predictable workflow for an ordinary apartment owner.

The slice must improve presentation and command routing around the existing furniture model. It must not weaken or duplicate M2 authority for containment, collisions, door conflicts, recommended clearances or fit status.

The intended user flow is:

1. find a known item without scanning the complete catalogue;
2. select the preset and understand that Canvas placement is active;
3. preview where the item will appear and whether it fits;
4. place it explicitly;
5. immediately understand its fit result, dimensions, orientation and common actions;
6. adjust exact properties through one atomic Apply operation;
7. distinguish object dimensions, recommended use zones and actual free distances;
8. recover from invalid input without document mutation;
9. Undo each accepted semantic operation in one step.

## 2. Current product facts to preserve

The implementation already has:

- static versioned furniture presets;
- one placement preset ID in editor runtime state;
- runtime Canvas placement preview;
- object snapping and transform gestures;
- authoritative `PlacedObject` persistence in `VlezetDocument`;
- semantic commands for add, update, rotate, duplicate, delete and gesture commit;
- M2-authoritative `evaluateObjectFits()`;
- M2-authoritative `measureObjectClearances()`;
- selected-object width/depth labels on Canvas;
- selected-object recommended clearance polygon;
- selected-object actual directional clearance labels;
- fit status values `fits`, `tight` and `blocked`;
- one-step Undo/Redo for accepted object commands;
- existing exact contour-gap evidence in the planning workflow.

M7.7 reorganises and explains these capabilities. It does not replace them.

## 3. Design decision

Use a single continuous catalogue → Canvas preview → selected-object inspector workflow.

Rejected alternatives:

### Separate furniture editor mode

A dedicated mode would provide more space but would introduce another navigation model, duplicate context ownership and conflict with the accepted M7.2 context inspector foundation.

### Immediate persistence for every field

Immediate persistence would generate noisy history, expose transient invalid combinations and make multi-field corrections difficult to Undo coherently.

### Catalogue recents or favourites in M7.7

The current catalogue contains fourteen presets. Search and category navigation solve the observed discovery problem without adding a new persisted preference contract. Recents and favourites remain future evidence-driven options.

## 4. Catalogue experience

### 4.1 Structure

The catalogue keeps its existing left-side location and placement command. Its internal hierarchy becomes:

1. title and placement guidance;
2. search field;
3. horizontally wrapping category chips;
4. result count or active filter summary;
5. filtered preset list;
6. empty-result recovery;
7. active-placement cancellation.

The catalogue must remain independently scrollable and must not widen the root editor grid.

### 4.2 Search

Search is case-insensitive and uses the same deterministic normalisation for query and preset names:

- Unicode NFKC;
- lowercase;
- trim leading/trailing whitespace;
- collapse internal whitespace;
- replace `ё` with `е`;
- remove punctuation that separates words;
- preserve digits.

A preset matches when all non-empty query tokens occur in the normalised preset name in any order.

Examples:

- `стол` matches `Рабочий стол` and `Обеденный стол`;
- `раб стол` matches `Рабочий стол`;
- `тв тумба` matches `ТВ-тумба`;
- an empty query does not filter results.

Search does not use fuzzy distance, synonyms, AI or hidden ranking.

### 4.3 Categories

Category chips are:

- `Все`;
- `Сон`;
- `Мягкая мебель`;
- `Хранение`;
- `Столы`;
- `Стулья`;
- `Кухня`;
- `Техника`;
- `Свой размер`.

Exactly one category is selected. `Все` is the default. Search and category filters combine with logical AND.

Categories with zero presets after search remain visible so the navigation does not jump. Their zero state may be visually subdued but remains keyboard reachable.

### 4.4 Result order

Results preserve the canonical `FURNITURE_PRESETS` order inside the accepted category order. Search does not introduce relevance scoring.

### 4.5 Runtime state

Search text and active category are local runtime UI state. They are not added to:

- `VlezetDocument`;
- IndexedDB project records;
- portable backup files;
- semantic history;
- project completion evidence.

Opening and closing the catalogue during the same mounted editor session preserves those local filters. Reloading the editor may reset them.

### 4.6 Keyboard and semantics

The search field has a visible label or accessible name. Category chips use a single-selection pattern with `aria-pressed` or equivalent semantics. Preset cards remain native buttons with name and dimensions in their accessible label.

Tab order is:

1. search;
2. category chips in visual order;
3. matching preset cards;
4. placement cancellation when present.

M7.7 does not claim whole-product accessibility completion, but it must not introduce pointer-only catalogue actions.

### 4.7 Empty result

When no preset matches, the catalogue shows:

- `Ничего не найдено`;
- the active search/category context;
- a `Сбросить фильтры` action.

Reset clears the query and selects `Все`. It does not change placement state or the document.

## 5. Placement workflow

### 5.1 Starting placement

Selecting a preset continues to call the existing authoritative `setPlacementPreset(preset.id)` runtime command.

The catalogue shows the selected preset as active and exposes `Отменить размещение`. Canvas mode guidance names the selected item and explains the next action.

Selecting the currently active preset again cancels placement, preserving current behavior.

### 5.2 Canvas preview

The Canvas continues to derive placement preview geometry from the selected preset and pointer position. Object snapping remains unchanged.

The preview displays a non-colour fit label near the preview object:

- `Влезает`;
- `Влезает, но тесно`;
- `Не влезает`.

The label is derived from the same M2 fit evaluation used for committed objects. M7.7 must not invent a separate preview status calculation.

The existing preview contour and recommended-use zone remain visual projections only.

### 5.3 Committing placement

A Canvas click commits the existing `object/add` semantic command. The new object becomes selected, placement mode ends and the selected-object inspector opens.

M7.7 does not add continuous multi-place mode. Every preset selection places one item, matching current behavior and avoiding accidental duplicates.

### 5.4 Blocked placement policy

M7.7 does not change current add authority. If the existing product permits committing a blocked object for manual correction, the new presentation must not silently prohibit it. It must clearly show `Не влезает` before and after placement.

Any future change to hard placement rejection requires a separate domain/product decision.

## 6. Selected-object inspector

The selected-object inspector uses this fixed section order:

1. `Проверка размещения`;
2. `Основные параметры`;
3. `Зоны использования`;
4. `Точное положение`;
5. ordinary object actions;
6. danger zone.

### 6.1 Fit summary

The top section keeps the canonical `FitStatusBadge` and restructures diagnostics into semantic groups.

Priority order:

1. outside-room or invalid containment;
2. collisions with other objects;
3. door/opening conflicts;
4. insufficient recommended clearances;
5. success.

Diagnostic grouping is presentation-only. It uses existing diagnostic codes and messages; it does not alter fit evaluation.

Each group provides an allowed manual next action, for example:

- move the object;
- rotate it by 90°;
- reduce exact dimensions when physically appropriate;
- inspect the conflicting item or door;
- review a recommended clearance.

The UI must not offer automatic movement, automatic rotation or automatic repair.

When there are multiple diagnostics, the status summary remains visible before the list and no lower-severity recommendation visually outranks a hard conflict.

### 6.2 Main parameters

Immediately visible fields are:

- name;
- width;
- depth;
- height when supported;
- exact rotation angle.

Common action `Повернуть 90°` remains immediately reachable beside the rotation section. It continues to execute the existing separate `object/rotate` semantic command.

The UI explains that width and depth belong to the object local axes and rotate with the object.

### 6.3 Atomic Apply

The editable inspector maintains one local draft for all exact object fields:

- name;
- width;
- depth;
- optional height;
- rotation;
- X;
- Y;
- front clearance;
- right clearance;
- back clearance;
- left clearance.

`Применить изменения` parses and validates the complete draft first. Only a fully valid draft calls the existing authoritative `updateSelectedObject()` once.

The resulting document change remains one `object/update` command and one Undo step.

Pressing Enter inside a field may submit only when it follows normal form semantics and cannot bypass complete validation.

### 6.4 Draft identity and synchronisation

The local draft is keyed by selected object ID.

When selection changes to another object:

- the previous draft is discarded;
- fields initialise from the newly selected authoritative object;
- errors are cleared.

When Undo, Redo, deletion or another accepted command changes the currently selected object, the inspector must not retain a stale draft that can overwrite the new authoritative state.

The implementation must use an explicit synchronisation contract based on object ID plus authoritative object values. It must not rely only on component remount timing.

If a user has an unsaved valid or invalid draft and the authoritative selected object changes externally, the draft resets to the authoritative values. M7.7 does not add unsaved-change confirmation.

## 7. Field validation

### 7.1 Pure draft parser

Create a framework-independent presentation helper that accepts the local string draft and returns one of:

```ts
{ ok: true; patch: PlacedObjectPatch }
```

or

```ts
{ ok: false; errors: Partial<Record<ObjectDraftField, string>> }
```

It must not import React, Zustand, Konva, IndexedDB or editor store state.

### 7.2 Parsing rules

Numeric inputs accept a decimal comma or point. Whitespace around a value is ignored.

Required numeric fields must be finite numbers.

Validation rules:

- width > 0;
- depth > 0;
- optional height: empty preserves current absence/value according to the existing object contract; a supplied height must be > 0;
- X and Y must be finite;
- rotation must be finite;
- front/right/back/left clearances must be finite and >= 0;
- name is trimmed and must remain non-empty;
- existing domain/editor-core validation remains the final authority.

Rotation is not forcibly limited to 0–359 in the draft. Existing object update normalisation/behavior remains authoritative. Presentation may display a normalised equivalent after successful Apply.

### 7.3 Error presentation

Every invalid field receives:

- a field-local error message;
- `aria-invalid="true"`;
- an error relationship through `aria-describedby` or equivalent;
- preserved entered text.

The Apply action does not mutate the document while any field error exists.

A form-level error is reserved for authoritative update failures that cannot be attributed to one field. It appears near the Apply action and does not erase field values.

Error copy names the remedy, for example:

- `Введите ширину больше 0 мм`;
- `Введите неотрицательный зазор`;
- `Введите число`.

The implementation must report all locally detectable field errors in one submit, not only the first failure.

## 8. Orientation and clearance presentation

### 8.1 Local-axis contract

Furniture clearances remain object-local:

- front: local positive depth direction;
- back: local negative depth direction;
- right: local positive width direction;
- left: local negative width direction.

The mapping rotates with `rotationDeg` and must be demonstrated for 0°, 90°, 180° and 270°.

M7.7 does not redefine these values in screen coordinates.

### 8.2 Orientation cue component

Add a store-free orientation cue component driven only by presentation props:

- object width/depth aspect ratio;
- rotation angle;
- active or invalid field state where required;
- four clearance values;
- optional actual measured distances.

The component renders:

- a top-view object rectangle;
- a clear front marker;
- labels or controls for front/right/back/left around the physical rotated rectangle;
- recommended clearance extents distinct from the object contour;
- readable text equivalents independent of colour.

It does not calculate authoritative geometry, persist state or invoke commands.

### 8.3 Progressive disclosure

`Зоны использования` is visible as a semantic section because fit understanding is central to M7.7. The four editable clearance fields may live in a collapsible detail region under the orientation cue.

`Точное положение` is collapsed by default and contains centre X/Y fields with explanatory copy.

Disclosure state is component-local runtime state and is not persisted.

### 8.4 Recommended versus actual

The inspector must use different labels:

- `Рекомендуется` for configured object clearances;
- `Свободно сейчас` for measured distances to actual obstacles.

A value such as `700 мм` must never appear without one of these meanings in the clearance section.

Null actual distance renders as `Нет ближайшего препятствия` or a compact dash with an accessible explanatory label.

## 9. Canvas measurement roles

For a selected object, Canvas must keep three semantically distinct visual roles:

### Object dimensions

Width and depth labels attach to the selected object contour and are named as dimensions.

### Recommended use zone

The expanded clearance polygon remains dashed and visually secondary. A compact legend or selected-object cue names it `Рекомендуемая зона использования`.

### Actual free distance

Directional measured distances use explicit arrows/markers from the object contour toward the nearest obstacle and are labelled `Свободно` where space permits.

The implementation may reuse existing measurement positions but must improve copy and visual differentiation so actual distance cannot be mistaken for width/depth.

### Exact pair gap

The M6.3 planning annotation remains separate and keeps the explicit term:

`Кратчайший зазор между контурами`.

M7.7 must not move exact pair-gap authority into the ordinary object inspector or represent it as an object dimension.

## 10. Ordinary actions

The action area contains:

- `Повернуть 90°`;
- `Дублировать`.

Rotation is also available near the exact rotation field for discoverability, but there must be only one semantic button instance in the final tab order. Responsive placement may move the same action rather than duplicate it.

Deletion remains isolated in the existing danger zone with Undo guidance.

No new actions are introduced for automatic centring, alignment, wall attachment or fit repair.

## 11. Architecture and component boundaries

Expected new or refactored units:

### Pure presentation helpers

- catalogue query normalisation and deterministic filtering;
- object draft parsing and field-error mapping;
- diagnostic grouping/presentation;
- local clearance-side orientation mapping;
- selected-object measurement labels.

### Store-free UI components

- catalogue search/category controls;
- field-with-local-error primitive if an existing M7.3 primitive cannot express the contract;
- object orientation/clearance cue;
- fit diagnostic group;
- selected-object measurement legend.

### Existing authority adapters

- `FurnitureCatalog` owns local filter state and calls `setPlacementPreset()`;
- `ObjectInspector` owns local object draft and calls existing object commands;
- `EditorCanvas` projects existing placement, fit and clearance results;
- `editorStore` remains the only UI command adapter for document mutation.

The implementation should split `object-inspector.tsx` when required to keep parsing, presentation and command wiring independently understandable and testable. Unrelated editor refactoring is out of scope.

## 12. Data flow

### Catalogue

```text
FURNITURE_PRESETS
      ↓
pure deterministic filter(query, category)
      ↓
store-free result cards
      ↓ explicit preset button
editorStore.setPlacementPreset(presetId)
```

### Placement

```text
placementPresetId + pointer
      ↓ existing preset preview and object snapping
M2 evaluateObjectFits(preview document)
      ↓
Canvas preview + non-colour fit label
      ↓ explicit Canvas click
editorStore.placeSelectedPreset(position)
      ↓
object/add semantic history command
```

### Inspector Apply

```text
authoritative selected object
      ↓ initialise local string draft
user edits
      ↓
pure complete draft validation
      ├─ errors → field-local messages, no mutation
      └─ patch → editorStore.updateSelectedObject(patch)
                       ↓
                 object/update command
```

### Fit evidence

```text
VlezetDocument
      ├─ evaluateObjectFits() → status + diagnostics
      └─ measureObjectClearances() → actual directional distances
                    ↓ presentation-only grouping/labels
             inspector + Canvas projections
```

## 13. Responsive behavior

### Docked editor

At ordinary desktop widths:

- catalogue remains 250 px unless existing shell tokens change it consistently;
- search and chips fit without horizontal document overflow;
- inspector sections use one or two columns only when each field remains readable;
- Canvas retains `minmax(0, 1fr)` protection.

### Compact width

At compact width:

- catalogue/context surfaces continue using the accepted M7.1/M7.2 compact behavior;
- category chips wrap or scroll inside their own bounded region, never the document;
- parameter pairs collapse to one column;
- the orientation cue remains readable without horizontal page overflow;
- ordinary actions become one column when necessary;
- disclosure controls and Apply remain reachable;
- Canvas hit testing must not be covered by floating catalogue/inspector content.

M7.7 must preserve the accepted browser zoom matrix and no-horizontal-overflow contracts.

## 14. Error and stale-state handling

- Invalid catalogue filters never affect placement or document state.
- A missing active preset fails closed through existing preset lookup behavior and must not create a malformed object.
- Placement preview clears when placement mode ends, preset changes or pointer leaves Canvas according to existing transient-state rules.
- Object draft validation failure never calls the editor store.
- Authoritative update failure leaves the draft and field values visible.
- Deleting the selected object closes its inspector and clears stale local draft state.
- Undo/Redo that removes or replaces selection must use existing selection-after-history guards.
- Fit/clearance calculation failure renders a bounded unavailable state and must not invent successful measurements.

## 15. Test strategy

Implementation must follow TDD with explicit RED/GREEN evidence.

### Pure unit tests

- query normalisation including `ё/е`, punctuation and whitespace;
- all-token catalogue matching;
- category + query AND behavior;
- stable preset order;
- empty-result reset;
- object draft valid patch;
- every numeric field error;
- simultaneous multiple field errors;
- non-empty name validation;
- clearance side mapping at 0°, 90°, 180° and 270°;
- deterministic diagnostic priority/grouping;
- measurement terminology.

### Component and source-contract tests

- search accessible name;
- category single-selection semantics;
- keyboard-reachable preset cards;
- active placement and cancellation;
- empty catalogue recovery;
- inspector section order;
- coordinates hidden under exact-position disclosure by default;
- common fields visible before advanced fields;
- one semantic rotate action in tab order;
- field-local error association;
- orientation cue labels and front marker;
- recommended versus actual terminology;
- fit status and grouped diagnostics;
- no duplicate persistent/runtime furniture model;
- existing store command labels preserved.

### Store/history tests

- catalogue filters do not touch history;
- placement remains one `object/add` Undo step;
- full valid Apply remains one `object/update` Undo step;
- invalid Apply leaves history/document unchanged;
- quick 90° rotation remains one `object/rotate` Undo step;
- duplicate and delete remain one-step semantic operations;
- selected draft resets after selection change and authoritative Undo/Redo.

### Layout tests

- catalogue controls do not widen the editor grid;
- category navigation remains bounded;
- inspector pairs collapse at compact width;
- orientation cue remains within context width;
- no document-level horizontal overflow;
- action and Apply controls remain reachable.

### Browser acceptance

Chromium full flow must cover:

1. open catalogue;
2. search for a known item;
3. filter by category;
4. reset a zero-result query;
5. select a preset;
6. observe fit-labelled Canvas preview;
7. place and select the object;
8. inspect dimensions, orientation and fit result;
9. rotate 90° and verify side mapping;
10. Undo rotation;
11. submit multiple invalid fields and verify no mutation;
12. correct and atomically Apply dimensions/rotation/clearances;
13. Undo the complete Apply in one step;
14. inspect recommended and actual clearance meanings;
15. open exact position and edit X/Y;
16. verify compact layout and no horizontal overflow.

WebKit core smoke must cover catalogue search, placement, selected-object inspector, rotation, valid Apply/Undo and invalid fail-closed behavior.

Product-owner manual acceptance remains mandatory before Ready and protected squash merge.

## 16. Acceptance criteria

M7.7 is acceptable only when:

- a known preset can be found without scanning unrelated categories;
- catalogue search/filter state is runtime-only and deterministic;
- Canvas preview communicates fit without colour alone;
- placement continues through existing explicit `object/add` authority;
- selected-object name, dimensions, height and rotation precede coordinates;
- front/right/back/left are physically predictable after rotation;
- recommended clearances and actual free distances are unmistakably different;
- width/depth cannot be confused with free distance or pair-gap evidence;
- hard fit conflicts outrank recommendations;
- diagnostics offer manual next actions without auto-repair;
- all locally detectable invalid fields are identified together;
- invalid drafts retain text and do not mutate geometry;
- one valid full Apply is one semantic Undo step;
- quick rotate, duplicate and delete preserve existing command semantics;
- compact widths preserve catalogue, Canvas and inspector reachability;
- M7.1–M7.6 regressions remain green;
- unit, component, source, layout, TypeScript, ESLint and production build pass;
- Chromium full flow and WebKit core smoke pass;
- product-owner browser acceptance passes on the exact candidate head.

## 17. Explicit non-goals

M7.7 does not:

- change `VlezetDocument`, schema or migrations;
- change IndexedDB or portable backup format;
- change M2 containment, collision, door or clearance algorithms;
- redefine local furniture axes;
- change object snapping or transform gesture authority;
- add automatic movement, rotation, alignment or repair;
- add recents, favourites or user-created catalogue persistence;
- add new furniture assets or expand the preset inventory;
- expand deterministic planning or autonomous furnishing;
- implement recognition work owned by M7.8;
- claim whole-product accessibility completion owned by M7.9;
- redesign 3D;
- perform visual-only product consolidation owned by M7.13.

## 18. Delivery gate

Implementation starts only after this written specification is reviewed and approved.

After approval, a separate implementation plan must define small TDD slices, exact files, RED/GREEN commands, browser evidence and the manual acceptance checklist. The feature PR remains Draft until automated exact-head verification and product-owner acceptance are both complete.

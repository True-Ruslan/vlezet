# M8.2 Direct Manipulation and Hosted-Opening Drag Correction Design

**Status:** product-owner approved behavior; written-spec review pending  
**Date:** 2026-08-12  
**Milestone:** M8.2 — Precision Drawing / Direct Manipulation Foundation  
**PR:** #87 (`feat/m8-2-precision-structural-editing`)  
**Supersedes:** only the ordinary-body hit-priority rule in `2026-08-12-m8-2-room-translation-design.md`; all other room-translation safety, explicit-selection and history contracts remain in force.

## 1. Why this correction exists

The previous M8.2 room-translation design intentionally allowed room movement only when drag started from free room interior. Furniture, openings, walls and handles had higher pointer priority.

That is safe for isolated single-entity gestures, but it creates a dead-end for an explicit mixed selection:

```text
selection = room + selected furniture
pointer-down = body of one already selected furniture item

PlacedObjectShape owns the Konva event
→ room gesture is not started
→ placed-object batch move rejects the mixed selection
→ no semantic gesture owns the drag
```

The product-owner retest reproduced exactly this path. Earlier Chromium/WebKit GREEN remains valid for free-interior-started room movement, but it did not cover this mixed-selection gesture and therefore does not supersede the manual failure.

The same retest added two adjacent direct-manipulation requirements:

1. hosted openings, at minimum doors and preferably windows through the same primitive, must move directly along their current host wall;
2. room labels must remain readable in compact rooms and under long room names instead of overlapping area/dimension text.

M8.2 remains Draft and not product-accepted until this correction is implemented, automated and manually retested.

## 2. Product principles preserved

This correction does **not** change Vlezet's architectural model:

- `VlezetDocument` remains the only persistent geometry/layout truth;
- rooms remain derived, never persistent containers;
- furniture membership in a room remains explicit selection, never implicit ownership;
- openings remain hosted by physical walls;
- `@vlezet/editor-core` remains structural mutation/validation authority;
- M2 remains fit/collision/door/clearance authority;
- Canvas/Konva owns intent and projection, not geometry validity;
- one committed user gesture produces one semantic history operation;
- unsupported or invalid geometry fails closed with no partial mutation;
- no recognition/AI behavior or threshold changes are part of this slice.

## 3. Reference inputs and reuse policy

This design follows the repository research policy documented in:

- `docs/product/COMPETITIVE_BENCHMARK.md`;
- `docs/research/OPEN_SOURCE_FLOOR_PLANNERS.md`.

Relevant observations:

- mature commercial planners such as RoomPlan make ordinary direct manipulation the default mental model;
- `fedepaj/arcada-planner` centralizes hit/drag decision-making instead of allowing arbitrary render-node bubbling to define product semantics;
- `charmlinn/blueprint3d-modern` models wall-local movement for wall/in-wall items and constrains them to the host wall;
- both referenced repositories are MIT according to the recorded research, but no source code is copied by this design.

Vlezet adopts the **behavioral/architectural ideas**, not their authority model. Any later direct code adaptation requires explicit license/provenance documentation plus Vlezet-specific RED tests.

## 4. Correction A — one selection-aware gesture arbiter

### 4.1 Goal

Pointer-down over an already selected group must resolve one semantic gesture owner before a concrete Konva component starts mutation.

The renderer node that happens to receive the event must not decide ambiguous mixed-selection semantics.

### 4.2 Supported room-composite selection

A room-composite movement selection is valid when the current sanitized selection contains:

- exactly one derived room;
- zero or more placed objects;
- no wall, vertex, opening or other structural root.

Furniture may have been selected through modifier-click, marquee, or `Выбрать мебель в комнате`. Selection provenance does not change movement semantics.

### 4.3 Ordinary-body drag behavior

For a valid room-composite selection:

- drag from free interior of the selected room starts `translate-room`;
- drag from the **ordinary body of any already selected placed object** also starts the same `translate-room` composite gesture;
- every explicitly selected furniture object moves by the exact room structural delta;
- unselected furniture does not move, even if spatially inside the room;
- selection stays the same except for normal primary-ref focus changes that do not change membership.

If the furniture under the pointer is **not** already selected, ordinary placed-object behavior wins: the object becomes the direct target according to existing selection rules rather than silently joining/moving the room composite.

### 4.4 Priority order

The gesture arbiter resolves pointer intent in this order:

1. active modal/editor overlays and text/input controls;
2. specialized resize/rotate/transform handles;
3. opening body drag when the direct target is a hosted opening;
4. structural vertex/junction/wall handles and other dedicated structural controls;
5. room-composite ordinary-body drag when the direct target is either:
   - free interior of the selected room, or
   - ordinary body of an already selected placed-object member;
6. ordinary placed-object drag;
7. ordinary room-interior drag;
8. marquee/pan/empty-Canvas behavior.

This priority is semantic, not simply Konva z-order.

### 4.5 Architecture

Add a pure/runtime helper such as `resolveEditorPointerGestureIntent(...)` in the web editor interaction layer. It accepts sanitized selection plus semantic direct-hit identity and returns a discriminated intent such as:

```ts
{ kind: "room-composite-move", roomId, objectIds }
{ kind: "opening-host-move", openingId }
{ kind: "placed-object-move", objectId }
{ kind: "structural-handle", ... }
{ kind: "none" }
```

Exact naming belongs to implementation planning; the key requirement is one testable decision boundary shared by Canvas and interactive entity components.

`PlacedObjectShape` must no longer be the final semantic authority for whether an already selected mixed group becomes an object gesture or room-composite gesture. It may still own visual drag projection after the arbiter has selected the gesture.

## 5. Correction B — hosted-opening direct movement

### 5.1 Supported scope

One primitive serves doors and windows because both use the same hosted-opening model.

The user may select an opening and drag its body directly. The ordinary gesture moves that opening **only along its current host wall**.

### 5.2 No silent re-hosting

Ordinary opening drag preserves:

```text
opening.wallId
opening.kind
opening.width
opening.swing / other existing semantic properties
```

Only wall-local placement/offset changes.

Crossing a wall corner, dragging nearer another wall, or pointing outside the current host wall never silently changes `wallId`.

A future explicit `Перепривязать`/re-host operation may be designed separately, but is not part of M8.2.

### 5.3 Pointer-to-wall projection

Editor-core/geometry derives the candidate from the current host wall:

1. project pointer world position to the host wall centreline/local axis;
2. convert projection to the opening's canonical wall-local placement representation;
3. constrain the requested centre to the physical host span so the opening footprint cannot extend beyond either wall endpoint;
4. construct a complete candidate document;
5. run the unchanged structural/opening validator.

Clamping to the physical extent of the **same wall** is acceptable because it is the direct geometric meaning of “move within this wall”. Validation failures such as overlap with another opening still fail closed rather than searching another nearby position.

### 5.4 Preview and commit

During drag:

- valid candidate shows the opening at the projected wall-local position;
- invalid overlap/host candidate exposes existing invalid-preview feedback and a concise reason;
- mouseup commits only a valid changed candidate;
- reject/cancel/no-op creates no history entry;
- one accepted opening drag creates exactly one semantic history command;
- Undo/Redo restores the exact previous/new opening placement.

No clipboard-style safe-nearby search is used.

## 6. Correction C — room-label readability

### 6.1 Goal

Room annotation must remain understandable even for long names and small room screen bounds. Text must not overlap itself into an unreadable block.

This is projection-only; room name, area and dimensions remain canonical values from their existing authorities.

### 6.2 Deterministic information priority

Preferred display order:

1. room name;
2. area;
3. clear room dimensions when available.

The Canvas chooses the richest layout that fits a safe annotation box derived from the room's current screen-space bounds.

Deterministic degradation order:

1. name up to two lines + area + dimensions;
2. name up to two lines + area;
3. one-line ellipsized name + area if both fit;
4. one-line ellipsized name only;
5. if even that cannot fit safely, suppress the interior label and rely on selection/inspector rather than drawing overlapping text.

Dimensions are therefore removed before area; area is removed before the room name.

### 6.3 Layout constraints

- no text may extend outside the computed safe room-label box merely to preserve more lines;
- no name/area/dimension line may overlap another line;
- zooming may change which presentation tier is visible, but never changes document data;
- selection/hover styling may not increase label dimensions enough to create a new overlap;
- long unbroken text must still terminate with deterministic ellipsis rather than overflow.

## 7. Gesture/state/history behavior

### Room-composite move

The existing `translate-room` transaction remains authoritative. The correction changes how the gesture is **started**, not the structural movement/validation semantics.

For `room + selected furniture`, starting on any supported selected ordinary-body member must still result in:

- one structural preview document;
- same applied delta for selected furniture;
- no movement for unselected furniture;
- one atomic commit;
- one Undo/Redo operation;
- fail-closed rejection if room topology is unsafe.

### Opening move

Opening movement extends the existing structural gesture model or an equivalently single semantic transaction path. It must not use an independent history implementation.

### Concurrent/stale mutation

If the authoritative document changes between gesture begin and commit, the gesture rejects fail-closed with no partial mutation, consistent with existing structural gestures.

## 8. Error handling and feedback

Required visible reasons include at least:

- unsafe room topology cannot be translated independently;
- opening candidate conflicts with another opening or violates host-wall validity;
- document changed while the gesture was active.

The exact Russian copy belongs to existing content conventions. Feedback must be non-modal where practical and must not be colour-only.

The room-composite gesture should not show an error merely because the pointer originated on selected furniture; that path becomes supported behavior.

## 9. TDD acceptance matrix

### 9.1 Gesture arbiter unit tests

1. selected `room + sofa + table`, direct hit selected sofa body → `room-composite-move`;
2. same selection, free selected-room interior → `room-composite-move`;
3. same selection, direct hit selected table body → same room/object membership;
4. same selection, direct hit unselected chair → ordinary placed-object intent, not composite move;
5. selected furniture transform handle → transform intent outranks composite;
6. opening direct hit → opening-host-move outranks room composite;
7. structural handle → structural intent outranks room composite;
8. unsupported selection (`room + wall`) never produces room-composite move.

### 9.2 Store / room movement regression

1. room + explicit objects started from selected-object body produces the same structural/object preview as starting from free room interior;
2. exact same delta applies to structure and selected objects;
3. unselected in-room object is unchanged;
4. unsafe room translation rejects atomically;
5. one successful move = one history entry;
6. Undo/Redo is exact;
7. cancel/no-op/stale creates no history.

### 9.3 Opening editor-core tests

1. project pointer to horizontal host wall and update only wall-local placement;
2. same for vertical/angled wall;
3. `wallId`, kind, width and other unrelated semantic fields remain unchanged;
4. movement clamps to each physical wall endpoint accounting for opening width;
5. overlap with another opening rejects through unchanged validator;
6. source document is not mutated;
7. zero movement is no-op;
8. stale/invalid host fails closed.

### 9.4 Opening store/Canvas tests

1. opening body pointer starts hosted-opening gesture;
2. preview follows host-wall projection, not free XY pointer;
3. no auto-rehost when pointer crosses near another wall;
4. invalid preview gives reason and mouseup commits nothing;
5. accepted drag creates one history operation;
6. Undo/Redo exact.

### 9.5 Room-label tests

1. ordinary room shows name + area + dimensions;
2. long name wraps at most two lines when space permits;
3. smaller room hides dimensions before area;
4. still smaller room ellipsizes/hides lower-priority content deterministically;
5. long unbroken name never overlaps area/dimensions;
6. selected/hovered state does not change overlap guarantees.

### 9.6 Chromium browser acceptance

1. explicitly select room + two furniture items and drag **one selected furniture body**; complete group moves rigidly;
2. repeat from free room interior and confirm equivalent membership/behavior;
3. drag unselected furniture inside selected room; room composite is not silently moved;
4. specialized furniture resize/rotate remains usable and does not move room group;
5. drag door along its host wall; host wall remains the same;
6. drag door beyond wall end; it remains constrained to that wall;
7. conflict with another opening rejects visibly and commits nothing;
8. representative window uses the same hosted-opening movement primitive;
9. Undo/Redo exact for composite room movement and opening movement;
10. long-name compact room renders readable non-overlapping label.

### 9.7 Representative WebKit acceptance

At minimum:

- selected-furniture-body → room-composite movement;
- unselected furniture retains ordinary behavior;
- door host-wall drag and no re-host;
- invalid opening rejection;
- Undo/Redo;
- compact-room label readability assertion.

## 10. Existing regressions that must remain green

The correction may not break:

- furniture-only rigid group movement;
- room-only free-interior drag;
- `Выбрать мебель в комнате` explicit selection semantics;
- room/structure Copy/Paste;
- pointer-anchored composite Paste;
- wall/vertex movement;
- opening preservation during host-wall structural movement;
- snapping + Alt/Option suppression;
- M2 fit/collision/door/clearance checks;
- recognition benchmark;
- project/document persistence.

## 11. Non-goals

This slice does not add:

- implicit room ownership of furniture;
- moving multiple rooms as one group;
- arbitrary room/composite rotation or scaling;
- opening re-host across walls;
- opening width/swing editing by drag;
- automatic opening collision repair;
- multi-floor editing;
- new materials/catalogue/3D functionality;
- recognition changes;
- document schema migration.

## 12. Delivery and acceptance gate

Implementation may begin only after this written spec is reviewed by the product owner.

After approval:

1. create a detailed TDD implementation plan;
2. record genuine RED for the exact screenshot path before the routing fix;
3. implement gesture arbitration minimally;
4. create independent RED/GREEN for hosted-opening movement;
5. create independent RED/GREEN for room-label layout;
6. run full CI, recognition benchmark, typecheck, lint and build;
7. run fresh Chromium + representative WebKit browser acceptance on the exact head;
8. synchronize `PROJECT_STATE`, `ROADMAP`, UX roadmap, focused changelog, PR #87 and issue #56;
9. require focused product-owner PASS for the new scenarios;
10. only then create the M8.2 acceptance record, run accepted-head gates, mark Ready and proceed to the separately protected squash-merge step.

Green automation alone does not mark M8.2 accepted.
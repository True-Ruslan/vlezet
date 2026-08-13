# M8.2 correction — precise room selection and editor-like clipboard semantics

**Date:** 2026-08-11  
**Status:** PRODUCT DIRECTION APPROVED / WRITTEN SPEC FOR REVIEW  
**Parent milestone:** M8.2 Precision Drawing and Structural Editing  
**Implementation PR:** #87

## 1. Problem statement

Focused product-owner testing of the M8.2 structural clipboard exposed three related interaction problems that should be corrected before M8.2 acceptance.

1. Clicking inside a small room can occasionally select a larger concave room instead.
2. Paste currently uses a fixed offset from the copied source instead of the position indicated by the Canvas pointer.
3. Copy is still family-specific. A mixed explicit selection such as one room plus several furniture objects is rejected, so the previous clipboard payload can remain active and a subsequent Paste can insert stale content.

The product rule is explicit:

> Copy exactly what the user explicitly selected. Do not silently include furniture just because it lies inside a selected room.

A room click remains useful as a semantic room-selection shortcut, but it must be geometrically correct and visually understandable.

## 2. Root causes confirmed in the current implementation

### 2.1 Concave-room hit testing

Point selection currently routes a zero-size rectangle through `polygonIntersectsRect`. That helper uses a separating-axis test against all polygon edges. This is suitable for convex polygons but is not a correct point-in-polygon test for a concave room polygon.

A large L-shaped room can therefore report a hit for a point lying in its cut-out, competing with the smaller real room under the pointer.

### 2.2 Paste has no Canvas pointer anchor

The central keyboard command currently calls structural/object paste with `copiedAtOrigin + 200 mm`. `ApartmentEditor` has no authoritative world-space pointer position at command time, so Paste cannot behave like a normal visual editor.

### 2.3 Clipboard payloads are mutually exclusive by family

Current Copy supports:

- placed objects only;
- walls only;
- one derived room only.

Mixed selection is capability-disabled. A rejected `Cmd/Ctrl+C` does not replace the previous payload, so `Cmd/Ctrl+V` can insert an older wall/object payload and appear to ignore the latest selection.

## 3. Goals

This correction must deliver:

1. deterministic and correct room point hit-testing for concave rooms;
2. Paste anchored to the Canvas pointer rather than to the source object;
3. one semantic clipboard payload for supported explicit mixed selections;
4. exact preservation of relative positions between all copied components;
5. one atomic history command per successful Paste;
6. no stale-payload surprise after an unsupported Copy attempt;
7. unchanged structural topology/opening validation authority;
8. real Chromium and representative WebKit regression coverage.

## 4. Non-goals

This slice does **not** introduce:

- automatic copying of every furniture object located inside a selected room;
- room Cut/destructive shared-topology semantics;
- arbitrary graphical group scaling;
- standalone Copy of a vertex or a hosted opening without its structural owner;
- multi-room structural merge semantics;
- changes to recognition, M2 fit authority or persistent document schema.

Multi-room copy can be designed later once shared-boundary de-duplication has an explicit contract.

## 5. Approaches considered

### A. Minimal patch: fix room hit-test and cursor Paste only

Pros:

- smallest implementation;
- low regression surface.

Cons:

- does not solve the product-owner requirement that an explicit room + furniture selection copy as one group;
- stale clipboard behavior remains possible.

**Rejected.** It treats symptoms but leaves the selection model inconsistent with normal editor expectations.

### B. Recommended: semantic composite clipboard

Keep the existing structural and placed-object payload authorities, but add a composite editor payload that owns one shared copy anchor and can contain both families.

Pros:

- preserves existing domain/geometry/editor-core boundaries;
- supports the requested room + furniture and walls + furniture cases;
- preserves relative geometry exactly;
- can remain atomic and fail closed;
- avoids flattening apartment semantics into generic shapes.

Cons:

- requires careful propagation of the actual structural placement delta when structural safe-placement fallback is used.

**Selected.**

### C. Flatten every selected entity into generic Canvas geometry

Pros:

- conceptually similar to generic vector editors.

Cons:

- destroys wall/opening/room semantics;
- risks parallel geometry authority;
- incompatible with Vlezet architecture.

**Rejected.**

## 6. Detailed design

### 6.1 Correct room point selection

Add a renderer-independent, boundary-inclusive point-in-polygon primitive in `@vlezet/geometry`.

Requirements:

- works for convex and concave simple polygons;
- points on an edge or vertex count as inside within the existing geometry epsilon;
- deterministic for horizontal/vertical edges;
- no Canvas/Konva dependency.

`entitiesAtPoint` will keep the existing concrete-entity priority:

1. opening;
2. placed object;
3. visible wall;
4. room.

Rooms will be tested with the new point-in-polygon primitive rather than SAT rectangle intersection. If numerical ambiguity produces more than one room candidate, the smaller-area containing room wins, with stable document order as the final tie-breaker.

Marquee behavior remains unchanged: room interiors are not implicitly added by rectangular marquee; room selection stays a direct point-selection semantic.

### 6.2 Room selection affordance

When the pointer is over empty room interior in Select mode and no higher-priority concrete entity is under it, the room receives a subtle hover treatment using the existing visual-state vocabulary.

The affordance must be restrained:

- no persistent fill change;
- no geometry mutation;
- no new modal state;
- room label remains readable;
- selected room remains visually stronger than hovered room.

This makes the click-inside-room shortcut discoverable without turning room fill into a separate editing layer.

### 6.3 Canvas pointer as Paste anchor

The editor runtime will retain the latest finite world-space pointer position observed over the 2D Canvas.

This is ephemeral UI/runtime state only; it is never persisted in `VlezetDocument` or project storage.

Paste semantics:

- first Paste uses the current/latest Canvas pointer world point as the requested group anchor;
- no hidden `+200 mm` source-relative offset is applied by the keyboard command;
- if no pointer has ever been observed for the current editor session, fallback is the copied group anchor so Paste remains deterministic rather than failing silently;
- Duplicate remains a separate command and may retain deterministic offset behavior.

For any payload, the logical copied group anchor is the center of the union of its selected physical bounds. Pasting translates the complete copied selection so this group anchor lands on the requested Canvas pointer.

For structural payloads the existing internal structural `origin` remains available for ID remapping and geometry translation; the editor-level copy anchor is separate and must not redefine structural geometry authority.

### 6.4 Composite clipboard payload

Introduce an editor-level payload variant conceptually equivalent to:

```text
composite
  copyAnchor
  structural?      // existing structural clipboard payload
  placedObjects?   // existing placed-object clipboard payload
```

The composite payload is only an editor transport snapshot. It is not persisted in the apartment document.

Supported explicit selection families for this correction:

- any non-empty placed-object selection;
- any wall selection already valid for non-destructive Copy;
- exactly one room;
- wall selection + any placed objects;
- exactly one room + any placed objects.

Unsupported roots remain fail-closed:

- room + explicit wall roots in the same Copy;
- more than one room;
- standalone opening/vertex roots;
- other mixed semantic families without an explicit safe projection contract.

These unsupported cases must return a visible reason rather than pretending Copy succeeded.

### 6.5 “Exactly what is selected” rule

Room Copy means:

- room structural shell derived from its exact `PlanarFace`;
- hosted doors/windows belonging to that shell;
- explicit room annotation/name if present.

It does **not** automatically inspect spatial containment and add furniture.

Furniture is added to the payload only when those placed objects are explicit members of the editor selection.

Examples:

```text
room only
→ room shell + hosted openings + room name

room + sofa + table
→ room shell + hosted openings + room name + sofa + table

room containing sofa, but sofa not selected
→ sofa is not copied
```

### 6.6 Atomic composite Paste

Composite Paste must preserve one rigid relative transform across structural and placed-object components.

Algorithm:

1. compute requested translation from copied group anchor to Canvas pointer anchor;
2. if a structural component exists, ask `@vlezet/editor-core` to paste/validate it using the unchanged complete-candidate validator;
3. if structural safe-placement fallback selects a nearby valid translation, expose the **actual applied translation** in the paste result;
4. apply that exact same translation to all copied placed objects;
5. construct one final document candidate;
6. commit one semantic `document/replace` history operation;
7. select the complete newly pasted group.

If no structurally valid placement exists, no placed objects are added either. The operation is all-or-nothing.

Objects-only Paste uses the requested pointer translation directly.

### 6.7 Structural safe-placement remains authoritative

The existing bounded nearby-placement fallback remains allowed for structural Paste when the exact requested pointer position intersects existing structure.

Important constraints:

- every candidate still passes the same topology/opening validator;
- no silent clipping, re-hosting or partial insertion;
- if fallback moves the structural component, the whole composite group follows the same delta;
- exact low-level paste requests used by validation tests can continue to assert fail-closed overlap behavior.

### 6.8 Rejected Copy must not lead to stale Paste surprise

Copy becomes an explicit result-producing operation.

A successful Copy atomically replaces the editor clipboard.

An unsupported/rejected Copy:

- clears the Vlezet internal clipboard payload for the current editor session;
- records a human-readable rejection reason for transient UI feedback;
- disables Paste until a later successful Copy.

This intentionally prefers predictable local behavior over retaining an older hidden payload after the user explicitly attempted to copy a different selection.

The OS clipboard is not modified by this editor-internal behavior.

## 7. Architecture boundaries

### `@vlezet/geometry`

Owns:

- point-in-polygon math;
- pure geometric helpers only.

Does not own selection state or clipboard policy.

### `@vlezet/editor-core`

Owns:

- structural room/wall projection;
- structural paste candidate validation;
- actual applied structural translation returned from validated paste;
- topology/opening fail-closed behavior.

### `apps/web`

Owns:

- editor selection interpretation;
- composite clipboard orchestration;
- ephemeral Canvas paste anchor;
- command capabilities and transient rejection feedback;
- room hover affordance;
- one history command around the final accepted composite document.

`VlezetDocument` remains the only persistent plan truth.

## 8. Error handling

The following produce no document/history mutation:

- non-finite pointer anchor;
- unsupported mixed selection;
- more than one room selected for Copy;
- standalone opening/vertex Copy root;
- room projection ambiguity;
- structural paste validation failure with no safe nearby candidate;
- ID collision/fresh-ID generation failure.

No error path may leave only furniture or only part of the structural selection pasted.

## 9. TDD plan requirements

Implementation must follow genuine RED → observed intended failure → GREEN for each behavior.

### Geometry RED

Create a concave L-shaped room plus a smaller room in its cut-out.

Assert:

- point in the small room does not hit the L-shaped room;
- point in each L-shaped arm does hit the large room;
- boundary points are deterministic.

### Selection RED

Reproduce the screenshot failure class through `entitiesAtPoint` and browser interaction:

- repeated click in small room selects the small room every time;
- large room is never selected from the cut-out point;
- higher-priority furniture/wall/opening still wins when directly under the pointer.

### Pointer Paste RED

Assert keyboard Paste uses the latest Canvas world pointer, not `copiedAtOrigin + 200`.

For two selected furniture objects, verify their relative vector is unchanged after Paste.

### Composite clipboard RED

Cover:

- room + two selected furniture objects copies as one payload;
- unselected furniture inside that room is not copied;
- walls + furniture copies as one payload;
- rejected unsupported Copy cannot leave the previous wall payload pasteable.

### Atomic structural fallback RED

Construct a room + furniture composite whose requested cursor position collides structurally and forces safe-placement fallback.

Assert:

- structural shell moves to the validated fallback;
- furniture receives exactly the same applied delta;
- one Undo removes the full group;
- one Redo restores the full group.

### Browser acceptance

Chromium full flow and representative WebKit must exercise:

1. concave-room/small-room click targeting;
2. visible room hover affordance;
3. copy two furniture items, move pointer far away, Paste at pointer;
4. copy one room + explicit furniture, move pointer, Paste as one rigid group;
5. verify furniture inside room but not selected is absent from copy;
6. Undo/Redo composite Paste in one semantic step;
7. attempt an unsupported Copy after a valid wall Copy, then verify Paste does not insert stale wall content;
8. structural cursor collision either resolves to a safe nearby rigid placement or performs no mutation.

## 10. Acceptance criteria

This correction is complete only when all are true:

- the reported wrong-room selection class is deterministically covered and fixed;
- Paste target follows Canvas pointer position;
- room + explicitly selected furniture pastes as one rigid group;
- walls + explicitly selected furniture pastes as one rigid group;
- unselected furniture is never silently included by room Copy;
- stale clipboard content cannot be pasted after a rejected Copy attempt;
- structural validation remains unchanged/fail-closed;
- one successful Paste equals one history step;
- unit/typecheck/lint/build/recognition gates are green;
- Chromium and WebKit acceptance are green;
- product-owner performs a focused retest before M8.2 acceptance/merge.

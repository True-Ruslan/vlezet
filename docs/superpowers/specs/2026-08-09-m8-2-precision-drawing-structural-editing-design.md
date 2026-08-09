# M8.2 — Precision Drawing and Structural Editing Design

**Date:** 2026-08-09  
**Status:** product direction approved; written specification pending final product-owner review  
**Programme:** M8 Public Beta Editor  
**Tracker:** #56  
**Dependency:** M8.1 is merged into `main` via squash commit `867ec54d21b1dcb94d519ace3bec0a3635717022`.

## 1. Goal

Make exact apartment structure creation, repair and batch editing fast enough to stay on the Canvas while preserving Vlezet's structural authority.

The target outcome is not “more CAD features”. It is a small, predictable precision layer for a non-professional apartment owner or buyer:

- direct manipulation for ordinary work;
- exact millimetre/angle input when precision matters;
- visible, named snapping rather than invisible magnetic behaviour;
- topology-aware structural gestures rather than graphical transforms;
- deterministic, atomic history;
- fail-closed handling when topology or hosted-opening validity cannot be proven.

M8.2 is the next dependency for `BETA-01 Blank` and for later `BETA-02 Reference` tracing/calibration work.

## 2. Non-negotiable authority

M8.2 does not change the existing product architecture:

1. `VlezetDocument` remains the only persistent apartment/layout truth.
2. Millimetres remain canonical; screen pixels remain runtime-only.
3. `@vlezet/geometry` owns pure geometric calculations and snap resolution.
4. `@vlezet/editor-core` owns authoritative structural mutations and validation.
5. Konva remains a projection/gesture surface, never geometry authority.
6. Rooms and areas remain derived.
7. Openings remain hosted by validated walls.
8. One committed user gesture produces one semantic history operation.
9. Unsafe structural changes fail closed before document mutation.
10. No silent topology repair, split, merge or arbitrary graphical scaling is introduced.
11. Core editing remains local-first and requires no network/AI provider.
12. M8.2 requires no project-schema migration; precision input, snap state, structural clipboard and gesture previews remain runtime-only.

## 3. Design choices approved by the product owner

### 3.1 Structural clipboard — strict fail-closed dependency closure

Structural Copy/Cut/Paste does not silently enlarge the user's selection and never mutates a compatible subset of an unsafe selection.

The initial M8.2 clipboard path is deliberately strict:

- only a topologically closed structural fragment may be copied or cut;
- the payload contains all vertices, junction metadata and hosted openings required by that fragment;
- a selected opening requires its host wall to be inside the same closure;
- a selected structural fragment is rejected if it depends on structural entities outside the closure in a way that would change its semantics after copy/cut;
- unsupported mixed furniture + structural clipboard operations remain disabled;
- errors explain the missing dependency instead of silently changing selection.

This is intentionally more conservative than a general drawing editor. A broader “extract selected walls as a detached fragment” operation may be designed later if product evidence justifies it.

### 3.2 Structural movement — contextual topology-safe movement

Two direct manipulation intents are distinct:

- dragging an endpoint/junction edits that concrete topological vertex;
- dragging the body of a wall requests a rigid parallel translation of the target wall.

Wall-body translation may move only the mandatory vertices needed to keep that wall rigid. Incident walls may consequently stretch/rotate through shared vertices, but the transaction is accepted only when the complete affected dependency closure remains valid.

If satisfying the request would require guessing which unrelated wall/subgraph should also be moved, the gesture is blocked rather than escalating into an implicit whole-subgraph move.

Examples:

- isolated wall: translate both endpoints → allowed;
- ordinary corner: translate the selected wall; shared endpoint moves, adjacent wall reshapes → allowed if valid;
- T-junction hosted on selected wall: host junction moves with the wall, branch endpoint follows → allowed if all affected geometry remains valid;
- selected wall endpoint is itself constrained to an unrelated host wall and the requested translation leaves that host axis: block unless the requested delta itself preserves the host constraint;
- any affected wall collapses/reverses, any required junction leaves its host, or any opening no longer fits: block atomically.

### 3.3 Exact wall input — near-cursor dynamic dimensions

After the first point of a new wall is established, a compact dynamic input appears near the active draft endpoint.

It exposes two user-facing physical values:

- `Длина`, millimetres;
- `Угол`, degrees.

Interaction contract:

- ordinary pointer movement continues to control the preview;
- typing a numeric value locks the currently focused dimension without committing prematurely;
- `Tab` moves focus `Длина → Угол`;
- `Shift+Tab` moves focus backwards;
- `Enter` commits the current valid wall;
- first `Esc` exits/cancels active numeric editing while preserving the wall draft when possible;
- a subsequent `Esc` cancels the wall draft according to the editor's normal cancellation model;
- invalid/non-finite/zero length never commits and is explained beside the input;
- the inspector remains the exact numeric path after creation;
- users who never type a number can continue drawing entirely with the pointer.

The UI deliberately borrows the proven “dynamic dimension near the working point” pattern from mature CAD tools without importing command-line syntax, polar-coordinate notation or other expert-only vocabulary.

User-facing angle convention follows the displayed Canvas direction: `0°` points right; increasing values follow the Canvas/world orientation used by the renderer. The implementation must use one shared conversion/formatting helper so preview, input and persisted endpoint coordinates cannot disagree.

## 4. UX and accessibility contract

M8.2 targets WCAG 2.2 AA where criteria apply to the editor surface and follows WAI-ARIA keyboard-interface conventions for interactive controls.

### 4.1 Dragging must have an alternative

Direct vertex/wall drag is an accelerator, not the only way to achieve structural editing.

Equivalent non-drag paths remain available through:

- exact wall length/angle input during creation;
- existing inspector numeric editing for committed walls;
- common multi-wall thickness editing through the multi-selection inspector;
- explicit commands for structural clipboard operations.

This is required by the product contract and aligns with WCAG 2.2 SC 2.5.7 Dragging Movements.

### 4.2 Target size and precision handles

Visible topology handles may remain visually small enough not to obscure the plan, but their interactive hit areas must satisfy a minimum 24×24 CSS px target or an allowed spacing/equivalent-control exception.

For primary endpoint/junction manipulation, M8.2 should normally use an invisible enlarged hit target around the visible handle rather than relying on an exception. This follows WCAG 2.2 SC 2.5.8 Target Size (Minimum).

### 4.3 Keyboard and focus

- All dynamic-input fields are reachable and operable by keyboard.
- Focus order is deterministic and never escapes into hidden Canvas internals.
- Focus is visibly distinct from ordinary selection.
- The near-cursor input is positioned so focused controls are not fully obscured by authored UI (WCAG 2.2 SC 2.4.11).
- Existing browser/system/assistive-technology shortcuts are not replaced unnecessarily.
- Any temporary snap modifier is an accelerator; a visible toggle/control remains the discoverable alternative.

### 4.4 Error presentation

A failed structural transaction does not erase the user's draft or silently “repair” it.

The user receives a concise reason near the interaction surface and, where useful, in the inspector/status feedback. Error text describes the violated semantic constraint rather than implementation vocabulary.

Examples:

- `Перемещение разорвёт соединение со стеной`;
- `Проём выйдет за пределы стены`;
- `Для копирования выберите весь связанный фрагмент`;
- `Длина стены должна быть больше 0 мм`.

## 5. Structural snap model

M8.2 replaces scattered Canvas snap decisions with one pure semantic snap resolver.

### 5.1 Snap result

The result is richer than the current `SnapResult` and contains both geometry and explanation:

```ts
type StructuralSnapKind =
  | "endpoint"
  | "junction"
  | "midpoint"
  | "intersection"
  | "wall-axis"
  | "parallel"
  | "perpendicular"
  | "horizontal"
  | "vertical"
  | "grid"
  | "none";

type StructuralSnapResult = Readonly<{
  point: Point2;
  kind: StructuralSnapKind;
  label: string | null;
  guides: readonly StructuralSnapGuide[];
  target: StructuralSnapTarget | null;
}>;
```

The exact TypeScript shape may be refined during the implementation plan, but the semantic fields above are required.

### 5.2 User-facing names

Russian labels are stable product vocabulary:

- `Конечная точка`;
- `Соединение`;
- `Середина`;
- `Пересечение`;
- `По стене`;
- `Параллельно`;
- `Перпендикулярно`;
- `Горизонталь`;
- `Вертикаль`;
- `Сетка`.

A snap is communicated through all of:

1. authoritative preview position;
2. minimal geometric guide/marker;
3. short text label.

The guide is informational only; the `StructuralSnapResult.point` remains the one preview input.

### 5.3 Deterministic priority

Within the normal acquisition radius, the default priority is:

```text
existing endpoint/junction
> midpoint
> eligible intersection
> wall-axis
> perpendicular/parallel
> horizontal/vertical
> grid
> raw pointer
```

Rules:

- semantic structural points outrank construction aids;
- same-priority candidates use smallest screen-space distance;
- remaining ties use stable document/entity order or stable IDs, never object iteration accidents;
- a higher-priority candidate inside acquisition tolerance may replace the active snap immediately;
- a same-priority candidate replaces the active snap only when materially closer, preventing cursor-threshold flicker.

### 5.4 Hysteresis

The current 12 CSS px acquisition concept is preserved as the initial baseline. The resolver keeps the active candidate through a larger release radius (initial design target: 18 CSS px) so small pointer jitter does not alternate between adjacent snap targets.

The exact constants are implementation details only after deterministic browser tests prove they are stable; tests must assert the behavioural invariant (no snap flapping around thresholds), not encode arbitrary visual tuning where unnecessary.

### 5.5 Intersection safety

M8.2 does **not** silently split two existing walls merely because their centrelines cross.

An intersection may become a commit-capable snap target only when it maps to an existing topological vertex/junction or when the current creation operation can materialise one unambiguous host-wall junction through existing editor-core semantics.

A geometric crossing that would require repairing/splitting multiple existing walls is not offered as an authoritative commit target in M8.2. This preserves the no-silent-topology-repair contract.

### 5.6 Parallel/perpendicular assistance

Parallel/perpendicular guidance is relative to a deterministic nearby reference wall and affects only the current draft/gesture preview.

- it never changes existing geometry on its own;
- an exact endpoint/junction/wall target always outranks an angular construction guide;
- the user may override the inferred angle with exact numeric input;
- when no single reference wall is dominant inside the search policy, the angular aid abstains rather than flickering between references.

Horizontal/vertical assistance remains available even without a reference wall.

### 5.7 Snap suppression

A visible Snap control is the discoverable source of truth for whether structural snapping is enabled.

A temporary keyboard modifier may suppress snapping while held during a pointer gesture. The initial preferred modifier is `Alt/Option` because M8.1 already reserves Shift/Cmd/Ctrl for selection semantics; the implementation plan must verify browser/macOS/Windows conflicts before locking the shortcut.

The modifier is never the only way to disable snapping.

## 6. Structural transaction layer

M8.2 introduces an authoritative transaction boundary in `@vlezet/editor-core` instead of letting Canvas handlers compose low-level mutations ad hoc.

Conceptually:

```text
Structural intent
      ↓
resolve dependency closure
      ↓
construct complete candidate document
      ↓
validate topology + junctions + hosted openings
      ↓
ACCEPT: one document result
REJECT: no mutation + semantic reason
```

Representative intents:

```ts
type StructuralEditIntent =
  | { kind: "move-vertex"; vertexId: string; position: Point2 }
  | { kind: "translate-wall"; wallId: string; delta: Point2 }
  | { kind: "set-wall-thickness-batch"; wallIds: readonly string[]; thicknessMm: number }
  | { kind: "paste-structural-fragment"; payload: StructuralClipboardPayload; anchor: Point2 };
```

The public implementation may use separate functions rather than one union API. The required property is the transaction boundary: closure and validation occur before a new document is returned.

### 6.1 Validation invariants

Every accepted structural transaction must preserve:

- finite coordinates;
- non-zero wall lengths;
- non-reversed/collapsed affected walls;
- valid references to all vertices/walls;
- every declared junction lying on its host wall interior according to existing tolerance rules;
- every hosted opening fitting entirely on its host wall;
- no dangling opening host;
- no partial mutation if any affected entity fails validation;
- deterministic output independent of incidental array mutation/order.

Existing validation thresholds are reused, not weakened to make new gestures pass.

### 6.2 Opening policy by operation

Opening preservation is explicit per edit type:

- rigid wall translation: opening offsets remain unchanged, so openings translate with the host wall;
- endpoint/junction drag: stored host-local offset is preserved; the transaction is rejected if the opening no longer fits after the wall changes;
- existing explicit wall-length command keeps its already accepted anchor/offset behaviour unless a separate regression demonstrates inconsistency;
- batch centred thickness change does not alter opening offset/width;
- clipboard copy/paste preserves opening kind, width, swing and relative wall offset with fresh IDs/host IDs.

No gesture re-hosts an opening onto another wall automatically.

## 7. Direct vertex and junction editing

### 7.1 Visibility

Vertices do not become permanent visual clutter.

In Select mode:

- selecting a wall reveals its start/end handles;
- relevant junction handles on that wall are revealed;
- a shared endpoint/junction can become the semantic primary selection during direct manipulation;
- handles use screen-stable visual size and larger accessible hit areas.

### 7.2 Gesture lifecycle

Vertex editing follows preview/commit semantics:

```text
pointer down on handle
→ begin structural gesture from immutable before-document
→ pointer move resolves structural snap + transaction preview
→ Canvas renders preview only
→ pointer up validates/commits one semantic command
→ Escape/pointer-cancel restores before-document with no history entry
```

A rejected preview remains visually distinguishable and cannot commit.

### 7.3 Shared vertices

A vertex is one topological entity. Moving a shared vertex therefore changes every incident wall through that same vertex; Vlezet must not duplicate the vertex merely to make a drag succeed.

The complete affected set is validated before commit.

## 8. Wall-body translation

Dragging a selected wall body in Select mode requests a rigid translation of that wall, not an arbitrary move of an independent line segment.

Required behaviour:

1. target wall start/end and its hosted junction vertices receive the same requested delta;
2. the target wall therefore preserves length and angle exactly;
3. incident walls sharing moved vertices are deterministically reshaped;
4. junction/host constraints are checked across the affected closure;
5. openings are revalidated according to the policy above;
6. if any invariant fails, the preview is invalid and pointer-up commits nothing;
7. a successful drag is exactly one semantic history operation.

This is intentionally different from M8.1 placed-object batch movement. Structural geometry is never treated as a free graphical group.

## 9. Multi-wall common-property editing

M8.2 fulfils the product-owner request to edit common properties of multiple selected walls, beginning with wall thickness.

Initial supported operation:

- selection contains two or more walls and nothing outside the supported structural set;
- inspector shows shared/varied thickness state;
- entering one valid thickness applies it to every selected wall atomically;
- M8.2 batch thickness uses **centre alignment only**.

Centre alignment is deliberate: left/right-face preservation across walls with different directions and room-side semantics is ambiguous. Existing single-wall alignment options remain available in the single-wall inspector. Batch face-aligned thickness is deferred until a separate semantic design exists.

No wall is changed if any selected wall cannot accept the requested property update.

## 10. Structural clipboard

### 10.1 Runtime payload

The structural clipboard is versioned runtime state, separate from project persistence.

Conceptually it contains:

- selected wall definitions;
- complete required vertex set;
- required junction relationships;
- hosted openings inside the closed fragment;
- fragment-local origin/bounds for deterministic paste placement;
- no project-specific IDs that may be reused on paste.

### 10.2 Closure evaluator

A pure evaluator returns either:

```ts
{ ok: true, closure: ... }
```

or

```ts
{ ok: false, reason: ... }
```

It never changes selection.

The evaluator is the shared authority for:

- command enabled/disabled state;
- explanatory UI reason;
- Copy;
- Cut;
- Duplicate;
- Paste validation.

### 10.3 Paste

Paste creates fresh IDs for every wall, vertex and opening, preserves internal topology exactly, applies only a rigid translation to the fragment and validates the complete resulting document before commit.

If the fragment would create an invalid structural state, paste does not partially add anything.

Repeated paste may reuse the M8.1 deterministic offset model at the viewport layer, but the structural fragment itself remains rigid.

## 11. Web/editor integration boundaries

The Canvas layer owns only runtime interaction state:

- active structural gesture;
- current pointer position;
- current snap result/guides;
- current dynamic-input focus/value;
- preview validity/rejection reason.

The store may coordinate these states, but committed geometry is still produced only by editor-core transactions.

Recommended module boundaries for the implementation plan:

- `packages/geometry` — pure structural snap candidate generation/resolution and guide geometry;
- `packages/editor-core` — structural dependency closure, transaction functions and clipboard validation;
- `apps/web/components/editor` — gesture lifecycle, dynamic input model, guide/handle rendering and command integration;
- existing command/history system — one command per accepted gesture;
- existing inspector — exact post-creation editing and multi-wall thickness UI.

The final filenames are chosen during the implementation plan after inspecting neighbouring modules; no monolithic `editor-canvas.tsx` expansion is accepted merely for convenience.

## 12. Performance and determinism

Pointer movement is latency-sensitive.

Design rules:

- static snap candidates derived from the committed/preview document are memoised per relevant document revision;
- pointer-move resolution is pure and does not mutate the document;
- expensive pairwise intersection work is cached/pruned instead of recomputed through React state on every event;
- stable tie-breaking prevents nondeterministic behaviour from array/set iteration;
- guide rendering is bounded to the active/relevant candidate rather than drawing every possible guide;
- no network call participates in any structural gesture.

Performance optimisations may not change snap semantics silently. Behavioural tests remain authoritative.

## 13. Testing strategy

Every deterministic behaviour change follows genuine RED → observed intended failure → minimal GREEN → neighbouring/full regression.

A test that already passes is not recorded as RED evidence.

### 13.1 Geometry unit tests

Required table-driven coverage:

- endpoint/junction/midpoint/wall-axis candidates;
- eligible intersection behaviour and unsafe crossing abstention;
- parallel/perpendicular/horizontal/vertical construction aids;
- deterministic priority and stable tie-breaking;
- acquisition/release hysteresis under pointer jitter;
- snap suppression;
- zoom-independent CSS-pixel tolerance conversion;
- no mutation of input geometry.

### 13.2 Editor-core structural authority tests

Required coverage:

- terminal vertex move;
- shared-corner vertex move;
- hosted T-junction move;
- invalid move off host wall rejects atomically;
- rigid wall translation preserves target length/angle;
- incident wall reshape remains connected;
- collapsed/reversed affected wall rejects;
- openings remain hosted and valid or the entire edit rejects;
- multi-wall centred thickness applies atomically;
- one invalid member rejects whole batch;
- closed structural clipboard closure accepted;
- incomplete closure rejected with deterministic reason;
- paste generates fresh IDs and exact internal topology;
- invalid paste adds nothing;
- inputs/documents are not mutated in-place.

### 13.3 Store/history tests

For every committed gesture:

- preview creates no history entry;
- commit creates exactly one entry;
- cancel creates none;
- Undo restores byte-equivalent structural state where ordering semantics permit;
- Redo restores the accepted result;
- rejected transaction leaves history/document unchanged;
- selection sanitises predictably after Cut/Paste/Undo/Redo.

### 13.4 Component/accessibility tests

Required:

- dynamic input keyboard focus/Tab/Shift+Tab/Enter/Escape;
- invalid numeric values and error association;
- visible focus styling contract;
- endpoint/junction hit area at least the required target size unless a documented equivalent-control exception applies;
- snap labels use stable product vocabulary;
- batch thickness mixed/unsupported states are clearly disabled;
- no hidden shortcut is required to complete a supported operation.

### 13.5 Browser acceptance

Chromium full flow plus representative WebKit coverage must include:

1. draw a wall by pointer only;
2. draw a wall with exact length + angle through dynamic input;
3. snap to endpoint, midpoint and wall axis while labels/guides match the committed result;
4. jitter around a snap threshold without preview flapping/drift;
5. drag a normal endpoint/junction and verify exact Undo → Redo → Undo;
6. translate a structurally safe wall and verify connected geometry/openings;
7. attempt one unsafe structural translation and prove no partial mutation/history entry;
8. multi-select walls and set common thickness atomically;
9. copy/paste one valid closed structural fragment with fresh IDs;
10. attempt an incomplete structural clipboard selection and prove fail-closed behaviour;
11. keyboard-only dynamic input path;
12. post-commit screenshot/geometry assertions for representative precision states.

Browser tests must assert semantic geometry/state in addition to screenshots. Green screenshots alone do not prove structural correctness.

## 14. Acceptance scenarios

Product-owner manual acceptance should be small because deterministic coverage does the heavy lifting.

Recommended focused manual gate:

- **M8.2-PO-01 Precision draw:** create a small L-shaped room using pointer + exact length/angle and observe clear snap feedback.
- **M8.2-PO-02 Junction edit:** move a shared corner/T-junction and verify the result feels predictable and remains connected.
- **M8.2-PO-03 Wall move:** translate a safe wall, then try an intentionally unsafe wall and confirm the latter is blocked clearly.
- **M8.2-PO-04 Batch thickness:** select multiple walls and set one common thickness.
- **M8.2-PO-05 Structural clipboard:** copy/paste one supported closed fragment; verify an incomplete fragment is rejected rather than guessed.

The product owner should not need to manually re-test every edge case already deterministically covered by unit/browser suites.

## 15. Explicitly deferred

M8.2 does not include:

- silent split/merge/repair of arbitrary wall crossings;
- arbitrary structural group scaling;
- whole connected-component movement as an implicit fallback;
- batch left/right-face thickness alignment;
- general-purpose CAD command line or coordinate syntax;
- persisted snap preferences/clipboard unless later evidence requires them;
- source-image snapping/calibration improvements (M8.3/M8.4);
- automatic whole-plan recognition;
- furniture resize/alignment/distribution (M8.5);
- export/theme work (M8.6).

## 16. Standards and product-pattern evidence

The design is informed by authoritative accessibility guidance and established spatial-editor interaction patterns, while keeping Vlezet intentionally simpler than professional CAD.

Primary references reviewed on 2026-08-09:

- WCAG 2.2 — SC 2.5.7 Dragging Movements: https://www.w3.org/WAI/WCAG22/Understanding/dragging-movements
- WCAG 2.2 — SC 2.5.8 Target Size (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum
- WCAG 2.2 — SC 2.4.11 Focus Not Obscured (Minimum): https://www.w3.org/WAI/WCAG22/Understanding/focus-not-obscured-minimum
- WAI-ARIA APG — Developing a Keyboard Interface: https://www.w3.org/WAI/ARIA/apg/practices/keyboard-interface/
- Autodesk AutoCAD — Dynamic Input / dynamic dimensions near cursor, distance + angle and `Tab` navigation: https://help.autodesk.com/cloudhelp/2025/ENU/AutoCAD-Core/files/GUID-38EC86CF-D96A-455F-A5DE-2CDA23C28FC4.htm
- Autodesk AutoCAD Architecture — Dynamic Dimensions and `Tab` / `Shift+Tab` / `Enter`: https://help.autodesk.com/cloudhelp/2026/ENU/AutoCAD-Architecture/files/GUID-304D9844-4B1C-4ACA-A2BF-9C50FBA015B5.htm
- Autodesk Fusion — object snap concepts including endpoint, midpoint and intersection: https://help.autodesk.com/view/fusion360/ENU/?contextId=DWG-OBJECT-SNAPS

These sources are precedent/evidence, not authority over Vlezet's apartment semantics. Where CAD conventions conflict with Vlezet's non-professional audience or topology safety, Vlezet's product contract wins.

## 17. Definition of design complete

The design is ready for an implementation plan when the product owner confirms this written specification and no unresolved semantic ambiguity remains around:

- snap priority/hysteresis;
- exact length/angle input;
- direct vertex/junction editing;
- contextual wall-body movement;
- opening preservation;
- centred batch thickness;
- strict structural clipboard closure;
- atomic history and fail-closed errors;
- accessibility/browser acceptance obligations.

After approval, the next step is a task-by-task TDD implementation plan. Production code must not begin from this design document without that plan.
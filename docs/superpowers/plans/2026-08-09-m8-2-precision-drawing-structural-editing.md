# M8.2 Precision Drawing and Structural Editing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver M8.2 so a non-CAD user can draw, repair and batch-edit exact apartment structure directly on the Canvas with visible named snapping, exact length/angle input, topology-safe vertex/wall manipulation, atomic multi-wall thickness editing and conservative structural clipboard operations, without weakening Vlezet's document, topology, opening or history authority.

**Architecture:** `VlezetDocument` remains sole persistent truth. `@vlezet/geometry` owns pure angle/snap resolution; `@vlezet/editor-core` owns complete structural candidate construction, dependency closure and validation; the web editor owns only runtime gesture/input/guide/clipboard coordination. A structural gesture previews an editor-core transaction result but writes history only once on a valid commit. Unsafe edits return a deterministic semantic rejection and never mutate the committed document. No project-schema migration is introduced.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5 vanilla stores, Konva/react-konva 10/19, Vitest 4, Playwright Chromium/WebKit, pnpm 11/Turborepo.

## Global Constraints

- `VlezetDocument` is the sole persistent apartment/layout truth.
- Millimetres are canonical. CSS/Konva pixels are converted to world tolerances only at the web boundary.
- `@vlezet/geometry` stays framework-independent and does not import React, Konva, Zustand or `@vlezet/domain`.
- `@vlezet/editor-core` is the only authority that accepts/rejects structural mutations.
- Konva/React collect intent and render previews; they never become geometry authority.
- Rooms/areas remain derived; hosted openings are never silently re-hosted.
- No silent wall split/merge/repair and no arbitrary structural group scaling.
- Structural clipboard is runtime-only and uses the approved strict wall-only closure contract.
- Cut uses exactly the same closure as Copy.
- Multi-wall thickness is centre-aligned only in M8.2.
- Canvas angle convention is `0° right / 90° down / 180° left / 270° up`, normalised to `[0,360)`.
- `Привязки` is the visible snap authority; Alt/Option is temporary gesture-local suppression only.
- Endpoint/junction interactive hit areas are at least 24×24 CSS px.
- Every supported drag result has a non-drag path.
- One committed structural gesture/operation creates exactly one semantic history entry.
- Preview/cancel/reject create no history entry.
- Existing topology/opening/recognition/M2 validation thresholds are not weakened.
- Every deterministic change follows genuine RED → observed intended failure → minimal GREEN → regression/refactor.
- Chromium covers the full representative flow; WebKit covers engine-sensitive pointer/focus/modifier paths.
- Acceptance and merge claims are recorded only after the corresponding event actually occurs.

---

## File map

### New geometry
- `packages/geometry/src/structural-angle.ts`
- `packages/geometry/src/structural-angle.test.ts`
- `packages/geometry/src/structural-snapping.ts`
- `packages/geometry/src/structural-snapping.test.ts`

### New editor-core
- `packages/editor-core/src/structural-editing.ts`
- `packages/editor-core/src/structural-editing.test.ts`
- `packages/editor-core/src/structural-clipboard.ts`
- `packages/editor-core/src/structural-clipboard.test.ts`

### New web modules/components
- `apps/web/components/editor/structural-snapping-settings-store.ts`
- `apps/web/components/editor/structural-snapping-settings-store.test.ts`
- `apps/web/components/editor/wall-dynamic-input-model.ts`
- `apps/web/components/editor/wall-dynamic-input-model.test.ts`
- `apps/web/components/editor/wall-dynamic-input.tsx`
- `apps/web/components/editor/wall-dynamic-input.test.tsx`
- `apps/web/components/editor/structural-handle-layer.tsx`
- `apps/web/components/editor/structural-handle-layer.test.tsx`
- `apps/web/components/editor/structural-snap-overlay.tsx`
- `apps/web/components/editor/structural-snap-overlay.test.tsx`

### Existing integration files
- `packages/geometry/src/index.ts`
- `packages/editor-core/src/index.ts`
- `packages/editor-core/src/commands.ts`
- `apps/web/components/editor/editor-store-foundation.ts`
- `apps/web/components/editor/use-editor-store.ts`
- `apps/web/components/editor/use-editor-store.test.ts`
- `apps/web/components/editor/editor-selection-capabilities.ts`
- `apps/web/components/editor/editor-selection-capabilities.test.ts`
- `apps/web/components/editor/editor-clipboard.ts`
- `apps/web/components/editor/editor-clipboard.test.ts`
- `apps/web/components/editor/multi-selection-inspector.tsx`
- `apps/web/components/editor/multi-selection-inspector.test.tsx`
- `apps/web/components/editor/editor-context-menu.tsx`
- `apps/web/components/editor/editor-context-menu.test.tsx`
- `apps/web/components/editor/editor-escape-priority.ts`
- `apps/web/components/editor/editor-escape-priority.test.ts`
- `apps/web/components/editor/editor-command-icon.tsx`
- `apps/web/components/editor/editor-toolbar.tsx`
- `apps/web/components/editor/editor-toolbar.test.tsx`
- `apps/web/components/editor/editor-canvas.tsx`
- `apps/web/components/editor/editor-canvas-source.test.ts`
- `apps/web/components/editor/editor-canvas-feedback.ts`
- `apps/web/components/editor/editor-canvas-feedback.test.ts`
- `apps/web/components/editor/editor-canvas-mode-status.tsx`
- `apps/web/components/editor/apartment-editor.tsx`
- `apps/web/app/globals.css`

### Browser/delivery
- `tools/m7-browser-audit/m8-precision-structural.spec.mjs`
- `tools/m7-browser-audit/playwright.config.mjs`
- `tools/m7-browser-audit/playwright.webkit.config.mjs`
- `docs/changelog/2026-08-09-m8-2-precision-drawing-structural-editing.md`
- `docs/milestones/m8-2-acceptance.md` only after explicit product-owner acceptance.

---

## Task 0: Truth sync, implementation branch and baseline

**Files:** canonical state/roadmap/changelog files, M8.1 focused/acceptance docs, approved M8.2 design, new M8.2 focused changelog.

**Consumes:** actual M8.1 squash SHA `867ec54d21b1dcb94d519ace3bec0a3635717022` and approved M8.2 spec.

**Produces:** truthful docs, `feat/m8-2-precision-structural-editing`, Draft implementation PR and green pre-change baseline.

- [ ] Update M8.1 everywhere to `DONE / PRODUCT-OWNER ACCEPTED / MERGED`, preserving existing acceptance evidence and recording squash SHA `867ec54d21b1dcb94d519ace3bec0a3635717022`.
- [ ] Update M8.2 to `NOW / DESIGN APPROVED / IMPLEMENTATION STARTING` and link the design/plan.
- [ ] Change design header to `**Status:** PRODUCT-OWNER APPROVED — 2026-08-09`.
- [ ] Create focused M8.2 changelog with `IN DEVELOPMENT`, tracker #56, base SHA, architecture contract and a section where every later RED/GREEN SHA/gate is appended.
- [ ] Create branch exactly `feat/m8-2-precision-structural-editing` from the approved design/plan head and open Draft PR `feat: M8.2 precision drawing and structural editing` against `main`.
- [ ] Run baseline:

```bash
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

Expected: PASS before the first M8.2 production RED.

- [ ] Record baseline SHA and available CI/browser run IDs in the focused changelog and Draft PR.
- [ ] Commit docs preparation:

```bash
git add docs
git status --short
git commit -m "docs: start M8.2 implementation"
```

---

## Task 1: Canvas angle authority and semantic structural snapping

**Files:** new `structural-angle*`, `structural-snapping*`, geometry index.

**Consumes:** `Point2`, `TopologyDocumentLike`, segment projection/intersection helpers.

**Produces:** a single renderer-neutral angle authority and deterministic snap resolver.

### Interfaces

```ts
export function normalizeCanvasAngleDeg(angleDeg: number): number;
export function vectorToCanvasAngleDeg(start: Point2, end: Point2): number;
export function pointFromCanvasPolar(start: Point2, lengthMm: number, angleDeg: number): Point2;
```

```ts
export type StructuralSnapKind =
  | "endpoint" | "junction" | "midpoint" | "intersection" | "wall-axis"
  | "parallel" | "perpendicular" | "horizontal" | "vertical" | "grid" | "none";

export type StructuralSnapTarget =
  | Readonly<{ kind: "vertex"; vertexId: string; point: Point2 }>
  | Readonly<{ kind: "wall"; wallId: string; point: Point2 }>
  | null;

export type StructuralSnapResult = Readonly<{
  candidateId: string | null;
  point: Point2;
  kind: StructuralSnapKind;
  label: string | null;
  guides: readonly StructuralSnapGuide[];
  target: StructuralSnapTarget;
}>;

export function resolveStructuralSnap(input: Readonly<{
  document: TopologyDocumentLike;
  rawPoint: Point2;
  startPoint?: Point2 | null;
  gridStep: number;
  acquisitionTolerance: number;
  releaseTolerance: number;
  replacementAdvantage: number;
  activeCandidateId?: string | null;
  snappingEnabled: boolean;
  excludeVertexIds?: ReadonlySet<string>;
  excludeWallIds?: ReadonlySet<string>;
}>): StructuralSnapResult;
```

Priority is exactly: endpoint/junction > midpoint > eligible construction-guide intersection > wall-axis > perpendicular/parallel > horizontal/vertical > grid > raw. Same-priority ties: distance then stable source order/ID. Existing wall-wall crossing never becomes a new authoritative topology target.

- [ ] Write RED angle tests:

```ts
expect(vectorToCanvasAngleDeg({x:0,y:0},{x:10,y:0})).toBe(0);
expect(vectorToCanvasAngleDeg({x:0,y:0},{x:0,y:10})).toBe(90);
expect(vectorToCanvasAngleDeg({x:0,y:0},{x:-10,y:0})).toBe(180);
expect(vectorToCanvasAngleDeg({x:0,y:0},{x:0,y:-10})).toBe(270);
expect(pointFromCanvasPolar({x:100,y:200},1000,90)).toEqual({x:100,y:1200});
```

- [ ] Run RED: `pnpm --filter @vlezet/geometry test -- structural-angle.test.ts`.
- [ ] Commit RED `test: define M8.2 canvas angle contract`.
- [ ] Implement minimal angle helpers/export; GREEN same command.
- [ ] Write snapping RED table covering all labels/targets, priority, stable ties, exclusions, disabled snapping, 12→18-style hysteresis behaviour and safe/unsafe intersection materialisation.
- [ ] Run RED: `pnpm --filter @vlezet/geometry test -- structural-snapping.test.ts`; commit RED.
- [ ] Implement minimal pure candidate generation/ranking. No CSS-pixel constants enter geometry.
- [ ] GREEN:

```bash
pnpm --filter @vlezet/geometry test -- structural-angle.test.ts structural-snapping.test.ts
pnpm --filter @vlezet/geometry test
```

- [ ] Commit GREEN `feat: resolve semantic structural snapping`.

---

## Task 2: Atomic editor-core structural transactions

**Files:** new `structural-editing*`, editor-core index/commands.

**Consumes:** immutable document, `validateTopology`, `validateOpening`, existing tolerances.

**Produces:** candidate/result APIs for vertex move, rigid wall translation and centred batch thickness.

### Interfaces

```ts
export type StructuralTransactionResult =
  | Readonly<{ ok: true; document: VlezetDocument; affectedVertexIds: readonly string[]; affectedWallIds: readonly string[] }>
  | Readonly<{ ok: false; candidate: VlezetDocument | null; code: "invalid-input" | "topology" | "opening"; reason: string; affectedVertexIds: readonly string[]; affectedWallIds: readonly string[] }>;

export function evaluateStructuralVertexMove(document: VlezetDocument, vertexId: string, position: Point2): StructuralTransactionResult;
export function evaluateStructuralWallTranslation(document: VlezetDocument, wallId: string, delta: Point2): StructuralTransactionResult;
export function evaluateWallThicknessBatch(document: VlezetDocument, wallIds: readonly string[], thicknessMm: number): StructuralTransactionResult;
```

Validation: construct complete immutable candidate; derive affected walls; reject zero/collapse/reversal by old/new vector dot product; run `validateTopology`; call `validateOpening(candidate, opening, opening.id)` for every opening; only then return success. Wall translation moves target start/end/junction vertices by the same delta. Incident walls reshape only through shared vertices.

Add command labels:

```ts
"vertex/move-structural"
"wall/translate"
"wall/batch-set-thickness"
"structure/cut"
"structure/paste"
```

- [ ] RED tests: terminal/shared vertex, T-junction, off-host rejection, rigid wall length/angle preservation, incident-wall reshape, reversal rejection, opening preservation/rejection, atomic batch thickness and immutability.
- [ ] Run RED: `pnpm --filter @vlezet/editor-core test -- structural-editing.test.ts`; commit RED.
- [ ] Implement minimal candidate builder/validator and exports/labels.
- [ ] GREEN:

```bash
pnpm --filter @vlezet/editor-core test -- structural-editing.test.ts
pnpm --filter @vlezet/editor-core test
```

- [ ] Commit GREEN `feat: validate atomic structural edits`.

---

## Task 3: Strict structural clipboard

**Files:** new `structural-clipboard*`, editor-core index.

**Consumes:** approved wall-only closure and Task 2 validation.

**Produces:** closure evaluator, versioned payload, atomic Cut/Paste.

### Interfaces

```ts
export type StructuralClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "structural-fragment";
  origin: Point2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly Opening[];
}>;

export function evaluateStructuralClipboardClosure(document: VlezetDocument, wallIds: readonly string[]):
  | Readonly<{ ok: true; wallIds: readonly string[]; vertexIds: readonly string[]; openingIds: readonly string[] }>
  | Readonly<{ ok: false; reason: string }>;
export function createStructuralClipboardPayload(document: VlezetDocument, wallIds: readonly string[]): StructuralClipboardPayloadV1;
export function cutStructuralFragment(document: VlezetDocument, wallIds: readonly string[]): Readonly<{ document: VlezetDocument; payload: StructuralClipboardPayloadV1 }>;
export function pasteStructuralFragment(document: VlezetDocument, payload: StructuralClipboardPayloadV1, anchor: Point2, idFactory: (kind: "vertex" | "wall" | "opening") => string): Readonly<{ document: VlezetDocument; wallIds: readonly string[]; vertexIds: readonly string[]; openingIds: readonly string[] }>;
```

Closure algorithm: reject empty/duplicate/missing IDs; source-order selected walls; collect all start/end/junction vertices and every hosted opening; if any collected vertex is referenced by an unselected wall, reject; never expand visible selection. Paste remaps every ID/reference, applies one rigid translation from payload origin to anchor, validates complete candidate before returning.

- [ ] RED tests: closed fragment success; open boundary deterministic rejection; hosted openings included automatically; stable order; Cut leaves no dangling refs; Paste fresh IDs/internal refs; relative geometry exact; invalid paste adds nothing; immutability.
- [ ] Run RED: `pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts`; commit RED.
- [ ] Implement using Task 2 validation rather than duplicated policy.
- [ ] GREEN:

```bash
pnpm --filter @vlezet/editor-core test -- structural-clipboard.test.ts structural-editing.test.ts
pnpm --filter @vlezet/editor-core test
```

- [ ] Commit GREEN `feat: add fail-closed structural clipboard`.

---

## Task 4: Store/runtime gesture, clipboard and history integration

**Files:** `editor-clipboard*`, `use-editor-store*`, `editor-escape-priority*`.

**Consumes:** Tasks 2–3.

**Produces:** discriminated clipboard, structural preview/commit/cancel lifecycle and exact history.

### Runtime shapes

```ts
export type EditorClipboardPayload = VlezetClipboardPayloadV1 | StructuralClipboardPayloadV1;

export type StructuralGesture = Readonly<{
  kind: "move-vertex" | "translate-wall";
  entityId: string;
  before: VlezetDocument;
  previewDocument: VlezetDocument;
  valid: boolean;
  reason: string | null;
}>;
```

Store actions: begin/preview/commit/cancel vertex and wall gestures, `setSelectedWallsThickness`, and context-aware Copy/Cut/Paste/Duplicate. Furniture behaviour remains unchanged. Structural preview updates runtime only; valid commit creates one semantic command; invalid commit creates none. Structural Cut = one `structure/cut`; Paste/Duplicate = one `structure/paste`.

Escape priority starts with structural gesture, then object gesture, then the existing sequence.

- [ ] RED store tests for preview zero-history, valid one-history, invalid/cancel zero-history, Undo→Redo→Undo, structural/furniture clipboard discrimination, atomic Cut/Paste/Duplicate, selection sanitisation.
- [ ] RED Escape test: `hasStructuralGesture` yields `cancel-structural-gesture` before object/wall draft actions.
- [ ] Run RED:

```bash
pnpm --filter web test -- editor-clipboard.test.ts use-editor-store.test.ts editor-escape-priority.test.ts
```

- [ ] Commit RED; implement minimal runtime integration.
- [ ] GREEN same focused command + `pnpm --filter web test`.
- [ ] Commit GREEN `feat: coordinate structural edit history`.

---

## Task 5: Exact near-cursor wall input

**Files:** new `wall-dynamic-input-model*`, `wall-dynamic-input*`, foundation store, store tests, CSS.

**Consumes:** Task 1 angle helpers and current `DraftWall`.

**Produces:** accessible DOM length/angle controls that modify draft only until commit.

### Pure model

```ts
export type WallDynamicConstraints = Readonly<{ lengthMm: number | null; angleDeg: number | null }>;
export function resolveWallDynamicDraft(start: Point2, pointerPoint: Point2, constraints: WallDynamicConstraints): Readonly<{ point: Point2; lengthMm: number; angleDeg: number }>;
export function parseWallLengthInput(value: string): number | null;
export function parseWallAngleInput(value: string): number | null;
export function clampFloatingInputPosition(anchor: {x:number;y:number}, panel: {width:number;height:number}, viewport: {width:number;height:number}, margin?: number): {x:number;y:number};
```

Rules: no constraints = pointer; length only = exact length along pointer angle; angle only = pointer length at exact angle; both exact. Invalid/zero/non-finite length cannot commit.

Component is DOM overlay inside `.canvas-shell`, length then angle in focus order. Native Tab/Shift+Tab switch fields. Enter commits valid draft. First Escape inside input clears numeric editing, stops propagation and preserves draft; later Canvas Escape cancels draft. Errors use `aria-invalid` + `aria-describedby`; focus styling is visible; overlay clamps within Canvas viewport.

- [ ] RED pure model for 0/90/180/270, length-only, angle-only, both and clamping.
- [ ] RED component for labels/units/focus order/Enter/Escape/error association.
- [ ] Run RED: `pnpm --filter web test -- wall-dynamic-input-model.test.ts wall-dynamic-input.test.tsx`; commit RED.
- [ ] Implement model/component + draft-point update method without history.
- [ ] GREEN focused tests + `use-editor-store.test.ts` + full web suite.
- [ ] Commit GREEN `feat: add exact wall dynamic input`.

---

## Task 6: Snap control, guides and structural handles

**Files:** new snapping settings/handle/overlay modules, toolbar/icon tests/CSS.

**Consumes:** Task 1 snap result; existing selection already supports `vertex`.

**Produces:** visible `Привязки`, named active guides and >=24px endpoint/junction hit areas.

Settings state is runtime-only and defaults enabled:

```ts
{ enabled: true, setEnabled(enabled), toggle() }
```

A selected single wall exposes start/end/junction markers. Visible marker may be 4–5px radius; transparent listening circle is radius >=12px. Overlay renders only active guide/marker and stable Russian snap label; it does not use a chatty aria-live region for pointer twitch.

- [ ] RED settings/toolbar/handle/overlay tests, including `aria-pressed`, stable labels and deterministic `data-hit-diameter="24"` metadata backed by actual >=12px hit radius.
- [ ] Run RED:

```bash
pnpm --filter web test -- structural-snapping-settings-store.test.ts structural-handle-layer.test.tsx structural-snap-overlay.test.tsx editor-toolbar.test.tsx
```

- [ ] Commit RED; implement without Canvas pointer wiring.
- [ ] GREEN focused + full web tests.
- [ ] Commit GREEN `feat: present structural precision controls`.

---

## Task 7: Canvas integration

**Files:** `editor-canvas*`, feedback/status, apartment editor, CSS.

**Consumes:** Tasks 1, 4, 5, 6.

**Produces:** real pointer/focus behaviour while keeping Canvas non-authoritative.

Replace current ad-hoc vertex/wall `snapPointer()` ranking with one adapter around `resolveStructuralSnap`. Convert tolerances only here:

```ts
const acquisitionTolerance = 12 / viewport.pixelsPerMillimeter;
const releaseTolerance = 18 / viewport.pixelsPerMillimeter;
const replacementAdvantage = 1 / viewport.pixelsPerMillimeter;
```

Wall creation: first click begins draft; pointer move uses resolver; dynamic input appears; second pointer click remains supported; Enter commits exact numeric draft. Exact numeric endpoint may use a host target only if it actually coincides within geometry tolerance.

Vertex gesture: selected-wall handle pointer-down begins runtime gesture; capture pointer where supported; move resolves snap excluding moving vertex; editor-core previews; pointer-up commits only valid result; pointer-cancel/Escape cancels.

Wall translation: only selected single wall body begins rigid gesture; target wall start vertex is snap anchor; exclude target wall/moved vertices; compute delta from snapped anchor; editor-core validates whole closure. No Konva node `draggable` state is geometry authority.

Alt/Option suppresses snapping only during Canvas-owned active gesture and is ignored while native input/control is focused. Shift/Cmd/Ctrl retain selection semantics.

Render structural preview from `structuralGesture?.previewDocument ?? document`; committed history remains unchanged until commit.

- [ ] RED source contract requires semantic resolver/dynamic input/handle/overlay and forbids a second inline endpoint/wall ranking implementation.
- [ ] RED feedback contract makes invalid structural preview textually clear and cursor `not-allowed` without relying only on colour.
- [ ] Run RED: `pnpm --filter web test -- editor-canvas-source.test.ts editor-canvas-feedback.test.ts use-editor-store.test.ts`; commit RED.
- [ ] Integrate wall drawing first, then vertex gesture, then wall translation.
- [ ] GREEN focused + full web tests.
- [ ] Commit GREEN `feat: integrate precision structural gestures`.

---

## Task 8: Capability-driven structural commands and multi-wall thickness UI

**Files:** selection capabilities/tests, multi-selection inspector/tests, context menu/tests, apartment editor, CSS.

**Consumes:** Task 3 closure evaluator and Task 4 store actions.

**Produces:** one fail-closed policy shared by keyboard/context menu/inspector.

Capability input changes from placed-object boolean to:

```ts
clipboardKind: "placed-objects" | "structural-fragment" | null;
```

Add `setWallThickness: SelectionCapability`.

Matrix:
- furniture keeps M8.1 behaviour;
- single wall interactive move enabled;
- structural Copy/Cut/Duplicate enabled only for wall-only selection whose strict closure succeeds;
- two+ walls enable batch thickness when every ref is a wall;
- opening/room/vertex-only and mixed furniture/structure remain blocked with Russian reason;
- Paste enabled for either supported clipboard kind;
- scale remains disabled;
- raw structural Delete remains disabled; Cut is dependency-safe deletion path.

Multi-wall inspector shows exact common thickness or `Разные значения`, never an average. One submitted value applies atomically through `setSelectedWallsThickness`; centre alignment only.

`ApartmentEditor.executeEditorCommand` must stop hard-coding `selectedFurnitureOnly`; generic Copy/Cut/Paste/Duplicate dispatch must use the same capability/clipboard authority as context surfaces.

- [ ] RED closed/open structural capability fixtures and multi-wall inspector shared/varied state.
- [ ] RED context-menu parity with keyboard semantic commands.
- [ ] Run RED:

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts multi-selection-inspector.test.tsx editor-context-menu.test.tsx
```

- [ ] Commit RED; implement minimal capability/UI dispatch.
- [ ] GREEN focused + `use-editor-store.test.ts` + full web suite.
- [ ] Commit GREEN `feat: expose safe structural batch actions`.

---

## Task 9: Chromium/WebKit M8.2 acceptance

**Files:** new browser spec + both Playwright configs.

**Produces:** beta-critical browser evidence.

Full Chromium scenarios:
1. pointer-only wall creation regression;
2. exact length+angle dynamic input;
3. endpoint/midpoint/wall-axis named snapping;
4. jitter around acquisition/release threshold with no flapping/drift;
5. visible `Привязки` off/on + temporary Alt/Option suppression;
6. endpoint/shared-corner drag with exact Undo→Redo→Undo;
7. safe wall translation preserving target length/opening;
8. unsafe translation rejection with no partial mutation/history;
9. atomic multi-wall thickness + one-step Undo;
10. closed structural Copy/Paste or Duplicate with one-step Undo;
11. open-fragment clipboard rejection;
12. keyboard-only dynamic input and focus order.

WebKit representative subset: dynamic input focus/Escape, Alt/Option suppression, endpoint gesture pointer ownership, jitter stability, closed structural clipboard and Undo/Redo.

Browser tests assert visible exact dimensions/status/history state as semantic evidence plus screenshots for representative precision states.

- [ ] Add browser test before any browser-specific workaround; observed failure is RED.
- [ ] Register `m8-precision-structural.spec.mjs` in both configs.
- [ ] Focused Chromium:

```bash
pnpm --dir tools/m7-browser-audit exec playwright test m8-precision-structural.spec.mjs --config=playwright.config.mjs
```

- [ ] Focused WebKit:

```bash
pnpm --dir tools/m7-browser-audit exec playwright test m8-precision-structural.spec.mjs --config=playwright.webkit.config.mjs
```

- [ ] Fix only observed defects via RED→GREEN; no sleeps/test weakening as fixes.
- [ ] Full browser regression:

```bash
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

- [ ] Commit `test: cover M8.2 structural browser acceptance`.

---

## Task 10: Final gates and product-owner handoff

**Files:** focused/canonical docs; acceptance record only after manual PASS.

- [ ] Run full deterministic gates:

```bash
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm benchmark:recognition:core
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.config.mjs
pnpm --dir tools/m7-browser-audit exec playwright test --config=playwright.webkit.config.mjs
```

- [ ] Verify exact-head GitHub evidence: CI PASS, Recognition Benchmark PASS, Chromium PASS, WebKit PASS, unresolved review threads 0.
- [ ] Update docs only to `PRODUCT-OWNER TESTING`, recording exact head and automated evidence; do not claim acceptance/merge.
- [ ] Give product owner only five focused manual scenarios:

```text
M8.2-PO-01 Precision draw
M8.2-PO-02 Junction edit
M8.2-PO-03 Wall move + unsafe block
M8.2-PO-04 Batch thickness
M8.2-PO-05 Structural clipboard + open-fragment rejection
```

- [ ] After explicit product-owner PASS, create `docs/milestones/m8-2-acceptance.md` with accepted head, gate IDs, manual result/date, architecture invariants and deferred scope.
- [ ] Re-run exact-head gates after acceptance-document changes because the PR head changed.
- [ ] Do not merge without explicit shipping authorization. When authorized, squash merge only with `expected_head_sha` equal to the verified final head, then record the actual squash SHA separately.

---

## Plan self-review

Implementation may start only if:

- every approved design area maps to deterministic tests above;
- geometry interfaces remain renderer/domain independent;
- complete structural candidates are validated before commit;
- collapse/reversal, junction, opening and crossing failure classes are covered;
- clipboard closure matches the approved conservative algorithm and carries hosted openings;
- paste remaps all IDs/references;
- dynamic input uses the single angle authority;
- 12/18 CSS-pixel acquisition/release values are converted only at the web boundary;
- Alt/Option is never the only snapping-off path;
- structural handles meet the 24×24 CSS-pixel target;
- batch thickness is centre-only and atomic;
- structural preview/cancel/reject do not enter history;
- mixed/unsupported selections stay fail closed;
- browser evidence covers semantic state, jitter, focus, modifier, rejection/no-mutation and exact Undo/Redo;
- M8.1 furniture interaction, existing browser suites and recognition benchmark remain mandatory regressions;
- product-owner acceptance and protected merge remain separate states.

## Execution Strategy

Execute inline, task-by-task in the current development workflow because no independent subagent execution surface is available in this conversation. Maintain subagent-style discipline: one bounded task at a time, fresh RED evidence, inspect each diff/test result before the next task, and keep the Draft PR/focused changelog current after each GREEN checkpoint.

The product owner approved the M8.2 specification and explicitly authorized implementation, so no further design clarification is required before Task 0.
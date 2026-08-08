# M8.1 Editor Interaction Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the editor's single-entity interaction substrate with a deterministic, capability-aware multi-selection/navigation/clipboard foundation that feels familiar to users of mature infinite-canvas tools while preserving Vlezet's millimetre geometry, topology, semantic history and fail-closed editing authority.

**Architecture:** Keep `VlezetDocument`, `@vlezet/editor-core` and `@vlezet/geometry` authoritative. Add pure runtime interaction contracts in `apps/web/components/editor`, add atomic multi-object document transforms in `@vlezet/editor-core`, then integrate selection, gestures, command routing, viewport navigation, marquee, context UI and browser acceptance incrementally. M8.1 completes rich multi-object behaviour only for placed furniture/appliance/custom objects; structural multi-selection is representable but unsafe structural batch mutation remains disabled until M8.2.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5 vanilla stores, Konva/react-konva 10/19, Vitest 4, Playwright Chromium/WebKit, pnpm 11/Turborepo.

## Execution prerequisite — hard gate

Do **not** execute any code task in this plan until all of the following are true:

1. product owner explicitly approves this implementation plan;
2. M8.0/design PR #62 is accepted and integrated, or the M8.1 branch is otherwise based on the exact accepted M8.0 commit;
3. the implementation branch is a fresh branch named `feat/m8-1-editor-interaction-foundation`;
4. baseline `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` pass before the first RED commit.

The current user instruction explicitly forbids starting implementation before separate confirmation of this plan.

## Global Constraints

- `VlezetDocument` remains the sole persistent apartment/layout source of truth.
- Millimetres remain canonical; Canvas pixels and viewport transforms are runtime-only.
- Selection, clipboard, viewport, pointer anchor, marquee and context-menu state are runtime-only and must not create a project-schema migration.
- Rooms remain derived; room selection never becomes persistent geometry.
- Openings remain hosted and existing deterministic opening validation remains authoritative.
- M2 fit/collision/door/clearance authority is unchanged.
- Structural/mixed multi-selection may exist, but unsupported batch commands fail closed and never silently mutate only a compatible subset.
- Arbitrary graphical group scale is forbidden.
- M8.1 supports semantic clipboard/batch mutation only for placed objects; structural clipboard is M8.2.
- Core editing must remain fully usable without AI/network access.
- Every deterministic behaviour change follows genuine RED → observed intended failure → minimal GREEN → neighbouring regression/refactor.
- A test that was already green does not count as RED evidence.
- Existing tests, validators, safety checks and thresholds may not be weakened merely to make CI green.
- Pointer/trackpad/keyboard behaviour receives real Chromium browser coverage; representative WebKit coverage is mandatory where engine behaviour can differ.
- Each meaningful RED/GREEN checkpoint is recorded in the Draft PR and later in the focused M8.1 changelog.
- Canonical completion/merge claims are written only after product-owner acceptance and protected merge.

---

## File map locked by this plan

### New pure web interaction modules

- `apps/web/components/editor/editor-selection.ts` — selection value model and pure membership operations.
- `apps/web/components/editor/editor-selection.test.ts` — selection invariants and sanitisation.
- `apps/web/components/editor/editor-selection-capabilities.ts` — pure command availability for a semantic selection.
- `apps/web/components/editor/editor-selection-capabilities.test.ts` — capability matrix.
- `apps/web/components/editor/editor-selection-geometry.ts` — semantic bounds and marquee hit testing.
- `apps/web/components/editor/editor-selection-geometry.test.ts` — oriented furniture/wall/opening/mixed bounds tests.
- `apps/web/components/editor/editor-clipboard.ts` — versioned runtime placed-object clipboard and paste-anchor/repetition model.
- `apps/web/components/editor/editor-clipboard.test.ts` — payload/fresh-ID/offset tests.
- `apps/web/components/editor/editor-commands.ts` — central UI command registry/availability/execution contract.
- `apps/web/components/editor/editor-commands.test.ts` — command/focus/availability tests.
- `apps/web/components/editor/editor-viewport-controller.ts` — pure pan/zoom/fit calculations.
- `apps/web/components/editor/editor-viewport-controller.test.ts` — navigation invariants.
- `apps/web/components/editor/multi-selection-inspector.tsx` — compact semantic summary and available/unavailable actions.
- `apps/web/components/editor/multi-selection-inspector.test.tsx` — context presentation tests.
- `apps/web/components/editor/editor-context-menu.tsx` — minimal command-registry consumer for right click.
- `apps/web/components/editor/editor-context-menu.test.tsx` — menu availability/keyboard dismissal tests.

### Editor-core additions

- Modify `packages/editor-core/src/object-editing.ts` — atomic batch add/update/move/delete helpers for placed objects.
- Modify `packages/editor-core/src/object-editing.test.ts` — atomicity/validation/identity tests.
- Modify `packages/editor-core/src/commands.ts` — explicit batch object history labels.
- Modify `packages/editor-core/src/index.ts` — export the new batch helpers/types.

### Existing web integration

- Modify `apps/web/components/editor/use-editor-store.ts`.
- Modify `apps/web/components/editor/use-editor-store.test.ts`.
- Modify `apps/web/components/editor/keyboard.ts` and existing keyboard tests.
- Modify `apps/web/components/editor/editor-canvas.tsx`.
- Modify `apps/web/components/editor/editor-canvas-source.test.ts`.
- Modify `apps/web/components/editor/placed-object-shape.tsx` and `placed-object-shape.test.ts`.
- Modify `apps/web/components/editor/apartment-editor.tsx` and relevant shell tests.
- Modify `apps/web/components/editor/editor-toolbar.tsx` only where command consumers/view commands need exposure.
- Modify existing editor CSS files used by Canvas/context surfaces; do not introduce a second visual system.

### Browser evidence

- Create `tools/m7-browser-audit/m8-editor-interaction.spec.mjs`.
- Modify `tools/m7-browser-audit/playwright.config.mjs`.
- Modify `tools/m7-browser-audit/playwright.webkit.config.mjs`.

### Delivery records

- Create during implementation: `docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md` with status `IN DEVELOPMENT`; update it throughout the PR.
- Create only after explicit product-owner acceptance: `docs/milestones/m8-1-acceptance.md`.
- Update `docs/CHANGELOG.md`, `docs/PROJECT_STATE.md`, `docs/ROADMAP.md` and `docs/product/UX_ROADMAP.md` only when acceptance/merge state is truthful.

---

### Task 1: Pure unified selection contract

**Files:**
- Create: `apps/web/components/editor/editor-selection.ts`
- Create: `apps/web/components/editor/editor-selection.test.ts`

**Interfaces:**

```ts
export type EditorEntityKind = "wall" | "vertex" | "room" | "opening" | "placed-object";

export type EditorEntityRef = Readonly<{
  kind: EditorEntityKind;
  id: string;
}>;

export type EditorSelection = Readonly<{
  refs: readonly EditorEntityRef[];
  primary: EditorEntityRef | null;
}>;

export const EMPTY_EDITOR_SELECTION: EditorSelection;
export function sameEditorEntity(first: EditorEntityRef, second: EditorEntityRef): boolean;
export function replaceSelection(ref: EditorEntityRef | null): EditorSelection;
export function toggleSelection(selection: EditorSelection, ref: EditorEntityRef): EditorSelection;
export function addToSelection(selection: EditorSelection, refs: readonly EditorEntityRef[]): EditorSelection;
export function clearSelection(): EditorSelection;
export function sanitizeEditorSelection(document: VlezetDocument, selection: EditorSelection): EditorSelection;
```

`sanitizeEditorSelection()` validates wall/opening/placed-object IDs directly, derives room IDs through `deriveRooms(document)`, and treats vertex refs as valid only when the vertex still exists even though direct vertex selection is disabled in M8.1.

- [ ] **Step 1: Write failing invariant tests**

Cover:

1. replace produces exactly one primary ref;
2. toggle adds and makes the added ref primary;
3. toggling the primary out selects the last remaining ref;
4. duplicate `(kind,id)` pairs never appear;
5. additive ordering is deterministic;
6. sanitisation removes deleted entities and preserves surviving order;
7. sanitisation clears an invalid primary deterministically;
8. a wall and placed object with the same string ID remain distinct refs;
9. selection values do not mutate input arrays.

- [ ] **Step 2: Verify real RED**

```bash
pnpm --filter web test -- editor-selection.test.ts
```

Expected: FAIL because `editor-selection.ts` does not exist.

- [ ] **Step 3: Implement only the pure contract**

No Zustand, Konva, DOM, clipboard or commands in this file.

- [ ] **Step 4: Verify GREEN**

Run the same command; expected PASS.

- [ ] **Step 5: Run neighbouring web unit regression**

```bash
pnpm --filter web test
```

- [ ] **Step 6: Record RED/GREEN SHAs in the Draft PR and focused changelog**

Do not claim M8.1 acceptance.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/editor-selection.ts apps/web/components/editor/editor-selection.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: define unified editor selection contract"
```

---

### Task 2: Capability evaluator and fail-closed selection policy

**Files:**
- Create: `apps/web/components/editor/editor-selection-capabilities.ts`
- Create: `apps/web/components/editor/editor-selection-capabilities.test.ts`

**Interfaces:**

```ts
export type SelectionCapability = Readonly<{
  enabled: boolean;
  reason?: string;
}>;

export type SelectionCapabilities = Readonly<{
  copy: SelectionCapability;
  cut: SelectionCapability;
  paste: SelectionCapability;
  duplicate: SelectionCapability;
  delete: SelectionCapability;
  move: SelectionCapability;
  rotate: SelectionCapability;
  scale: SelectionCapability;
}>;

export function deriveSelectionCapabilities(input: Readonly<{
  document: VlezetDocument;
  selection: EditorSelection;
  hasPlacedObjectClipboard: boolean;
}>): SelectionCapabilities;
```

Exact M8.1 policy:

- one/many placed objects: copy, cut, duplicate, delete and move enabled;
- single placed object: existing rotate remains available;
- many placed objects: group rotate disabled until M8.5;
- empty selection: mutating selection commands disabled;
- several structural entities: all new batch mutation/copy commands disabled;
- mixed structural + furniture: all new batch mutation/copy commands disabled;
- paste depends on a valid placed-object clipboard, not current selection;
- `scale.enabled` is always false;
- reasons are concise Russian user-facing explanations for important disabled mixed/structural operations.

- [ ] **Step 1: Write a failing table-driven capability matrix**

Include empty, one furniture, three furniture, one wall, wall+opening, furniture+wall and clipboard/no-clipboard cases.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts
```

- [ ] **Step 3: Implement minimal pure evaluator**

No store reads and no mutation side effects.

- [ ] **Step 4: Verify GREEN and complete web unit suite**

```bash
pnpm --filter web test -- editor-selection-capabilities.test.ts
pnpm --filter web test
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/editor-selection-capabilities.ts apps/web/components/editor/editor-selection-capabilities.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: evaluate semantic selection capabilities"
```

---

### Task 3: Atomic placed-object batch transforms in editor-core

**Files:**
- Modify: `packages/editor-core/src/object-editing.ts`
- Modify: `packages/editor-core/src/object-editing.test.ts`
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**

Add:

```ts
export type PlacedObjectBatchPatch = Readonly<{
  objectId: string;
  patch: PlacedObjectPatch;
}>;

export function addPlacedObjects(
  document: VlezetDocument,
  objects: readonly PlacedObject[],
): VlezetDocument;

export function updatePlacedObjects(
  document: VlezetDocument,
  patches: readonly PlacedObjectBatchPatch[],
): VlezetDocument;

export function translatePlacedObjects(
  document: VlezetDocument,
  objectIds: readonly string[],
  delta: Point2,
): VlezetDocument;

export function deletePlacedObjects(
  document: VlezetDocument,
  objectIds: readonly string[],
): VlezetDocument;
```

Add history labels:

```text
object/batch-add
object/batch-move
object/batch-delete
```

Atomicity rules:

- reject duplicate IDs within an input batch;
- reject a missing source ID before returning any transformed document;
- reject duplicate destination IDs before any add;
- reject non-finite translation deltas;
- validate every resulting object through existing `createPlacedObject()` semantics;
- preserve document array order for updates/deletes and append batch additions in supplied stable order;
- no partial result escapes on any error.

- [ ] **Step 1: Add failing batch tests before implementation**

Cover two-object translation preserving rotation/dimensions/relative vector, atomic invalid member rejection, duplicate IDs, finite delta, batch add fresh IDs, batch delete, and source-document immutability.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter @vlezet/editor-core test -- object-editing.test.ts
```

Expected: FAIL because batch exports/functions do not exist.

- [ ] **Step 3: Implement minimal pure transforms**

Reuse `addPlacedObject()`/`updatePlacedObject()` validation internally but validate the whole request contract before returning the final accumulated immutable document.

- [ ] **Step 4: Add failing one-command history test**

Construct one `document/replace` command labelled `object/batch-move`; assert one Undo restores both objects and one Redo restores both moved positions.

- [ ] **Step 5: Verify RED/GREEN as appropriate and then run package suite**

```bash
pnpm --filter @vlezet/editor-core test
pnpm --filter @vlezet/editor-core typecheck
```

- [ ] **Step 6: Commit**

```bash
git add packages/editor-core/src/object-editing.ts packages/editor-core/src/object-editing.test.ts packages/editor-core/src/commands.ts packages/editor-core/src/index.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: add atomic placed-object batch edits"
```

---

### Task 4: Migrate editor store to one writable selection truth

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify single-context inspector call sites touched by the removed writable `selected*Id` fields.

**Interfaces:**

`EditorStoreState` gains:

```ts
selection: EditorSelection;
replaceSelection(ref: EditorEntityRef | null): void;
toggleSelection(ref: EditorEntityRef): void;
addSelection(refs: readonly EditorEntityRef[]): void;
clearSelection(): void;
selectAllConcreteEntities(): void;
```

Remove the four independent writable state fields:

```text
selectedWallId
selectedRoomId
selectedOpeningId
selectedObjectId
```

Keep compatibility **selectors/functions**, not state:

```ts
export function selectedWallId(selection: EditorSelection): string | null;
export function selectedRoomId(selection: EditorSelection): string | null;
export function selectedOpeningId(selection: EditorSelection): string | null;
export function selectedObjectId(selection: EditorSelection): string | null;
```

They return an ID only for a one-entity selection of the matching kind; multi-selection returns null so the ordinary single inspector cannot pretend to edit a mixed group.

History transitions (`undo`, `redo`, deletes, planning apply and any document replacement) must call `sanitizeEditorSelection()` before setting state.

- [ ] **Step 1: Add failing store migration tests**

Assert replace/toggle/add/clear, primary behaviour, `selectAllConcreteEntities()` excluding room/vertex, sanitisation after delete and Undo/Redo, and one-selection compatibility projections.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- use-editor-store.test.ts
```

- [ ] **Step 3: Implement store selection and compatibility selectors**

Do not keep legacy `selected*Id` state in parallel.

- [ ] **Step 4: Update all compile-time call sites to read compatibility selectors/unified selection**

Expected result: no independent writable legacy selection remains.

- [ ] **Step 5: Verify GREEN + typecheck**

```bash
pnpm --filter web test -- use-editor-store.test.ts
pnpm --filter web typecheck
pnpm --filter web test
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store.test.ts apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/editor-canvas.tsx apps/web/components/editor docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "refactor: make editor selection a single runtime truth"
```

Before committing, inspect the staged file list so the broad `apps/web/components/editor` add does not capture unrelated changes.

---

### Task 5: Deterministic multi-furniture rigid move gesture

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/placed-object-shape.tsx`
- Modify: `apps/web/components/editor/placed-object-shape.test.ts`

**Interfaces:**

Replace the one-object move gesture with a group-aware runtime preview:

```ts
export type ObjectMoveGesture = Readonly<{
  kind: "move";
  anchorObjectId: string;
  objectIds: readonly string[];
  before: readonly PlacedObject[];
  preview: readonly PlacedObject[];
}>;
```

Transform/physical-resize remains single-object in M8.1; do not silently make it a group transform.

Rules:

1. dragging an unselected object first replaces selection with that object;
2. dragging any object in a furniture-only multi-selection moves the entire selection;
3. dragged object is the snap anchor and becomes primary without dropping the other selected furniture;
4. existing `snapPlacedObject()` correction is computed for the anchor only;
5. the resulting translation vector is applied identically to every selected object;
6. relative positions and rotations remain exact;
7. preview fit evaluation includes the whole preview set;
8. Escape/cancel restores exact originals;
9. zero-delta commit creates no history entry;
10. non-zero commit uses `translatePlacedObjects()` and one `object/batch-move` command;
11. mixed/structural selection cannot enter a furniture batch move gesture.

- [ ] **Step 1: Add failing store-level gesture tests**

Cover two selected objects, anchor retention, identical delta, one Undo/Redo, zero delta, cancel and mixed-selection fail-closed behaviour.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- use-editor-store.test.ts
```

- [ ] **Step 3: Implement group gesture state/store commit**

- [ ] **Step 4: Add failing component/source contract for Canvas/PlacedObjectShape**

Assert that a selected object can initiate group move without clearing the current compatible selection and that preview rendering maps each member ID to its preview object.

- [ ] **Step 5: Implement Canvas integration without changing snap tolerances**

- [ ] **Step 6: Verify GREEN + complete web tests**

```bash
pnpm --filter web test -- use-editor-store.test.ts placed-object-shape.test.ts editor-canvas-source.test.ts
pnpm --filter web test
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/placed-object-shape.tsx apps/web/components/editor/placed-object-shape.test.ts apps/web/components/editor/editor-canvas-source.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: move selected furniture as one semantic gesture"
```

---

### Task 6: Versioned semantic clipboard and Copy/Cut/Paste/Duplicate

**Files:**
- Create: `apps/web/components/editor/editor-clipboard.ts`
- Create: `apps/web/components/editor/editor-clipboard.test.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`

**Interfaces:**

```ts
export type VlezetClipboardPayloadV1 = Readonly<{
  version: 1;
  kind: "placed-objects";
  copiedAtOrigin: Point2;
  objects: readonly PlacedObject[];
}>;

export type EditorClipboardState = Readonly<{
  payload: VlezetClipboardPayloadV1 | null;
  lastPasteAnchor: Point2 | null;
  repeatedPasteCount: number;
}>;

export function createPlacedObjectClipboardPayload(
  objects: readonly PlacedObject[],
): VlezetClipboardPayloadV1;

export function derivePasteObjects(input: Readonly<{
  payload: VlezetClipboardPayloadV1;
  anchor: Point2;
  repetition: number;
  idFactory: () => string;
}>): readonly PlacedObject[];
```

Origin is the bounding-box centre of the copied placed-object set. Repetition adds `200 * repetition` mm to both X/Y after anchor translation. All paste IDs come from the editor's existing placed-object ID factory.

Store commands:

```ts
copySelection(): void;
cutSelection(): void;
pasteClipboard(anchor: Point2): void;
duplicateSelection(): void;
```

Rules:

- copy is non-mutating;
- cut writes clipboard then performs one atomic `object/batch-delete` semantic history command;
- paste performs one `object/batch-add` command and selects new objects;
- duplicate is equivalent to a one-shot semantic copy+paste offset of `+200,+200` without replacing persistent clipboard contents;
- source IDs are never reused;
- source objects are never mutated;
- unsupported/mixed selection commands return without partial document mutation;
- clipboard is runtime-only and system Clipboard API permission is not required;
- moving the pointer/viewport anchor to a different world point resets repeated-paste sequencing at the caller/controller level.

- [ ] **Step 1: Write failing pure clipboard tests**

Cover stable group origin, relative transforms, fresh IDs, deterministic offsets and immutability.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-clipboard.test.ts
```

- [ ] **Step 3: Implement pure clipboard model**

- [ ] **Step 4: Add failing store command/history tests**

Cover copy, cut+Undo, paste+Undo, duplicate+Undo, repeated paste and mixed-selection rejection.

- [ ] **Step 5: Implement store actions through batch editor-core transforms**

- [ ] **Step 6: Verify GREEN**

```bash
pnpm --filter web test -- editor-clipboard.test.ts use-editor-store.test.ts
pnpm --filter web test
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/editor-clipboard.ts apps/web/components/editor/editor-clipboard.test.ts apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: add semantic furniture clipboard"
```

---

### Task 7: Central command registry and keyboard focus safety

**Files:**
- Create: `apps/web/components/editor/editor-commands.ts`
- Create: `apps/web/components/editor/editor-commands.test.ts`
- Modify: `apps/web/components/editor/keyboard.ts`
- Modify existing keyboard tests.
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify existing toolbar/action call sites that are migrated in this slice.

**Interfaces:**

```ts
export type EditorCommandId =
  | "history.undo"
  | "history.redo"
  | "selection.selectAll"
  | "selection.copy"
  | "selection.cut"
  | "selection.paste"
  | "selection.duplicate"
  | "selection.delete"
  | "selection.clear"
  | "view.zoomIn"
  | "view.zoomOut"
  | "view.actualSize"
  | "view.fitPlan"
  | "view.fitSelection"
  | "tool.select"
  | "tool.wall"
  | "tool.door"
  | "tool.window"
  | "object.rotate90";

export type EditorCommandDescriptor = Readonly<{
  id: EditorCommandId;
  label: string;
  shortcut: string | null;
}>;

export function isNativeEditableTarget(target: EventTarget | null): boolean;
export function commandForKeyboardEvent(event: ShortcutKeyEvent): EditorCommandId | null;
```

Execution stays in a controller/ApartmentEditor adapter with availability derived from store/selection capabilities. The registry must not import Konva.

Keyboard contract:

- `Cmd/Ctrl+C/X/V/A/D` route to semantic editor commands only when focus is not in input/textarea/select/contenteditable/marked native-editable control;
- native text editing wins inside editable controls;
- existing Undo/Redo/tool shortcuts remain supported through command IDs;
- `+`/`=` zoom in, `-` zoom out, `0` actual-size baseline, `1` fit plan, `2` fit selection;
- Escape continues to obey existing one-level Escape priority and is not replaced with an indiscriminate command.

- [ ] **Step 1: Write failing registry/focus/shortcut tests**

Use table-driven macOS/Windows modifier cases and editable-target cases.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-commands.test.ts keyboard
```

- [ ] **Step 3: Implement registry parsing and editable-target guard**

- [ ] **Step 4: Add failing integration/source test proving ApartmentEditor routes commands through one executor**

Buttons/context consumers may call the same executor later; do not keep shortcut-only mutation branches for the migrated commands.

- [ ] **Step 5: Migrate keyboard action handling and verify GREEN**

```bash
pnpm --filter web test -- editor-commands.test.ts keyboard apartment-editor
pnpm --filter web typecheck
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/editor-commands.ts apps/web/components/editor/editor-commands.test.ts apps/web/components/editor/keyboard.ts apps/web/components/editor/*keyboard*.test.* apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/*apartment-editor*.test.* docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: centralize editor command routing"
```

---

### Task 8: Pure viewport navigation, zoom and fit calculations

**Files:**
- Create: `apps/web/components/editor/editor-viewport-controller.ts`
- Create: `apps/web/components/editor/editor-viewport-controller.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`

**Interfaces:**

Reuse the existing viewport shape used by `worldToScreen`/`screenToWorld`; do not invent persistent view geometry.

```ts
export function panViewportBy(
  viewport: Viewport,
  delta: Readonly<{ x: number; y: number }>,
): Viewport;

export function zoomViewportByCommand(
  viewport: Viewport,
  viewportSize: Readonly<{ width: number; height: number }>,
  factor: number,
  limits: Readonly<{ min: number; max: number }>,
): Viewport;

export function fitWorldBounds(
  bounds: WorldBounds,
  viewportSize: Readonly<{ width: number; height: number }>,
  paddingPx: number,
  limits: Readonly<{ min: number; max: number }>,
): Viewport;

export function wheelGestureToViewportAction(event: Readonly<{
  deltaX: number;
  deltaY: number;
  ctrlKey: boolean;
  metaKey: boolean;
  shiftKey: boolean;
}>):
  | Readonly<{ kind: "pan"; delta: Point2 }>
  | Readonly<{ kind: "zoom"; deltaY: number }>;
```

Navigation semantics:

- unmodified wheel/trackpad scroll pans;
- Shift maps a vertical-only stream to horizontal pan when needed;
- Ctrl/Cmd modified wheel/pinch zooms around current pointer using the existing cursor-centred zoom helper;
- Space+primary drag and middle-button drag continue to pan;
- view changes never enter semantic document history;
- zoom remains clamped to existing `MIN_SCALE/MAX_SCALE` values.

- [ ] **Step 1: Write failing pure navigation tests**

Cover pan deltas, Shift horizontal mapping, modified zoom classification, fixed world point under cursor, clamp and `fitWorldBounds()` centring/padding.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-viewport-controller.test.ts
```

- [ ] **Step 3: Implement pure calculations by reusing existing viewport math**

- [ ] **Step 4: Add failing Canvas source/integration tests for wheel routing**

Require ordinary wheel → pan and modifier wheel → zoom; preserve `preventDefault()` only for consumed Canvas gestures.

- [ ] **Step 5: Integrate controller into Canvas and verify GREEN**

```bash
pnpm --filter web test -- editor-viewport-controller.test.ts editor-canvas-source.test.ts
pnpm --filter web test
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/editor-viewport-controller.ts apps/web/components/editor/editor-viewport-controller.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-source.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: normalize Canvas navigation gestures"
```

---

### Task 9: Semantic selection bounds and marquee hit testing

**Files:**
- Create: `apps/web/components/editor/editor-selection-geometry.ts`
- Create: `apps/web/components/editor/editor-selection-geometry.test.ts`

**Interfaces:**

```ts
export type WorldRect = Readonly<{
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}>;

export function deriveEntityWorldBounds(
  document: VlezetDocument,
  ref: EditorEntityRef,
): WorldRect | null;

export function deriveSelectionWorldBounds(
  document: VlezetDocument,
  selection: EditorSelection,
): WorldRect | null;

export function entitiesIntersectingMarquee(
  document: VlezetDocument,
  marquee: WorldRect,
): readonly EditorEntityRef[];
```

Hit-test semantics:

- placed object uses its true oriented rectangle, not its axis-aligned Konva node bounds as authority;
- wall uses its physical visible wall band/segment semantics;
- opening uses its actual hosted opening segment/band;
- rooms and vertices are excluded from M8.1 marquee results;
- partial intersection is sufficient;
- result order is deterministic by semantic Canvas priority `opening > placed-object > wall`, then source/document order, then ID tie-break where needed;
- selection bounds may include a directly selected room using derived polygon bounds even though room is excluded from marquee/select-all.

- [ ] **Step 1: Write failing geometry tests**

Include rotated furniture corner intersection, near-miss, thick wall intersection, opening intersection, mixed union bounds and room direct-selection bounds.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-selection-geometry.test.ts
```

- [ ] **Step 3: Implement with existing `@vlezet/geometry` primitives**

Do not persist computed bounds or use Konva nodes as geometry truth.

- [ ] **Step 4: Verify GREEN + web suite**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/editor-selection-geometry.ts apps/web/components/editor/editor-selection-geometry.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: derive semantic marquee selection geometry"
```

---

### Task 10: Canvas click, modifier and marquee integration

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-source.test.ts`
- Modify: `apps/web/components/editor/canvas-entity-visual.ts`
- Modify: `apps/web/components/editor/canvas-entity-visual.test.ts`
- Modify editor Canvas CSS used for selection/marquee presentation.

**Interfaces and behaviour:**

Runtime marquee state stays Canvas-local:

```ts
type MarqueeGesture = Readonly<{
  startScreen: Point2;
  currentScreen: Point2;
  additive: boolean;
}>;
```

Exact behaviour:

- plain entity click replaces selection;
- Shift-click and Cmd/Ctrl-click toggle membership;
- click empty Canvas clears selection unless additive modifier is held;
- empty-Canvas drag beyond a screen-pixel click threshold starts marquee;
- plain marquee replaces selection;
- Shift-marquee adds results; subtractive marquee is deferred;
- starting a drag on selected furniture begins move, not marquee;
- Space/middle pan wins over marquee;
- hit priority is `opening > placed-object > wall > room`;
- selected entities each receive selected styling;
- group bounding box is non-interactive and has no resize handles;
- selection line widths/handles remain screen-stable across zoom.

- [ ] **Step 1: Add failing source/presentation tests for new selection event semantics**

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- editor-canvas-source.test.ts canvas-entity-visual.test.ts
```

- [ ] **Step 3: Implement click/toggle and semantic hit routing**

- [ ] **Step 4: Add failing marquee tests**

Prove threshold, replace/add semantics, exclusion of rooms/vertices and pan priority.

- [ ] **Step 5: Implement marquee preview and commit through pure geometry helper**

- [ ] **Step 6: Add group bounds visual without transform handles**

- [ ] **Step 7: Verify GREEN and complete web tests/typecheck**

```bash
pnpm --filter web test
pnpm --filter web typecheck
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-source.test.ts apps/web/components/editor/canvas-entity-visual.ts apps/web/components/editor/canvas-entity-visual.test.ts apps/web/app docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: add multi-selection and marquee Canvas interaction"
```

Inspect staged CSS/app files before commit; include only editor-style files actually changed.

---

### Task 11: Fit-plan and fit-selection view commands

**Files:**
- Modify: `apps/web/components/editor/editor-viewport-controller.ts`
- Modify: `apps/web/components/editor/editor-viewport-controller.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify relevant toolbar/help tests if view buttons are exposed.

**Interfaces:**

Canvas/view controller must expose runtime callbacks/state sufficient for command execution without persisting viewport in `VlezetDocument`:

```ts
fitDocument(): void;
fitSelection(): void;
zoomIn(): void;
zoomOut(): void;
actualSize(): void;
```

`fitDocument()` unions document bounds with reference-plan bounds when a reference is present, matching existing renderer/reference geometry authority.

`fitSelection()` uses `deriveSelectionWorldBounds()` and is unavailable for empty selection.

`actualSize()` returns to the defined editor baseline pixels-per-millimetre value already used by the viewport rather than claiming physical monitor centimetre accuracy.

- [ ] **Step 1: Add failing fit document/selection calculation tests**

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement pure bound-to-viewport operations**

- [ ] **Step 4: Add failing command integration tests for `0`, `1`, `2`, `+`, `-`**

- [ ] **Step 5: Wire command executor to Canvas viewport actions**

No semantic history entries.

- [ ] **Step 6: Verify GREEN**

```bash
pnpm --filter web test -- editor-viewport-controller.test.ts editor-commands.test.ts editor-canvas-source.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/editor-viewport-controller.ts apps/web/components/editor/editor-viewport-controller.test.ts apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/editor-commands.test.ts apps/web/components/editor/editor-canvas-source.test.ts docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: add fit plan and fit selection commands"
```

---

### Task 12: Multi-selection inspector and minimal registered-command context menu

**Files:**
- Create: `apps/web/components/editor/multi-selection-inspector.tsx`
- Create: `apps/web/components/editor/multi-selection-inspector.test.tsx`
- Create: `apps/web/components/editor/editor-context-menu.tsx`
- Create: `apps/web/components/editor/editor-context-menu.test.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify existing context-panel/editor CSS.

**Multi-selection inspector requirements:**

- `Выбрано: N`;
- deterministic type counts;
- available common commands;
- concise reason for important unavailable mixed/structural batch operations;
- no fake shared width/height/position fields for heterogeneous selections;
- one-entity selection continues to use the existing specialised wall/room/opening/object inspector unchanged.

**Context menu requirements:**

- right-click on an entity selects it first only when it is not already part of selection; right-click inside current multi-selection preserves the group;
- menu renders only command-registry entries relevant to M8.1: Copy, Cut, Paste, Duplicate, Rotate 90° when available, Delete;
- unavailable commands are either disabled with reason where useful or omitted according to one consistent tested policy;
- menu has no independent mutation callbacks: it calls the same central command executor;
- Escape, outside click and command execution close it;
- right-click no longer globally prevents the browser menu without showing the Vlezet menu;
- no right-drag pan in M8.1.

- [ ] **Step 1: Write failing inspector tests**

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- multi-selection-inspector.test.tsx
```

- [ ] **Step 3: Implement compact semantic inspector**

- [ ] **Step 4: Write failing context-menu tests**

Cover preservation/replacement selection semantics, capability state, command executor identity and dismissal.

- [ ] **Step 5: Implement context menu as command consumer**

- [ ] **Step 6: Integrate into ApartmentEditor/Canvas and verify GREEN**

```bash
pnpm --filter web test -- multi-selection-inspector.test.tsx editor-context-menu.test.tsx apartment-editor editor-canvas-source.test.ts
pnpm --filter web test
pnpm --filter web typecheck
```

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/multi-selection-inspector.tsx apps/web/components/editor/multi-selection-inspector.test.tsx apps/web/components/editor/editor-context-menu.tsx apps/web/components/editor/editor-context-menu.test.tsx apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/editor-canvas.tsx apps/web/app docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "feat: expose multi-selection commands in editor UI"
```

Inspect staged app/CSS files before committing.

---

### Task 13: Chromium and WebKit interaction acceptance automation

**Files:**
- Create: `tools/m7-browser-audit/m8-editor-interaction.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Required Chromium scenarios:**

1. ordinary wheel pans without changing semantic document;
2. modified wheel zooms around pointer;
3. Space-drag and middle-drag pan;
4. click/Shift-click/Cmd-or-Ctrl-click multi-select representative furniture;
5. marquee replace and Shift-marquee add;
6. selected multi-furniture rigid drag preserves relative vector;
7. one Undo/Redo applies to the whole move;
8. Copy/Paste produces fresh objects and deterministic offset;
9. Cut + Undo restores entire set;
10. Duplicate selects duplicates;
11. mixed furniture+wall selection disables unsafe batch mutation;
12. `Cmd/Ctrl+A` selects concrete entities, not derived rooms;
13. native input `Cmd/Ctrl+A/C/V` remains native and does not mutate editor selection/clipboard;
14. `0/1/2/+/-` view commands work and do not create semantic history;
15. context menu uses the same command availability;
16. compact desktop width keeps Canvas, context UI and commands reachable without document horizontal overflow.

**Representative WebKit scenarios:**

- wheel/modified-wheel navigation distinction;
- additive multi-selection;
- multi-furniture move + one Undo;
- semantic Copy/Paste fresh IDs observable through resulting object count/selection;
- native input shortcut safety;
- context-menu basic open/execute/dismiss.

- [ ] **Step 1: Commit browser tests first and obtain a genuine RED run on the feature branch**

At least one scenario must fail for missing M8.1 behaviour; do not manufacture a failure by breaking test setup.

- [ ] **Step 2: Review the RED logs to prove the failures correspond to intended missing behaviour**

Record run/job IDs in the focused changelog/PR.

- [ ] **Step 3: Complete only missing integration defects found by the tests**

Any defect fix gets a focused unit/regression test when it has deterministic logic.

- [ ] **Step 4: Run Chromium and WebKit suites to GREEN**

Use the repository's existing M7 Browser Audit workflow/configuration. Do not replace real pointer/wheel assertions with source-text tests.

- [ ] **Step 5: Commit browser acceptance**

```bash
git add tools/m7-browser-audit/m8-editor-interaction.spec.mjs tools/m7-browser-audit/playwright.config.mjs tools/m7-browser-audit/playwright.webkit.config.mjs docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md
git commit -m "test: cover M8.1 editor interactions in browsers"
```

---

### Task 14: Full exact-head regression and product-owner handoff

**Files:**
- Update: `docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md`
- Update Draft PR #M8.1 body with exact-head evidence.
- Do **not** create final acceptance/canonical completion claims yet.

- [ ] **Step 1: Run full deterministic quality gate**

```bash
pnpm install --frozen-lockfile
pnpm validate:m7-docs
pnpm test
pnpm benchmark:recognition:core
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS. Recognition is not being developed, but the accepted benchmark remains a regression guard.

- [ ] **Step 2: Verify exact-head GitHub Actions**

Required on the same feature SHA:

- Standard CI PASS;
- M7 Browser Audit including M8.1 Chromium scenarios PASS;
- representative WebKit PASS;
- any repository-required security/dependency checks PASS.

- [ ] **Step 3: Audit architecture by diff**

Explicitly verify:

- no `VlezetDocument` schema/migration change;
- no IndexedDB/project/backup format change;
- no AI/network dependency added to core editing;
- no topology/opening/M2 authority weakened;
- no structural clipboard/batch move accidentally enabled;
- no arbitrary group scale;
- no viewport/selection/clipboard persisted as document truth;
- no lowered existing tests/thresholds.

- [ ] **Step 4: Update the focused changelog to `AWAITING PRODUCT-OWNER ACCEPTANCE`**

Record exact feature head, meaningful RED/GREEN commits/runs, regressions discovered/fixed, deliberate deferrals and exact-head automated evidence. Do not invent acceptance or merge SHA.

- [ ] **Step 5: Give product owner the smallest unavoidable manual checklist**

Manual acceptance should focus on feel/ergonomics not already mechanically proven:

1. mouse wheel/trackpad pan and modified/pinch zoom feel predictable;
2. multi-selection and marquee feel understandable;
3. moving/copying/pasting a small furniture group feels natural;
4. context menu and keyboard shortcuts are discoverable/non-surprising;
5. no obvious interaction conflict while tracing/selecting existing walls/openings;
6. compact laptop width remains usable.

- [ ] **Step 6: Stop and wait for explicit product-owner PASS/FAIL**

Do not mark Ready, merge, update canonical completion state or start M8.2 before explicit acceptance.

---

### Task 15: Acceptance, protected merge and canonical documentation sync — only after explicit PASS

**Files:**
- Create: `docs/milestones/m8-1-acceptance.md`
- Finalize: `docs/changelog/2026-08-08-m8-1-editor-interaction-foundation.md`
- Update: `docs/CHANGELOG.md`
- Update: `docs/PROJECT_STATE.md`
- Update: `docs/ROADMAP.md`
- Update: `docs/product/UX_ROADMAP.md`

- [ ] **Step 1: Write acceptance record from actual evidence**

Include product-owner statement, accepted exact head, required workflow run IDs/artifacts/digests, manual observations, known accepted limitations and explicit deferrals to M8.2/M8.5.

- [ ] **Step 2: Update focused and canonical CHANGELOG truthfully**

The focused record must contain: why, user-visible behaviour, architecture boundaries, TDD RED/GREEN evidence, regressions fixed, intentional deferrals, exact-head verification and product-owner acceptance. `docs/CHANGELOG.md` receives a concise canonical summary pointing to the focused record.

- [ ] **Step 3: Update state/roadmaps**

Mark M8.1 complete only after acceptance; select M8.2 as `NOW` only when integration is actually complete or the post-merge sync records the merge.

- [ ] **Step 4: Run docs + full exact-head gates again**

Documentation changes must not invalidate the exact accepted code evidence without a new exact-head verification.

- [ ] **Step 5: Protected squash merge**

Merge only with required checks green and expected-head protection. Record the actual squash SHA.

- [ ] **Step 6: Post-merge canonical sync if merge SHA could not be truthfully known pre-merge**

Update acceptance/changelog/state with the real merge identity through the repository's normal docs-sync workflow. Never prewrite a predicted merge SHA.

---

## Self-review against the approved M8.1 design

### Spec coverage

- unified selection + primary: Tasks 1, 4;
- click/toggle/marquee/select-all: Tasks 4, 9, 10;
- hit priority: Tasks 9, 10;
- compatibility with existing single inspectors: Task 4;
- capability-aware fail-closed actions: Task 2;
- furniture rigid group move: Tasks 3, 5;
- one semantic Undo/Redo: Tasks 3, 5, 6;
- versioned runtime clipboard: Task 6;
- fresh IDs and `+200,+200` deterministic paste/duplicate: Task 6;
- no structural clipboard: Tasks 2, 6 and architecture audit;
- central command registry: Task 7;
- native editable shortcut safety: Task 7 + browser Task 13;
- wheel/trackpad pan, modified zoom, Space/middle pan: Task 8 + browser Task 13;
- fit plan/selection and view shortcuts: Task 11;
- semantic geometry for selection/marquee: Task 9;
- group bounds without scaling handles: Task 10;
- multi-selection inspector: Task 12;
- minimal context menu as command consumer: Task 12;
- runtime-only interaction state/no schema migration: all tasks + Task 14 audit;
- Chromium/WebKit evidence: Task 13;
- TDD and honest RED evidence: every implementation task;
- focused + canonical CHANGELOG discipline: Tasks 1–15;
- explicit owner gate before merge/next slice: Tasks 14–15.

### Intentional non-goals preserved

- direct vertex editing: M8.2;
- structural group move/clipboard/dependency closure: M8.2;
- inline exact wall length/angle and advanced snapping: M8.2;
- calibration/source-feature snapping: M8.3;
- assisted tracing: M8.4;
- group furniture rotate/alignment/distribution/rich resize: M8.5;
- arbitrary graphical scale: never part of semantic M8.1 interaction;
- collaboration/cloud/mobile-parity: not beta-critical M8.1 work.

### Placeholder scan

This plan contains no `TBD`, no unspecified implementation step, no generic “write tests” placeholder and no instruction to weaken an existing contract. Where final evidence is inherently unknowable before execution (actual commit SHA, run ID, artifact digest, merge SHA, product-owner statement), the plan explicitly requires recording the real future value rather than inventing one.

### Type consistency

The plan uses one `EditorSelection`/`EditorEntityRef` model across capabilities, geometry, store, commands and UI. Clipboard is placed-object-only `VlezetClipboardPayloadV1`. Batch editor-core transforms use `PlacedObjectPatch` and `Point2`. Structural entities remain selectable but are excluded from new batch-mutation interfaces.

## Approval gate

This implementation plan is a design artifact, not authorization to execute code. Per the product-owner instruction on 2026-08-08, implementation begins only after an explicit confirmation of this exact plan.
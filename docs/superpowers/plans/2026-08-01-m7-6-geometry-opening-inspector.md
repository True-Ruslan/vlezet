# M7.6 Geometry and Opening Inspector Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make room spans, wall axis/thickness, opening position and door swing visually predictable without changing Vlezet geometry, persistence or history authority.

**Architecture:** Add a React-free presentation model that maps current wall geometry to visible endpoints, surfaces, opening references and door choices. Store-free visual components consume that model; existing editor-store commands remain the only mutation path. A small Zustand vanilla store holds presentation-only room-span and door-swing previews, and Canvas reuses existing authoritative dimension/door rendering with temporary visual overrides.

**Tech Stack:** TypeScript 6, React 19, Zustand 5 vanilla stores, Vitest 4, Next.js 16, react-konva/Konva, Playwright Chromium and WebKit, pnpm/Turborepo.

## Global Constraints

- `VlezetDocument`, schema version, migrations, IndexedDB records and portable backup format must not change.
- Existing editor-core commands and validation remain the only mutation authority.
- No wall topology, room derivation, area calculation, snapping, hit testing or semantic-history grouping changes.
- No automatic clamping, repair, room generation or complex-room dimension guessing.
- Preview state is runtime-only UI intent and is never serialized or used to determine Apply success.
- User-facing copy must not expose `start`, `end`, `left`, `right`, wall direction or milestone identifiers.
- Inputs accept decimal comma and period; persisted geometry remains canonical millimetres.
- Every successful edit remains explicit and one-step undoable through the existing command labels.
- All new interactive targets are at least 40 px, keyboard reachable, visibly focused and not colour-only.
- Chromium full flow, WebKit core smoke and product-owner acceptance are required before merge.

## File Structure

### Create

- `apps/web/components/editor/geometry-inspector-presentation.ts` — pure orientation, endpoint, face, opening-offset and door-choice mappings.
- `apps/web/components/editor/geometry-inspector-presentation.test.ts` — exhaustive pure mapping tests.
- `apps/web/components/editor/geometry-inspector-preview-store.ts` — ephemeral room-span and door-swing preview state.
- `apps/web/components/editor/geometry-inspector-preview-store.test.ts` — project/entity-safe preview lifecycle tests.
- `apps/web/components/editor/geometry-span-cue.tsx` — store-free horizontal/vertical interior-span cue.
- `apps/web/components/editor/wall-axis-cue.tsx` — store-free wall centreline and endpoint cue.
- `apps/web/components/editor/wall-thickness-cue.tsx` — store-free physical-face/axis cue.
- `apps/web/components/editor/opening-position-cue.tsx` — store-free wall/opening/reference cue.
- `apps/web/components/editor/door-swing-selector.tsx` — accessible four-choice radio group.
- `apps/web/components/editor/geometry-inspector-components.test.tsx` — static/component semantics and copy tests.
- `apps/web/components/editor/opening-inspector.test.tsx` — opening form, reference and door-choice contract.
- `apps/web/app/m7-geometry-inspector.css` — bounded visual-cue and inspector-card layout.
- `tools/m7-browser-audit/m7-geometry-inspector.spec.mjs` — representative Chromium/WebKit acceptance flow.
- `docs/milestones/m7-6-acceptance.md` — scope, evidence and product-owner gate.

### Modify

- `apps/web/components/editor/wall-inspector.tsx` — migrate room, wall and opening forms to presentation models and local errors.
- `apps/web/components/editor/editor-canvas.tsx` — consume runtime preview and reuse existing door/dimension rendering.
- `apps/web/components/editor/dimension-annotations.ts` — add optional presentation-only emphasis to existing annotations.
- `apps/web/components/editor/dimension-annotations.test.ts` — verify no measurement changes and active-axis emphasis only.
- `apps/web/components/editor/dimension-overlay.tsx` — render emphasized existing annotation without recalculation.
- `apps/web/components/editor/room-inspector.test.tsx` — new horizontal/vertical card contract.
- `apps/web/components/editor/wall-inspector.test.tsx` — visible endpoint/face wording and no internal terminology.
- `apps/web/app/editor-layout.test.ts` — compact CSS and no-overflow contracts.
- `apps/web/app/layout.tsx` — import the M7.6 stylesheet.
- `tools/m7-browser-audit/playwright.config.mjs` — include M7.6 Chromium flow.
- `tools/m7-browser-audit/playwright.webkit.config.mjs` — include M7.6 WebKit core flow.

---

### Task 1: Pure wall orientation and visible endpoint model

**Files:**
- Create: `apps/web/components/editor/geometry-inspector-presentation.test.ts`
- Create: `apps/web/components/editor/geometry-inspector-presentation.ts`

**Interfaces:**
- Consumes: `Point2` from `@vlezet/geometry`, `WallLengthAnchor` and `WallThicknessAlignment` from `@vlezet/editor-core`.
- Produces:

```ts
export type WallVisualAxis = "horizontal" | "vertical" | "diagonal";
export type VisualEndpointRole = "visual-start" | "center" | "visual-end";
export type WallVisualModel = Readonly<{
  axis: WallVisualAxis;
  internalStartIsVisualStart: boolean;
  visualStartLabel: string;
  visualEndLabel: string;
  visualStartShort: string;
  visualEndShort: string;
  tangent: Point2;
  leftNormal: Point2;
}>;

export function deriveWallVisualModel(start: Point2, end: Point2): WallVisualModel;
export function wallLengthAnchorForVisualRole(model: WallVisualModel, role: VisualEndpointRole): WallLengthAnchor;
export function physicalFaceChoices(model: WallVisualModel): readonly Readonly<{
  id: "first-face" | "axis" | "second-face";
  label: string;
  alignment: WallThicknessAlignment;
}>[];
```

- [ ] **Step 1: Write failing orientation and anchor tests**

```ts
it("keeps left/right labels stable when internal horizontal endpoints reverse", () => {
  const forward = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });
  const reverse = deriveWallVisualModel({ x: 4000, y: 0 }, { x: 0, y: 0 });
  expect(forward.visualStartLabel).toBe("Левый конец");
  expect(reverse.visualStartLabel).toBe("Левый конец");
  expect(wallLengthAnchorForVisualRole(forward, "visual-start")).toBe("start");
  expect(wallLengthAnchorForVisualRole(reverse, "visual-start")).toBe("end");
});

it("uses top/bottom labels for both vertical directions", () => {
  expect(deriveWallVisualModel({ x: 10, y: 0 }, { x: 10, y: 3000 }).visualStartLabel).toBe("Верхний конец");
  expect(deriveWallVisualModel({ x: 10, y: 3000 }, { x: 10, y: 0 }).visualEndLabel).toBe("Нижний конец");
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter web exec vitest run components/editor/geometry-inspector-presentation.test.ts
```

Expected: FAIL because the module/functions do not exist.

- [ ] **Step 3: Implement deterministic visual ordering**

Use these rules:

```ts
const EPSILON = 1e-6;
// Horizontal: smaller x is visual-start.
// Vertical: smaller y is visual-start.
// Diagonal: smaller y is visual-start; equal y falls back to smaller x.
// Zero-length input throws Error("Стена должна иметь ненулевую длину.").
```

Normalize tangent and left normal from the authoritative start/end points. Map visual roles to `start/end/center` without mutating geometry. Physical face labels use top/bottom for mostly horizontal walls, left/right for mostly vertical walls and upper-left/lower-right diagonal descriptions.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same Vitest command. Expected: PASS.

- [ ] **Step 5: Commit the independently reviewable model**

```bash
git add apps/web/components/editor/geometry-inspector-presentation.ts apps/web/components/editor/geometry-inspector-presentation.test.ts
git commit -m "feat: add geometry inspector orientation model"
```

---

### Task 2: Opening reference conversion and door-choice descriptions

**Files:**
- Modify: `apps/web/components/editor/geometry-inspector-presentation.ts`
- Modify: `apps/web/components/editor/geometry-inspector-presentation.test.ts`

**Interfaces:**
- Consumes: `WallVisualModel` from Task 1.
- Produces:

```ts
export type OpeningOffsetReference = "visual-start" | "visual-end";
export type DoorSwingValue = Readonly<{ hinge: "start" | "end"; side: "left" | "right" }>;
export type DoorSwingChoice = Readonly<{
  id: "start-left" | "start-right" | "end-left" | "end-right";
  value: DoorSwingValue;
  hingeLabel: string;
  directionLabel: string;
  accessibleLabel: string;
  openDirection: Point2;
}>;

export function displayedOpeningOffsetMm(input: Readonly<{
  model: WallVisualModel;
  wallLengthMm: number;
  openingWidthMm: number;
  canonicalOffsetMm: number;
  reference: OpeningOffsetReference;
}>): number;

export function canonicalOpeningOffsetMm(input: Readonly<{
  model: WallVisualModel;
  wallLengthMm: number;
  openingWidthMm: number;
  displayedOffsetMm: number;
  reference: OpeningOffsetReference;
}>): number;

export function deriveDoorSwingChoices(model: WallVisualModel): readonly DoorSwingChoice[];
```

- [ ] **Step 1: Add failing conversion and four-choice tests**

```ts
it("converts an opening from either visible end on a reverse-directed wall", () => {
  const model = deriveWallVisualModel({ x: 4000, y: 0 }, { x: 0, y: 0 });
  expect(displayedOpeningOffsetMm({ model, wallLengthMm: 4000, openingWidthMm: 900, canonicalOffsetMm: 600, reference: "visual-start" })).toBe(2500);
  expect(canonicalOpeningOffsetMm({ model, wallLengthMm: 4000, openingWidthMm: 900, displayedOffsetMm: 2500, reference: "visual-start" })).toBe(600);
});

it("describes four distinct visible door swings without enum copy", () => {
  const choices = deriveDoorSwingChoices(deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 }));
  expect(choices).toHaveLength(4);
  expect(new Set(choices.map((choice) => choice.accessibleLabel)).size).toBe(4);
  expect(choices.map((choice) => choice.accessibleLabel).join(" ")).not.toMatch(/start|end|left|right/);
});
```

Also test finite guards, negative result rejection, vertical walls and representative diagonals.

- [ ] **Step 2: Run the focused test and verify RED**

Run the Task 1 command. Expected: FAIL on missing exports.

- [ ] **Step 3: Implement canonical conversion**

The internal-end formula remains exact:

```ts
wallLengthMm - offsetMm - openingWidthMm
```

Resolve whether a visual reference corresponds to the internal start or end through `model.internalStartIsVisualStart`. Reject non-finite inputs and values below `-1e-6`; normalize only floating-point noise in `[-1e-6, 0)` to zero.

For door choices, derive the open direction from the same tangent/left-normal convention used by Canvas:

```ts
const sideSign = side === "right" ? -1 : 1;
const openDirection = {
  x: model.leftNormal.x * sideSign,
  y: model.leftNormal.y * sideSign,
};
```

Map dominant screen direction to `вверх`, `вниз`, `влево` or `вправо`; map hinge to visible opening end based on `internalStartIsVisualStart`.

- [ ] **Step 4: Run focused tests and verify GREEN**

Expected: all presentation tests PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/geometry-inspector-presentation.ts apps/web/components/editor/geometry-inspector-presentation.test.ts
git commit -m "feat: map opening references and door swings"
```

---

### Task 3: Ephemeral geometry-inspector preview store

**Files:**
- Create: `apps/web/components/editor/geometry-inspector-preview-store.test.ts`
- Create: `apps/web/components/editor/geometry-inspector-preview-store.ts`

**Interfaces:**
- Consumes: `DoorSwingValue` from Task 2.
- Produces:

```ts
export type RoomSpanPreview = Readonly<{ roomId: string; axis: "horizontal" | "vertical" }>;
export type DoorSwingPreview = Readonly<{ openingId: string; value: DoorSwingValue }>;
export type GeometryInspectorPreviewState = Readonly<{
  roomSpan: RoomSpanPreview | null;
  doorSwing: DoorSwingPreview | null;
  setRoomSpan: (preview: RoomSpanPreview | null) => void;
  setDoorSwing: (preview: DoorSwingPreview | null) => void;
  clearForSelection: (selection: Readonly<{ roomId?: string | null; openingId?: string | null }>) => void;
  reset: () => void;
}>;

export const geometryInspectorPreviewStore: StoreApi<GeometryInspectorPreviewState>;
```

- [ ] **Step 1: Write failing lifecycle tests**

```ts
it("clears stale preview when the selected entity changes", () => {
  const store = createGeometryInspectorPreviewStore();
  store.getState().setRoomSpan({ roomId: "room-a", axis: "horizontal" });
  store.getState().setDoorSwing({ openingId: "door-a", value: { hinge: "start", side: "left" } });
  store.getState().clearForSelection({ roomId: "room-b", openingId: "door-b" });
  expect(store.getState().roomSpan).toBeNull();
  expect(store.getState().doorSwing).toBeNull();
});
```

Also assert reset, same-selection retention and absence of document-shaped fields.

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/geometry-inspector-preview-store.test.ts
```

- [ ] **Step 3: Implement a Zustand vanilla store**

Export both `createGeometryInspectorPreviewStore()` for isolation tests and the singleton `geometryInspectorPreviewStore`. Store only IDs, axis and existing door pair.

- [ ] **Step 4: Run focused test and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/geometry-inspector-preview-store.ts apps/web/components/editor/geometry-inspector-preview-store.test.ts
git commit -m "feat: add geometry inspector preview state"
```

---

### Task 4: Store-free visual cue components and bounded CSS

**Files:**
- Create: `apps/web/components/editor/geometry-span-cue.tsx`
- Create: `apps/web/components/editor/wall-axis-cue.tsx`
- Create: `apps/web/components/editor/wall-thickness-cue.tsx`
- Create: `apps/web/components/editor/opening-position-cue.tsx`
- Create: `apps/web/components/editor/door-swing-selector.tsx`
- Create: `apps/web/components/editor/geometry-inspector-components.test.tsx`
- Create: `apps/web/app/m7-geometry-inspector.css`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/editor-layout.test.ts`

**Interfaces:**
- Consumes: Task 1/2 presentation types only.
- Produces:

```ts
export function GeometrySpanCue(props: Readonly<{ axis: "horizontal" | "vertical"; activeAnchor: "min" | "center" | "max" }>): JSX.Element;
export function WallAxisCue(props: Readonly<{ model: WallVisualModel; fixedRole: VisualEndpointRole }>): JSX.Element;
export function WallThicknessCue(props: Readonly<{ choices: readonly { id: string; label: string }[]; selectedId: string; interiorChoice: boolean }>): JSX.Element;
export function OpeningPositionCue(props: Readonly<{ model: WallVisualModel; reference: OpeningOffsetReference; offsetRatio: number; widthRatio: number }>): JSX.Element;
export function DoorSwingSelector(props: Readonly<{ choices: readonly DoorSwingChoice[]; value: DoorSwingValue; onChange: (value: DoorSwingValue) => void }>): JSX.Element;
```

- [ ] **Step 1: Write failing static markup and CSS-contract tests**

Assert:

```ts
expect(html).toContain('role="radiogroup"');
expect(html.match(/role="radio"/g)).toHaveLength(4);
expect(html).toContain('aria-checked="true"');
expect(html).not.toMatch(/start|end|left|right/);
```

In `editor-layout.test.ts`, import the new stylesheet and require:

```text
.geometry-inspector-card { min-width: 0; overflow: hidden; }
.geometry-cue { width: 100%; max-width: 100%; }
.door-swing-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
@media (max-width: 420px) { .door-swing-grid { grid-template-columns: minmax(0, 1fr); } }
```

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/geometry-inspector-components.test.tsx app/editor-layout.test.ts
```

- [ ] **Step 3: Implement semantic HTML/SVG components**

Use SVG with `aria-hidden="true"` only for the drawing; keep labels and radio semantics in ordinary HTML. Implement roving keyboard behavior with Arrow keys, Home, End, Space and Enter inside `DoorSwingSelector`. Use existing M7.3 CSS variables and 40 px minimum buttons.

- [ ] **Step 4: Add CSS import and verify GREEN**

Import `./m7-geometry-inspector.css` after `m7-onboarding-status.css` and before migration/planning overrides.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/*cue.tsx apps/web/components/editor/door-swing-selector.tsx apps/web/components/editor/geometry-inspector-components.test.tsx apps/web/app/m7-geometry-inspector.css apps/web/app/layout.tsx apps/web/app/editor-layout.test.ts
git commit -m "feat: add geometry inspector visual controls"
```

---

### Task 5: Room inspector horizontal and vertical span cards

**Files:**
- Modify: `apps/web/components/editor/room-inspector.test.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/dimension-annotations.ts`
- Modify: `apps/web/components/editor/dimension-annotations.test.ts`
- Modify: `apps/web/components/editor/dimension-overlay.tsx`

**Interfaces:**
- Consumes: `GeometrySpanCue`, `geometryInspectorPreviewStore` and existing `setSelectedRoomClearDimension()`.
- Produces: `LinearDimensionAnnotation.emphasized?: boolean`, presentation-only.

- [ ] **Step 1: Replace old room test expectations with failing M7.6 contract**

Require:

```ts
expect(html).toContain("Внутренние размеры");
expect(html).toContain("По горизонтали");
expect(html).toContain("По вертикали");
expect(html).toContain("между внутренними поверхностями стен");
expect(html).toContain("Применить горизонтальный размер");
expect(html).toContain("Применить вертикальный размер");
expect(html).not.toContain("Применить ширину");
expect(html).not.toContain("Применить длину");
```

Add annotation test proving values remain `3550` and `3300`, with only the requested axis marked `emphasized`.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/room-inspector.test.tsx components/editor/dimension-annotations.test.ts
```

- [ ] **Step 3: Implement two local forms**

Use separate `widthError` and `heightError`. Each card sets room-span preview on focus/pointer entry and clears it on leave/unmount. Apply calls the unchanged editor-store action with `width`/`height` and `min`/`center`/`max`.

- [ ] **Step 4: Emphasize existing annotation only**

Do not calculate another dimension. In `EditorCanvas`, or through a pure optional parameter, mark the existing matching annotation. `DimensionOverlay` changes stroke/label emphasis only.

- [ ] **Step 5: Run tests and commit GREEN**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/room-inspector.test.tsx apps/web/components/editor/dimension-annotations.ts apps/web/components/editor/dimension-annotations.test.ts apps/web/components/editor/dimension-overlay.tsx
git commit -m "feat: clarify room interior spans"
```

---

### Task 6: Wall axis and thickness inspector migration

**Files:**
- Modify: `apps/web/components/editor/wall-inspector.test.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`

**Interfaces:**
- Consumes: `deriveWallVisualModel`, `wallLengthAnchorForVisualRole`, `physicalFaceChoices`, `WallAxisCue`, `WallThicknessCue`, existing `resolveWallThicknessAlignment()`.
- Produces: no new mutation API.

- [ ] **Step 1: Write failing visible-label tests**

For forward and reverse walls require the same visible labels. For an adjacent-room wall require:

```ts
expect(html).toContain("Что оставить на месте");
expect(html).toContain("Внутренняя поверхность");
expect(html).toContain("Ось стены");
expect(html).toContain("Наружная поверхность");
expect(html).not.toContain("Куда меняется толщина");
expect(html).not.toContain("Начало");
expect(html).not.toContain("Конец");
```

For an isolated wall require orientation-aware physical surfaces and no inside/outside guess.

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/wall-inspector.test.tsx
```

- [ ] **Step 3: Implement visual-role state and local errors**

Store `VisualEndpointRole` in component state, derive the command anchor at Apply, and preserve the current editor-store call. Replace the shared error with `lengthError` and `thicknessError`. Keep the authoritative current length from `topologicalWallLength()`.

For unambiguous room side, keep `inside | center | outside` intent and map through `resolveWallThicknessAlignment()`. For isolated walls, use the pure physical-face choice alignment.

- [ ] **Step 4: Run focused tests and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/wall-inspector.test.tsx
git commit -m "feat: clarify wall axis and thickness controls"
```

---

### Task 7: Opening reference form and accessible door selector

**Files:**
- Create: `apps/web/components/editor/opening-inspector.test.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`

**Interfaces:**
- Consumes: Task 1/2 mappings, cue/selector components, preview store, `topologicalWallLength()` and existing `updateSelectedOpening()`.
- Produces: exported `SelectedOpeningInspector` accepting:

```ts
Readonly<{ document: VlezetDocument; wall: Wall; opening: Opening }>
```

- [ ] **Step 1: Write failing opening-form tests**

Require section labels, visible references, four radios and no internal copy:

```ts
expect(html).toContain("Размер проёма");
expect(html).toContain("Положение на стене");
expect(html).toContain("От левого конца");
expect(html).toContain("От правого конца");
expect(html).toContain("Направление двери");
expect(html.match(/role="radio"/g)).toHaveLength(4);
expect(html).not.toContain("От начала стены");
expect(html).not.toContain("направления стены");
```

Add reverse-directed and window-without-door-selector cases.

- [ ] **Step 2: Run focused tests and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/opening-inspector.test.tsx
```

- [ ] **Step 3: Implement draft reference conversion**

Keep `widthInput`, `offsetInput`, `reference` and `doorSwing` local. When reference changes:

1. parse current width and displayed offset;
2. convert to canonical using the old reference;
3. convert canonical to the new reference;
4. format without grouping;
5. if parsing/conversion fails, retain input and show a local position error.

Apply converts the displayed offset back to canonical and calls one unchanged `updateSelectedOpening()` command with width, offset and door swing.

- [ ] **Step 4: Wire preview lifecycle**

Set door preview immediately on radio change. Clear on successful Apply, component unmount, selected opening disappearance and workflow/context replacement. Do not preview width/offset geometry.

- [ ] **Step 5: Run tests and commit GREEN**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/opening-inspector.test.tsx
git commit -m "feat: add visual opening and door controls"
```

---

### Task 8: Reuse Canvas door and dimension renderers for runtime preview

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-source.test.ts`
- Modify: `apps/web/components/editor/dimension-annotations.ts`
- Modify: `apps/web/components/editor/dimension-overlay.tsx`

**Interfaces:**
- Consumes: singleton preview store.
- Produces: no new geometry functions.

- [ ] **Step 1: Add failing source/behavior contracts**

Require the Canvas to subscribe to `roomSpan` and `doorSwing`, derive an effective door swing only for the matching selected opening, and keep `openingSegment()`/existing arc renderer as the geometry path. Require no persisted document replacement from preview.

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/editor-canvas-source.test.ts components/editor/dimension-annotations.test.ts
```

- [ ] **Step 3: Implement presentation-only overrides**

Inside existing opening rendering:

```ts
const effectiveDoorSwing = doorSwingPreview?.openingId === opening.id
  ? doorSwingPreview.value
  : opening.doorSwing;
```

Use `effectiveDoorSwing` only where the current leaf and arc are built. Do not modify `document.openings` or evaluation documents.

For room emphasis, map the already-derived room annotations and set `emphasized` when room ID and axis match preview state.

- [ ] **Step 4: Run focused tests and verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/editor-canvas-source.test.ts apps/web/components/editor/dimension-annotations.ts apps/web/components/editor/dimension-overlay.tsx
git commit -m "feat: preview geometry inspector intent on canvas"
```

---

### Task 9: Full regression, browser acceptance automation and milestone record

**Files:**
- Create: `tools/m7-browser-audit/m7-geometry-inspector.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`
- Create: `docs/milestones/m7-6-acceptance.md`

**Interfaces:**
- Consumes: completed product UI.
- Produces: reproducible exact-head evidence and manual acceptance checklist.

- [ ] **Step 1: Add the browser spec to both configs before implementation is considered complete**

Chromium covers the full representative flow; WebKit runs the core subset from the same file by project/browser conditional where needed.

- [ ] **Step 2: Implement browser flow**

The spec must:

1. create a rectangular room;
2. select the room and change horizontal span, verify Canvas/internal size and one Undo;
3. change vertical span and Undo;
4. select horizontal and vertical walls, verify visible fixed-end labels;
5. change axis length and thickness, verify one Undo each;
6. add/select a door;
7. switch opening offset reference and verify equivalent canonical placement;
8. activate all four door choices and verify preview changes before Apply;
9. Apply one choice and verify Undo;
10. submit invalid width/offset and verify no document mutation plus local recovery copy;
11. exercise a reverse-directed wall case;
12. run at compact width and assert no document horizontal overflow.

- [ ] **Step 3: Run focused unit/type/lint/build gates**

```bash
pnpm --filter web test
pnpm --filter web typecheck
pnpm lint
pnpm build
pnpm validate:m7-docs
```

Expected: PASS.

- [ ] **Step 4: Run browser audit locally or through the PR workflow**

```bash
cd tools/m7-browser-audit
pnpm exec playwright test -c playwright.config.mjs m7-geometry-inspector.spec.mjs
pnpm exec playwright test -c playwright.webkit.config.mjs m7-geometry-inspector.spec.mjs
```

Expected: Chromium PASS, WebKit PASS, no overflow and evidence uploaded by CI.

- [ ] **Step 5: Create/update Draft PR and record exact-head evidence**

PR title:

```text
feat: M7.6 geometry and opening inspector
```

Acceptance record starts as `AUTOMATED PASS / PRODUCT-OWNER BROWSER ACCEPTANCE PENDING`. Include exact head, standard CI run, browser run, artifact ID/digest, resolved defects, authority boundaries and manual browser steps.

- [ ] **Step 6: Commit final documentation**

```bash
git add tools/m7-browser-audit docs/milestones/m7-6-acceptance.md
git commit -m "test: add M7.6 browser acceptance"
```

- [ ] **Step 7: Final exact-head verification**

Re-run standard CI and browser audit on the documentation head. Inspect unresolved review threads and mergeability. Do not mark ready or merge until product-owner browser acceptance is recorded.

## Plan Self-Review Result

- Spec coverage: all design sections map to Tasks 1–9.
- Placeholder scan: no `TBD`, `TODO`, “implement later” or unspecified validation steps remain.
- Type consistency: Task 1 presentation types are consumed unchanged by Tasks 2, 4, 6 and 7; Task 2 door value is consumed unchanged by Tasks 3, 4, 7 and 8.
- Scope: one cohesive inspector slice; no independent subsystem requires a separate spec.
- Authority check: all document mutations remain existing editor-store/editor-core calls; preview is presentation-only.

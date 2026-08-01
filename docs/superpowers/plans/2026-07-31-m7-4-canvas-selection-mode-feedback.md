# M7.4 Canvas Selection and Mode Feedback Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make active Canvas tools, next actions, selection/hover/preview states and one-level Escape cancellation explicit without changing geometry, snapping, hit testing, history or persistence authority.

**Architecture:** Add pure feedback, visual-role and Escape-priority contracts, then integrate them into the existing toolbar, ApartmentEditor and Konva Canvas. Measurement phase remains ephemeral in the existing measurement store; ordinary selection and tools remain authoritative in `editorStore`.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand vanilla stores, Konva/react-konva, Vitest, Playwright Chromium/WebKit, pnpm/Turborepo.

## Global Constraints

- `VlezetDocument` remains the only persistent apartment/layout source of truth.
- Millimetres remain canonical; Canvas/WebGL pixels are never persisted as geometry.
- No geometry, snapping, hit-testing, fit, planning, recognition or 3D authority changes.
- No schema, migration, IndexedDB, backup/import/export or autosave changes.
- Hover and pointer preview state remain ephemeral and Canvas-local.
- One Escape press executes exactly one highest-priority cancellation action.
- Status meaning must not rely on colour alone.
- Essential status text is at least 12 px and remains readable at compact widths.
- Every code task follows RED → verified failure → GREEN → full regression.

---

### Task 1: Pure Canvas feedback contract

**Files:**
- Create: `apps/web/components/editor/editor-canvas-feedback.ts`
- Create: `apps/web/components/editor/editor-canvas-feedback.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CanvasFeedbackMode =
    | "select"
    | "wall-start"
    | "wall-finish"
    | "door"
    | "window"
    | "measure-start"
    | "measure-finish"
    | "measure-complete"
    | "place-object"
    | "tracing"
    | "recognition-review"
    | "spatial";

  export type CanvasCursorRole = "default" | "pointer" | "crosshair" | "copy" | "not-allowed" | "grab" | "grabbing";

  export type CanvasFeedback = Readonly<{
    mode: CanvasFeedbackMode;
    label: string;
    instruction: string;
    escapeInstruction: string | null;
    cursor: CanvasCursorRole;
    previewState: "none" | "valid" | "invalid";
  }>;

  export function deriveCanvasFeedback(input: Readonly<{
    viewMode: "2d" | "3d";
    recognitionReviewActive: boolean;
    tracingMode: boolean;
    placementPresetId: string | null;
    placementPreviewValid: boolean | null;
    measurementActive: boolean;
    measurementPhase: "idle" | "measuring" | "complete";
    tool: "select" | "wall" | "door" | "window";
    hasWallDraft: boolean;
    openingPreviewValid: boolean | null;
    hoveredSelectable: boolean;
    panState: "idle" | "ready" | "active";
  }>): CanvasFeedback;
  ```

- [ ] **Step 1: Write failing mode-priority tests**

Cover 3D, recognition, tracing, placement, measurement, wall draft, door/window and Select priority. Assert exact Russian labels, next-action copy and cursor roles.

- [ ] **Step 2: Run focused tests and verify RED**

Run:

```bash
pnpm --filter web test -- editor-canvas-feedback.test.ts
```

Expected: FAIL because `editor-canvas-feedback.ts` does not exist.

- [ ] **Step 3: Implement minimal pure derivation**

Use ordered early returns matching the design priority. Do not read stores or DOM.

- [ ] **Step 4: Run focused tests and verify GREEN**

Run the same command. Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/editor-canvas-feedback.ts apps/web/components/editor/editor-canvas-feedback.test.ts
git commit -m "feat: derive authoritative Canvas mode feedback"
```

---

### Task 2: Pure visual-role contract

**Files:**
- Create: `apps/web/components/editor/canvas-entity-visual.ts`
- Create: `apps/web/components/editor/canvas-entity-visual.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export type CanvasEntityVisualState = "ordinary" | "hover" | "selected" | "preview-valid" | "preview-invalid";

  export type CanvasEntityVisual = Readonly<{
    strokeRole: "ordinary" | "hover" | "accent" | "danger";
    dash: readonly number[] | null;
    marker: "none" | "preview" | "invalid";
    emphasized: boolean;
  }>;

  export function deriveCanvasEntityVisual(state: CanvasEntityVisualState): CanvasEntityVisual;
  ```

- [ ] **Step 1: Write failing semantic-distinction tests**

Assert that hover differs from ordinary, selected is stronger than hover, both previews use dash, and invalid preview has an explicit invalid marker in addition to danger colour.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- canvas-entity-visual.test.ts
```

- [ ] **Step 3: Implement the five-role mapping**

Keep all values semantic; component-specific colours remain in rendering helpers/CSS.

- [ ] **Step 4: Verify GREEN**

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/canvas-entity-visual.ts apps/web/components/editor/canvas-entity-visual.test.ts
git commit -m "feat: define Canvas entity visual roles"
```

---

### Task 3: Measurement phase contract

**Files:**
- Modify: `apps/web/components/editor/measurement-tool-store.ts`
- Create: `apps/web/components/editor/measurement-tool-store.test.ts`
- Modify: `apps/web/components/editor/tape-measurement-tool.tsx`
- Modify: `apps/web/components/editor/tape-measurement-tool.test.tsx` if present; otherwise create focused source/static regression test.

**Interfaces:**
- Produces:
  ```ts
  export type MeasurementPhase = "idle" | "measuring" | "complete";

  type MeasurementToolState = {
    active: boolean;
    phase: MeasurementPhase;
    setActive(active: boolean): void;
    setPhase(phase: MeasurementPhase): void;
    resetMeasurement(): void;
  };
  ```

- [ ] **Step 1: Write failing store tests**

Test:

1. inactive state is `idle`;
2. `setActive(false)` resets phase;
3. `resetMeasurement()` keeps active state but returns phase to `idle`;
4. `setPhase()` is ignored while inactive.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal store phase**

- [ ] **Step 4: Add failing Tape integration test**

Assert that the first committed point reports `measuring`, the second reports `complete`, and deactivation clears local measurement.

- [ ] **Step 5: Verify RED**

- [ ] **Step 6: Integrate Tape state changes**

Remove Tape's independent Escape handling. Update phase only after committed pointer transitions, not hover previews.

- [ ] **Step 7: Verify GREEN and full editor tests**

```bash
pnpm --filter web test -- measurement-tool-store.test.ts tape-measurement
```

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/measurement-tool-store.ts apps/web/components/editor/measurement-tool-store.test.ts apps/web/components/editor/tape-measurement-tool.tsx apps/web/components/editor/*tape-measurement*.test.*
git commit -m "feat: expose ephemeral measurement phase"
```

---

### Task 4: One-level Escape priority

**Files:**
- Create: `apps/web/components/editor/editor-escape-priority.ts`
- Create: `apps/web/components/editor/editor-escape-priority.test.ts`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/apartment-editor-shell.test.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts` only if a focused `clearSelection()` command is needed.
- Modify: `apps/web/components/editor/use-editor-store.test.ts` when store API changes.

**Interfaces:**
- Produces:
  ```ts
  export type EditorEscapeAction =
    | "cancel-object-gesture"
    | "reset-measurement"
    | "cancel-wall-draft"
    | "cancel-placement"
    | "finish-tracing"
    | "exit-measurement"
    | "close-workflow"
    | "exit-tool"
    | "clear-selection"
    | "return-to-2d"
    | "none";

  export function deriveEditorEscapeAction(input: Readonly<{
    viewMode: "2d" | "3d";
    hasObjectGesture: boolean;
    measurementActive: boolean;
    measurementPhase: "idle" | "measuring" | "complete";
    hasWallDraft: boolean;
    hasPlacement: boolean;
    tracingMode: boolean;
    workflowOpen: boolean;
    tool: "select" | "wall" | "door" | "window";
    hasSelection: boolean;
  }>): EditorEscapeAction;
  ```

- [ ] **Step 1: Write failing precedence matrix tests**

Use table-driven cases proving exactly one action and the canonical order.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement pure priority derivation**

- [ ] **Step 4: Add failing ApartmentEditor integration/static contract**

Assert that the cancel shortcut calls the derived action handler and no longer unconditionally calls `cancelCurrentAction()` plus tracing in one pass.

- [ ] **Step 5: Verify RED**

- [ ] **Step 6: Wire one-action side effects**

Map actions to existing store/workflow methods. Add `clearSelection()` only if it avoids repeated ad-hoc calls and remains non-persistent.

- [ ] **Step 7: Verify GREEN**

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/editor-escape-priority.ts apps/web/components/editor/editor-escape-priority.test.ts apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/apartment-editor-shell.test.ts apps/web/components/editor/use-editor-store.ts apps/web/components/editor/use-editor-store.test.ts
git commit -m "feat: enforce one-level Escape cancellation"
```

---

### Task 5: Status strip and toolbar mode semantics

**Files:**
- Create: `apps/web/components/editor/editor-canvas-status.tsx`
- Create: `apps/web/components/editor/editor-canvas-status.test.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.test.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/editor-shell.css`
- Modify: `apps/web/app/editor-viewport.css`
- Modify: `apps/web/app/editor-layout.test.ts`

**Interfaces:**
- Consumes: `CanvasFeedback` from Task 1.
- Produces:
  ```tsx
  export function EditorCanvasStatus({ feedback }: Readonly<{ feedback: CanvasFeedback }>): JSX.Element;
  ```

- [ ] **Step 1: Write failing static-render tests**

Assert:

- active mode label and instruction are visible;
- Escape copy is conditional;
- valid/invalid preview has text marker;
- status uses `role="status"` and stable data attributes;
- active toolbar button exposes `data-active-tool="true"` in addition to `aria-pressed`.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement status component and toolbar metadata**

- [ ] **Step 4: Add failing layout contract**

Require status overlay styles, pointer-events none, 12 px minimum, compact wrapping and no fixed width that can force horizontal overflow.

- [ ] **Step 5: Verify RED**

- [ ] **Step 6: Integrate status into ApartmentEditor/Canvas shell**

Derive feedback from existing store and workflow state. Avoid hover-driven live-region churn.

- [ ] **Step 7: Verify GREEN**

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/editor-canvas-status.tsx apps/web/components/editor/editor-canvas-status.test.tsx apps/web/components/editor/editor-toolbar.tsx apps/web/components/editor/editor-toolbar.test.tsx apps/web/components/editor/apartment-editor.tsx apps/web/app/editor-shell.css apps/web/app/editor-viewport.css apps/web/app/editor-layout.test.ts
git commit -m "feat: show authoritative Canvas mode status"
```

---

### Task 6: Hover, preview and cursor presentation

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/placed-object-shape.tsx`
- Create or modify: `apps/web/components/editor/placed-object-shape.test.tsx`
- Modify: `apps/web/app/editor-viewport.css`
- Create: `apps/web/components/editor/editor-canvas-source.test.ts`

**Interfaces:**
- Consumes: Task 1 cursor role and Task 2 entity visual roles.
- `PlacedObjectShape` adds optional `hovered?: boolean` and `onHoverChange?: (hovered: boolean) => void`.

- [ ] **Step 1: Write failing source/component tests**

Require:

- Canvas-local hovered entity state;
- walls, rooms, openings and placed objects report hover only in Select mode;
- selected styling remains stronger than hover;
- valid previews have dash + explicit preview marker;
- invalid previews have dash + explicit invalid marker;
- Canvas shell exposes cursor role classes;
- switching tool clears stale opening/placement/hover state.

- [ ] **Step 2: Verify RED**

- [ ] **Step 3: Implement minimal hover and preview visuals**

Do not change event hit order, hit widths or snap tolerances. Add non-listening marker text/shapes only.

- [ ] **Step 4: Implement cursor CSS**

Apply cursor to Konva content/canvas from semantic shell classes. Preserve Space pan priority.

- [ ] **Step 5: Verify GREEN**

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/editor-canvas.tsx apps/web/components/editor/placed-object-shape.tsx apps/web/components/editor/placed-object-shape.test.tsx apps/web/components/editor/editor-canvas-source.test.ts apps/web/app/editor-viewport.css
git commit -m "feat: distinguish Canvas hover and preview states"
```

---

### Task 7: Browser evidence and documentation

**Files:**
- Modify: `tools/m7-browser-audit/m7-audit.spec.mjs`
- Modify: `tools/m7-browser-audit/m7-webkit-smoke.spec.mjs`
- Create: `docs/milestones/m7-4-acceptance.md`
- Modify: `docs/PROJECT_STATE.md` only after product-owner acceptance and merge; not in the feature RC.
- Modify: `docs/ROADMAP.md` only after product-owner acceptance and merge; not in the feature RC.
- Modify: `docs/product/UX_ROADMAP.md` only after product-owner acceptance and merge; not in the feature RC.
- Modify: `docs/CHANGELOG.md` only after product-owner acceptance and merge; not in the feature RC.

- [ ] **Step 1: Add failing Chromium transition assertions**

Assert active mode/status for Select, Wall first/second point, one-level Escape, Measure and furniture placement. Include one compact-width assertion.

- [ ] **Step 2: Add failing WebKit core assertions**

Cover active tool label, Wall draft cancellation and return to Select.

- [ ] **Step 3: Verify browser RED on the test-only head**

Expected: browser workflow fails because production status/transition hooks are absent or incomplete.

- [ ] **Step 4: Complete missing integration until browser tests pass**

Do not weaken assertions to accommodate incorrect behaviour.

- [ ] **Step 5: Run full quality gate**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
pnpm --filter web exec playwright test --config=../../tools/m7-browser-audit/playwright.config.mjs
pnpm --filter web exec playwright test --config=../../tools/m7-browser-audit/playwright.webkit.config.mjs
```

Expected: all PASS with no unexpected warnings.

- [ ] **Step 6: Record exact-head acceptance evidence**

Document commit SHA, standard CI run, browser CI run, artifact/digest, covered transitions, known limitations and product-owner gate in `docs/milestones/m7-4-acceptance.md`.

- [ ] **Step 7: Commit**

```bash
git add tools/m7-browser-audit/m7-audit.spec.mjs tools/m7-browser-audit/m7-webkit-smoke.spec.mjs docs/milestones/m7-4-acceptance.md
git commit -m "test: add M7.4 browser acceptance"
```

---

### Task 8: Draft PR and exact-head verification

**Files:** none unless CI reveals a defect.

- [ ] **Step 1: Open Draft PR**

Title:

```text
feat: M7.4 Canvas selection and mode feedback
```

Body must list delivered scope, authority boundaries, RED/GREEN evidence, known limitations and manual acceptance checklist.

- [ ] **Step 2: Verify exact head**

Confirm standard CI and M7 Browser Audit are attached to the current head SHA and both PASS.

- [ ] **Step 3: Keep PR Draft**

Do not mark Ready and do not merge before product-owner browser acceptance.

- [ ] **Step 4: Present manual smoke checklist**

The user should verify active mode, first/second wall point, repeated Escape hierarchy, Measure phases, valid/invalid preview distinction and compact layout.

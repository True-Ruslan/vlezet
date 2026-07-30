# M7.1 Editor Shell and Responsive Context — Implementation Plan

> Execute task-by-task with TDD, task-scoped review and exact-head browser evidence. Do not implement later M7 inspector/content redesign inside this slice.

**Goal:** Replace the clipping single-row editor toolbar and disappearing side panels with a semantically separated two-level shell and viewport-safe catalogue/context surfaces while preserving all existing product behaviour and authority.

**Architecture:** Existing editor stores, callbacks and domain components remain authoritative. M7.1 adds pure presentation helpers, a controller/view split for editor chrome, one ephemeral compact-surface state in `ApartmentEditor`, and CSS that switches docked side columns into non-modal sheets. Browser automation becomes an assertion gate rather than observation-only evidence.

**Stack:** React 19, Next.js 16, Zustand 5, TypeScript 6, Vitest 4, existing CSS, Playwright Chromium/WebKit, native Safari manual regression.

## Global constraints

- Do not change `VlezetDocument`, domain schema, migrations, IndexedDB, project file format or backup format.
- Do not change geometry, fit, planning, recognition or 3D authority.
- Do not change editor command/Undo/Redo semantics or existing keyboard shortcuts.
- Do not redesign domain-specific inspector forms.
- New UI state is ephemeral and never serialized.
- Preserve local-first operation and runtime-only provider state.
- Every feature/workflow currently reachable at wide width remains reachable through docked or sheet presentation.
- Standard CI and M7 browser audit must pass on the exact final head.
- WebKit is an automated proxy; native Safari is a separate manual gate.

## Expected file scope

### Create

- `apps/web/components/editor/editor-context-kind.ts`
- `apps/web/components/editor/editor-context-kind.test.ts`
- `apps/web/components/editor/editor-command-icon.tsx`
- `apps/web/components/editor/editor-toolbar.test.tsx`
- `apps/web/components/editor/use-compact-editor-layout.ts`
- `apps/web/components/editor/editor-side-surface.tsx`
- `apps/web/components/editor/editor-side-surface.test.tsx`
- `docs/milestones/m7-1-acceptance.md`

### Modify

- `apps/web/components/editor/editor-toolbar.tsx`
- `apps/web/components/editor/apartment-editor.tsx`
- `apps/web/app/globals.css`
- `apps/web/app/editor-viewport.css`
- `apps/web/app/editor-layout.test.ts`
- `tools/m7-browser-audit/m7-audit.spec.mjs`
- `tools/m7-browser-audit/m7-webkit-smoke.spec.mjs`
- M7.1 design/plan only as needed for implementation corrections
- canonical state/roadmap/changelog after acceptance

No package under `packages/` should change.

---

## Task 1 — Add pure context identity and compact-surface contracts

**Files:**

- Create `apps/web/components/editor/editor-context-kind.test.ts`
- Create `apps/web/components/editor/editor-context-kind.ts`

### RED

Add tests for:

1. precedence `recognition > reference > planning > object > opening > room > wall > empty`;
2. door/window opening labels;
3. stable Russian trigger labels;
4. selection IDs are read only and never mutated;
5. compact surface transition rules:
   - Furniture action → `catalogue`;
   - Reference/Recognition/new semantic context → `context`;
   - close → `null`;
   - 3D → `null`.

Expected RED: missing module/exports only.

### GREEN

Implement pure types/functions:

```ts
export type EditorContextKind =
  | "empty"
  | "wall"
  | "room"
  | "opening-door"
  | "opening-window"
  | "object"
  | "planning"
  | "reference"
  | "recognition";

export type CompactEditorSurface = "catalogue" | "context" | null;

export function deriveEditorContextKind(input: ...): EditorContextKind;
export function editorContextLabel(kind: EditorContextKind): string;
export function nextCompactEditorSurface(event: ..., current: ...): CompactEditorSurface;
```

Keep the module framework-independent from React and Zustand.

### Verification

- new test suite PASS;
- full web tests PASS;
- TypeScript PASS.

Commit: `feat: define M7.1 editor shell context contracts`.

---

## Task 2 — Build the two-level editor chrome as testable views

**Files:**

- Create `apps/web/components/editor/editor-command-icon.tsx`
- Create `apps/web/components/editor/editor-toolbar.test.tsx`
- Modify `apps/web/components/editor/editor-toolbar.tsx`

### RED

Use `renderToStaticMarkup` against exported presentation components.

Test:

1. global bar renders project name and canonical save-state copy;
2. saved copy is `Сохранено локально`;
3. failed copy is an actionable `Не сохранено — повторить`;
4. Undo and Redo always exist in the global bar;
5. labelled `Действия` contains fit and all applicable export actions;
6. tool bar contains all existing editing tools/workflow/view actions;
7. compact context trigger exposes `aria-controls` and expanded state;
8. complete accessible names remain when labels are visually collapsible;
9. no internal milestone/version label is introduced.

Expected RED: missing view exports and changed copy.

### GREEN

Refactor `EditorToolbar` into:

- hook/controller layer reading existing stores;
- exported pure `EditorProjectBarView`;
- exported pure `EditorToolBarView`;
- small shared `EditorCommandIcon` line-icon set.

Global bar:

- back/project identity/save;
- compact context trigger;
- labelled `Действия` details/menu;
- Undo/Redo.

Tool bar:

- Select/Wall/Door/Window/Measure;
- Furniture/Reference/Recognition;
- Dimensions/2D/3D.

Preserve all existing callbacks, shortcuts and disabled semantics.

### Verification

- toolbar tests PASS;
- existing keyboard tests PASS;
- TypeScript/Lint PASS.

Commit: `feat: separate project and tool command bars`.

---

## Task 3 — Add compact-layout and reusable side-surface presentation

**Files:**

- Create `apps/web/components/editor/use-compact-editor-layout.ts`
- Create `apps/web/components/editor/editor-side-surface.tsx`
- Create `apps/web/components/editor/editor-side-surface.test.tsx`

### RED

Test pure/rendered contracts:

1. side surface has stable ID and labelled complementary region;
2. docked state is visible without a close-sheet control;
3. compact open state includes explicit close control;
4. compact closed state is hidden/inert and removed from accessibility traversal;
5. content remains in the React tree so local form state can survive presentation changes;
6. catalogue and context use the same shell anatomy with opposite sides;
7. reduced-motion class/attribute contract exists.

### GREEN

Implement:

- `useCompactEditorLayout()` through `matchMedia`, with SSR-safe subscription;
- `EditorSideSurface` presentation wrapper;
- docked/compact/open/closed classes and ARIA;
- no modal role or focus trap;
- explicit close button only in compact presentation.

Do not embed domain-specific inspector content or state in the wrapper.

### Verification

- side-surface tests PASS;
- TypeScript/Lint PASS.

Commit: `feat: add responsive editor side surfaces`.

---

## Task 4 — Integrate chrome, catalogue sheet and context sheet

**Files:**

- Modify `apps/web/components/editor/apartment-editor.tsx`
- Modify `apps/web/components/editor/editor-toolbar.tsx` props as required

### RED

Add static/source integration tests where practical for:

1. `ApartmentEditor` renders global bar + tool bar + workspace order;
2. ordinary inspector is wrapped by context surface;
3. reference and recognition continue to occupy the same context surface;
4. compact surface state is not persisted;
5. Furniture action opens catalogue presentation;
6. Reference/Recognition actions promote context presentation;
7. new selection/planning context promotes context presentation;
8. closing a sheet does not clear selection, catalogue-open preference or workflow state;
9. switching to 3D clears only compact presentation and composes a one-column workspace.

### GREEN

Integrate:

- `useCompactEditorLayout`;
- current selection/planning subscriptions for context identity;
- ephemeral `CompactEditorSurface` state;
- wrapped toolbar callbacks;
- `EditorSideSurface` around `FurnitureCatalog` and the existing right-side child;
- context trigger label/open state;
- context auto-promotion on semantic context changes;
- one-column 3D workspace class.

Keep `WallInspector`, `PlanningPanel`, `ReferencePanel`, `RecognitionPanel` and `SpatialViewer` behaviour unchanged.

### Verification

- integration tests PASS;
- full web tests/typecheck/lint PASS.

Commit: `feat: integrate M7.1 responsive editor shell`.

---

## Task 5 — Replace clipping CSS with semantic shell/layout contracts

**Files:**

- Modify `apps/web/app/globals.css`
- Modify `apps/web/app/editor-viewport.css`
- Modify `apps/web/app/editor-layout.test.ts`

### RED

Replace obsolete tests that require hiding optional toolbar copy with tests that require:

1. `.editor-app` has three rows and `minmax(0,1fr)` width containment;
2. global/project and tool bars each use `min-width:0` and cannot widen the root;
3. save status target font is at least 12 px;
4. workspace docked columns use `minmax(0,1fr)`;
5. compact breakpoint positions side surfaces as fixed/absolute sheets instead of `display:none`;
6. ordinary inspector/reference/recognition/catalogue are not unconditionally hidden without a shell replacement;
7. side sheets have viewport-bounded width and explicit elevation;
8. tool labels collapse without removing accessible buttons;
9. internal tool-row overflow never becomes document overflow;
10. 3D workspace is one column.

Expected RED: current one-row/hide-at-980 CSS violates the new contract.

### GREEN

Implement:

- 52 px global bar + 48 px tool bar;
- semantic command groups;
- 12 px readable save status;
- labelled action menu styles;
- responsive icon/label behaviour;
- docked catalogue/context columns at wide width;
- left/right non-modal sheets at compact width;
- explicit compact close controls;
- no old `.inspector-panel { display:none }` or `.furniture-catalog { display:none }` as the only responsive path;
- reduced-motion handling;
- one-column spatial workspace.

### Verification

- `editor-layout.test.ts` PASS;
- full web tests/typecheck/lint/build PASS.

Commit: `style: implement M7.1 editor shell layout`.

---

## Task 6 — Convert M7 browser observations into assertions

**Files:**

- Modify `tools/m7-browser-audit/m7-audit.spec.mjs`
- Modify `tools/m7-browser-audit/m7-webkit-smoke.spec.mjs`

### RED

Before implementation or against a preserved baseline, define assertions that fail for current M7.0 behaviour:

- no document horizontal overflow at required widths;
- toolbar rows do not overflow the document;
- save status font is at least 12 px;
- selected room/object context is reachable at effective 150% and 200%;
- context trigger opens sheet;
- catalogue trigger opens sheet;
- close/reopen retains uncommitted room/object input draft;
- planning/reference remain reachable;
- active tool, Undo/Redo and `Действия` are visible/reachable;
- 3D has no stale side sheet.

Record the failing baseline run if feasible without weakening the accepted M7.0 evidence workflow.

### GREEN

Update the representative flow to the new shell selectors and interactions. Keep screenshots and JSON evidence.

WebKit smoke must exercise:

- dashboard;
- room creation/editing;
- compact context open/close at one reduced width;
- 3D transition;
- deletion dialog.

### Verification

- Chromium audit PASS;
- WebKit smoke PASS;
- evidence artifact uploaded.

Commit: `test: enforce M7.1 browser shell acceptance`.

---

## Task 7 — RC review, native Safari gate and acceptance

**Files:**

- Create `docs/milestones/m7-1-acceptance.md`
- Update M7.1 design/plan only for evidence-backed corrections
- After acceptance: modify `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`

### Automated gate

Run exact-head:

```text
pnpm install --frozen-lockfile
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
M7 Browser Audit workflow
```

### Scope gate

Expected product-code scope:

- editor shell/components;
- shell CSS/layout tests;
- browser harness;
- M7.1 documentation.

Reject any domain/schema/migration/geometry/planner/persistence change.

### Native Safari gate

On macOS Safari, verify:

1. dashboard and project open;
2. global/tool bars at ordinary and zoomed widths;
3. room selection and compact context sheet;
4. form draft survives close/reopen;
5. Furniture catalogue sheet;
6. Reference/Planning context;
7. 2D↔3D;
8. deletion dialog.

Record browser version, viewport/zoom, screenshots and result. Do not substitute WebKit automation for this statement.

### Product-owner gate

Provide representative screenshots for:

- 1440×900 wide shell;
- 1280×800;
- effective 150%;
- effective 200%;
- selected object context sheet;
- catalogue sheet;
- 3D shell.

Keep PR Draft until browser acceptance.

### Merge

After all gates:

- mark Ready;
- squash merge with expected head SHA;
- record exact feature head, CI, browser run/artifact, Safari evidence and merge SHA;
- synchronize canonical documentation in a separate docs PR if needed.

---

## Final review checklist

- [ ] No authority/schema/persistence change.
- [ ] Project and tool responsibilities are visually separate.
- [ ] Save state is readable and local-first wording is explicit.
- [ ] Undo/Redo remain always reachable.
- [ ] Fit/export actions remain reachable through `Действия`.
- [ ] All editing tools/workflow/view actions remain reachable.
- [ ] Context controls never disappear without a sheet trigger.
- [ ] Furniture catalogue never disappears without a sheet trigger.
- [ ] Compact presentation does not clear semantic state or form drafts.
- [ ] 3D workspace is not constrained by stale 2D side columns.
- [ ] Required widths/zoom have no document horizontal overflow.
- [ ] Chromium/WebKit automated gates pass.
- [ ] Native Safari gate is recorded honestly.
- [ ] Product-owner acceptance is recorded before merge.

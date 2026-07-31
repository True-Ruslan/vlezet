# M7.2 Context Inspector Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish one semantic context-panel anatomy with explicit workflow return semantics and reversibility-based destructive actions while preserving all existing domain commands and persisted state.

**Architecture:** Add pure descriptor/return-target helpers and presentation-only React primitives around existing inspectors and workflows. `ApartmentEditor` owns ephemeral return-target navigation; `editorStore`, `planningUiStore`, ProjectApp callbacks and existing validation remain authoritative.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand, Vitest, Playwright Chromium/WebKit, CSS.

## Global Constraints

- Do not change `VlezetDocument`, schema versions, migrations, IndexedDB, backup format or project UI persistence.
- Do not move geometry, validation, planning or recognition authority into React presentation components.
- Compact sheet close only hides presentation; it must not close a workflow, clear selection or discard drafts.
- Workflow back restores a still-valid ordinary context and fails closed to empty when stale.
- No ambiguous child action labelled only `Закрыть` may both hide presentation and end a workflow.
- Object/opening deletion remains immediate and undoable; reference removal remains inline-confirmed; project deletion remains unchanged.
- Preserve existing command callbacks, semantic history and Preview/Apply behaviour.
- Use TDD for every code-bearing task: failing test first, verified RED, minimal GREEN, full regression verification.

---

## File map

**Create**

- `apps/web/components/editor/context-panel-contract.ts` — pure descriptors, workflow phases and return-target capture/validation.
- `apps/web/components/editor/context-panel-frame.tsx` — shared frame/header/section/action/danger primitives.
- `apps/web/components/editor/context-panel-contract.test.ts` — pure contract tests.
- `apps/web/components/editor/context-panel-frame.test.tsx` — static rendering/anatomy tests.
- `apps/web/components/editor/context-workflow-navigation.test.ts` — source/integration contract tests.
- `apps/web/app/context-panel.css` — minimal M7.2 anatomy and hierarchy styles.
- `docs/milestones/m7-2-acceptance.md` — exact acceptance evidence.

**Modify**

- `apps/web/components/editor/apartment-editor.tsx` — ephemeral return target and workflow navigation wiring.
- `apps/web/components/editor/wall-inspector.tsx` — shared entity frames and opening/room/wall danger hierarchy.
- `apps/web/components/editor/object-inspector.tsx` — shared object frame and undoable danger zone.
- `apps/web/components/reference/reference-panel.tsx` — shared workflow frame; remove duplicate child presentation close.
- `apps/web/components/recognition/recognition-panel.tsx` — shared workflow frame; phase descriptor and navigation.
- `apps/web/components/planning/planning-panel.tsx` — shared workflow frame and semantic back action.
- `apps/web/app/globals.css` — import M7.2 stylesheet only.
- `scripts/m7-browser-audit.mjs` — blocking Chromium/WebKit M7.2 assertions and screenshots.
- `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/product/UX_ROADMAP.md`, `docs/CHANGELOG.md` or append-only milestone changelog — RC/acceptance synchronization.

---

### Task 1: Pure context descriptors and return targets

**Files:**
- Create: `apps/web/components/editor/context-panel-contract.ts`
- Create: `apps/web/components/editor/context-panel-contract.test.ts`

**Interfaces:**
- Produces `ContextKind`, `ContextDescriptor`, `OrdinaryContextSnapshot`, `WorkflowReturnTarget`.
- Produces `captureOrdinaryContext()`, `preserveWorkflowReturnTarget()`, `validateWorkflowReturnTarget()` and descriptor builders used by later tasks.

- [ ] **Step 1: Write failing tests**

Cover exact user-facing identity and immutable navigation:

```ts
expect(describeRoomContext({ name: "Гостиная", areaLabel: "11,72 м²", clearSizeLabel: "3550 × 3300 мм внутри" })).toEqual({
  kind: "room",
  category: "selection",
  eyebrow: "Комната",
  title: "Гостиная",
  subtitle: "11,72 м² · 3550 × 3300 мм внутри",
});

expect(preserveWorkflowReturnTarget(roomTarget, objectTarget)).toBe(roomTarget);
expect(validateWorkflowReturnTarget(staleTarget, document)).toEqual({ kind: "empty", label: "Ничего не выбрано" });
```

Also test wall, door, window, object, empty, reference, recognition and planning descriptors; no raw ID as title; input immutability; workflow-to-workflow transition preserves the original ordinary target.

- [ ] **Step 2: Verify RED**

Run:

```bash
pnpm --filter web test -- context-panel-contract.test.ts
```

Expected: failure because `context-panel-contract.ts` does not exist.

- [ ] **Step 3: Implement minimal pure contract**

Use discriminated unions and readonly inputs. Return-target validation checks only existing IDs in the supplied `VlezetDocument`; it does not mutate selection or document.

- [ ] **Step 4: Verify GREEN and regression**

```bash
pnpm --filter web test -- context-panel-contract.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/context-panel-contract.ts apps/web/components/editor/context-panel-contract.test.ts
git commit -m "feat: add context descriptor and return contracts"
```

### Task 2: Shared semantic panel frame

**Files:**
- Create: `apps/web/components/editor/context-panel-frame.tsx`
- Create: `apps/web/components/editor/context-panel-frame.test.tsx`
- Create: `apps/web/app/context-panel.css`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes `ContextDescriptor`.
- Produces `ContextPanelFrame`, `ContextPanelHeader`, `ContextSection`, `ContextActionArea`, `ContextDangerZone`.

- [ ] **Step 1: Write failing rendering tests**

Use `renderToStaticMarkup` and assert:

```tsx
<ContextPanelFrame descriptor={descriptor} navigation={{ label: "К комнате «Гостиная»", onActivate: noop }}>
  <ContextSection title="Размеры">...</ContextSection>
  <ContextDangerZone description="Можно отменить через «Отменить».">...</ContextDangerZone>
</ContextPanelFrame>
```

Required assertions:

- one labelled complementary region;
- one primary panel title;
- eyebrow/title/subtitle/phase order;
- exactly one workflow navigation action;
- body before danger zone;
- no generic child `Закрыть` control;
- navigation and danger actions have distinct classes/semantics.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- context-panel-frame.test.tsx
```

Expected: missing module.

- [ ] **Step 3: Implement minimal frame and CSS**

The frame receives descriptor, optional navigation and children only. It imports no stores and invokes no domain command. CSS establishes hierarchy, one scroll container, section spacing, action area and visually separated danger zone; do not perform the M7.3 token migration.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web test -- context-panel-frame.test.tsx
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/context-panel-frame.tsx apps/web/components/editor/context-panel-frame.test.tsx apps/web/app/context-panel.css apps/web/app/globals.css
git commit -m "feat: add shared context panel frame"
```

### Task 3: Entity inspector migration and destructive hierarchy

**Files:**
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/object-inspector.tsx`
- Create or modify: `apps/web/components/editor/context-panel-entities.test.tsx`

**Interfaces:**
- Consumes descriptor builders and shared frame primitives.
- Preserves all existing editorStore commands and form-local state.

- [ ] **Step 1: Write failing entity tests**

Assert representative static source/render contracts:

- empty context: `Свойства` / `Ничего не выбрано`;
- room: room name is title and area/clear size is subtitle;
- wall: physical summary is subtitle and technical ID is not dominant;
- opening: `Дверь`/`Окно`, width summary, delete in danger zone;
- object: object name, fit status, secondary rotate/duplicate, delete in danger zone;
- object/opening danger copy contains `Можно отменить через «Отменить»`;
- danger action occurs after ordinary fields/actions.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- context-panel-entities.test.tsx
```

Expected: existing bespoke headings and danger placement violate the new contract.

- [ ] **Step 3: Migrate entity inspectors minimally**

Wrap existing fields and callbacks without changing parsing, validation, store methods or component keys. Use sections for current logical groups, but leave advanced-field redesign to M7.6/M7.7.

- [ ] **Step 4: Verify GREEN and existing inspector suites**

```bash
pnpm --filter web test -- context-panel-entities.test.tsx wall-inspector object-inspector
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/object-inspector.tsx apps/web/components/editor/context-panel-entities.test.tsx
git commit -m "feat: unify entity inspector anatomy"
```

### Task 4: Workflow return navigation integration

**Files:**
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/use-editor-store.ts` only if a presentation-only selection helper is required; do not change semantic history.
- Create: `apps/web/components/editor/context-workflow-navigation.test.ts`

**Interfaces:**
- Consumes pure return-target helpers.
- Produces local `workflowReturnTarget` state and callbacks `enterReferenceWorkflow`, `enterRecognitionWorkflow`, `returnFromWorkflow`, `exitWorkflowWithoutTarget`.

- [ ] **Step 1: Write failing integration/source tests**

Required scenarios:

```text
room → planning → back = room selected, planning closed
object → reference → back = object selected, reference closed
object → reference → recognition → back = original object selected
stale/deleted target → back = all ordinary selection cleared
compact sheet X = sheet hidden, workflow flag/draft/selection unchanged
```

Assert return-target state is local to `ApartmentEditor` and is absent from project/document serialization.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- context-workflow-navigation.test.ts
```

Expected: no return-target capture/restoration contract exists.

- [ ] **Step 3: Implement minimal navigation**

Capture ordinary selection before opening the first bounded workflow. Direct workflow-to-workflow switches preserve an existing target. Before restoration, validate against current document, clear conflicting selection IDs and select exactly one valid entity. Compact `EditorSideSurface.onClose` remains presentation-only.

- [ ] **Step 4: Verify GREEN**

```bash
pnpm --filter web test -- context-workflow-navigation.test.ts apartment-editor-shell
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/context-workflow-navigation.test.ts apps/web/components/editor/use-editor-store.ts
git commit -m "feat: restore context after bounded workflows"
```

### Task 5: Workflow panel migration

**Files:**
- Modify: `apps/web/components/reference/reference-panel.tsx`
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Modify: `apps/web/components/planning/planning-panel.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Create or modify: `apps/web/components/editor/context-workflow-panels.test.tsx`

**Interfaces:**
- Panels receive semantic `navigation` from `ApartmentEditor`; they do not decide responsive presentation close.
- Existing feature callbacks remain unchanged except replacing ambiguous `onClose` with explicit `onNavigateBack`/`onExitWorkflow` naming where needed.

- [ ] **Step 1: Write failing workflow tests**

Assert:

- reference/recognition/planning use `ContextPanelFrame`;
- phase text is derived from existing state;
- valid return target renders one back action such as `К предмету «Диван»`;
- no duplicate inner X or generic `Закрыть` remains;
- planning back clears workflow Preview through existing close semantics and restores room;
- recognition back does not apply or discard a draft;
- reference removal confirmation explicitly says walls, openings and furniture remain;
- installed reference removal is inside `ContextDangerZone`.

- [ ] **Step 2: Verify RED**

```bash
pnpm --filter web test -- context-workflow-panels.test.tsx
```

- [ ] **Step 3: Migrate workflows minimally**

Keep every current workflow body and command. Replace only header/navigation/action hierarchy. For planning, remove the internal milestone kicker from the migrated header because raw roadmap identity is prohibited in ordinary UI; do not simplify planning fields/results beyond the common frame.

- [ ] **Step 4: Verify GREEN and feature regressions**

```bash
pnpm --filter web test -- context-workflow-panels.test.tsx planning recognition reference
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/reference/reference-panel.tsx apps/web/components/recognition/recognition-panel.tsx apps/web/components/planning/planning-panel.tsx apps/web/components/editor/apartment-editor.tsx apps/web/components/editor/context-workflow-panels.test.tsx
git commit -m "feat: unify context workflow navigation"
```

### Task 6: Strict browser acceptance, RC docs and exact-head verification

**Files:**
- Modify: `scripts/m7-browser-audit.mjs`
- Create: `docs/milestones/m7-2-acceptance.md`
- Modify: `docs/PROJECT_STATE.md`
- Modify: `docs/ROADMAP.md`
- Modify: `docs/product/UX_ROADMAP.md`
- Modify: milestone changelog file or append-only changelog.

**Interfaces:**
- Browser harness emits screenshots and machine assertions without modifying product state outside the test project.

- [ ] **Step 1: Add failing browser assertions before final implementation is considered complete**

Chromium must verify:

1. empty, wall, room, opening and object identities;
2. room → planning → back restores room;
3. object → reference → recognition → back restores original object;
4. compact sheet close/reopen preserves workflow and uncommitted input/draft;
5. stale target fails closed;
6. object/opening delete are undoable and expose Undo copy;
7. reference inline confirmation states that apartment geometry remains;
8. docked and compact frames expose equivalent semantic headings/actions;
9. zero document horizontal overflow.

WebKit core smoke verifies room/object identity, compact hide/reopen, one workflow return path, reference confirmation, dashboard and 2D/3D regressions.

- [ ] **Step 2: Run full exact-head gates**

```bash
pnpm install --frozen-lockfile
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
node scripts/m7-browser-audit.mjs
```

Expected: all PASS; browser evidence artifact contains Chromium/WebKit screenshots and JSON.

- [ ] **Step 3: Perform scope review**

Compare branch with `main` and confirm no changes in domain schema, migrations, IndexedDB, backup/import/export authority, geometry, planner algorithms, recognition algorithms or semantic history.

- [ ] **Step 4: Record RC evidence**

`docs/milestones/m7-2-acceptance.md` records exact head, CI run, browser run/artifact, completed automated gates and pending product-owner browser acceptance. Canonical state marks M7.2 RC, not merged.

- [ ] **Step 5: Open/update Draft PR**

PR summary must list owned findings `UX-SHELL-003` and `UX-PATTERN-001`, architecture boundaries, RED/GREEN evidence, exact-head CI/browser runs and the remaining manual gate.

- [ ] **Step 6: After product-owner acceptance**

Run fresh exact-head standard and browser gates, mark PR Ready, squash-merge, then use a documentation-only post-merge PR to record merge SHA and advance to the next evidence-selected M7.x slice.

---

## Self-review

- Spec coverage: descriptor identity, workflow return target, back/hide/exit distinction, shared anatomy, destructive hierarchy, responsive equivalence, accessibility and exact-head acceptance all map to Tasks 1–6.
- Placeholder scan: no `TODO`, `TBD`, unspecified validation or generic “write tests” steps remain.
- Type consistency: `ContextDescriptor`, `WorkflowReturnTarget`, frame primitives and navigation callbacks are introduced before their consumers.
- Scope integrity: later M7.3/M7.6/M7.7/M7.8/M7.9 redesigns remain explicitly excluded.

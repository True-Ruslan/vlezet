# M7.3 Design System and Content Components Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Introduce a governed semantic token layer and small store-free UI primitives, then prove them through bounded migrations of representative Vlezet surfaces without changing domain behaviour.

**Architecture:** Add two CSS foundation layers before existing feature styles, keep legacy variables as compatibility aliases, and introduce explicit React primitives under `apps/web/components/ui/`. Consumers continue to own domain state, validation, callbacks and persistence; primitives own only accessible anatomy and visual state. Migrate representative room, furniture, fit, feedback, dialog, recognition and Canvas-help surfaces, leaving complete workflow redesign to later M7 slices.

**Tech Stack:** Next.js 16.2.10, React 19.2.7, TypeScript 6.0.3, CSS custom properties, Vitest 4.1.10, React server rendering tests, Playwright 1.54.2, Chromium and WebKit.

## Global Constraints

- Balanced density: body 14 px, compact body 13 px, essential labels/helpers/errors/status at least 12 px.
- Standard fields and primary buttons: 40 px visible height.
- Compact secondary controls: 32–36 px visible height; icon target at least 36 × 36 px.
- Optional keyboard hints may remain 11 px; essential state, units, validation, confidence and workflow meaning may not.
- Preserve compatibility aliases for `--bg`, `--panel`, `--text`, `--muted`, `--line`, `--accent`, `--accent-soft` and `--danger`.
- New primitives must not import Zustand stores, IndexedDB repositories, geometry, planner, recognition algorithms or domain commands.
- Preserve `VlezetDocument`, migrations, IndexedDB and backup formats, autosave authority, semantic history, geometry, fit, planning and recognition algorithms.
- Preserve accepted M7.1 shell and M7.2 context navigation, compact-sheet draft retention and inspector scrolling.
- No Storybook, dark mode, mobile editor, mass whole-product migration or new domain capability.
- Every production change follows RED → verified failure → minimal GREEN → full verification → commit.

---

## File Structure

### New foundation files

- `apps/web/app/design-tokens.css` — semantic colours, typography, spacing, radii, shadows, control sizes, focus and motion tokens plus compatibility aliases.
- `apps/web/app/ui-primitives.css` — shared anatomy and state styling for the React primitives only.
- `apps/web/components/ui/ui-button.tsx` — button variants and busy/disabled semantics.
- `apps/web/components/ui/ui-field.tsx` — field anatomy, IDs and ARIA association.
- `apps/web/components/ui/ui-feedback.tsx` — field messages, notices, badges and empty states.
- `apps/web/components/ui/ui-card.tsx` — neutral/selectable/result/evidence card anatomy.
- `apps/web/components/ui/ui-dialog.tsx` — common modal foundation and focus management.
- `apps/web/components/ui/presentation-format.ts` — Russian display-only number and unit formatting.

### Representative consumers

- `apps/web/components/editor/wall-inspector.tsx` — room fields, actions and room facts.
- `apps/web/components/editor/furniture-catalog.tsx` — catalogue heading, category labels, preset cards and dimensions.
- `apps/web/components/editor/object-inspector.tsx` — fit badges and fit supporting copy.
- `apps/web/components/projects/project-dashboard.tsx` — local-first notice, error notice, empty state and project cards.
- `apps/web/components/projects/confirm-dialog.tsx` — adapter over shared dialog foundation.
- `apps/web/components/projects/project-app.tsx` — shared toast/notice rendering only; save/delete/autosave behaviour unchanged.
- `apps/web/components/recognition/cloud-dialog.tsx` — shared dialog, fields, notices and buttons.
- `apps/web/components/recognition/recognition-panel.tsx` — common notices, badges, fields and cards; workflow structure unchanged.
- `apps/web/components/editor/editor-canvas.tsx` and `apps/web/app/globals.css` — Canvas helper token migration only.

### Verification files

- Unit/source tests live beside each new primitive and representative consumer.
- `apps/web/app/design-system-contract.test.ts` guards tokens, ordering and minimum text/control sizes.
- `tools/m7-browser-audit/m7-audit.spec.mjs` owns Chromium full-flow assertions.
- `tools/m7-browser-audit/m7-webkit-smoke.spec.mjs` owns WebKit core smoke.
- `tools/m7-browser-audit/m7-context-scroll.spec.mjs` remains the M7.2 scrolling regression gate.
- `docs/milestones/m7-3-acceptance.md` records exact-head evidence and product-owner acceptance.

---

### Task 1: Semantic token and style-layer contract

**Files:**
- Create: `apps/web/app/design-tokens.css`
- Create: `apps/web/app/ui-primitives.css`
- Create: `apps/web/app/design-system-contract.test.ts`
- Modify: `apps/web/app/layout.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Produces CSS variables consumed by every later task.
- Existing feature styles continue to consume compatibility aliases during incremental migration.

- [ ] **Step 1: Write the failing token and load-order test**

```ts
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const tokens = readFileSync(new URL("./design-tokens.css", import.meta.url), "utf8");
const primitives = readFileSync(new URL("./ui-primitives.css", import.meta.url), "utf8");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("M7.3 design-system foundation", () => {
  it("defines balanced-density semantic tokens and compatibility aliases", () => {
    for (const token of [
      "--color-surface", "--color-text-primary", "--color-accent",
      "--color-success", "--color-warning", "--color-danger", "--color-info",
      "--font-body", "--font-compact", "--font-helper",
      "--control-height", "--control-height-compact", "--focus-ring",
      "--bg", "--panel", "--text", "--muted", "--line", "--accent", "--accent-soft", "--danger",
    ]) expect(tokens).toContain(token);
    expect(tokens).toContain("--font-helper: 12px");
    expect(tokens).toContain("--control-height: 40px");
  });

  it("loads tokens and primitives before feature styles", () => {
    expect(layout.indexOf('"./design-tokens.css"')).toBeLessThan(layout.indexOf('"./globals.css"'));
    expect(layout.indexOf('"./ui-primitives.css"')).toBeLessThan(layout.indexOf('"./globals.css"'));
    expect(primitives).toContain(".ui-button");
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run: `pnpm --filter web test -- app/design-system-contract.test.ts`

Expected: FAIL because both CSS files and imports do not exist.

- [ ] **Step 3: Add the semantic token layer**

Define exact token families in `design-tokens.css`, including:

```css
:root {
  --color-app: #f4f5f7;
  --color-canvas: #ffffff;
  --color-surface: #ffffff;
  --color-surface-subtle: #f8fafc;
  --color-text-primary: #171a1f;
  --color-text-secondary: #475467;
  --color-text-muted: #667085;
  --color-border: #e2e5e9;
  --color-border-strong: #cbd2dc;
  --color-accent: #1769ff;
  --color-accent-hover: #0e5bea;
  --color-accent-active: #084fcf;
  --color-accent-soft: #eaf1ff;
  --color-success: #067647;
  --color-success-soft: #ecfdf3;
  --color-warning: #b54708;
  --color-warning-soft: #fffaeb;
  --color-danger: #b42318;
  --color-danger-soft: #fef3f2;
  --color-info: #175cd3;
  --color-info-soft: #eff8ff;
  --font-body: 14px;
  --font-compact: 13px;
  --font-helper: 12px;
  --line-body: 20px;
  --line-compact: 18px;
  --control-height: 40px;
  --control-height-compact: 34px;
  --pointer-target: 36px;
  --focus-ring: 0 0 0 3px rgba(23, 105, 255, .18);
  --motion-fast: 120ms;
  --motion-standard: 180ms;

  --bg: var(--color-app);
  --panel: var(--color-surface);
  --text: var(--color-text-primary);
  --muted: var(--color-text-muted);
  --line: var(--color-border);
  --accent: var(--color-accent);
  --accent-soft: var(--color-accent-soft);
  --danger: var(--color-danger);
}
```

Add spacing, radii and shadow families from the approved spec. Add reduced-motion overrides in `ui-primitives.css`. Import `design-tokens.css`, then `ui-primitives.css`, before `globals.css` in `layout.tsx`. Remove only the old duplicate `:root` declaration from `globals.css`; retain feature rules.

- [ ] **Step 4: Verify GREEN and regressions**

Run:

```bash
pnpm --filter web test -- app/design-system-contract.test.ts
pnpm --filter web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/app/design-tokens.css apps/web/app/ui-primitives.css apps/web/app/design-system-contract.test.ts apps/web/app/layout.tsx apps/web/app/globals.css
git commit -m "feat: add semantic design tokens"
```

---

### Task 2: Button, field and field-message primitives

**Files:**
- Create: `apps/web/components/ui/ui-button.tsx`
- Create: `apps/web/components/ui/ui-field.tsx`
- Create: `apps/web/components/ui/ui-button.test.tsx`
- Create: `apps/web/components/ui/ui-field.test.tsx`
- Modify: `apps/web/app/ui-primitives.css`

**Interfaces:**

```ts
export type UiButtonVariant = "primary" | "secondary" | "quiet" | "danger" | "icon";
export type UiButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & Readonly<{
  variant?: UiButtonVariant;
  busy?: boolean;
  busyLabel?: string;
}>;

export type UiFieldProps = Readonly<{
  id: string;
  label: ReactNode;
  description?: ReactNode;
  unit?: ReactNode;
  message?: ReactNode;
  invalid?: boolean;
  children: ReactElement;
}>;

export type UiFieldMessageProps = Readonly<{
  tone?: "helper" | "error" | "warning" | "success";
  live?: boolean;
  children: ReactNode;
}>;
```

- [ ] **Step 1: Write failing rendering tests**

Test real static markup for:

```tsx
renderToStaticMarkup(<UiButton variant="primary" busy busyLabel="Сохраняем">Сохранить</UiButton>);
// aria-busy="true", disabled, visible "Сохраняем"

renderToStaticMarkup(
  <UiField id="width" label="Ширина" unit="мм" invalid message={<UiFieldMessage tone="error">Введите число</UiFieldMessage>}>
    <input value="abc" readOnly />
  </UiField>,
);
// label for="width", input id="width", aria-invalid, aria-describedby, message text
```

Also source-scan both primitive files and assert they do not import `zustand`, `editorStore`, `@vlezet/geometry`, `@vlezet/projects` or IndexedDB modules.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `pnpm --filter web test -- components/ui/ui-button.test.tsx components/ui/ui-field.test.tsx`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement minimal accessible primitives**

Use `cloneElement` in `UiField` to attach `id`, `aria-describedby` and `aria-invalid` without owning input state. Generate deterministic `${id}-description` and `${id}-message` IDs. `UiButton` preserves caller `disabled`, sets `aria-busy`, and preserves width through a dedicated content wrapper.

Add CSS states for default, hover, active, focus-visible, disabled and busy. Use semantic tokens only. Ensure standard button/input height is 40 px and helper/error text is 12 px.

- [ ] **Step 4: Verify GREEN**

Run:

```bash
pnpm --filter web test -- components/ui/ui-button.test.tsx components/ui/ui-field.test.tsx
pnpm --filter web typecheck
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/ui-button.tsx apps/web/components/ui/ui-field.tsx apps/web/components/ui/*.test.tsx apps/web/app/ui-primitives.css
git commit -m "feat: add accessible button and field primitives"
```

---

### Task 3: Feedback, badge, card and empty-state primitives

**Files:**
- Create: `apps/web/components/ui/ui-feedback.tsx`
- Create: `apps/web/components/ui/ui-card.tsx`
- Create: `apps/web/components/ui/ui-feedback.test.tsx`
- Create: `apps/web/components/ui/ui-card.test.tsx`
- Modify: `apps/web/app/ui-primitives.css`

**Interfaces:**

```ts
export type UiNoticeTone = "info" | "success" | "warning" | "error" | "local" | "limitation";
export type UiBadgeTone = "success" | "warning" | "danger" | "draft" | "preview" | "applied" | "mandatory" | "preference" | "confidence";
export function UiNotice(props: { tone: UiNoticeTone; title: ReactNode; children?: ReactNode; action?: ReactNode }): ReactElement;
export function UiBadge(props: { tone: UiBadgeTone; children: ReactNode }): ReactElement;
export function UiEmptyState(props: { title: ReactNode; children?: ReactNode; primaryAction?: ReactNode; secondaryAction?: ReactNode }): ReactElement;
export function UiCard(props: { variant?: "neutral" | "selectable" | "result" | "evidence"; selected?: boolean; children: ReactNode }): ReactElement;
```

- [ ] **Step 1: Write failing semantic tests**

Assert:

- error notices render `role="alert"`;
- success/info/local notices render `role="status"` only when explicitly live;
- every badge includes text and a `data-tone` attribute;
- selectable cards expose selected state without manufacturing click behaviour;
- empty states contain one clearly identified primary action slot.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter web test -- components/ui/ui-feedback.test.tsx components/ui/ui-card.test.tsx`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: Implement the primitives and CSS**

Use text plus a small decorative marker/icon slot so colour is never the sole signal. Keep card click ownership with consumers. Set notice, badge and supporting copy to at least 12 px.

- [ ] **Step 4: Verify GREEN**

Run focused tests, `pnpm --filter web typecheck`, and `pnpm lint`.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/ui-feedback.tsx apps/web/components/ui/ui-card.tsx apps/web/components/ui/*.test.tsx apps/web/app/ui-primitives.css
git commit -m "feat: add shared feedback and card primitives"
```

---

### Task 4: Common dialog foundation

**Files:**
- Create: `apps/web/components/ui/ui-dialog.tsx`
- Create: `apps/web/components/ui/ui-dialog.test.tsx`
- Modify: `apps/web/app/ui-primitives.css`

**Interfaces:**

```ts
export type UiDialogProps = Readonly<{
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  closeOnEscape?: boolean;
  busy?: boolean;
  initialFocusRef?: RefObject<HTMLElement | null>;
  children: ReactNode;
  footer?: ReactNode;
}>;
```

- [ ] **Step 1: Write failing static and behaviour-contract tests**

Static tests assert `role="dialog"`, `aria-modal="true"`, title/description association and viewport-safe body class. Extract pure helpers for focusable-element ordering and wrap-around so Vitest can test the focus contract without adding a DOM library.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter web test -- components/ui/ui-dialog.test.tsx`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement dialog focus behaviour**

Use an internal panel ref and opener ref. On open:

1. store `document.activeElement`;
2. focus `initialFocusRef` or the first focusable element;
3. trap Tab/Shift+Tab within the panel;
4. close on Escape when allowed;
5. restore focus to the opener after close.

Backdrop clicks close only when `event.target === event.currentTarget` and closing is allowed. Busy mode does not silently remove cancellation unless the consumer explicitly disables close.

- [ ] **Step 4: Verify GREEN**

Run focused tests, typecheck and lint.

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/ui-dialog.tsx apps/web/components/ui/ui-dialog.test.tsx apps/web/app/ui-primitives.css
git commit -m "feat: add shared accessible dialog foundation"
```

---

### Task 5: Russian presentation formatting and terminology contract

**Files:**
- Create: `apps/web/components/ui/presentation-format.ts`
- Create: `apps/web/components/ui/presentation-format.test.ts`
- Modify: `apps/web/components/editor/dimension-annotations.ts`
- Modify: `docs/design/CONTENT_AND_TERMINOLOGY.md` only if the formatter rules are not already explicit.

**Interfaces:**

```ts
export function formatMillimeters(value: number, options?: { maximumFractionDigits?: number }): string;
export function formatAreaSquareMeters(value: number, options?: { maximumFractionDigits?: number }): string;
export function formatDegrees(value: number, options?: { maximumFractionDigits?: number }): string;
```

- [ ] **Step 1: Write failing formatter tests**

```ts
expect(formatMillimeters(3550)).toBe("3 550 мм");
expect(formatAreaSquareMeters(11.72)).toBe("11,72 м²");
expect(formatDegrees(90)).toBe("90°");
expect(formatAreaSquareMeters(11.7)).not.toContain("11.700");
```

Also verify a non-breaking space between values and linear/area units and no change to parsing/storage code.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter web test -- components/ui/presentation-format.test.ts`

Expected: FAIL because formatters do not exist.

- [ ] **Step 3: Implement pure `Intl.NumberFormat("ru-RU")` formatters**

Do not round canonical stored millimetres. Format display values only. Keep existing input acceptance for comma and period unchanged.

- [ ] **Step 4: Verify GREEN and existing annotation tests**

Run:

```bash
pnpm --filter web test -- components/ui/presentation-format.test.ts components/editor/dimension-annotations.test.ts
pnpm --filter web typecheck
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/ui/presentation-format.* apps/web/components/editor/dimension-annotations.ts docs/design/CONTENT_AND_TERMINOLOGY.md
git commit -m "feat: add canonical Russian presentation formatting"
```

---

### Task 6: Room, furniture catalogue and fit-status representative migration

**Files:**
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/room-inspector.test.tsx`
- Modify: `apps/web/components/editor/furniture-catalog.tsx`
- Create: `apps/web/components/editor/furniture-catalog.test.tsx`
- Modify: `apps/web/components/editor/object-inspector.tsx`
- Create: `apps/web/components/editor/object-inspector-design-system.test.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces consumed:** `UiButton`, `UiField`, `UiFieldMessage`, `UiBadge`, `UiCard`, presentation formatters.

- [ ] **Step 1: Write failing representative-migration tests**

Room test requirements:

- fields render `.ui-field` and retain IDs `room-name`, `room-clear-width`, `room-clear-height`;
- callbacks still call existing `editorStore` methods through current handlers;
- errors use `UiFieldMessage tone="error"`;
- `Полезная площадь` renders with Russian decimal comma and non-breaking unit spacing.

Catalogue test requirements:

- preset cards render shared card anatomy;
- preset name and dimensions are at least 12 px by class contract;
- `aria-pressed` and placement toggling remain unchanged;
- long names have a title or accessible full label.

Object test requirements:

- authoritative status copy becomes exactly `Влезает`, `Влезает, но тесно`, `Не влезает`;
- status renders a `UiBadge` tone mapped from existing `FitStatus`;
- `evaluateObjectFits` remains the source of truth.

- [ ] **Step 2: Verify RED**

Run the three focused test files. Expected: FAIL because current consumers use legacy classes and copy.

- [ ] **Step 3: Migrate only representative anatomy**

Preserve room rename, dimension anchors, planning entry, preset definitions and object commands. Do not restructure the full inspector. Replace local markup only where the primitives directly fit. Remove or neutralise obsolete font-size rules for migrated elements in `globals.css`; do not globally resize unrelated workflows.

- [ ] **Step 4: Verify GREEN and regression suites**

Run:

```bash
pnpm --filter web test -- components/editor/room-inspector.test.tsx components/editor/furniture-catalog.test.tsx components/editor/object-inspector-design-system.test.tsx components/editor/context-panel-entities.test.tsx
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/editor/wall-inspector.tsx apps/web/components/editor/room-inspector.test.tsx apps/web/components/editor/furniture-catalog.tsx apps/web/components/editor/furniture-catalog.test.tsx apps/web/components/editor/object-inspector.tsx apps/web/components/editor/object-inspector-design-system.test.tsx apps/web/app/globals.css
git commit -m "feat: migrate representative editor surfaces to design system"
```

---

### Task 7: Global feedback and shared dialogs

**Files:**
- Modify: `apps/web/components/projects/project-dashboard.tsx`
- Create: `apps/web/components/projects/project-dashboard-design-system.test.tsx`
- Modify: `apps/web/components/projects/confirm-dialog.tsx`
- Modify: `apps/web/components/projects/confirm-dialog.test.tsx`
- Modify: `apps/web/components/projects/project-app.tsx`
- Create: `apps/web/components/projects/project-feedback.test.tsx`
- Modify: `apps/web/components/recognition/cloud-dialog.tsx`
- Modify: `apps/web/components/recognition/cloud-dialog-flow.test.ts`
- Create: `apps/web/components/recognition/cloud-dialog-view.test.tsx`

**Interfaces consumed:** `UiNotice`, `UiEmptyState`, `UiCard`, `UiDialog`, `UiButton`, `UiField`, `UiFieldMessage`.

- [ ] **Step 1: Write failing dashboard, toast and dialog tests**

Assert:

- local-first dashboard copy uses a `UiNotice tone="local"`;
- dashboard failures use an error notice and retain `role="alert"`;
- empty dashboard uses `UiEmptyState` with the same two creation callbacks;
- project cards use shared card anatomy without turning nested actions into one ambiguous click target;
- `ConfirmDialog` delegates modal anatomy to `UiDialog`, initially focuses `Отмена`, traps focus and restores opener;
- project deletion remains irreversible and callback signatures are unchanged;
- ProjectApp toast uses shared success/error notice anatomy but keeps the current 2600 ms timing;
- OpenRouter dialog uses shared dialog/field/notice/button primitives, does not persist the API key, and preserves model-loading/run/cancel behaviour.

- [ ] **Step 2: Verify RED**

Run all focused dashboard/dialog tests. Expected: FAIL on legacy structures.

- [ ] **Step 3: Implement bounded migrations**

Keep `ConfirmDialogProps` and `CloudDialogProps` stable so callers do not change. Convert each component internally to `UiDialog`. Keep safe initial focus on cancellation. In `ProjectApp`, change only toast rendering markup, not timers or state ownership.

- [ ] **Step 4: Verify GREEN and existing project/recognition tests**

Run:

```bash
pnpm --filter web test -- components/projects/project-dashboard-design-system.test.tsx components/projects/confirm-dialog.test.tsx components/projects/project-feedback.test.tsx components/recognition/cloud-dialog-flow.test.ts components/recognition/cloud-dialog-view.test.tsx components/projects/project-startup.test.ts
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/projects apps/web/components/recognition/cloud-dialog.tsx apps/web/components/recognition/cloud-dialog-flow.test.ts apps/web/components/recognition/cloud-dialog-view.test.tsx
git commit -m "feat: unify feedback and dialog foundations"
```

---

### Task 8: Recognition shared visuals and Canvas helper typography

**Files:**
- Modify: `apps/web/components/recognition/recognition-panel.tsx`
- Create: `apps/web/components/recognition/recognition-design-system.test.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx` only if a semantic helper class is needed.
- Modify: `apps/web/app/globals.css`
- Modify: `apps/web/app/ui-primitives.css`

**Interfaces consumed:** `UiNotice`, `UiBadge`, `UiCard`, `UiField`, `UiButton`, tokens.

- [ ] **Step 1: Write failing source/rendering contracts**

Assert:

- the large inline `<style>{styles}</style>` no longer owns shared field, modal, notice, badge or card anatomy;
- idle prerequisite, stale, error, progress and empty-draft states use shared primitives;
- confidence remains explicit text plus a badge/marker and never colour-only;
- Apply, decision and cloud callbacks are unchanged;
- recognition state-machine labels and `recognitionWorkflowPhase` remain unchanged;
- `.canvas-help` computed contract uses `var(--font-helper)` / 12 px.

- [ ] **Step 2: Verify RED**

Run focused recognition/design-system and CSS-contract tests. Expected: FAIL on inline shared styles and 11 px Canvas help.

- [ ] **Step 3: Migrate common visuals only**

Leave workflow ordering, candidate selection, local/cloud transitions, draft persistence and Apply untouched. Keep recognition-specific grid/list/progress layout in a small feature-specific stylesheet or scoped block; move only common control/feedback anatomy to primitives. Raise Canvas helper typography to 12 px without changing interaction text or positioning.

- [ ] **Step 4: Verify GREEN and recognition regressions**

Run:

```bash
pnpm --filter web test -- components/recognition/recognition-design-system.test.tsx components/editor/context-workflow-panels.test.tsx components/recognition/recognition-controller.test.ts components/recognition/recognition-apply.test.ts app/design-system-contract.test.ts
pnpm --filter web typecheck
pnpm lint
```

- [ ] **Step 5: Commit**

```bash
git add apps/web/components/recognition/recognition-panel.tsx apps/web/components/recognition/recognition-design-system.test.tsx apps/web/components/editor/editor-canvas.tsx apps/web/app/globals.css apps/web/app/ui-primitives.css
git commit -m "feat: apply shared visuals to recognition and canvas help"
```

---

### Task 9: Strict browser acceptance, RC documentation and final verification

**Files:**
- Modify: `tools/m7-browser-audit/m7-audit.spec.mjs`
- Modify: `tools/m7-browser-audit/m7-webkit-smoke.spec.mjs`
- Preserve: `tools/m7-browser-audit/m7-context-scroll.spec.mjs`
- Create: `docs/milestones/m7-3-acceptance.md`
- Modify after acceptance: `docs/PROJECT_STATE.md`
- Modify after acceptance: `docs/ROADMAP.md`
- Modify after acceptance: `docs/product/UX_ROADMAP.md`
- Create after merge: `docs/changelog/2026-07-31-m7-3-design-system-content-components.md`

**Browser interfaces:** CSS selectors use stable `.ui-*` classes and semantic roles, not visual coordinates where a role/name locator is available.

- [ ] **Step 1: Write failing Chromium acceptance assertions**

Add scenarios for:

1. ordinary desktop room context with 40 px fields/buttons and ≥12 px essential text;
2. compact context sheet at effective 150% and 200% widths;
3. long Russian project, room and furniture names without document overflow;
4. room helper/error states and disabled action reason;
5. catalogue preset readability and selected state;
6. all three fit badges;
7. dashboard local/error/empty feedback;
8. project-delete dialog initial focus, Tab wrap, Escape and focus restoration;
9. OpenRouter dialog privacy note, disabled reason, loading/busy and error state;
10. recognition prerequisite/error/card/badge states;
11. Canvas helper computed font size exactly 12 px or greater;
12. preserved M7.2 context scrolling and workflow return;
13. compact sheet close/reopen retains uncommitted room or object input.

Use computed-style assertions for migrated essential elements:

```js
const size = await locator.evaluate((node) => Number.parseFloat(getComputedStyle(node).fontSize));
expect(size).toBeGreaterThanOrEqual(12);
```

- [ ] **Step 2: Run browser audit and verify RED**

Run through the existing workflow or locally:

```bash
pnpm --dir tools/m7-browser-audit audit
pnpm --dir tools/m7-browser-audit audit:webkit
```

Expected: initial FAIL until every representative migration is complete and selectors are updated.

- [ ] **Step 3: Complete only evidence-driven fixes**

For each failure, inspect Playwright trace/screenshots. Fix product code only for confirmed product defects; fix automation only when the user gesture or locator is inaccurate. Do not relax minimum font, overflow, focus or M7.2 regression assertions.

- [ ] **Step 4: Create RC acceptance record**

`docs/milestones/m7-3-acceptance.md` must record:

- scope and non-goals;
- exact feature head;
- standard CI run ID;
- Chromium/WebKit run ID and artifact digest;
- migrated surfaces;
- architecture boundary review;
- product-owner browser checklist;
- status `RC / MANUAL ACCEPTANCE PENDING` until confirmed.

- [ ] **Step 5: Run exact-head standard verification**

Run or require GitHub Actions for:

```bash
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: PASS on the exact RC head.

- [ ] **Step 6: Request product-owner browser acceptance**

Ask the owner to test the feature branch at the exact RC SHA, including ordinary desktop, reduced effective width, project delete, OpenRouter dialog, recognition panel and the previously fixed room-planning entry.

- [ ] **Step 7: Record acceptance and repeat exact-head gates**

After confirmation, update acceptance with the product-owner result and final run IDs. Re-run standard CI and Chromium/WebKit on the record-only head.

- [ ] **Step 8: Ready and squash-merge**

Verify scope excludes domain, geometry, persistence, planner and recognition-algorithm files. Mark the PR ready and squash-merge with expected-head SHA protection.

- [ ] **Step 9: Synchronise canonical documentation in a post-merge docs PR**

Set M7.3 to `DONE / ACCEPTED / MERGED`, select the next M7.x slice from the accepted UX roadmap, append the changelog entry, and require both standard CI and browser audit before merging the docs PR.

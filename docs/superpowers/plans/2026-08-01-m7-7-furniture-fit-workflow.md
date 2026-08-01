# M7.7 Furniture and Fit Workflow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build one predictable catalogue → Canvas placement → selected-object editing and fit-explanation workflow without changing M2 furniture/fit authority.

**Architecture:** Keep `VlezetDocument`, editor-core commands, M2 fit evaluation, object snapping and Canvas geometry authoritative. Add framework-independent presentation helpers, one runtime-only catalogue UI store, store-free orientation/fit components, and reorganised React surfaces that route accepted edits through the existing single `updateSelectedObject()` command. Browser evidence extends the existing M7 Chromium and WebKit suites.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5 vanilla stores, Konva/react-konva, Vitest 4, Playwright, pnpm 11/Turborepo.

## Global Constraints

- Base branch is `main`; implementation branch is `feat/m7-7-furniture-fit-workflow`.
- Node.js must remain `>=22.13.0`; package manager remains `pnpm@11.15.1`.
- Do not add dependencies.
- `VlezetDocument`, schema, migrations, IndexedDB records and portable backup format must not change.
- M2 remains sole authority for containment, collisions, door conflicts, recommended clearances and `fits` / `tight` / `blocked` status.
- `measureObjectClearances()` remains sole authority for actual directional free distances.
- Object snapping, Canvas gesture semantics and existing editor-core object commands remain unchanged.
- Search/category/disclosure state is runtime-only and must not enter document persistence or semantic history.
- No automatic move, rotate, resize, repair, planning expansion, recognition work or 3D-authority change.
- Exact inspector Apply must call `updateSelectedObject()` at most once and remain one `object/update` Undo step.
- `Повернуть 90°` is one focusable control, not duplicated by responsive rendering.
- Search uses Unicode NFKC, lowercase, `ё → е`, punctuation-to-space, trim, whitespace collapse and deterministic all-token matching.
- An empty height draft omits `height` from the patch and preserves the authoritative current value/absence.
- Invalid fields in collapsed sections automatically reveal their section, preserve entered text, focus the first invalid field and cause no editor-store mutation.
- Chromium full M7 flow, WebKit core smoke and product-owner browser acceptance are merge gates.

---

## File Structure

### New focused files

- `apps/web/components/editor/furniture-catalog-model.ts` — deterministic query/category normalisation and filtering.
- `apps/web/components/editor/furniture-catalog-model.test.ts` — pure catalogue-model contract.
- `apps/web/components/editor/furniture-catalog-ui-store.ts` — runtime-only search/category state that survives catalogue unmount.
- `apps/web/components/editor/furniture-catalog-ui-store.test.ts` — lifecycle and reset contract.
- `apps/web/components/editor/object-editor-presentation.ts` — draft creation/parsing, field errors, authoritative-value fingerprint and diagnostic grouping.
- `apps/web/components/editor/object-editor-presentation.test.ts` — pure object form and fit-presentation tests.
- `apps/web/components/editor/furniture-orientation-presentation.ts` — local-side-to-screen presentation mapping for cardinal rotations.
- `apps/web/components/editor/furniture-orientation-presentation.test.ts` — 0°/90°/180°/270° mapping tests.
- `apps/web/components/editor/furniture-orientation-cue.tsx` — store-free top-view orientation and clearance explanation.
- `apps/web/components/editor/furniture-orientation-cue.test.tsx` — markup/accessibility contract.
- `apps/web/components/editor/object-inspector.test.tsx` — selected-object hierarchy, validation, sync and command-routing contracts.
- `apps/web/app/m7-furniture-fit.css` — catalogue, inspector, Canvas legend and compact-layout styling.
- `apps/web/app/m7-furniture-fit-layout.test.ts` — static CSS/layout constraints.
- `tools/m7-browser-audit/m7-furniture-fit.spec.mjs` — representative Chromium/WebKit M7.7 flow.
- `docs/milestones/m7-7-acceptance.md` — automated and product-owner acceptance record.
- `docs/changelog/2026-08-01-m7-7.md` — implementation scope and authority boundaries.

### Existing files to modify

- `apps/web/components/editor/furniture-catalog.tsx` — search, categories, result summary, empty state and active-placement copy.
- `apps/web/components/editor/furniture-catalog.test.tsx` — component/source integration contracts.
- `apps/web/components/editor/object-inspector.tsx` — reorganised sections, local draft, field-local errors, disclosure and one atomic Apply.
- `apps/web/components/editor/editor-canvas.tsx` — non-colour placement fit label and selected-object measurement legend/copy.
- `apps/web/components/editor/editor-canvas-source.test.ts` — source-level Canvas integration contract.
- `apps/web/app/layout.tsx` — import `m7-furniture-fit.css`.
- `tools/m7-browser-audit/playwright.config.mjs` — add M7.7 Chromium spec.
- `tools/m7-browser-audit/playwright.webkit.config.mjs` — add M7.7 WebKit smoke coverage.

---

### Task 1: Pure catalogue filtering and runtime state

**Files:**
- Create: `apps/web/components/editor/furniture-catalog-model.ts`
- Create: `apps/web/components/editor/furniture-catalog-model.test.ts`
- Create: `apps/web/components/editor/furniture-catalog-ui-store.ts`
- Create: `apps/web/components/editor/furniture-catalog-ui-store.test.ts`
- Read: `apps/web/components/editor/furniture-presets.ts`

**Interfaces:**
- Produces:

```ts
export type FurnitureCategoryFilter = "all" | FurniturePreset["category"];

export type FurnitureCatalogFilter = Readonly<{
  query: string;
  category: FurnitureCategoryFilter;
}>;

export function normalizeFurnitureSearch(value: string): string;
export function furnitureSearchTokens(value: string): readonly string[];
export function filterFurniturePresets(
  presets: readonly FurniturePreset[],
  filter: FurnitureCatalogFilter,
): readonly FurniturePreset[];
export function furnitureCategoryCount(
  presets: readonly FurniturePreset[],
  query: string,
  category: FurnitureCategoryFilter,
): number;
```

```ts
export type FurnitureCatalogUiState = {
  query: string;
  category: FurnitureCategoryFilter;
  setQuery: (query: string) => void;
  setCategory: (category: FurnitureCategoryFilter) => void;
  resetFilters: () => void;
};

export const furnitureCatalogUiStore: StoreApi<FurnitureCatalogUiState>;
```

- Consumes: `FurniturePreset`, `FURNITURE_PRESETS`, Zustand `createStore`.

- [ ] **Step 1: Write failing catalogue-model tests**

```ts
import { describe, expect, it } from "vitest";
import { FURNITURE_PRESETS } from "./furniture-presets";
import {
  filterFurniturePresets,
  normalizeFurnitureSearch,
} from "./furniture-catalog-model";

describe("furniture catalogue presentation model", () => {
  it("normalises punctuation, case, whitespace and ё deterministically", () => {
    expect(normalizeFurnitureSearch("  ТВ / ТУМБА  ")).toBe("тв тумба");
    expect(normalizeFurnitureSearch("Ёлка—стол")).toBe("елка стол");
  });

  it("requires every query token without fuzzy matching", () => {
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "раб стол", category: "all" }).map((item) => item.id))
      .toEqual(["desk"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "тв тумба", category: "all" }).map((item) => item.id))
      .toEqual(["tv-stand"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "диван стол", category: "all" })).toEqual([]);
  });

  it("combines query and category with logical AND and preserves preset order", () => {
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "стол", category: "table" }).map((item) => item.id))
      .toEqual(["desk", "dining-table"]);
    expect(filterFurniturePresets(FURNITURE_PRESETS, { query: "стол", category: "storage" }).map((item) => item.id))
      .toEqual([]);
  });
});
```

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```bash
pnpm --filter web exec vitest run components/editor/furniture-catalog-model.test.ts
```

Expected: FAIL because `furniture-catalog-model.ts` does not exist.

- [ ] **Step 3: Implement the deterministic pure model**

Use punctuation-to-space rather than deletion:

```ts
const SEPARATOR_PATTERN = /[\p{P}\p{S}]+/gu;

export function normalizeFurnitureSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(SEPARATOR_PATTERN, " ")
    .trim()
    .replace(/\s+/gu, " ");
}
```

Match every token using `normalisedName.includes(token)`. Do not add scoring or synonyms.

- [ ] **Step 4: Write failing runtime-store tests**

```ts
import { describe, expect, it } from "vitest";
import { createFurnitureCatalogUiStore } from "./furniture-catalog-ui-store";

describe("furniture catalogue runtime state", () => {
  it("preserves filters until explicit reset", () => {
    const store = createFurnitureCatalogUiStore();
    store.getState().setQuery("стол");
    store.getState().setCategory("table");
    expect(store.getState()).toMatchObject({ query: "стол", category: "table" });
    store.getState().resetFilters();
    expect(store.getState()).toMatchObject({ query: "", category: "all" });
  });
});
```

- [ ] **Step 5: Implement the runtime-only store and run both tests**

```ts
export function createFurnitureCatalogUiStore(): StoreApi<FurnitureCatalogUiState> {
  return createStore<FurnitureCatalogUiState>((set) => ({
    query: "",
    category: "all",
    setQuery: (query) => set({ query }),
    setCategory: (category) => set({ category }),
    resetFilters: () => set({ query: "", category: "all" }),
  }));
}

export const furnitureCatalogUiStore = createFurnitureCatalogUiStore();
```

Run:

```bash
pnpm --filter web exec vitest run components/editor/furniture-catalog-model.test.ts components/editor/furniture-catalog-ui-store.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/components/editor/furniture-catalog-model.ts \
  apps/web/components/editor/furniture-catalog-model.test.ts \
  apps/web/components/editor/furniture-catalog-ui-store.ts \
  apps/web/components/editor/furniture-catalog-ui-store.test.ts
git commit -m "feat: add furniture catalogue filtering model"
```

---

### Task 2: Searchable and keyboard-reachable catalogue UI

**Files:**
- Modify: `apps/web/components/editor/furniture-catalog.tsx`
- Modify: `apps/web/components/editor/furniture-catalog.test.tsx`
- Create: `apps/web/app/m7-furniture-fit.css`
- Create: `apps/web/app/m7-furniture-fit-layout.test.ts`
- Modify: `apps/web/app/layout.tsx`

**Interfaces:**
- Consumes: Task 1 `filterFurniturePresets()`, `furnitureCategoryCount()`, `furnitureCatalogUiStore`.
- Produces: accessible search field, category chip buttons, result summary, filtered cards, empty state and reset action.

- [ ] **Step 1: Extend component tests for search/category anatomy**

Add assertions to `furniture-catalog.test.tsx`:

```ts
expect(html).toContain('aria-label="Поиск мебели и техники"');
expect(html).toContain('aria-pressed="true"');
expect(html).toContain("Все");
expect(html).toContain("Найдено:");
```

Add source assertions that catalogue state comes from `furnitureCatalogUiStore`, not component-local `useState`:

```ts
expect(source).toContain("useStore(furnitureCatalogUiStore");
expect(source).toContain("filterFurniturePresets");
expect(source).toContain("resetFilters");
```

- [ ] **Step 2: Run focused component test and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/furniture-catalog.test.tsx
```

Expected: FAIL because the catalogue has no search/categories/result summary.

- [ ] **Step 3: Implement catalogue controls**

Use native controls:

```tsx
<input
  type="search"
  aria-label="Поиск мебели и техники"
  value={query}
  placeholder="Например, стол или шкаф"
  onChange={(event) => setQuery(event.target.value)}
/>
```

Each category is one button:

```tsx
<button
  type="button"
  aria-pressed={category === option.id}
  onClick={() => setCategory(option.id)}
>
  {option.label}
  <span aria-hidden="true">{count}</span>
</button>
```

Render all category buttons even when count is zero. Render cards from filtered results in canonical order. Empty state must include `Ничего не найдено` and one `Сбросить фильтры` button. Do not clear `placementPresetId` when filters reset.

- [ ] **Step 4: Write the layout contract before CSS**

`m7-furniture-fit-layout.test.ts` must read the CSS and assert:

```ts
expect(css).toContain(".catalog-filter-controls");
expect(css).toMatch(/\.catalog-category-list\s*\{[^}]*flex-wrap:\s*wrap/s);
expect(css).toMatch(/\.furniture-catalog\s*\{[^}]*min-width:\s*0/s);
expect(css).toMatch(/\.catalog-scroll\s*\{[^}]*overflow:\s*auto/s);
expect(css).toMatch(/@media\s*\(max-width:\s*980px\)/s);
```

- [ ] **Step 5: Run layout test and verify RED**

```bash
pnpm --filter web exec vitest run app/m7-furniture-fit-layout.test.ts
```

Expected: FAIL because `m7-furniture-fit.css` does not exist.

- [ ] **Step 6: Implement catalogue CSS and import it**

Create focused classes for:

- `.catalog-filter-controls`;
- `.catalog-search`;
- `.catalog-category-list`;
- `.catalog-category-chip`;
- `.catalog-result-summary`;
- `.catalog-empty-state`.

Use wrapping chips, `min-width:0`, 40 px interactive height for the search and no fixed width wider than the 250 px catalogue column. Add `import "./m7-furniture-fit.css";` after `m7-geometry-inspector.css` in `layout.tsx`.

- [ ] **Step 7: Run focused tests**

```bash
pnpm --filter web exec vitest run components/editor/furniture-catalog-model.test.ts components/editor/furniture-catalog-ui-store.test.ts components/editor/furniture-catalog.test.tsx app/m7-furniture-fit-layout.test.ts
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/web/components/editor/furniture-catalog.tsx \
  apps/web/components/editor/furniture-catalog.test.tsx \
  apps/web/app/m7-furniture-fit.css \
  apps/web/app/m7-furniture-fit-layout.test.ts \
  apps/web/app/layout.tsx
git commit -m "feat: make furniture catalogue searchable"
```

---

### Task 3: Pure object draft parser and fit presentation

**Files:**
- Create: `apps/web/components/editor/object-editor-presentation.ts`
- Create: `apps/web/components/editor/object-editor-presentation.test.ts`
- Read: `apps/web/components/editor/object-inspector.tsx`
- Read: geometry `FitDiagnostic` types exported by `@vlezet/geometry`

**Interfaces:**
- Produces:

```ts
export type ObjectDraftField =
  | "name" | "width" | "depth" | "height" | "rotation"
  | "x" | "y" | "front" | "right" | "back" | "left";

export type ObjectEditorDraft = Readonly<Record<ObjectDraftField, string>>;
export type ObjectDraftErrors = Partial<Record<ObjectDraftField, string>>;

export function createObjectEditorDraft(object: PlacedObject): ObjectEditorDraft;
export function objectAuthorityFingerprint(object: PlacedObject): string;
export function parseObjectEditorDraft(
  draft: ObjectEditorDraft,
  authoritative: PlacedObject,
): Readonly<{ ok: true; patch: PlacedObjectPatch }> |
   Readonly<{ ok: false; errors: ObjectDraftErrors }>;

export type FitDiagnosticGroupId = "containment" | "collision" | "opening" | "clearance";
export type FitDiagnosticGroup = Readonly<{
  id: FitDiagnosticGroupId;
  title: string;
  nextAction: string;
  diagnostics: readonly FitDiagnostic[];
}>;

export function groupFitDiagnostics(diagnostics: readonly FitDiagnostic[]): readonly FitDiagnosticGroup[];
```

- Consumes: `PlacedObject`, `PlacedObjectPatch`, existing fit diagnostic codes/messages.

- [ ] **Step 1: Write failing parser tests**

Cover all errors in one submit:

```ts
const result = parseObjectEditorDraft({
  ...createObjectEditorDraft(object),
  name: "   ",
  width: "0",
  depth: "abc",
  height: "-1",
  front: "-10",
}, object);

expect(result).toEqual({
  ok: false,
  errors: expect.objectContaining({
    name: "Введите название предмета",
    width: "Введите ширину больше 0 мм",
    depth: "Введите число",
    height: "Введите высоту больше 0 мм",
    front: "Введите неотрицательный зазор",
  }),
});
```

Also test decimal comma and empty height preservation:

```ts
const result = parseObjectEditorDraft({
  ...createObjectEditorDraft(object),
  width: "1200,5",
  height: "",
}, object);
expect(result).toMatchObject({ ok: true, patch: { width: 1200.5 } });
expect(result.ok && "height" in result.patch).toBe(false);
```

- [ ] **Step 2: Run focused test and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/object-editor-presentation.test.ts
```

Expected: FAIL because the module does not exist.

- [ ] **Step 3: Implement draft creation, fingerprint and parser**

Parse every field before returning. Do not throw for locally detectable errors. Build `patch` only when `Object.keys(errors).length === 0`.

The fingerprint must include object ID and every authoritative editable value in stable order, for example:

```ts
return JSON.stringify([
  object.id,
  object.name,
  object.position.x,
  object.position.y,
  object.width,
  object.depth,
  object.height ?? null,
  object.rotationDeg,
  object.clearance.front,
  object.clearance.right,
  object.clearance.back,
  object.clearance.left,
]);
```

- [ ] **Step 4: Add failing diagnostic-grouping tests**

Use real diagnostic codes from the geometry package tests/source. Assert canonical group order: containment → collision → opening → clearance. Unknown future codes must remain visible in the most conservative hard-conflict group rather than being dropped.

- [ ] **Step 5: Implement presentation-only diagnostic grouping**

Map existing codes to titles and manual next actions. Keep original messages and related IDs untouched. Do not recalculate status.

- [ ] **Step 6: Run focused test**

```bash
pnpm --filter web exec vitest run components/editor/object-editor-presentation.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/object-editor-presentation.ts \
  apps/web/components/editor/object-editor-presentation.test.ts
git commit -m "feat: add object editor presentation model"
```

---

### Task 4: Store-free orientation and clearance cue

**Files:**
- Create: `apps/web/components/editor/furniture-orientation-presentation.ts`
- Create: `apps/web/components/editor/furniture-orientation-presentation.test.ts`
- Create: `apps/web/components/editor/furniture-orientation-cue.tsx`
- Create: `apps/web/components/editor/furniture-orientation-cue.test.tsx`
- Modify: `apps/web/app/m7-furniture-fit.css`

**Interfaces:**
- Produces:

```ts
export type FurnitureLocalSide = "front" | "right" | "back" | "left";
export type ScreenSide = "top" | "right" | "bottom" | "left";

export type ClearanceSidePresentation = Readonly<{
  recommendedMm: number;
  actualMm: number | null;
  invalid: boolean;
}>;

export function normaliseCardinalRotation(rotationDeg: number): 0 | 90 | 180 | 270;
export function mapFurnitureLocalSideToScreen(
  side: FurnitureLocalSide,
  rotationDeg: number,
): ScreenSide;
```

```tsx
export type FurnitureOrientationCueProps = Readonly<{
  widthMm: number;
  depthMm: number;
  rotationDeg: number;
  sides: Readonly<Record<FurnitureLocalSide, ClearanceSidePresentation>>;
}>;

export function FurnitureOrientationCue(props: FurnitureOrientationCueProps): ReactElement;
```

- Consumes: presentation values only; no store or geometry imports.

- [ ] **Step 1: Write failing cardinal mapping tests**

```ts
expect(mapFurnitureLocalSideToScreen("front", 0)).toBe("bottom");
expect(mapFurnitureLocalSideToScreen("front", 90)).toBe("left");
expect(mapFurnitureLocalSideToScreen("front", 180)).toBe("top");
expect(mapFurnitureLocalSideToScreen("front", 270)).toBe("right");
```

Test all four local sides at all four rotations. Also define deterministic nearest-cardinal presentation for arbitrary angles without changing the exact rotation field.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/furniture-orientation-presentation.test.ts
```

- [ ] **Step 3: Implement pure side mapping**

Use a rotation table rather than Canvas/world geometry. Document that screen mapping is an explanatory cue; exact object rotation remains authoritative elsewhere.

- [ ] **Step 4: Write failing cue markup test**

```ts
const html = renderToStaticMarkup(
  <FurnitureOrientationCue
    widthMm={1600}
    depthMm={600}
    rotationDeg={90}
    sides={{
      front: { recommendedMm: 800, actualMm: 620, invalid: false },
      right: { recommendedMm: 0, actualMm: null, invalid: false },
      back: { recommendedMm: 0, actualMm: 140, invalid: false },
      left: { recommendedMm: 0, actualMm: 500, invalid: true },
    }}
  />,
);
expect(html).toContain("Перед предмета");
expect(html).toContain("Рекомендуется 800 мм");
expect(html).toContain("Свободно сейчас 620 мм");
expect(html).toContain("Нет ближайшего препятствия");
expect(html).toContain('aria-invalid="true"');
```

- [ ] **Step 5: Implement the store-free cue and CSS**

The rectangle aspect ratio may be visually clamped for readability, but labels must preserve exact values. Render four semantic side blocks and a front marker; do not position focusable inputs around a rotated CSS transform. Inputs remain ordinary form controls in the inspector; the cue is explanatory and readable by assistive technology.

- [ ] **Step 6: Run both focused tests**

```bash
pnpm --filter web exec vitest run components/editor/furniture-orientation-presentation.test.ts components/editor/furniture-orientation-cue.test.tsx app/m7-furniture-fit-layout.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/furniture-orientation-presentation.ts \
  apps/web/components/editor/furniture-orientation-presentation.test.ts \
  apps/web/components/editor/furniture-orientation-cue.tsx \
  apps/web/components/editor/furniture-orientation-cue.test.tsx \
  apps/web/app/m7-furniture-fit.css
git commit -m "feat: explain rotated furniture clearances"
```

---

### Task 5: Reorganise selected-object inspector with atomic validation

**Files:**
- Modify: `apps/web/components/editor/object-inspector.tsx`
- Create: `apps/web/components/editor/object-inspector.test.tsx`
- Modify: `apps/web/app/m7-furniture-fit.css`
- Read: `apps/web/components/editor/context-panel-frame.tsx`
- Read: `apps/web/components/editor/fit-status-badge.tsx`

**Interfaces:**
- Consumes: Task 3 draft/parser/grouping helpers; Task 4 cue.
- Produces: fixed section hierarchy, field-local validation, explicit draft sync, one atomic Apply and one rotate button.

- [ ] **Step 1: Write failing source/component hierarchy tests**

Test the section order in rendered markup:

```ts
const html = renderToStaticMarkup(<ObjectInspector document={document} object={object} />);
const fitIndex = html.indexOf("Проверка размещения");
const mainIndex = html.indexOf("Основные параметры");
const clearanceIndex = html.indexOf("Зоны использования");
const positionIndex = html.indexOf("Точное положение");
expect(fitIndex).toBeLessThan(mainIndex);
expect(mainIndex).toBeLessThan(clearanceIndex);
expect(clearanceIndex).toBeLessThan(positionIndex);
expect((html.match(/Повернуть 90°/g) ?? [])).toHaveLength(1);
```

Add source assertions:

```ts
expect(source).toContain("parseObjectEditorDraft");
expect(source).toContain("objectAuthorityFingerprint");
expect(source).toContain("updateSelectedObject(result.patch)");
expect(source).not.toContain("parseRequired(");
```

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/object-inspector.test.tsx
```

- [ ] **Step 3: Implement explicit draft synchronisation**

Use state initialized from `createObjectEditorDraft(object)`. Compute `authorityFingerprint`. In an effect keyed by object ID and fingerprint, reset draft/errors/form-level error and disclosure state from authoritative values.

Do not preserve an unsaved draft across Undo/Redo or external object command changes.

- [ ] **Step 4: Implement fixed inspector hierarchy**

- `Проверка размещения`: status badge then grouped diagnostics/manual next action.
- `Основные параметры`: name, width, depth, optional height, exact rotation and the single rotate button.
- `Зоны использования`: orientation cue, `Рекомендуется` / `Свободно сейчас`, collapsible four clearance inputs.
- `Точное положение`: collapsed X/Y fields.
- ordinary actions: duplicate only; rotate lives beside rotation but remains the same single element.
- danger zone: existing delete action.

- [ ] **Step 5: Implement field-local error component/helper**

Each input must receive:

```tsx
aria-invalid={Boolean(errors[field])}
aria-describedby={errors[field] ? `${id}-error` : undefined}
```

and render:

```tsx
{errors[field] ? <p id={`${id}-error`} className="field-error">{errors[field]}</p> : null}
```

- [ ] **Step 6: Implement atomic Apply and hidden-section recovery**

On submit:

1. call `parseObjectEditorDraft(draft, object)`;
2. if invalid, set all errors;
3. open clearance details when any of `front/right/back/left` is invalid;
4. open exact-position details when `x/y` is invalid;
5. schedule focus to the first invalid field in document order using stored refs and `requestAnimationFrame` or an effect after render;
6. do not call editor store;
7. if valid, call `editorStore.getState().updateSelectedObject(result.patch)` exactly once;
8. retain a form-level error only for thrown authoritative failures.

- [ ] **Step 7: Add command-routing and stale-draft tests**

Use source contracts plus the pure fingerprint/parser tests to verify:

- one `updateSelectedObject(result.patch)` path;
- one `rotateSelectedObject90()` button;
- no per-field editor-store mutation;
- authoritative fingerprint effect exists;
- hidden sections use `open` state controlled by validation.

- [ ] **Step 8: Add compact inspector CSS**

At compact widths:

- field pairs become one column;
- orientation cue remains within `min-width:0`;
- disclosures do not create horizontal page overflow;
- the single rotate button moves through CSS grid placement rather than duplicate rendering.

- [ ] **Step 9: Run focused tests**

```bash
pnpm --filter web exec vitest run \
  components/editor/object-editor-presentation.test.ts \
  components/editor/furniture-orientation-presentation.test.ts \
  components/editor/furniture-orientation-cue.test.tsx \
  components/editor/object-inspector.test.tsx \
  app/m7-furniture-fit-layout.test.ts
```

Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add apps/web/components/editor/object-inspector.tsx \
  apps/web/components/editor/object-inspector.test.tsx \
  apps/web/app/m7-furniture-fit.css
git commit -m "feat: simplify furniture inspector editing"
```

---

### Task 6: Canvas fit preview and measurement-role explanation

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/editor-canvas-source.test.ts`
- Modify: `apps/web/app/m7-furniture-fit.css`

**Interfaces:**
- Consumes: existing `fitEvaluation`, `placementPreviewFitStatus`, selected object dimensions, clearance polygon and measured directional clearances.
- Produces: non-colour preview status label and selected-object legend distinguishing dimensions, recommended zone and actual free distance.

- [ ] **Step 1: Write failing Canvas source tests**

Add assertions:

```ts
expect(source).toContain("fitStatusPresentation(placementPreviewFitStatus)");
expect(source).toContain("Рекомендуемая зона использования");
expect(source).toContain("Размер предмета");
expect(source).toContain("Свободно сейчас");
expect(source).toContain("Кратчайший зазор между контурами");
```

Also assert placement preview label is rendered from existing `placementPreviewFitStatus`, not a new fit function.

- [ ] **Step 2: Run and verify RED**

```bash
pnpm --filter web exec vitest run components/editor/editor-canvas-source.test.ts
```

- [ ] **Step 3: Add placement preview status label**

Import `fitStatusPresentation`. When `visiblePlacementPreview` and status exist, render a non-listening Konva `Text` near the preview with the canonical Russian label. Keep preview commit policy unchanged, including blocked placement.

- [ ] **Step 4: Add selected-object semantic legend**

Render a DOM overlay inside `.canvas-shell` only while an object is selected. It must name:

- `Размер предмета`;
- `Рекомендуемая зона использования`;
- `Свободно сейчас`.

When planning exact-gap evidence is active, retain its existing overlay and ensure user-facing copy names it `Кратчайший зазор между контурами`. Do not duplicate or recalculate the witness.

- [ ] **Step 5: Clarify directional Canvas labels**

Prefix or pair actual measured values with the semantic role so an isolated `700 мм` cannot be mistaken for a dimension. Keep labels tied to `measureObjectClearances()` output.

- [ ] **Step 6: Add CSS and run focused tests**

```bash
pnpm --filter web exec vitest run components/editor/editor-canvas-source.test.ts app/m7-furniture-fit-layout.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/components/editor/editor-canvas.tsx \
  apps/web/components/editor/editor-canvas-source.test.ts \
  apps/web/app/m7-furniture-fit.css
git commit -m "feat: clarify furniture fit evidence on canvas"
```

---

### Task 7: Full unit, layout and authority regression gate

**Files:**
- Modify tests only when a real accepted contract needs stronger coverage.
- Do not alter product behavior merely to satisfy brittle source strings.

**Interfaces:**
- Consumes: Tasks 1–6 complete implementation.
- Produces: green complete repository verification before browser work.

- [ ] **Step 1: Run the focused M7.7 suite**

```bash
pnpm --filter web exec vitest run \
  components/editor/furniture-catalog-model.test.ts \
  components/editor/furniture-catalog-ui-store.test.ts \
  components/editor/furniture-catalog.test.tsx \
  components/editor/object-editor-presentation.test.ts \
  components/editor/furniture-orientation-presentation.test.ts \
  components/editor/furniture-orientation-cue.test.tsx \
  components/editor/object-inspector.test.tsx \
  components/editor/editor-canvas-source.test.ts \
  app/m7-furniture-fit-layout.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run complete unit/component/source/layout tests**

```bash
pnpm test
```

Expected: all workspace tests PASS; test count is recorded in the eventual acceptance document.

- [ ] **Step 3: Run documentation contract, typecheck, lint and build**

```bash
pnpm validate:m7-docs
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all PASS.

- [ ] **Step 4: Review architecture diff**

```bash
git diff main...HEAD -- packages/domain packages/editor-core packages/geometry packages/projects packages/planning packages/recognition packages/spatial
```

Expected: no changes. Any required package-level change stops the task and requires explicit design amendment rather than silent implementation.

- [ ] **Step 5: Commit any test-only hardening**

```bash
git add apps/web/**/*.test.ts apps/web/**/*.test.tsx
git commit -m "test: harden M7.7 furniture workflow contracts"
```

Skip the commit when the working tree is clean.

---

### Task 8: Chromium and WebKit browser acceptance automation

**Files:**
- Create: `tools/m7-browser-audit/m7-furniture-fit.spec.mjs`
- Modify: `tools/m7-browser-audit/playwright.config.mjs`
- Modify: `tools/m7-browser-audit/playwright.webkit.config.mjs`

**Interfaces:**
- Consumes: real Next.js product and accepted M7.1–M7.6 browser setup helpers/patterns.
- Produces: one deterministic spec runnable in full Chromium and WebKit core smoke.

- [ ] **Step 1: Add the new spec to both configs before creating it**

Append `m7-furniture-fit.spec.mjs` to each `testMatch` array.

- [ ] **Step 2: Run config discovery and verify RED**

From `tools/m7-browser-audit`:

```bash
pnpm exec playwright test --config=playwright.config.mjs --list
```

Expected: failure or missing-file indication until the spec exists.

- [ ] **Step 3: Implement deterministic setup**

Reuse the accepted closed-room path from M7.5/M7.6. Dismiss onboarding using the canonical `Завершить` action before covered Canvas interactions.

- [ ] **Step 4: Implement catalogue journey assertions**

The browser spec must:

1. open furniture catalogue;
2. search `тв тумба` and see only `ТВ-тумба`;
3. choose `Столы`, search `стол`, and see `Рабочий стол` plus `Обеденный стол`;
4. search a non-match, verify `Ничего не найдено`, reset filters;
5. close/reopen catalogue in the same editor session and verify filters persist when intentionally left set;
6. select a preset and verify active placement guidance/cancellation.

- [ ] **Step 5: Implement placement and inspector assertions**

The spec must:

1. preview a valid position and read `Влезает` or `Влезает, но тесно`;
2. preview a blocked position and read `Не влезает` without colour dependence;
3. place one object and verify placement mode ends;
4. verify section order and one `Повернуть 90°` button;
5. apply width/depth/rotation and verify one Undo restores all values;
6. rotate 90° and verify front-side orientation cue changes physical screen side;
7. verify `Рекомендуется` and `Свободно сейчас` remain distinct;
8. enter invalid width and negative clearance while exact-position/clearance details are collapsed;
9. submit, verify both containing sections open as needed, errors appear, first invalid field receives focus and Canvas geometry does not change;
10. correct values and apply successfully.

- [ ] **Step 6: Implement compact-layout assertions**

Set a compact viewport/effective width and assert:

- no document-level horizontal overflow;
- category chips wrap;
- inspector remains reachable;
- one-column fields remain visible;
- only one rotate button exists;
- Canvas remains non-zero width.

- [ ] **Step 7: Run Chromium spec against local product**

```bash
pnpm --filter web dev
```

In another shell:

```bash
cd tools/m7-browser-audit
pnpm exec playwright test m7-furniture-fit.spec.mjs --config=playwright.config.mjs
```

Expected: PASS.

- [ ] **Step 8: Run WebKit core smoke**

```bash
cd tools/m7-browser-audit
pnpm exec playwright test m7-furniture-fit.spec.mjs --config=playwright.webkit.config.mjs
```

Expected: PASS.

- [ ] **Step 9: Run the complete browser suites**

```bash
cd tools/m7-browser-audit
pnpm exec playwright test --config=playwright.config.mjs
pnpm exec playwright test --config=playwright.webkit.config.mjs
```

Expected: all M7.0–M7.7 representative flows PASS.

- [ ] **Step 10: Commit**

```bash
git add tools/m7-browser-audit/m7-furniture-fit.spec.mjs \
  tools/m7-browser-audit/playwright.config.mjs \
  tools/m7-browser-audit/playwright.webkit.config.mjs
git commit -m "test: add M7.7 furniture browser acceptance"
```

---

### Task 9: Draft PR, acceptance records and protected delivery gate

**Files:**
- Create: `docs/milestones/m7-7-acceptance.md`
- Create: `docs/changelog/2026-08-01-m7-7.md`
- Do not update canonical `PROJECT_STATE.md`, `UX_ROADMAP.md` or `ROADMAP.md` before feature merge; those belong to a separate post-merge docs PR.

**Interfaces:**
- Consumes: exact implementation head and immutable CI/browser run evidence.
- Produces: Draft PR with complete scope/boundaries, acceptance checklist and protected merge readiness.

- [ ] **Step 1: Open or update Draft PR**

Title:

```text
feat: M7.7 furniture and fit workflow
```

Body must list delivered scope, owned findings, authority boundaries, design/plan paths and state that product-owner browser acceptance remains pending.

- [ ] **Step 2: Create acceptance record in pending state**

Header:

```markdown
# M7.7 — Furniture and Fit Workflow Acceptance

**Status:** AUTOMATED ACCEPTANCE PENDING / PRODUCT OWNER REVIEW PENDING
**Date:** 2026-08-01
**PR:** <actual PR number>
**Branch:** `feat/m7-7-furniture-fit-workflow`
```

Include the exact manual checklist matching Task 8 plus:

- catalogue search/category/reset;
- filter survival across catalogue close/reopen;
- valid/tight/blocked placement preview labels;
- selected-object hierarchy;
- one rotate button;
- atomic Apply + one-step Undo;
- four cardinal orientation checks;
- recommended versus actual distance meaning;
- field-local errors and focus;
- compact layout and no horizontal overflow.

- [ ] **Step 3: Create milestone changelog**

Record why, delivered behavior, unchanged authority and verification placeholders only as explicit `PENDING` status fields that are replaced before Ready. Do not claim PASS before immutable evidence exists.

- [ ] **Step 4: Run final exact-head Standard CI locally**

```bash
pnpm install --frozen-lockfile
pnpm validate:m7-docs
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: PASS.

- [ ] **Step 5: Push final candidate and wait for GitHub exact-head checks**

Required workflows:

- Standard CI;
- M7 Browser Audit with Chromium full suite;
- WebKit core smoke;
- browser evidence artifact and digest.

Do not modify files after recording a final candidate head without rerunning both workflows on the new head.

- [ ] **Step 6: Update acceptance/changelog with immutable evidence**

Record exact head SHA, Standard CI run ID/number, browser run ID/number, artifact ID and digest. Because this documentation update creates a new commit, run both required workflows again on the resulting acceptance-record head.

- [ ] **Step 7: Request product-owner browser review**

Provide the exact branch and manual checklist. Keep PR Draft. Do not mark Ready or merge until the user confirms the checklist.

- [ ] **Step 8: Record product-owner confirmation**

Update acceptance status to `ACCEPTED / READY FOR PROTECTED SQUASH MERGE`, quote the user’s confirmation exactly, and rerun Standard CI and Browser Audit on that exact acceptance head.

- [ ] **Step 9: Final review-state and scope gate**

Verify:

- PR head matches the checked SHA;
- Draft is converted to Ready only after acceptance;
- no unresolved review threads;
- no requested-changes review;
- branch is not behind `main`;
- diff contains no unauthorized package/schema/persistence/planning/recognition/3D changes.

- [ ] **Step 10: Protected squash merge**

Merge with:

```text
method: squash
expected_head_sha: <exact accepted head>
commit title: feat: M7.7 furniture and fit workflow (#<PR>)
```

- [ ] **Step 11: Post-merge documentation PR**

From the exact feature merge commit, create a documentation-only branch and update:

- `docs/PROJECT_STATE.md` — M0–M7.7 accepted;
- `docs/product/UX_ROADMAP.md` — M7.7 DONE, M7.8 only NOW;
- `docs/ROADMAP.md` — same canonical sequence;
- M7.7 acceptance/changelog — final merge SHA.

Run Standard CI and Browser Audit on the docs PR exact head, then protected squash merge it. Only after that may M7.7 be described as fully integrated and canonical state may select M7.8.

---

## Plan Self-Review Checklist

- [ ] Every approved specification section maps to at least one task.
- [ ] Search state survives component unmount through a stable runtime store.
- [ ] Search normalisation is exact and deterministic.
- [ ] Catalogue remains keyboard reachable and independently scrollable.
- [ ] Blocked placement policy is presentation-only and preserves current authority.
- [ ] Draft parser reports all local errors and preserves empty-height semantics.
- [ ] Stale drafts reset on object-ID or authoritative-value change.
- [ ] Collapsed invalid sections open and focus the first invalid field.
- [ ] Orientation cue covers all four local sides at 0°/90°/180°/270°.
- [ ] Exactly one rotate control exists.
- [ ] Canvas distinguishes dimensions, recommended zone, actual free distance and planning contour gap.
- [ ] No domain/editor-core/geometry/persistence/planning/recognition/3D changes are planned.
- [ ] Full unit/type/lint/build and Chromium/WebKit gates are included.
- [ ] Product-owner acceptance precedes Ready and protected squash merge.
- [ ] Canonical roadmap sync occurs only after feature merge in a separate docs PR.

# M3 Local-First Projects Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn Vlezet into a dependable local-first product with multiple projects, autosave, restore, JSON backup, PNG export, fit-to-content and a collapsible furniture catalogue.

**Architecture:** Add a framework-independent `@vlezet/projects` package for project records, validation, repositories, file format and autosave coordination. Keep the apartment document in `@vlezet/domain`; the web app owns only active-project lifecycle and browser rendering/export. IndexedDB is behind a repository port so cloud storage can replace it later without changing the editor.

**Tech Stack:** TypeScript 6, React 19, Next.js 16, Zustand 5, native IndexedDB, Konva 10, Vitest 4.

## Global Constraints

- Project storage is local to the current browser/device and UI copy must say so.
- No authentication, backend, PostgreSQL, cloud sync, collaboration, public links, PDF, plan import, 3D or AI in M3.
- Millimetres remain the canonical world unit.
- `VlezetDocument` remains the sole apartment-geometry source of truth.
- Semantic document changes save after 150 ms debounce; viewport saves with 500 ms trailing throttle.
- Save safety must not depend on `beforeunload`.
- No `window.alert`, `window.confirm` or raw infrastructure error text in product UI.
- PNG maximum dimension is 8192 px and default pixel ratio is 2.

---

## File map

### New package

- `packages/projects/package.json` — package metadata and scripts.
- `packages/projects/tsconfig.json` — TypeScript project config.
- `packages/projects/src/project.ts` — project types, validation and immutable operations.
- `packages/projects/src/repository.ts` — repository port and in-memory adapter.
- `packages/projects/src/indexeddb.ts` — browser IndexedDB adapter.
- `packages/projects/src/file-format.ts` — `.vlezet.json` parsing, migration and serialization.
- `packages/projects/src/autosave.ts` — latest-snapshot autosave coordinator.
- `packages/projects/src/index.ts` — public API.
- matching `*.test.ts` files — TDD coverage.

### Geometry

- `packages/geometry/src/content-bounds.ts` — plan bounds and fit-to-content viewport.
- `packages/geometry/src/content-bounds.test.ts` — empty, walls, objects and clamp cases.
- `packages/geometry/src/index.ts` — export new API.

### Web application

- `apps/web/components/projects/project-app.tsx` — startup, dashboard/editor mode and repository lifecycle.
- `apps/web/components/projects/project-dashboard.tsx` — project cards and local-storage disclosure.
- `apps/web/components/projects/confirm-dialog.tsx` — accessible destructive confirmation.
- `apps/web/components/projects/plan-png.ts` — dedicated clean PNG renderer/downloader.
- `apps/web/components/projects/download.ts` — browser Blob download helpers.
- `apps/web/components/editor/apartment-editor.tsx` — project-aware editor shell.
- `apps/web/components/editor/editor-toolbar.tsx` — project title/save/export/fit controls.
- `apps/web/components/editor/editor-canvas.tsx` — controlled initial viewport, change callback and fit request.
- `apps/web/components/editor/use-editor-store.ts` — `loadDocument` operation.
- `apps/web/components/editor/keyboard.ts` — catalogue toggle semantics.
- `apps/web/app/page.tsx` — render `ProjectApp`.
- `apps/web/app/globals.css` — dashboard, modal, status, responsive catalogue and toolbar styles.
- `apps/web/package.json` — add `@vlezet/projects` workspace dependency.

### Documentation

- `docs/milestones/m3-acceptance.md` — browser acceptance.
- `README.md` — current milestone and project workflow.

---

### Task 1: Project model and immutable operations

**Produces:** `VlezetProjectRecord`, `ProjectViewport`, `ProjectUiState`, `createProject`, `renameProject`, `duplicateProject`, `replaceProjectDocument`, `replaceProjectViewport`, `replaceProjectUi`, `validateProject`.

- [ ] Write failing tests for default project values, name trimming/limits, independent duplication, finite viewport validation and immutable replacements.
- [ ] Run `pnpm --filter @vlezet/projects test` and confirm failure because the package/API does not exist.
- [ ] Create package files and minimal implementation.
- [ ] Re-run tests and confirm all project-model tests pass.
- [ ] Commit `feat: add local project model`.

### Task 2: Repository port and browser storage

**Consumes:** `validateProject(project)`.

**Produces:** `ProjectRepository`, `MemoryProjectRepository`, `IndexedDbProjectRepository`, `createIndexedDbProjectRepository()`.

- [ ] Write failing tests for CRUD, updated-descending ordering, deterministic ID tie-break, last-project setting and isolation of returned records.
- [ ] Implement in-memory adapter.
- [ ] Add IndexedDB adapter using database `vlezet`, stores `projects` and `settings`, key path `id`, index `updatedAt`, and one transaction per mutation.
- [ ] Guard unavailable/blocked IndexedDB with `ProjectStorageError` and Russian product-safe message mapping.
- [ ] Run package tests/typecheck.
- [ ] Commit `feat: add project repositories`.

### Task 3: File format and backup

**Produces:** `serializeProjectFile(project, now)`, `parseProjectFile(text, options)`, `projectJsonFilename(name)`, typed import errors.

- [ ] Write failing tests for v3 round trip, v1/v2 migration, invalid JSON, wrong format, unsupported version, malformed geometry and slug filename.
- [ ] Implement strict structural parsing before calling `migrateDocument`.
- [ ] Ensure parse creates a fresh project ID/timestamps and never mutates caller data.
- [ ] Run tests/typecheck.
- [ ] Commit `feat: add Vlezet project backup format`.

### Task 4: Autosave coordinator

**Produces:** `AutosaveCoordinator<T>` with `schedule`, `flush`, `retry`, `dispose`, status callback and latest-snapshot semantics.

- [ ] Write fake-timer tests for 150 ms debounce, coalescing, write failure, retry with newest value, flush and stale-write ordering.
- [ ] Implement one active writer plus a replaceable pending snapshot.
- [ ] Keep failed value in memory until retry/superseding schedule.
- [ ] Run tests/typecheck.
- [ ] Commit `feat: add resilient autosave coordinator`.

### Task 5: Content bounds and viewport fitting

**Produces:** `deriveDocumentBounds(document, options)` and `fitViewportToBounds(bounds, viewportSize, paddingPx)`.

- [ ] Write failing geometry tests for empty plan, wall thickness, rotated furniture, room-only fallback and min/max scale clamp.
- [ ] Implement pure bounds union helpers and deterministic viewport calculation.
- [ ] Export from geometry package.
- [ ] Run geometry tests/typecheck.
- [ ] Commit `feat: add fit-to-plan geometry`.

### Task 6: Editor loading and controlled viewport

**Produces:** `editorStore.loadDocument(document)`, `EditorCanvasProps.initialViewport`, `onViewportChange`, `fitRequest`.

- [ ] Add failing store test proving load resets history, selections, drafts, placement and gesture.
- [ ] Implement `loadDocument` with `createHistoryState(document)`.
- [ ] Refactor canvas viewport writes through one `setProjectViewport(next)` helper that updates React state and calls the callback.
- [ ] Apply `fitRequest` through bounds helper and current canvas size.
- [ ] Run web tests/typecheck.
- [ ] Commit `feat: make editor project-loadable`.

### Task 7: Project dashboard and application lifecycle

**Produces:** dashboard/editor modes, startup restore, create/open/rename/duplicate/delete/import flows.

- [ ] Build `ProjectApp` with repository initialization and last-project restore.
- [ ] Build dashboard cards sorted by repository order, counts from derived rooms/document arrays, empty state and local-device disclosure.
- [ ] Build reusable accessible confirmation dialog for deletion.
- [ ] Save imported/new/duplicate project before opening it.
- [ ] On project switch, flush autosave before replacing editor state.
- [ ] Add inline product-safe errors and non-blocking toast state.
- [ ] Run web tests/typecheck/lint.
- [ ] Commit `feat: add local project dashboard`.

### Task 8: Autosave and editor session integration

**Produces:** active project save state, document subscription, viewport throttle, persisted catalogue state and retry.

- [ ] Subscribe to `editorStore.history.document` only while a project is active.
- [ ] Ignore the initial loaded document reference.
- [ ] Replace active project document immutably and schedule autosave.
- [ ] Add 500 ms trailing viewport timer and flush into the same latest project snapshot.
- [ ] Persist catalogue open state and make `F` toggle it.
- [ ] Render `Сохранение…`, `Сохранено`, and retryable failure through `aria-live`.
- [ ] Run tests/typecheck/lint.
- [ ] Commit `feat: add project autosave lifecycle`.

### Task 9: Toolbar and editor UX

**Produces:** back button, project name, save status, fit button, export menu and collapsible catalogue.

- [ ] Make `ApartmentEditor` accept a project-session prop contract.
- [ ] Update toolbar without removing wall/opening/object controls.
- [ ] Commit project name on Enter/blur outside editor history.
- [ ] Toggle catalogue through button and `F`; update workspace columns responsively.
- [ ] Wire `Показать весь план` to increment `fitRequest`.
- [ ] Run tests/typecheck/lint.
- [ ] Commit `feat: polish project editor shell`.

### Task 10: JSON download and PNG renderer

**Produces:** clean project JSON download and `renderPlanPngBlob(document)`.

- [ ] Add pure Blob download helper with URL revocation.
- [ ] Implement JSON export from newest in-memory active project.
- [ ] Implement dedicated canvas renderer: white background, room fills/labels, visible wall intervals, openings/door swings, furniture footprints/labels.
- [ ] Auto-frame content, use pixel ratio 2 and cap longest edge at 8192 px.
- [ ] Exclude grid, selection, guides, Transformer and panels by construction.
- [ ] Wire toolbar export menu and success/error toasts.
- [ ] Run tests/typecheck/lint/build.
- [ ] Commit `feat: add project and PNG export`.

### Task 11: Documentation and final gate

- [ ] Add `docs/milestones/m3-acceptance.md` with reload, two projects, autosave, duplicate, delete, JSON round trip, invalid import, fit, catalogue toggle and PNG checks.
- [ ] Update README to M3 and local-first limitations.
- [ ] Run one clean CI-equivalent sequence:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

- [ ] Open Draft PR with exact run evidence and leave it Draft only for browser acceptance.
- [ ] Commit `docs: add M3 acceptance guide`.

# M4 Reference Plan Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users import JPG, PNG or one selected PDF page as a calibrated local reference layer, trace exact Vlezet geometry over it, and preserve the source through autosave and portable backup.

**Architecture:** The apartment `VlezetDocument` remains unchanged. Reference metadata belongs to `@vlezet/projects`; normalized raster bytes live in a dedicated IndexedDB asset store behind `ProjectAssetRepository`. Browser adapters decode and normalize image/PDF inputs, while pure modules own validation, calibration transforms, import state and file-format migration.

**Tech Stack:** TypeScript 6.0.3, React 19.2.7, Next.js 16.2.10, Konva 10.3.0, Zustand 5.0.14, IndexedDB, Canvas2D, `pdfjs-dist` 6.1.200, Vitest 4.1.10.

## Global Constraints

- All file processing stays in the browser; no upload or server API.
- Maximum input size is 50 MiB.
- Maximum normalized longest edge is 8192 px.
- Maximum normalized pixel count is 36 megapixels.
- Maximum stored normalized raster size is 20 MiB.
- Minimum useful raster side is 200 px.
- Calibration distance is 100–100,000 mm; points are at least 20 image pixels apart.
- Calibration scale is 0.05–100 mm/px.
- One reference raster per project.
- Source pixels never enter `@vlezet/domain` or geometry-derived room/fit calculations.
- Existing fileVersion 1 backups remain importable.
- Default PNG export excludes the source; source-inclusive PNG is explicit.
- No automatic wall recognition, OCR, perspective correction, vector PDF extraction, cloud storage or multi-floor support.

---

### Task 1: Project storage v2 and reference metadata

**Files:**
- Modify: `packages/projects/src/project.ts`
- Modify: `packages/projects/src/index.ts`
- Modify: `packages/projects/src/project.test.ts`

**Interfaces:**
- Produces `ReferencePlan`, `ReferencePlanTransform`, `ReferencePlanCalibration`, `ProjectUiStateV2`, `updateProjectReferencePlan`, `updateProjectReferenceDisplay`.

- [ ] Write failing tests for v1→v2 project migration, strict reference validation, missing-reference defaults and immutable metadata updates.
- [ ] Run `pnpm --filter @vlezet/projects test -- project.test.ts` and verify failures mention missing reference APIs.
- [ ] Implement storage version 2 while accepting storage version 1 at the validation boundary.
- [ ] Keep `document` schema v3 unchanged and default `referencePlan` to `null`, `referencePanelOpen` to `false`.
- [ ] Re-run the project tests and commit `feat: add reference plan project metadata`.

### Task 2: Asset repository and IndexedDB upgrade

**Files:**
- Create: `packages/projects/src/assets.ts`
- Create: `packages/projects/src/assets.test.ts`
- Modify: `packages/projects/src/indexeddb.ts`
- Modify: `packages/projects/src/repository.ts`
- Modify: `packages/projects/src/index.ts`

**Interfaces:**
- Produces `ProjectAssetRecord`, `ProjectAssetRepository`, `MemoryProjectAssetRepository`, asset CRUD methods on the browser adapter and `replaceReferenceAssetTransaction`.

- [ ] Write failing tests for asset CRUD, project-scoped deletion, replacement ordering, rollback of a newly written asset and orphan cleanup.
- [ ] Run the package tests and verify RED.
- [ ] Implement validation for Blob MIME, byte length, project ownership and `reference-raster` kind.
- [ ] Upgrade IndexedDB from version 1 to 2, preserving `projects` and `settings`, adding `assets` plus `projectId` index.
- [ ] Ensure project deletion removes related assets in the same transaction.
- [ ] Re-run tests and commit `feat: add local project asset storage`.

### Task 3: Pure calibration and reference geometry

**Files:**
- Create: `packages/geometry/src/reference-plan.ts`
- Create: `packages/geometry/src/reference-plan.test.ts`
- Modify: `packages/geometry/src/content-bounds.ts`
- Modify: `packages/geometry/src/content-bounds.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces `calibrateReferencePlan`, `imagePointToWorld`, `worldPointToImage`, `alignCalibration`, `referencePlanWorldCorners`, `referencePlanBounds`, and reference-aware content union.

- [ ] Write failing tests for scale calculation, transform round-trip, horizontal/vertical alignment, midpoint stability, rotated bounds and fit union.
- [ ] Run geometry tests and verify RED.
- [ ] Implement one uniform similarity transform only; reject unstable or non-finite values.
- [ ] Extend content-bound helpers with an optional visible reference bound, without coupling to project types.
- [ ] Re-run tests and commit `feat: add calibrated reference geometry`.

### Task 4: File inspection and raster normalization

**Files:**
- Create: `apps/web/components/reference/reference-file.ts`
- Create: `apps/web/components/reference/reference-file.test.ts`
- Create: `apps/web/components/reference/raster-normalizer.ts`
- Create: `apps/web/components/reference/raster-normalizer.test.ts`

**Interfaces:**
- Produces `detectReferenceFileType`, `calculateNormalizedRasterSize`, `normalizeImageFile`, `NormalizedReferenceRaster`, `ReferenceImportError`.

- [ ] Write failing tests for PNG/JPEG/PDF magic bytes, mismatched extensions, size limits and normalized dimension calculation.
- [ ] Run web tests and verify RED.
- [ ] Implement signature inspection before decode and product-safe error codes.
- [ ] Implement browser image decode via `createImageBitmap`, proportional downscale, opaque/transparent handling and PNG→JPEG fallback when encoded bytes exceed 20 MiB.
- [ ] Explicitly close `ImageBitmap` and release canvas references.
- [ ] Re-run tests and commit `feat: normalize imported reference images`.

### Task 5: PDF page loader and renderer

**Files:**
- Modify: `apps/web/package.json`
- Modify: `pnpm-lock.yaml`
- Create: `apps/web/components/reference/pdf-reference.ts`
- Create: `apps/web/components/reference/pdf-reference.test.ts`

**Interfaces:**
- Produces `loadPdfReference`, `renderPdfReferencePage`, lazy `pdfjs-dist` loading and page-count metadata.

- [ ] Add `pdfjs-dist` version `6.1.200`.
- [ ] Write tests around page selection state and render-size selection using an injected PDF adapter.
- [ ] Implement dynamic browser-only import of `pdfjs-dist`, worker URL setup, page count loading, selected-page rasterization and cleanup.
- [ ] Render on an opaque white background and pass the result through the same encoded-size limits as images.
- [ ] Re-run web tests and commit `feat: render imported PDF pages locally`.

### Task 6: Import state machine and transactional application service

**Files:**
- Create: `apps/web/components/reference/reference-import-machine.ts`
- Create: `apps/web/components/reference/reference-import-machine.test.ts`
- Create: `apps/web/components/reference/reference-service.ts`
- Create: `apps/web/components/reference/reference-service.test.ts`

**Interfaces:**
- Produces explicit `ReferenceImportState`, reducer/events, `installReferencePlan`, `replaceReferencePlan`, `removeReferencePlan`.

- [ ] Write failing tests for cancellation preserving the old source, successful save ordering, retry after storage failure and missing-asset recovery.
- [ ] Implement the explicit state machine from the spec.
- [ ] Implement transactional asset/project updates using repository ports and latest project snapshots.
- [ ] Ensure failed import never mutates the active project and replacement deletes the old asset only after metadata succeeds.
- [ ] Re-run tests and commit `feat: add transactional reference import flow`.

### Task 7: Project file format v2 with embedded asset

**Files:**
- Modify: `packages/projects/src/file-format.ts`
- Modify: `packages/projects/src/file-format.test.ts`
- Modify: `packages/projects/src/index.ts`

**Interfaces:**
- Produces async `serializeProjectFileV2(project, asset?)`, `parseProjectFileV2(text, options)`, and `ParsedProjectFile` containing project plus optional asset draft.

- [ ] Write failing tests for v1 import, v2 without asset, base64 round-trip, 20 MiB rejection, dimension mismatch, invalid MIME and atomic parse failure.
- [ ] Implement fileVersion 2 while retaining fileVersion 1 parsing.
- [ ] Validate decoded byte length and raster metadata before returning an asset draft.
- [ ] Never persist from the parser; the application service performs the transaction.
- [ ] Re-run tests and commit `feat: make reference plans portable in backups`.

### Task 8: Reference panel and calibration wizard

**Files:**
- Create: `apps/web/components/reference/reference-panel.tsx`
- Create: `apps/web/components/reference/reference-wizard.tsx`
- Create: `apps/web/components/reference/calibration-input.ts`
- Create: `apps/web/components/reference/calibration-input.test.ts`
- Modify: `apps/web/components/projects/project-app.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Consumes project/asset services and calibration geometry.
- Produces upload/replace/remove flow, PDF page selector, two-point calibration, mm/metre parser, visibility/opacity/lock/transform controls and tracing-mode action.

- [ ] Write failing tests for `1200`, `1.2`, `1,2 м`, invalid/ambiguous values and tracing-mode transition.
- [ ] Implement a compact panel with accessible file input, local-processing copy and recoverable errors.
- [ ] Implement the three-step wizard: points, real length/alignment, verification.
- [ ] Provide numeric A/B coordinate fallback, draggable handles and magnifier canvas.
- [ ] Use a safe confirmation dialog for removal; cancel is initial focus.
- [ ] Re-run web tests and commit `feat: add reference import and calibration UX`.

### Task 9: Konva reference layer and transform controls

**Files:**
- Create: `apps/web/components/reference/reference-layer.tsx`
- Create: `apps/web/components/reference/use-reference-image.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/use-editor-store.ts`

**Interfaces:**
- Produces a non-listening locked raster layer below rooms, unlocked move/rotation gesture, calibration overlay and tracing mode.

- [ ] Add the reference raster between grid and room-fill layers.
- [ ] Create/revoke object URLs on asset/project changes and decode only once per URL.
- [ ] Locked mode must never intercept wall/opening/furniture input.
- [ ] Unlocked mode permits only translation and rotation; scale handles are disabled.
- [ ] Commit one project metadata snapshot per completed gesture, not per pointer event.
- [ ] Tracing mode opens the panel, locks the source, selects wall tool and reduces room-fill opacity.
- [ ] Re-run typecheck/tests and commit `feat: render and trace calibrated source plans`.

### Task 10: Viewport, PNG and project lifecycle integration

**Files:**
- Modify: `packages/geometry/src/content-bounds.ts`
- Modify: `apps/web/components/projects/plan-png.ts`
- Modify: `apps/web/components/projects/project-app.tsx`
- Modify: `apps/web/components/projects/project-dashboard.tsx`
- Modify: `apps/web/components/projects/download.ts`

**Interfaces:**
- Produces reference-aware `Весь план`, `Показать подложку целиком`, clean PNG and optional source-inclusive PNG.

- [ ] Add tests proving hidden source is excluded from fit, visible source is included, and reference-only projects frame correctly.
- [ ] Extend the independent PNG renderer with optional raster draw before clean plan layers.
- [ ] Keep clean PNG unchanged by default.
- [ ] Flush pending reference metadata when switching projects and delete assets when deleting projects.
- [ ] Add dashboard entry `Новый проект из плана`.
- [ ] Re-run tests and commit `feat: integrate reference plans across project lifecycle`.

### Task 11: Acceptance, documentation and final gate

**Files:**
- Create: `docs/milestones/m4-acceptance.md`
- Modify: `README.md`
- Modify: `.github/workflows/ci.yml` only if diagnostic visibility needs extension.

**Interfaces:**
- Produces the complete browser acceptance scenario and final PR evidence.

- [ ] Document image import, multi-page PDF, calibration, alignment, tracing, reload, replace/remove, file v2 round-trip, clean/source PNG and invalid-file safety.
- [ ] Update README feature list, local privacy statement and roadmap status.
- [ ] Run `pnpm install --frozen-lockfile`, `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` in one clean CI run.
- [ ] Review the final diff for domain contamination, leaked object URLs, asset orphan paths, raw exception copy and accidental M4.5 scope.
- [ ] Open/update Draft PR with exact run ID, commit SHA and acceptance path.

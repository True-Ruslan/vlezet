# M4 — Reference Plan Import Browser Acceptance

## Preparation

```bash
git fetch origin
git switch feat/m4-plan-import
git pull --ff-only
pnpm install --frozen-lockfile
pnpm dev
```

Use:

- one normal JPG or PNG apartment plan;
- one multi-page PDF with the apartment on a non-first page;
- one unsupported file such as TXT;
- one deliberately tiny image below 200 px on one side.

## 1. Create a project from a source plan

1. Open `Мои проекты`.
2. Click `Из плана JPG/PDF`.
3. Confirm that a new project opens with the `Подложка` panel already visible.
4. Confirm the editor is otherwise empty and usable.
5. Confirm the panel states that processing is local to the browser.

Expected:

- no registration or network upload is requested;
- the project exists before file selection;
- cancelling file selection leaves the project unchanged.

## 2. Import and calibrate a JPG/PNG

1. Upload a normal JPG or PNG.
2. Confirm the wizard displays a raster preview.
3. Click the two ends of a printed dimension line.
4. Enter the real length as `3200`.
5. Select `Эта линия горизонтальная`.
6. Drag both A and B handles and verify the line follows precisely.
7. Enter the equivalent value as `3,2 м` and confirm it is accepted.
8. Save the calibration.

Expected:

- A and B are visible and draggable;
- the magnifier follows the pointer/active handle;
- invalid values such as `50`, `abc` and `1,2 см` are rejected without changing the project;
- after save, the source appears behind the Vlezet model;
- the source is locked by default.

## 3. Import a multi-page PDF

1. Replace the current source with a multi-page PDF.
2. Confirm Vlezet shows the real page count.
3. Select a non-first page.
4. Calibrate and save it.
5. Reload the page.

Expected:

- only the selected page is shown;
- the original PDF is not required after save;
- selected page number/page count are preserved in metadata;
- reload restores the normalized raster and its calibration.

## 4. Reference controls

1. Change opacity from 5% to 100%.
2. Hide and show the source.
3. Unlock it, drag it, then lock it again.
4. Change X, Y and rotation numerically.
5. Click `Показать подложку`.
6. Click `Весь план` with the source visible, then hidden.

Expected:

- opacity and visibility update without affecting walls;
- a locked source never intercepts wall/door/furniture input;
- one completed drag creates one saved project metadata update;
- `Показать подложку` frames only the source;
- `Весь план` includes the source only while it is visible.

## 5. Tracing mode

1. Click `Начать обводку`.
2. Confirm the wall tool becomes active.
3. Confirm the source is visible and locked.
4. Trace a rectangular room and one T-junction partition.
5. Confirm room fills become quieter while tracing.
6. Press `Esc` or click `Готово`.

Expected:

- normal wall snapping/topology behavior remains unchanged;
- the source does not become part of wall selection;
- closing tracing mode restores normal room emphasis;
- walls remain editable if the source is hidden or deleted.

## 6. Autosave and reload

1. Wait for `Сохранено`.
2. Reload the browser.
3. Return to the same project.

Expected:

- source raster, calibration, opacity, visibility, lock state, X/Y/rotation and panel state are restored;
- walls, rooms, openings and furniture remain unchanged;
- no duplicate asset is created on each reload.

## 7. Duplicate project

1. Return to `Мои проекты`.
2. Duplicate the project containing a source plan.
3. Open the copy and replace/remove its source.
4. Reopen the original.

Expected:

- the copy has its own asset ID and independent raster record;
- replacing/removing the copy source does not affect the original;
- the apartment documents are independent as before.

## 8. Portable Vlezet backup

1. Export `Vlezet JSON` from the source-backed project.
2. Import the exported `.vlezet.json`.
3. Open the imported project.
4. Also import an older fileVersion 1 project without a source.

Expected:

- fileVersion 2 recreates both editable apartment geometry and normalized source asset;
- imported project and asset receive fresh local IDs;
- fileVersion 1 still imports and receives `referencePlan: null`;
- invalid JSON, future versions and source metadata without embedded bytes create no partial project.

## 9. PNG export

1. Export normal `PNG`.
2. Export `PNG с подложкой`.
3. Compare both files.

Expected:

- clean PNG excludes source pixels, grid, selection, panels and guides;
- source-inclusive PNG draws the calibrated source below rooms/walls/furniture;
- both images are automatically framed and have an opaque white background;
- source rotation and opacity match the editor.

## 10. Replace and remove safety

1. Replace a working source with another valid image.
2. Confirm the old source is removed only after the new one saves.
3. Start another replacement and cancel during calibration.
4. Remove the source using the confirmation UI.

Expected:

- successful replacement keeps exactly one source asset;
- cancellation preserves the previous source and metadata;
- removal deletes only source metadata/bytes;
- all traced walls, openings, rooms and furniture remain.

## 11. Invalid and constrained inputs

Try:

- TXT renamed to `.png`;
- file larger than 50 MiB;
- tiny image;
- corrupted PDF;
- calibration points closer than 20 px;
- length below 100 mm or above 100 m.

Expected:

- validation uses magic bytes, not extension alone;
- errors are shown in Russian with a recovery path;
- no `alert`, raw exception, blank editor or partial asset is produced;
- the previous valid source remains untouched.

## Acceptance gate

M4 is accepted when all scenarios above pass in a current Chromium browser and the same final commit passes:

```text
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

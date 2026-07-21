# M4 — Reference Plan Import and Tracing Design

## Status

High-level direction approved on 2026-07-21. This written specification is ready for user review before implementation planning.

## Product outcome

M4 lets a homeowner start from an actual developer, BTI or measurement plan instead of redrawing the apartment from memory.

The user uploads a JPG, PNG or PDF, selects a known dimension, enters its real length, and traces walls directly over the calibrated source. The imported source remains an optional reference layer. It never replaces or contaminates the structured Vlezet apartment model.

The milestone intentionally provides reliable manual tracing. Automatic wall, door and room recognition is excluded from M4 and reserved for an experimental M4.5 layer that may later produce an editable draft.

## User promise

> Upload your apartment plan, calibrate one known dimension, and trace an accurate editable apartment in minutes.

Vlezet must clearly distinguish:

- the **source plan** — a local image used as a visual reference;
- the **Vlezet model** — real walls, openings, rooms and furniture stored in millimetres.

The source plan can be hidden, replaced or deleted without deleting traced geometry.

## Chosen approach

M4 uses a calibrated raster-underlay architecture.

1. JPG and PNG files are decoded and normalized in the browser.
2. A selected PDF page is rendered once to a normalized PNG raster.
3. The normalized raster is stored as a project asset in IndexedDB.
4. Project metadata stores only the asset reference, dimensions, calibration and display settings.
5. Canvas renders the asset below rooms, walls, openings and furniture.
6. Existing wall tools continue to create the same `VlezetDocument` entities as before.

No imported image pixels enter `@vlezet/domain` or the geometry engine.

## Scope

### Included

- upload JPG, JPEG, PNG and PDF;
- inspect the actual file signature instead of trusting only the extension;
- select one page from a multi-page PDF;
- render the selected PDF page to a normalized raster;
- normalize large images to safe dimensions and encoding;
- store and restore a reference plan per project;
- calibration by two points and a known real-world distance;
- optional horizontal or vertical alignment of the calibration segment;
- reference-plan move and rotation controls;
- opacity control;
- show/hide and lock/unlock controls;
- dedicated calibration mode;
- dedicated tracing mode using the existing wall tool;
- crosshair and magnified calibration preview;
- source-plan bounds in `Весь план` when the source is visible;
- replace and remove source plan without altering apartment geometry;
- local autosave of metadata and binary asset;
- `.vlezet.json` file format v2 containing the normalized source asset;
- import of v1 and v2 Vlezet project files;
- clean PNG export excluding the source by default;
- optional PNG export including the source plan;
- clear file-size, decode and storage errors;
- M4 browser acceptance document.

### Excluded

- automatic wall, door, window or room recognition;
- OCR of printed dimensions;
- perspective correction;
- non-uniform image warping;
- multiple simultaneous source layers;
- multiple floors;
- vector PDF extraction;
- DWG, DXF, SVG or BIM import;
- cloud upload or server-side processing;
- scanning with a phone camera;
- collaborative annotation;
- automatic correction of distorted developer plans.

## Architectural boundary

The existing apartment model remains unchanged:

```text
VlezetProjectRecord
├── document: VlezetDocument
│   ├── vertices
│   ├── walls
│   ├── openings
│   ├── roomAnnotations
│   └── placedObjects
├── viewport
├── ui
└── referencePlan?          # M4 project metadata
        ↓ assetId
ProjectAssetRepository
└── normalized raster Blob  # IndexedDB binary asset
```

`VlezetDocument` remains portable, renderer-independent and expressed entirely in millimetres.

The reference plan belongs to the project layer because it is source material and editor state, not apartment geometry.

## Project storage version

Project storage advances from version 1 to version 2.

```ts
export type ProjectUiStateV2 = Readonly<{
  furnitureCatalogOpen: boolean;
  referencePanelOpen: boolean;
}>;

export type ReferencePlanSource =
  | Readonly<{
      kind: "image";
      originalMimeType: "image/png" | "image/jpeg";
    }>
  | Readonly<{
      kind: "pdf-page";
      pageNumber: number;
      pageCount: number;
      originalMimeType: "application/pdf";
    }>;

export type ReferencePlanCalibration = Readonly<{
  imagePointA: Point2;
  imagePointB: Point2;
  knownLengthMm: number;
  alignment: "none" | "horizontal" | "vertical";
}>;

export type ReferencePlanTransform = Readonly<{
  originWorld: Point2;
  millimetersPerPixel: number;
  rotationDeg: number;
}>;

export type ReferencePlanDisplay = Readonly<{
  visible: boolean;
  locked: boolean;
  opacity: number;
}>;

export type ReferencePlan = Readonly<{
  assetId: string;
  originalName: string;
  normalizedMimeType: "image/png" | "image/jpeg";
  widthPx: number;
  heightPx: number;
  source: ReferencePlanSource;
  transform: ReferencePlanTransform;
  calibration: ReferencePlanCalibration;
  display: ReferencePlanDisplay;
}>;

export type VlezetProjectRecordV2 = Readonly<{
  storageVersion: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  document: VlezetDocument;
  viewport: ProjectViewport;
  ui: ProjectUiStateV2;
  referencePlan: ReferencePlan | null;
}>;
```

Migration from project storage v1:

- `storageVersion` becomes `2`;
- `referencePlan` becomes `null`;
- `ui.referencePanelOpen` becomes `false`;
- all existing document, viewport and furniture-catalogue data remain unchanged.

## Asset storage

IndexedDB database version advances from 1 to 2.

A new object store is added:

### `assets`

```ts
export type ProjectAssetRecord = Readonly<{
  id: string;
  projectId: string;
  kind: "reference-raster";
  mimeType: "image/png" | "image/jpeg";
  byteLength: number;
  createdAt: string;
  blob: Blob;
}>;
```

Required indexes:

- `projectId`;
- optionally `createdAt` for diagnostics and cleanup.

Repository contract:

```ts
export interface ProjectAssetRepository {
  getAsset(id: string): Promise<ProjectAssetRecord | null>;
  putAsset(asset: ProjectAssetRecord): Promise<void>;
  deleteAsset(id: string): Promise<void>;
  deleteAssetsForProject(projectId: string): Promise<void>;
}
```

The browser implementation may combine project and asset repository interfaces internally, but application code receives explicit ports.

### Atomic replacement rules

Replacing a reference plan follows this order:

1. Decode and validate the new source completely in memory.
2. Write the new normalized asset.
3. Write project metadata referencing the new asset.
4. Delete the previous asset only after project metadata succeeds.
5. If metadata write fails, delete the newly written orphan asset.

Removing a reference plan:

1. Persist project metadata with `referencePlan: null`.
2. Delete the old asset.
3. A failed asset deletion is logged and cleaned during a later orphan sweep; it must not restore the removed source in UI.

Deleting a project deletes its associated assets in the same IndexedDB transaction where practical.

## Source normalization

### Supported input

Accepted user-facing extensions:

- `.jpg`;
- `.jpeg`;
- `.png`;
- `.pdf`.

Validation uses file magic bytes:

- PNG signature;
- JPEG SOI marker;
- PDF `%PDF-` header.

A mismatched or unsupported file is rejected before decode.

### Limits

- maximum input file size: 50 MiB;
- maximum normalized longest edge: 8192 px;
- maximum normalized pixel count: 36 megapixels;
- maximum stored normalized raster size: 20 MiB;
- minimum useful raster side: 200 px.

The normalization pipeline scales down proportionally when limits are exceeded. It never scales small images up.

### JPG/PNG pipeline

1. Validate signature and size.
2. Decode through `createImageBitmap` where supported.
3. Respect EXIF orientation through browser decoding.
4. Calculate safe normalized dimensions.
5. Draw to an off-screen canvas.
6. Encode a normalized PNG when line-art compression is reasonable; fall back to JPEG quality 0.92 when PNG exceeds the stored-size limit.
7. Return Blob, dimensions and source metadata.

### PDF pipeline

PDF processing is client-side only.

1. Validate PDF signature and size.
2. Load page count asynchronously.
3. Show a lightweight page selector when the PDF contains more than one page.
4. Render only the selected page.
5. Choose a render scale that respects the same 8192 px / 36 MP limits.
6. Draw an opaque white background before the page.
7. Encode the selected page as PNG, with the same JPEG fallback rule when necessary.
8. Store the normalized raster, selected page number and total page count.

The original PDF is not required after normalization and is not stored in IndexedDB or the Vlezet project file.

## Calibration model

Calibration uses two points in image-pixel coordinates and one real distance in millimetres.

```text
pixelDistance = distance(imagePointA, imagePointB)
millimetersPerPixel = knownLengthMm / pixelDistance
```

Validation:

- the two points must be at least 20 image pixels apart;
- known length must be finite and between 100 mm and 100,000 mm;
- resulting scale must be finite and between 0.05 and 100 mm/px;
- zero-length or numerically unstable calibration is rejected.

### Alignment

After point selection, the user chooses:

- `Не выравнивать`;
- `Эта линия горизонтальная`;
- `Эта линия вертикальная`.

For horizontal or vertical alignment, Vlezet adjusts `rotationDeg` so the selected image segment matches the selected world axis.

The world position of the calibration segment midpoint remains stable during alignment and recalibration. This prevents the source from jumping away from the current viewport.

### Transform

Image pixel coordinates are converted to world millimetres through a single similarity transform:

```text
worldPoint = originWorld
           + rotate(imagePoint * millimetersPerPixel, rotationDeg)
```

The inverse transform is available for calibration handles, hit testing and future image-assisted features.

Non-uniform X/Y scales are forbidden. A plan that is stretched differently along axes cannot be made metrically reliable from one calibration segment and must be treated as an approximate source.

## Import workflow

### Entry points

- project dashboard: `Новый проект из плана`;
- editor toolbar: `Подложка`;
- reference panel: `Загрузить план` or `Заменить план`.

### State machine

```ts
type ReferenceImportState =
  | { kind: "idle" }
  | { kind: "reading-file"; fileName: string }
  | { kind: "selecting-pdf-page"; pageCount: number; selectedPage: number }
  | { kind: "normalizing"; progressLabel: string }
  | { kind: "calibrating"; draft: CalibrationDraft }
  | { kind: "saving" }
  | { kind: "ready" }
  | { kind: "failed"; code: ReferenceImportErrorCode; message: string };
```

Transitions are explicit. Cancelling before `saving` leaves the project and previous reference plan unchanged.

### Calibration wizard

Step 1 — choose a known segment:

- instruction explains suitable references: a printed wall dimension, doorway width or room side;
- cursor becomes a precision crosshair;
- first click creates A;
- second click creates B;
- points can be dragged before confirmation;
- a local magnifier shows pixels around the current handle;
- current pixel length is shown for diagnostics.

Step 2 — enter real length:

- integer millimetre input;
- quick conversion helper accepts metres with decimal comma or dot, but stores millimetres;
- alignment choice;
- live scale preview.

Step 3 — verify:

- a scale bar such as `1 м` is drawn over the source;
- user confirms or returns to edit points;
- source is locked by default after confirmation.

## Reference layer rendering

Canvas layer order:

```text
1. grid
2. reference raster
3. room fills
4. walls and openings
5. furniture
6. dimensions, guides and diagnostics
```

The reference raster:

- uses the project transform;
- is clipped only by its own rectangular bounds;
- defaults to opacity `0.45`;
- uses image smoothing for normal zoom and disables it at high zoom when supported;
- never intercepts editor pointer events while locked;
- receives transform handles only while explicitly unlocked and selected.

The layer object URL is created from the IndexedDB Blob and revoked when the project, asset or component changes.

## Reference controls

The `Подложка` toolbar action opens a compact side panel.

Controls:

- visible toggle;
- opacity slider from `0.05` to `1.0`;
- lock toggle;
- `Калибровать заново`;
- `Выровнять горизонтально` and `Выровнять вертикально` using the saved calibration segment;
- exact rotation field;
- X/Y world position fields;
- `Показать подложку целиком`;
- `Заменить план`;
- `Удалить подложку` with confirmation.

Unlocking shows move and rotation handles. Scaling handles are not shown because changing visual scale must happen only through calibration.

Reference move and rotation changes are project metadata operations, not apartment document commands. They do not enter wall/furniture undo history.

## Tracing mode

After calibration, the primary action is `Начать обводку`.

Tracing mode:

- opens the reference panel;
- locks the source;
- selects the existing wall tool;
- lowers room-fill opacity so the source remains visible;
- keeps endpoint, T-junction, axis and grid snapping from M1;
- does not invent edge-detection snapping;
- shows a small reminder that exact wall lengths can be corrected in the inspector;
- preserves all existing chain-wall and room detection behavior.

The user can exit tracing mode at any time. Traced walls are ordinary domain walls and remain after the source is hidden or removed.

## Fit and viewport behavior

`Весь план` includes visible reference-plan bounds in addition to apartment geometry.

Rules:

- if a reference exists and no apartment geometry exists, frame the reference;
- if both exist and the reference is visible, frame their union;
- if the reference is hidden, frame only apartment geometry;
- `Показать подложку целиком` always frames only the source bounds;
- viewport calculations keep the existing 64 px minimum padding and scale clamps.

## Autosave

Reference metadata participates in the existing latest-snapshot autosave pipeline.

- opacity, visibility and lock state use a 250 ms trailing write;
- continuous move/rotation preview remains transient;
- one completed transform commits one project metadata snapshot;
- calibration commits only after the normalized asset has been stored successfully;
- a storage failure preserves the decoded in-memory source and offers retry;
- switching projects flushes pending reference metadata before opening another project.

Binary asset writes do not run on every opacity or transform change.

## Vlezet project file format v2

M4 upgrades exported project files while preserving v1 import.

```ts
export type VlezetProjectFileV2 = Readonly<{
  format: "vlezet-project";
  fileVersion: 2;
  exportedAt: string;
  project: Readonly<{
    name: string;
    document: VlezetDocument;
    viewport: ProjectViewport;
    ui?: ProjectUiStateV2;
    referencePlan?: Omit<ReferencePlan, "assetId"> | null;
  }>;
  assets?: readonly Readonly<{
    role: "reference-raster";
    mimeType: "image/png" | "image/jpeg";
    dataBase64: string;
  }>[];
}>;
```

Export rules:

- projects without a source may still export fileVersion 2 without assets;
- the reference raster is base64-encoded only for backup/export;
- maximum decoded asset size on import is 20 MiB;
- asset metadata dimensions must match the decoded raster;
- imported projects receive a new project ID and asset ID;
- invalid asset data fails the complete import atomically;
- fileVersion 1 remains supported and imports with no source plan;
- unknown future versions return `unsupported-version`.

The `.vlezet.json` filename convention remains unchanged.

## PNG export

Default `Экспорт → PNG` remains a clean Vlezet plan and excludes the reference source.

A second action appears when a visible reference exists:

- `PNG с исходным планом`.

This optional export renders:

1. opaque white background;
2. reference raster with its current opacity;
3. normal clean plan layers.

It still excludes grid, UI panels, selection, guides and transform controls.

## Error handling

User-facing error categories:

```ts
type ReferenceImportErrorCode =
  | "unsupported-file"
  | "file-too-large"
  | "decode-failed"
  | "pdf-load-failed"
  | "pdf-page-failed"
  | "image-too-small"
  | "normalized-asset-too-large"
  | "invalid-calibration"
  | "storage-failed"
  | "asset-missing";
```

Examples of product copy:

- `Этот формат не поддерживается. Загрузите JPG, PNG или PDF.`
- `Файл слишком большой для обработки в браузере.`
- `Не удалось прочитать выбранную страницу PDF.`
- `Выберите две точки дальше друг от друга.`
- `Подложка не найдена в локальном хранилище. Загрузите её заново.`

Raw PDF, image-decoder or IndexedDB exception messages are not shown directly.

If project metadata references a missing asset, the apartment still opens normally. The reference panel shows a recoverable warning and allows replacement or removal.

## Performance and memory

- only one reference raster exists per project;
- PDF pages other than the selected page are released after preview;
- ImageBitmap, canvas buffers and object URLs are explicitly closed or revoked;
- normalization avoids holding multiple full-resolution copies longer than necessary;
- React state stores metadata and URLs, never base64 image data;
- base64 conversion occurs only during explicit project export;
- reference rendering is cached by Konva where beneficial;
- opacity and visibility changes do not decode the Blob again;
- long operations yield to the browser and expose progress text.

## Privacy and security

- all file processing remains in the browser;
- no source file is uploaded to a server;
- imported file names are displayed as plain text only;
- SVG and HTML images are rejected;
- PDF JavaScript, attachments and links are ignored because only a rendered page raster is used;
- decoded dimensions and sizes are validated before allocation where possible;
- generated object URLs are scoped and revoked.

The UI repeats the local-processing guarantee near the upload control.

## Accessibility

- file input has an explicit accessible label;
- drag-and-drop is optional; keyboard file selection is fully supported;
- calibration handles have keyboard-accessible numeric fallback fields;
- wizard steps expose headings and progress;
- errors use `role="alert"`;
- opacity and rotation controls have associated labels and current values;
- PDF page selection is keyboard operable;
- destructive removal defaults focus to cancel;
- Escape cancels a transient import or calibration step when safe.

## Testing strategy

### Pure unit tests

- project storage v1 → v2 migration;
- reference metadata validation;
- image-pixel ↔ world transform round trip;
- calibration scale calculation;
- horizontal and vertical alignment;
- calibration midpoint stability;
- reference bounds and fit viewport union;
- normalized dimension limits;
- file signature detection;
- file-format v1/v2 parsing;
- base64 asset round trip and size rejection;
- asset replacement transaction ordering;
- orphan cleanup behavior;
- state-machine cancellation preserving the previous source.

### Adapter tests

- IndexedDB schema upgrade creates `assets` without losing v1 projects;
- asset CRUD;
- project deletion removes assets;
- missing asset recovery;
- Blob MIME and byte-length validation.

### Web tests

- reference panel state;
- calibration input parsing for mm and metres;
- tracing-mode transition;
- source visibility and catalogue coexistence;
- fit request includes source only when visible;
- clean export excludes source;
- optional export includes source.

### Integration gate

- frozen dependency installation;
- complete unit test suite;
- strict TypeScript typecheck;
- ESLint without new suppressions;
- production Next.js build.

## Milestone decomposition

### M4.1 — Reference asset foundation

- project storage v2;
- asset repository and IndexedDB upgrade;
- image import and normalization;
- persistent reference rendering;
- controls for visibility, opacity, lock and removal.

### M4.2 — Calibration and tracing

- two-point calibration;
- axis alignment;
- magnifier and calibration UX;
- transform controls;
- tracing mode;
- reference-aware fit-to-content.

### M4.3 — PDF and portable backup

- client-side PDF page selection and rasterization;
- project file format v2 with embedded normalized asset;
- PNG export with optional source;
- recovery and final acceptance.

## Acceptance criteria

M4 is complete when all of the following are true:

1. A user uploads a normal JPG or PNG apartment plan and sees it as a reference layer.
2. A user selects two points, enters a known length, and obtains a stable millimetre scale.
3. Horizontal or vertical alignment rotates the source while preserving the selected midpoint.
4. A user traces a closed room with normal Vlezet walls and receives the expected room area.
5. Hiding or deleting the reference does not change walls, openings, rooms or furniture.
6. Opacity, visibility, lock state, transform and calibration survive a full browser reload.
7. Replacing the source does not lose existing apartment geometry.
8. A multi-page PDF allows page selection and stores only the selected rendered page.
9. `Весь план` includes the visible source and excludes it when hidden.
10. Clean PNG excludes the source; `PNG с исходным планом` includes it.
11. Exported fileVersion 2 imports into a new independent project with the same source, calibration and apartment geometry.
12. Existing fileVersion 1 backups still import correctly.
13. Invalid, oversized or undecodable files leave the current project unchanged.
14. A missing IndexedDB asset does not prevent the apartment document from opening.
15. Replacing or deleting a project does not leave reachable orphan assets.
16. `pnpm test`, `pnpm typecheck`, `pnpm lint` and `pnpm build` pass in one clean CI run.

## Future M4.5 compatibility

The normalized raster and pixel/world transform form a stable boundary for future recognition.

An automatic recognizer may later receive:

```ts
recognizeReferencePlan({
  raster,
  imageToWorldTransform,
})
```

It must return a proposed editable `VlezetDocument` draft with confidence and diagnostics. It may never silently mutate the current project. M4 does not implement or require this recognizer.

# M7.8C — Assisted Tracing Pivot Design

**Date:** 2026-08-08  
**Status:** product direction approved; implementation must follow a separate TDD plan  
**Base:** `main` at `b2b3e9ffe6e26286b06ef1b761df4ccb4e46482d`

## 1. Context and decision

The unaccepted automatic M7.8C experiment passed its deterministic Core/Source/Browser gates but failed product-owner usefulness acceptance on the original real apartment plan.

Observed retest:

```text
walls:        28
openings:      2
confident:     4
needs review: 26
```

The failure is architectural rather than a missing threshold tweak:

- local full-plan CV still misses or fragments true structure;
- visible windows are not recovered reliably;
- sanitary/furniture notation remains difficult to distinguish from thin construction;
- verification-only AI cannot recover geometry that local CV never proposed;
- adding more plan-specific Hough/mask/symbol heuristics now has poor expected return and increasing regression risk.

PRs #42, #44 and #45 are therefore preserved as closed R&D evidence and must not be merged into the product branch.

The product workflow pivots to **Assisted Tracing**:

> The user indicates what object exists and approximately where it is. Vlezet performs bounded local image assistance to place that explicitly requested object precisely when source evidence is unambiguous. If evidence is ambiguous, Vlezet abstains and ordinary manual editing continues unchanged.

Automatic reconstruction remains long-term R&D. A future attempt should prefer semantic segmentation → topology reconstruction → vectorization → deterministic validation instead of extending the current heuristic stack.

## 2. Alternatives considered

### A. Continue full-plan heuristic recognition

Rejected for the product path. Existing work proves it can be made measurable and fail-closed, but the real-plan usefulness gap remains too large and new rules increasingly encode fixture-specific assumptions.

### B. Assisted Tracing — selected

User intent supplies the missing semantic prior. The system no longer has to discover every wall/opening in the entire image. It only has to answer a bounded local question such as “where is the centre of the wall the user is pointing at?” or “what gap around this point belongs to this already known host wall?”. This sharply reduces ambiguity while preserving exact editable geometry.

### C. Learned semantic segmentation

Promising future R&D but not selected for the current product slice. It requires a representative labelled corpus, model/runtime decisions, evaluation infrastructure and deployment work that are not necessary to make plan import materially better now.

## 3. Product goal

Make calibrated source-plan tracing fast and trustworthy without pretending the source image can be reconstructed automatically.

The user should be able to:

1. calibrate and lock a JPG/PNG/PDF reference as today;
2. enter **Умная обводка**;
3. click approximately on structural walls and have endpoints/centreline snap to strong nearby source evidence;
4. receive an inferred wall thickness only when the same local evidence supports it strongly;
5. choose `Дверь` or `Окно`, point near an already traced host wall and receive a source-aligned gap/width proposal when a bounded gap is clearly present;
6. continue with ordinary Vlezet snapping whenever image evidence is absent or ambiguous;
7. undo/redo every committed wall/opening as ordinary semantic editor history.

The system must never turn ambiguous image evidence into authoritative geometry merely to appear helpful.

## 4. Scope and non-goals

### In scope

- local-only assisted tracing over a calibrated reference;
- deterministic source-pixel ↔ world-space mapping through existing `imagePointToWorld` / `worldPointToImage` authority;
- bounded raster analysis for source-aligned horizontal/vertical architectural walls;
- high-confidence wall centreline and thickness assistance;
- high-confidence host-wall gap/width assistance for user-selected door/window tools;
- visible explanation of whether the current preview is reference-assisted or ordinary/manual;
- runtime toggle to disable image assistance without leaving tracing mode;
- exact semantic history and existing topology/opening validation;
- Chromium and representative WebKit acceptance.

### Explicit non-goals

- full-plan automatic wall/opening/room reconstruction;
- AI/LLM calls in the tracing flow;
- OCR, room labels or area reconciliation;
- automatic door-vs-window classification in this MVP — the user chooses the type;
- automatic furniture/sanitary interpretation;
- perspective correction;
- learned CV models;
- image-assisted diagonal/curved walls in the first slice;
- schema, migration or portable-project format changes;
- silently modifying already committed geometry.

Ordinary manual wall/opening tools remain available for every case outside the assist envelope, including thin/diagonal walls where local evidence is not strong enough.

## 5. Authority model

Authority order is fixed:

```text
existing Vlezet topology
> explicit user tool/type intent
> high-confidence local reference assist
> ordinary grid/angle/manual fallback
```

Rules:

1. Existing vertices and wall junctions remain the strongest snap targets.
2. Reference assistance may move only the ephemeral preview/draft point the user is currently creating.
3. Reference assistance may not move an existing wall/opening.
4. Door/window type always comes from the selected editor tool in this MVP.
5. Opening placement still uses existing host-wall geometry and `validateOpening` authority.
6. A low-confidence or ambiguous image result is equivalent to no result.
7. A committed entity enters `VlezetDocument` only through the existing editor command/history path.
8. No reference-analysis result is persisted.

## 6. Architecture

### 6.1 Pure reference-analysis core

Add a small framework-independent module under the existing reference feature boundary, not under automatic recognition.

Proposed files:

```text
apps/web/components/reference/reference-trace-raster.ts
apps/web/components/reference/reference-trace-assist.ts
```

`reference-trace-raster.ts` owns only deterministic raster preparation:

```ts
type ReferenceTraceRaster = Readonly<{
  width: number;
  height: number;
  sourceWidthPx: number;
  sourceHeightPx: number;
  sourceToRasterScale: number;
  luminance: Uint8Array;
}>;

async function referenceBlobToTraceRaster(blob: Blob): Promise<ReferenceTraceRaster>;
```

Constraints:

- decode locally with browser APIs;
- maximum analysis edge: 2400 px;
- preserve exact source-to-analysis scale;
- no source bytes leave the browser;
- no OpenCV requirement;
- failure disables assistance only; it never blocks manual tracing.

`reference-trace-assist.ts` is a pure module operating on `ReferenceTraceRaster`, source/image coordinates and physical scale.

Core contracts:

```ts
type ReferenceWallAssist = Readonly<{
  pointImage: Point2;
  axis: "horizontal" | "vertical";
  thicknessPx: number;
  confidence: number;
}>;

function findReferenceWallAssist(input: Readonly<{
  raster: ReferenceTraceRaster;
  pointerImage: Point2;
  millimetersPerPixel: number;
  expectedAxis?: "horizontal" | "vertical";
}>): ReferenceWallAssist | null;

type ReferenceOpeningGapAssist = Readonly<{
  centerImage: Point2;
  widthPx: number;
  confidence: number;
}>;

function findReferenceOpeningGapAssist(input: Readonly<{
  raster: ReferenceTraceRaster;
  hostStartImage: Point2;
  hostEndImage: Point2;
  hostThicknessMm: number;
  pointerImage: Point2;
  millimetersPerPixel: number;
  kind: "door" | "window";
}>): ReferenceOpeningGapAssist | null;
```

No IDs, editor state, React state, provider concepts or persistence types enter this core.

### 6.2 Wall assistance

The wall helper examines only a physically bounded patch around the pointer.

For the first click it evaluates source-horizontal and source-vertical candidates. A candidate is valid only when:

- the pointer is within a bounded physical search radius of a dark structural band;
- the band has continuous tangent support over a minimum physical length;
- the normal cross-section contains one coherent dark band with plausible architectural thickness;
- contrast against both adjacent sides is sufficient;
- the winning orientation/centre has a required score margin over competing nearby bands.

If both orientations or two parallel bands are similarly plausible, return `null`.

For the second wall point, the current user gesture supplies `expectedAxis`. The helper must not switch to a competing perpendicular line merely because it is darker.

The output point is the centre of the detected structural band. `thicknessPx` is converted through the calibrated `millimetersPerPixel` and used only when both endpoints support compatible thickness estimates. If thickness evidence disagrees beyond the allowed tolerance, the wall is still position-assisted but uses the ordinary default/current thickness.

This directly handles the real product problem of a thick wall being represented by two visual edges: the user points at one wall and the assist targets the band centre rather than creating two independently discovered axes.

### 6.3 Existing snap integration

`EditorCanvas.snapPointer` keeps its existing vertex/wall topology search first.

When no topology snap wins and all of these are true:

- tracing mode is active;
- reference assistance is enabled;
- a calibrated visible reference and prepared trace raster exist;
- the pointer lies inside reference bounds;

then the reference helper may provide the candidate point.

If it abstains, the current `snapWallPoint` grid/endpoint/angle behavior runs unchanged.

No existing `SnapKind` has to become persistent product state. Reference-assist metadata is ephemeral canvas state used for presentation and commit parameters only.

### 6.4 Wall thickness commit

Extend the editor-store wall commit API narrowly:

```ts
commitDraftWall(options?: Readonly<{ thicknessMm?: number }>): void;
```

The ordinary wall tool calls it without options and behaves exactly as before.

Assisted tracing may pass `thicknessMm` only for a validated high-confidence band estimate within the existing supported wall-thickness domain.

The wall plus assisted thickness must be committed as **one semantic history command**, not “create wall” followed by an automatic second edit. Undo removes the whole created wall in one step and Redo restores it exactly.

### 6.5 Opening gap assistance

The user first creates/traces the host wall. They then explicitly select `Дверь` or `Окно`.

The current nearest-host logic remains authoritative. Once a host is known, the reference helper may scan only a bounded interval around the pointer along that host.

A gap is usable only when:

- it is fully bounded by supported wall material on both sides;
- it lies inside the known host span and away from unsafe endpoints/junctions;
- its physical width is plausible for the selected user type;
- structural occupancy in the candidate interval is meaningfully lower than the supported host bands around it;
- there is one clear interval near the pointer rather than multiple similarly scored alternatives.

If valid, the existing opening preview uses the detected centre/width and existing `validateOpening` rules. If not valid, the editor shows the ordinary default-width preview and labels it as unassisted.

The helper does **not** infer whether the source symbol is a door or a window. This removes the hardest semantic ambiguity from the MVP while still making placement precise once the user supplies the type.

### 6.6 Runtime/UI state

Assistance state is runtime-only. No project schema changes are allowed.

`ApartmentEditor` owns a tracing-assist enabled flag for the active workflow, default `true` when tracing starts.

The tracing banner becomes:

```text
Умная обводка
Укажите стену примерно — Vlezet привяжет её к подложке только при однозначном сигнале.
[Привязка к подложке: вкл/выкл] [Готово]
```

The toggle is a real button with `aria-pressed`, keyboard reachable and usable on compact layouts.

Canvas feedback distinguishes three states without requiring the user to understand confidence numbers:

- `Привязано к подложке` — strong image assist is driving the preview;
- `Неоднозначно — без привязки` — source evidence was checked but deliberately ignored;
- ordinary existing snap/help copy when no reference assist applies.

A visual guide shows the detected wall centre/band or opening interval only while previewing. It is ephemeral and never exported as document geometry.

## 7. Reference transform handling

All source/world conversion must reuse the existing geometry authority:

- `worldPointToImage` before raster lookup;
- apply `sourceToRasterScale` only at the analysis-raster boundary;
- convert the chosen raster/source point back through `imagePointToWorld`.

No new hand-written rotation/scale formula is allowed inside canvas interaction code.

This preserves current calibration behavior including `rotationDeg = 0` when the user chooses “Не выравнивать”, and prevents another hidden-orientation regression.

## 8. Failure and safety behavior

Assisted tracing is enhancement-only.

- Raster decode failure → tracing still works manually; a non-blocking status explains that source snapping is unavailable.
- Pointer outside source bounds → ordinary snapping.
- Ambiguous wall axis → ordinary snapping.
- Two nearby plausible bands → ordinary snapping.
- Weak/short symbol-like evidence → ordinary snapping.
- Unsupported diagonal source wall → ordinary snapping.
- Ambiguous opening interval → ordinary default opening preview.
- Invalid assisted opening → keep preview invalid; never relax `validateOpening`.
- Reference replaced/removed → discard trace raster and all ephemeral assist state immediately.
- Reference revision changed while analysis is preparing → stale result must not become active.

There is no network fallback.

## 9. Relationship to automatic recognition

The existing accepted M7.8A/B benchmark and safe Draft/Apply concepts remain historical/product infrastructure, but automatic reconstruction is no longer the primary import path.

For this pivot:

- do not cherry-pick the unaccepted geometry heuristics from #42/#44/#45 wholesale;
- do not run paid model qualification as a merge requirement;
- keep automatic recognition code available only as clearly experimental/de-emphasized functionality until a later explicit removal or R&D redesign;
- the primary reference-plan CTA is Assisted Tracing.

Long-term automatic recognition work stays tracked separately from this MVP and must not block it.

## 10. Testing strategy

Every behavior that can be deterministic must be automated.

### 10.1 Pure raster/assist unit tests

Use small generated `ImageData`/luminance fixtures rather than screenshots or OCR.

Required wall cases:

1. centred horizontal dark band snaps to its centre;
2. centred vertical dark band snaps to its centre;
3. inferred thickness matches the synthetic band within one raster pixel;
4. pointer near one of two similarly strong parallel bands returns `null` when ambiguous;
5. a short dark sanitary/furniture-like stroke lacks tangent support and returns `null`;
6. two true walls separated by a light corridor remain distinct;
7. expected-axis input prevents perpendicular hijacking on the second endpoint;
8. out-of-bounds and analysis-budget paths fail closed;
9. results are deterministic across repeated calls.

Required opening cases:

1. one bounded 900 mm door-like gap is recovered near the pointer;
2. one bounded window-like low-occupancy interval is recovered when the selected type is `window`;
3. endpoint gap is rejected;
4. gap without strong host material on both sides is rejected;
5. two equally plausible nearby gaps are rejected as ambiguous;
6. returned interval never exceeds host bounds;
7. results are deterministic across repeated calls.

### 10.2 Geometry/transform contracts

Tests must prove source ↔ raster ↔ world round trips for:

- `rotationDeg = 0`;
- calibrated horizontal/vertical alignment;
- a non-zero arbitrary stored reference rotation.

The test should assert use of existing `imagePointToWorld` / `worldPointToImage`, not a duplicated transform implementation.

### 10.3 Editor-store tests

Required:

- assisted wall thickness is part of one `wall/add-*` history command;
- one Undo removes the assisted wall; one Redo restores exact geometry/thickness;
- ordinary `commitDraftWall()` without options remains byte-for-byte behavior compatible;
- invalid thickness input cannot bypass existing wall validation.

### 10.4 Canvas interaction tests

Required:

- existing vertex snap beats reference assist;
- existing wall-junction snap beats reference assist;
- reference assist beats grid/manual fallback only when high-confidence;
- disabling the assist toggle immediately restores ordinary behavior;
- leaving tracing mode clears assist preview metadata;
- changing/removing reference invalidates the raster/preview;
- opening preview continues to use existing host and validation authority.

### 10.5 Browser acceptance

Chromium full flow plus representative WebKit must cover:

1. import and calibrate a generated reference fixture;
2. start `Умная обводка`;
3. observe a source-assisted wall preview;
4. commit one wall with assisted thickness;
5. create a connected second wall without breaking topology snapping;
6. create a door/window using a source-assisted host gap;
7. toggle image assistance off and create an ordinary manual wall;
8. Undo/Redo each committed semantic edit;
9. verify no network request is required for tracing;
10. verify compact layout keeps toggle/status/finish controls reachable.

## 11. Product-owner acceptance on the original plan

Automated synthetic tests are necessary but not sufficient because this feature exists specifically to improve the real source-plan workflow.

Manual acceptance is intentionally small and observational:

1. plan remains in the exact calibrated orientation; no hidden rotation;
2. when the owner points near the thick load-bearing wall, the preview selects one centre axis rather than both visual edges;
3. inferred thick-wall width is directionally consistent with the source band, or the assist abstains rather than guessing;
4. the thin loggia wall can always be drawn correctly — assisted if evidence is strong, ordinary manual fallback otherwise;
5. a service/washbasin symbol does not become geometry unless the user explicitly draws it;
6. at least one real door and one real window can be placed on already traced host walls, with reference-aligned width when the gap evidence is clear;
7. ambiguous cases visibly fall back to manual behavior rather than snapping to the wrong structure;
8. Undo/Redo remain one semantic action per created wall/opening.

No acceptance target requires the system to discover objects the user did not point to.

## 12. Success definition

This slice is successful when the primary source-plan workflow changes from “inspect a large uncertain automatic Draft” to “draw the structure you mean, with safe local precision assistance”.

It must improve **trust and editability first**. Speed is collected as product evidence but is not allowed to justify unsafe snapping in this first slice.

Automatic recognition can return later only when a new architecture beats this assisted baseline on representative real plans without weakening deterministic authority.
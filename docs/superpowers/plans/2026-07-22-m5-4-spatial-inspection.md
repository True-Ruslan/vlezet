# M5.4 Spatial Inspection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add read-only semantic hover/select inspection for rooms, walls, and placed objects in the existing Three.js view, backed only by authoritative document/geometry/fit data.

**Architecture:** Three.js hits are converted to a small `SpatialInspectionTarget` union using semantic `userData`. `SpatialViewer` owns ephemeral hover/selection state. A pure resolver reads `VlezetDocument`, `SpatialScene`, and `@vlezet/geometry` derivations to build display details. Renderer resources temporarily emphasize matching meshes without changing domain state.

**Tech Stack:** TypeScript, React, Next.js 16, Zustand, Three.js, Vitest, `@vlezet/domain`, `@vlezet/geometry`, `@vlezet/spatial`.

## Global Constraints

- Millimetres remain the canonical world unit.
- Three.js meshes are never geometry, measurement, collision, or fit authority.
- Inspection state is ephemeral and must not mutate `VlezetDocument`, history, or autosave state.
- No new persisted schema/state is introduced.
- First slice inspects rooms, walls, and placed objects only.
- Openings remain non-inspected placeholders.
- No direct 3D editing, decorative asset pipeline, or M6 planning/AI scope.

---

### Task 1: Pure semantic inspection contract

**Files:**
- Create: `apps/web/components/spatial/spatial-inspection.ts`
- Create: `apps/web/components/spatial/spatial-inspection.test.ts`

**Interfaces:**
- Produces: `SpatialInspectionTarget`, `spatialInspectionTargetFromUserData`, `buildSpatialInspectionDetails`.
- Consumes: `VlezetDocument`, `SpatialScene`, `deriveRooms`, `deriveRectangularRoomDimensions`, `evaluateObjectFits`, `getWallEndpoints`.

- [ ] **Step 1: Write failing tests**

Cover:

```ts
expect(spatialInspectionTargetFromUserData({ kind: "floor", roomId: "room-1" }))
  .toEqual({ kind: "room", id: "room-1" });
expect(spatialInspectionTargetFromUserData({ kind: "wall", wallId: "wall-1" }))
  .toEqual({ kind: "wall", id: "wall-1" });
expect(spatialInspectionTargetFromUserData({ kind: "placed-object", objectId: "sofa" }))
  .toEqual({ kind: "placed-object", id: "sofa" });
expect(spatialInspectionTargetFromUserData({ kind: "opening-placeholder", openingId: "door" }))
  .toBeNull();
```

Also build a small rectangular document and assert:

```ts
expect(roomDetails.areaM2).toBeCloseTo(11.715, 3);
expect(wallDetails.lengthMm).toBe(3550);
expect(wallDetails.thicknessMm).toBe(100);
expect(objectDetails.fitStatus).toBe("fits");
```

- [ ] **Step 2: Run CI to verify RED**

Commit tests without implementation and verify the branch workflow fails because `./spatial-inspection` does not exist.

Expected: CI `Unit tests` or TypeScript phase fails for the missing module/export.

- [ ] **Step 3: Implement minimal pure resolver**

Create a discriminated target union and details union. Resolve only known IDs; return `null` for stale/unknown entities.

Key behavior:

```ts
export type SpatialInspectionTarget =
  | Readonly<{ kind: "room"; id: string }>
  | Readonly<{ kind: "wall"; id: string }>
  | Readonly<{ kind: "placed-object"; id: string }>;
```

Use `deriveRooms(document)` for room name/area, `getWallEndpoints` + `Math.hypot` for wall centreline length, and `evaluateObjectFits(document)` for placed-object fit status/diagnostics.

- [ ] **Step 4: Verify GREEN**

Run strict CI and confirm unit tests, typecheck, lint, and build pass.

- [ ] **Step 5: Commit**

Commit message:

```text
feat: add authoritative spatial inspection model
```

---

### Task 2: Renderer semantic emphasis lifecycle

**Files:**
- Modify: `apps/web/components/spatial/spatial-scene-renderer.ts`
- Modify: `apps/web/components/spatial/spatial-scene-renderer.test.ts`

**Interfaces:**
- Consumes: `SpatialInspectionTarget` as a type-only dependency.
- Produces: `SpatialRenderResources.emphasize(target, mode)`.

- [ ] **Step 1: Write failing renderer tests**

Add a scene with two wall segments sharing one wall ID and one unrelated object. Assert:

```ts
resources.emphasize({ kind: "wall", id: "wall" }, "selected");
expect(firstWall.material).not.toBe(baseWallMaterial);
expect(secondWall.material).not.toBe(baseWallMaterial);
expect(object.material).toBe(baseObjectMaterial);

resources.emphasize(null, "hover");
expect(firstWall.material).toBe(baseWallMaterial);
expect(secondWall.material).toBe(baseWallMaterial);
```

Attach `dispose` listeners to temporary materials and assert they are disposed when emphasis changes/clears.

- [ ] **Step 2: Verify RED in CI**

Expected failure: `emphasize` is missing from `SpatialRenderResources`.

- [ ] **Step 3: Implement minimal emphasis lifecycle**

Keep existing shared base materials. On `emphasize`:

1. restore all previously replaced mesh materials;
2. dispose temporary highlight clones;
3. match inspectable meshes by semantic `userData`;
4. clone only matched `MeshStandardMaterial` instances;
5. apply emissive emphasis;
6. replace material temporarily.

Wall target matches every mesh with the same `wallId`; room matches floor `roomId`; placed object matches `objectId`.

`dispose()` must clear emphasis before disposing base resources.

- [ ] **Step 4: Verify GREEN**

Run strict CI.

- [ ] **Step 5: Commit**

```text
feat: add spatial entity emphasis lifecycle
```

---

### Task 3: Viewer raycast hover/select and inspector UI

**Files:**
- Modify: `apps/web/components/spatial/spatial-viewer.tsx`
- Modify: `apps/web/components/spatial/spatial-viewer.module.css`
- Create: `apps/web/components/spatial/spatial-inspector.tsx`
- Create: `apps/web/components/spatial/spatial-inspector.test.tsx`

**Interfaces:**
- Consumes: `SpatialInspectionTarget`, `buildSpatialInspectionDetails`, renderer `emphasize`.
- Produces: read-only visible inspection workflow.

- [ ] **Step 1: Write failing inspector component tests**

Test representative details without WebGL:

```tsx
render(<SpatialInspector details={{
  kind: "placed-object",
  id: "sofa",
  name: "Диван",
  category: "seating",
  widthMm: 2200,
  depthMm: 900,
  heightMm: 850,
  heightWasDefaulted: false,
  rotationDeg: 0,
  fitStatus: "fits",
  diagnostics: [],
}} selected onClear={() => {}} />);

expect(screen.getByText("Диван")).toBeDefined();
expect(screen.getByText("Влезает")).toBeDefined();
expect(screen.getByText(/2200 × 900/)).toBeDefined();
```

Also cover room area/clear dimensions and wall centreline/thickness copy.

- [ ] **Step 2: Verify RED in CI**

Expected failure: `SpatialInspector` module missing.

- [ ] **Step 3: Implement read-only inspector component**

Render concise Russian factual copy:

- room: name, usable area, clear dimensions when available;
- wall: `Длина по оси стены`, thickness, visible segment count;
- object: dimensions, height/projection note, rotation, fit label, diagnostic reasons.

Selected state includes a clear button; hover preview does not.

- [ ] **Step 4: Wire viewer raycasting**

Inside the existing Three.js effect:

- instantiate one `THREE.Raycaster` and `THREE.Vector2`;
- `pointermove`: convert client point using `renderer.domElement.getBoundingClientRect()`, raycast recursively into `resources.group`, resolve first inspectable semantic target;
- `click`: select hit target or clear on empty space;
- `pointerleave`: clear hover;
- remove all listeners in cleanup.

Use refs for current hovered/selected targets so the Three.js event callbacks do not need to recreate the renderer effect.

- [ ] **Step 5: Wire emphasis and details**

Selected target takes precedence over hover:

```ts
const activeTarget = selectedTarget ?? hoveredTarget;
const details = useMemo(
  () => activeTarget ? buildSpatialInspectionDetails(document, projection.scene, activeTarget) : null,
  [activeTarget, document, projection.scene],
);
```

Update renderer emphasis whenever active target changes. If a target becomes stale after document/projection changes, clear selection safely.

- [ ] **Step 6: Add responsive CSS**

Right-side compact card on desktop; width constrained on smaller viewports so camera controls/help remain usable.

- [ ] **Step 7: Verify GREEN**

Strict CI must pass frozen install, full tests, typecheck, lint, and production build.

- [ ] **Step 8: Commit**

```text
feat: add 3D hover select inspector
```

---

### Task 4: Documentation and acceptance record

**Files:**
- Create: `docs/milestones/m5-4-acceptance.md`
- Modify after browser acceptance: `docs/PROJECT_STATE.md`, `docs/ROADMAP.md`, `docs/CHANGELOG.md`

**Interfaces:**
- Documents exact accepted head, CI run, browser checks, known limits, and next roadmap decision.

- [ ] **Step 1: Add acceptance checklist before final browser test**

Checklist:

```text
[ ] room hover/select
[ ] wall hover/select
[ ] placed-object hover/select
[ ] authoritative room area/dimensions
[ ] authoritative wall length/thickness
[ ] authoritative fit status/reasons
[ ] selection clear/empty click
[ ] camera controls preserved
[ ] 2D↔3D preserved
[ ] no document/history/autosave mutation
[ ] exact-head strict CI PASS
```

- [ ] **Step 2: Create/update draft PR**

PR title:

```text
feat: M5.4 spatial inspection
```

Keep it Draft until strict CI and real browser acceptance are complete.

- [ ] **Step 3: Final exact-head verification**

Verify the exact PR head has successful strict CI.

- [ ] **Step 4: Browser acceptance**

Use the representative apartment and check all acceptance items.

- [ ] **Step 5: Record final state only after acceptance**

Do not mark M5.4 DONE in canonical state docs before browser acceptance.

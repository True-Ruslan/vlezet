# M2 Furnishing and Fit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add real-sized furniture/appliance placement, exact transforms, deterministic fit feedback, clearances and measurements to the Vlezet 2D editor.

**Architecture:** Persist immutable `PlacedObject` snapshots in schema v3. Keep all oriented-rectangle, collision, containment, fit and snapping calculations in `packages/geometry`; keep semantic document mutations in `packages/editor-core`; keep catalogue data and pointer interaction adapters in `apps/web`.

**Tech Stack:** TypeScript 6, React 19, Next.js, Zustand, Konva/react-konva, Vitest, pnpm workspaces.

## Global Constraints

- Millimetres remain the canonical world unit.
- `position` is the centre of an object footprint.
- Canvas/Konva objects are projections only and are never persisted.
- Catalogue presets are insertion templates; placed objects snapshot their geometry.
- Invalid placements remain editable and receive explainable diagnostics.
- Collision and comfort recommendation are distinct concepts.
- One completed pointer gesture creates one history entry.
- Geometry packages remain independent from React, Konva and Next.js.
- No branded marketplace, 3D, AI layout generation, persistence backend or mobile editing in M2.

---

### Task 1: Schema v3 and placed-object domain model

**Files:**
- Create: `packages/domain/src/placed-object.ts`
- Modify: `packages/domain/src/document.ts`
- Modify: `packages/domain/src/index.ts`
- Modify: `packages/domain/src/document.test.ts`
- Modify: `packages/domain/src/migration.test.ts`

**Interfaces:**
- Produces `PlacedObject`, `ObjectCategory`, `ClearanceMargins`, `createPlacedObject`, `normalizeRotationDeg`, `VlezetDocumentV3`.
- `createEmptyDocument()` returns schema 3 with `placedObjects: []`.
- `migrateDocument()` accepts v1/v2/v3 and returns v3.

- [ ] **Step 1: Write failing schema and migration tests**

```ts
it("creates schema v3 with an empty placed-object collection", () => {
  expect(createEmptyDocument()).toMatchObject({ schemaVersion: 3, placedObjects: [] });
});

it("migrates schema v2 without changing shell geometry", () => {
  const migrated = migrateDocument(v2Document);
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.placedObjects).toEqual([]);
  expect(migrated.walls).toEqual(v2Document.walls);
});
```

- [ ] **Step 2: Run domain tests and verify RED**

Run: `pnpm --filter @vlezet/domain test`  
Expected: failure because schema 3 and `PlacedObject` do not exist.

- [ ] **Step 3: Implement immutable placed-object types and validation**

```ts
export type ObjectCategory = "sleep" | "seating" | "storage" | "table" | "chair" | "kitchen" | "appliance" | "custom";
export type ClearanceMargins = Readonly<{ front: number; right: number; back: number; left: number }>;
export type PlacedObject = Readonly<{
  id: string;
  presetId: string | null;
  name: string;
  category: ObjectCategory;
  position: Point2;
  width: number;
  depth: number;
  height?: number;
  rotationDeg: number;
  clearance: ClearanceMargins;
}>;

export function normalizeRotationDeg(value: number): number {
  if (!Number.isFinite(value)) throw new RangeError("Rotation must be finite");
  const normalized = ((value % 360) + 360) % 360;
  return Object.is(normalized, -0) ? 0 : normalized;
}
```

`createPlacedObject` must trim names, reject dimensions outside 50–20,000 mm, reject negative clearances and clone nested values.

- [ ] **Step 4: Implement schema v3 migration**

`VlezetDocumentV2` remains readable. `VlezetDocumentV3` contains all v2 fields plus `placedObjects`. v1 first migrates to the v2 shell representation, then receives `placedObjects: []`.

- [ ] **Step 5: Run domain tests and typecheck**

Run: `pnpm --filter @vlezet/domain test && pnpm --filter @vlezet/domain typecheck`  
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add packages/domain
git commit -m "feat: add schema v3 placed objects"
```

---

### Task 2: Oriented-rectangle geometry primitives

**Files:**
- Create: `packages/geometry/src/oriented-rectangle.ts`
- Create: `packages/geometry/src/oriented-rectangle.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces `OrientedRectangle`, `orientedRectangleCorners`, `orientedRectangleAxes`, `pointInOrientedRectangle`, `orientedRectanglesIntersect`, `localToWorld`, `worldToLocal`, `expandedOrientedRectangle`.

- [ ] **Step 1: Write RED tests for 0°, 90°, 45° and exact touch**

```ts
it("rotates a centred 2000x1000 rectangle by 90 degrees", () => {
  expect(orientedRectangleCorners({ center:{x:0,y:0}, width:2000, depth:1000, rotationDeg:90 }))
    .toEqual([{x:500,y:-1000},{x:500,y:1000},{x:-500,y:1000},{x:-500,y:-1000}]);
});

it("does not classify edge touching as overlap", () => {
  expect(orientedRectanglesIntersect(a, touchingB)).toBe(false);
});
```

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @vlezet/geometry test`  
Expected: missing oriented-rectangle API.

- [ ] **Step 3: Implement transforms and SAT intersection**

Use unit axes derived from `cos/sin`, project all four corners onto both rectangles' axes, and require positive overlap greater than `1e-6` on every axis.

```ts
export type OrientedRectangle = Readonly<{ center: Point2; width: number; depth: number; rotationDeg: number }>;
export function orientedRectanglesIntersect(a: OrientedRectangle, b: OrientedRectangle, epsilon = 1e-6): boolean;
```

- [ ] **Step 4: Implement asymmetric clearance expansion**

The expanded rectangle shifts its centre according to unequal left/right/front/back margins and grows width/depth accordingly while preserving rotation.

- [ ] **Step 5: Run geometry tests/typecheck and commit**

Run: `pnpm --filter @vlezet/geometry test && pnpm --filter @vlezet/geometry typecheck`  
Expected: PASS.

```bash
git add packages/geometry
git commit -m "feat: add oriented rectangle geometry"
```

---

### Task 3: Fit engine, door swing and directional measurements

**Files:**
- Create: `packages/geometry/src/fit.ts`
- Create: `packages/geometry/src/fit.test.ts`
- Create: `packages/geometry/src/measurements.ts`
- Create: `packages/geometry/src/measurements.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces `FitStatus`, `FitDiagnostic`, `ObjectFitResult`, `evaluateObjectFits`, `doorSwingPolygon`, `measureObjectClearances`.
- Consumes structural document types compatible with schema v3 and existing `deriveRooms`.

- [ ] **Step 1: Write RED tests for hard collisions**

Fixtures must cover:

```ts
expect(evaluateObjectFits(documentWithOverlappingObjects).byObjectId.get("bed")?.status).toBe("blocked");
expect(evaluateObjectFits(documentWithObjectOutsideRoom).byObjectId.get("bed")?.diagnostics)
  .toContainEqual(expect.objectContaining({ code: "outside-room", severity: "collision" }));
expect(evaluateObjectFits(documentWithBlockedDoor).byObjectId.get("wardrobe")?.diagnostics)
  .toContainEqual(expect.objectContaining({ code: "door-obstructed" }));
```

- [ ] **Step 2: Write RED tests for recommendation-only tight placement**

A wardrobe footprint that fits but whose 800 mm front clearance intersects a wall returns `tight`, not `blocked`.

- [ ] **Step 3: Implement room containment and pairwise SAT collisions**

An object belongs to a room only when all four corners are inside/on the usable polygon and no footprint edge crosses the room boundary. If apartment topology prevents authoritative rooms, return a `plan-invalid` engine-level diagnostic and do not claim `fits`.

- [ ] **Step 4: Implement deterministic door swing sectors**

Approximate the 90° sector with 16 equal angular segments. Derive the hinge and direction from existing `Opening.doorSwing` metadata and `openingSegment`.

- [ ] **Step 5: Implement functional clearance recommendations**

Build an asymmetric expanded rectangle, then test the clearance-only ring against other footprints, room boundary and door swing polygons. Do not turn recommendations into collisions.

- [ ] **Step 6: Implement directional clearance rays**

For each local side, cast rays from 25%, 50% and 75% sample points along the outward local normal. Return the minimum positive distance to room boundary, other object footprints and door swing polygons.

```ts
export type DirectionalClearances = Readonly<{ front:number|null; right:number|null; back:number|null; left:number|null }>;
```

- [ ] **Step 7: Verify and commit**

Run: `pnpm --filter @vlezet/geometry test && pnpm --filter @vlezet/geometry typecheck`  
Expected: PASS.

```bash
git add packages/geometry
git commit -m "feat: add deterministic furniture fit engine"
```

---

### Task 4: Object editing operations and semantic history

**Files:**
- Create: `packages/editor-core/src/object-editing.ts`
- Create: `packages/editor-core/src/object-editing.test.ts`
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**
- Produces `addPlacedObject`, `updatePlacedObject`, `movePlacedObject`, `rotatePlacedObject`, `resizePlacedObject`, `duplicatePlacedObject`, `deletePlacedObject`.
- Uses existing `document/replace` command and adds object-specific `EditorCommandLabel` values.

- [ ] **Step 1: Write RED tests for all semantic mutations**

```ts
const added = addPlacedObject(document, object);
expect(added.placedObjects).toEqual([object]);
expect(movePlacedObject(added, object.id, {x:1200,y:900}).placedObjects[0]?.position).toEqual({x:1200,y:900});
expect(rotatePlacedObject(added, object.id, -90).placedObjects[0]?.rotationDeg).toBe(270);
```

Duplicate must create a new stable ID and offset the centre by `{x:200,y:200}` unless an explicit offset is supplied.

- [ ] **Step 2: Verify RED**

Run: `pnpm --filter @vlezet/editor-core test`.

- [ ] **Step 3: Implement immutable mutations with validation**

Every function must throw for missing IDs and must preserve unrelated document arrays by reference where possible.

- [ ] **Step 4: Verify one history entry per operation**

Use `executeCommand` with `document/replace`; undo and redo must restore exact object arrays.

- [ ] **Step 5: Run tests/typecheck and commit**

Run: `pnpm --filter @vlezet/editor-core test && pnpm --filter @vlezet/editor-core typecheck`.

```bash
git add packages/editor-core
git commit -m "feat: add semantic placed object editing"
```

---

### Task 5: Starter catalogue and placement workflow

**Files:**
- Create: `apps/web/components/editor/furniture-presets.ts`
- Create: `apps/web/components/editor/furniture-catalog.tsx`
- Create: `apps/web/components/editor/furniture-catalog.test.ts`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/editor-toolbar.tsx`

**Interfaces:**
- Produces `FURNITURE_PRESETS`, `FurniturePreset`, catalogue panel, `placementPresetId`, `setPlacementPreset`, `placeSelectedPreset`.
- Extends `EditorEntityIdKind` with `placed-object`.

- [ ] **Step 1: Write RED tests for catalogue snapshots**

Catalogue tests verify unique IDs, positive dimensions, non-negative clearances and the exact required preset set.

- [ ] **Step 2: Write RED store test for placement**

```ts
store.getState().setPlacementPreset("double-bed");
store.getState().placeSelectedPreset({x:2000,y:1500});
expect(store.getState().history.document.placedObjects[0]).toMatchObject({
  presetId:"double-bed", name:"Двуспальная кровать", width:1600, depth:2000, position:{x:2000,y:1500}
});
expect(store.getState().history.past).toHaveLength(1);
```

- [ ] **Step 3: Implement complete preset catalogue**

Use the dimensions and clearances frozen in the M2 spec. The custom preset creates a normal 1000×600 custom object that is immediately editable.

- [ ] **Step 4: Implement mutually exclusive placement/selection state**

Selecting a preset clears wall/room/opening/object selection. Placing an object selects it and returns to `select` tool.

- [ ] **Step 5: Add left catalogue panel**

The panel renders grouped compact buttons with name and `width × depth мм`. Clicking a card activates placement mode and visibly marks the selected preset.

- [ ] **Step 6: Run web unit tests/typecheck and commit**

Run: `pnpm --filter @vlezet/web test && pnpm --filter @vlezet/web typecheck`.

```bash
git add apps/web
git commit -m "feat: add furniture catalogue and placement state"
```

---

### Task 6: Canvas object rendering, drag, rotate and snapping

**Files:**
- Create: `apps/web/components/editor/placed-object-shape.tsx`
- Create: `apps/web/components/editor/object-snapping.ts`
- Create: `apps/web/components/editor/object-snapping.test.ts`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify: `apps/web/components/editor/use-editor-store.test.ts`

**Interfaces:**
- Produces placement preview, object canvas shapes, `objectGesture`, `beginObjectGesture`, `previewObjectGesture`, `commitObjectGesture`, `cancelObjectGesture`, alignment guides.

- [ ] **Step 1: Write RED snapping tests**

Priority fixtures must prove edge alignment beats centre alignment, centre beats grid, and guides identify the winning world axis.

- [ ] **Step 2: Implement quiet semantic object rendering**

Render a rotated `Group` with a footprint rectangle, short name and simple category-specific interior marks. Use real footprint dimensions scaled by viewport. Do not use images or photorealistic assets.

- [ ] **Step 3: Implement placement preview**

Pointer movement while a preset is active renders a semi-transparent object using the same fit evaluation as persisted objects. Click commits placement.

- [ ] **Step 4: Implement drag gesture**

During drag, update only ephemeral gesture preview. On drag end, commit one `object/move` history entry. Escape restores original transform.

- [ ] **Step 5: Implement selection transformer and rotation**

Attach a Konva `Transformer` only to the selected object. Rotation snaps to 15° increments; width/depth scale is converted back to millimetres and node scale is reset to 1 before committing.

- [ ] **Step 6: Verify tests/typecheck/lint and commit**

Run: `pnpm --filter @vlezet/web test && pnpm --filter @vlezet/web typecheck && pnpm --filter @vlezet/web lint`.

```bash
git add apps/web
git commit -m "feat: add interactive furniture transforms"
```

---

### Task 7: Object inspector, shortcuts and fit feedback

**Files:**
- Create: `apps/web/components/editor/object-inspector.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/keyboard.ts`
- Modify: `apps/web/components/editor/keyboard.test.ts`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Object inspector consumes selected object plus `evaluateObjectFits` and `measureObjectClearances`.
- Adds shortcuts `F`, `R`, `Ctrl/Cmd+D`, Delete/Backspace.

- [ ] **Step 1: Write RED shortcut tests**

```ts
expect(getEditorShortcut(event("r"))).toBe("rotate-object");
expect(getEditorShortcut(event("d", {ctrlKey:true}))).toBe("duplicate-object");
expect(getEditorShortcut(event("Delete"))).toBe("delete-selection");
```

Plain `D` must remain door tool; command-modified `D` duplicates.

- [ ] **Step 2: Implement exact object inspector**

Inspector fields: name, X, Y, width, depth, optional height, rotation, four clearance margins. Apply uses one `object/update` command. Add duplicate and delete actions.

- [ ] **Step 3: Implement fit badge and reason list**

Show `Влезает`, `Влезает вплотную`, or `Не влезает`, followed by deterministic diagnostics. Do not rely only on colour.

- [ ] **Step 4: Render clearance zones and measurements**

For the selected object, render translucent dashed clearance geometry, width/depth labels and four directional gap labels. Hard collision outlines are red; recommendation-only is amber; valid selection is blue/green.

- [ ] **Step 5: Implement shortcuts and safe editable-target behaviour**

Escape cancels placement/gesture first. Delete never acts while an input is focused. Rotation and duplication use semantic store actions.

- [ ] **Step 6: Run web checks and commit**

Run: `pnpm --filter @vlezet/web test && pnpm --filter @vlezet/web typecheck && pnpm --filter @vlezet/web lint`.

```bash
git add apps/web
git commit -m "feat: add furniture inspector and fit feedback"
```

---

### Task 8: Acceptance documentation and final quality gate

**Files:**
- Create: `docs/milestones/m2-acceptance.md`
- Modify: `README.md`

**Interfaces:**
- Documents exact local browser scenarios and updates roadmap status.

- [ ] **Step 1: Write browser acceptance checklist**

Checklist must include furnishing a room, blocked/tight/fits transitions, custom object, drag, rotation, resize, duplicate, delete, snapping, measurements and undo/redo.

- [ ] **Step 2: Run complete clean verification**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all commands PASS with no disabled checks.

- [ ] **Step 3: Review final diff against the M2 spec**

Confirm schema v3, all starter presets, transform semantics, collision/recommendation distinction, explainable messages, no persistence/3D/marketplace scope creep.

- [ ] **Step 4: Commit and open Draft PR**

```bash
git add README.md docs/milestones/m2-acceptance.md
git commit -m "docs: add M2 furnishing acceptance"
git push -u origin feat/m2-furnishing-fit
```

Open a Draft PR titled `feat: M2 furnishing and fit` and keep it Draft until manual browser acceptance.

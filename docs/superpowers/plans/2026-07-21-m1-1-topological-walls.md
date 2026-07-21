# M1.1 — Topological Walls Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace M0's independent wall segments with schema-v2 explicit vertices, stable semantic wall runs, T-junctions, topology diagnostics, real wall thickness rendering, and connected-wall editing without breaking undo/redo.

**Architecture:** Persistent topology lives in `@vlezet/domain`: vertices are explicit identities and walls reference endpoint vertex IDs while retaining optional internal junction IDs. `@vlezet/geometry` derives atomic edges and diagnostics from persistent topology. `@vlezet/editor-core` owns semantic mutations and history; the web editor only translates pointer intent into commands and renders the resulting model.

**Tech Stack:** TypeScript 6.0.3, React 19, Next.js 16, Konva/react-konva, Zustand, Vitest, pnpm workspace.

## Global Constraints

- Millimetres remain the canonical world unit.
- Canvas pixels never become persistent apartment geometry.
- Shared connectivity is explicit vertex identity, never coincident-screen inference.
- A semantic wall run keeps one stable wall ID even when T-junctions derive multiple atomic edges.
- Undeclared X-crossings are diagnostics, not implicit connectivity.
- M1.1 does not implement room polygons, room area, doors, windows, furniture, 3D, or AI.
- Every user gesture that changes topology is one undoable semantic command.
- Existing M0 schema-v1 documents must migrate deterministically to schema v2.

---

## File map

```text
packages/domain/src/
  document.ts             # v1/v2 schema + migration
  vertex.ts               # vertex model/helpers
  wall.ts                 # semantic wall-run model/helpers
  document.test.ts
  migration.test.ts

packages/geometry/src/
  topology.ts             # vertex lookup, wall points, atomic edges
  topology.test.ts
  diagnostics.ts          # topology validation and crossings
  diagnostics.test.ts
  segment.ts              # reusable point-on-segment/intersection math

packages/editor-core/src/
  commands.ts             # document replacement semantic command
  topology-editing.ts     # connected wall/T-junction/wall resize operations
  topology-editing.test.ts
  history.test.ts

apps/web/components/editor/
  use-editor-store.ts
  use-editor-store.test.ts
  editor-canvas.tsx
  wall-inspector.tsx
  apartment-editor.tsx
```

---

### Task 1: Introduce schema v2 and deterministic v1 migration

**Files:**
- Create: `packages/domain/src/vertex.ts`
- Modify: `packages/domain/src/wall.ts`
- Modify: `packages/domain/src/document.ts`
- Modify: `packages/domain/src/index.ts`
- Modify/Test: `packages/domain/src/document.test.ts`
- Create/Test: `packages/domain/src/migration.test.ts`

**Interfaces:**
- Produces `Vertex`, `Wall`, `VlezetDocumentV1`, `VlezetDocumentV2`, `VlezetDocument`.
- Produces `createEmptyDocument(): VlezetDocumentV2`.
- Produces `migrateDocument(input: VlezetDocumentV1 | VlezetDocumentV2): VlezetDocumentV2`.
- Produces `getVertex(document, id)` and `getWallEndpoints(document, wall)`.

- [ ] **Step 1: Write failing migration tests**

Cover:

```ts
const v1 = {
  schemaVersion: 1,
  walls: [
    { id: "a", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200 },
    { id: "b", start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 200 },
  ],
} as const;

const migrated = migrateDocument(v1);
expect(migrated.schemaVersion).toBe(2);
expect(migrated.vertices).toHaveLength(3);
expect(migrated.walls[0]?.endVertexId).toBe(migrated.walls[1]?.startVertexId);
```

Also assert exact coordinates are preserved and v2 input is returned structurally unchanged.

- [ ] **Step 2: Run RED**

Run:

```bash
pnpm --filter @vlezet/domain test
```

Expected: FAIL because schema-v2 APIs do not exist.

- [ ] **Step 3: Implement schema v2 and migration**

Use semantic shapes:

```ts
type Vertex = Readonly<{ id: string; position: Point2 }>;

type Wall = Readonly<{
  id: string;
  startVertexId: string;
  endVertexId: string;
  junctionVertexIds: readonly string[];
  thickness: Millimeters;
}>;

type VlezetDocumentV2 = Readonly<{
  schemaVersion: 2;
  vertices: readonly Vertex[];
  walls: readonly Wall[];
  openings: readonly [];
  roomAnnotations: readonly [];
}>;
```

Migration merges only exactly equal serialized endpoint coordinates. Generate deterministic migration vertex IDs from first-seen coordinate order (`v1-vertex-0`, `v1-vertex-1`, ...).

- [ ] **Step 4: Run GREEN and typecheck**

```bash
pnpm --filter @vlezet/domain test
pnpm typecheck
```

Expected: PASS.

---

### Task 2: Derive atomic wall edges and topology diagnostics

**Files:**
- Create: `packages/geometry/src/segment.ts`
- Create: `packages/geometry/src/topology.ts`
- Create: `packages/geometry/src/topology.test.ts`
- Create: `packages/geometry/src/diagnostics.ts`
- Create: `packages/geometry/src/diagnostics.test.ts`
- Modify: `packages/geometry/src/index.ts`

**Interfaces:**
- Produces `deriveAtomicWallEdges(document): AtomicWallEdge[]`.
- Produces `validateTopology(document): TopologyDiagnostic[]`.
- Produces `projectPointToSegment`, `pointOnSegment`, and proper segment-intersection helpers.

`AtomicWallEdge`:

```ts
type AtomicWallEdge = Readonly<{
  wallId: string;
  startVertexId: string;
  endVertexId: string;
  start: Point2;
  end: Point2;
  thickness: number;
  startOffset: number;
  endOffset: number;
}>;
```

- [ ] **Step 1: Write failing atomic-edge tests**

A wall `A -> B` with junction `J` must derive ordered edges `A -> J`, `J -> B` independent of `junctionVertexIds` storage order.

- [ ] **Step 2: Write failing diagnostics tests**

Cover missing references, off-wall junctions, zero-length edges and undeclared X-crossings.

- [ ] **Step 3: Run RED**

```bash
pnpm --filter @vlezet/geometry test
```

Expected: FAIL.

- [ ] **Step 4: Implement deterministic topology derivation**

Sort internal junctions by scalar projection along the wall's start-to-end vector. Reject duplicate/degenerate consecutive atomic points through diagnostics instead of silently modifying persistent topology.

- [ ] **Step 5: Implement crossing diagnostics**

A proper interior/interior segment crossing is an error unless the intersection is represented by a shared endpoint/junction vertex in both participating wall runs.

- [ ] **Step 6: Run GREEN**

```bash
pnpm --filter @vlezet/geometry test
pnpm typecheck
```

Expected: PASS.

---

### Task 3: Replace wall-copy commands with semantic document transitions

**Files:**
- Modify: `packages/editor-core/src/commands.ts`
- Modify: `packages/editor-core/src/history.ts`
- Modify/Test: `packages/editor-core/src/history.test.ts`
- Create: `packages/editor-core/src/topology-editing.ts`
- Create/Test: `packages/editor-core/src/topology-editing.test.ts`
- Modify: `packages/editor-core/src/index.ts`

**Interfaces:**
- Produces a semantic command that stores `before` and `after` v2 documents for one completed operation.
- Produces `addConnectedWall`, `addTJunctionWall`, `setTopologicalWallLength`, `setWallThickness`.

Core editing result:

```ts
type DocumentEdit = Readonly<{
  document: VlezetDocumentV2;
  selectedWallId?: string;
  continuationVertexId?: string;
}>;
```

- [ ] **Step 1: Write failing connected-wall tests**

Verify creating a wall from an existing vertex reuses the same vertex ID and creates only one new endpoint vertex.

- [ ] **Step 2: Write failing T-junction tests**

Verify endpoint-to-wall-interior creates one junction vertex, registers it on host wall, and uses it as the joining wall endpoint. Undo must restore the exact prior document in one history step.

- [ ] **Step 3: Write failing exact-length tests**

Changing wall length moves the end vertex and therefore every wall that references that shared end vertex. Reject shortening past an internal junction.

- [ ] **Step 4: Implement semantic operations**

All operations return new immutable v2 documents. Validate IDs and positive dimensions before mutation.

- [ ] **Step 5: Run GREEN**

```bash
pnpm --filter @vlezet/editor-core test
pnpm typecheck
```

Expected: PASS.

---

### Task 4: Upgrade editor store to explicit topology

**Files:**
- Modify: `apps/web/components/editor/use-editor-store.ts`
- Modify/Test: `apps/web/components/editor/use-editor-store.test.ts`

**Interfaces:**
- Draft wall stores world start/end and optional snap target identity.
- Store exposes semantic `commitDraftWall()` that chooses among new-chain wall, existing-vertex connection, or T-junction creation.
- Selection remains wall-oriented for M1.1.

- [ ] **Step 1: Write failing store tests**

Cover:
- first wall creates two vertices;
- chained wall reuses continuation vertex;
- closing to existing start vertex reuses identity;
- T-junction commit creates one history entry;
- undo/redo restores exact topology.

- [ ] **Step 2: Run RED**

```bash
pnpm --filter web test -- use-editor-store
```

Expected: FAIL.

- [ ] **Step 3: Implement minimal topology-aware store**

Keep ID generation injectable in tests. Do not infer topology from coincident coordinates after commit; identity decisions happen at snap/commit time.

- [ ] **Step 4: Run GREEN**

```bash
pnpm --filter web test
```

Expected: PASS.

---

### Task 5: Render physical wall thickness and topology-aware snapping

**Files:**
- Modify: `apps/web/components/editor/editor-canvas.tsx`
- Modify: `apps/web/components/editor/wall-inspector.tsx`
- Modify: `apps/web/components/editor/apartment-editor.tsx`
- Modify: `apps/web/app/globals.css`

**Interfaces:**
- Canvas resolves wall endpoint coordinates through vertices.
- Existing vertices are visible snap targets while drawing.
- Wall interior projection can become a T-junction preview.
- Wall body stroke width is `wall.thickness * pixelsPerMillimeter` with sensible screen minimum only for edit overlays, not persisted geometry.

- [ ] **Step 1: Update rendering to resolve wall runs through vertices**

Render semantic walls from resolved start/end vertices and show endpoint/junction handles only as editing overlays.

- [ ] **Step 2: Add topology-aware snap intent**

Visual hierarchy while drawing:

```text
existing vertex > wall interior (T-junction) > axis > grid
```

Show a distinct target marker for vertex/T-junction before click.

- [ ] **Step 3: Upgrade inspector**

Wall inspector shows exact length, editable thickness, and a homeowner-friendly connection summary (for example `Соединений: 2`) without exposing graph jargon.

- [ ] **Step 4: Verify manually through build**

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: all exit 0.

---

### Task 6: Acceptance and CI gate

**Files:**
- Create: `docs/milestones/m1-1-acceptance.md`
- Modify documentation only if behavior differs from the approved M1 spec.

- [ ] **Step 1: Document acceptance journeys**

Required journeys:

1. draw four chained walls and close to the starting vertex;
2. select a shared corner and confirm walls remain connected after exact-length edits;
3. attach a partition to a wall interior and see an explicit T-junction;
4. undo/redo the partition as one operation;
5. change wall thickness and see physical rendering update;
6. create an undeclared X-crossing and see a diagnostic instead of implicit connectivity.

- [ ] **Step 2: Run final verification**

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

Expected: every command exits 0.

- [ ] **Step 3: Open/update draft PR**

PR title:

```text
feat: M1.1 topological walls
```

Do not merge until CI is green and browser acceptance is complete.

---

## Plan self-review

- Spec coverage: schema v2/migration, explicit vertices, stable wall runs, T-junctions, atomic edges, diagnostics, wall thickness, connected-wall UX and undo/redo are covered.
- Deferred correctly to M1.2/M1.3: room faces/areas and openings.
- No proximity-based hidden topology is introduced during migration.
- Persistent wall IDs survive T-junction subdivision because atomic edges are derived only.
- All topology-changing gestures are modeled as one semantic history transition.

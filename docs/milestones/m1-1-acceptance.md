# M1.1 — Topological Walls Acceptance

M1.1 is the topology foundation for rooms and openings. The editor must behave like a home-planning tool, not a loose line sketcher.

## Automated gate

The following must all pass on the same commit:

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Browser acceptance

### 1. Connected wall chain

1. Select **Стена**.
2. Draw three consecutive walls.
3. Observe that the next draft starts from the exact previous endpoint.

Expected:
- shared corners are single topology vertices;
- no duplicate endpoint is created at a shared corner;
- undo removes one completed wall gesture at a time.

### 2. Close a contour

1. Draw a final wall back to the first visible vertex.
2. Hover the first vertex before clicking.

Expected:
- the existing vertex is visibly targeted;
- the closing wall reuses that vertex identity;
- the contour stays connected under later edits.

### 3. T-junction

1. Draw a long host wall.
2. Start another wall away from it.
3. Finish on the interior of the host wall.

Expected:
- the interior wall snap is visually distinct from an endpoint snap;
- one explicit junction vertex is created;
- the host remains one selectable semantic wall;
- undo removes the joining wall and its junction membership in one step.

### 4. Exact length on connected geometry

1. Select a wall that shares an endpoint with another wall.
2. Change its exact length.

Expected:
- the wall start remains anchored;
- its end vertex moves along the wall direction;
- every wall sharing that end vertex remains connected;
- shortening past an internal T-junction is rejected with a clear message.

### 5. Physical wall thickness

1. Select a wall.
2. Change thickness from 150 mm to 240 mm.

Expected:
- visible wall thickness changes immediately and to scale;
- centre-line topology and connected vertices do not move;
- invalid thickness values are rejected.

### 6. Invalid crossing

1. Create two walls that cross without snapping/declaring a shared topology vertex.

Expected:
- the crossing is visibly flagged;
- the editor does not silently invent a connection;
- later room detection must treat affected topology as invalid.

## Exit criterion

M1.1 is accepted when a user can confidently draw and edit a connected apartment wall graph with T-junctions while topology remains deterministic through undo/redo and exact-dimension changes.

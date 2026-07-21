# M1.3 — Doors and Windows Acceptance

## Automated gate

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Browser journeys

### Door
1. Select **Дверь (D)**.
2. Hover a wall and confirm the 900 mm preview follows the wall and clamps at the ends.
3. Click a valid location.
4. Confirm the wall has a true visual gap, door leaf, and swing arc.
5. Select the door and edit width, offset, hinge and swing side.

### Window
1. Select **Окно (O)**.
2. Place the default 1200 mm window on a wall.
3. Confirm a true wall gap and clear window symbol.
4. Edit width/offset in the inspector.

### Validation
- overlapping openings are rejected;
- out-of-bounds openings are rejected;
- an opening may not straddle an internal T-junction;
- invalid preview is red and cannot be committed;
- adding a T-junction elsewhere on the semantic host wall does not re-host or drift an existing opening.

### History
- add, update and delete opening operations each undo/redo as one semantic action.

## Full M1 benchmark

A user can now build an apartment shell with:
- connected external/internal walls;
- explicit T-junctions;
- physical wall thickness;
- automatically derived rooms;
- usable interior areas;
- room names;
- doors with swing;
- windows;
- deterministic validation and undo/redo.

## Exit criterion

M1 is accepted when this shell is trustworthy enough to become the geometric base for M2 furniture placement, measurements, collisions and clearance planning.

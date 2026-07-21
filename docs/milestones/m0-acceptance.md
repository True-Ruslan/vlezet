# M0 — Foundation and Infinite Canvas acceptance

M0 proves the first complete editing slice without auth, persistence infrastructure, room detection, furniture, 3D, or AI.

## Automated verification

```bash
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

All commands must exit successfully on a clean checkout.

## Manual acceptance

1. The editor fills the available desktop workspace.
2. Mouse-wheel zoom preserves the world point under the cursor.
3. `Space + drag` and middle-mouse drag pan without modifying apartment geometry.
4. Grid spacing adapts to zoom level.
5. `W` activates wall drawing; the first click starts a wall and the next click commits it.
6. Committed wall endpoints can be reused as snapping targets.
7. Horizontal/vertical assistance activates near the current wall start axis.
8. Grid snapping remains deterministic when no stronger candidate wins.
9. A selected wall exposes exact length in millimetres and metres.
10. Changing exact wall length keeps its start point fixed and preserves direction.
11. Undo/redo operates on one semantic wall action at a time.
12. `Esc` cancels an active wall chain and returns to selection.
13. Persistent wall coordinates and thickness are millimetres; viewport pixels remain ephemeral.

## M0 non-goals

- project/account persistence;
- doors and windows;
- room topology and area;
- furniture and appliances;
- import from image/PDF;
- 3D;
- AI assistance;
- mobile editing.

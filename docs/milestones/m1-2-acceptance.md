# M1.2 — Rooms and Usable Area Acceptance

## Automated gate

```bash
pnpm install --frozen-lockfile
pnpm test
pnpm typecheck
pnpm lint
pnpm build
```

## Browser journeys

1. Draw a closed rectangle. A room fill, generated name, and usable area must appear automatically.
2. Add a valid partition between opposite host walls. Two independent rooms must appear.
3. Change wall thickness. Room inner polygon and area must update immediately.
4. Select a room and rename it. Undo/redo must remove/restore the name without storing room polygon data.
5. Create an undeclared crossing. Authoritative room derivation must stop and show a geometry diagnostic.
6. Reopen ordinary topology edits mentally/through undo-redo: room identity remains deterministic from boundary vertex identities and annotation anchors remain attached when still inside the room.

## Accuracy benchmark

A centre-line rectangle 4000 × 3000 mm with 200 mm walls must produce a usable inner rectangle 3800 × 2800 mm = **10.64 m²**.

## Exit criterion

M1.2 is accepted when users can trust the displayed area as the physical space inside wall faces rather than a sketch-derived approximation.

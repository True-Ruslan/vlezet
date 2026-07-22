# M4.6.5 Tape Measurement Implementation Plan

**Goal:** Let users independently verify arbitrary distances on the apartment plan without creating or persisting geometry.

**Architecture:** Measurement is ephemeral editor state only. Canonical math lives in `@vlezet/geometry`; the web editor owns interaction and rendering. Two clicks define a measurement, pointer movement previews the second point, existing vertex/wall/grid snapping is reused, Escape clears it, and no measurement enters `VlezetDocument`, autosave, backup, or semantic Undo/Redo.

### Task 1 — Framework-independent measurement math
- Add `measureBetweenPoints(start,end)` returning direct distance, horizontal delta, vertical delta.
- Use absolute horizontal/vertical deltas for user-facing verification.
- TDD 3-4-5 triangle => 5000 direct, 3000 horizontal, 4000 vertical.

### Task 2 — Editor tool contract
- Extend `EditorTool` with `measure`.
- Add toolbar button `Измерить` with shortcut hint `M`.
- Measurement does not create history entries or mutate document.

### Task 3 — Canvas interaction and overlay
- First click sets start.
- Pointer movement previews snapped end.
- Second click commits end.
- A click after completion starts a new measurement.
- Reuse current vertex/wall/grid snapping without angle-constraining the measured endpoint.
- Escape clears measurement; leaving the measure tool clears it.
- Overlay displays:
  - direct distance prominently;
  - `ΔX` and `ΔY` beneath;
  - endpoint markers and dashed guide projections;
  - constant screen-readable labels across zoom.
- Render in the existing annotation layer; do not increase physical Konva Layer count.

### Task 4 — Verification and docs
- Full frozen install/tests/typecheck/lint/build.
- Browser acceptance on real plan: corner→door, wall→window, diagonal arbitrary measure, snapping, Escape, zoom/pan, tool switching.
- Update `PROJECT_STATE.md`, `ROADMAP.md`, `CHANGELOG.md`, and PR #7 with exact-head CI evidence.

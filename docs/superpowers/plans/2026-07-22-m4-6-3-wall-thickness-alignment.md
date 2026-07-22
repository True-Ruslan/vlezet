# M4.6.3 Wall Thickness Alignment Implementation Plan

**Goal:** Make wall-thickness edits predictable by explicitly controlling which physical face stays fixed instead of always growing thickness invisibly around the centreline.

**Architecture:** `VlezetDocument` still stores only centreline + thickness. Core editing accepts `center | left-face | right-face`; face-fixed edits translate the target centreline by half the thickness delta and update compatible connected topology atomically. UI maps those geometric anchors to `Внутрь / По центру / Наружу` only when exactly one adjacent room makes inside/outside unambiguous; otherwise it requires explicit left/right face selection.

### Task 1 — Core face-fixed thickness edit
- Add `WallThicknessAlignment = "center" | "left-face" | "right-face"`.
- TDD: standalone horizontal wall proves fixed-face math.
- TDD: orthogonal connected wall/junction remains topologically connected; openings on a connected wall preserve world position when its start moves along its tangent.
- TDD: incompatible diagonal connection rejects atomically rather than skewing topology.
- Preserve legacy `setWallThickness(document,id,value)` as centre-fixed default.

### Task 2 — Deterministic room-side derivation
- Add framework-independent geometry helper that derives whether exactly one bounded room lies on semantic wall `left` or `right` side.
- TDD rectangle boundary wall => one side; partition => ambiguous/two-sided => null.
- Never infer structural/removability meaning.

### Task 3 — Store and inspector UX
- Extend store thickness command with optional alignment; keep one semantic history entry.
- Boundary wall with one adjacent room: show `Внутрь помещения | По центру | Наружу` and map to correct fixed face.
- Ambiguous partition/no-room wall: show explicit `Левая грань | По центру | Правая грань` with explanation instead of guessing inside/outside.
- Keep exact value and error handling.

### Task 4 — Verification
- Full frozen install/tests/typecheck/lint/build.
- Browser acceptance: change 100→200 mm in all three modes and verify expected fixed face/area behavior, Undo/Redo, openings, and connected corners.
- Update PROJECT_STATE/ROADMAP/CHANGELOG/PR #7 with exact-head evidence.

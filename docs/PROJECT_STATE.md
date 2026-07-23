# Vlezet — Project State

**Last updated:** 2026-07-23  
**Status:** M0–M6.2 are merged and accepted in `main`. M6.2 added deterministic, explainable user constraints on top of M6.1 planning without creating a second layout authority. The next implementation slice is **M6.3 Exact Spatial Constraints**. M5.3 remains evidence-driven camera/navigation/performance polish only.

> **Read this file first in a new chat.** It is the canonical short-form answer to what Vlezet is, what is stable, what remains intentionally limited and what should happen next.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners/buyers.

Core promise:

> Draw or import a real apartment, work with understandable real dimensions, place furniture/appliances and understand what fits, what collides and how much usable space remains — without learning professional CAD.

Product priorities:

- precision before decoration;
- structured editable geometry rather than image-only plans;
- millimetres as the canonical world unit;
- local-first core editing;
- understandable geometry semantics for ordinary users;
- AI/CV only as editable assistance;
- 3D as a projection of the same trusted document, never a second geometry source;
- planning as deterministic, explainable assistance with explicit Apply.

## 2. Non-negotiable architecture rules

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas/WebGL pixels are never persisted as apartment geometry.
4. `domain`, `geometry`, `editor-core`, recognition, `spatial` and `planning` remain framework-independent where applicable.
5. Konva/Canvas/Three.js are projections of the domain model, never the source of truth.
6. Rooms/areas are derived from structured geometry.
7. Project formats are schema-versioned and migrated deterministically.
8. Undo/Redo is semantic-command oriented.
9. Local editing must not depend on network latency.
10. AI/CV may create only editable suggestions; deterministic validation remains authoritative.
11. Existing user geometry must never be silently replaced by recognition/AI.
12. Optional subsystems must never block core project startup.
13. Product simplicity must not hide ambiguous geometry semantics.
14. Derived dimensions/annotations/floors/3D meshes never become a second persisted geometry source.
15. Ambiguous geometry semantics must fail closed or require explicit user intent instead of guessing.
16. 3D projects the same `VlezetDocument`; it does not introduce a parallel editor state.
17. Three.js mesh collision is never product authority for fit/clearance decisions.
18. 3D hover/select/inspection state is ephemeral and never mutates document/history/autosave.
19. Planning candidates, constraints and preview state are ephemeral structured suggestions; only explicit Apply may mutate ordinary `VlezetDocument` entities.
20. Planning validation/ranking must reuse deterministic geometry/fit authority; AI/LLM output can never bypass it.
21. Hard planning constraints must fail closed before scoring; soft preferences may only influence deterministic ranking.
22. The same constraint validator must protect request-generation and candidate/Apply boundaries.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`.

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent apartment model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editor operations/history/snapping
packages/projects        local-first project/persistence abstraction
packages/recognition     assisted-recognition model/CV/reconciliation
packages/spatial         renderer-neutral deterministic 3D projection
packages/planning        framework-independent deterministic planning
```

Rendering:

- 2D: Konva / react-konva;
- 3D: plain Three.js over neutral `SpatialScene`.

State: Zustand.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.

The repository was made public on 2026-07-22, restoring standard GitHub-hosted Actions after private-repository included minutes were exhausted.

## 4. Stable milestones in `main`

### M0 — Foundation and Infinite Canvas

PR #1 → `099a202413459674d2b50c33d2c1fa125a0fef6f`.

Delivered monorepo/package boundaries, infinite canvas, mm world coordinates, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

### M1 — Apartment Shell

PR #2 → `3944c7f9d668a645e1dc05805f476d2f3290eb94`.

Delivered topological walls/vertices, T-junctions, physical wall thickness, deterministic rooms/usable area, room names, host-wall openings and geometry diagnostics.

### M2 — Furnishing and Fit

PR #3 → `aa34f24572f2e67714604634587a1c41e4067cd8`.

Delivered furniture/appliance objects, exact dimensions/transforms, snapping/guides, collision/containment/door-swing/clearance evaluation and explainable fit statuses.

### M3 — Local-First Projects

PR #4 → `6c32249acc8e333e62fceee2ea4e76ca83890c77`.

Delivered dashboard/project lifecycle, IndexedDB persistence, autosave/retry, viewport restore, backup/import and PNG export.

### M4 — Reference Plan Import

PR #5 → `12e9696e11572ad5ec055f3dfad98ad7826184e2`.

Delivered local JPG/PNG/PDF import, safe validation/rasterization, calibration, alignment, local reference asset persistence, tracing, reference-aware fitting, portable backup and PNG export options.

### M4.5 — Assisted Recognition

PR #6 → `b63bdd613db4e13c07d2a961981799bd360f256d`.

**Product status:** accepted assisted/experimental MVP.

Delivered local OpenCV/Web Worker recognition, persistent `RecognitionDraft`, review/edit/accept/reject, deterministic image→mm apply, duplicate/conflict protection, one-batch Undo/Redo, stale handling and optional OpenRouter BYOK refinement.

Known limitation intentionally deferred: recognition remains noisy/inaccurate on some real plans. Future refinement requires representative fixtures and measurable metrics.

### M4.6 — Precision Geometry UX

PR #7 → `a718bf605d8b3bde8dc87953c340b7b0e9565fdb`.

Accepted after strict CI and real browser verification.

Delivered explicit centreline wall-length semantics, resize anchors, clear internal rectangular room dimensions, usable-area consistency, deterministic area rounding, wall-thickness fixed-face/alignment semantics, dimension lines, `Размеры` toggle and ephemeral `Измерить`/`M` tape tool.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

### M5.1 — Deterministic Spatial 3D Shell

PR #8 → squash merge `4acca82b04c87b3737eb87a03f9ee2ff360b5073`.

Delivered framework-independent spatial projection, deterministic wall prisms/thickness, opening-aware wall segmentation, usable room floors, schematic semantic opening markers, fail-closed diagnostics, orbit/pan/zoom, Perspective/Isometric/Top/Fit, safe 2D↔3D switching, WebGL isolation and explicit GPU-resource cleanup.

Real-browser acceptance PASS.

### M5.2 — Furniture in 3D

PR #9 → squash merge `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a`.

Delivered `SpatialScene.objects`, exact projection of existing placed objects, X/Y→X/Z mapping, deterministic rotation, stored/default projection height semantics, semantic metadata, generic Three.js primitives, fail-closed invalid-object projection and explicit resource disposal.

No second 3D furniture state and no mesh-collision authority.

### M5.4 — Spatial Inspection

PR #10 → squash merge `0bffe36d74d2ff0865d700b51b17ee08e7001094`.

**Product status:** DONE / ACCEPTED.

Delivered semantic 3D hover/select for room/wall/object, read-only authoritative inspector, canonical room area/clear dimensions, wall facts, M2 object fit status/reasons, semantic highlight across split wall segments, opening-placeholder skip logic and deterministic highlight-resource cleanup.

Final accepted PR head:

```text
e9980f63d574d1a9cb6614980788270a50cde47e
GitHub Actions 29948749864 — PASS
```

Browser acceptance: **«Все работает круто как ты и описал.»**

Checklist: `docs/milestones/m5-4-acceptance.md`.

### M6.1 — Deterministic Layout Alternatives

PR #11 → squash merge `f2bbf1c4989ef4582ee86aba19c75a71679034be`.

**Product status:** DONE / ACCEPTED.

Delivered:

- framework-independent `@vlezet/planning`;
- one supported deterministic axis-aligned rectangular room;
- 1–3 selected existing objects;
- non-selected furniture as fixed ordinary obstacles;
- deterministic footprint-aware candidate anchors/orientations;
- bounded search (`MAX_PLANNING_EVALUATIONS = 6000`);
- M2-authoritative fit validation;
- deterministic ranking/reasons;
- maximum three displayed alternatives;
- non-mutating 2D ghost preview;
- explicit revalidated Apply;
- canonical rotation persistence;
- one multi-object Apply = one semantic Undo/Redo operation.

Final accepted PR head:

```text
acaa352545245ff079f55fb8ce85ba2a23f2312d
GitHub Actions 29953127208 — PASS
```

Browser acceptance: **«Все работает строго по сценарию.»**

Checklist: `docs/milestones/m6-1-acceptance.md`.

### M6.2 — Constraint-Aware Planning

PR #13 → squash merge `db68d697540ddb9901fbddad0763d769e7d16851`.

**Product status:** DONE / ACCEPTED after TDD, exact-head strict CI and representative real-browser acceptance.

Delivered structured user intent on top of M6.1:

- hard `lock-object` → UI `Не двигать`;
- soft `prefer-room-boundary` → `Ближе к стене` / `Ближе к углу`;
- soft `pair-distance` → `Ближе друг к другу` / `Дальше друг от друга`;
- centre-to-centre pair semantics explicitly exposed in millimetres;
- shared fail-closed `validatePlanningConstraintSet()` at request and candidate/Apply boundaries;
- stable constraint normalization and intent-sensitive candidate identity;
- hard constraints reject before scoring;
- deterministic soft preference penalties normalized by room diagonal;
- ranking preserves M2 fit/recommendation quality ahead of user soft preferences;
- changing constraint state clears stale result/preview;
- result cards expose deterministic measured evidence;
- preview remains ephemeral/non-mutating;
- Apply remains explicit, current-document-revalidated and atomic for Undo/Redo;
- no LLM/API dependency or second persisted planning state.

Final accepted PR head before merge:

```text
a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
GitHub Actions 29962203961 — PASS
```

Representative browser acceptance PASS. Product owner explicitly confirmed:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

Checklist: `docs/milestones/m6-2-acceptance.md`.

## 5. Current known limitations / technical debt

### Recognition

- M4.5 remains assisted/experimental, not authoritative reconstruction;
- quality varies by plan style/model;
- future work needs representative fixtures and measurable metrics.

### Precision geometry

Not yet generalized:

- editable clear dimensions beyond simple deterministic axis-aligned rectangles;
- arbitrary parametric constraints/locked dimensions;
- target-area solver;
- permanent associative CAD-like dimensions;
- advanced opening offsets/reference corners;
- structural/removability classification without authoritative data.

### Planning

Current intentional limits:

- planning scope is one deterministic rectangular room;
- only 1–3 existing selected objects are rearranged;
- current user-intent vocabulary is lock, wall/corner preference and pair near/far;
- no exact user-defined millimetre spacing constraints yet;
- no whole-apartment orchestration;
- no natural-language planning interpretation yet;
- no opaque AI scoring or free-form geometry generation;
- constraints themselves are intentionally ephemeral and are not a second persistent layout model.

### Spatial 3D

Current intentional limits:

- shell and furniture remain visually schematic;
- door/window vertical details are not authoritative because the document does not store those semantics;
- furniture uses generic primitives rather than decorative 3D assets;
- no direct 3D geometry/furniture editing;
- no photorealism/material pipeline;
- spatial inspection is read-only;
- camera persistence/accessibility/unusual-plan framing remain evidence-driven polish;
- advanced batching/LOD must be evidence-driven.

### Product/infrastructure deferred

- accounts/auth;
- cloud sync/sharing/collaboration;
- managed AI/backend billing;
- mobile-first editor;
- multi-floor;
- curved walls;
- DWG/DXF/BIM;
- photorealism/VR.

## 6. Immediate roadmap — NOW

```text
M0–M4.6                         ✅ merged and accepted
M5.1 spatial shell/viewer       ✅ merged and accepted
M5.2 furniture in 3D            ✅ merged and accepted
M5.4 spatial inspection         ✅ merged and accepted
M6.1 layout alternatives        ✅ merged and accepted
M6.2 constraint-aware planning  ✅ merged and accepted
        ↓
M6.3 exact spatial constraints  ← NEXT
```

M5.3 is not a separate blocking milestone. Its camera/navigation architectural foundation was delivered in M5.1. Remaining work is evidence-driven polish only.

## 7. Next implementation slice — M6.3 Exact Spatial Constraints

Goal:

> Let users express precise millimetre-based planning requirements where semantics can be defined unambiguously, while keeping existing M2 geometry/fit authority and M6 fail-closed behavior intact.

Recommended narrow scope:

1. add one or two explicit numeric hard-constraint contracts first, not a broad rule language;
2. prioritize **minimum edge-to-edge spacing between selected furniture objects** in millimetres;
3. optionally add **minimum footprint-to-room-boundary gap** only if the semantics remain deterministic for the supported rectangular-room scope;
4. compute measurements from trusted 2D geometry/math, never renderer pixels or Three.js meshes;
5. expose `required`, `actual` and pass/fail evidence in result explanations;
6. hard numeric constraints reject candidates before soft ranking;
7. changing numeric rules clears stale result/preview;
8. Apply revalidates exact constraints against the current document;
9. preserve bounded deterministic generation and one-step Undo/Redo;
10. no natural-language/LLM interpretation until the exact structured vocabulary is stable and accepted.

Architecture direction:

```text
VlezetDocument + explicit mm constraints
        ↓
shared structured constraint validation
        ↓
@vlezet/planning bounded deterministic candidates
        ↓
M2 authoritative fit/collision/door/clearance validation
        ↓
exact numeric hard-constraint validation
        ↓
existing deterministic soft ranking + measured reasons
        ↓
ephemeral preview
        ↓ explicit revalidated Apply
ordinary VlezetDocument + one semantic history step
```

Do **not** jump directly to free-form natural-language orchestration, whole-apartment autonomous design or opaque LLM scoring. Natural-language → reviewed structured constraints becomes reasonable only after M6.3 proves the exact deterministic vocabulary.

## 8. Recommended workflow

```text
M6.3 focused product/design spec
→ define exact measurement semantics before UI
→ TDD pure geometry/constraint measurements
→ fail-closed shared validation at request + Apply boundaries
→ integrate hard rejection into bounded planning
→ measured explanations + compact numeric UI
→ representative browser acceptance
→ strict exact-head CI
→ squash merge
```

High-value precision/recognition/M5 polish remains evidence-driven backlog and should not interrupt M6 unless it becomes a real user blocker.

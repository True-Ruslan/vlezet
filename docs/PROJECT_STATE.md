# Vlezet — Project State

**Last updated:** 2026-07-30  
**Status:** M0–M6.4 are merged and accepted in `main`. M7.0 Product and UX Audit is accepted in PR #19 after source review, Chromium full-flow, WebKit core smoke and strict CI. The only selected next implementation slice is M7.1 Editor Shell and Responsive Context.  
**Canonical rule:** read this file first in a new chat, then `docs/product/UX_ROADMAP.md`, `docs/product/UX_BROWSER_EVIDENCE.md` and the relevant milestone checklist.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

Core promise:

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, and understand what fits, collides and remains usable — without learning professional CAD.

Priorities:

1. precision and trust before decoration;
2. structured editable geometry rather than image-only plans;
3. millimetres as the canonical world unit;
4. local-first core editing;
5. understandable semantics for ordinary users;
6. AI/CV only as reviewable assistance;
7. 3D as a projection of the same document;
8. planning as deterministic, explainable assistance with explicit Apply;
9. reachability, hierarchy and accessibility before further feature expansion.

## 2. Non-negotiable architecture

1. TypeScript is the primary language.
2. Millimetres are the canonical world unit.
3. Canvas/WebGL pixels are never persisted as apartment geometry.
4. `VlezetDocument` is the only persistent apartment/layout source of truth.
5. `domain`, `geometry`, `editor-core`, `projects`, `recognition`, `spatial` and `planning` remain framework-independent where applicable.
6. Konva and Three.js are projections, never geometry authority.
7. Rooms, areas, dimensions, floors and 3D meshes are derived from structured geometry.
8. Project formats are schema-versioned and migrated deterministically.
9. Undo/Redo is semantic-command oriented.
10. Local editing must not depend on network latency.
11. AI/CV may create only editable suggestions; deterministic validation remains authoritative.
12. Existing user geometry is never silently replaced.
13. Ambiguous semantics fail closed or require explicit user intent.
14. 3D is read-only and never introduces parallel editor or fit state.
15. Planning candidates, constraints, Preview, evidence and overlays are ephemeral.
16. Only explicit Apply may mutate ordinary document entities.
17. M2 geometry/fit rules remain authoritative for containment, collisions, doors and clearances.
18. Hard planning constraints reject before scoring; soft preferences only influence deterministic ranking.
19. Exact numeric validation and its visualization share one geometry authority.
20. Optional LLM interpretation cannot generate authoritative coordinates, bypass validation or mutate the document.
21. Natural-language interpretation produces a reviewable symbolic draft and transfers into ordinary controls.
22. Provider keys, raw responses and language drafts are runtime-only.
23. M7 redesign work may change composition and presentation, but not these product-authority boundaries.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent model and migrations
packages/geometry        framework-independent geometry/math
packages/editor-core     semantic editing/history/snapping
packages/projects        local-first persistence
packages/recognition     assisted-recognition model/CV/reconciliation
packages/spatial         renderer-neutral deterministic 3D projection
packages/planning        deterministic planning + reviewed intent contracts
```

Rendering:

- 2D: Konva / react-konva;
- 3D: plain Three.js over renderer-neutral `SpatialScene`.

State: Zustand plus local React state for ephemeral workflows.  
Persistence: IndexedDB through repository adapters.  
Workspace: pnpm + Turborepo.  
CI: GitHub-hosted Actions in a public repository.

## 4. Accepted milestones

| Milestone | Result | Merge / status |
|---|---|---|
| M0 Foundation + Infinite Canvas | monorepo, mm canvas, walls, snapping, semantic history | `099a202413459674d2b50c33d2c1fa125a0fef6f` |
| M1 Apartment Shell | topology, thickness, rooms/areas, openings, diagnostics | `3944c7f9d668a645e1dc05805f476d2f3290eb94` |
| M2 Furnishing + Fit | objects, transforms, containment/collision/door/clearance authority | `aa34f24572f2e67714604634587a1c41e4067cd8` |
| M3 Local-First Projects | dashboard, IndexedDB, autosave, backup/import, PNG | `6c32249acc8e333e62fceee2ea4e76ca83890c77` |
| M4 Reference Import | JPG/PNG/PDF, calibration, tracing, local assets | `12e9696e11572ad5ec055f3dfad98ad7826184e2` |
| M4.5 Assisted Recognition | editable assisted MVP; accuracy remains evidence backlog | `b63bdd613db4e13c07d2a961981799bd360f256d` |
| M4.6 Precision Geometry UX | clear dimensions, area consistency, annotations, tape | `a718bf605d8b3bde8dc87953c340b7b0e9565fdb` |
| M5.1 Spatial 3D Shell | deterministic read-only 3D viewer and camera foundation | `4acca82b04c87b3737eb87a03f9ee2ff360b5073` |
| M5.2 Furniture in 3D | document furniture projected into spatial scene | `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a` |
| M5.4 Spatial Inspection | semantic hover/select and read-only inspection | `0bffe36d74d2ff0865d700b51b17ee08e7001094` |
| M6.1 Layout Alternatives | bounded alternatives, Preview, atomic Apply | `f2bbf1c4989ef4582ee86aba19c75a71679034be` |
| M6.2 Constraint-Aware Planning | lock, boundary and pair preferences | `db68d697540ddb9901fbddad0763d769e7d16851` |
| M6.3 Exact Spatial Constraints | exact pair gap, evidence and nearest-contour overlay | `724058fe57d769e7c1329f3536d6869405e6ac42` |
| M6.4 Reviewed Natural-Language Intent | reviewable text interpretation and explicit transfer | `02f8b041341c86f0796011b0d2fd42cac56a4e02` |
| M7.0 Product and UX Audit | complete UX foundation, 39 findings and browser harness | ACCEPTED in PR #19; integration pending |

Accepted geometry regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## 5. Current product capability

### Trusted apartment editing

- structured topological walls, vertices, junctions and openings;
- deterministic rooms, usable area and clear dimensions;
- furniture/appliances with exact dimensions, rotation and directional clearances;
- explainable fit/collision/door/clearance diagnostics;
- semantic Undo/Redo;
- local projects, autosave, editable backup and PNG export.

### Reference and recognition

- local JPG/PNG/PDF reference import and calibration;
- tracing against the reference;
- editable assisted-recognition candidates with explicit Apply;
- recognition remains experimental and never silently replaces geometry.

### Spatial 3D

- deterministic projection of shell and furniture;
- safe 2D↔3D switching;
- semantic read-only inspection;
- no direct 3D editing or mesh authority.

### Intelligent planning through M6.4

- one axis-aligned rectangular room;
- 1–3 selected existing objects;
- fixed non-selected obstacles;
- bounded deterministic candidate generation;
- maximum three ranked alternatives;
- M2-authoritative hard validation;
- hard `lock-object` and `pair-min-gap`;
- soft wall/corner and pair near/far preferences;
- exact nearest-contour evidence;
- optional natural-language interpretation;
- exact/unique object-name resolution without fuzzy guessing;
- explicit ambiguity and unsupported-fragment review;
- explicit transfer into ordinary controls;
- no automatic generation after interpretation;
- non-mutating Preview and explicit revalidated Apply;
- one multi-object Apply = one Undo/Redo step.

## 6. M7.0 accepted audit foundation

M7.0 intentionally changed no product behaviour. It established the evidence and interaction foundation for an evolutionary redesign.

Canonical documents:

```text
docs/product/PRODUCT_VISION.md
docs/product/USER_JOURNEYS.md
docs/product/UX_AUDIT.md
docs/product/UX_BROWSER_EVIDENCE.md
docs/product/INFORMATION_ARCHITECTURE.md
docs/product/INTERACTION_MODEL.md
docs/product/UX_ROADMAP.md
docs/design/DESIGN_SYSTEM.md
docs/design/COMPONENT_INVENTORY.md
docs/design/CONTENT_AND_TERMINOLOGY.md
docs/design/ACCESSIBILITY.md
docs/milestones/m7-0-acceptance.md
```

Combined finding count:

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

Highest-priority themes:

1. global/project/tool/context actions need stable hierarchy;
2. context inspector must remain reachable at reduced effective width;
3. local-save status must be readable;
4. essential meaning must not depend on 9–10 px text;
5. hard rules, preferences, recommendations, Draft, Preview and Applied need shared visual semantics;
6. pointer-first workflows need practical keyboard/focus alternatives;
7. 3D entry must reveal the interior rather than an opaque exterior box.

Target information architecture:

```text
global product layer
        ↓
tool/workflow layer
        ↓
context layer
        ↓
Canvas/spatial feedback layer
```

## 7. M7.0 browser evidence

### Chromium full representative flow

```text
run:      30570626203 — PASS
head:     e3602296cf4382b88443e67616a69978b3f3bab0
artifact: 8770651801
```

### Final Chromium + WebKit pass

```text
run:      30571095361 — PASS
head:     7278a278f1a33d99d383a54139a20be987417c85
artifact: 8770860354
digest:   sha256:1d4991a03f6e8b4d6388119dc296fe4f9cd311cbf2c3dbc6099b730630a3ec61
```

The automated flow covered dashboard, room creation, room/object inspectors, furniture, planning, reference panel, 3D and delete confirmation.

Measured Chromium results:

- toolbar overflow in 12 captured editor states;
- document horizontal overflow in 12 states;
- hidden context surface in 3 reduced-width states;
- save status below 12 px in 13 states;
- Canvas help below 12 px in 13 states.

WebKit independently passed dashboard, room creation/editing, 3D transition and destructive dialog. This is an engine-level proxy, not a manual Safari claim. Native Safari is an explicit M7.1 gate.

## 8. Known limitations

### Recognition

- assisted MVP quality varies by drawing style and image quality;
- future work needs representative fixtures and metrics;
- no automatic authoritative reconstruction.

### Geometry

- clear dimension editing is intentionally limited to simple rectangular rooms;
- no general parametric locks, target-area solver or associative CAD dimensions;
- no structural wall classification.

### Planning

- one rectangular room and 1–3 selected existing objects;
- no whole-apartment autonomous design;
- no exact furniture-to-wall/window rule yet;
- language interpretation supports only accepted M6.2–M6.3 vocabulary.

### 3D

- schematic primitives rather than photorealism;
- no direct editing;
- default perspective can hide interior contents behind opaque exterior walls (`UX-3D-003`);
- camera/accessibility/performance polish remains evidence-driven.

### UI/UX

- toolbar clips at common desktop widths;
- inspector disappears under the current 980 px breakpoint;
- browser zoom can remove task controls;
- important metadata uses microtext;
- advanced panels are dense and inconsistent;
- keyboard/focus coverage is incomplete for spatial workflows.

## 9. NOW — M7.1 Editor Shell and Responsive Context

M7.1 is the only committed next implementation slice.

It owns:

- `UX-SHELL-001` — command responsibilities compete and clip;
- `UX-SHELL-002` — contextual controls disappear;
- `UX-DATA-001` — save state is too subtle;
- `UX-ACCESS-002` — zoom causes functional disappearance.

Required outcomes:

- separate global product actions from tools and context;
- preserve project identity, readable local-save status, active tool and Undo/Redo;
- collapse secondary utilities into a labelled overflow rather than hiding them;
- replace inspector `display:none` with a reachable panel/drawer model;
- preserve Canvas useful area and semantic selection/workflow state;
- pass 1920×1080, 1440×900, 1366×768 and 1280×800;
- pass effective 125%, 150% and 200% zoom scenarios;
- pass Chromium full-flow, WebKit smoke and native Safari core regression;
- preserve all M0–M6.4 authority and behaviour.

Non-goals:

- redesign every inspector in one PR;
- change geometry, persistence or editor stores;
- mobile-first editing;
- new AI/planning vocabulary;
- Canvas or 3D rewrite.

## 10. Required development workflow

1. brainstorm the focused slice;
2. write and approve design spec;
3. write implementation plan;
4. use TDD for behavioural/layout contracts;
5. keep PR Draft during implementation;
6. run full unit/type/lint/build CI;
7. run representative browser evidence;
8. obtain product-owner browser acceptance;
9. mark Ready and squash-merge;
10. update canonical state, roadmap, changelog and acceptance evidence.

Never claim browser acceptance from unit tests alone. Never combine unrelated feature work with UX redesign merely because the same surface is touched.

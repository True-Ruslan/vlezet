# Vlezet — Project State

**Last updated:** 2026-07-30  
**Status:** M0–M7.0 are merged and accepted in `main`. M7.0 Product and UX Audit was squash-merged through PR #19. The only selected next implementation slice is M7.1 Editor Shell and Responsive Context.  
**Canonical rule:** read this file first in a new chat, then `docs/product/UX_ROADMAP.md`, `docs/product/UX_BROWSER_EVIDENCE.md` and the relevant milestone checklist.

## 1. Product

**Vlezet** is a precise, approachable apartment planner for non-professional owners and buyers.

> Draw or import a real apartment, work with understandable real dimensions, place furniture and appliances, and understand what fits, collides and remains usable — without learning professional CAD.

Priorities:

1. precision and trust before decoration;
2. structured editable geometry rather than image-only plans;
3. millimetres as the canonical world unit;
4. local-first core editing;
5. understandable semantics for ordinary users;
6. AI/CV only as reviewable assistance;
7. 3D as a projection of the same document;
8. deterministic, explainable planning with explicit Apply;
9. reachability, hierarchy and accessibility before further feature expansion.

## 2. Non-negotiable architecture

1. TypeScript is the primary language.
2. Millimetres are canonical world units.
3. Canvas/WebGL pixels are never persisted as apartment geometry.
4. `VlezetDocument` is the only persistent apartment/layout source of truth.
5. Framework-independent packages retain domain authority where applicable.
6. Konva and Three.js are projections, never geometry authority.
7. Rooms, areas, dimensions, floors and 3D meshes are derived.
8. Project formats are versioned and migrated deterministically.
9. Undo/Redo is semantic-command oriented.
10. Local editing never depends on network latency.
11. AI/CV create editable suggestions only; deterministic validation remains authoritative.
12. Existing geometry is never silently replaced.
13. Ambiguous semantics fail closed or require explicit intent.
14. 3D is read-only and has no parallel editor/fit state.
15. Planning constraints, candidates, Preview, evidence and overlays are ephemeral.
16. Only explicit Apply mutates ordinary document entities.
17. M2 remains containment/collision/door/clearance authority.
18. Hard constraints reject before soft ranking.
19. Numeric validation and visualization share one geometry authority.
20. Optional LLM interpretation cannot generate authoritative coordinates, bypass validation or mutate the document.
21. Natural language produces a reviewable symbolic draft and transfers into ordinary controls.
22. Provider keys, raw responses and language drafts are runtime-only.
23. M7 may redesign presentation/composition, but not these authority boundaries.

## 3. Repository and stack

Repository: `True-Ruslan/vlezet`

```text
apps/web                 Next.js 16 + React + TypeScript
packages/domain          persistent model and migrations
packages/geometry        geometry/math authority
packages/editor-core     semantic editing/history/snapping
packages/projects        local-first persistence
packages/recognition     assisted CV/reconciliation
packages/spatial         renderer-neutral 3D projection
packages/planning        deterministic planning + reviewed intent
```

- 2D: Konva / react-konva;
- 3D: plain Three.js over `SpatialScene`;
- state: Zustand plus local ephemeral React state;
- persistence: IndexedDB;
- workspace: pnpm + Turborepo;
- CI: GitHub-hosted Actions.

## 4. Accepted milestones

| Milestone | Result | Merge |
|---|---|---|
| M0 | foundation, mm Canvas, walls, snapping, history | `099a202413459674d2b50c33d2c1fa125a0fef6f` |
| M1 | topology, rooms/areas, openings, diagnostics | `3944c7f9d668a645e1dc05805f476d2f3290eb94` |
| M2 | furniture and fit authority | `aa34f24572f2e67714604634587a1c41e4067cd8` |
| M3 | local projects, autosave, backup/import/export | `6c32249acc8e333e62fceee2ea4e76ca83890c77` |
| M4 | reference image/PDF import and calibration | `12e9696e11572ad5ec055f3dfad98ad7826184e2` |
| M4.5 | assisted editable recognition MVP | `b63bdd613db4e13c07d2a961981799bd360f256d` |
| M4.6 | clear dimensions, area trust, annotations, tape | `a718bf605d8b3bde8dc87953c340b7b0e9565fdb` |
| M5.1 | deterministic read-only 3D shell/viewer | `4acca82b04c87b3737eb87a03f9ee2ff360b5073` |
| M5.2 | ordinary furniture in 3D | `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a` |
| M5.4 | semantic spatial inspection | `0bffe36d74d2ff0865d700b51b17ee08e7001094` |
| M6.1 | bounded deterministic layout alternatives | `f2bbf1c4989ef4582ee86aba19c75a71679034be` |
| M6.2 | lock/boundary/pair constraints | `db68d697540ddb9901fbddad0763d769e7d16851` |
| M6.3 | exact contour gap and evidence overlay | `724058fe57d769e7c1329f3536d6869405e6ac42` |
| M6.4 | reviewed natural-language intent | `02f8b041341c86f0796011b0d2fd42cac56a4e02` |
| M7.0 | complete product/UI/UX audit and browser evidence foundation | `0d5b9c1555ef85a0e271a52832cc3fd3cca4963e` |

Accepted geometry regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

## 5. Current capability

### Editing and projects

- topological walls, rooms and openings;
- clear dimensions and usable area;
- furniture with exact transforms and clearances;
- explainable fit/collision/door diagnostics;
- semantic Undo/Redo;
- local projects, autosave, editable backup and PNG.

### Reference and recognition

- local JPG/PNG/PDF calibration and tracing;
- editable assisted-recognition candidates;
- explicit Apply;
- experimental accuracy, never authoritative replacement.

### 3D

- deterministic shell/furniture projection;
- safe 2D↔3D switching;
- semantic read-only inspection;
- no direct editing or mesh authority.

### Planning through M6.4

- one rectangular room and 1–3 selected existing objects;
- deterministic bounded alternatives;
- M2-authoritative validation;
- lock, wall/corner, near/far and exact pair-gap rules;
- exact nearest-contour evidence;
- reviewable natural-language intent without fuzzy guessing;
- explicit transfer, Preview and revalidated Apply;
- one multi-object Apply = one Undo/Redo step.

## 6. M7.0 accepted audit foundation

M7.0 changed no product UI. It established the evidence and design foundation for an evolutionary redesign.

Canonical package:

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

Combined findings:

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

Highest-priority themes:

1. stable project/tool/context hierarchy;
2. reachable inspector at reduced effective width;
3. readable local-save state;
4. no essential 9–10 px semantics;
5. shared hard/preference/recommendation/Draft/Preview/Applied language;
6. practical keyboard/focus alternatives;
7. useful interior-oriented initial 3D presentation.

Target IA:

```text
global product layer
        ↓
tool/workflow layer
        ↓
context layer
        ↓
Canvas/spatial feedback layer
```

## 7. M7.0 evidence

```text
feature head: 2ae83fb4a09fd9313f2befe5d9c35fd0ecab1394
standard CI: 30572124031 — PASS
browser CI:  30572124032 — PASS
artifact:    8771245306
merge:       0d5b9c1555ef85a0e271a52832cc3fd3cca4963e
```

Browser automation covered dashboard, room creation, room/object inspectors, furniture, responsive states, planning, reference panel, 3D and deletion in Chromium; WebKit independently covered dashboard, room form, 3D and dialog.

Confirmed:

- toolbar/document overflow at common desktop widths;
- hidden inspector under effective zoom width;
- 9 px save state and 11 px Canvas help;
- provider-first dense planning entry;
- internal milestone labels in product UI;
- opaque-wall 3D interior occlusion;
- strong dashboard and destructive confirmation patterns.

WebKit is an engine proxy, not a manual Safari claim. Native Safari is mandatory for M7.1.

## 8. Known limitations

- Recognition quality varies and needs fixtures/metrics.
- Clear dimension editing remains limited to simple rectangular rooms.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and initially may hide interiors.
- Toolbar clips at common widths.
- Inspector disappears below the current breakpoint.
- Zoom can remove task controls.
- Important metadata uses microtext.
- Advanced panels are dense/inconsistent.
- Spatial keyboard/focus coverage is incomplete.

## 9. NOW — M7.1 Editor Shell and Responsive Context

Owned findings:

- `UX-SHELL-001`;
- `UX-SHELL-002`;
- `UX-DATA-001`;
- `UX-ACCESS-002`.

Required outcomes:

- separate global actions, tools and context;
- preserve project identity, readable local-save state, active tool and Undo/Redo;
- move secondary utilities into labelled overflow;
- replace disappearing inspector with a reachable panel/drawer;
- preserve Canvas useful area and semantic state;
- pass required desktop widths and effective zoom scenarios;
- pass Chromium, WebKit and native Safari core regression;
- preserve all M0–M6.4 authority and behaviour.

Non-goals:

- redesign every inspector;
- change geometry, persistence or editor stores;
- mobile-first editing;
- new AI/planning features;
- Canvas/3D rewrite.

## 10. Delivery workflow

1. focused design spec;
2. implementation plan;
3. TDD/layout contracts;
4. Draft PR;
5. full CI;
6. Chromium/WebKit/native Safari evidence;
7. product-owner acceptance;
8. squash merge;
9. canonical documentation sync.

Never claim browser acceptance from unit tests alone. Never bundle unrelated feature work with UX redesign.

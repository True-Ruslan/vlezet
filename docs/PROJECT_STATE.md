# Vlezet — Project State

**Last updated:** 2026-08-01  
**Status:** M0–M7.6 are merged and accepted in `main`. M7.6 Geometry and Opening Inspector was squash-merged through PR #33 as `315828052edb483c34a68464acb70458bf4ff80d`. The only selected next implementation slice is M7.7 Furniture and Fit Workflow.  
**Canonical rule:** read this file first in a new chat, then `docs/product/UX_ROADMAP.md`, the latest milestone acceptance record and `docs/ROADMAP.md`.

## Repository visibility update — 2026-08-01

The public README now exposes the canonical author and engineering-portfolio origin `https://trueruslan.ru/`.

```text
feature PR:          #36
accepted head:       5ac744cb2966e933375b217c0e250042355921ca
CI:                  30714871143 / #2318 — PASS
squash merge:        accbf57a9ef810217f7066d0e9a862b7e5a406a1
changed file:        README.md only
```

This is repository-discovery maintenance only. It changes no product capability, architecture, persistence, geometry, recognition, planning, 3D or browser-acceptance claim. **M7.7 Furniture and Fit Workflow remains the only selected next implementation slice.**


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
9. reachability, hierarchy and accessibility before feature expansion.

## 2. Non-negotiable architecture

1. `VlezetDocument` is the only persistent apartment/layout source of truth.
2. Millimetres are canonical; Canvas/WebGL pixels are never persisted as geometry.
3. Framework-independent packages retain domain authority.
4. Konva and Three.js are projections, never geometry authority.
5. Rooms, areas, dimensions, floors and 3D meshes are derived.
6. Project formats are versioned and migrated deterministically.
7. Undo/Redo is semantic-command oriented.
8. Local editing never depends on network latency.
9. AI/CV create editable suggestions only; deterministic validation remains authoritative.
10. Existing geometry is never silently replaced.
11. 3D is read-only and has no parallel editor/fit state.
12. Planning constraints, candidates, Preview and evidence are ephemeral.
13. Only explicit Apply mutates ordinary document entities.
14. M2 remains containment/collision/door/clearance authority.
15. Optional LLM interpretation cannot generate authoritative coordinates or bypass validation.
16. Provider keys, raw responses and language drafts are runtime-only.
17. Responsive shell, workflow return targets and panel visibility are ephemeral UI state.
18. M7 presentation work must not create a second persistent product truth.
19. Geometry-inspector preview state is runtime-only and cannot create, validate, persist or mark geometry successful.

## 3. Repository and stack

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
- browser acceptance: Playwright Chromium full flow + WebKit core smoke.

## 4. Accepted milestones

| Milestone | Result | Merge |
|---|---|---|
| M0 | foundation, mm Canvas, walls, snapping, history | `099a202413459674d2b50c33d2c1fa125a0fef6f` |
| M1 | topology, rooms/areas, openings, diagnostics | `3944c7f9d668a645e1dc05805f476d2f3290eb94` |
| M2 | furniture and fit authority | `aa34f24572f2e67714604634587a1c41e4067cd8` |
| M3 | local projects, autosave, backup/import/export | `6c32249acc8e333e62fceee2ea4e76ca83890c77` |
| M4 | reference plan import and calibration | `12e9696e11572ad5ec055f3dfad98ad7826184e2` |
| M4.5 | assisted editable recognition MVP | `b63bdd613db4e13c07d2a961981799bd360f256d` |
| M4.6 | clear dimensions, area trust, annotations, tape | `a718bf605d8b3bde8dc87953c340b7b0e9565fdb` |
| M5.1 | deterministic read-only 3D shell/viewer | `4acca82b04c87b3737eb87a03f9ee2ff360b5073` |
| M5.2 | furniture in 3D | `7f7e8dfd9c875145bfa3d307638cd8cd27051a3a` |
| M5.4 | semantic spatial inspection | `0bffe36d74d2ff0865d700b51b17ee08e7001094` |
| M6.1 | bounded deterministic alternatives | `f2bbf1c4989ef4582ee86aba19c75a71679034be` |
| M6.2 | lock/boundary/pair constraints | `db68d697540ddb9901fbddad0763d769e7d16851` |
| M6.3 | exact contour gap and evidence | `724058fe57d769e7c1329f3536d6869405e6ac42` |
| M6.4 | reviewed natural-language intent | `02f8b041341c86f0796011b0d2fd42cac56a4e02` |
| M7.0 | product/UI/UX audit and browser evidence | `0d5b9c1555ef85a0e271a52832cc3fd3cca4963e` |
| M7.1 | editor shell and responsive context | `6b6f8751b520722a54bb94a6947dae1135e07859` |
| M7.2 | context inspector and workflow return | `66606356d69f96953f8afae7b914222a3f793777` |
| M7.3 | design system and content components | `509dfc02e17c87a58da8356894564a8f27bc5a9b` |
| M7.4 | Canvas selection and mode feedback | `399e1b439d478fb8b01cd39795213b42beece84f` |
| M7.5 | onboarding, durable status and recovery | `62413d91ebc5cef335b772e46ebbc1dae18b1acc` |
| M7.6 | geometry and opening inspector | `315828052edb483c34a68464acb70458bf4ff80d` |

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
- local projects, autosave, backup and PNG.

### Reference and recognition

- local JPG/PNG/PDF calibration and tracing;
- editable local and OpenRouter-assisted recognition candidates;
- strict structured response handling and response healing;
- stale candidate decisions are discarded during repeated cloud checks;
- explicit Apply; AI output remains non-authoritative.

### 3D and planning

- deterministic read-only shell/furniture projection and semantic inspection;
- bounded deterministic alternatives for one rectangular room and 1–3 objects;
- lock, wall/corner, near/far and exact pair-gap rules;
- reviewed natural-language intent;
- explicit Preview and revalidated atomic Apply.

### UX foundation through M7.6

- separate project/tool command layers and reachable Undo/Redo;
- docked and compact side surfaces with preserved local state;
- unified context anatomy and explicit workflow return;
- independently scrollable long context panels;
- semantic design tokens, shared controls and Russian unit formatting;
- authoritative Canvas mode, next-action status and one-level `Escape` priority;
- distinct hover, selection, valid-preview and invalid-preview presentation;
- state-derived first-project guidance and durable runtime-only operation evidence;
- recoverable backup-export failure and compact overlay placement;
- explicit room horizontal/vertical clear-dimension cards;
- wall-axis length separated from wall thickness with visible fixed endpoints/surfaces;
- screen-stable physical labels for forward, reverse-directed and diagonal walls;
- opening position measurable from either visible wall end without moving the opening;
- four accessible, visibly distinct runtime-only door-swing previews;
- fail-closed invalid opening drafts that preserve authoritative geometry;
- one-step semantic Undo for accepted room, wall and opening operations;
- no document-level horizontal overflow in the required browser matrix.

## 6. M7.6 accepted evidence

```text
PR:                  #33
final accepted head: 29b631fe43ba1a00e0ad48c71ee5429371d1faa8
standard CI:         30701887262 / #2212 — PASS
browser CI:          30701887265 / #330 — PASS
artifact:            8819106567
digest:              sha256:069a3f8105d5123152f12e07b1a62c96809ac2caf02ab65b0fdee4d8a8569669
merge:               315828052edb483c34a68464acb70458bf4ff80d
```

Product-owner acceptance:

> «Все работает четко строго по описанным тобой шага.»

Canonical records:

- `docs/milestones/m7-6-acceptance.md`;
- `docs/changelog/2026-08-01-m7-6.md`.

## 7. Known limitations

- Recognition quality varies and needs a versioned benchmark corpus and measurable topology/area metrics.
- Issue #27 owns future M7.8 recognition hardening; valid AI responses can still reconstruct walls, openings, rooms and areas inaccurately.
- Clear dimension editing remains limited to simple rectangular rooms.
- Furniture editing and fit presentation still distribute common tasks, orientation, clearances and catalogue discovery across dense surfaces.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and may initially hide interiors.
- Domain-specific forms remain dense and are owned by later workflow slices.
- Spatial keyboard/focus coverage remains incomplete.
- WebKit automation is an engine-level proxy, not a manual native-Safari claim.

## 8. NOW — M7.7 Furniture and Fit Workflow

Owned findings:

- `UX-FURN-001`;
- `UX-FURN-002`;
- `UX-FURN-003`;
- remaining `UX-FURN-004`.

Goal:

> Make furniture discovery, placement, orientation, exact editing and fit/clearance explanation feel like one predictable workflow without weakening M2 fit authority.

Expected design questions:

- which furniture actions are primary immediately after placement and after later selection;
- how catalogue discovery, categories and recent/common items should be prioritised;
- how rotation, dimensions and distance-to-contour meaning should be explained visually;
- how collisions, door conflicts and clearance recommendations should be grouped and acted on;
- which values update immediately and which require explicit Apply;
- how the workflow remains usable with docked panels, compact widths and keyboard navigation.

Expected scope:

- simplify furniture catalogue and selected-object inspector hierarchy;
- make exact dimensions, rotation and object identity easy to scan;
- preserve current transform commands and semantic Undo/Redo;
- clarify shortest contour distance versus object dimensions;
- connect fit diagnostics to valid next actions without auto-moving objects;
- improve catalogue discovery and common-object placement;
- add focused layout/content contracts and Chromium/WebKit representative flows.

Non-goals:

- changing M2 containment, collision, door or clearance authority;
- introducing a new furniture schema or migration without independent need;
- autonomous furnishing or planner expansion;
- recognition-quality work owned by M7.8;
- whole-product accessibility completion owned by M7.9;
- visual-only consolidation owned by M7.13.

## 9. Delivery workflow

Every M7.x slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.

# Vlezet — Project State

**Last updated:** 2026-08-01  
**Status:** M0–M7.5 are merged and accepted in `main`. M7.5 Onboarding, Status and Recovery was squash-merged through PR #31. The only selected next implementation slice is M7.6 Geometry and Opening Inspector.  
**Canonical rule:** read this file first in a new chat, then `docs/product/UX_ROADMAP.md`, the latest milestone acceptance record and `docs/ROADMAP.md`.

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

### UX foundation through M7.5

- separate project/tool command layers and reachable Undo/Redo;
- docked and compact side surfaces with preserved local state;
- unified context anatomy and explicit workflow return;
- independently scrollable long context panels;
- semantic design tokens and balanced-density typography;
- meaningful text at least 12 px on migrated surfaces;
- standard fields and primary actions at 40 px;
- shared store-free buttons, fields, messages, notices, badges, cards, empty states and dialogs;
- Russian presentation formatting for millimetres, square metres and degrees;
- representative migration of room, catalogue, fit, dashboard, dialogs and recognition UI;
- authoritative Canvas mode and next-action status;
- explicit first/second-point phases for walls and measurement;
- distinct hover, selection, valid-preview and invalid-preview presentation;
- consistent cursor roles for selection, drawing, placement and panning;
- one-level `Escape` priority across gestures, tools, workflows, selection and read-only 3D;
- state-derived first-project guidance from empty project to first closed room;
- per-project browser-local onboarding dismissal without document-schema changes;
- durable runtime-only evidence for room creation, recognition Apply, planning Apply and editable backup export;
- stale room evidence clearing after Undo or room deletion;
- recoverable backup-export failure with a valid retry action;
- compact guide/evidence placement that preserves Canvas hit testing and visibility;
- no document-level horizontal overflow in the required browser matrix.

## 6. M7.5 accepted evidence

```text
PR:                  #31
final accepted head: d59273615ea2f08a4a364b91fe3e3cc408ba9090
standard CI:         30692400878 — PASS
browser CI:          30692400874 — PASS
artifact:            8816130412
digest:              sha256:530ebca7ee8f20d5e79fb592a7f80a1c43044bbe750ddec752e24f98c6165581
merge:               62413d91ebc5cef335b772e46ebbc1dae18b1acc
```

Product-owner acceptance:

> «Все работает четко как надо и как ты описал.»

Canonical record:

- `docs/milestones/m7-5-acceptance.md`.

## 7. Known limitations

- Recognition quality varies and needs a versioned benchmark corpus and measurable topology/area metrics.
- Issue #27 owns future M7.8 recognition hardening; valid AI responses can still reconstruct walls, openings, rooms and areas inaccurately.
- Clear dimension editing remains limited to simple rectangular rooms.
- Wall-axis, clear-size and thickness semantics remain too dense in geometry editing.
- Opening placement and door-swing direction are not yet visually predictable enough for ordinary users.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and may initially hide interiors.
- Domain-specific forms remain dense and are owned by later workflow slices.
- Spatial keyboard/focus coverage remains incomplete.
- WebKit automation is an engine-level proxy, not a manual native-Safari claim.

## 8. NOW — M7.6 Geometry and Opening Inspector

Owned findings:

- `UX-GEO-001`;
- `UX-GEO-002`;
- `UX-GEO-003`.

Goal:

> Make clear dimensions, wall-axis/thickness semantics and opening placement or swing visually predictable without changing geometry authority.

Expected scope:

- simplify wall and room geometry controls around ordinary user intent;
- clearly distinguish clear room size, wall-axis length and wall thickness;
- preserve exact millimetre editing and semantic history;
- improve opening offset, width and host-wall explanation;
- make door swing side and direction visible before and after placement;
- keep advanced geometry detail available without dominating common tasks;
- add focused layout/content contracts and Chromium/WebKit representative flows.

Non-goals:

- wall topology, room derivation, snapping or hit-tolerance algorithm changes;
- automatic geometry repair or room generation;
- new persistent geometry models or migrations;
- recognition-quality work from issue #27;
- furniture/fit workflow redesign owned by M7.7;
- whole-product accessibility completion owned by M7.9;
- visual-only consolidation owned by M7.13.

## 9. Delivery workflow

Every M7.x slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.

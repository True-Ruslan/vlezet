# Vlezet — Project State

**Last updated:** 2026-07-31  
**Status:** M0–M7.1 are merged and accepted in `main`. M7.1 Editor Shell and Responsive Context was squash-merged through PR #21. The only selected next implementation slice is M7.2 Context Inspector Foundation.  
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
24. Responsive shell state is ephemeral UI state and is never part of project persistence.

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
- CI: GitHub-hosted Actions;
- browser acceptance: Playwright Chromium full flow + WebKit core smoke.

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
| M7.1 | stable editor shell and responsive context surfaces | `6b6f8751b520722a54bb94a6947dae1135e07859` |

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

### UX foundation through M7.1

- separate project and tool command layers;
- readable local-save state;
- directly reachable Undo/Redo;
- labelled overflow for secondary project actions;
- docked catalogue/context surfaces on wide desktop;
- non-modal left/right sheets at compact effective widths;
- selection and uncommitted form state survive sheet close/reopen;
- no document horizontal overflow in the required matrix;
- dedicated one-column 3D composition;
- responsive state remains non-persistent.

## 6. M7.1 accepted evidence

```text
PR:                  #21
implementation head: 6c21653b30e627a9bf160baf6f3f8d0a4d058f16
final verified head: 8c68bd288cd3dda1133f09a469cd7afe6dab83d9
standard CI:         30586557182 — PASS
browser CI:          30586557394 — PASS
artifact:            8776737145
digest:              sha256:e94a4d3737b8c4a9d562d848f51319b968a12be7952341cbc26cb2a526828855
merge:               6b6f8751b520722a54bb94a6947dae1135e07859
```

Chromium covered dashboard, required desktop/effective-zoom widths, room and object inspectors, catalogue/context sheets, uncommitted form state, planning, reference, 3D and deletion. WebKit independently covered dashboard, editor, form, 3D and dialog.

Product-owner acceptance:

> «Я все проверил. Выглядит уже лучше и понятнее.»

The exact local browser/version is not inferred beyond the owner's report.

Canonical record: `docs/milestones/m7-1-acceptance.md`.

## 7. Known limitations

- Recognition quality varies and needs fixtures/metrics.
- Clear dimension editing remains limited to simple rectangular rooms.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and initially may hide interiors.
- Canvas helper text still uses 11 px and is owned by M7.3/M7.4.
- Domain-specific inspector anatomy remains inconsistent and is owned by M7.2+.
- Advanced workflows remain dense/inconsistent.
- Spatial keyboard/focus coverage remains incomplete.
- Native browser/version details are not inferred from the automated WebKit proxy.

Resolved by M7.1:

- common-width document/toolbar overflow;
- disappearing contextual inspector at reduced effective width;
- unreadable 9 px local-save state;
- zoom-driven removal of essential shell controls.

## 8. NOW — M7.2 Context Inspector Foundation

Owned findings:

- `UX-SHELL-003`;
- `UX-PATTERN-001`;
- part of `UX-CONTENT-001`.

Goal:

> Establish one predictable context/workflow panel anatomy with selection identity, shared header, back/close behaviour, sections, action hierarchy and safe workflow return context.

Required outcomes:

- shared context header and identity model for empty/wall/room/opening/object states;
- consistent back/close semantics for embedded workflows;
- predictable sections and action placement;
- sticky primary actions only where evidence requires them;
- destructive actions visually separated from ordinary editing;
- preserve selection, drafts, commands and responsive M7.1 container behaviour;
- preserve all M0–M6.4 authority boundaries;
- extend browser acceptance for representative context states.

Non-goals:

- complete domain-specific form redesign;
- geometry/schema/persistence changes;
- new planning or AI capabilities;
- Canvas/3D rewrite;
- broad design-system migration assigned to M7.3.

## 9. Delivery workflow

1. focused design spec;
2. implementation plan;
3. TDD/layout contracts;
4. Draft PR;
5. full CI;
6. Chromium/WebKit evidence;
7. product-owner acceptance;
8. squash merge with exact-head protection;
9. canonical documentation sync.

Never claim browser acceptance from unit tests alone. Never bundle unrelated feature work with UX redesign.

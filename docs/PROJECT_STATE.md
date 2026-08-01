# Vlezet — Project State

**Last updated:** 2026-08-01  
**Status:** M0–M7.7 are merged and accepted in `main`. M7.7 Furniture and Fit Workflow was squash-merged through PR #35 as `4514950b35922e7a757c523baafd4c1287dfe2a6`. The only selected next implementation slice is M7.8 Reference and Recognition Workflow.  
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
19. Geometry-inspector and furniture-workflow presentation state is runtime-only.
20. Recognition candidates must preserve editable Draft and explicit Apply authority.

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
- browser acceptance: Playwright Chromium full flow + WebKit representative suite.

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
| M7.7 | furniture and fit workflow | `4514950b35922e7a757c523baafd4c1287dfe2a6` |

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
- stale candidate decisions discarded during repeated cloud checks;
- explicit Apply; AI output remains non-authoritative.

### 3D and planning

- deterministic read-only shell/furniture projection and semantic inspection;
- bounded deterministic alternatives for one rectangular room and 1–3 objects;
- lock, wall/corner, near/far and exact pair-gap rules;
- reviewed natural-language intent;
- explicit Preview and revalidated atomic Apply.

### UX foundation through M7.7

- separate project/tool command layers and reachable Undo/Redo;
- docked and compact side surfaces with preserved local state;
- unified context anatomy and explicit workflow return;
- semantic design tokens, shared controls and Russian unit formatting;
- authoritative Canvas mode, next-action status and one-level `Escape` priority;
- state-derived first-project guidance and durable runtime-only operation evidence;
- explicit room dimensions, wall-axis/thickness separation and accessible opening controls;
- searchable Russian-aware furniture catalogue with runtime-only filters;
- M2-derived placement fit labels and prioritised fit diagnostics;
- selected-object hierarchy for identity, dimensions, rotation, zones and exact position;
- exact-angle local-side explanation including diagonal directions;
- distinct Canvas meanings for dimensions, recommended zones and actual free distances;
- one-step semantic Undo for accepted furniture edits;
- no document-level horizontal overflow in the required browser matrix.

## 6. M7.7 accepted evidence

```text
PR:                  #35
final accepted head: 65c5fca7cbf75620e1411a7463811848009257a8
standard CI:         30715144250 / #2324 — PASS
browser CI:          30715144281 / #376 — PASS
artifact:            8823120889
digest:              sha256:a1e5e799679f5f4ea2aa9f52fe13576bfb3375f2c003874e94e6dc27d63a2656
merge:               4514950b35922e7a757c523baafd4c1287dfe2a6
```

Product-owner acceptance:

> Все проверки прошли, все круто.

Canonical records:

- `docs/milestones/m7-7-acceptance.md`;
- `docs/changelog/2026-08-01-m7-7.md`.

## 7. Known limitations

- Recognition quality varies and lacks an accepted versioned benchmark baseline.
- Valid AI responses can still reconstruct wall topology, openings, rooms and areas incorrectly.
- Clear dimension editing remains limited to simple rectangular rooms.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and may initially hide interiors.
- Spatial keyboard/focus coverage remains incomplete.
- WebKit automation is an engine-level proxy, not a manual native-Safari claim.

## 8. NOW — M7.8 Reference and Recognition Workflow

Owned findings and issue:

- `UX-REF-001`;
- `UX-REC-001`;
- `UX-REC-003`;
- remaining `UX-REC-004`;
- issue #27.

Goal:

> Unify source-plan setup and recognition review, then measurably improve wall topology, openings, rooms and area accuracy with a versioned benchmark corpus while preserving editable Draft and explicit Apply authority.

Required delivery order:

1. versioned anonymised benchmark corpus and scoring harness;
2. source normalisation and architectural-line filtering;
3. wall topology graph;
4. door/window classification and host-wall validation;
5. room-face derivation;
6. OCR/room-label and area constraints;
7. hybrid reconciliation and confidence calibration;
8. room-oriented review UX;
9. exact-head benchmark report plus Chromium/WebKit and product-owner acceptance.

Initial measurable targets:

- exact spatial-zone count on at least 90% of benchmark plans;
- median total-area error no greater than 5%;
- median room-area error no greater than 10% and no greater than 0.5 m² where practical;
- wall topology F1 at least 0.90;
- door/window detection F1 at least 0.85;
- incorrect high-confidence candidates at most 2%;
- zero unknown-host openings after post-processing;
- zero stale decisions referencing removed candidates.

Non-goals:

- making AI output authoritative;
- silently replacing existing geometry;
- weakening deterministic validation or explicit Apply;
- unrelated accessibility work owned by M7.9;
- 3D, planning, dashboard or visual-consolidation work.

## 9. Delivery workflow

Every M7.x slice requires focused design, implementation plan, TDD/layout contracts, Draft PR, full CI, Chromium/WebKit evidence, product-owner acceptance, exact-head squash merge and canonical documentation sync.

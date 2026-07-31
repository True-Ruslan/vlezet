# Vlezet — Project State

**Last updated:** 2026-07-31  
**Status:** M0–M7.2 are merged and accepted in `main`. M7.2 Context Inspector Foundation was squash-merged through PR #23. The only selected next implementation slice is M7.3 Design System and Content Components.  
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
24. Responsive shell, context return targets and panel visibility are ephemeral UI state and are never part of project persistence.

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
| M7.2 | unified context inspector and workflow return foundation | `66606356d69f96953f8afae7b914222a3f793777` |

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

### UX foundation through M7.2

- separate project and tool command layers;
- readable local-save state and directly reachable Undo/Redo;
- docked catalogue/context surfaces on wide desktop;
- non-modal side sheets at compact effective widths;
- selection, workflow and uncommitted form state survive sheet close/reopen;
- one semantic context anatomy for empty, wall, room, opening, object, reference, recognition and planning states;
- explicit `К комнате…` / `К предмету…` return navigation;
- stale workflow return targets fail closed to empty selection;
- destructive actions are separated and communicate consequences;
- long context panels have viewport-bounded, independently scrollable bodies;
- no document horizontal overflow in the required matrix;
- dedicated one-column 3D composition;
- all presentation state remains non-persistent.

## 6. M7.2 accepted evidence

```text
PR:                  #23
final verified head: d3231a09541c2c4cf10a48e69f4e485d15a06a0a
standard CI:         30625797753 — PASS
browser CI:          30625797756 — PASS
artifact:            8791323487
digest:              sha256:e167a0944674de6a99fc07dfaa7d5bcc0eea3b1c1cce575ce1d5b1ef961dfb12
merge:               66606356d69f96953f8afae7b914222a3f793777
```

Product-owner acceptance:

> «Теперь все работает супер четко.»

The owner specifically confirmed that the right panel scrolls and `Варианты расстановки` is reachable. The exact local browser/version is not inferred beyond the owner's report.

Canonical record: `docs/milestones/m7-2-acceptance.md`.

## 7. Known limitations

- Recognition quality varies and needs fixtures/metrics.
- Clear dimension editing remains limited to simple rectangular rooms.
- Planning remains one rectangular room / 1–3 objects and lacks whole-apartment autonomy.
- 3D is schematic, read-only and initially may hide interiors.
- Canvas helper text still uses 11 px and is owned by M7.3/M7.4.
- Typography, fields, notices, badges, cards and dialogs still use partially duplicated visual rules.
- Domain-specific forms remain dense and are owned by later focused workflow slices.
- Spatial keyboard/focus coverage remains incomplete.
- Native browser/version details are not inferred from the automated WebKit proxy.

Resolved by M7.2:

- inconsistent context/workflow header anatomy;
- ambiguous close-versus-return semantics;
- workflow transitions losing the intended ordinary context;
- raw IDs dominating panel identity;
- long right-side panels clipping actions below the viewport;
- mixed destructive-action placement and unclear consequences.

## 8. NOW — M7.3 Design System and Content Components

Owned findings:

- `UX-FURN-004`;
- `UX-REC-004`;
- `UX-PATTERN-002`;
- `UX-PATTERN-003`;
- remaining `UX-CONTENT-001`;
- `UX-SHELL-005`.

Goal:

> Establish a small governed visual/content system for readable typography, spacing, fields, notices, badges, cards, dialogs and canonical Russian terminology without rewriting domain workflows.

Required outcomes:

- explicit typography and spacing tokens for essential UI;
- reusable field, help, error, notice, badge, card and dialog primitives;
- consistent focus, disabled, loading, success, warning and error states;
- canonical user-facing terminology and unit formatting;
- remove remaining microtext where M7.0 evidence already identifies it;
- migrate representative surfaces first, not every component at once;
- preserve M7.1 shell and M7.2 context contracts;
- preserve all M0–M6.4 authority and persistence boundaries;
- Chromium/WebKit evidence for representative component states.

Non-goals:

- complete geometry, furniture, recognition or planning workflow redesign;
- new domain/schema/persistence semantics;
- Canvas/3D rewrite;
- final visual polish across the whole product;
- mobile-first editor.

## 9. Delivery workflow

1. focused design spec;
2. implementation plan;
3. TDD/layout/content contracts;
4. Draft PR;
5. full CI;
6. Chromium/WebKit evidence;
7. product-owner acceptance;
8. squash merge with exact-head protection;
9. canonical documentation sync.

Never claim browser acceptance from unit tests alone. Never bundle unrelated feature work with UX redesign.

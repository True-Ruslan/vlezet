# Vlezet — Changelog

**Purpose:** preserve the development history, accepted product decisions, architecture boundaries, browser findings and verification evidence needed to reconstruct project context in a new chat.

This is a milestone changelog rather than a package-release log. Detailed acceptance records remain in `docs/milestones/`.

## 2026-08-01 — Canonical engineering-portfolio link

**Status:** merged to `main`; exact-head CI PASS.

```text
PR:                  #36
accepted head:       5ac744cb2966e933375b217c0e250042355921ca
CI:                  30714871143 / #2318 — PASS
squash merge:        accbf57a9ef810217f7066d0e9a862b7e5a406a1
```

Added one explicit README link to `https://trueruslan.ru/`. No project-relative link, runtime behavior, schema, persistence, product milestone, recognition boundary, fit authority, planning authority or 3D behavior changed. M7.7 remains the selected next slice.

---


## 2026-07-30 — M7.0 Product and UX Audit accepted

PR #19 status at acceptance: source audit, browser evidence and product-owner gate complete; final integration evidence is recorded in `docs/milestones/m7-0-acceptance.md` and canonical state.

### Why

M0–M6.4 produced a capable and trustworthy planner, but capability had accumulated faster than interface hierarchy. The next proposed feature was paused because adding more planning vocabulary before reviewing the whole product would increase panel density, terminology debt and hidden-mode risk.

M7.0 therefore evaluated the complete product before redesign implementation:

- dashboard and project lifecycle;
- wall/room/opening geometry;
- furniture and fit;
- reference import and calibration;
- recognition;
- 3D;
- deterministic planning;
- reviewed natural-language intent;
- save, history, export and recovery;
- responsive, zoom, keyboard and accessibility behaviour.

### Delivered documentation foundation

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

A mechanical documentation contract verifies required files, J01–J11, unique structured finding IDs, required finding fields and P1/P2 roadmap ownership.

### Finding ledger

```text
P0  0
P1 10
P2 23
P3  6
P4  0
TOTAL 39
```

No unsupported data-loss/P0 claim was manufactured. The architecture remains strong; dominant problems are reachability, comprehension, density, consistency and accessibility.

Highest-priority findings:

- project/tool/display/history actions compete and clip in one toolbar;
- contextual inspector disappears below the current effective-width breakpoint;
- browser zoom removes task controls instead of reflowing them;
- local save state is rendered as 9 px metadata;
- important helper/status meaning frequently uses 9–11 px text;
- hard constraints, preferences, recommendations, Draft, Preview and Applied lack one visual system;
- pointer-first spatial workflows lack complete keyboard/focus alternatives;
- default 3D perspective can hide interior furniture behind opaque exterior walls.

### Automated browser evidence

Initial full Chromium representative flow:

```text
run:      30570626203 — PASS
head:     e3602296cf4382b88443e67616a69978b3f3bab0
artifact: 8770651801
```

Final Chromium + WebKit pass:

```text
run:      30571095361 — PASS
head:     7278a278f1a33d99d383a54139a20be987417c85
artifact: 8770860354
digest:   sha256:1d4991a03f6e8b4d6388119dc296fe4f9cd311cbf2c3dbc6099b730630a3ec61
```

The real Next.js product was exercised through dashboard, room creation, room/object inspectors, furniture, responsive states, planning, reference panel, 3D and delete confirmation.

Machine observations across 15 Chromium states:

- 12 toolbar-overflow observations;
- 12 document-horizontal-overflow observations;
- 3 hidden-context-surface observations;
- 13 save-status microtext observations;
- 13 Canvas-help microtext observations.

WebKit independently passed dashboard, IndexedDB startup, room creation/editing, 3D transition and the destructive dialog. It is recorded as an engine-level proxy, not as a manual shipping-Safari claim. Native Safari regression is an M7.1 gate because M7.1 changes the shell; M7.0 does not.

### Strengths preserved

- calm and understandable dashboard;
- local-first operation and autosave;
- shared geometry authority for dimensions and area;
- explainable fit diagnostics;
- reviewable recognition and language drafts;
- non-mutating Preview and explicit Apply;
- manual workflows remain usable after provider failures;
- semantic Undo/Redo;
- clear project deletion confirmation;
- recognisable restrained visual direction.

### Target UX foundation

The accepted information architecture has four layers:

```text
global product layer
        ↓
tool/workflow layer
        ↓
context layer
        ↓
Canvas/spatial feedback layer
```

The accepted interaction model defines selection, exclusive tools, commands, display toggles, Escape priority, immediate edits, explicit Apply, Draft/Preview/Applied lifecycle and status/error hierarchy.

The design foundation defines readable typography, spacing, control dimensions, semantic colour roles, focus/error states, inspector anatomy, canonical Russian terminology and required viewport/zoom acceptance.

### Roadmap consequence

Only **M7.1 Editor Shell and Responsive Context** is selected as `NOW`.

It owns:

- `UX-SHELL-001`;
- `UX-SHELL-002`;
- `UX-DATA-001`;
- `UX-ACCESS-002`.

M7.1 must establish command hierarchy, readable local save status and a reachable context surface before later inspector, Canvas, planning or visual consolidation work.

No M7.1 product code was implemented inside M7.0.

### Architecture preserved

- no `VlezetDocument`, schema or migration change;
- no IndexedDB or project-format change;
- no geometry semantics change;
- no planner/evaluator/M2-fit authority change;
- no Apply/history authority change;
- no Canvas/Three.js authority change;
- no new AI or autonomous functionality;
- browser automation remains non-product test tooling.

Canonical evidence: `docs/milestones/m7-0-acceptance.md` and `docs/product/UX_BROWSER_EVIDENCE.md`.

---

## 2026-07-30 — M6.4 Reviewed Natural-Language Intent accepted and merged

PR #17 squash merge:

```text
02f8b041341c86f0796011b0d2fd42cac56a4e02
```

Final accepted head and CI:

```text
d8c35d88ad8e48dc53a156c08bfae60d0530e26f
GitHub Actions 30553594794 — PASS
```

### Why

M6.2 and M6.3 provided trustworthy structured controls, but ordinary users still had to translate everyday wishes into planning terminology manually.

M6.4 needed to support requests such as:

> Диван не двигать, кресло поставить ближе к углу, между креслом и столом оставить минимум 800 мм.

The product could not safely let an LLM generate coordinates, run the planner automatically or silently guess ambiguous furniture. The accepted solution is therefore a reviewed translation layer rather than autonomous design.

### Delivered

Framework-independent intent contract:

- symbolic clauses for `lock-object`;
- wall/corner `prefer-room-boundary`;
- `pair-distance` near/far;
- exact `pair-min-gap`;
- strict interpreter-payload normalization;
- explicit mm/cm/m → millimetre conversion;
- Unicode NFKC, lowercase, punctuation/whitespace and `ё/е` normalization;
- exact object-name match before unique contiguous token match;
- no fuzzy guessing;
- stable `resolved`, `ambiguous` and `unresolved` results;
- conversion through existing `validatePlanningConstraintSet()`.

Optional OpenRouter boundary:

- text-only structured-output request;
- compatible text-model discovery;
- runtime-only BYOK;
- request-local authorization header;
- categorized 401/403/402/429 and malformed-response errors;
- no image, coordinate, position, rotation, placement or geometry payload;
- no direct planner invocation or document mutation.

Review and transfer UX:

- natural-language input above ordinary planning controls;
- source fragments preserved in review cards;
- explicit choices for ambiguous and unresolved references;
- unsupported fragments remain visible;
- unsupported fragments require acknowledgement;
- individual clauses can be removed;
- exact values display in canonical millimetres;
- explicit `Перенести в ограничения` action;
- transfer fills the existing selection, lock, boundary, pair and gap controls;
- transfer never generates alternatives automatically;
- `Найти варианты` remains a separate explicit action;
- provider failure leaves manual planning usable;
- language/control changes clear stale results, Preview and exact-gap annotation.

### Browser acceptance

Representative room contained:

- `Диван`;
- `Стул`;
- `Рабочий стол`;
- `Обеденный стол`.

Input additionally included unsupported window-relative intent.

The supplied screenshots confirmed:

- `Диван` resolved uniquely and received `Не двигать`;
- `кресло` was not guessed as `Стул` and required explicit user selection;
- `стол` remained ambiguous between both tables;
- `800 мм` minimum contour gap normalized correctly;
- `Стол поставить ближе к окну` remained in `Не поддержано`;
- unsupported intent was not silently mapped to a wall preference;
- explicit choices and acknowledgement enabled transfer;
- transferred ordinary controls matched the reviewed draft;
- no alternatives were generated before the separate button.

Product owner confirmed:

> «Работает все четко и ровно так, как ты описал.»

The screenshots did not independently re-run every downstream M6.3 operation. Preview, nearest-contour evidence, Apply, one-step Undo/Redo and persistence authority remained covered by unchanged implementation paths, accepted M6.3 browser evidence, scope inspection and the full regression suite.

### Browser-found responsive defect fixed

The functional acceptance screenshots exposed a non-functional layout issue in the narrow right inspector:

- `Не двигать` and `Предпочтение` visually touched;
- pair names and their field labels lacked enough separation;
- long furniture names could make ordinary transferred controls difficult to scan.

TDD evidence:

```text
RED   88bbaa64e5ca764b629f1532244fe8b6ebd7b410
      GitHub Actions 30552858007 — FAIL
      two new narrow-inspector layout-contract tests

CSS   e5a351c2ea4ea3e710ba5103c215c7b64217a8a2
      GitHub Actions 30553051798 — FAIL
      product CSS was present; one compact-test expectation retained whitespace

GREEN 4980d062d33848a82584881eddeadff70b74a0b1
      GitHub Actions 30553207256 — PASS
```

The final UI uses explicit grids, gaps, wrapping and separate pair cards while remaining inside the existing inspector.

### Primary TDD evidence

```text
Pure intent contract
RED   09ffe649e235beba3f59515d1f694b6f41fbe3ee
      run 30546883888 — FAIL
GREEN d765c27c3f63ae7fe1fb34fa4075a2c00faaa7b9
      run 30547202205 — PASS

OpenRouter provider boundary
RED   af3ae1e0392ac483d6874300111f8b20ecacb2e2
      run 30547430331 — FAIL
GREEN 26892574de912591e0bfdd54c405728278536940
      run 30547833919 — PASS

Review and transfer model
RED   97798c2594561f422e0e71579402494402498d4e
      run 30548029175 — FAIL
GREEN a32a061798b4a169ab36d8d4ad50fb469bc1ca39
      run 30548539161 — PASS

Review UI and planning integration
RED   a175cd6f7fa36ff5a96856db94b6ecc91140cf41
      run 30548815686 — FAIL
GREEN 1220876eca429cbbab2486dad7765b4b41b524b9
      run 30549668157 — PASS
```

### Architecture preserved

- no `VlezetDocument` schema or migration change;
- no IndexedDB or project-format change;
- no backup/import/export persistence change;
- no planner/evaluator/M2-fit authority change;
- no Apply/history authority change;
- no raw provider response, API key or review draft persistence;
- Preview remains non-mutating;
- Apply remains explicit and one-step undoable;
- manual planning remains available without network access.

Canonical evidence: `docs/milestones/m6-4-acceptance.md`.

Roadmap consequence: M6.4 completes the currently planned intelligent-planning foundation. No speculative M6.5 was selected automatically. The next slice begins with an evidence-driven comparison of actual product problems.

---

## 2026-07-30 — M6.3 Exact Spatial Constraints accepted and merged

PR #15 squash merge:

```text
724058fe57d769e7c1329f3536d6869405e6ac42
```

Final accepted head and CI:

```text
f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8
GitHub Actions 30542599616 — PASS
```

### Why

M6.2 could express qualitative intent, but ordinary users also need exact requirements such as a minimum 800 mm passage between two pieces of furniture.

### Delivered

Hard structured rule:

```text
pair-min-gap(objectA, objectB, minimumMm)
```

Accepted semantics:

- canonical millimetres;
- shortest Euclidean edge-to-edge distance between oriented furniture footprints;
- touching and overlap measure `0`;
- finite non-negative values only;
- `0` is a real rule; empty input means no rule;
- normalized unordered object pair;
- malformed, duplicate, self-pair and outside-selection rules fail closed;
- exact hard validity cannot be rescued by soft ranking;
- impossible requirements return no violating alternatives.

Shared geometry authority:

```ts
minimumGapWitnessBetweenOrientedRectangles()
minimumDistanceBetweenOrientedRectangles()
```

Planning validation, structured evidence and 2D visualization use the same closest-distance calculation.

Accepted UX:

- explicit minimum contour-gap input;
- helper distinguishes contour gap from dimensions and centre distance;
- result cards show actual and required values;
- Preview renders a nearest-contour double-arrow;
- endpoint/contact markers and viewport-clamped label;
- one active exact pair at a time;
- no additional Konva layer.

Browser regression fixed:

- furniture selection could widen the root grid and push the inspector outside the viewport;
- `.editor-app { grid-template-columns: minmax(0, 1fr); }` was retained;
- optional toolbar copy collapses before overflow.

Architecture preserved:

- no persistent planning state;
- M2 remains fit/collision/door/clearance authority;
- constraints, Preview and evidence remain ephemeral;
- Apply remains explicit, revalidated and one-step undoable.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Все работает супер идеально, ты гений величайший.»

Canonical evidence: `docs/milestones/m6-3-acceptance.md`.

---

## 2026-07-23 — M6.2 Constraint-Aware Planning accepted and merged

PR #13 squash merge:

```text
db68d697540ddb9901fbddad0763d769e7d16851
```

Accepted head/run:

```text
a32b5f633ee5c36dafb5578d3c0c3f7eaa46d649
GitHub Actions 29962203961 — PASS
```

Delivered:

- hard `lock-object` → `Не двигать`;
- soft wall/corner `prefer-room-boundary`;
- soft pair `near/far`;
- explicit centre-to-centre pair evidence;
- stable normalization and intent-sensitive candidate identity;
- shared `validatePlanningConstraintSet()` at request and candidate/Apply boundaries;
- hard rejection before deterministic soft ranking;
- stale result/Preview clearing;
- explicit current-document-revalidated atomic Apply;
- no LLM/API dependency or second persistent planning state.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Это работает настолько все гениально и четко как ты сказал, что я в восторге.»

Canonical evidence: `docs/milestones/m6-2-acceptance.md`.

---

## 2026-07-22 — M6.1 Deterministic Layout Alternatives accepted and merged

PR #11 squash merge:

```text
f2bbf1c4989ef4582ee86aba19c75a71679034be
```

Accepted head/run:

```text
acaa352545245ff079f55fb8ce85ba2a23f2312d
GitHub Actions 29953127208 — PASS
```

Delivered:

- framework-independent `@vlezet/planning`;
- one supported deterministic rectangular room;
- 1–3 selected existing objects;
- fixed non-selected obstacles;
- footprint-aware deterministic anchors/orientations;
- bounded candidate generation;
- maximum three alternatives;
- M2-authoritative containment/collision/door/clearance validation;
- deterministic ranking and explanations;
- non-mutating 2D ghost Preview;
- explicit revalidated Apply;
- one multi-object Apply = one Undo/Redo operation.

Manual browser acceptance: **PASS**.

Product owner confirmed:

> «Все работает строго по сценарию.»

Canonical evidence: `docs/milestones/m6-1-acceptance.md`.

---

## 2026-07-22 — M5.4 Spatial Inspection accepted and merged

PR #10 squash merge:

```text
0bffe36d74d2ff0865d700b51b17ee08e7001094
```

Accepted head/run:

```text
e9980f63d574d1a9cb6614980788270a50cde47e
GitHub Actions 29948749864 — PASS
```

Delivered semantic 3D hover/select, stable logical entity IDs, read-only authoritative inspection for rooms/walls/furniture, canonical room and wall facts, M2 object-fit reasons, whole-wall highlighting and deterministic temporary-material cleanup.

No 3D mutation, mesh measurement authority or mesh collision authority was introduced.

Product owner confirmed:

> «Все работает круто как ты и описал.»

Canonical evidence: `docs/milestones/m5-4-acceptance.md`.

---

## 2026-07-22 — M5.2 Furniture in 3D accepted and merged

PR #9 squash merge:

```text
7f7e8dfd9c875145bfa3d307638cd8cd27051a3a
```

Delivered `SpatialScene.objects`, exact projection of ordinary placed objects, deterministic X/Y→X/Z mapping and rotation, height semantics, semantic metadata, generic Three.js primitives, fail-closed invalid-object projection and explicit resource disposal.

The ordinary document remains the only furniture state and geometry authority.

---

## 2026-07-22 — M5.1 Deterministic Spatial 3D Shell accepted and merged

PR #8 squash merge:

```text
4acca82b04c87b3737eb87a03f9ee2ff360b5073
```

Delivered framework-independent spatial projection, physical wall prisms, opening-aware segmentation, usable room floors, semantic opening markers, fail-closed diagnostics, orbit/pan/zoom, camera presets, fit camera, safe 2D↔3D switching and explicit GPU cleanup.

Architecture decision: the camera/navigation foundation expected from M5.3 was effectively delivered here. Remaining M5.3 work is evidence-driven polish only.

---

## 2026-07-22 — M4.6 Precision Geometry UX accepted and merged

PR #7 merge:

```text
a718bf605d8b3bde8dc87953c340b7b0e9565fdb
```

Why: users interpreted entered wall lengths as clear room dimensions and expected `3550 × 3300 = 11.72 m²`. The prior centreline/thickness result appeared incorrect without explicit semantics.

Delivered:

- explicit centreline wall-length semantics;
- clear internal rectangular room dimensions;
- deterministic usable-area consistency and rounding;
- wall-thickness fixed-face/alignment semantics;
- dimension annotations and `Размеры` toggle;
- ephemeral tape measurement tool.

Accepted regression:

```text
clear room: 3550 × 3300 mm
area:       11.72 m²
```

---

## 2026-07-22 — M4.5 Assisted Recognition accepted as experimental MVP

PR #6 merge:

```text
b63bdd613db4e13c07d2a961981799bd360f256d
```

Delivered local OpenCV/Web Worker recognition, persistent editable `RecognitionDraft`, review/edit/accept/reject workflow, deterministic image→mm Apply, duplicate/conflict protection, one-batch Undo/Redo, stale handling and optional OpenRouter BYOK refinement.

Product decision: recognition is assisted and experimental, not authoritative automatic reconstruction. Accuracy refinement remains a separate evidence-driven backlog.

---

## 2026-07-22 — Repository made public and CI restored

The private repository exhausted included GitHub-hosted Actions minutes. The repository was made public, standard hosted runners became available again and pipelines returned to green.

Self-hosted MacBook runners were considered but rejected as unnecessary operational complexity for the current stage.

---

## Earlier foundation milestones

### M4 — Reference Plan Import

PR #5 merge: `12e9696e11572ad5ec055f3dfad98ad7826184e2`

Delivered local JPG/PNG/PDF import, validation/rasterization, calibration, alignment, reference asset persistence, tracing, reference-aware fitting, portable backup and PNG export controls.

### M3 — Local-First Projects

PR #4 merge: `6c32249acc8e333e62fceee2ea4e76ca83890c77`

Delivered project dashboard/lifecycle, IndexedDB persistence, autosave/retry, viewport restoration, backup/import and PNG export.

### M2 — Furnishing and Fit

PR #3 merge: `aa34f24572f2e67714604634587a1c41e4067cd8`

Delivered placed furniture/appliances, exact dimensions/transforms, snapping, containment, collisions, door-swing obstruction, directional clearances and explainable fit statuses.

### M1 — Apartment Shell

PR #2 merge: `3944c7f9d668a645e1dc05805f476d2f3290eb94`

Delivered topological walls/vertices, T-junctions, physical thickness, deterministic room derivation/usable area, room names, host-wall doors/windows and geometry diagnostics.

### M0 — Foundation and Infinite Canvas

PR #1 merge: `099a202413459674d2b50c33d2c1fa125a0fef6f`

Delivered monorepo/package boundaries, millimetre world coordinates, infinite 2D canvas, pan/zoom/grid, wall drawing, snapping, semantic history and reproducible CI.

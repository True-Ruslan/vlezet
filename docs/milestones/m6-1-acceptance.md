# M6.1 Deterministic Layout Alternatives — Acceptance

**Date:** 2026-07-22  
**PR:** #11 `feat: M6.1 deterministic layout alternatives`  
**Status:** implementation complete; automated gates PASS; representative real-browser acceptance required before merge.

## Product contract

M6.1 is the first Intelligent Planning slice.

```text
selected rectangular room + 1–3 existing objects
        ↓
@vlezet/planning deterministic bounded generator
        ↓
structured position/rotation candidates
        ↓
existing M2 evaluateObjectFits()
        ↓
hard rejection + deterministic ranking/explanations
        ↓
ephemeral 2D ghost preview
        ↓ explicit Apply
one semantic document/history operation
```

Non-negotiable boundaries:

- `VlezetDocument` remains the only persistent apartment/layout source of truth;
- planning candidates contain transforms only and are not persisted independently;
- M2 containment/collision/door-swing/clearance evaluation remains authoritative;
- no planning-specific replacement collision engine;
- preview never writes document/history/autosave/IndexedDB;
- Apply revalidates against the current document before mutation;
- Apply changes only selected objects' `position` / canonical `rotationDeg`;
- one Apply = one Undo / one Redo;
- no LLM/API dependency, free-form AI geometry, direct 3D editing or whole-apartment orchestration in M6.1.

## Delivered implementation

### Framework-independent planning core

New `@vlezet/planning` package:

- validated `PlanningRequest`, `PlanningCandidate`, `PlanningPlacement` contracts;
- fail-closed missing/invalid/unsupported room/object selection states;
- first supported scope: one deterministic axis-aligned rectangular room;
- 1–3 existing selected objects;
- non-selected objects naturally remain fixed obstacles in the ordinary document;
- stable candidate IDs/keys; no random UUID ordering;
- hard search budget `MAX_PLANNING_EVALUATIONS = 6000`;
- maximum three displayed ranked alternatives.

### Deterministic candidate generation

For each selected object:

- four footprint-aware corner placements;
- four wall-side midpoint placements;
- room center;
- current position reference;
- current normalized rotation and +90° normalized rotation;
- deterministic order and duplicate elimination.

### Authoritative evaluation

Every complete candidate is applied only to an ephemeral evaluation document and passed through existing `evaluateObjectFits()`.

Hard-invalid candidates are not offered when selected objects have:

- invalid plan state;
- `outside-room`;
- `object-collision`;
- `door-obstructed`;
- target-room mismatch.

Valid candidates are ranked lexicographically by:

1. fewer `tight` selected objects;
2. fewer recommendation diagnostics;
3. fewer changed rotations;
4. lower total movement from current transforms;
5. stable deterministic candidate key.

Reasons are deterministic and derived from fit/ranking evidence, not an LLM.

### Ephemeral planning UX

For a supported selected room:

- `Варианты расстановки` entry point;
- select 1–3 existing room objects;
- `Найти варианты`;
- up to three ranked result cards;
- `Лучший` marker for first-ranked result;
- deterministic explanation/reason text;
- `Предпросмотр` draws ghost object transforms over the ordinary 2D document;
- real persisted objects remain unchanged during preview;
- `Применить` explicitly commits the selected candidate.

### Atomic Apply

- candidate revalidated against current document;
- stale/invalid candidate fails closed;
- object identity/dimensions/name/category/preset/height/clearance preserved;
- only position/rotation change;
- rotation normalized using domain canonical helper before persistence;
- editor command label `planning/apply-candidate`;
- all selected transforms use one `document/replace` history entry;
- one Undo restores all original transforms;
- one Redo reapplies all candidate transforms.

## TDD / RC evidence

Observed RED→GREEN cycles:

1. missing planning request contracts → RED → fail-closed request validation GREEN;
2. missing deterministic anchors/evaluation/planner → RED → bounded generator + M2-authoritative evaluation/ranking GREEN;
3. missing revalidated Apply/editor-core adapter → RED → atomic pure Apply + history contract GREEN;
4. missing editor-store planning action → RED → one-command store Apply/Undo/Redo GREEN;
5. missing ephemeral planning UI/panel → RED → isolated UI state + deterministic result UI GREEN;
6. persisted rotation canonicality gap (`450°`) → RED → domain normalization on Apply (`90°`) GREEN.

Infrastructure note:

- adding a new workspace package required one-time lockfile synchronization in the feature branch;
- temporary write-capable CI/bootstrap helpers were removed afterward;
- final branch uses the repository's normal read-only `pnpm install --frozen-lockfile` CI workflow.

## Automated verification

Accepted code RC before this documentation commit:

```text
c07229c275e4a65795a4500add835c660b59fc53
GitHub Actions 29952993344 — PASS
```

Passed on that exact code head:

- [x] `pnpm install --frozen-lockfile`
- [x] full unit suite
- [x] TypeScript typecheck
- [x] ESLint
- [x] production Next build

Automated contracts cover:

- [x] 1–3 unique selected objects only
- [x] missing/stale room/object failure
- [x] unsupported non-rectangular room failure
- [x] deterministic orientations and footprint-aware anchors
- [x] outside-room rejection
- [x] collision with fixed non-selected furniture rejection
- [x] door-swing obstruction rejection
- [x] deterministic ranking comparator
- [x] bounded search and max-three result contract
- [x] same input → same ordered result
- [x] source document not mutated by generation/evaluation
- [x] candidate Apply preserves non-transform object semantics
- [x] stale candidate Apply fails atomically
- [x] persisted candidate rotation is canonicalized
- [x] multi-object Apply is one history entry
- [x] one Undo/Redo restores/reapplies all selected transforms
- [x] planning UI store is ephemeral and clears preview on close/room change
- [x] planning panel renders explicit preview/apply controls and deterministic reasons

## Architecture self-review

Changed-file review confirms:

- [x] no `VlezetDocument` schema change
- [x] no planning state in IndexedDB/project backup/autosave
- [x] no planning dependency from domain/geometry back into UI
- [x] no Three.js/mesh geometry used as planning authority
- [x] no duplicate planning collision engine
- [x] no random candidate ordering/UUID generation
- [x] no per-object Apply command loop
- [x] preview path does not invoke editor document mutations
- [x] search is explicitly bounded
- [x] canonical state docs are not marked DONE before browser acceptance/merge

## Real-browser acceptance — required before merge

Use the same representative apartment used for M5 acceptance, preferably a rectangular room containing at least 2–3 placed objects.

- [ ] Select a rectangular room in 2D.
- [ ] Confirm `Варианты расстановки` is visible in the room inspector.
- [ ] Open the planning panel.
- [ ] Select one object and generate alternatives.
- [ ] Select 2–3 objects and generate alternatives again.
- [ ] Confirm no more than three alternatives are displayed.
- [ ] Confirm result cards show deterministic explanation text.
- [ ] Preview each available alternative.
- [ ] Confirm preview appears as ghost furniture while original furniture remains visible.
- [ ] Confirm preview alone does not mark/save a document change and does not create an Undo step.
- [ ] Confirm offered alternatives do not visibly leave the room, collide with fixed furniture or block door opening.
- [ ] Apply one alternative.
- [ ] Confirm 2D ordinary furniture transforms match the chosen preview.
- [ ] Switch to 3D and confirm M5.2 projects the newly applied ordinary document positions.
- [ ] Use M5.4 inspection on moved furniture and confirm dimensions/fit remain correct.
- [ ] Undo exactly once and confirm all objects changed by the candidate return to original transforms.
- [ ] Redo exactly once and confirm all candidate transforms return.
- [ ] Reload the project and confirm only explicitly applied ordinary document transforms persist.
- [ ] Confirm manual furniture editing still works normally after planning.
- [ ] Confirm no M2 fit, M5 spatial shell/furniture or M5.4 inspection regression.

## Merge gate

Do not mark M6.1 DONE or merge PR #11 until:

1. final exact PR head strict CI is PASS;
2. representative real-browser checklist above is accepted;
3. any browser-discovered regression is fixed with a new exact-head CI PASS.

After browser acceptance:

```text
mark PR #11 Ready for Review
→ verify exact head + CI
→ squash merge
→ update PROJECT_STATE.md / ROADMAP.md / CHANGELOG.md with final merge SHA and accepted scope
→ choose next evidence-driven M6 slice
```

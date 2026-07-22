# M6.1 — Deterministic Layout Alternatives — Design

**Date:** 2026-07-22  
**Branch:** `feat/m6-1-deterministic-layout-alternatives`  
**Status:** approved product/design direction; implementation not started.

## 1. Goal

M6.1 is the first Intelligent Planning slice for Vlezet.

It must help a user generate and compare a small number of valid alternative placements for existing furniture in one room while preserving the product's core trust rule:

> Planning may propose structured transforms, but `VlezetDocument` plus deterministic geometry/fit engines remain authoritative.

M6.1 is not a generic AI interior designer. It is a narrow, deterministic, explainable planning workflow that establishes safe architecture for later intelligent assistance.

## 2. User journey

The first supported journey is deliberately constrained:

1. User selects one deterministic room.
2. User opens `Варианты расстановки`.
3. User chooses 1–3 existing placed objects to rearrange.
4. All non-selected placed objects remain fixed obstacles.
5. Planner generates a bounded deterministic set of placement alternatives.
6. Every candidate is evaluated through the existing M2 fit/collision/door/clearance authority.
7. Invalid candidates are rejected.
8. Valid candidates are ranked deterministically and shown with human-readable reasons.
9. User previews a candidate without mutating the document.
10. User explicitly applies one candidate.
11. Apply changes only object `position` / `rotationDeg` in one semantic undoable operation.

## 3. Architecture

Introduce a framework-independent planning package:

```text
packages/planning
```

Dependency direction:

```text
VlezetDocument + planning request
        ↓
@vlezet/planning
        ↓
structured candidate transforms
        ↓
existing @vlezet/geometry evaluateObjectFits()
        ↓
hard validation + deterministic soft scoring
        ↓
ranked explainable candidates
        ↓
ephemeral UI preview
        ↓ explicit Apply
@vlezet/editor-core semantic command
        ↓
ordinary VlezetDocument
```

`@vlezet/planning` may depend on `@vlezet/domain` and `@vlezet/geometry`. It must not depend on React, Zustand, Konva, Three.js, browser APIs, persistence or network services.

## 4. Planning contracts

### Planning request

A request identifies:

- target `roomId`;
- 1–3 selected existing `objectIds`;
- optional bounded generation settings that do not change product semantics.

The request must fail closed when:

- room does not exist;
- room cannot be deterministically derived;
- room is outside the first supported rectangular-room scope;
- selected object set is empty or exceeds 3;
- selected object ID is missing or duplicated;
- plan geometry is invalid.

### Candidate

A candidate contains only temporary proposed transforms:

```text
candidate id
placements[]:
  objectId
  position { x, y }
  rotationDeg
```

Candidates do not duplicate object names, dimensions, categories, clearances, room geometry or persistent furniture state.

A candidate is not a second source of truth and is never persisted independently in M6.1.

### Evaluation

Candidate evaluation returns:

- validity;
- deterministic score/rank inputs;
- per-object fit result references/diagnostics derived from existing M2 authority;
- concise human-readable reasons;
- deterministic stable key used for tie-breaking.

## 5. Candidate generation

M6.1 supports only deterministic axis-aligned rectangular rooms.

For every selected object, generate bounded anchors from authoritative clear room geometry:

- four room corners;
- midpoint of each of four room sides;
- room center;
- current object placement as a reference candidate position.

Orientation set:

- current normalized rotation;
- current rotation + 90° normalized;
- duplicate rotations are deduplicated.

Placement anchors account for the object's oriented footprint so the generated center positions correspond to the intended wall/corner relationship instead of blindly placing the center on the boundary.

Generation must be deterministic for the same document and request.

### Combination budget

The generator must enforce an explicit bounded search budget.

The implementation may prune incrementally, but observable behavior must remain deterministic. It must never attempt unbounded combinatorial search.

The first implementation should prefer a simple fixed cap over speculative optimization.

## 6. Hard constraints — authoritative rejection

For each generated candidate, build an ephemeral evaluation document by applying only candidate transforms to selected existing objects.

Run the existing M2 `evaluateObjectFits()` on that ephemeral document.

A candidate is rejected when:

- plan evaluation is invalid;
- any selected object has `blocked` status due to hard collision diagnostics, including:
  - `outside-room`;
  - `object-collision`;
  - `door-obstructed`;
  - `plan-invalid`;
- a selected object resolves outside the requested target room.

No separate planning collision engine may override or weaken M2.

Non-selected objects remain in the document and therefore participate naturally as fixed obstacles.

## 7. Soft ranking

Only hard-valid candidates are ranked.

Ranking order is deterministic and lexicographic before any final numeric presentation:

1. fewer selected objects with `tight` status;
2. fewer recommendation diagnostics (`clearance-wall`, `clearance-object`, `clearance-door`);
3. fewer objects rotated away from their original rotation;
4. lower total Euclidean movement from original object centers;
5. stable deterministic candidate key.

This avoids opaque or unstable weighted scoring as the first implementation.

UI may expose a friendly label such as `Лучший вариант`, but the underlying comparator remains explicit and testable.

## 8. Explanations

Every shown candidate must explain material outcomes using deterministic evidence.

Examples:

- `Все выбранные предметы помещаются без столкновений.`
- `Открывание дверей не перекрыто.`
- `У шкафа рекомендуемая зона использования упирается в стену.`
- `Этот вариант требует меньше перемещений от текущей расстановки.`

Reasons are derived from fit diagnostics and ranking facts. They are not generated by an LLM in M6.1.

Rejected candidates may be counted internally for diagnostics/tests, but the first UI does not need to expose a large rejected-candidate browser.

## 9. Preview and UI state

Planning UI state is ephemeral.

The first UI entry point is `Варианты расстановки` for a supported selected room.

Panel responsibilities:

- list existing objects associated with the target room;
- allow selecting 1–3 objects;
- start deterministic generation;
- show a small ranked result set, target maximum 3 displayed alternatives;
- show fit/ranking explanation summaries;
- select a candidate for preview;
- explicitly apply a candidate.

Preview must not modify:

- `VlezetDocument`;
- editor history;
- autosave state;
- IndexedDB project data.

First preview surface: 2D editor overlay/ghosts using candidate transforms over the current trusted document.

No 3D editing or 3D-specific candidate authority is introduced.

## 10. Apply semantics

Before applying, the selected candidate must be revalidated against the current document.

This protects against stale candidates after intervening document changes.

Apply rules:

- fail closed if room/object identity or relevant geometry changed such that candidate is no longer valid;
- update only selected objects' `position` and `rotationDeg`;
- preserve object IDs, dimensions, height, category, preset, name and clearance;
- apply all object transform changes as one semantic history operation;
- command label: `planning/apply-candidate`;
- one Apply = one Undo;
- redo restores the exact applied candidate transforms.

## 11. Determinism

For the same canonical document and planning request:

- candidate anchor generation order is stable;
- orientation order is stable;
- pruning/search budget is stable;
- hard evaluation uses the same deterministic M2 engine;
- ranking comparator is stable;
- candidate IDs/keys are derived deterministically from semantic inputs, not random UUIDs;
- final displayed order is stable.

## 12. Error handling and fail-closed behavior

User-facing planning must return controlled unsupported/error states rather than silently guessing.

Examples:

- unsupported non-rectangular room;
- invalid plan geometry;
- stale/missing selected object;
- no valid alternatives found;
- candidate became stale before Apply.

`Нет допустимых вариантов` is a valid product result, not a reason to weaken constraints.

Planning failure must never block ordinary manual editing.

## 13. Testing strategy

### Planning package unit tests

TDD must cover at minimum:

- request validation;
- deterministic rectangular-room anchors;
- rotation deduplication;
- same input → identical candidate order/content;
- fixed non-selected objects participate as obstacles;
- outside-room candidates rejected;
- object collisions rejected;
- door-obstructed candidates rejected;
- `tight` remains valid but ranks below clean `fits`;
- deterministic recommendation-count ranking;
- deterministic movement/rotation tie-breaks;
- bounded candidate count/search;
- no mutation of source document during generation/evaluation.

### Editor-core tests

- apply candidate updates only position/rotation;
- one semantic command;
- one Undo restores all original transforms;
- Redo restores candidate transforms;
- stale/invalid candidate apply fails atomically.

### UI/component tests

- supported room exposes planning action;
- 1–3 object selection constraint;
- preview is ephemeral;
- candidate explanations render from deterministic evaluation;
- Apply uses explicit action and clears/refreshes stale planning state appropriately.

### Browser acceptance

On the representative real apartment:

- select a supported room containing multiple objects;
- choose 1–3 objects;
- generate alternatives;
- inspect up to 3 ranked alternatives;
- verify preview changes only ghosts/overlay, not saved document;
- verify invalid collisions/door obstruction are not offered as valid alternatives;
- Apply one alternative;
- verify 2D furniture transforms match preview;
- verify 3D reflects the same ordinary document after Apply;
- Undo once restores all affected objects;
- Redo once reapplies them;
- reload/save behavior remains ordinary document persistence;
- no regression to M2 fit status, M5 spatial projection or M5.4 inspection.

## 14. Explicit non-goals

M6.1 does not include:

- LLM/API dependency;
- natural-language constraint parsing;
- adding/removing furniture automatically;
- changing object dimensions or clearance values;
- moving walls/openings;
- whole-apartment orchestration;
- arbitrary/non-rectangular room optimization;
- continuous optimization/physics solver;
- photorealistic generation;
- AI-generated images as geometry;
- direct 3D editing;
- persistent independent planning sessions;
- a second furniture/layout source of truth.

## 15. Acceptance gate

M6.1 is complete only when:

1. framework-independent deterministic planning contracts/generator/evaluator are implemented;
2. existing M2 fit/collision/door/clearance logic remains authoritative;
3. preview is non-mutating;
4. explicit candidate Apply is atomic and undoable;
5. tests/typecheck/lint/build pass on exact final PR head;
6. representative real-browser acceptance passes;
7. `PROJECT_STATE.md`, `ROADMAP.md` and `CHANGELOG.md` are updated only after acceptance/merge.

## 16. Follow-up direction after M6.1

Only after M6.1 is accepted should M6 expand toward richer structured goals such as:

- `рабочее место у окна`;
- `не ставить кровать напротив двери`;
- preferred wall/zone relationships;
- accessibility/path preferences;
- alternative object sets.

Optional LLM assistance may later translate natural language into structured planning constraints or propose structured candidates, but every candidate must still pass the same deterministic planning/M2 validation pipeline before it can be shown as valid or applied.
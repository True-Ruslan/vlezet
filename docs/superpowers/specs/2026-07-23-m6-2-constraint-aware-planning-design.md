# M6.2 Constraint-Aware Planning — Design

**Date:** 2026-07-23  
**Status:** approved by product owner through delegated autonomy; implementation target for `feat/m6-2-constraint-aware-planning`.

## Goal

M6.1 proved that Vlezet can deterministically generate, rank, preview and atomically apply valid furniture alternatives. M6.2 adds explicit user intent without weakening source-of-truth or validation rules.

The first M6.2 slice must remain deliberately narrow:

- one supported deterministic rectangular room;
- 1–3 selected existing objects;
- existing M6.1 bounded candidate generation;
- a small structured constraint vocabulary;
- deterministic hard-vs-soft semantics;
- explainable evidence in ranking;
- same ephemeral preview and explicit atomic Apply.

## Non-negotiable architecture

```text
VlezetDocument + PlanningRequest + PlanningConstraint[]
        ↓
@vlezet/planning request/constraint validation
        ↓
bounded deterministic candidate generation
        ↓
existing M2 evaluateObjectFits() hard authority
        ↓
constraint evaluation
  hard constraints → reject
  soft preferences → normalized deterministic penalty
        ↓
ranked + explainable alternatives
        ↓
ephemeral 2D preview
        ↓ explicit Apply + revalidation
one semantic VlezetDocument/history operation
```

Rules:

1. `VlezetDocument` remains the only persistent layout authority.
2. Planning constraints/candidates remain structured ephemeral data, not a second persisted plan.
3. M2 containment/collision/door-swing/clearance remains hard authority and always runs before soft preference ranking.
4. Hard constraints can only reject a candidate; scoring can never rescue one.
5. Soft preferences only change deterministic ordering among M2-valid candidates.
6. Constraint metrics must have explicit semantics/units and human-readable evidence.
7. Unsupported, conflicting or stale constraints fail closed.
8. Apply revalidates candidate constraints against the current document before mutation.
9. One Apply remains one semantic Undo/Redo operation.
10. No LLM/API dependency in M6.2 correctness.

## Constraint vocabulary

### 1. `lock-object` — hard

```ts
{ kind: "lock-object", objectId: string }
```

Meaning:

> The selected object must keep its current document position and rotation exactly.

Implementation:

- generator gives that selected object only its current transform option;
- evaluator independently verifies the candidate still matches the current document transform;
- if the document changes between generation and Apply, stale lock semantics fail closed.

Use case: “переставь диван и стол, но стол не трогай”.

### 2. `prefer-room-boundary` — soft

```ts
{
  kind: "prefer-room-boundary",
  objectId: string,
  target: "wall" | "corner"
}
```

Semantics are deterministic for the currently supported axis-aligned rectangular room.

`target: "wall"` metric:

- minimum gap in millimetres from the object's oriented footprint to any inner room boundary;
- lower is better.

`target: "corner"` metric:

- minimum Euclidean distance in millimetres between an object footprint corner and a room corner;
- lower is better.

User-facing labels:

- `Ближе к стене`;
- `Ближе к углу`.

### 3. `pair-distance` — soft

```ts
{
  kind: "pair-distance",
  objectIds: readonly [string, string],
  preference: "near" | "far"
}
```

Explicit metric:

> Euclidean distance between the two object centres, in millimetres.

This intentionally avoids pretending to model vague semantic concepts such as “cozy”, “functional”, or “good feng shui”.

- `near`: lower centre distance is better;
- `far`: higher centre distance is better.

User-facing copy must say that the relationship is measured **по центрам предметов**.

## Validation and conflict rules

- maximum 9 constraints per request;
- every referenced object must exist and be part of the selected 1–3 object set;
- pair-distance requires two distinct selected objects;
- duplicate lock constraints are rejected;
- one object may have at most one boundary preference (`wall` or `corner`), not both;
- one unordered object pair may have at most one distance preference (`near` or `far`), not both;
- all-selected-objects locked is rejected because there is no movable planning problem;
- unknown/unsupported constraint kinds fail closed at runtime boundaries;
- constraints are normalized into stable deterministic order before candidate IDs/ranking.

## Soft preference normalization and ranking

Raw metrics use millimetres, but multiple preference types must not dominate merely because their raw scales differ.

Normalize each soft preference to a penalty in `[0, 1]` using the target room diagonal `D`:

- wall: `clamp(wallGap / D, 0, 1)`;
- corner: `clamp(cornerDistance / D, 0, 1)`;
- near pair: `clamp(centerDistance / D, 0, 1)`;
- far pair: `1 - clamp(centerDistance / D, 0, 1)`.

Total `preferencePenalty` is the sum of equal-weight preference penalties.

Ranking order:

1. M2-valid candidates only;
2. fewer `tight` selected objects;
3. fewer M2 recommendation diagnostics;
4. lower `preferencePenalty`;
5. fewer changed rotations;
6. lower total movement;
7. stable deterministic key.

This means user intent matters, but it never outranks hard geometry or M2 safety/recommendation quality.

## Candidate and Apply contract

`PlanningRequest` gains optional structured constraints.

`PlanningCandidate` carries the normalized constraints that produced it. They remain ephemeral and are included so Apply can revalidate the same intent against the current document.

Candidate IDs must include both placement identity and normalized constraint identity so different intent does not accidentally share an opaque candidate ID.

Apply flow:

```text
current VlezetDocument + candidate.constraints
        ↓
validate room/object/constraint references
        ↓
re-evaluate M2 + hard constraints against current document
        ↓
invalid/stale → fail closed
valid → apply only position/canonical rotation
        ↓
one semantic planning/apply-candidate history entry
```

## UI

Extend the existing M6.1 panel rather than create a separate planner.

For each selected object:

- `Не двигать` checkbox;
- preference select:
  - `Без предпочтения`;
  - `Ближе к стене`;
  - `Ближе к углу`.

For each unordered pair of selected objects (maximum three pairs):

- relationship select:
  - `Не важно`;
  - `Ближе друг к другу`;
  - `Дальше друг от друга`.

Helper copy explicitly states pair distance is measured between object centres.

Changing selection/constraint state clears old results and preview.

Result cards keep M6.1 fit explanations and add concise constraint evidence, for example:

- `Диван: до ближайшей стены 24 мм.`
- `Кровать: до ближайшего угла 180 мм.`
- `Диван ↔ Стол: 1450 мм между центрами; предпочтение «ближе».`
- `Стол зафиксирован и не перемещается.`

## Explicit non-goals

Do not add in M6.2:

- free-form natural-language constraints;
- LLM scoring or candidate generation;
- opaque weighted “AI quality” scores;
- whole-apartment autonomous design;
- automatic furniture creation/removal;
- target-area or wall-geometry solving;
- direct 3D editing;
- persistent planning sessions;
- photorealistic/style generation;
- semantic assumptions like “bed should never face door” without an explicit deterministic product definition.

## TDD / acceptance strategy

Required RED→GREEN contracts:

1. constraint request validation/conflict detection;
2. locked-object generation and stale-lock hard rejection;
3. wall/corner soft metrics;
4. pair near/far soft metrics;
5. preference penalty inserted at the correct ranking priority;
6. deterministic candidate ID/order includes normalized constraints;
7. Apply revalidates constraints against current document;
8. UI constraint-state → structured request mapping;
9. changing constraints clears stale preview/results;
10. browser acceptance on representative apartment.

Browser acceptance must verify:

- locked object never moves in generated preview/apply;
- wall/corner preference visibly changes best-ranked result when alternatives exist;
- near/far pair preference changes ordering consistently;
- result cards explain constraint evidence;
- preview remains non-mutating;
- one Apply remains one Undo/Redo;
- 2D→3D consistency remains intact;
- M2/M5/M6.1 regressions absent.

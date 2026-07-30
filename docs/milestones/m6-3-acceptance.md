# M6.3 Exact Spatial Constraints — Accepted

**Accepted:** 2026-07-30  
**PR:** #15 `feat: M6.3 exact spatial constraints`  
**Final PR head:** `f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8`  
**Exact-head CI:** GitHub Actions `30542599616` — PASS  
**Squash merge:** `724058fe57d769e7c1329f3536d6869405e6ac42`

## Result

M6.3 is **DONE / ACCEPTED / MERGED**.

Product-owner browser confirmation:

> «Все работает супер идеально, ты гений величайший.»

The representative apartment passed the complete acceptance scenario: exact input clarity, structured evidence, nearest-contour visualization, multi-pair switching, stale-state clearing, non-mutating Preview, explicit Apply, one-step Undo/Redo, reload persistence boundaries, viewport-safe inspector and 2D→3D consistency.

## Accepted product contract

```text
pair-min-gap(objectA, objectB, minimumMm)
```

The shortest Euclidean edge-to-edge distance between the two real oriented furniture footprints must be at least `minimumMm` canonical millimetres.

Hard comparison:

```text
actualGap + 1e-6 mm >= requiredMm  → satisfied
actualGap + 1e-6 mm <  requiredMm  → rejected
```

Verified boundaries:

```text
799 < 800  → rejected
800 = 800  → accepted
842 > 800  → accepted
```

`0` is a valid exact rule. Empty input means no exact rule. Negative, non-finite, malformed, self-pair, duplicate and outside-selection constraints fail closed.

## Accepted geometry authority

Framework-independent APIs:

```ts
minimumGapWitnessBetweenOrientedRectangles(first, second)
minimumDistanceBetweenOrientedRectangles(first, second)
```

The witness API returns deterministic closest contour points and the relation:

```ts
{
  distanceMm: number;
  firstPoint: Point2 | null;
  secondPoint: Point2 | null;
  relation: "separated" | "touching" | "overlapping";
}
```

Semantics:

- separated footprints return exact nearest contour points and distance;
- touching returns `0` with a deterministic contact witness;
- overlapping returns `0` and nullable witness points;
- reversing objects preserves distance and swaps witness ownership;
- oriented footprints are authoritative; AABBs, pixels and Three.js meshes are not;
- the numeric API delegates to the witness API, preventing validator/visualization drift.

## Accepted planning architecture

```text
VlezetDocument + room + selected objects + PlanningConstraint[]
        ↓
shared fail-closed validation
        ↓
bounded deterministic @vlezet/planning generation
        ↓
existing M2 fit/collision/door/clearance authority
        ↓
exact pair-min-gap hard rejection
        ↓
existing M6.2 deterministic soft ranking
        ↓
structured required/actual/satisfied evidence
        ↓
ephemeral Preview + contextual 2D witness overlay
        ↓ explicit current-document-revalidated Apply
one semantic planning/apply-candidate Undo/Redo operation
```

Accepted boundaries:

- `VlezetDocument` remains the only persistent layout authority;
- M2 remains authoritative for containment, collision, door swing and clearances;
- exact hard constraints cannot be rescued by scoring;
- planning constraints, candidates, Preview, active pair and overlay remain ephemeral;
- Apply/history implementation remains unchanged and atomic;
- no schema/migration, IndexedDB, autosave, backup or export planning state;
- no generic rule language, wall-gap rule, LLM correctness dependency, whole-apartment orchestration, direct 3D editing or second planning document.

## Accepted UX

Input:

```text
↔ Минимальный зазор по контурам
[ 800 ] мм
```

Helper copy explicitly distinguishes the value from an object dimension and a centre-to-centre distance.

Result evidence:

```text
↔ Точное расстояние
Диван — Стол
Фактически: 842 мм
Требуется: ≥ 800 мм
По ближайшим точкам повёрнутых контуров
```

Preview visualization:

- violet dashed double-ended arrow between authoritative nearest contour points;
- endpoint markers and a special zero-contact marker;
- pill `↔ Зазор N мм`;
- fixed screen-space styling and viewport-clamped label;
- danger state for stale invalid Preview geometry;
- one deterministic active exact pair at a time;
- `Показывается на плане` / `Показать на плане` switching;
- `listening={false}` and no sixth physical Konva Layer.

## Inspector viewport regression

The browser-discovered regression where furniture selection could push the right inspector outside the viewport is fixed by retaining:

```css
.editor-app { grid-template-columns: minmax(0, 1fr); }
```

Optional toolbar status/shortcut copy collapses before common desktop overflow. The accepted browser run confirmed the inspector remains visible at the previously failing viewport and browser scale.

## Verification evidence

Exact head `f3f093df2cc6dba2aa0f6590b2c0250287f7c6b8` passed:

- `pnpm install --frozen-lockfile`;
- full unit suite;
- TypeScript typecheck;
- ESLint;
- production Next build.

GitHub Actions run: `30542599616` — PASS.

## Roadmap consequence

M6.3 proves that exact deterministic constraints and their visual evidence can safely coexist with M2 authority, M6 soft intent, ephemeral Preview and atomic Apply.

The next narrow experiment is **M6.4 Reviewed Natural-Language Intent**:

```text
natural-language request
        ↓ optional interpreter
reviewable structured PlanningConstraint[] draft
        ↓ explicit user review/edit/confirmation
existing deterministic M6 planner
```

The interpreter may suggest structured constraints. It must never bypass validation, directly mutate geometry or become required for core planning.
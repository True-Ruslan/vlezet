# M6.4 Reviewed Natural-Language Intent — Acceptance

**Status:** RC implementation complete in Draft PR #17; automated gates pass; representative browser acceptance is still required before Ready for Review or merge.  
**Date:** 2026-07-30

## 1. Product contract

M6.4 is an optional translation and review layer over the accepted M6.2–M6.3 deterministic planning system.

```text
ordinary-language request
        ↓ optional OpenRouter interpreter
symbolic clauses + unsupported fragments
        ↓ deterministic local object resolution
reviewable draft
        ↓ explicit resolution / acknowledgement
existing validatePlanningConstraintSet()
        ↓ transfer into existing manual controls
explicit Find alternatives
        ↓ existing Preview / Apply / Undo / Redo
```

Required authority boundaries:

- [x] interpreter output contains no coordinates, placements or direct document mutations;
- [x] object references resolve only against furniture in the selected room;
- [x] exact normalized match precedes unique token-sequence match;
- [x] fuzzy guessing is forbidden;
- [x] ambiguous names require an explicit user choice;
- [x] unresolved names require an explicit user choice;
- [x] unsupported fragments remain visible and require acknowledgement;
- [x] millimetres are canonical; mm/cm/m inputs normalize explicitly;
- [x] confirmed clauses pass the existing `validatePlanningConstraintSet()`;
- [x] confirmed intent transfers into existing manual controls;
- [x] interpretation never automatically runs the planner;
- [x] Preview remains non-mutating;
- [x] Apply remains explicit and uses the existing current-document revalidation/history path;
- [x] no `VlezetDocument`, migration, IndexedDB, backup or import changes;
- [x] API key and raw provider state remain runtime-only;
- [x] provider/network failure leaves manual planning available.

## 2. Supported first-slice vocabulary

- [x] `lock-object` — keep an object fixed;
- [x] `prefer-room-boundary/wall` — prefer near a wall;
- [x] `prefer-room-boundary/corner` — prefer near a corner;
- [x] `pair-distance/near|far` — qualitative pair preference;
- [x] `pair-min-gap` — exact minimum nearest-contour gap in millimetres.

Explicitly unsupported and surfaced rather than guessed:

- [x] window-relative placement;
- [x] door-relative placement;
- [x] named wall side/direction;
- [x] free coordinates;
- [x] furniture-to-wall exact distance;
- [x] whole-apartment autonomous design;
- [x] direct 3D editing.

## 3. TDD evidence

### Pure intent contract

RED:

```text
commit: 09ffe649e235beba3f59515d1f694b6f41fbe3ee
run:    30546883888 — FAIL
cause:  missing ./intent-draft module
```

GREEN:

```text
head: d765c27c3f63ae7fe1fb34fa4075a2c00faaa7b9
run:  30547202205 — PASS
```

### OpenRouter provider boundary

RED:

```text
head: af3ae1e0392ac483d6874300111f8b20ecacb2e2
run:  30547430331 — FAIL
cause: missing intent schema/provider modules
```

GREEN:

```text
head: 26892574de912591e0bfdd54c405728278536940
run:  30547833919 — PASS
```

### Review and transfer model

RED:

```text
head: 97798c2594561f422e0e71579402494402498d4e
run:  30548029175 — FAIL
cause: missing ./planning-intent-review module
```

GREEN:

```text
head: a32a061798b4a169ab36d8d4ad50fb469bc1ca39
run:  30548539161 — PASS
```

### Review UI and planning-panel integration

RED:

```text
head: a175cd6f7fa36ff5a96856db94b6ecc91140cf41
run:  30548815686 — FAIL
causes:
- missing ./planning-intent-section module;
- PlanningPanelView did not render the M6.4 slot.
```

GREEN after React lint correction:

```text
head: 1220876eca429cbbab2486dad7765b4b41b524b9
run:  30549668157 — PASS
```

Passed steps:

- [x] frozen install;
- [x] full unit suite;
- [x] TypeScript typecheck;
- [x] ESLint;
- [x] production Next build.

## 4. Automated behavior coverage

### Pure package

- [x] Unicode NFKC, lowercase, punctuation/whitespace and `ё/е` normalization;
- [x] exact object-name match;
- [x] unique contiguous token-sequence match;
- [x] ambiguous short name remains ambiguous;
- [x] typo is not fuzzy-guessed;
- [x] mm/cm/m conversion including decimal metres;
- [x] zero accepted as a real exact rule;
- [x] negative/non-finite/unsupported units rejected;
- [x] malformed interpreter clauses rejected or surfaced;
- [x] unsupported fragments preserved;
- [x] resolved draft converts through existing validator;
- [x] all-locked and >3-object drafts fail closed.

### Provider

- [x] text-only strict JSON-schema request;
- [x] no image, coordinate, position, rotation, placement or geometry payload;
- [x] request-only bearer key;
- [x] native `globalThis.fetch` receiver preserved;
- [x] structured text-model discovery;
- [x] HTTP 401/403/402/429 categorized;
- [x] empty request rejected before network;
- [x] malformed clause becomes visible unsupported output.

### Review and UI

- [x] uniquely resolved references are shown explicitly;
- [x] ambiguous names render explicit candidate choices;
- [x] unsupported acknowledgement gates transfer;
- [x] clause removal is immutable;
- [x] transfer fills selected IDs, locks, boundary preferences, pair preferences and exact-gap inputs;
- [x] language section renders before ordinary manual controls;
- [x] provider error states that manual controls remain available;
- [x] transfer/manual edits clear stale result, Preview and active exact-gap annotation;
- [x] viewport-safe min-content styling is scoped to the existing inspector.

## 5. Scope/persistence inspection

PR #17 changed only:

- `packages/planning/src/intent-draft*` and export;
- planning web provider/schema/review/UI/tests;
- existing planning panel and scoped CSS;
- milestone spec/plan/acceptance documentation.

Verified absent:

- [x] domain schema changes;
- [x] migrations;
- [x] IndexedDB schema/repositories;
- [x] project file format;
- [x] backup/import/export persistence changes;
- [x] planner/evaluator/apply/history authority changes;
- [x] recognition or spatial-3D changes.

## 6. Representative browser acceptance — pending

Use one supported axis-aligned rectangular room containing:

- `Диван`;
- `Кресло`;
- `Рабочий стол`;
- `Обеденный стол`.

Canonical input:

```text
Диван не двигать, кресло поставить ближе к углу,
между креслом и столом оставить минимум 800 мм.
```

Required scenarios:

### A. Interpretation and review

- [ ] enter the request and a runtime-only OpenRouter key;
- [ ] click `Разобрать пожелания`;
- [ ] verify `Диван — не двигать`;
- [ ] verify `Кресло — ближе к углу`;
- [ ] verify exact minimum gap normalized to `800 мм`;
- [ ] verify `стол` is explicitly ambiguous between both tables;
- [ ] select one table explicitly;
- [ ] verify unsupported window/door language is never silently mapped to wall intent;
- [ ] verify transfer is disabled until all ambiguities and unsupported fragments are handled.

### B. Transfer fidelity

- [ ] click `Перенести в ограничения`;
- [ ] verify the referenced objects become the ordinary selected planning set;
- [ ] verify `Диван` has `Не двигать`;
- [ ] verify `Кресло` has `Ближе к углу`;
- [ ] verify the selected table pair has `800 мм` exact contour gap;
- [ ] verify no alternatives were generated automatically;
- [ ] verify Preview and an existing active exact-gap overlay were cleared.

### C. Existing planning authority

- [ ] click `Найти варианты` explicitly;
- [ ] inspect deterministic result reasons and exact evidence;
- [ ] Preview a candidate;
- [ ] show nearest-contour exact-gap annotation;
- [ ] Apply explicitly;
- [ ] one Undo removes the full multi-object Apply;
- [ ] Redo restores it;
- [ ] 2D→3D remains consistent;
- [ ] reload persists only applied ordinary transforms, not language/provider state.

### D. Failure and lifecycle

- [ ] invalid key produces a clear error;
- [ ] simulated provider/network failure leaves manual controls fully usable;
- [ ] changing text clears the old review draft;
- [ ] changing manual controls clears stale result/Preview/annotation;
- [ ] closing the panel discards API key and language draft;
- [ ] reopening the project does not restore raw model state.

## 7. Final merge gate

Before marking Ready for Review:

- [ ] representative browser acceptance above passes;
- [ ] any browser findings are fixed with regression coverage;
- [ ] exact final PR head has green strict CI;
- [ ] final PR changed-file inspection still shows no persistence/schema scope expansion;
- [ ] canonical project state/roadmap/changelog are updated with final acceptance evidence.

Before merge:

- [ ] PR #17 marked Ready for Review only after browser PASS;
- [ ] final head verified again;
- [ ] squash merge;
- [ ] merge SHA/date recorded;
- [ ] next narrow milestone chosen from actual user evidence rather than speculative scope.

# M6.4 Reviewed Natural-Language Intent — Acceptance

**Status:** DONE / ACCEPTED / MERGED  
**Date:** 2026-07-30  
**PR:** #17  
**Final feature head:** `d8c35d88ad8e48dc53a156c08bfae60d0530e26f`  
**Final strict CI:** `30553594794` — PASS  
**Squash merge:** `02f8b041341c86f0796011b0d2fd42cac56a4e02`

## 1. Accepted product contract

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

Authority boundaries:

- [x] interpreter output contains no coordinates, placements or direct document mutations;
- [x] object references resolve only against furniture in the selected room;
- [x] exact normalized match precedes unique token-sequence match;
- [x] fuzzy guessing is forbidden;
- [x] ambiguous and unresolved names require an explicit user choice;
- [x] unsupported fragments remain visible and require acknowledgement;
- [x] millimetres are canonical; mm/cm/m inputs normalize explicitly;
- [x] confirmed clauses pass the existing `validatePlanningConstraintSet()`;
- [x] confirmed intent transfers into existing manual controls;
- [x] interpretation never automatically runs the planner;
- [x] Preview remains non-mutating;
- [x] Apply remains explicit and uses existing current-document revalidation/history;
- [x] no `VlezetDocument`, migration, IndexedDB, backup or import changes;
- [x] API key, raw response and review draft remain runtime-only;
- [x] provider/network failure leaves manual planning available.

## 2. Accepted vocabulary

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

```text
RED   09ffe649e235beba3f59515d1f694b6f41fbe3ee
      run 30546883888 — FAIL: missing ./intent-draft
GREEN d765c27c3f63ae7fe1fb34fa4075a2c00faaa7b9
      run 30547202205 — PASS
```

### OpenRouter provider boundary

```text
RED   af3ae1e0392ac483d6874300111f8b20ecacb2e2
      run 30547430331 — FAIL: missing intent schema/provider modules
GREEN 26892574de912591e0bfdd54c405728278536940
      run 30547833919 — PASS
```

### Review and transfer model

```text
RED   97798c2594561f422e0e71579402494402498d4e
      run 30548029175 — FAIL: missing planning-intent-review
GREEN a32a061798b4a169ab36d8d4ad50fb469bc1ca39
      run 30548539161 — PASS
```

### Review UI and planning integration

```text
RED   a175cd6f7fa36ff5a96856db94b6ecc91140cf41
      run 30548815686 — FAIL: missing intent section / slot
GREEN 1220876eca429cbbab2486dad7765b4b41b524b9
      run 30549668157 — PASS
```

### Browser-found responsive polish

The acceptance screenshots exposed a narrow-inspector issue: ordinary labels touched adjacent controls after transfer.

```text
RED   88bbaa64e5ca764b629f1532244fe8b6ebd7b410
      run 30552858007 — FAIL: 2 layout-contract tests
CSS   e5a351c2ea4ea3e710ba5103c215c7b64217a8a2
      run 30553051798 — FAIL: product CSS present; test expectation retained compacted whitespace
GREEN 4980d062d33848a82584881eddeadff70b74a0b1
      run 30553207256 — PASS
```

The correction separates selected-object controls, field labels and furniture-pair cards in the narrow inspector.

## 4. Browser acceptance — PASS

Test room:

- `Диван`;
- `Стул`;
- `Рабочий стол`;
- `Обеденный стол`.

Input:

```text
Диван не двигать, кресло поставить ближе к углу,
между креслом и столом оставить минимум 800 мм.
Стол поставить ближе к окну.
```

Directly evidenced in supplied screenshots and user report:

- [x] `Диван — не двигать` resolved uniquely;
- [x] `кресло` was not guessed as `Стул`; manual selection was required;
- [x] `стол` remained ambiguous between both tables;
- [x] exact minimum gap normalized and displayed as `800 мм`;
- [x] window-relative intent appeared in `Не поддержано`;
- [x] unsupported intent was not silently converted to wall preference;
- [x] explicit choices and acknowledgement enabled transfer;
- [x] transfer selected the intended objects;
- [x] `Диван` received `Не двигать`;
- [x] `Стул` received `Ближе к углу`;
- [x] the selected table↔chair pair received `800 мм` minimum contour gap;
- [x] transfer did not auto-generate alternatives;
- [x] the workflow remained inside the right inspector.

Product-owner confirmation:

> «Работает все четко и ровно так, как ты описал.»

The supplied screenshots did not independently re-exercise every downstream M6.3 action. Preview, nearest-contour evidence, Apply, Undo/Redo and persistence authority remain accepted through unchanged implementation paths, M6.3 browser evidence, scope inspection and the full regression suite.

## 5. Final verification

Final exact PR head:

```text
d8c35d88ad8e48dc53a156c08bfae60d0530e26f
GitHub Actions 30553594794 — PASS
```

Passed:

- [x] frozen install;
- [x] full unit suite;
- [x] TypeScript typecheck;
- [x] ESLint;
- [x] production Next build.

Changed-file inspection confirmed no scope expansion into:

- [x] domain schema or migrations;
- [x] IndexedDB or project format;
- [x] backup/import/export persistence;
- [x] planner/evaluator/M2-fit/Apply/history authority;
- [x] recognition or spatial 3D.

## 6. Integration result

- [x] representative browser acceptance passed;
- [x] browser finding fixed with regression coverage;
- [x] final exact-head CI passed;
- [x] PR #17 marked Ready for Review;
- [x] squash merged to `main`;
- [x] merge SHA recorded: `02f8b041341c86f0796011b0d2fd42cac56a4e02`;
- [x] post-merge canonical state/changelog synchronization started in `docs/m6-4-accepted`;
- [x] no speculative M6.5 feature selected automatically; the next slice requires a separate evidence-driven review.

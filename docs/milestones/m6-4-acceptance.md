# M6.4 Reviewed Natural-Language Intent — Acceptance

**Status:** browser acceptance PASS; implementation and responsive polish pass strict CI; PR #17 may proceed to final exact-head verification, Ready for Review and squash merge.  
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

Accepted authority boundaries:

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

### Review UI and planning-panel integration

```text
RED   a175cd6f7fa36ff5a96856db94b6ecc91140cf41
      run 30548815686 — FAIL: missing intent section / slot
GREEN 1220876eca429cbbab2486dad7765b4b41b524b9
      run 30549668157 — PASS
```

### Browser-found responsive polish

The accepted browser screenshots exposed one non-functional narrow-panel issue: ordinary control labels visually touched adjacent controls after transfer.

```text
RED   88bbaa64e5ca764b629f1532244fe8b6ebd7b410
      run 30552858007 — FAIL: 2 new layout-contract tests
CSS   e5a351c2ea4ea3e710ba5103c215c7b64217a8a2
      run 30553051798 — FAIL: product rules present; one compact-test expectation retained whitespace
GREEN 4980d062d33848a82584881eddeadff70b74a0b1
      run 30553207256 — PASS
```

The correction adds separate grid structure and gaps for:

- selected object name, lock and boundary preference;
- field labels and their controls;
- pair relationship cards;
- long furniture names inside the narrow inspector.

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
- [x] viewport-safe min-content styling is scoped to the existing inspector;
- [x] transferred manual controls retain readable label/card spacing in the narrow inspector.

## 5. Representative browser acceptance — PASS

### Test setup

One axis-aligned rectangular room contained:

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

### Directly evidenced in supplied screenshots and user report

- [x] `Диван — не двигать` resolved uniquely;
- [x] `кресло` was not guessed as `Стул`; the unresolved reference required manual selection;
- [x] `стол` remained explicitly ambiguous between `Рабочий стол` and `Обеденный стол`;
- [x] exact minimum gap normalized and displayed as `800 мм`;
- [x] `Стол поставить ближе к окну` appeared in the `Не поддержано` block;
- [x] unsupported window intent was not silently converted to a wall preference;
- [x] after explicit choices and acknowledgement, `Перенести в ограничения` populated ordinary controls;
- [x] transferred selection contained `Диван`, `Стул` and the explicitly selected table;
- [x] `Диван` received `Не двигать`;
- [x] `Стул` received `Ближе к углу`;
- [x] the selected table↔chair pair received `800 мм` minimum contour gap;
- [x] transfer did not generate alternatives automatically; `Найти варианты` remained a separate action;
- [x] review and transferred controls remained inside the right inspector without horizontal escape.

User acceptance:

> «Работает все четко и ровно так, как ты описал.»

### Inherited authority, not falsely attributed to this screenshot run

The screenshots did not independently demonstrate every downstream action. The following remain accepted through M6.3 browser evidence, unchanged implementation paths, M6.4 scope inspection and the full regression suite:

- non-mutating Preview;
- nearest-contour evidence overlay;
- explicit current-document-revalidated Apply;
- one multi-object Apply = one Undo/Redo step;
- applied ordinary transforms remain the only persistent result;
- provider key, raw response and language draft are not persistent project state.

## 6. Scope and persistence inspection

PR #17 changes only:

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

## 7. Final integration gate

Before Ready for Review:

- [x] representative browser acceptance passes;
- [x] browser-found narrow-panel issue has regression coverage and a fix;
- [x] implementation/polish head `4980d062d33848a82584881eddeadff70b74a0b1` passes strict CI run `30553207256`;
- [x] changed-file inspection shows no persistence/schema scope expansion;
- [ ] acceptance/state documentation head passes final exact-head CI.

Before merge:

- [ ] PR #17 marked Ready for Review;
- [ ] final head verified again;
- [ ] squash merge;
- [ ] merge SHA/date recorded in canonical state and changelog;
- [ ] next narrow milestone selected from actual user evidence rather than speculative scope.

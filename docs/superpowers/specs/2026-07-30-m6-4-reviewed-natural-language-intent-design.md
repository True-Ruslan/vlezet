# M6.4 Reviewed Natural-Language Intent — Design

**Status:** approved for implementation on 2026-07-30  
**Milestone:** M6.4  
**Repository:** `True-Ruslan/vlezet`

## 1. Product goal

Let a user describe already-supported planning intent in ordinary language, convert it into a transparent structured draft, and require explicit review before the existing deterministic planner runs.

M6.4 is an optional translation layer over accepted M6.2–M6.3 planning contracts. It is not autonomous design, a second planner, or a new source of geometry truth.

## 2. Non-negotiable architecture

```text
natural-language request
        ↓ optional interpreter adapter
symbolic intent clauses + unsupported fragments
        ↓ deterministic object-reference resolution
reviewable structured draft + ambiguities
        ↓ explicit user resolution / acknowledgement
existing validatePlanningConstraintSet()
        ↓ transfer into existing manual controls
existing deterministic M6 planner/evaluator
        ↓ Preview / explicit Apply
```

The following rules are mandatory:

1. `VlezetDocument` remains the only persistent apartment/layout source of truth.
2. The interpreter never returns coordinates, placements, candidate rankings or document mutations.
3. Interpreter output is never authoritative.
4. Object references resolve only against objects in the currently selected room.
5. Ambiguous references require explicit user choice; fuzzy guessing is forbidden.
6. Unsupported text remains visible and requires explicit acknowledgement before transfer.
7. Numeric values are normalized explicitly to canonical millimetres.
8. The confirmed draft must pass the existing `validatePlanningConstraintSet()` unchanged.
9. The confirmed draft is transferred into the existing structured planning controls before generation.
10. Planning generation remains a separate explicit user action.
11. Preview remains non-mutating.
12. Apply remains explicit, current-document-revalidated and one semantic Undo/Redo operation.
13. Manual structured planning remains fully available without network access.
14. API keys and raw model responses never enter IndexedDB, autosave, backup, import or `VlezetDocument`.

## 3. Supported language scope

The first slice supports only concepts already represented by `PlanningConstraint`:

- keep one object fixed → `lock-object`;
- prefer one object near a wall → `prefer-room-boundary/wall`;
- prefer one object near a corner → `prefer-room-boundary/corner`;
- prefer two objects nearer or farther → `pair-distance`;
- require an exact minimum contour gap between two objects → `pair-min-gap`.

Example input:

```text
Диван не двигать, кресло ближе к углу,
между креслом и столом оставить минимум 800 мм.
```

Possible symbolic interpretation:

```ts
[
  { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
  {
    kind: "prefer-room-boundary",
    objectRef: "кресло",
    target: "corner",
    sourceText: "кресло ближе к углу",
  },
  {
    kind: "pair-min-gap",
    objectRefs: ["кресло", "стол"],
    minimumMm: 800,
    sourceText: "между креслом и столом оставить минимум 800 мм",
  },
]
```

The interpreter must not silently map unsupported concepts such as `окно`, a named wall side, a door, a passage to a wall, or free-form coordinates to a supported constraint.

## 4. Pure planning-domain contracts

Create framework-independent intent-draft contracts in `@vlezet/planning`.

```ts
export type PlanningIntentClause =
  | Readonly<{
      kind: "lock-object";
      objectRef: string;
      sourceText: string;
    }>
  | Readonly<{
      kind: "prefer-room-boundary";
      objectRef: string;
      target: "wall" | "corner";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-distance";
      objectRefs: readonly [string, string];
      preference: "near" | "far";
      sourceText: string;
    }>
  | Readonly<{
      kind: "pair-min-gap";
      objectRefs: readonly [string, string];
      minimumMm: number;
      sourceText: string;
    }>;

export type PlanningIntentInterpretation = Readonly<{
  clauses: readonly PlanningIntentClause[];
  unsupportedFragments: readonly string[];
  warnings: readonly string[];
}>;
```

The pure layer also owns:

- structural normalization and validation of interpreter output;
- unit normalization for millimetres, centimetres and metres;
- deterministic reference normalization;
- object-reference resolution;
- conversion of a fully resolved draft into ordinary `PlanningConstraint[]`;
- final call to `validatePlanningConstraintSet()`.

## 5. Object-reference resolution

Reference matching is deterministic and fail-closed.

Normalization:

- Unicode NFKC;
- lowercase;
- trim;
- collapse whitespace;
- remove surrounding punctuation;
- Russian `ё` normalizes to `е` for matching only.

Resolution order:

1. exact normalized full-name match;
2. unique full-token-sequence match within an object name;
3. otherwise unresolved or ambiguous.

Examples:

- `диван` uniquely matches `Диван`;
- `рабочий стол` uniquely matches `Рабочий стол`;
- `стол` is ambiguous when both `Рабочий стол` and `Обеденный стол` exist;
- typo-based edit distance or semantic guessing is forbidden.

```ts
export type PlanningObjectReferenceResolution =
  | Readonly<{ status: "resolved"; objectId: string }>
  | Readonly<{ status: "ambiguous"; candidateObjectIds: readonly string[] }>
  | Readonly<{ status: "unresolved" }>;
```

The selected explicit resolution is stored only in ephemeral React state.

## 6. Units and exact values

The interpreter adapter may return explicit value and unit, but the pure normalizer produces canonical millimetres.

Accepted units:

- `mm` / `мм` → ×1;
- `cm` / `см` → ×10;
- `m` / `м` → ×1000.

Rules:

- comma and dot decimal separators are supported;
- values must be finite and non-negative;
- `0` is a valid minimum gap;
- missing, malformed or negative values reject the clause;
- the UI always shows the normalized value in millimetres before confirmation.

## 7. Optional interpreter adapter

The initial provider is a direct, text-only OpenRouter BYOK adapter in `apps/web`.

The adapter receives:

- the natural-language request;
- the names and stable IDs of objects in the selected room;
- the supported clause vocabulary;
- strict instructions to preserve unsupported fragments.

The structured response contains only symbolic clauses, unsupported fragments and warnings. It must not contain final object IDs selected by the model as authoritative references; references are re-resolved locally from `objectRef` text.

Provider requirements:

- runtime-only API key;
- model discovery limited to text models supporting structured output;
- abortable request;
- safe `globalThis.fetch` wrapper;
- categorized error messages;
- strict JSON-schema response;
- tolerant item-level parsing only when malformed items are surfaced as unsupported/diagnostics rather than silently discarded;
- no logging of API key or full user text in persistent diagnostics.

Network/provider failure must leave existing manual controls usable.

## 8. Review UX

Extend the existing planning panel rather than introduce a second planning mode.

### 8.1 Input section

Above the manual constraints:

```text
Опишите пожелания
[ multiline text input ]
[ Разобрать пожелания ]
```

The section includes runtime-only OpenRouter key/model controls consistent with M4.5 BYOK patterns.

### 8.2 Draft review

After interpretation, show each clause with:

- original source fragment;
- interpreted meaning;
- resolved object names;
- explicit select controls for ambiguous references;
- normalized millimetre value for exact gaps;
- a remove action.

Unsupported fragments are shown separately. Transfer is blocked until each unsupported fragment is explicitly acknowledged.

### 8.3 Transfer to ordinary controls

Button: `Перенести в ограничения`.

Enabled only when:

- every object reference is resolved;
- every numeric value is valid;
- every unsupported fragment is acknowledged;
- the resulting selection contains 1–3 objects;
- at least one selected object remains movable;
- `validatePlanningConstraintSet()` succeeds.

Transfer behavior:

- select all referenced objects;
- populate existing lock, wall/corner, near/far and minimum-gap controls;
- clear stale result, Preview and exact-gap overlay;
- do not automatically run planning;
- leave the user on the ordinary structured controls for final inspection.

Manual control changes after transfer remain authoritative and clear any stale generated state exactly as today.

## 9. Ephemeral state and lifecycle

The following are ephemeral component state only:

- natural-language input;
- API key;
- selected model;
- interpretation response;
- object-reference choices;
- unsupported-fragment acknowledgements;
- request loading/error state.

Changing any draft input, resolution or acknowledgement clears stale interpretation-derived validation state. Transferring or editing ordinary controls clears generated result, Preview and active exact-gap overlay.

Closing the panel discards the language draft and key.

No schema, migration, IndexedDB repository, backup or import change is allowed.

## 10. Error behavior

Fail closed with user-visible actionable messages for:

- empty request;
- invalid/missing API key;
- unavailable compatible model;
- network/rate-limit/provider failure;
- malformed structured response;
- unsupported clause kind;
- malformed exact value;
- ambiguous or unresolved object reference;
- duplicate/conflicting constraints;
- more than three referenced objects;
- all referenced objects locked;
- room or furniture becoming stale before transfer.

Errors in the language layer never disable manual structured planning.

## 11. Testing strategy

### Pure package tests

- interpreter-result structural normalization;
- exact and token-sequence reference matching;
- ambiguity and unresolved behavior;
- no fuzzy guessing;
- `ё/е`, punctuation and whitespace normalization;
- unit conversions `800 мм`, `80 см`, `0,8 м`;
- `0`, negative, malformed and non-finite values;
- unsupported fragments preserved;
- resolved draft → exact `PlanningConstraint[]`;
- validation catches conflicts, all-locked and selection overflow.

### Web adapter tests

- strict structured schema request;
- runtime-only key handling;
- successful response normalization;
- malformed response and HTTP error categories;
- abort behavior;
- no image/geometry payload and no direct planner call.

### UI tests

- draft cards and ambiguity selects;
- unsupported acknowledgement gate;
- transfer populates existing controls exactly;
- transfer does not generate candidates;
- language/network failure leaves manual controls operational;
- draft/control changes clear stale result, Preview and active exact pair;
- panel close discards language state;
- no persistence integration.

### Representative browser acceptance

Use a room containing at least `Диван`, `Кресло`, `Рабочий стол` and `Обеденный стол`.

Input:

```text
Диван не двигать, кресло поставить ближе к углу,
между креслом и столом оставить минимум 800 мм.
```

Expected flow:

1. language request produces a reviewable draft;
2. `стол` is explicitly ambiguous;
3. the user selects one table;
4. clauses transfer into visible ordinary controls;
5. no alternatives exist before `Найти варианты`;
6. generation, Preview, exact-gap visualization and Apply work through existing paths;
7. one Undo removes the multi-object Apply;
8. Redo restores it;
9. reload persists only applied ordinary transforms;
10. manual planning remains usable after simulated provider failure.

## 12. Explicit non-goals

- free-form coordinate or geometry generation;
- automatic planning generation after interpretation;
- direct Apply from text;
- autonomous whole-apartment design;
- exact furniture-to-wall/window constraints;
- named wall-side semantics;
- generic open-ended rule language;
- storing conversation/raw model state;
- new persistent planning document;
- opaque model scoring;
- direct 3D editing;
- mandatory network dependency.

## 13. Acceptance gate

M6.4 may be marked ready only when:

1. all focused and full automated suites pass;
2. TypeScript, ESLint and production Next build pass;
3. exact PR head has green GitHub Actions;
4. representative browser acceptance passes;
5. language failure does not regress manual planning;
6. confirmed draft matches visible controls exactly;
7. no persistence/schema changes exist;
8. Preview/Apply/Undo/Redo authority remains unchanged;
9. PR remains Draft until browser acceptance is recorded.

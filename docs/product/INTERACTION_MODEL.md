# Vlezet — Target Interaction Model

**Phase:** M7.0 Product and UX Audit  
**Purpose:** canonical behavioural rules for later M7.x implementation

## 1. Core interaction contract

At every moment the user must be able to answer:

1. What project am I editing and is it saved?
2. What is selected?
3. Which tool or workflow is active?
4. What will the next action change?
5. Is the visible result temporary or applied?
6. How do I cancel, undo or recover?

The interface may be visually compact, but it cannot hide these answers.

## 2. Selection

### Single selection

A click selects the highest-priority semantic entity under the pointer according to one documented hit order. Selection is represented consistently on Canvas and in the context panel.

Target semantic order must be tested with real overlaps and should generally favour:

1. active handles/transient workflow targets;
2. openings and furniture;
3. wall centreline/body;
4. room surface;
5. reference/draft only when its review workflow is active.

The final order is accepted through browser evidence, not assumed solely from source structure.

### Multi-selection

Shift is reserved for supported multi-selection. M7 must not imply multi-selection for entity types that cannot be safely edited together.

When planning selects 1–3 objects, that workflow selection is visually distinguished from ordinary editor selection while still using the same object identity.

### Empty Canvas click

Clicking empty Canvas clears semantic selection but does not silently exit the active creation tool. This preserves intentional repeated wall/opening/furniture work.

### Selection persistence

- changing ordinary selection updates context immediately;
- entering a bounded workflow records the prior semantic context;
- closing the workflow returns to that context when still valid;
- switching 2D/3D may preserve semantic identity where the entity exists in both projections;
- stale/deleted identity clears safely and explains why only when necessary.

### Obscured entities

The design must provide a deterministic route to overlapping entities through hover labels, cycling, a context list or another tested mechanism. Repeated random clicking is not an accepted interaction.

## 3. Tools, commands and workflows

### Exclusive tools

Select, Wall, Door, Window, Furniture placement and Measure are mutually exclusive Canvas tools.

An exclusive tool has:

- visible active state;
- short name and icon/text;
- keyboard shortcut where supported;
- Canvas cursor/affordance;
- concise instruction for the next pointer action;
- explicit cancellation/exit.

### Commands

Undo, Redo, Fit plan, rotate, duplicate, export and similar bounded actions are commands, not modes. They do not remain active.

### Display toggles

Dimensions/reference visibility and representation controls are toggles. They use pressed/selected semantics but are visually separated from creation tools.

### Workflows

Reference import, recognition and planning are multi-step workflows. Each workflow has:

- title;
- current phase;
- prerequisite state;
- primary action;
- back/close rule;
- temporary/persistent state description;
- error/recovery route;
- completion evidence.

A workflow does not silently execute the next high-impact phase.

## 4. Escape hierarchy

Escape is predictable and processes only the highest-priority active transient state:

```text
1. cancel current pointer gesture, drag or incomplete measurement;
2. close a transient popover/dialog or temporary result Preview;
3. exit the active exclusive tool/workflow phase;
4. clear semantic selection only when no higher-priority cancellation exists.
```

Repeated Escape may advance down the hierarchy. One press must not both cancel a tool and clear unrelated selection.

When 3D is active, Escape returns to 2D after closing any 3D-specific transient selection/popover according to the accepted implementation.

## 5. Direct edits versus explicit Apply

### Immediate reversible edits

A property may update immediately when all conditions hold:

- one local deterministic property;
- effect is immediately visible;
- validation is synchronous;
- one Undo restores the previous state;
- the user is not reviewing an externally/generated multi-entity proposal.

Examples may include reference visibility/opacity or simple display toggles.

### Explicit Apply

Apply is required for:

- multiple fields committed atomically;
- wall/room geometry commands with anchors;
- recognition drafts;
- planning alternatives;
- generated/external proposals;
- destructive or high-impact changes where Preview/review matters.

Forms must not mix immediate and explicit commitment without visible grouping and wording.

### Cancel and revert

- a form with Apply preserves the document until Apply;
- Escape/cancel reverts the uncommitted form draft;
- applied changes use Undo rather than a hidden local revert;
- destructive actions state whether Undo is available.

## 6. Preview, Draft and Applied

These are distinct product states.

### Draft

A structured suggestion being reviewed before it can affect trusted geometry.

Examples:

- recognition draft;
- natural-language intent draft.

Required UI:

- explicit `Черновик` status;
- source/origin where relevant;
- editable/accept/reject controls;
- visible unsupported/conflict state;
- no visual equivalence with saved geometry.

### Preview

A temporary visual projection of a proposed applied result.

Examples:

- layout candidate ghost furniture;
- exact witness overlay.

Required UI:

- `Предпросмотр` label;
- temporary visual style;
- Apply and close/cancel;
- stale clearing when inputs/document change;
- no persistence or autosave as ordinary geometry.

### Applied

A committed document change.

Required UI:

- ordinary entity styling;
- save-state transition;
- Undo availability;
- completion evidence near the originating workflow for high-impact actions.

### Canonical visual semantics

Draft, Preview and Applied must use the same names and state roles across recognition, planning, Canvas and documentation. Colour is supplementary, not the only signal.

## 7. Hard rules, soft preferences and recommendations

### Mandatory constraint

User-facing label: `Обязательное ограничение` or compact `Обязательно`.

Meaning: a candidate that violates it is rejected.

Examples:

- do not move;
- minimum contour gap.

### Preference

User-facing label: `Предпочтение` or compact `Желательно`.

Meaning: valid candidates remain possible; the preference changes deterministic ranking.

Examples:

- nearer wall/corner;
- objects nearer/farther.

### Recommendation

Meaning: product guidance about convenience or tightness, not a user-set planning rule and not necessarily invalid geometry.

Examples:

- recommended furniture clearances;
- `Влезает вплотную` fit diagnostics.

The three states use different headings, badges and explanatory patterns. A common-looking checkbox/select must not make their authority appear equal.

## 8. Field and form behaviour

### Labels and units

Every numeric field has:

- visible label;
- unit adjacent to value or included in the control;
- semantic meaning, not internal property name alone;
- helper text only where ambiguity is material.

### Validation

- field-specific errors are associated with the invalid control;
- errors preserve entered values;
- an atomic form may also provide a section summary;
- disabled primary actions explain prerequisites nearby;
- errors do not rely solely on red colour.

### Numeric entry

- accept comma and period decimals where valid;
- display canonical rounding rules;
- distinguish empty optional value from numeric zero;
- preserve millimetres as canonical storage/validation;
- avoid exposing scientific notation or non-finite values.

### Advanced sections

Coordinates, geometry anchors, provider settings and diagnostic details are progressively disclosed. Collapsed sections retain a concise summary of non-default values.

## 9. Destructive actions

Decision model:

| Risk/reversibility | Pattern |
|---|---|
| safe immediate action with Undo | execute; show Undo/history availability |
| removes auxiliary state but preserves apartment | inline confirmation with explicit preserved data |
| irreversible project/data deletion | modal confirmation with project identity and consequence |
| discards generated draft | workflow confirmation only when meaningful review work exists |

Danger actions are visually separated from primary actions and never placed as the accidental default Enter action.

## 10. Status and feedback hierarchy

### Field feedback
For parsing, range and local validation.

### Context notice
For workflow prerequisites, conflicts, stale drafts and recoverable context errors.

### Canvas notice
For topology/spatial issues and active-tool state that directly refers to geometry.

### Global product status
For autosave failure, repository startup/recovery and project-wide export/import failure.

### Toast
For brief non-critical success. Important completion remains visible in the originating context after the toast expires.

### Async state

- use `role=status`/`aria-live` according to urgency;
- announce start only when useful, progress without excessive speech, completion and recovery action;
- loading controls retain stable layout to avoid accidental shifts;
- cancel is available for provider/network tasks where supported.

## 11. Keyboard model

### Global editor

- Undo/Redo;
- tool shortcuts;
- Escape hierarchy;
- clear visible focus;
- no shortcut activation while typing except documented Escape behaviour.

### Canvas alternatives

A complete keyboard-only drawing experience is a larger specialist design. M7.x must at minimum provide:

- keyboard reach to all tools and panels;
- coordinate/numeric alternatives for pointer-only calibration;
- focusable semantic entity navigation where practical;
- announcements/status for selection and active mode;
- no drag-only requirement for a required project-lifecycle task.

### Dialogs and overlays

- initial focus on title/first safe action according to dialog purpose;
- focus trap;
- Escape closes when safe;
- focus returns to invoker;
- destructive confirmation is not the default focus unless explicitly justified.

## 12. 2D/3D consistency

- same entity IDs and names;
- same selected/hover semantic language;
- same inspector component anatomy where possible;
- 3D remains clearly read-only;
- 3D selection never mutates the document;
- 3D failure preserves a visible 2D return path;
- camera controls and fit remain commands/display state, not apartment state.

## 13. Responsive and zoom interaction

At reduced effective width:

1. preserve Canvas minimum useful area;
2. collapse infrequent global utilities;
3. transform context into an accessible drawer/sheet;
4. preserve current selection/tool/workflow state;
5. never discard unsaved form/draft state solely due layout change;
6. show a precise editing limitation only when no safe presentation remains.

A hidden panel with no alternative is not accepted.

## 14. Finding traceability

| Finding | Interaction rule |
|---|---|
| `UX-SHELL-002` | responsive context remains reachable |
| `UX-SHELL-003` | workflow entry/return context |
| `UX-CANVAS-001` | exclusive tool status/next action |
| `UX-CANVAS-002` | semantic selection and obscured-entity path |
| `UX-GEO-001` | visual/ordinary door swing choice |
| `UX-FURN-002` | orientation-linked directional fields |
| `UX-FURN-004` | field-associated validation |
| `UX-REF-001` | explicit commitment grouping |
| `UX-REF-002` | keyboard-equivalent calibration |
| `UX-REC-002` | non-colour readable candidate status |
| `UX-REC-003` | Draft/Preview/Applied model |
| `UX-3D-001` | semantic context consistency |
| `UX-3D-002` | accessible 3D inspection path |
| `UX-PLAN-003` | mandatory/preference/recommendation roles |
| `UX-DATA-001` | readable persistent save status |
| `UX-PATTERN-001` | reversibility-based destruction model |
| `UX-ACCESS-001` | keyboard/focus contract |
| `UX-ACCESS-002` | no functional disappearance at zoom |

## 15. Non-negotiable technical boundary

No interaction redesign may:

- make DOM/Canvas/WebGL authoritative;
- bypass framework-independent validation;
- persist Preview, raw provider responses or runtime API keys;
- silently replace document geometry;
- weaken Apply revalidation or semantic Undo/Redo;
- introduce a second 3D or planning document.

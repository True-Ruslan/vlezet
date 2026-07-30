# Vlezet — Target Information Architecture

**Phase:** M7.0 Product and UX Audit  
**Status:** target architecture; implementation is split into later M7.x slices

## 1. Current composition

```text
ProjectApp
├── loading
├── recovery
├── dashboard
└── ApartmentEditor
    ├── one global horizontal toolbar
    ├── optional furniture catalogue
    ├── 2D Canvas or 3D viewer
    └── one right-side surface
        ├── recognition panel
        ├── reference panel
        └── contextual inspector
            └── planning sub-workflow
```

The current product is functionally coherent but several information levels compete:

- project identity and persistence;
- exclusive Canvas tools;
- display/view options;
- selection context;
- long-running workflows;
- generated proposal review;
- export/history utilities.

M7 does not replace the underlying application architecture. It introduces a stable user-facing hierarchy over it.

## 2. Target model: four stable layers

```text
Global product layer
        ↓
Tool/workflow layer
        ↓
Context layer beside the work surface
        ↓
Canvas feedback layer over the spatial model
```

Each control belongs to exactly one primary layer. Cross-layer duplication is allowed only when it provides a clear shortcut and shares one state.

## 3. Global product layer

### Purpose
Actions that apply to the project or editor session rather than the selected entity.

### Owns

- back to projects;
- project name;
- save state and retry;
- Undo/Redo;
- export/backup;
- global help/settings;
- 2D/3D representation mode;
- overflow for infrequent project utilities.

### Does not own

- wall/door/window creation;
- furniture placement;
- reference/recognition workflow content;
- selected-entity properties;
- planning constraints;
- long explanatory text.

### Target behaviour

The layer remains visible across editor contexts. At reduced width it preserves project/save/history and collapses lower-priority actions into a labelled overflow. No primary action disappears without an accessible replacement.

## 4. Tool and workflow layer

### Purpose
Choose what the next Canvas interaction does or enter a bounded workflow.

### Exclusive Canvas tools

- Select;
- Wall;
- Door;
- Window;
- Furniture placement;
- Measure.

Only one exclusive Canvas tool is active. Active state, next action and Escape path are visible.

### Non-exclusive display actions

- dimensions visibility;
- grid/reference visibility where appropriate;
- fit entire plan.

Display actions must not visually masquerade as exclusive tools.

### Bounded workflows

- Reference plan;
- Recognition;
- Planning.

A workflow has an explicit entry, title, current phase, close/back action and return context. It does not silently replace unrelated selection without preserving a way back.

## 5. Context layer

### Purpose
Show and edit the currently relevant semantic context.

### Context types

```text
CTX-NONE          guidance and next likely actions
CTX-WALL          length/thickness/topology
CTX-ROOM          name/clear dimensions/area/planning entry
CTX-OPENING       door/window dimensions and semantics
CTX-OBJECT        furniture dimensions/fit/actions
CTX-REFERENCE     source plan configuration/import phase
CTX-RECOGNITION   draft review phase
CTX-PLANNING      intent/constraints/results phase
CTX-3D            read-only semantic inspection
```

### Ownership rules

1. Selection context belongs here, not in the global toolbar.
2. Long forms and explanations belong here, not on Canvas.
3. A workflow context may temporarily supersede selection but retains the previous context identity for return.
4. Context navigation uses one shared header anatomy: title, entity/workflow identity, status, back/close.
5. Destructive actions are separated from primary editing actions.
6. Advanced fields use progressive disclosure but remain exact and inspectable.

### Responsive presentation

- desktop: persistent/resizable right panel;
- constrained desktop/high zoom: overlay sheet/drawer anchored to the editor, with Canvas still reachable;
- unsupported narrow editing: project access and read-only information remain reachable; precise editing limitation is explicitly stated.

The current `display:none` removal of context surfaces is not an accepted target.

## 6. Canvas feedback layer

### Purpose
Show only information that is spatially meaningful at the current geometry position.

### Owns

- selected/hover outlines;
- handles;
- snapping guides;
- room/wall dimensions;
- door swing;
- fit/collision cues;
- temporary measurement;
- recognition draft geometry;
- planning Preview ghosts;
- exact witness endpoints/line;
- concise active-tool instruction;
- concise topology/workflow spatial notices.

### Does not own

- full forms;
- API keys/models;
- long explanations;
- project export;
- unrelated warnings;
- persistent data separate from the document.

### Authority

Canvas rendering remains a projection. Numeric evidence delegates to framework-independent geometry. Overlay state remains ephemeral.

## 7. Target editor shell

```text
┌──────────────────────────────── Global product bar ────────────────────────────────┐
│ Back · Project · Saved locally        2D/3D        Export/Help        Undo · Redo │
├────────────── Tool rail/bar ─────────────┬──────────────────────┬──────────────────┤
│ Select / Wall / Door / Window / Measure │      Canvas / 3D     │ Context panel    │
│ Furniture / Reference / Recognition     │      primary area    │ selected/workflow│
│ active tool status                      │      spatial truth   │ progressive form │
└──────────────────────────────────────────┴──────────────────────┴──────────────────┘
```

This is a responsibility diagram, not a pixel-perfect implementation mandate. M7.1 must test horizontal toolbar versus compact rail/bar layouts using real viewports.

## 8. Current-to-target mapping

| Current element | Target ownership | Decision |
|---|---|---|
| Back/project/save | Global product | remain prominent; improve save readability |
| Undo/Redo | Global product | remain visible and stable |
| Export details menu | Global product | regroup by Image vs Project backup |
| Select/wall/door/window/measure | Tool layer | preserve shortcuts and exclusive active state |
| Dimensions | Display action | visually separate from exclusive tools |
| Furniture catalogue toggle | Tool/workflow entry | preserve, add search later |
| Reference/recognition buttons | Workflow entry | preserve but unify navigation/context |
| 2D/3D | Global representation | preserve; align context across modes |
| Document counts | Secondary project status | move to optional info/overflow, not consume core width |
| Selection shortcuts | Contextual hint | show near selection/context, not global competition |
| Furniture catalogue | Supporting panel | resizable/collapsible; reachable at supported widths |
| Wall/room/opening/object inspector | Context layer | unify anatomy and field patterns |
| Reference/recognition panels | Context workflow | unify phases/header/return semantics |
| Planning | Context workflow | split into intent/constraints/results phases |
| Tracing/recognition banners | Canvas status | consolidate into shared active-workflow notice |
| 3D inspector overlay | Context layer or aligned overlay | use same semantic anatomy as 2D |

## 9. Navigation and return context

### Project navigation

Dashboard → project → editor → dashboard remains the main route model. Returning to dashboard flushes autosave before changing mode.

### Context navigation

```text
room selected
→ open planning
→ planning phase
→ close/back
→ same room selected and visible
```

```text
reference context
→ start recognition
→ recognition phase
→ close/back
→ reference or prior selection context according to explicit rule
```

The user must never infer whether closing a panel also cancelled, persisted or discarded a workflow. Each workflow documents its close semantics.

## 10. Progressive disclosure model

### Always visible

- current context title;
- primary status/fit result;
- common dimensions and primary action;
- current tool/workflow phase;
- errors blocking completion.

### Expandable advanced

- Cartesian coordinates;
- exact anchor/alignment mechanics;
- directional clearance tuning;
- provider key/model configuration;
- diagnostic identifiers;
- secondary evidence and technical details.

### Separate destructive area

- delete object/opening/reference/project;
- discard generated draft;
- destructive actions explain Undo/irreversibility.

## 11. Error and feedback placement

| Error scope | Target location |
|---|---|
| one field | associated field error |
| one context/workflow | context notice near affected controls |
| spatial/topology | Canvas notice linked to affected geometry |
| project persistence/global operation | global product bar or recovery surface |
| transient success | toast plus persistent local completion where high-impact |

The same failure is not repeated across Canvas, panel and global toast unless each representation provides distinct actionable value.

## 12. Finding traceability

| Finding | Target architecture response |
|---|---|
| `UX-SHELL-001` | separate global/tool/context ownership |
| `UX-SHELL-002` | responsive context surface, not disappearance |
| `UX-SHELL-003` | shared workflow navigation and return context |
| `UX-ONBOARD-001` | `CTX-NONE` goal-oriented guidance |
| `UX-CANVAS-001` | shared active-tool Canvas status |
| `UX-CANVAS-002` | semantic selection contract and context identity |
| `UX-GEO-002` | grouped context sections and progressive disclosure |
| `UX-FURN-001` | common vs advanced object properties |
| `UX-REF-001` | explicit commitment grouping in workflow context |
| `UX-REC-003` | canonical Draft/Preview/Applied visual state |
| `UX-3D-001` | aligned semantic context across 2D/3D |
| `UX-PLAN-001` | manual deterministic flow primary; provider optional |
| `UX-PLAN-002` | phase-based planning context |
| `UX-DATA-001` | save state in global product layer |
| `UX-DATA-002` | lifecycle-oriented export/restore grouping |
| `UX-DASH-001` | derived project identity/thumbnail on dashboard |
| `UX-PATTERN-001` | risk/reversibility-based destructive patterns |
| `UX-ACCESS-002` | reachable reflow/drawer at zoom and narrow widths |
| `UX-CONTENT-001` | canonical content system across all layers |

## 13. Non-goals

The target IA does not:

- change document schema or geometry semantics;
- create a second editor state;
- make 3D editable;
- add accounts/cloud collaboration;
- remove precise numeric controls;
- require the AI interpreter;
- promise mobile-first editing;
- prescribe one giant shell rewrite.

# M8 — Public Beta Editor Programme Design

**Date:** 2026-08-08  
**Status:** product direction approved; programme design pending written-spec review  
**Target:** public free beta for unfamiliar users  
**Tracker:** #53

## 1. Product decision

Vlezet will reach public beta by becoming a strong manual apartment editor first. Automatic recognition remains useful R&D, but it must not be a dependency for successfully creating a trustworthy apartment plan.

The product is not a general diagram editor and not a simplified CAD clone.

> Vlezet is a strict, millimetre-accurate apartment editor with interaction quality inspired by mature canvas tools, while preserving architectural and physical semantics.

The editor should feel familiar to users who know tools such as Excalidraw or draw.io: predictable pan/zoom, selection, multi-selection, copy/paste, duplication, keyboard commands, direct manipulation and clear context actions. Unlike general diagram tools, Vlezet does not allow visual transformations that destroy real-world meaning.

Examples of preserved semantics:

- a wall remains topological geometry with a physical thickness in millimetres;
- an opening remains attached to a valid host wall;
- a room remains derived from structural geometry;
- furniture dimensions remain physical dimensions, not arbitrary visual scale factors;
- collision, containment, door and clearance validation remain deterministic;
- a graphical group scale operation must never silently convert a 900 mm door into a 747 mm door or a 150 mm wall into a 124.5 mm wall.

## 2. Why the roadmap changes

The automatic M7.8C recognition experiment passed deterministic benchmark gates but failed usefulness acceptance on the original real apartment plan. Local CV still missed visible structure/openings and produced ambiguous geometry; verification-only AI could not recover geometry that local CV never proposed.

That experiment established a product lesson:

> Automation cannot compensate for an editor whose primary manual workflow is not yet fast and polished enough.

The strongest path to beta is therefore:

1. make core editing excellent;
2. make precision drawing excellent;
3. make reference calibration trustworthy;
4. add local reference assistance as an accelerator;
5. deepen furniture and export;
6. harden the complete beta journey.

Automatic full-plan reconstruction remains long-term R&D under #27 and must not block this programme.

## 3. Public beta user contract

The target user is a non-professional apartment owner or buyer who has one of:

- a developer floor-plan image;
- a technical-plan PDF;
- a scan;
- a sufficiently front-facing photograph;
- or only real room dimensions.

The user should be able to open Vlezet for the first time and complete this journey without touching JSON or learning CAD terminology:

```text
Create/open project
        ↓
Import a source plan or start blank
        ↓
Calibrate and verify physical scale
        ↓
Draw/trace exact walls
        ↓
Add doors and windows
        ↓
Edit, select, copy, move and correct geometry
        ↓
Place and edit furniture
        ↓
Understand fit, clearances and room dimensions
        ↓
Export/share a clean result
```

Core editing remains local-first and must not require a network connection.

## 4. Platform scope for first beta

### Primary

Desktop/laptop browser with:

- mouse;
- trackpad;
- keyboard.

### Supported but not parity-gating

Tablet must remain usable for viewing, navigation and basic interaction, but touch-first editor parity is not a prerequisite for the first beta.

### Not a beta blocker

Phone editing parity. A phone may support dashboard/view/export/basic operations, but the desktop editor must not be architecturally compromised to make a full phone CAD-like workflow possible before beta.

## 5. Non-negotiable product authority

Existing project rules remain authoritative:

1. `VlezetDocument` is the sole persistent apartment/layout truth.
2. Millimetres are canonical.
3. Konva and Three.js are projections, never geometry authority.
4. Rooms, areas and presentation geometry remain derived.
5. Semantic Undo/Redo remains command-oriented.
6. Existing topology/opening validation cannot be bypassed by UI gestures.
7. Local editing has no network dependency.
8. AI/CV remains optional assistance and cannot silently replace committed geometry.
9. Preview/selection/viewport/gesture state is runtime state unless a future explicit persistence design proves otherwise.
10. M2 remains containment/collision/door/clearance authority.

## 6. Programme sequence

```text
M8.0  Public Beta Product Contract and roadmap reset
M8.1  Editor Interaction Foundation
M8.2  Precision Drawing and Structural Editing
M8.3  Precision Reference Calibration
M8.4  Assisted Tracing
M8.5  Furniture 2.0
M8.6  Export, Appearance and Presentation
M8.7  Public Beta Hardening
PUBLIC FREE BETA
```

Each slice must produce independently useful, testable software. Later slices may be reordered only through an explicit roadmap update based on product evidence.

## 7. M8.1 — Editor Interaction Foundation

Goal: establish a modern interaction substrate before adding smarter drawing.

Required capabilities:

- unified semantic selection model;
- primary selection plus multi-selection;
- click/toggle/marquee selection;
- capability-aware actions over the selection;
- multi-object movement without changing relative geometry;
- semantic copy/cut/paste/duplicate where safe;
- central command registry shared by shortcuts/context actions;
- predictable mouse/trackpad/keyboard pan and zoom;
- fit-plan and fit-selection;
- clear selection/status feedback;
- no arbitrary structural group scaling.

M8.1 does not need to make every structural entity batch-transformable. It must establish the model and make the first safe multi-object path complete, especially placed furniture. Structural batch editing expands in M8.2.

## 8. M8.2 — Precision Drawing and Structural Editing

Goal: make manual apartment construction substantially faster than the current create-then-edit workflow.

Planned capabilities:

- visible snap guides and named snap intent;
- endpoint, wall-axis, midpoint, intersection, horizontal/vertical, parallel and perpendicular assistance;
- exact inline length entry during wall creation;
- exact angle input/constraint where useful;
- temporary snap suppression modifier;
- direct vertex/endpoint editing;
- topology-safe wall movement and junction editing;
- opening preservation/revalidation during structural edits;
- structural clipboard/batch operations only where dependency closure is valid;
- one semantic Undo/Redo step per committed structural gesture.

No silent topology repair is allowed.

## 9. M8.3 — Precision Reference Calibration

Goal: make the physical scale of imported plans auditable and difficult to set incorrectly.

The current two-point calibration is improved with source-feature accuracy rather than pretending a world grid exists before scale is known.

Planned capabilities:

- calibration pan/zoom;
- strong magnifier/crosshair;
- keyboard nudge;
- snapping to strong source edges, line centres and intersections;
- horizontal/vertical guides;
- fractional image coordinates where browser/raster evidence permits;
- explicit ability to disable source snapping;
- second known-distance verification;
- scale residual/error presentation;
- warning when verification dimensions disagree enough to indicate inaccurate point placement or source perspective/distortion.

The UI must not claim millimetre certainty that the raster resolution cannot support.

## 10. M8.4 — Assisted Tracing

Goal: use local source-image evidence as an additional snap source in the already-good manual drawing flow.

This replaces the idea that Assisted Tracing should be a separate automation-first workflow.

Preferred product model:

> When a calibrated reference is visible, ordinary wall/door/window tools may gain optional high-confidence reference snapping. Ambiguous evidence abstains and ordinary editor snapping continues.

The previously written Assisted Tracing design remains useful input, but implementation waits for M8.1–M8.3.

No AI/network dependency is required for tracing.

## 11. M8.5 — Furniture 2.0

Goal: make furnishing feel like a real planner rather than a small preset demo.

Current hard-coded presets become a parameterised library with useful household coverage. Planned beta categories include:

- beds;
- sofas and armchairs;
- chairs;
- dining/work tables;
- wardrobes, dressers and cabinets;
- kitchen modules;
- refrigerator, hob/stove, oven, dishwasher;
- washing machine and dryer;
- bathtub, shower, toilet and sinks;
- TV/storage units;
- radiators;
- custom physical rectangle/object.

Direct Canvas editing should support, where semantically valid:

- drag;
- physical width/depth resize handles;
- rotation handle;
- live dimensions;
- wall/alignment snapping;
- duplicate;
- multi-selection;
- alignment/distribution.

The inspector remains the precise numeric editor, not the mandatory path for every common adjustment.

Useful specialist actions may later include “align to wall”, “rotate to wall”, “centre on wall” and repeated duplication along an axis.

## 12. M8.6 — Export, Appearance and Presentation

### Export

Introduce a renderer-neutral export scene rather than independent geometry implementations per format.

Target flow:

```text
VlezetDocument + export options
             ↓
         ExportScene
          ↙       ↘
        PNG       SVG
                 ↓
               PDF later if low-risk
```

Public-beta requirements:

- PNG;
- SVG;
- whole plan;
- selected entities/bounds;
- with/without reference;
- transparent background where applicable;
- resolution/quality controls;
- dimensions on/off;
- furniture on/off;
- clearance/use-zone presentation on/off.

### Dark application theme

Application theme and plan appearance are separate concepts.

Dark mode may darken:

- panels;
- toolbars;
- dialogs;
- surrounding workspace.

The canonical architectural sheet/plan remains light and export output must not depend on application theme.

A future separate plan-presentation mode may exist, but decorative plan themes are not beta-critical.

## 13. Semantic visibility instead of arbitrary layers

A general Photoshop-like layer system is not required for beta.

Use semantic visibility/locking instead:

- reference;
- walls;
- openings;
- rooms;
- furniture;
- dimensions;
- clearances/use zones;
- labels.

Reference lock is especially important after calibration so tracing cannot accidentally move the source image.

## 14. Command architecture

The programme should converge common UI actions on one command contract rather than maintaining separate implementations for toolbar buttons, keyboard shortcuts and context menus.

Conceptual command properties:

```text
id
label
shortcut metadata
availability/capability reason
execute
```

Examples:

```text
selection.copy
selection.cut
selection.paste
selection.duplicate
selection.delete
view.fitPlan
view.fitSelection
object.rotate90
wall.setLength
```

Geometry mutation remains in `editor-core`/authoritative store actions. The UI command registry orchestrates those actions; it does not become a parallel geometry engine.

## 15. Context UI direction

Target hierarchy:

```text
Project/global actions
        ↓
Tools         Canvas         Context inspector
        ↓
Canvas status / snap / zoom / coordinates
```

The right inspector shows properties of the current context. Common short actions may also appear in a small contextual toolbar near the current selection, but it must not duplicate mutation logic.

Context menus become a natural secondary surface for commands such as copy, duplicate, rotate, lock and delete.

## 16. Deliberate beta non-goals

Do not delay beta for:

- realtime collaboration;
- mandatory accounts/cloud sync;
- arbitrary diagram shapes;
- arrows/connectors;
- freehand drawing;
- rich text editor parity;
- plugin ecosystem;
- automatic whole-plan reconstruction;
- autonomous AI layout design;
- photorealistic 3D;
- BIM/DXF/DWG workflows;
- arbitrary user layer stacks;
- full phone/tablet editing parity.

## 17. Public beta acceptance journeys

The product is not beta-ready until these journeys are reliable for an unfamiliar user.

### BETA-01 — Blank

Create a small apartment manually with exact wall dimensions, doors and windows without editing JSON.

### BETA-02 — Reference

Import a real plan, calibrate it, verify scale with a second known dimension, trace the structural plan and retain the reference safely locked.

### BETA-03 — Edit

Select one and several entities, move compatible groups, copy/paste/duplicate safe selections, delete/restore through Undo and reproduce the state through Redo without ID/topology corruption.

### BETA-04 — Furnish

Place common furniture/appliances, change physical dimensions and rotation, and understand fit/collision/clearance results.

### BETA-05 — Export

Export the whole plan and a meaningful selection to correct PNG and SVG output.

## 18. Engineering policy — mandatory TDD

Every M8 deterministic behaviour change uses TDD.

Required task cycle:

1. define the behavioural contract;
2. add a focused test that fails for the intended missing behaviour or regression;
3. run it and record genuine RED evidence;
4. implement the smallest production change that satisfies the contract;
5. run focused tests to GREEN;
6. run adjacent/full regression gates;
7. refactor only while tests remain green;
8. commit a reviewable unit of change.

Rules:

- do not weaken existing tests, tolerances, geometry validation or safety thresholds merely to obtain green CI;
- a test that accidentally passes before implementation is not RED evidence and must be corrected before feature code proceeds;
- browser-only behaviour requires real browser tests, not source-string assertions alone;
- exact geometry/history/clipboard rules belong in deterministic unit/property/contract tests where possible;
- Chromium carries the full representative interaction flow;
- WebKit carries representative gesture/storage/input coverage where engine behaviour may differ;
- manual product-owner testing is reserved for genuinely observational UX/real-source evidence and is not a substitute for automatable checks.

## 19. CHANGELOG policy — mandatory

The repository must maintain a clear, chronological and reconstructable history.

Every accepted M8 slice updates:

1. a focused record under `docs/changelog/YYYY-MM-DD-<slice>.md`;
2. `docs/CHANGELOG.md` with a concise canonical entry;
3. `docs/PROJECT_STATE.md` and relevant roadmap documents after acceptance/merge.

Each focused changelog entry must distinguish:

- **Why** — product problem/evidence;
- **User-visible changes**;
- **Architecture/authority changes or explicitly preserved boundaries**;
- **TDD evidence** — meaningful RED/GREEN checkpoints, not every trivial commit;
- **Regressions discovered and fixed**;
- **Intentional non-goals/deferred work**;
- **Automated verification** — exact head, test counts/gates, CI/browser runs/artifacts when relevant;
- **Product-owner acceptance** when required;
- **Merge identity** after protected merge.

Do not write changelog entries that merely say “updated editor” or enumerate commit messages. The changelog must let a future maintainer reconstruct what changed and why.

## 20. Delivery discipline

Every implementation slice follows:

```text
approved design
→ task-by-task TDD implementation plan
→ isolated feature branch / Draft PR
→ RED/GREEN implementation
→ focused regression checks
→ full CI + browser evidence
→ product-owner acceptance where required
→ exact-head protected squash merge
→ canonical state/roadmap/changelog sync
```

A Draft PR may not be marked Ready solely because CI is green. Product acceptance gates defined by the slice remain real gates.

## 21. Current programme decision

`NOW` becomes M8.1 Editor Interaction Foundation after this programme/specification change is reviewed and merged.

Assisted Tracing is intentionally deferred until M8.1–M8.3 establish interaction, precision drawing and trustworthy reference calibration.

Automatic full-plan recognition remains R&D and no longer controls the beta critical path.

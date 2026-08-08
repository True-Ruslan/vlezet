# Vlezet — UX Roadmap

**Phase:** M8 Public Beta Editor  
**Last updated:** 2026-08-08  
**Rule:** trust, precision, interaction quality and complete manual workflows precede cosmetic breadth or speculative automation. Only one implementation slice is `NOW`.

## 1. Prioritisation model

Work is ordered by:

1. document-integrity or incorrect-understanding risk;
2. dependency value for the primary edit/trace/furnish/export journey;
3. reach across users and editor surfaces;
4. frequency of use;
5. automation potential for reliable regression testing;
6. implementation/regression risk;
7. visual polish after interaction correctness.

## 2. Completed UX foundation

```text
DONE
M7.0 Product and UX Audit
M7.1 Editor Shell and Responsive Context
M7.2 Context Inspector Foundation
M7.3 Design System and Content Components
M7.4 Canvas Selection and Mode Feedback
M7.5 Onboarding, Status and Recovery
M7.6 Geometry and Opening Inspector
M7.7 Furniture and Fit Workflow
M7.8A Recognition Benchmark Foundation
M7.8B Source Normalisation and Wall Topology
```

These remain accepted foundations. The new programme does not invalidate them.

## 3. Product evidence that changed the sequence

The automatic M7.8C recognition experiment passed its deterministic benchmark gates but failed product-owner usefulness acceptance on the original apartment plan. Local recognition remained incomplete and AI verification did not recover missing geometry.

This exposed a higher-value dependency:

> An unfamiliar user must be able to create a trustworthy plan manually, quickly and comfortably even when all recognition/AI assistance is unavailable.

Therefore the previous M7.8 recognition continuation and later M7.9–M7.13 order are superseded for the beta critical path.

Automatic recognition remains R&D (#27). Assisted Tracing becomes M8.4 and waits for the editor/calibration foundation.

## 4. Current beta sequence

```text
NOW
M8.1 Editor Interaction Foundation

THEN
M8.2 Precision Drawing and Structural Editing
M8.3 Precision Reference Calibration
M8.4 Assisted Tracing
M8.5 Furniture 2.0
M8.6 Export, Appearance and Presentation
M8.7 Public Beta Hardening

TARGET
Public free beta
```

Programme tracker: #53.  
M8.0 tracker: #55.  
M8.1 tracker: #54.  
M8.2: #56. M8.3: #57. M8.4: #51. M8.5: #58. M8.6: #59. M8.7: #60. Final beta acceptance: #61.

## 5. M8.1 — Editor Interaction Foundation

### User problem

The editor has good domain authority but still behaves like a sequence of specialised single-item forms rather than a mature spatial editor.

Current limitations include:

- selection split into independent single-entity IDs;
- no unified multi-selection;
- no marquee selection;
- no complete multi-object clipboard workflow;
- no rigid batch movement of selected furniture;
- shortcuts are parsed directly rather than sharing one command/capability model;
- wheel always zooms, which is less natural for trackpad navigation;
- no fit-selection command;
- unsupported mixed operations do not yet have one explicit capability model.

### UX goal

Make navigation and common editing operations predictable enough that a user can focus on the apartment rather than on editor mechanics.

### Interaction contract

Selection:

- click replaces selection;
- Shift/Cmd/Ctrl click toggles membership;
- drag from empty Canvas creates a marquee;
- plain marquee replaces;
- Shift marquee adds;
- Cmd/Ctrl+A selects concrete editable entities while respecting native text-input Select All;
- rooms/vertices are excluded from default marquee/select-all in M8.1;
- single selection retains accepted single-entity inspectors;
- multiple selection shows dedicated summary/actions.

Safe batch editing:

- one/many placed objects can move rigidly;
- relative geometry remains invariant;
- one object acts as group snap anchor;
- commit is one semantic command;
- unsupported mixed/structural batch transforms are disabled rather than partially applied;
- group graphical scale is always unavailable.

Clipboard:

- one/many placed objects support Copy/Cut/Paste/Duplicate;
- pasted/duplicated objects receive fresh IDs;
- relative geometry and physical dimensions remain exact;
- paste uses last Canvas pointer, otherwise viewport centre;
- repeated paste and duplicate use deterministic +200 mm/+200 mm offsets;
- each paste/duplicate/cut is atomic in semantic history;
- structural clipboard is intentionally M8.2.

Navigation:

- ordinary wheel/two-finger delta pans;
- modified wheel/trackpad pinch zooms around pointer;
- Space + primary drag pans;
- middle-button drag pans;
- `+/-`, actual size, fit plan and fit selection use registered view commands;
- view changes never create geometry history.

A minimal right-click context menu is included as a presentation of the same command registry. Floating selection toolbar is deferred.

### UX acceptance

M8.1 must be demonstrably faster and less surprising in a browser, not merely architecturally cleaner.

Representative browser flow covers multi-select, marquee, rigid batch move, copy/paste/duplicate, context commands, Undo/Redo, wheel pan, modified-wheel zoom, Space/middle pan, fit-plan/selection and native text-control shortcuts.

## 6. M8.2 — Precision Drawing and Structural Editing

Primary UX goal:

> draw exact apartment structure with fewer inspector round-trips.

Planned:

- named visible snap guides;
- endpoint/axis/midpoint/intersection/parallel/perpendicular snaps;
- inline exact wall length;
- useful angle constraints/input;
- direct endpoint/junction dragging;
- topology-safe wall movement;
- structural clipboard/batch operations only with explicit dependency closure;
- opening preservation/revalidation;
- one semantic history command per gesture.

## 7. M8.3 — Precision Reference Calibration

Primary UX goal:

> make scale setup auditable rather than visually approximate.

Planned:

- pan/zoom while calibrating;
- strong magnifier/crosshair;
- source edge/line-centre/intersection snapping;
- keyboard nudge;
- fractional source coordinates where justified;
- second known-distance verification;
- residual/error display;
- source distortion/perspective warning;
- explicit source/reference lock after successful setup.

Before calibration there is no authoritative world scale, so calibration cannot honestly snap to a millimetre world grid. It must snap to source features instead.

## 8. M8.4 — Assisted Tracing

Primary UX goal:

> make ordinary drawing faster over a calibrated reference without creating a second editor mode that guesses the whole apartment.

- normal wall/door/window tools remain primary;
- reference assistance is an optional extra snap source;
- user intent and existing topology outrank source-image assistance;
- ambiguous source evidence abstains;
- no network/AI dependency required.

Tracker: #51.

## 9. M8.5 — Furniture 2.0

Primary UX goal:

> furnish a normal apartment without fighting a small demo catalogue or form-only transforms.

Planned:

- parameterised useful household catalogue;
- broader appliance/sanitary coverage;
- direct physical resize/rotation on Canvas;
- live dimensions;
- better wall/alignment snapping;
- multi-selection alignment/distribution;
- exact inspector remains available;
- specialist wall-relative actions where they materially improve repeated placement.

## 10. M8.6 — Export, Appearance and Presentation

Primary UX goal:

> turn a finished plan into a clean reusable output.

Required beta direction:

- PNG and SVG;
- whole document and selection;
- reference on/off;
- dimensions/furniture/zones presentation controls;
- transparent background where applicable;
- high-resolution raster export;
- renderer-neutral export scene so formats do not drift semantically.

Application theme is independent of plan appearance. Dark UI may surround a canonical light plan sheet; export is independent of UI theme.

## 11. M8.7 — Public Beta Hardening

Owns beta-wide:

- accessibility closure;
- responsive/compact desktop hardening;
- performance profiling of common editor gestures;
- error/recovery polish;
- onboarding/help/shortcut discoverability;
- documentation and beta release checklist;
- final BETA-01…BETA-05 browser/product acceptance.

## 12. Beta journeys

### BETA-01 — Blank
Create a small exact apartment manually with walls, doors and windows.

### BETA-02 — Reference
Import a real source, calibrate, verify scale and trace it reliably.

### BETA-03 — Edit
Multi-select, move, copy, paste, duplicate and Undo/Redo without semantic corruption.

### BETA-04 — Furnish
Place/edit representative household furniture/appliances and understand fit/conflicts.

### BETA-05 — Export
Export correct whole-plan and selection PNG/SVG.

## 13. Interaction principles

1. Familiar canvas gestures are preferred where they do not conflict with apartment semantics.
2. Physical dimensions are never arbitrary visual scale.
3. A disabled/unsupported operation is better than a silent partial mutation.
4. One user gesture produces one semantic history operation when committed.
5. Transient previews may be rich; committed geometry remains deterministic.
6. Ordinary editing works without network access.
7. Context controls, shortcuts and menus converge on one command implementation.
8. Selection, viewport and transient gesture state remain runtime-only.
9. Browser behaviour is part of the product contract and is tested as browser behaviour.

## 14. Mandatory TDD policy

Every deterministic M8 interaction change uses genuine RED → GREEN → regression/refactor.

- test the exact missing behaviour/regression first;
- verify failure for the expected reason;
- add minimal correct production behaviour;
- run focused GREEN and adjacent/full regressions;
- do not lower validation/thresholds or weaken accepted tests for green CI;
- use real Chromium tests for pointer/keyboard/layout flows;
- use representative WebKit coverage for engine-sensitive gesture/input/storage behaviour.

## 15. Mandatory CHANGELOG policy

Every accepted M8 UX slice has a focused changelog and canonical changelog entry containing:

- problem/evidence;
- final interaction semantics;
- architecture/authority boundaries;
- meaningful TDD RED/GREEN evidence;
- browser regressions/fixes;
- intentional deferrals;
- exact-head CI/browser evidence;
- explicit product-owner acceptance when required;
- final merge SHA.

Do not replace this with commit-title lists or vague “editor improvements”.

## 16. Original M7 UX finding coverage

The M7.0 finding ledger remains part of repository history and must not disappear when roadmap priorities change.

| Finding | Current ownership/status |
|---|---|
| `UX-SHELL-001` | M7.1 — complete |
| `UX-SHELL-002` | M7.1 — complete |
| `UX-SHELL-003` | M7.2 — complete |
| `UX-SHELL-004` | M7.4 — complete |
| `UX-SHELL-005` | M7.3 — complete |
| `UX-CANVAS-001` | M7.4 foundation complete; M8.1 deepens mature selection interaction |
| `UX-CANVAS-002` | M7.4 foundation complete; M8.1 deepens navigation/selection interaction |
| `UX-ONBOARD-001` | M7.5 — complete; final beta discoverability revisited in M8.7 |
| `UX-GEO-001` | M7.6 — complete; M8.2 adds direct precision editing |
| `UX-GEO-002` | M7.6 — complete; M8.2 adds direct precision editing |
| `UX-GEO-003` | M7.6 — complete; M8.2 adds direct precision editing |
| `UX-FURN-001` | M7.7 foundation complete; M8.5 Furniture 2.0 |
| `UX-FURN-002` | M7.7 foundation complete; M8.5 Furniture 2.0 |
| `UX-FURN-003` | M7.7 foundation complete; M8.5 Furniture 2.0 |
| `UX-FURN-004` | M7.3/M7.7 foundation complete; M8.5 catalogue/direct manipulation depth |
| `UX-REF-001` | M7.8 source workflow foundation; M8.3 calibration + M8.4 tracing |
| `UX-REF-002` | M8.3/M8.7 |
| `UX-REC-001` | recognition product path de-emphasised; #27 R&D + M8.4 bounded assistance |
| `UX-REC-002` | M8.7 for any beta-visible residual recognition surface |
| `UX-REC-003` | #27 R&D; M8.4 only bounded reference assistance |
| `UX-REC-004` | M7.3 foundation; any residual beta presentation owned by M8.4/M8.7 |
| `UX-3D-001` | accepted M5 foundation; deeper 3D readability moved post-beta unless evidence reprioritises |
| `UX-3D-002` | M8.7 only for beta-critical accessibility; deeper 3D work post-beta |
| `UX-3D-003` | post-beta unless beta evidence reprioritises |
| `UX-PLAN-001` | accepted M6 foundation; simplification post-beta unless beta evidence reprioritises |
| `UX-PLAN-002` | post-beta unless beta evidence reprioritises |
| `UX-PLAN-003` | accepted M6 foundation; residual simplification post-beta |
| `UX-PLAN-004` | post-beta unless beta evidence reprioritises |
| `UX-DATA-001` | M7.1 — complete |
| `UX-DATA-002` | project lifecycle refinement post-beta unless release evidence requires M8.7 action |
| `UX-DATA-003` | M7.5 — complete |
| `UX-DASH-001` | dashboard refinement post-beta unless release evidence requires M8.7 action |
| `UX-DASH-002` | dashboard refinement post-beta unless release evidence requires M8.7 action |
| `UX-PATTERN-001` | M7.2 — complete |
| `UX-PATTERN-002` | M7.3 — complete |
| `UX-PATTERN-003` | M7.3 — complete |
| `UX-ACCESS-001` | M8.7 public-beta hardening |
| `UX-ACCESS-002` | M7.1 foundation; residual beta closure M8.7 |
| `UX-CONTENT-001` | M7.2/M7.3 — complete; beta discoverability review M8.7 |

Changing the critical path does not mark unresolved findings complete. Items explicitly moved post-beta remain visible here and can be promoted only by evidence-driven roadmap updates.

## 17. Programme safeguards

No M8 UX slice may:

- create a second persistent geometry truth;
- make UI/Canvas geometry authoritative over `VlezetDocument`;
- bypass topology/opening/M2 validation;
- make network/AI availability necessary for core editing;
- silently apply an operation to only part of a mixed selection;
- claim product acceptance solely from green automated checks.

# M8.0 Public Beta Product Contract — acceptance

**Date:** 2026-08-08  
**Status:** PRODUCT OWNER ACCEPTED / AWAITING PROTECTED MERGE  
**PR:** #62

## Accepted decision

The product owner explicitly approved both the M8 Public Beta Editor programme and the committed M8.1 Editor Interaction Foundation implementation plan.

The public-beta critical path is therefore:

```text
M8.0  Public Beta Product Contract / roadmap reset
M8.1  Editor Interaction Foundation
M8.2  Precision Drawing and Structural Editing
M8.3  Precision Reference Calibration
M8.4  Assisted Tracing
M8.5  Furniture 2.0
M8.6  Export, Appearance and Presentation
M8.7  Public Beta Hardening
PUBLIC FREE BETA
```

Automatic whole-plan recognition remains R&D and is not a beta release gate.

## Architecture preserved

- `VlezetDocument` remains the sole persistent document truth.
- Millimetres remain canonical.
- Rooms remain derived.
- Openings remain host-validated.
- M2 remains fit/collision/door/clearance authority.
- Selection, clipboard, viewport and gesture state remain runtime-only unless a later explicit design proves otherwise.
- AI/CV remains optional and non-authoritative.
- Arbitrary graphical scaling of structural geometry remains forbidden.

## M8.1 authorization

The separate product-owner instruction authorizes execution of the exact implementation plan at:

`docs/superpowers/plans/2026-08-08-m8-1-editor-interaction-foundation.md`

Implementation may begin only after this M8.0 checkpoint is integrated and a fresh `feat/m8-1-editor-interaction-foundation` branch is created from the accepted `main` head. Every deterministic behaviour change must follow genuine RED → observed intended failure → minimal GREEN → regression/refactor.

## Merge evidence

Exact accepted PR head, required checks and protected squash-merge identity are intentionally filled only after GitHub completes the final exact-head verification and merge.

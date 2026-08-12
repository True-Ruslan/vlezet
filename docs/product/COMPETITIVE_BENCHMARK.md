# Vlezet — Competitive Product Benchmark

**Checked:** 2026-08-12  
**Purpose:** keep Vlezet product planning anchored to proven market expectations instead of feature invention in isolation.  
**Primary parity benchmark:** RoomPlan.  
**Secondary references:** Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner and magicplan.

## 1. Benchmark rule

Vlezet must not copy competitors mechanically. It must reach or exceed the interaction quality and useful floor-planning coverage that ordinary users already expect from mature products while preserving Vlezet's stricter architectural guarantees:

- `VlezetDocument` remains the only persistent geometry/layout truth;
- millimetres remain canonical;
- rooms remain derived;
- openings remain validated and hosted on structural walls;
- M2 remains containment/collision/door/clearance authority;
- structural edits remain atomic and fail closed;
- manual editing remains a complete product path without AI/network dependence;
- AI/CV may accelerate work but may not become geometry authority.

"Not worse than RoomPlan" therefore means **parity of the important user journey and interaction quality**, not line-by-line feature cloning and not immediate parity in catalogue size or photorealistic rendering breadth.

## 2. Market baseline

| Capability | RoomPlan | Planner 5D | Floorplanner | RoomSketcher | Planoplan | RemPlanner | magicplan | Vlezet direction |
|---|---|---|---|---|---|---|---|---|
| Precise manual 2D plan editing | strong | strong | strong | strong | strong | strong | strong | beta-critical |
| Walls / doors / windows | yes | yes | yes | yes | yes | yes | yes | authoritative structural core |
| Direct manipulation | yes | yes | yes | yes | yes | yes | yes | beta-critical |
| 2D + 3D | yes | yes | yes | yes | yes | limited/product-specific | yes | deterministic shared-document projection |
| Walkthrough / virtual visit | yes | yes | yes/tours | Live 3D | yes | not primary | 3D/project sharing | post-core priority |
| Large furniture/material catalogue | 1200+ furniture / 1900+ materials advertised | 8k–10k+ item catalogue advertised depending product surface | very large catalogue; official current pages advertise 150k–260k+ models/items | full furniture/material workflow | 8k+ items/materials advertised | repair/documentation oriented | field/sketch oriented | scalable catalogue architecture first, breadth later |
| Background/blueprint tracing | plan-driven workflow | upload/template/recognition | manual editor | trace + AI Convert | substrate upload | plan workflow | scan/manual | M8.3–M8.4 |
| AI floor-plan conversion | not core benchmark | yes | layout automation, not primary recognition benchmark | AI Convert → editable project | not primary | not primary | sensor capture rather than image AI | optional assisted input, never authority |
| Export | image / print / 3D model | renders/share | 2D/3D, PDF/FML/DXF at higher levels | 2D/3D/share | JPG/PNG/SVG + professional docs | drawings/estimate | PDF/SVG/JPG/PNG/DXF/IFC/OBJ/USDZ depending workflow | PNG/SVG/PDF first, structured/3D later |
| Multi-floor | supported in product examples | supported | supported | supported | supported | repair-plan dependent | supported | after core beta if not already covered by document model |
| Professional documentation | moderate | presentation oriented | presentation/export oriented | professional floor plans | strong | very strong | reports/estimates | deliberate post-beta expansion |
| Mobile capture / LiDAR | no primary differentiator | mobile ecosystem / scan directions | web-first | app workflow | desktop app | web-first | major differentiator | future optional capture channel |

The table records **product direction**, not procurement claims. Catalogue counts, subscription packaging and export limits change frequently and must be re-checked before using them in release/marketing decisions.

## 3. RoomPlan — primary parity floor

Official product material currently emphasizes:

- plan drawing from real apartment dimensions;
- walls, windows and doors;
- editable object dimensions and materials;
- 2D/3D workflow and virtual walkthrough;
- furniture, appliance, lighting and decor catalogue;
- large material catalogue;
- project export as image, printable output and 3D model.

Sources:

- https://roomplan.ru/
- https://roomplan.ru/kak-sozdat-plan-kvartiry-v-roomplan.php
- https://roomplan.ru/kak-rabotat-s-mebelju-v-roomplan.php

### Product lessons for Vlezet

1. **Direct manipulation must be ordinary, not exceptional.** Users expect to drag walls, furniture and wall-hosted openings directly.
2. **Precision belongs near the pointer.** Distances and dimensions should be visible during manipulation, with inspectors available for exact numeric correction.
3. **2D and 3D must describe the same project.** Users should never wonder whether 3D has separate state.
4. **Furniture/material breadth matters only after the editor is comfortable.** Catalogue breadth does not compensate for weak selection or drag semantics.
5. **Export is part of the planning journey.** A plan that cannot be cleanly reused outside the editor is incomplete.

### Minimum RoomPlan parity contract for public-beta trajectory

Before Vlezet can claim practical parity for the ordinary apartment-planning journey, it needs:

- reliable direct wall/vertex/room structural editing;
- direct hosted door/window movement constrained by structural validity;
- predictable mixed selection and rigid selected-group movement;
- exact cursor-anchored Copy/Paste/Duplicate semantics;
- useful furniture catalogue with direct resize/rotate/move and measurements;
- calibrated reference-plan tracing;
- clean 2D export;
- coherent deterministic 3D projection;
- no obvious selection-label-overflow or gesture-routing failures in common workflows.

Large material/catalogue counts and photorealistic presentation are **not** required to finish M8.2 and must not distract from interaction correctness.

## 4. Planner 5D — accessibility + AI + multi-device benchmark

Current official pages emphasize:

- easy 2D/3D editing;
- walls, doors/windows and drag-and-drop furniture;
- templates and Smart Wizard;
- large catalogue;
- materials/textures;
- 3D rendering and walkthroughs;
- upload/recognition of existing plans;
- web, mobile and desktop ecosystem.

Sources:

- https://planner5d.com/use/room-planner-tool
- https://planner5d.com/use/floor-plan-software
- https://planner5d.com/ai/floor-plan-to-3d-model

### Lessons

- AI is valuable because the recognized result remains **editable in the normal editor**.
- onboarding must make blank-plan creation and imported-plan correction equally understandable;
- cross-device strategy is useful later, but a strong shared document/domain core must precede platform breadth.

## 5. Floorplanner — scale, catalogue and output benchmark

Current official pages emphasize:

- accurate room/wall/door/window drawing;
- real-time 3D;
- very large shared 3D catalogue;
- Room Wizard / Magic Layout assistance;
- multi-floor project levels;
- high-resolution 2D/3D output, 3D tours and structured FML/DXF export at higher levels.

Sources:

- https://floorplanner.com/
- https://floorplanner.com/basic
- https://floorplanner.com/project-levels
- https://floorplanner.com/fml

### Lessons

- catalogue infrastructure must scale independently from editor geometry;
- assisted layout can be layered above deterministic editing rather than replacing it;
- a structured external representation can become valuable once the internal model is mature;
- export/view configuration deserves its own product surface rather than ad-hoc screenshot behavior.

## 6. RoomSketcher — editable conversion benchmark

Current official product material supports a particularly relevant workflow:

> scan/draw/trace/AI-convert → receive a digital editable plan → refine furniture/materials/measurements → use 2D/3D/Live 3D/share outputs.

AI Convert accepts computer-created plan images/PDFs and converts walls, doors and windows into a normal editable RoomSketcher project. RoomSketcher also retains manual tracing and manual drawing paths.

Sources:

- https://www.roomsketcher.com/online-product-sheet/
- https://www.roomsketcher.com/features/ai-convert/
- https://help.roomsketcher.com/hc/en-us/articles/31885247016605-Can-AI-Create-My-Floor-Plan-Use-RoomSketcher-s-AI-Convert-Feature
- https://www.roomsketcher.com/features/live-3d-floor-plans/

### Lessons

This validates Vlezet's post-M7.8 recognition decision: **recognition quality is not allowed to determine whether the product is useful**. Manual correction is the durable product path; AI conversion is only an accelerator.

## 7. Planoplan — professional 2D/3D/documentation benchmark

Planoplan currently exposes separate 2D, 3D and Walk modes, substrate tracing, snapping, floors, technical documentation, materials, renders, wall elevations, specifications and configurable plan export. Its export tooling allows content visibility, color schemes, rotation and JPG/PNG/SVG output.

Sources:

- https://planoplan.com/en/
- https://planoplan.com/en/help-center/documentation/project-creation/operating-modes/
- https://planoplan.com/en/help-center/documentation/2d-work/uploading-a-substrate/
- https://planoplan.com/en/help-center/documentation/2d-work/exporting-a-plan/
- https://planoplan.com/en/help-center/documentation/3d-work/wall-elevations/

### Lessons

- advanced export needs explicit presentation controls;
- technical documentation can be derived from one authoritative geometry model;
- substrate visibility/calibration and drawing should remain understandable separate concepts;
- wall elevations/specifications are valuable later, after core editor parity.

## 8. RemPlanner — renovation documentation benchmark

RemPlanner is relevant not as the primary interaction benchmark but as a future renovation-output benchmark: work drawings, quantity/estimate calculations and contractor-oriented artifacts.

Source:

- https://remplanner.ru/
- https://remplanner.ru/planner/smeta/

### Lessons

Future Vlezet differentiation may extend beyond furniture layout into trustworthy renovation documentation, but this must be derived from stable geometry and must not be pulled into the current M8 critical path.

## 9. magicplan — capture/export benchmark

magicplan's differentiator is field capture: AR/LiDAR scanning, manual/laser-assisted measurements, direct sketch refinement and broad professional export/report formats. Its current export documentation includes 2D formats such as PDF/SVG/JPG/PNG/DXF and 3D/structured formats such as IFC/OBJ/USDZ depending workflow/subscription.

Sources:

- https://magicplan.app/product/sketch
- https://magicplan.app/blog/lidar
- https://help.magicplan.app/export-formats
- https://help.magicplan.app/magicplan-floor-plan-editor-faq

### Lessons

- mobile sensor capture is a credible future input channel;
- generated geometry must still be editable;
- measurement provenance/accuracy should remain visible rather than assumed;
- broad export interoperability becomes strategically useful after model stability.

## 10. UI/UX benchmark rules for implementation reviews

Every new editor interaction should be reviewed against these expectations before implementation is accepted:

1. **Selection is visible and unambiguous.** A user can tell exactly what will move/copy/delete.
2. **Dragging an already selected group moves the group.** Clicking one selected member must not silently collapse or dead-end the gesture unless a higher-priority explicit handle/action owns the pointer.
3. **Specialized handles outrank generic group drag.** Resize/rotate/vertex/opening-specific controls must remain predictable.
4. **Wall-hosted openings move on their host wall by default.** No silent re-hosting across walls.
5. **Dimension feedback stays near the edited geometry.** Inspector-only precision is insufficient for repeated spatial work.
6. **Names/areas/dimensions never make the Canvas unreadable.** Labels need deterministic wrapping/ellipsis/hiding priority.
7. **Clipboard placement follows the user's spatial intent.** Pointer/cursor anchoring is preferred over arbitrary offsets.
8. **Modes are explicit.** Pan/select/draw/place/recognition review should never become hidden modal state.
9. **Invalid structural actions fail visibly and atomically.** No partial mutation, silent repair or mysterious no-op.
10. **Undo/Redo reflects one user intent.** Composite structural/furniture operations remain one semantic history step.

## 11. Roadmap consequences

The benchmark changes priority, not architecture:

- **M8.2** becomes the Direct Manipulation Foundation and may not be accepted while common selected-composite drag or hosted-opening movement is missing/broken.
- **M8.3** remains Precision Reference Calibration.
- **M8.4** remains Assisted Tracing, explicitly modeled after the market pattern of editable converted/traced geometry rather than opaque recognition output.
- **M8.5** expands into Furniture + Materials 2.0: scalable catalogue, direct manipulation, stronger snapping/alignment, parameterised objects and material groundwork.
- **M8.6** expands into Export + Presentation parity: PNG/SVG, likely PDF after vector export, visibility/style controls and deterministic 2D/3D presentation.
- **post-beta** work may add stronger walkthrough/presentation, multi-floor depth, professional documentation/estimates and mobile sensor capture.

## 12. Review cadence

This benchmark is living product evidence.

Before designing a material new editor capability:

1. inspect this document;
2. inspect at least one relevant mature commercial UX flow;
3. inspect relevant open-source architecture where licensing permits study;
4. record what behavior is being adopted, intentionally improved or intentionally rejected;
5. preserve Vlezet architecture/validation boundaries even if a competitor is looser;
6. update this benchmark when a market observation materially changes the roadmap.

The goal is not to chase competitors feature-by-feature. The goal is to avoid rediscovering solved interaction problems while retaining Vlezet's stronger deterministic semantics.
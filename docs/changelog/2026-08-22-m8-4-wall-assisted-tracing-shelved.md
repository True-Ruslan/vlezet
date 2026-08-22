# 2026-08-22 — M8.4 Wall Assisted Tracing shelved; core/UX direction reset

**Status:** product-direction correction. M8.4 wall-only Assisted Tracing is **not accepted, not merged, and is deliberately shelved as R&D evidence**, following the same protocol as the M7.8C automatic-recognition decision. Draft PR #94 is closed without merge. No production behavior is claimed by this record.

## Why

Product-owner testing of M8.4 on a real apartment plan (2026-08-22, third real-plan attempt across the milestone) reproduced the same class of defect that caused the first two real-plan FAILs (2026-08-18, 2026-08-19; see `docs/changelog/2026-08-19-m8-4-second-real-plan-fail.md`):

- source-image assistance snapped a traced exterior-corner wall fragment to the wall's **edge** face, not its **centre axis**, even though `collapseOutlinePair` (`apps/web/components/reference/wall-source-feature-reader.ts`) exists specifically to derive the centreline from a paired outer/inner edge detection;
- the visible "По подложке" feedback was reported as present but not clearly perceptible during ordinary tracing.

## Root-cause finding

Reading `wall-source-feature-reader.ts` shows `collapseOutlinePair` requires a clean local pair of parallel edge/line-centre features on one axis to compute a centreline; near an architectural corner this pairing degrades and the code falls back to a single raw `edge` feature — i.e. exactly the wall's face, not its axis. This is not a new failure mode: the M8.4 commit history already contains three separate prior corrective rounds targeting the same class of problem (`prefer bounded wall corner evidence`, `preserve balanced architectural corner evidence`, `cluster antialiased wall edge responses`), each of which passed its own RED→GREEN regression yet the corner case has now failed a real plan for the third time. This is read as evidence that deterministic, non-AI pixel-level wall-axis derivation is architecturally hard to make reliable specifically at corners — the exact geometry most real apartment plans are made of — rather than a single remaining bug.

## Market validation check

`docs/product/COMPETITIVE_BENCHMARK.md` (RoomPlan, Planner 5D, Floorplanner, RoomSketcher, Planoplan, RemPlanner, magicplan) was re-read specifically for this decision. Finding: **no benchmarked competitor performs live pixel-level snap-to-underlay assistance during manual wall drawing**, which is the specific mechanism M8.4 attempts:

- RoomPlan's own published instructions describe plain manual wall drawing with no underlay-pixel assistance step at all;
- Floorplanner and RoomSketcher offer image-to-plan assistance only as a **one-shot AI conversion** (upload → fully-formed editable plan → user corrects normally), never as a continuous snap during manual tracing.

M8.4's live-snap approach is deliberately not AI-based (per project rule: "Optional LLM interpretation cannot generate authoritative coordinates or bypass validation"), which means it has no proven market playbook to follow — Vlezet would be the first of its own benchmark set to attempt this exact mechanism.

## Precedent

This mirrors the M7.8C automatic-recognition outcome already recorded in `docs/PROJECT_STATE.md` §5: a deterministic pixel/heuristic assistance layer failed real product usefulness acceptance more than once on the same root-cause class (incomplete/ambiguous structural geometry), and was deliberately moved out of the beta-critical path while its implementation was preserved as R&D evidence. M8.4 wall-only tracing is the same pattern recurring at the single-wall scale.

## Decision

- M8.4 (wall-only Assisted Tracing) is shelved: not accepted, not merged, not on the active beta-critical path.
- Draft PR #94 is closed without merge. Branch `feat/m8-4-wall-assisted-tracing` is preserved (not deleted) as R&D evidence, matching how PRs #42/#44/#45 were handled for M7.8C.
- The accepted M8.3 calibration substrate is unaffected and remains available: users can still manually trace a calibrated reference image by eye, which is the same baseline RoomPlan itself ships.
- Hosted door/window source assistance (previously blocked pending M8.4 wall acceptance) is now out of scope entirely, not merely blocked.
- Product priority resets to: strong core structural/editing behavior and best-practice interaction/UI/UX quality first; additional functionality (including any future revisit of image-assisted tracing) only after that core is solid.

## What is not affected

- M8.1, M8.2, M8.3 remain accepted, merged and unaffected.
- The Delete/Backspace honest-feedback fix (PR #95) and the dependency-security patch (PR #96) are unrelated to this decision and remain merged on `main`.

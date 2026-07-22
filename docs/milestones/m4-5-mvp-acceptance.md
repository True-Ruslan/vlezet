# M4.5 — Assisted Recognition MVP acceptance

**Date:** 2026-07-22
**Status:** Accepted as MVP / assisted experimental feature
**PR:** #6 `feat: M4.5 assisted recognition`

## Product acceptance

Final real-user feedback on the current RC:

> Recognition has become better, but it is not perfect. Further work is now refinement rather than a blocker for the MVP.

Decision:

- M4.5 is accepted as a working MVP of assisted recognition;
- the feature must continue to be described as **assisted / experimental recognition**, not automatic floor-plan reconstruction;
- recognition quality is good enough to be useful as an acceleration layer for tracing, provided every candidate remains reviewable and explicitly applied;
- imperfect accuracy, noisy candidates and model-to-model variance are recorded as a post-M4.5 quality backlog;
- broader validation on representative real developer/realtor/BTI plans is still required;
- deterministic geometry validation, explicit Apply, existing-geometry protection and one-step Undo/Redo remain non-negotiable safety boundaries.

## What is considered complete for M4.5

- local OpenCV/Web Worker recognition pipeline;
- editable persistent `RecognitionDraft` separate from `VlezetDocument`;
- review/edit/accept/reject flow;
- optional OpenRouter BYOK refinement;
- local/cloud reconciliation and semantic sanity filtering;
- deterministic apply into ordinary Vlezet walls/openings;
- duplicate-existing protection;
- one applied recognition batch = one semantic Undo/Redo operation;
- stale draft protection by reference revision and recognition engine version;
- project startup isolation from optional recognition restore;
- runtime-only provider secrets and recognition-session exclusion from backup/duplicate/import;
- strict CI on the final RC line.

## Known limitations intentionally carried forward

Recognition still requires more detailed testing and quality work:

1. wall candidates may be slightly misaligned or incomplete;
2. openings may contain false/noisy hypotheses;
3. topology/junction reconstruction is not reliable enough for automatic reconstruction;
4. cloud model quality varies significantly;
5. some plans may still require substantial manual review or tracing.

These limitations are not treated as reasons to delay M4.6, because M4.5 never grants recognition authority over project geometry.

## Post-M4.5 recognition quality backlog

Future recognition work should be evidence-driven:

1. build a representative corpus of real floor-plan fixtures;
2. define measurable wall/opening/topology quality metrics;
3. tune preprocessing and local CV against those fixtures;
4. improve line merging and junction reconstruction;
5. rank supported cloud models by measured quality/cost;
6. strengthen semantic validation using fixture failures;
7. consider custom ML only if metrics justify it.

## Roadmap decision

M4.5 is considered an MVP milestone and should be closed so product development can move to the higher-priority user trust problem:

```text
M4.5 Assisted Recognition — MVP accepted; quality refinement continues later
        ↓
M4.6 Precision Geometry UX — next primary product milestone
        ↓
M5 Spatial 3D
        ↓
M6 Intelligent Planning
```

The immediate M4.6 goal is to make wall dimensions, thickness, anchors, room area and measurement semantics understandable and predictable for non-CAD users.

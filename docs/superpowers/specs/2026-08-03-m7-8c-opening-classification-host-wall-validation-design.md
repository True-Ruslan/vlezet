# M7.8C — Opening Classification and Host-Wall Validation Design

**Date:** 2026-08-03
**Status:** APPROVED FOR IMPLEMENTATION
**Branch:** `feat/m7-8c-opening-classification-host-wall-validation`

## 1. Goal

Turn local wall-gap evidence into safe, reviewable door/window hypotheses that are attached to an existing local wall and cannot corrupt wall topology, room derivation, history or persistence.

M7.8C must improve opening recognition without turning AI into geometry authority or silently applying uncertain geometry.

## 2. Product contract

The user may receive three opening classes:

- `door` — local geometric evidence supports a door-sized gap plus door-specific symbol evidence;
- `window` — local geometric evidence supports a window-sized gap plus window-specific cross/parallel evidence;
- `unknown-opening` — a real gap may exist, but the type is not safely classifiable.

Every opening must reference one surviving local wall candidate. A hypothesis without a valid host wall, outside the wall span, overlapping another opening, touching a junction/corner exclusion zone or exceeding the review budget must fail closed.

Only explicit Apply may mutate `VlezetDocument`. Ambiguous hypotheses remain pending or rejected.

## 3. Selected architecture

### 3.1 Pure recognition package authority

Add a framework-independent opening-analysis module in `packages/recognition`.

Inputs:

- local wall candidates;
- source raster dimensions;
- detected line segments;
- bounded classification/placement options.

Outputs:

- classified `RecognitionOpeningCandidate` values;
- diagnostics explaining accepted, pending and rejected hypotheses;
- deterministic counts for benchmark/debug evidence.

The module must not depend on React, Next.js, Konva, Three.js, IndexedDB or OpenRouter.

### 3.2 Pipeline

```text
wall candidates + source segments
→ derive bounded wall-gap hypotheses
→ validate host-wall identity
→ project center and endpoints onto host wall
→ enforce in-span and junction margins
→ classify door/window/unknown
→ detect overlap/conflicts
→ calibrate confidence
→ editable RecognitionDraft
→ explicit Apply
```

### 3.3 Host-wall validation

For each hypothesis:

1. resolve `hostWallCandidateId` against the current wall set;
2. reject zero-length and non-finite host geometry;
3. project the opening center onto the host segment;
4. require perpendicular distance within a thickness-aware tolerance;
5. require opening endpoints to remain inside the host span;
6. reserve a corner/junction margin at both wall ends;
7. reject duplicate or materially overlapping openings on the same wall;
8. preserve the host wall ID and local coordinates through reconciliation.

No nearest-wall guessing after the original host identity is lost.

## 4. Classification

Classification uses bounded explainable features rather than opaque scoring:

- gap width relative to source scale and wall thickness;
- angled or arc-like segments near the gap for doors;
- short perpendicular or paired parallel segments for windows;
- continuity of wall-edge evidence on both sides;
- distance from wall ends and junctions;
- conflicting symbol evidence.

`unknown-opening` is a successful fail-closed result, not an error.

Initial confidence policy:

- `high` is prohibited in the first M7.8C implementation;
- `medium` requires valid host placement plus one type-specific evidence family;
- `low` is used for unknown or conflicting evidence;
- invalid-host and out-of-span hypotheses are rejected rather than returned as applicable geometry.

## 5. AI boundary

OpenRouter may confirm/reject the type of an existing local opening candidate and adjust evidence/confidence within bounds.

It may not:

- create an opening;
- change host wall ID;
- move center or endpoints;
- change width beyond deterministic tolerance;
- attach an opening to a different wall;
- revive a rejected invalid-host hypothesis.

Unknown IDs, changed geometry, cloud-only openings and overloaded responses fail closed.

## 6. Draft and persistence

- `RecognitionDraft` remains separate from `VlezetDocument`.
- Existing project schema, migrations, IndexedDB and portable backup formats remain unchanged.
- Candidate IDs remain ephemeral per recognition result.
- Repeated checks preserve decisions only for equivalent surviving candidates.
- Engine version changes only if runtime output shape or restore compatibility requires it; otherwise it remains `5`.

## 7. Review UX

The review surface must show:

- type: door/window/unknown;
- host wall identity in user-facing terms, not raw internal emphasis;
- width and placement evidence;
- confidence reasons;
- conflict/rejection reason;
- direct highlight between candidate card and Canvas geometry.

Bulk acceptance must exclude unknown, conflicted or invalid-host candidates.

## 8. Testing and acceptance

### Unit/TDD

- valid door and window classification;
- unknown classification for ambiguous gaps;
- missing/unknown host rejection;
- center outside wall rejection;
- opening endpoints outside host span rejection;
- end/junction margin rejection;
- duplicate/overlap rejection;
- deterministic ordering and IDs;
- stale-decision cleanup after repeated checks;
- AI geometry/host mutation rejection.

### Benchmark

Expand the opening-heavy and service-block coverage and preserve:

- door/window F1 target `>= 0.85` before final M7.8C acceptance;
- unknown-host accepted openings: `0`;
- out-of-span accepted openings: `0`;
- stale decisions: `0`;
- incorrect high-confidence candidates: `0`.

### Browser

Chromium full recognition review and WebKit representative smoke must verify Draft, edit/review, explicit Apply and one-step Undo.

## 9. Non-goals

- room-face derivation;
- OCR, room labels or area reconciliation;
- perspective correction;
- authoritative AI geometry;
- whole-apartment autonomous reconstruction;
- unrelated M7.9+ UI, 3D, planning or dashboard work.

## 10. Delivery slices

1. Pure opening hypothesis and host-validation contract.
2. Runtime local-engine integration with fail-closed diagnostics.
3. Reconciliation/OpenRouter hardening for immutable host and geometry.
4. Review UX and Canvas evidence.
5. Benchmark expansion and product-owner acceptance.

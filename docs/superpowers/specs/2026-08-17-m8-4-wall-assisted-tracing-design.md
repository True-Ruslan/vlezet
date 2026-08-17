# M8.4 — Wall Assisted Tracing Design

**Date:** 2026-08-17  
**Status:** Product Owner approved for implementation  
**Base:** `main` at `f2a671bc6c34df484c92bc86286a57d7339c9059`  
**Tracker:** #51

## 1. Decision

M8.4 starts with a **wall-only vertical slice**. Doors/windows remain out of this first delivery and will consume the same provider only after the wall slice is accepted.

Assisted Tracing is not a second editor and not whole-plan recognition. It is an optional, local, deterministic source-image snap provider inside the ordinary wall tool.

The user remains authoritative. Source evidence may move only the current ephemeral wall draft when evidence is strong and unambiguous. Accepted output is ordinary editable `VlezetDocument` geometry committed through the existing editor history path.

## 2. Product contract

When a calibrated visible reference is available and source assistance is explicitly enabled:

1. the pointer is mapped from world space into source-image space with the accepted M8.3 `worldPointToImage()` transform;
2. the existing M8.3 bounded source-feature pipeline analyzes only a local patch near that source point;
3. the existing deterministic source snap resolver applies minimum-strength, ambiguity and hysteresis rules;
4. an acquired source point is mapped back with the accepted M8.3 `imagePointToWorld()` transform;
5. existing high-authority topology snaps still win;
6. when source evidence abstains, current structural/grid/manual behavior is unchanged;
7. exact numeric wall input remains authoritative over source assistance;
8. commit still creates one ordinary semantic wall command; Undo/Redo remains one step.

No network/AI call, persistence change, schema migration or second transform is permitted.

## 3. Authority and precedence

The practical precedence is:

```text
explicit exact wall input / user wall intent
> existing topology targets
> high-confidence source-image assist
> construction guides / grid / manual fallback
```

For this slice, **topology targets** are existing-document attachment semantics: endpoint, junction, midpoint, intersection and wall-axis. These are stronger than source-image evidence.

Construction-only results — horizontal, vertical, parallel, perpendicular and grid — are fallback guidance and may be replaced by an acquired source-image candidate. This distinction is required because current `resolveStructuralSnap()` always offers a grid candidate while snapping is enabled; treating every structural result as stronger would make Assisted Tracing unreachable.

If assistance is Off, suppressed, unavailable, outside reference bounds, weak or ambiguous, the exact existing structural result is used unchanged.

Alt/Option suppresses source assistance and retains the existing editor suppression behavior for ordinary snapping.

## 4. Accepted M8.3 substrate

M8.4 must reuse, not duplicate:

- `worldPointToImage()` and `imagePointToWorld()` from `packages/geometry/src/reference-plan.ts`;
- `readCalibrationFeaturesFromImage()` from `apps/web/components/reference/calibration-image-features.ts`;
- `resolveCalibrationSnap()` and its hysteresis/ambiguity contract from `apps/web/components/reference/calibration-snap.ts`;
- calibrated `ReferencePlan.transform` as the only source/world transform authority.

The older tracker wording `worldToSourceImagePoint()` / `sourceImageToWorldPoint()` is obsolete and must not be implemented as aliases or a parallel API.

## 5. Provider boundary

Add one shared runtime provider module under the reference boundary, for example:

```text
apps/web/components/reference/reference-source-assist.ts
```

Its pure resolution contract accepts:

- raw world point;
- accepted reference transform and source dimensions;
- deterministic source features near the mapped source point;
- editor pixels-per-millimetre;
- active source candidate id for hysteresis;
- enabled/suppressed flags.

It returns an ephemeral result containing:

- acquired/not acquired;
- candidate id/kind;
- source point;
- world point;
- reason: acquired / ambiguous / none / disabled / suppressed / outside-reference.

The source-screen scale passed to M8.3 snap resolution is:

```text
editor pixels per mm × reference mm per source pixel
```

No hand-written rotation or origin arithmetic is allowed.

## 6. Source feature policy

The first slice deliberately reuses the proven M8.3 local feature reader rather than introducing a second image-analysis stack.

Initial policy uses the existing bounded feature shape and conservative thresholds. Source assistance should prefer evidence already represented by M8.3 as line centres/intersections; edges may participate only through the existing deterministic resolver and minimum-strength threshold.

A local source read failure is enhancement-only failure: clear the source assist and continue with ordinary wall behavior.

## 7. Wall-tool integration

The wall pointer path remains in `EditorCanvas`.

For each wall draft update:

1. calculate the current ordinary structural snap exactly as today;
2. if it resolves to an existing topology target, keep it and clear source-assist feedback;
3. otherwise, if source assist is eligible, query the local source provider using the raw world pointer;
4. if a high-confidence source point is acquired, use it instead of construction/grid fallback;
5. if source assist abstains, use the previously computed ordinary structural result byte-for-byte;
6. apply exact length/angle input afterwards through the existing `resolveWallDynamicDraft()` path;
7. never synthesize a topology target from image evidence;
8. commit through the existing `updateDraftWall` / `commitDraftWall` history path.

The first slice does **not** infer wall thickness. That historical idea is intentionally deferred: position assistance must prove itself on real plans before source evidence is allowed to change wall material properties.

## 8. Runtime/UI contract

Source assistance is runtime-only and defaults **Off**.

A visible keyboard-reachable toggle is added to the ordinary editor toolbar when a reference exists:

```text
По подложке: выкл / вкл
```

Requirements:

- real button with `aria-pressed`;
- disabled when no reference exists or editing is unavailable;
- no project persistence/schema field;
- state resets to Off on a fresh app runtime;
- Alt/Option temporarily suppresses an enabled assist.

While an acquired source candidate drives the wall preview, the canvas shows explicit ephemeral feedback such as `По подложке`. Ambiguous/no-evidence states do not create geometry and ordinary feedback remains available.

## 9. Failure semantics

Fail closed to manual behavior:

- no reference / hidden reference / missing decoded image → ordinary behavior;
- pointer outside source bounds → ordinary behavior;
- feature read error → ordinary behavior;
- weak feature → ordinary behavior;
- ambiguous feature → ordinary behavior;
- Alt/Option suppression → ordinary behavior;
- reference revision or asset changes → active source candidate is cleared;
- exact numeric input overrides the source-driven point as already defined by the wall dynamic-input contract.

No source failure may block wall creation.

## 10. Testing contract

### Provider unit tests

Must prove:

- exact M8.3 world→source→world transform reuse, including non-zero rotation;
- high-confidence source candidate acquisition;
- ambiguity abstention;
- minimum-strength abstention;
- disabled/suppressed/outside-reference fail-closed behavior;
- active-candidate hysteresis;
- deterministic repeated calls.

### Precedence unit tests

Must prove:

- endpoint/junction/midpoint/intersection/wall-axis beat source assist;
- acquired source assist beats horizontal/vertical/parallel/perpendicular/grid fallback;
- source abstention returns the existing structural result unchanged;
- assistance Off returns the existing structural result unchanged.

### Editor/UI tests

Must prove:

- toolbar toggle defaults Off and exposes `aria-pressed`;
- no reference disables source assist control;
- source assist does not alter committed schema;
- one wall commit remains one semantic Undo/Redo command;
- leaving/replacing reference clears ephemeral acquired state.

### Browser acceptance

Chromium full flow and representative WebKit must cover:

1. import/calibrate a deterministic generated reference fixture;
2. choose Wall;
3. enable `По подложке`;
4. acquire visible source assistance on a strong line centre;
5. commit the wall;
6. create a topology-connected wall and prove topology wins;
7. suppress assistance with Alt/Option and observe ordinary behavior;
8. disable assistance and create an ordinary wall;
9. Undo/Redo semantic wall edits;
10. assert no page/runtime/console error and no tracing network dependency.

No browser retry, skip/fixme, coverage-threshold weakening or validator relaxation is acceptable.

## 11. Acceptance boundary

The wall-only slice is not considered done merely because CI is green.

Required sequence:

```text
implemented → deterministic tests GREEN → browser acceptance GREEN
→ Product Owner real-plan acceptance → protected merge → post-merge verification
```

Only then may M8.4 proceed to hosted door/window assistance.
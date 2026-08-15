# M8.3 Precision Reference Calibration — Design

**Date:** 2026-08-15  
**Status:** APPROVED ENGINEERING DESIGN / IMPLEMENTATION NOT YET ACCEPTED  
**Tracker:** #57  
**Base:** verified `main` `394e8f42ae226562f3d7d8db590813ac959e4aa0`

## 1. Product goal

Make imported-plan scale difficult to set incorrectly and easy to inspect before M8.4 Assisted Tracing.

M8.3 improves the existing one-distance calibration workflow; it does **not** create a new plan authority, automatic whole-plan recognition path or second editor.

The user must be able to:

1. zoom/pan the source image while calibration points stay in exact natural-image coordinates;
2. place/nudge endpoints precisely;
3. optionally snap calibration endpoints to high-confidence source-image features;
4. enter one authoritative known real distance;
5. independently verify that scale with a second known distance;
6. see residual/error evidence and an explicit distortion/inconsistency warning;
7. save a normal `ReferencePlan` only after the primary calibration is valid.

## 2. Existing authority preserved

Current architecture is already suitable:

- `packages/geometry/src/reference-plan.ts` owns image↔world similarity-transform math;
- calibration points are stored in **natural source-image pixels**, not rendered CSS pixels;
- `apps/web/components/reference/calibration-viewport.ts` owns client/container↔source-image projection;
- `reference-service.ts` persists the calibrated transform and existing primary calibration and already saves new references with `display.locked = true`;
- `VlezetDocument` remains unrelated to source-image calibration authority.

M8.3 keeps these boundaries.

### Persistent state

No schema migration is planned.

Persistent authority remains the existing `ReferencePlan`:

```text
source raster identity
+ natural width/height
+ primary calibration { pointA, pointB, knownLengthMm, alignment }
+ resulting transform { originWorld, millimetersPerPixel, rotationDeg }
+ display state
```

### Ephemeral state

The following remain calibration-UI/runtime state and are **not** persisted:

- calibration viewport pan/zoom;
- pointer hover/magnifier state;
- source-feature candidate list;
- active snap candidate and temporary snap suppression;
- selected calibration handle;
- keyboard-nudge focus state;
- optional second verification segment and its known length;
- residual/error/confidence presentation;
- warning acknowledgement for an inconsistent source.

Reason: none of these are required to reconstruct the calibrated apartment/reference transform. Persisting them would create schema/version work without adding geometry authority.

## 3. Coordinate model

Three coordinate spaces are explicit:

```text
client coordinates      browser pointer position
container coordinates   calibration viewport UI
image coordinates       natural raster pixels — calibration authority
```

Viewport transform:

```text
image -> container = image * renderScale * zoom + pan
container -> image = inverse of the same transform
```

Requirements:

- image coordinates may be fractional;
- round-trip must be deterministic within floating-point tolerance;
- pan/zoom may never mutate `CalibrationDraft.pointA/pointB`;
- changing zoom around a pointer anchor must keep that source point under the same client position;
- rendered marker/magnifier positions derive from image coordinates every frame.

## 4. Pan and zoom interaction

Calibration gets its own local navigation rather than reusing editor-world navigation.

- ordinary wheel/trackpad pans the source viewport;
- modified wheel zooms around the pointer anchor, matching the accepted editor convention where practical;
- middle-button drag and Space+drag pan;
- `Fit` restores a deterministic fit-to-viewport transform;
- zoom is clamped to a practical range so the source cannot disappear or become numerically unstable;
- viewport navigation creates no project/history command.

Pointer placement and pan gestures must not compete: a gesture has one owner from pointer-down.

## 5. Magnifier, crosshair and keyboard nudge

The existing magnifier is strengthened rather than replaced.

- crosshair is centred on the exact natural-image point;
- magnifier displays fractional source coordinates while dragging/hovering;
- endpoint markers are focusable semantic controls, not only visual spans;
- arrow keys nudge the focused endpoint in source pixels;
- default nudge = 1 source pixel;
- `Shift+Arrow` = 10 source pixels;
- no nudge may move a point outside raster bounds;
- nudge and pointer movement go through the same snap resolver unless snap is explicitly suppressed.

## 6. Source-image snapping authority

World grid is explicitly **not** a calibration snap source because millimetre authority does not exist until calibration is established.

M8.3 source snapping is deterministic and local-only. It may use raster evidence to propose source-image points, but user intent remains stronger.

Candidate vocabulary:

```ts
type CalibrationSourceFeature = {
  kind: "edge" | "line-center" | "intersection";
  point: Point2;      // natural-image coordinates
  strength: number;   // deterministic normalized evidence, not AI confidence
};
```

Resolver rules:

1. consider candidates inside a screen-space acquisition radius converted to image-space using current zoom;
2. deterministic priority: `intersection > line-center > edge` when distances are materially equivalent;
3. otherwise nearest valid high-strength candidate wins;
4. hysteresis keeps an acquired candidate until the pointer leaves a wider release radius;
5. ambiguity between materially equivalent candidates abstains rather than jumping unpredictably;
6. holding Alt/Option suppresses source snapping for the current gesture only;
7. a visible control can disable source snapping for the current calibration session;
8. snapping changes only the proposed image point; it never changes known length, transform, document geometry or source raster.

Initial feature extraction must be deterministic and testable on synthetic raster fixtures. No LLM, OpenRouter or network path is allowed.

## 7. Primary scale and second-distance verification

The existing primary measurement remains authoritative for the saved scale:

```text
primaryScale = primaryKnownLengthMm / primaryPixelDistance
```

The second measurement is independent evidence only.

For verification segment `V`:

```text
predictedLengthMm = verificationPixelDistance * primaryScale
residualMm        = predictedLengthMm - verificationKnownLengthMm
relativeError     = abs(residualMm) / verificationKnownLengthMm
```

This is intentionally easier to explain than averaging two scales: the product shows how well the **chosen primary scale** predicts another known dimension.

### Confidence states

The UI exposes three truthful states:

- **not-verified** — only the primary known distance exists;
- **verified** — second known distance is consistent with the primary scale;
- **warning** — measurements disagree materially, suggesting inaccurate endpoints, bad source dimensions, scan/photo perspective or non-uniform image distortion.

Initial warning threshold:

```text
relativeError > 1% AND abs(residualMm) > 20 mm
```

Rationale:

- relative-only thresholds overreact on short dimensions;
- absolute-only thresholds underreact on long dimensions;
- the combined threshold avoids claiming sub-source precision while still surfacing apartment-scale errors.

This threshold is a product warning threshold, **not** a claim that the source or Vlezet is accurate to 1%/20 mm.

If evidence later shows this threshold is poorly calibrated, changing it requires a focused contract/test update; it must never drift silently.

### Save semantics

- second verification is recommended but not mandatory because valid blueprints frequently provide only one reliable known length;
- a warning does not silently block import of an imperfect historical scan;
- saving with `warning` requires an explicit `Сохранить несмотря на расхождение` acknowledgement in the current calibration session;
- no acknowledgement is needed for `not-verified` or `verified`;
- the saved reference remains locked by the existing `display.locked = true` behavior;
- warning/verification state itself remains ephemeral in M8.3.

## 8. UX evidence from mature products

Current official product guidance reviewed on 2026-08-15:

- RoomSketcher scales an uploaded blueprint by placing a scale bar on one known length and entering the real value: https://help.roomsketcher.com/hc/en-us/articles/213842649-How-Can-I-Draw-a-Floor-Plan-from-a-Blueprint
- RoomSketcher’s AI-convert troubleshooting explicitly treats an incorrect known measurement as a scale failure and tells users to choose a clear measurable element: https://help.roomsketcher.com/hc/en-us/articles/35537884534429-Why-Didn-t-My-AI-Convert-Work
- Planoplan uses a source-image section with movable endpoints and explicitly recommends the longest practical reference object for better accuracy: https://planoplan.com/de/help-center/documentation/2d-work/uploading-a-substrate/
- magicplan requires a known measurement before imported-plan digitization and warns that scale cannot be changed later in that workflow: https://help.magicplan.app/import-and-digitalize-an-existing-floor-plan

Adopted:

- explicit movable reference segment;
- known real dimension as user authority;
- encourage a long clear reference segment;
- strong correction/verification before tracing.

Deliberately stronger in Vlezet:

- independent second-distance residual;
- visible distortion/inconsistency warning;
- deterministic source-feature snapping;
- editable/reviewable local-first calibration rather than opaque AI scale inference.

Copied external code: **none**.

## 9. Testing contract

M8.3 is P1 user-critical interaction plus critical geometry math where changed geometry code is touched.

### Pure geometry

- primary scale prediction of independent dimensions;
- signed/absolute residual and relative error;
- verified/warning threshold boundary cases;
- degenerate/invalid verification inputs fail closed;
- existing image↔world transform round-trip stays unchanged.

### Viewport

- fit transform;
- client/container/image round-trip under pan+zoom;
- pointer-anchored zoom invariance;
- deterministic pan;
- nudge/clamp behavior.

### Source snapping

Synthetic high-contrast raster fixtures must prove:

- edge acquisition;
- line-centre acquisition;
- intersection priority;
- screen-space radius across zoom levels;
- hysteresis;
- ambiguity abstention;
- Alt/Option suppression.

### Browser

Real Chromium + registered representative WebKit flows must prove:

- pan/zoom does not move image-space calibration endpoints;
- magnifier/crosshair follows delivered pointer coordinates;
- keyboard nudge updates a focused endpoint;
- source snap can acquire and be temporarily suppressed;
- primary calibration can be verified by a second known distance;
- inconsistent second distance produces a visible warning;
- warning requires explicit acknowledgement before save;
- final reference persists through the production repository and reloads normally;
- page/runtime errors remain fatal to the browser test;
- workers=1, retries=0.

## 10. Explicit non-goals

- changing `VlezetDocument`;
- new IndexedDB/project schema version;
- automatic dimension-text OCR;
- perspective rectification/warping;
- AI/LLM calibration;
- automatic whole-plan recognition;
- saving source-feature candidates;
- averaging multiple dimensions into a hidden fitted scale;
- claiming survey/architectural precision from raster evidence.

## 11. Acceptance boundary

M8.3 is accepted only when:

1. genuine RED evidence exists for new geometry/viewport/snap/browser behavior;
2. production implementation is minimal and authority-preserving;
3. focused tests and full CI are GREEN under the current testing policy;
4. Chromium complete discovery and representative WebKit are GREEN with retries 0;
5. no schema migration, threshold weakening, hidden AI/network dependency or silent calibration repair is introduced;
6. focused changelog and canonical truth are synchronized;
7. product owner explicitly accepts the real calibration workflow.

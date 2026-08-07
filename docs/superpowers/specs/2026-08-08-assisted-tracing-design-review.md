# Assisted Tracing design self-review clarifications

**Date:** 2026-08-08  
**Normative companion to:** `2026-08-08-assisted-tracing-design.md`

The design self-review found no scope split or architectural contradiction. The following details are made explicit before implementation planning.

## 1. Pure analysis boundary

`reference-trace-assist.ts` is **React-, DOM- and editor-state-independent** pure TypeScript. It consumes only numeric raster data and immutable input values and returns a deterministic candidate or `null`.

`reference-trace-raster.ts` is the narrow browser adapter that may use `createImageBitmap`, Canvas2D and `ImageData` to decode the local reference into luminance data. DOM/browser APIs must not leak into `reference-trace-assist.ts`.

## 2. Source/raster scale contract

`sourceToRasterScale` means the uniform multiplier from source-image coordinates to analysis-raster coordinates:

```ts
rasterPoint = sourcePoint * sourceToRasterScale
sourcePoint = rasterPoint / sourceToRasterScale
```

The rasterizer must preserve aspect ratio and use one uniform scale for X and Y. Tests must verify this contract for both unscaled and downscaled references.

## 3. Current-wall gesture metadata is ephemeral

The first assisted endpoint may produce axis and thickness evidence needed to evaluate the second endpoint. That metadata belongs to `EditorCanvas` runtime gesture state only.

It must **not**:

- extend the persisted project schema;
- extend `VlezetDocument`;
- become part of a recognition Draft;
- become a durable field of editor `DraftWall`.

It is cleared on wall commit, wall-draft cancel, tracing exit, tool change away from wall, reference removal/replacement, and reference-revision change.

When the first endpoint was not source-assisted, the second endpoint may still use ordinary Vlezet angle/grid/topology snapping; reference assistance must not invent an expected source axis from uncertain evidence.

## 4. Thickness compatibility

An assisted thickness is passed to the single wall-create command only if both endpoint observations are source-assisted, share the same source axis, and their physical thickness estimates agree within the implementation plan's fixed deterministic tolerance.

If position evidence is usable but thickness evidence is missing or inconsistent, the centreline assistance may still be used while wall thickness falls back to the existing ordinary editor default/current behavior.

## 5. Window-gap evidence

For a user-selected `window`, “low occupancy” means a reduction in **full structural-band occupancy** across the host, not necessarily a blank white interval. Thin window rails/symbol lines may cross the candidate interval and must not automatically make it structural wall material.

The helper still abstains unless the host has strong structural support on both sides and there is one clearly preferred bounded interval near the pointer.

## 6. No unresolved placeholders

There are no `TBD`/`TODO` requirements in the approved scope. Numerical thresholds for local image scoring are implementation constants to be derived against deterministic synthetic cases and the product-owner source plan without weakening fail-closed behavior. Thresholds must be named, bounded and covered by tests rather than hidden magic numbers.
import { worldToScreen, type Point2, type ViewportTransform } from "@vlezet/geometry";
import type { LinearDimensionAnnotation } from "./dimension-annotations";

export type ScreenDimensionGeometry = Readonly<{
  measuredStart: Point2;
  measuredEnd: Point2;
  dimensionStart: Point2;
  dimensionEnd: Point2;
  labelPoint: Point2;
}>;

export function projectDimensionAnnotation(
  annotation: LinearDimensionAnnotation,
  viewport: ViewportTransform,
  offsetPx = 24,
): ScreenDimensionGeometry {
  const measuredStart = worldToScreen(annotation.start, viewport);
  const measuredEnd = worldToScreen(annotation.end, viewport);
  const shift = {
    x: annotation.outward.x * offsetPx,
    y: annotation.outward.y * offsetPx,
  };
  const dimensionStart = {
    x: measuredStart.x + shift.x,
    y: measuredStart.y + shift.y,
  };
  const dimensionEnd = {
    x: measuredEnd.x + shift.x,
    y: measuredEnd.y + shift.y,
  };

  return {
    measuredStart,
    measuredEnd,
    dimensionStart,
    dimensionEnd,
    labelPoint: {
      x: (dimensionStart.x + dimensionEnd.x) / 2,
      y: (dimensionStart.y + dimensionEnd.y) / 2,
    },
  };
}

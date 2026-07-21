import type { Point2 } from "./point";

export type ViewportTransform = Readonly<{
  offsetX: number;
  offsetY: number;
  pixelsPerMillimeter: number;
}>;

export type ZoomLimits = Readonly<{
  min: number;
  max: number;
}>;

export function worldToScreen(point: Point2, viewport: ViewportTransform): Point2 {
  return {
    x: point.x * viewport.pixelsPerMillimeter + viewport.offsetX,
    y: point.y * viewport.pixelsPerMillimeter + viewport.offsetY,
  };
}

export function screenToWorld(point: Point2, viewport: ViewportTransform): Point2 {
  return {
    x: (point.x - viewport.offsetX) / viewport.pixelsPerMillimeter,
    y: (point.y - viewport.offsetY) / viewport.pixelsPerMillimeter,
  };
}

export function zoomViewportAt(
  viewport: ViewportTransform,
  screenAnchor: Point2,
  factor: number,
  limits: ZoomLimits,
): ViewportTransform {
  const nextScale = Math.min(limits.max, Math.max(limits.min, viewport.pixelsPerMillimeter * factor));
  const worldAnchor = screenToWorld(screenAnchor, viewport);

  return {
    pixelsPerMillimeter: nextScale,
    offsetX: screenAnchor.x - worldAnchor.x * nextScale,
    offsetY: screenAnchor.y - worldAnchor.y * nextScale,
  };
}

import type { Point2 } from "@vlezet/geometry";
import {
  nudgeCalibrationImagePoint,
  panCalibrationViewport,
  zoomCalibrationViewportAt,
  type CalibrationSize,
  type CalibrationViewportTransform,
  type CalibrationZoomLimits,
} from "./calibration-viewport";

export type CalibrationHandle = "a" | "b";

export type CalibrationPlacement = Readonly<{
  handle: CalibrationHandle;
  point: Point2;
}>;

export function chooseCalibrationHandle(input: Readonly<{
  point: Point2;
  pointA: Point2 | null;
  pointB: Point2 | null;
  viewportScale: number;
  tolerancePx: number;
}>): CalibrationHandle | null {
  const candidates = (["a", "b"] as const).flatMap((handle) => {
    const point = handle === "a" ? input.pointA : input.pointB;
    return point === null
      ? []
      : [{
          handle,
          screenDistance: Math.hypot(input.point.x - point.x, input.point.y - point.y) * input.viewportScale,
        }];
  });
  const nearest = candidates.sort(
    (first, second) => first.screenDistance - second.screenDistance || first.handle.localeCompare(second.handle),
  )[0];
  return nearest && nearest.screenDistance <= input.tolerancePx ? nearest.handle : null;
}

export function resolveCalibrationPlacement(input: Readonly<{
  point: Point2;
  pointA: Point2 | null;
  pointB: Point2 | null;
  viewportScale: number;
  handleTolerancePx: number;
}>): CalibrationPlacement {
  if (input.pointA === null) return { handle: "a", point: input.point };
  if (input.pointB === null) return { handle: "b", point: input.point };
  const acquired = chooseCalibrationHandle({
    point: input.point,
    pointA: input.pointA,
    pointB: input.pointB,
    viewportScale: input.viewportScale,
    tolerancePx: input.handleTolerancePx,
  });
  if (acquired) return { handle: acquired, point: input.point };
  const distanceA = Math.hypot(input.point.x - input.pointA.x, input.point.y - input.pointA.y);
  const distanceB = Math.hypot(input.point.x - input.pointB.x, input.point.y - input.pointB.y);
  return { handle: distanceA < distanceB ? "a" : "b", point: input.point };
}

export function resolveCalibrationWheelGesture(input: Readonly<{
  transform: CalibrationViewportTransform;
  localPoint: Point2;
  deltaX: number;
  deltaY: number;
  zoomModifier: boolean;
  zoomFactor: number;
  limits: CalibrationZoomLimits;
}>): CalibrationViewportTransform {
  if (!input.zoomModifier) {
    return panCalibrationViewport(input.transform, { x: -input.deltaX, y: -input.deltaY });
  }
  return zoomCalibrationViewportAt({
    transform: input.transform,
    viewportPoint: input.localPoint,
    factor: input.zoomFactor,
    limits: input.limits,
  });
}

export function resolveCalibrationNudge(input: Readonly<{
  key: string;
  shiftKey: boolean;
  activeHandle: CalibrationHandle | null;
  pointA: Point2 | null;
  pointB: Point2 | null;
  naturalSize: CalibrationSize;
}>): CalibrationPlacement | null {
  if (input.activeHandle === null) return null;
  const sourcePoint = input.activeHandle === "a" ? input.pointA : input.pointB;
  if (sourcePoint === null) return null;
  const step = input.shiftKey ? 10 : 1;
  const delta = input.key === "ArrowLeft" ? { x: -step, y: 0 }
    : input.key === "ArrowRight" ? { x: step, y: 0 }
      : input.key === "ArrowUp" ? { x: 0, y: -step }
        : input.key === "ArrowDown" ? { x: 0, y: step }
          : null;
  if (delta === null) return null;
  return {
    handle: input.activeHandle,
    point: nudgeCalibrationImagePoint({ point: sourcePoint, delta, naturalSize: input.naturalSize }),
  };
}

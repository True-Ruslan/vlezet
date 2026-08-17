import type { Point2 } from "@vlezet/geometry";

export type CalibrationRectangle = Readonly<{
  left: number;
  top: number;
  width: number;
  height: number;
}>;

export type CalibrationSize = Readonly<{
  width: number;
  height: number;
}>;

export type CalibrationViewportTransform = Readonly<{
  scale: number;
  offsetX: number;
  offsetY: number;
}>;

export type CalibrationZoomLimits = Readonly<{
  minScale: number;
  maxScale: number;
}>;

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function nonNegative(value: number, label: string): number {
  const valid = finite(value, label);
  if (valid < 0) throw new Error(`${label} must not be negative.`);
  return valid;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function validateTransform(transform: CalibrationViewportTransform): CalibrationViewportTransform {
  return {
    scale: positive(transform.scale, "transform.scale"),
    offsetX: finite(transform.offsetX, "transform.offsetX"),
    offsetY: finite(transform.offsetY, "transform.offsetY"),
  };
}

export function fitCalibrationViewport(input: Readonly<{
  naturalSize: CalibrationSize;
  containerSize: CalibrationSize;
  paddingPx?: number;
}>): CalibrationViewportTransform {
  const naturalWidth = positive(input.naturalSize.width, "naturalSize.width");
  const naturalHeight = positive(input.naturalSize.height, "naturalSize.height");
  const containerWidth = positive(input.containerSize.width, "containerSize.width");
  const containerHeight = positive(input.containerSize.height, "containerSize.height");
  const padding = nonNegative(input.paddingPx ?? 0, "paddingPx");
  const availableWidth = positive(containerWidth - padding * 2, "available width");
  const availableHeight = positive(containerHeight - padding * 2, "available height");
  const scale = Math.min(availableWidth / naturalWidth, availableHeight / naturalHeight);
  return {
    scale,
    offsetX: (containerWidth - naturalWidth * scale) / 2,
    offsetY: (containerHeight - naturalHeight * scale) / 2,
  };
}

export function imagePointToViewportPoint(input: Readonly<{
  imagePoint: Point2;
  transform: CalibrationViewportTransform;
}>): Point2 {
  const transform = validateTransform(input.transform);
  return {
    x: transform.offsetX + finite(input.imagePoint.x, "imagePoint.x") * transform.scale,
    y: transform.offsetY + finite(input.imagePoint.y, "imagePoint.y") * transform.scale,
  };
}

export function viewportPointToImagePoint(input: Readonly<{
  viewportPoint: Point2;
  transform: CalibrationViewportTransform;
}>): Point2 {
  const transform = validateTransform(input.transform);
  return {
    x: (finite(input.viewportPoint.x, "viewportPoint.x") - transform.offsetX) / transform.scale,
    y: (finite(input.viewportPoint.y, "viewportPoint.y") - transform.offsetY) / transform.scale,
  };
}

export function zoomCalibrationViewportAt(input: Readonly<{
  transform: CalibrationViewportTransform;
  viewportPoint: Point2;
  factor: number;
  limits: CalibrationZoomLimits;
}>): CalibrationViewportTransform {
  const transform = validateTransform(input.transform);
  const factor = positive(input.factor, "factor");
  const minScale = positive(input.limits.minScale, "limits.minScale");
  const maxScale = positive(input.limits.maxScale, "limits.maxScale");
  if (minScale > maxScale) throw new Error("limits.minScale must not exceed limits.maxScale.");
  const viewportPoint = {
    x: finite(input.viewportPoint.x, "viewportPoint.x"),
    y: finite(input.viewportPoint.y, "viewportPoint.y"),
  };
  const imagePoint = viewportPointToImagePoint({ viewportPoint, transform });
  const scale = clamp(transform.scale * factor, minScale, maxScale);
  return {
    scale,
    offsetX: viewportPoint.x - imagePoint.x * scale,
    offsetY: viewportPoint.y - imagePoint.y * scale,
  };
}

export function panCalibrationViewport(
  transformInput: CalibrationViewportTransform,
  delta: Point2,
): CalibrationViewportTransform {
  const transform = validateTransform(transformInput);
  return {
    scale: transform.scale,
    offsetX: transform.offsetX + finite(delta.x, "delta.x"),
    offsetY: transform.offsetY + finite(delta.y, "delta.y"),
  };
}

export function nudgeCalibrationImagePoint(input: Readonly<{
  point: Point2;
  delta: Point2;
  naturalSize: CalibrationSize;
}>): Point2 {
  const width = positive(input.naturalSize.width, "naturalSize.width");
  const height = positive(input.naturalSize.height, "naturalSize.height");
  return {
    x: clamp(finite(input.point.x, "point.x") + finite(input.delta.x, "delta.x"), 0, width),
    y: clamp(finite(input.point.y, "point.y") + finite(input.delta.y, "delta.y"), 0, height),
  };
}

export function clientPointToImagePoint(input: Readonly<{
  clientPoint: Point2;
  imageRect: CalibrationRectangle;
  naturalSize: CalibrationSize;
  edgeTolerancePx?: number;
}>): Point2 | null {
  const imageWidth = positive(input.imageRect.width, "imageRect.width");
  const imageHeight = positive(input.imageRect.height, "imageRect.height");
  const naturalWidth = positive(input.naturalSize.width, "naturalSize.width");
  const naturalHeight = positive(input.naturalSize.height, "naturalSize.height");
  const clientX = finite(input.clientPoint.x, "clientPoint.x");
  const clientY = finite(input.clientPoint.y, "clientPoint.y");
  const tolerance = Math.max(0, input.edgeTolerancePx ?? 0.5);
  const localX = clientX - finite(input.imageRect.left, "imageRect.left");
  const localY = clientY - finite(input.imageRect.top, "imageRect.top");

  if (
    localX < -tolerance
    || localY < -tolerance
    || localX > imageWidth + tolerance
    || localY > imageHeight + tolerance
  ) return null;

  return {
    x: clamp(localX, 0, imageWidth) / imageWidth * naturalWidth,
    y: clamp(localY, 0, imageHeight) / imageHeight * naturalHeight,
  };
}

export function imagePointToContainerPoint(input: Readonly<{
  imagePoint: Point2;
  imageRect: CalibrationRectangle;
  containerRect: CalibrationRectangle;
  naturalSize: CalibrationSize;
}>): Point2 {
  const imageWidth = positive(input.imageRect.width, "imageRect.width");
  const imageHeight = positive(input.imageRect.height, "imageRect.height");
  const naturalWidth = positive(input.naturalSize.width, "naturalSize.width");
  const naturalHeight = positive(input.naturalSize.height, "naturalSize.height");
  return {
    x: finite(input.imageRect.left, "imageRect.left")
      - finite(input.containerRect.left, "containerRect.left")
      + clamp(finite(input.imagePoint.x, "imagePoint.x"), 0, naturalWidth) / naturalWidth * imageWidth,
    y: finite(input.imageRect.top, "imageRect.top")
      - finite(input.containerRect.top, "containerRect.top")
      + clamp(finite(input.imagePoint.y, "imagePoint.y"), 0, naturalHeight) / naturalHeight * imageHeight,
  };
}

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

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
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

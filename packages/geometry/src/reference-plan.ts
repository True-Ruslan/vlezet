import type { Point2 } from "./point";

export const MIN_CALIBRATION_PIXEL_DISTANCE = 20;
export const MIN_CALIBRATION_LENGTH_MM = 100;
export const MAX_CALIBRATION_LENGTH_MM = 100_000;
export const MIN_MILLIMETERS_PER_PIXEL = 0.05;
export const MAX_MILLIMETERS_PER_PIXEL = 100;

export type ReferenceAlignment = "none" | "horizontal" | "vertical";

export type ReferenceTransform = Readonly<{
  originWorld: Point2;
  millimetersPerPixel: number;
  rotationDeg: number;
}>;

export type ReferenceCalibration = Readonly<{
  pointA: Point2;
  pointB: Point2;
  knownLengthMm: number;
  alignment: ReferenceAlignment;
}>;

export type CalibratedReference = Readonly<{
  widthPx: number;
  heightPx: number;
  transform: ReferenceTransform;
  calibration: ReferenceCalibration;
}>;

export type CalibrationInput = Readonly<{
  widthPx: number;
  heightPx: number;
  pointA: Point2;
  pointB: Point2;
  knownLengthMm: number;
  originWorld: Point2;
  alignment: ReferenceAlignment;
}>;

export type Bounds2 = Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function positive(value: number, label: string): number {
  const valid = finite(value, label);
  if (valid <= 0) throw new Error(`${label} must be positive.`);
  return valid;
}

function normalizeDegrees(value: number): number {
  const normalized = ((value + 180) % 360 + 360) % 360 - 180;
  return Object.is(normalized, -0) ? 0 : normalized;
}

function radians(degrees: number): number {
  return degrees * Math.PI / 180;
}

function rotate(point: Point2, rotationDeg: number): Point2 {
  const angle = radians(rotationDeg);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: point.x * cos - point.y * sin,
    y: point.x * sin + point.y * cos,
  };
}

function calibrationRotation(pointA: Point2, pointB: Point2, alignment: ReferenceAlignment): number {
  if (alignment === "none") return 0;
  const imageAngle = Math.atan2(pointB.y - pointA.y, pointB.x - pointA.x) * 180 / Math.PI;
  const target = alignment === "horizontal" ? 0 : 90;
  return normalizeDegrees(target - imageAngle);
}

export function imagePointToWorld(point: Point2, transform: ReferenceTransform): Point2 {
  const scaled = {
    x: finite(point.x, "image x") * transform.millimetersPerPixel,
    y: finite(point.y, "image y") * transform.millimetersPerPixel,
  };
  const rotated = rotate(scaled, transform.rotationDeg);
  return {
    x: transform.originWorld.x + rotated.x,
    y: transform.originWorld.y + rotated.y,
  };
}

export function worldPointToImage(point: Point2, transform: ReferenceTransform): Point2 {
  const relative = {
    x: finite(point.x, "world x") - transform.originWorld.x,
    y: finite(point.y, "world y") - transform.originWorld.y,
  };
  const unrotated = rotate(relative, -transform.rotationDeg);
  return {
    x: unrotated.x / transform.millimetersPerPixel,
    y: unrotated.y / transform.millimetersPerPixel,
  };
}

export function calibrateReferencePlan(input: CalibrationInput): CalibratedReference {
  const widthPx = positive(input.widthPx, "widthPx");
  const heightPx = positive(input.heightPx, "heightPx");
  const dx = input.pointB.x - input.pointA.x;
  const dy = input.pointB.y - input.pointA.y;
  const pixelDistance = Math.hypot(dx, dy);
  if (pixelDistance < MIN_CALIBRATION_PIXEL_DISTANCE) throw new Error("Calibration points are too close.");
  const knownLengthMm = finite(input.knownLengthMm, "knownLengthMm");
  if (knownLengthMm < MIN_CALIBRATION_LENGTH_MM || knownLengthMm > MAX_CALIBRATION_LENGTH_MM) {
    throw new Error("Calibration length is outside supported bounds.");
  }
  const millimetersPerPixel = knownLengthMm / pixelDistance;
  if (millimetersPerPixel < MIN_MILLIMETERS_PER_PIXEL || millimetersPerPixel > MAX_MILLIMETERS_PER_PIXEL) {
    throw new Error("Calibration scale is outside supported bounds.");
  }
  const rotationDeg = calibrationRotation(input.pointA, input.pointB, input.alignment);
  return {
    widthPx,
    heightPx,
    transform: {
      originWorld: { x: finite(input.originWorld.x, "origin x"), y: finite(input.originWorld.y, "origin y") },
      millimetersPerPixel,
      rotationDeg,
    },
    calibration: {
      pointA: { ...input.pointA },
      pointB: { ...input.pointB },
      knownLengthMm,
      alignment: input.alignment,
    },
  };
}

export function alignReferenceCalibration(reference: CalibratedReference, alignment: ReferenceAlignment): CalibratedReference {
  const midpointImage = {
    x: (reference.calibration.pointA.x + reference.calibration.pointB.x) / 2,
    y: (reference.calibration.pointA.y + reference.calibration.pointB.y) / 2,
  };
  const midpointWorld = imagePointToWorld(midpointImage, reference.transform);
  const rotationDeg = calibrationRotation(reference.calibration.pointA, reference.calibration.pointB, alignment);
  const midpointOffset = rotate({
    x: midpointImage.x * reference.transform.millimetersPerPixel,
    y: midpointImage.y * reference.transform.millimetersPerPixel,
  }, rotationDeg);
  return {
    ...reference,
    transform: {
      ...reference.transform,
      rotationDeg,
      originWorld: {
        x: midpointWorld.x - midpointOffset.x,
        y: midpointWorld.y - midpointOffset.y,
      },
    },
    calibration: { ...reference.calibration, alignment },
  };
}

export function referencePlanWorldCorners(input: Readonly<{
  widthPx: number;
  heightPx: number;
  transform: ReferenceTransform;
}>): readonly Point2[] {
  return [
    { x: 0, y: 0 },
    { x: input.widthPx, y: 0 },
    { x: input.widthPx, y: input.heightPx },
    { x: 0, y: input.heightPx },
  ].map((point) => imagePointToWorld(point, input.transform));
}

export function referencePlanBounds(input: Readonly<{
  widthPx: number;
  heightPx: number;
  transform: ReferenceTransform;
}>): Bounds2 {
  const corners = referencePlanWorldCorners(input);
  return {
    minX: Math.min(...corners.map((point) => point.x)),
    minY: Math.min(...corners.map((point) => point.y)),
    maxX: Math.max(...corners.map((point) => point.x)),
    maxY: Math.max(...corners.map((point) => point.y)),
  };
}

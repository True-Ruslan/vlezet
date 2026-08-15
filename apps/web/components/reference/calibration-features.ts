import type { Point2 } from "@vlezet/geometry";
import type { CalibrationSourceFeature } from "./calibration-snap";

export const MAX_CALIBRATION_FEATURE_RADIUS_PX = 32;

export type CalibrationImageDataLike = Readonly<{
  width: number;
  height: number;
  data: ArrayLike<number>;
}>;

export type AnalyzeCalibrationFeaturesInput = Readonly<{
  image: CalibrationImageDataLike;
  point: Point2;
  radiusPx: number;
  contrastThreshold: number;
  darknessThreshold: number;
  maximumLineWidthPx: number;
}>;

type Axis = "h" | "v";

type Profile = Readonly<{
  axis: Axis;
  coordinates: readonly number[];
  darkness: readonly number[];
}>;

type LineCenter = Readonly<{
  axis: Axis;
  coordinate: number;
  strength: number;
}>;

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function positive(value: number, label: string): number {
  const valid = finite(value, label);
  if (valid <= 0) throw new Error(`${label} must be positive.`);
  return valid;
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function luminance(data: ArrayLike<number>, offset: number): number {
  const red = data[offset] ?? 0;
  const green = data[offset + 1] ?? red;
  const blue = data[offset + 2] ?? red;
  return (red + green + blue) / 3;
}

function fixed(value: number): string {
  return value.toFixed(3);
}

function strengthForContrast(contrast: number): number {
  return clamp(contrast / 255, 0, 1);
}

function compareFeatures(first: CalibrationSourceFeature, second: CalibrationSourceFeature): number {
  const priority = { intersection: 0, "line-center": 1, edge: 2 } as const;
  return priority[first.kind] - priority[second.kind]
    || first.point.y - second.point.y
    || first.point.x - second.point.x
    || first.id.localeCompare(second.id);
}

function validateImage(image: CalibrationImageDataLike): Readonly<{ width: number; height: number }> {
  const width = positive(image.width, "image.width");
  const height = positive(image.height, "image.height");
  if (!Number.isInteger(width) || !Number.isInteger(height)) throw new Error("image dimensions must be integers.");
  if (image.data.length < width * height * 4) throw new Error("image.data is shorter than the declared dimensions.");
  return { width, height };
}

function profileFor(
  image: CalibrationImageDataLike,
  bounds: Readonly<{ minX: number; minY: number; maxX: number; maxY: number }>,
  axis: Axis,
): Profile {
  const coordinates: number[] = [];
  const darkness: number[] = [];
  if (axis === "v") {
    for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
      let total = 0;
      let count = 0;
      for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
        total += 255 - luminance(image.data, (y * image.width + x) * 4);
        count += 1;
      }
      coordinates.push(x);
      darkness.push(total / count);
    }
  } else {
    for (let y = bounds.minY; y <= bounds.maxY; y += 1) {
      let total = 0;
      let count = 0;
      for (let x = bounds.minX; x <= bounds.maxX; x += 1) {
        total += 255 - luminance(image.data, (y * image.width + x) * 4);
        count += 1;
      }
      coordinates.push(y);
      darkness.push(total / count);
    }
  }
  return { axis, coordinates, darkness };
}

function edgeFeatures(
  profile: Profile,
  anchor: Point2,
  contrastThreshold: number,
): CalibrationSourceFeature[] {
  const features: CalibrationSourceFeature[] = [];
  for (let index = 0; index < profile.darkness.length - 1; index += 1) {
    const contrast = Math.abs(profile.darkness[index + 1]! - profile.darkness[index]!);
    if (contrast < contrastThreshold) continue;
    const coordinate = (profile.coordinates[index]! + profile.coordinates[index + 1]!) / 2;
    features.push({
      id: `edge:${profile.axis}:${fixed(coordinate)}`,
      kind: "edge",
      point: profile.axis === "v" ? { x: coordinate, y: anchor.y } : { x: anchor.x, y: coordinate },
      strength: strengthForContrast(contrast),
    });
  }
  return features;
}

function lineCenters(
  profile: Profile,
  darknessThreshold: number,
  contrastThreshold: number,
  maximumLineWidthPx: number,
): LineCenter[] {
  const centers: LineCenter[] = [];
  let index = 0;
  while (index < profile.darkness.length) {
    if (profile.darkness[index]! < darknessThreshold) {
      index += 1;
      continue;
    }
    const start = index;
    while (index + 1 < profile.darkness.length && profile.darkness[index + 1]! >= darknessThreshold) index += 1;
    const end = index;
    index += 1;

    if (start === 0 || end === profile.darkness.length - 1) continue;
    const width = profile.coordinates[end]! - profile.coordinates[start]! + 1;
    if (width > maximumLineWidthPx) continue;
    const leftContrast = profile.darkness[start]! - profile.darkness[start - 1]!;
    const rightContrast = profile.darkness[end]! - profile.darkness[end + 1]!;
    if (leftContrast < contrastThreshold || rightContrast < contrastThreshold) continue;
    centers.push({
      axis: profile.axis,
      coordinate: (profile.coordinates[start]! + profile.coordinates[end]!) / 2,
      strength: strengthForContrast(Math.min(leftContrast, rightContrast)),
    });
  }
  return centers;
}

function lineCenterFeatures(centers: readonly LineCenter[], anchor: Point2): CalibrationSourceFeature[] {
  return centers.map((center) => ({
    id: `line-center:${center.axis}:${fixed(center.coordinate)}`,
    kind: "line-center" as const,
    point: center.axis === "v" ? { x: center.coordinate, y: anchor.y } : { x: anchor.x, y: center.coordinate },
    strength: center.strength,
  }));
}

function intersectionFeatures(
  vertical: readonly LineCenter[],
  horizontal: readonly LineCenter[],
): CalibrationSourceFeature[] {
  return vertical.flatMap((verticalCenter) => horizontal.map((horizontalCenter) => ({
    id: `intersection:${fixed(verticalCenter.coordinate)}:${fixed(horizontalCenter.coordinate)}`,
    kind: "intersection" as const,
    point: { x: verticalCenter.coordinate, y: horizontalCenter.coordinate },
    strength: Math.min(verticalCenter.strength, horizontalCenter.strength),
  })));
}

export function analyzeCalibrationFeatures(input: AnalyzeCalibrationFeaturesInput): readonly CalibrationSourceFeature[] {
  const { width, height } = validateImage(input.image);
  const radius = Math.min(MAX_CALIBRATION_FEATURE_RADIUS_PX, positive(input.radiusPx, "radiusPx"));
  const contrastThreshold = positive(input.contrastThreshold, "contrastThreshold");
  const darknessThreshold = positive(input.darknessThreshold, "darknessThreshold");
  const maximumLineWidthPx = positive(input.maximumLineWidthPx, "maximumLineWidthPx");
  const anchor = {
    x: clamp(finite(input.point.x, "point.x"), 0, width - 1),
    y: clamp(finite(input.point.y, "point.y"), 0, height - 1),
  };
  const bounds = {
    minX: Math.max(0, Math.floor(anchor.x - radius)),
    minY: Math.max(0, Math.floor(anchor.y - radius)),
    maxX: Math.min(width - 1, Math.ceil(anchor.x + radius)),
    maxY: Math.min(height - 1, Math.ceil(anchor.y + radius)),
  };

  const verticalProfile = profileFor(input.image, bounds, "v");
  const horizontalProfile = profileFor(input.image, bounds, "h");
  const verticalCenters = lineCenters(verticalProfile, darknessThreshold, contrastThreshold, maximumLineWidthPx);
  const horizontalCenters = lineCenters(horizontalProfile, darknessThreshold, contrastThreshold, maximumLineWidthPx);
  return [
    ...intersectionFeatures(verticalCenters, horizontalCenters),
    ...lineCenterFeatures(verticalCenters, anchor),
    ...lineCenterFeatures(horizontalCenters, anchor),
    ...edgeFeatures(verticalProfile, anchor, contrastThreshold),
    ...edgeFeatures(horizontalProfile, anchor, contrastThreshold),
  ].sort(compareFeatures);
}

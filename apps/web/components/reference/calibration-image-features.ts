import type { Point2 } from "@vlezet/geometry";
import {
  analyzeCalibrationFeatures,
  MAX_CALIBRATION_FEATURE_RADIUS_PX,
} from "./calibration-features";
import type { CalibrationSourceFeature } from "./calibration-snap";

export type CalibrationCanvasContextLike = Readonly<{
  drawImage: (
    image: unknown,
    sourceX: number,
    sourceY: number,
    sourceWidth: number,
    sourceHeight: number,
    destinationX: number,
    destinationY: number,
    destinationWidth: number,
    destinationHeight: number,
  ) => void;
  getImageData: (x: number, y: number, width: number, height: number) => Readonly<{ data: Uint8ClampedArray }>;
}>;

export type CalibrationCanvasLike = {
  width: number;
  height: number;
  getContext: (kind: "2d") => CalibrationCanvasContextLike | null;
};

export type CalibrationFeatureImage = Readonly<{
  naturalWidth: number;
  naturalHeight: number;
}>;

export type CalibrationCanvasFactory = (width: number, height: number) => CalibrationCanvasLike;

export function createBrowserCalibrationCanvas(width: number, height: number): CalibrationCanvasLike {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas as unknown as CalibrationCanvasLike;
}

function globalFeature(
  feature: CalibrationSourceFeature,
  origin: Point2,
): CalibrationSourceFeature {
  const point = { x: feature.point.x + origin.x, y: feature.point.y + origin.y };
  if (feature.kind === "intersection") {
    return {
      ...feature,
      id: `intersection:${point.x.toFixed(3)}:${point.y.toFixed(3)}`,
      point,
    };
  }
  const axis = feature.id.split(":")[1] === "h" ? "h" : "v";
  const coordinate = axis === "v" ? point.x : point.y;
  return {
    ...feature,
    id: `${feature.kind}:${axis}:${coordinate.toFixed(3)}`,
    point,
  };
}

export function readCalibrationFeaturesFromImage(input: Readonly<{
  image: CalibrationFeatureImage;
  point: Point2;
  radiusPx: number;
  contrastThreshold: number;
  darknessThreshold: number;
  maximumLineWidthPx: number;
  createCanvas?: CalibrationCanvasFactory;
}>): readonly CalibrationSourceFeature[] {
  const naturalWidth = input.image.naturalWidth;
  const naturalHeight = input.image.naturalHeight;
  if (!Number.isFinite(naturalWidth) || naturalWidth <= 0 || !Number.isFinite(naturalHeight) || naturalHeight <= 0) {
    throw new Error("Natural image dimensions must be positive and finite.");
  }
  if (!Number.isFinite(input.radiusPx) || input.radiusPx <= 0) throw new Error("radiusPx must be positive and finite.");
  const radius = Math.min(input.radiusPx, MAX_CALIBRATION_FEATURE_RADIUS_PX);
  const minX = Math.max(0, Math.floor(input.point.x - radius));
  const minY = Math.max(0, Math.floor(input.point.y - radius));
  const maxX = Math.min(naturalWidth - 1, Math.ceil(input.point.x + radius));
  const maxY = Math.min(naturalHeight - 1, Math.ceil(input.point.y + radius));
  const width = Math.max(1, maxX - minX + 1);
  const height = Math.max(1, maxY - minY + 1);
  const canvas = (input.createCanvas ?? createBrowserCalibrationCanvas)(width, height);
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context is unavailable.");
  context.drawImage(input.image, minX, minY, width, height, 0, 0, width, height);
  const localImage = context.getImageData(0, 0, width, height);
  const localPoint = { x: input.point.x - minX, y: input.point.y - minY };
  return analyzeCalibrationFeatures({
    image: { width, height, data: localImage.data },
    point: localPoint,
    radiusPx: radius,
    contrastThreshold: input.contrastThreshold,
    darknessThreshold: input.darknessThreshold,
    maximumLineWidthPx: input.maximumLineWidthPx,
  }).map((feature) => globalFeature(feature, { x: minX, y: minY }));
}

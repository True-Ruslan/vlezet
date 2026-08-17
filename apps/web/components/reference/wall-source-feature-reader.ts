import type { Point2 } from "@vlezet/geometry";
import { analyzeCalibrationFeatures } from "./calibration-features";
import {
  createBrowserCalibrationCanvas,
  type CalibrationCanvasFactory,
  type CalibrationFeatureImage,
} from "./calibration-image-features";
import type { CalibrationSourceFeature } from "./calibration-snap";

export const WALL_SOURCE_FEATURE_POLICY = Object.freeze({
  radiusPx: 20,
  contrastThreshold: 60,
  darknessThreshold: 120,
  maximumLineWidthPx: 12,
});

const WALL_SOURCE_ANALYSIS_DIAMETER_PX = WALL_SOURCE_FEATURE_POLICY.radiusPx * 2 + 1;

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function analysisCoordinate(
  sourceCoordinate: number,
  sourceOrigin: number,
  sourceSize: number,
  analysisSize: number,
): number {
  return ((sourceCoordinate - sourceOrigin + 0.5) * analysisSize / sourceSize) - 0.5;
}

function sourceCoordinate(
  localCoordinate: number,
  sourceOrigin: number,
  sourceSize: number,
  analysisSize: number,
): number {
  return sourceOrigin + ((localCoordinate + 0.5) * sourceSize / analysisSize) - 0.5;
}

function toSourceFeature(
  feature: CalibrationSourceFeature,
  sample: Readonly<{
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    analysisWidth: number;
    analysisHeight: number;
  }>,
): CalibrationSourceFeature {
  const point = {
    x: sourceCoordinate(feature.point.x, sample.sourceX, sample.sourceWidth, sample.analysisWidth),
    y: sourceCoordinate(feature.point.y, sample.sourceY, sample.sourceHeight, sample.analysisHeight),
  };
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

export function readWallSourceFeatures(input: Readonly<{
  image: CalibrationFeatureImage;
  point: Point2;
  viewportScale: number;
  createCanvas?: CalibrationCanvasFactory;
}>): readonly CalibrationSourceFeature[] {
  const naturalWidth = positive(input.image.naturalWidth, "image.naturalWidth");
  const naturalHeight = positive(input.image.naturalHeight, "image.naturalHeight");
  const viewportScale = positive(input.viewportScale, "viewportScale");
  const point = {
    x: finite(input.point.x, "point.x"),
    y: finite(input.point.y, "point.y"),
  };
  const sourceRadius = WALL_SOURCE_FEATURE_POLICY.radiusPx / viewportScale;
  const sourceX = Math.max(0, Math.floor(point.x - sourceRadius));
  const sourceY = Math.max(0, Math.floor(point.y - sourceRadius));
  const sourceMaxX = Math.min(naturalWidth - 1, Math.ceil(point.x + sourceRadius));
  const sourceMaxY = Math.min(naturalHeight - 1, Math.ceil(point.y + sourceRadius));
  const sourceWidth = Math.max(1, sourceMaxX - sourceX + 1);
  const sourceHeight = Math.max(1, sourceMaxY - sourceY + 1);
  const analysisWidth = Math.max(
    1,
    Math.min(WALL_SOURCE_ANALYSIS_DIAMETER_PX, Math.ceil(sourceWidth * viewportScale)),
  );
  const analysisHeight = Math.max(
    1,
    Math.min(WALL_SOURCE_ANALYSIS_DIAMETER_PX, Math.ceil(sourceHeight * viewportScale)),
  );
  const canvas = (input.createCanvas ?? createBrowserCalibrationCanvas)(analysisWidth, analysisHeight);
  canvas.width = analysisWidth;
  canvas.height = analysisHeight;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("2D canvas context is unavailable.");
  context.drawImage(
    input.image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    analysisWidth,
    analysisHeight,
  );
  const localImage = context.getImageData(0, 0, analysisWidth, analysisHeight);
  const localPoint = {
    x: analysisCoordinate(point.x, sourceX, sourceWidth, analysisWidth),
    y: analysisCoordinate(point.y, sourceY, sourceHeight, analysisHeight),
  };
  const sample = {
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    analysisWidth,
    analysisHeight,
  };
  return analyzeCalibrationFeatures({
    image: { width: analysisWidth, height: analysisHeight, data: localImage.data },
    point: localPoint,
    ...WALL_SOURCE_FEATURE_POLICY,
  }).map((feature) => toSourceFeature(feature, sample));
}

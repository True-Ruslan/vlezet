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
const WALL_OUTLINE_MIN_SEPARATION_PX = 4;
const WALL_OUTLINE_MAX_SEPARATION_PX = 18;
const WALL_OUTLINE_EDGE_MARGIN_PX = 2;

type WallFeatureAxis = "h" | "v";
type CollapseOutlinePairResult = Readonly<{
  features: readonly CalibrationSourceFeature[];
  collapsed: boolean;
}>;

function positive(value: number, label: string): number {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${label} must be positive and finite.`);
  return value;
}

function finite(value: number, label: string): number {
  if (!Number.isFinite(value)) throw new Error(`${label} must be finite.`);
  return value;
}

function featureAxis(feature: CalibrationSourceFeature): WallFeatureAxis | null {
  if (feature.kind === "intersection") return null;
  return feature.id.split(":")[1] === "h" ? "h" : "v";
}

function featureCoordinate(feature: CalibrationSourceFeature, axis: WallFeatureAxis): number {
  return axis === "v" ? feature.point.x : feature.point.y;
}

function orderedAxisFeatures(
  features: readonly CalibrationSourceFeature[],
  axis: WallFeatureAxis,
  kind: "line-center" | "edge",
): CalibrationSourceFeature[] {
  return features
    .filter((feature) => feature.kind === kind && featureAxis(feature) === axis)
    .sort((left, right) => featureCoordinate(left, axis) - featureCoordinate(right, axis));
}

function collapseOutlinePair(
  features: readonly CalibrationSourceFeature[],
  point: Point2,
  axis: WallFeatureAxis,
): CollapseOutlinePairResult {
  const centres = orderedAxisFeatures(features, axis, "line-center");
  const pair = centres.length === 2
    ? centres
    : centres.length === 0
      ? orderedAxisFeatures(features, axis, "edge")
      : [];
  if (pair.length !== 2) return { features, collapsed: false };

  const first = pair[0]!;
  const second = pair[1]!;
  const firstCoordinate = featureCoordinate(first, axis);
  const secondCoordinate = featureCoordinate(second, axis);
  const separation = secondCoordinate - firstCoordinate;
  const pointerCoordinate = axis === "v" ? point.x : point.y;
  if (
    separation < WALL_OUTLINE_MIN_SEPARATION_PX ||
    separation > WALL_OUTLINE_MAX_SEPARATION_PX ||
    pointerCoordinate < firstCoordinate - WALL_OUTLINE_EDGE_MARGIN_PX ||
    pointerCoordinate > secondCoordinate + WALL_OUTLINE_EDGE_MARGIN_PX
  ) {
    return { features, collapsed: false };
  }

  const midpoint = (firstCoordinate + secondCoordinate) / 2;
  const centrePoint = axis === "v"
    ? { x: midpoint, y: point.y }
    : { x: point.x, y: midpoint };
  const envelopeMin = firstCoordinate - WALL_OUTLINE_EDGE_MARGIN_PX;
  const envelopeMax = secondCoordinate + WALL_OUTLINE_EDGE_MARGIN_PX;
  const retained = features.filter((feature) => {
    if (feature.kind === "intersection" || featureAxis(feature) !== axis) return true;
    const coordinate = featureCoordinate(feature, axis);
    return coordinate < envelopeMin || coordinate > envelopeMax;
  });
  const strength = Math.min(first.strength, second.strength);
  const coordinate = axis === "v" ? centrePoint.x : centrePoint.y;
  return {
    features: [...retained, {
      id: `line-center:${axis}:${coordinate.toFixed(3)}`,
      kind: "line-center",
      point: centrePoint,
      strength,
    }],
    collapsed: true,
  };
}

function balancedWallCornerStrength(first: number, second: number): number {
  // Both inputs come from independently collapsed architectural wall outlines.
  // Their harmonic mean absorbs bounded raster-phase attenuation while still
  // penalizing a materially weaker perpendicular axis.
  return (2 * first * second) / (first + second);
}

function rebuildLineCenterIntersections(
  features: readonly CalibrationSourceFeature[],
  architecturalCorner: boolean,
): readonly CalibrationSourceFeature[] {
  const retained = features.filter((feature) => feature.kind !== "intersection");
  const horizontalCentres = orderedAxisFeatures(retained, "h", "line-center");
  const verticalCentres = orderedAxisFeatures(retained, "v", "line-center");
  const intersections: CalibrationSourceFeature[] = [];

  for (const horizontal of horizontalCentres) {
    for (const vertical of verticalCentres) {
      const point = { x: vertical.point.x, y: horizontal.point.y };
      intersections.push({
        id: `intersection:${point.x.toFixed(3)}:${point.y.toFixed(3)}`,
        kind: "intersection",
        point,
        strength: architecturalCorner
          ? balancedWallCornerStrength(horizontal.strength, vertical.strength)
          : Math.min(horizontal.strength, vertical.strength),
      });
    }
  }

  return [...retained, ...intersections];
}

function collapseWallOutlinePairs(
  features: readonly CalibrationSourceFeature[],
  point: Point2,
): readonly CalibrationSourceFeature[] {
  const horizontal = collapseOutlinePair(features, point, "h");
  const vertical = collapseOutlinePair(horizontal.features, point, "v");
  return rebuildLineCenterIntersections(vertical.features, horizontal.collapsed && vertical.collapsed);
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
  const localFeatures = collapseWallOutlinePairs(analyzeCalibrationFeatures({
    image: { width: analysisWidth, height: analysisHeight, data: localImage.data },
    point: localPoint,
    ...WALL_SOURCE_FEATURE_POLICY,
  }), localPoint);
  return localFeatures.map((feature) => toSourceFeature(feature, sample));
}

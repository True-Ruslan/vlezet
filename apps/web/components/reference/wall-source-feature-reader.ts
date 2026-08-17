import type { Point2 } from "@vlezet/geometry";
import {
  readCalibrationFeaturesFromImage,
  type CalibrationCanvasFactory,
  type CalibrationFeatureImage,
} from "./calibration-image-features";
import type { CalibrationSourceFeature } from "./calibration-snap";

export const WALL_SOURCE_FEATURE_POLICY = Object.freeze({
  radiusPx: 20,
  contrastThreshold: 60,
  darknessThreshold: 120,
  maximumLineWidthPx: 6,
});

export function readWallSourceFeatures(input: Readonly<{
  image: CalibrationFeatureImage;
  point: Point2;
  createCanvas?: CalibrationCanvasFactory;
}>): readonly CalibrationSourceFeature[] {
  return readCalibrationFeaturesFromImage({
    image: input.image,
    point: input.point,
    ...WALL_SOURCE_FEATURE_POLICY,
    createCanvas: input.createCanvas,
  });
}

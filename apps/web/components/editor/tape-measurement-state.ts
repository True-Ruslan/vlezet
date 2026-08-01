import type { Point2 } from "@vlezet/geometry";
import type { MeasurementPhase } from "./measurement-tool-store";

export type TapeMeasurementState = Readonly<{
  start: Point2;
  end: Point2;
  complete: boolean;
}> | null;

export function advanceTapeMeasurement(
  current: TapeMeasurementState,
  point: Point2,
): Exclude<TapeMeasurementState, null> {
  if (!current || current.complete) {
    return { start: point, end: point, complete: false };
  }
  return { ...current, end: point, complete: true };
}

export function previewTapeMeasurement(
  current: TapeMeasurementState,
  point: Point2,
): TapeMeasurementState {
  if (!current || current.complete) return current;
  return { ...current, end: point };
}

export function tapeMeasurementPhase(measurement: TapeMeasurementState): MeasurementPhase {
  if (!measurement) return "idle";
  return measurement.complete ? "complete" : "measuring";
}

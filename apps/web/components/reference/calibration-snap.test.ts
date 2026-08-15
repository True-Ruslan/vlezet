import { describe, expect, it } from "vitest";
import {
  resolveCalibrationSnap,
  type CalibrationSourceFeature,
} from "./calibration-snap";

const defaults = {
  viewportScale: 1,
  acquisitionRadiusPx: 6,
  releaseRadiusPx: 10,
  distanceEquivalencePx: 0.5,
  minimumStrength: 0.8,
  activeCandidateId: null,
  snappingEnabled: true,
  suppressed: false,
} as const;

function feature(
  id: string,
  kind: CalibrationSourceFeature["kind"],
  x: number,
  y = 0,
  strength = 1,
): CalibrationSourceFeature {
  return { id, kind, point: { x, y }, strength };
}

describe("calibration source snapping", () => {
  it("converts the screen-space acquisition radius through the current viewport zoom", () => {
    const candidate = feature("edge:1", "edge", 4);

    expect(resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [candidate],
      viewportScale: 1,
    }).candidateId).toBe("edge:1");

    expect(resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [candidate],
      viewportScale: 2,
    })).toMatchObject({ snapped: false, candidateId: null, point: { x: 0, y: 0 } });
  });

  it("lets the materially nearer source point win over feature-kind priority", () => {
    const result = resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [
        feature("edge:near", "edge", 1),
        feature("intersection:far", "intersection", 2),
      ],
    });

    expect(result).toMatchObject({ snapped: true, candidateId: "edge:near", kind: "edge", point: { x: 1, y: 0 } });
  });

  it("uses intersection > line-center > edge only for materially equivalent distances", () => {
    const result = resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [
        feature("edge:1", "edge", 1),
        feature("center:1", "line-center", 1.2),
        feature("intersection:1", "intersection", 1.3),
      ],
      distanceEquivalencePx: 0.5,
    });

    expect(result).toMatchObject({
      snapped: true,
      candidateId: "intersection:1",
      kind: "intersection",
      point: { x: 1.3, y: 0 },
    });
  });

  it("abstains when two materially equivalent candidates remain ambiguous at the same priority", () => {
    const result = resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [
        feature("center:left", "line-center", -1),
        feature("center:right", "line-center", 1),
      ],
    });

    expect(result).toMatchObject({
      snapped: false,
      candidateId: null,
      kind: "none",
      point: { x: 0, y: 0 },
      reason: "ambiguous",
    });
  });

  it("keeps the active candidate inside the wider release radius", () => {
    const result = resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 8, y: 0 },
      features: [feature("edge:active", "edge", 0)],
      acquisitionRadiusPx: 6,
      releaseRadiusPx: 10,
      activeCandidateId: "edge:active",
    });

    expect(result).toMatchObject({ snapped: true, candidateId: "edge:active", point: { x: 0, y: 0 } });
  });

  it("ignores weak local evidence instead of manufacturing confidence", () => {
    expect(resolveCalibrationSnap({
      ...defaults,
      rawPoint: { x: 0, y: 0 },
      features: [feature("edge:weak", "edge", 1, 0, 0.79)],
    })).toMatchObject({ snapped: false, candidateId: null, reason: "none" });
  });

  it("returns the raw source point when snapping is disabled or suppressed for the current gesture", () => {
    const candidate = feature("intersection:1", "intersection", 1);
    const rawPoint = { x: 0, y: 0 };

    expect(resolveCalibrationSnap({
      ...defaults,
      rawPoint,
      features: [candidate],
      snappingEnabled: false,
    })).toMatchObject({ snapped: false, candidateId: null, point: rawPoint, reason: "disabled" });

    expect(resolveCalibrationSnap({
      ...defaults,
      rawPoint,
      features: [candidate],
      suppressed: true,
    })).toMatchObject({ snapped: false, candidateId: null, point: rawPoint, reason: "suppressed" });
  });
});

import { imagePointToWorld, type Point2, type ReferenceTransform } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import type { CalibrationSourceFeature } from "./calibration-snap";
import { resolveReferenceSourceAssist } from "./reference-source-assist";

const transform: ReferenceTransform = {
  originWorld: { x: 400, y: -250 },
  millimetersPerPixel: 2,
  rotationDeg: 30,
};

const reference = {
  widthPx: 500,
  heightPx: 400,
  transform,
} as const;

const policy = {
  pixelsPerMillimeter: 0.5,
  acquisitionRadiusPx: 12,
  releaseRadiusPx: 18,
  distanceEquivalencePx: 1,
  minimumStrength: 0.35,
  activeCandidateId: null,
  enabled: true,
  suppressed: false,
} as const;

function feature(
  id: string,
  point: Point2,
  kind: CalibrationSourceFeature["kind"] = "line-center",
  strength = 0.9,
): CalibrationSourceFeature {
  return { id, point, kind, strength };
}

function resolve(
  sourcePointer: Point2,
  features: readonly CalibrationSourceFeature[],
  patch: Partial<Parameters<typeof resolveReferenceSourceAssist>[0]> = {},
) {
  return resolveReferenceSourceAssist({
    rawWorldPoint: imagePointToWorld(sourcePointer, transform),
    reference,
    features,
    ...policy,
    ...patch,
  });
}

describe("M8.4 reference source assist", () => {
  it("acquires a strong source feature through the accepted non-zero-rotation transform", () => {
    const sourcePointer = { x: 100, y: 80 };
    const sourceCandidate = { x: 106, y: 80 };
    const result = resolve(sourcePointer, [feature("line:v:106", sourceCandidate)]);

    expect(result).toEqual({
      acquired: true,
      candidateId: "line:v:106",
      kind: "line-center",
      sourcePoint: sourceCandidate,
      worldPoint: imagePointToWorld(sourceCandidate, transform),
      reason: "acquired",
    });
  });

  it("derives source screen distance from editor pixels/mm multiplied by reference mm/source-pixel", () => {
    const sourcePointer = { x: 100, y: 80 };
    const tenSourcePixelsAway = feature("line:v:110", { x: 110, y: 80 });

    expect(resolve(sourcePointer, [tenSourcePixelsAway], { acquisitionRadiusPx: 9 }).acquired).toBe(false);
    expect(resolve(sourcePointer, [tenSourcePixelsAway], { acquisitionRadiusPx: 11 }).acquired).toBe(true);
  });

  it("abstains when equivalent same-priority source candidates are ambiguous", () => {
    const result = resolve(
      { x: 100, y: 80 },
      [
        feature("line:v:95", { x: 95, y: 80 }),
        feature("line:v:105", { x: 105, y: 80 }),
      ],
    );

    expect(result.acquired).toBe(false);
    expect(result.candidateId).toBeNull();
    expect(result.reason).toBe("ambiguous");
  });

  it("abstains from weak source evidence", () => {
    const result = resolve(
      { x: 100, y: 80 },
      [feature("weak", { x: 101, y: 80 }, "line-center", 0.2)],
    );

    expect(result.acquired).toBe(false);
    expect(result.reason).toBe("none");
  });

  it("fails closed when source assistance is disabled", () => {
    const rawSource = { x: 100, y: 80 };
    const rawWorld = imagePointToWorld(rawSource, transform);
    const result = resolve(rawSource, [feature("strong", { x: 101, y: 80 })], { enabled: false });

    expect(result).toMatchObject({
      acquired: false,
      candidateId: null,
      kind: "none",
      sourcePoint: rawSource,
      worldPoint: rawWorld,
      reason: "disabled",
    });
  });

  it("fails closed when Alt/Option suppression is active", () => {
    const result = resolve(
      { x: 100, y: 80 },
      [feature("strong", { x: 101, y: 80 })],
      { suppressed: true },
    );

    expect(result.acquired).toBe(false);
    expect(result.reason).toBe("suppressed");
  });

  it.each([
    { x: -0.01, y: 50 },
    { x: 500.01, y: 50 },
    { x: 50, y: -0.01 },
    { x: 50, y: 400.01 },
  ])("does not query/acquire outside reference source bounds: $x,$y", (sourcePointer) => {
    const result = resolve(sourcePointer, [feature("strong", sourcePointer)]);

    expect(result.acquired).toBe(false);
    expect(result.reason).toBe("outside-reference");
    expect(result.worldPoint).toEqual(imagePointToWorld(sourcePointer, transform));
  });

  it("keeps an active candidate through the larger release radius", () => {
    const sourcePointer = { x: 100, y: 80 };
    // source viewport scale = 0.5 px/mm * 2 mm/source-px = 1 screen-px/source-px
    const active = feature("active", { x: 115, y: 80 });
    const result = resolve(sourcePointer, [active], { activeCandidateId: "active" });

    expect(result.acquired).toBe(true);
    expect(result.candidateId).toBe("active");
    expect(result.sourcePoint).toEqual(active.point);
  });

  it("keeps same-priority active line hysteresis even when another line becomes slightly closer", () => {
    const sourcePointer = { x: 100, y: 80 };
    const active = feature("line:h:88", { x: 100, y: 88 }, "line-center", 0.9);
    const closer = feature("line:h:84", { x: 100, y: 84 }, "line-center", 0.9);

    const result = resolve(sourcePointer, [active, closer], { activeCandidateId: active.id });

    expect(result.acquired).toBe(true);
    expect(result.kind).toBe("line-center");
    expect(result.candidateId).toBe(active.id);
    expect(result.sourcePoint).toEqual(active.point);
  });

  it("lets a newly acquired intersection preempt lower-priority active line hysteresis", () => {
    const sourcePointer = { x: 100, y: 80 };
    const activeLine = feature("line:h:80", { x: 100, y: 80 }, "line-center", 0.9);
    const corner = feature("intersection:100:80", { x: 100, y: 80 }, "intersection", 0.9);

    const result = resolve(sourcePointer, [activeLine, corner], { activeCandidateId: activeLine.id });

    expect(result.acquired).toBe(true);
    expect(result.kind).toBe("intersection");
    expect(result.candidateId).toBe(corner.id);
    expect(result.sourcePoint).toEqual(corner.point);
  });

  it("is deterministic for repeated identical input", () => {
    const sourcePointer = { x: 100, y: 80 };
    const features = [
      feature("intersection", { x: 103, y: 81 }, "intersection", 0.95),
      feature("line", { x: 103, y: 80 }, "line-center", 0.9),
    ];

    const first = resolve(sourcePointer, features);
    const second = resolve(sourcePointer, features);
    expect(second).toEqual(first);
  });
});

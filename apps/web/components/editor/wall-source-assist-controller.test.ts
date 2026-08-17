import { imagePointToWorld, type Point2, type StructuralSnapResult } from "@vlezet/geometry";
import type { ReferencePlan } from "@vlezet/projects";
import { describe, expect, it, vi } from "vitest";
import type { CalibrationSourceFeature } from "../reference/calibration-snap";
import { resolveWallDynamicDraft } from "./wall-dynamic-input-model";
import { resolveWallSourceAssistController } from "./wall-source-assist-controller";

const referencePlan: ReferencePlan = {
  assetId: "asset-1",
  referenceRevision: "rev-2",
  source: { kind: "image", originalMimeType: "image/png" },
  widthPx: 500,
  heightPx: 400,
  transform: {
    originWorld: { x: 0, y: 0 },
    millimetersPerPixel: 2,
    rotationDeg: 0,
  },
  calibration: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 100, y: 0 },
    knownLengthMm: 200,
    alignment: "none",
  },
  display: { visible: true, opacity: 0.5, locked: true },
};

const image = { naturalWidth: 500, naturalHeight: 400 } as HTMLImageElement;

function structural(kind: StructuralSnapResult["kind"], point: Point2 = { x: 200, y: 160 }): StructuralSnapResult {
  return {
    candidateId: kind === "none" ? null : `${kind}:candidate`,
    point,
    kind,
    label: kind === "none" ? null : kind,
    guides: [],
    target: ["endpoint", "junction"].includes(kind)
      ? { kind: "vertex", vertexId: "vertex-1", point }
      : ["midpoint", "intersection", "wall-axis"].includes(kind)
        ? { kind: "wall", wallId: "wall-1", point }
        : null,
  };
}

function feature(
  id: string,
  point: Point2,
  kind: CalibrationSourceFeature["kind"] = "line-center",
  strength = 0.9,
): CalibrationSourceFeature {
  return { id, point, kind, strength };
}

function resolve(patch: Partial<Parameters<typeof resolveWallSourceAssistController>[0]> = {}) {
  return resolveWallSourceAssistController({
    rawWorldPoint: { x: 200, y: 160 },
    structuralSnap: structural("grid"),
    referencePlan,
    referenceImage: image,
    pixelsPerMillimeter: 0.5,
    enabled: true,
    suppressed: false,
    activeCandidate: null,
    readFeatures: () => [feature("line:v:105", { x: 105, y: 80 })],
    ...patch,
  });
}

describe("M8.4 wall source assist controller", () => {
  it("preserves ordinary structural behavior and skips source reading when assistance is Off", () => {
    const readFeatures = vi.fn(() => [feature("line:v:105", { x: 105, y: 80 })]);
    const ordinary = structural("grid");
    const result = resolve({ structuralSnap: ordinary, enabled: false, readFeatures });

    expect(result.decision.structuralSnap).toBe(ordinary);
    expect(result.decision.authority).toBe("structural");
    expect(result.decision.point).toBe(ordinary.point);
    expect(result.sourceAssist).toBeNull();
    expect(result.activeCandidate).toBeNull();
    expect(readFeatures).not.toHaveBeenCalled();
  });

  it.each([
    { referencePlan: null, referenceImage: image },
    { referencePlan: { ...referencePlan, display: { ...referencePlan.display, visible: false } }, referenceImage: image },
    { referencePlan, referenceImage: null },
  ])("fails closed when a visible decoded reference is unavailable", (patch) => {
    const readFeatures = vi.fn(() => [feature("line:v:105", { x: 105, y: 80 })]);
    const result = resolve({ ...patch, readFeatures });

    expect(result.decision.authority).toBe("structural");
    expect(result.sourceAssist).toBeNull();
    expect(readFeatures).not.toHaveBeenCalled();
  });

  it.each(["endpoint", "junction", "midpoint", "intersection", "wall-axis"] as const)(
    "keeps %s topology authoritative without reading source pixels",
    (kind) => {
      const readFeatures = vi.fn(() => [feature("line:v:105", { x: 105, y: 80 })]);
      const ordinary = structural(kind);
      const result = resolve({ structuralSnap: ordinary, readFeatures });

      expect(result.decision.authority).toBe("structural");
      expect(result.decision.point).toBe(ordinary.point);
      expect(result.sourceAssist).toBeNull();
      expect(readFeatures).not.toHaveBeenCalled();
    },
  );

  it("lets a strong source line replace grid fallback and carries hysteresis identity", () => {
    const result = resolve();

    expect(result.decision.authority).toBe("source");
    expect(result.decision.point).toEqual(imagePointToWorld({ x: 105, y: 80 }, referencePlan.transform));
    expect(result.sourceAssist).toMatchObject({
      acquired: true,
      candidateId: "line:v:105",
      sourcePoint: { x: 105, y: 80 },
      reason: "acquired",
    });
    expect(result.activeCandidate).toEqual({ id: "line:v:105", referenceRevision: "rev-2" });
  });

  it("abstains to the exact ordinary result when source evidence is ambiguous", () => {
    const ordinary = structural("horizontal", { x: 210, y: 160 });
    const result = resolve({
      structuralSnap: ordinary,
      readFeatures: () => [
        feature("left", { x: 95, y: 80 }),
        feature("right", { x: 105, y: 80 }),
      ],
    });

    expect(result.decision.authority).toBe("structural");
    expect(result.decision.structuralSnap).toBe(ordinary);
    expect(result.decision.point).toBe(ordinary.point);
    expect(result.sourceAssist?.reason).toBe("ambiguous");
    expect(result.activeCandidate).toBeNull();
  });

  it("suppresses source assistance before reading pixels when Alt/Option is active", () => {
    const readFeatures = vi.fn(() => [feature("line:v:105", { x: 105, y: 80 })]);
    const ordinary = structural("grid");
    const result = resolve({ structuralSnap: ordinary, suppressed: true, readFeatures });

    expect(result.decision.point).toBe(ordinary.point);
    expect(result.decision.authority).toBe("structural");
    expect(result.sourceAssist).toBeNull();
    expect(readFeatures).not.toHaveBeenCalled();
  });

  it("fails closed to ordinary behavior when source image reading throws", () => {
    const ordinary = structural("vertical", { x: 200, y: 170 });
    const result = resolve({
      structuralSnap: ordinary,
      readFeatures: () => { throw new Error("canvas failed"); },
    });

    expect(result.decision.structuralSnap).toBe(ordinary);
    expect(result.decision.point).toBe(ordinary.point);
    expect(result.sourceAssist).toBeNull();
    expect(result.activeCandidate).toBeNull();
  });

  it("uses hysteresis only while the active candidate belongs to the current reference revision", () => {
    const activeFeature = feature("active", { x: 115, y: 80 });
    const current = resolve({
      activeCandidate: { id: "active", referenceRevision: "rev-2" },
      readFeatures: () => [activeFeature],
    });
    const stale = resolve({
      activeCandidate: { id: "active", referenceRevision: "rev-1" },
      readFeatures: () => [activeFeature],
    });

    expect(current.decision.authority).toBe("source");
    expect(current.activeCandidate?.id).toBe("active");
    expect(stale.decision.authority).toBe("structural");
    expect(stale.activeCandidate).toBeNull();
  });

  it("leaves exact length/angle input authoritative after pointer assistance", () => {
    const result = resolve();
    const exact = resolveWallDynamicDraft(
      { x: 0, y: 0 },
      result.decision.point,
      { lengthMm: 1000, angleDeg: 90 },
    );

    expect(result.decision.authority).toBe("source");
    expect(exact.point.x).toBeCloseTo(0, 8);
    expect(exact.point.y).toBeCloseTo(1000, 8);
  });
});

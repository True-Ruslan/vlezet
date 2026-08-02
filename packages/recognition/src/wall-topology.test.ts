import { describe, expect, it } from "vitest";
import {
  buildLocalWallTopology,
  type LocalWallCenterline,
} from "./wall-topology";

const OPTIONS = Object.freeze({
  endpointSnapTolerancePx: 8,
  endpointExtensionTolerancePx: 12,
  intersectionTolerancePx: 2,
  minimumEdgeLengthPx: 10,
});

function line(
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  evidenceCount = 2,
): LocalWallCenterline {
  return {
    startPx: { x: x1, y: y1 },
    endPx: { x: x2, y: y2 },
    thicknessPx: 18,
    evidenceCount,
    confidence: evidenceCount >= 3 ? "high" : "medium",
    reasons: ["paired-parallel-edges"],
  };
}

function semanticTopology(centerlines: readonly LocalWallCenterline[]) {
  const topology = buildLocalWallTopology({ ...OPTIONS, centerlines });
  return {
    junctions: topology.junctions,
    edges: topology.edges,
    diagnostics: topology.diagnostics,
  };
}

describe("local wall topology", () => {
  it("snaps a noisy corner into one degree-2 junction", () => {
    const topology = semanticTopology([
      line(100, 100, 500, 100),
      line(503, 97, 503, 500),
    ]);

    expect(topology.junctions.filter((junction) => junction.degree === 2)).toHaveLength(1);
    expect(topology.edges).toHaveLength(2);
  });

  it("extends and splits a T-junction deterministically", () => {
    const topology = semanticTopology([
      line(100, 200, 900, 200),
      line(500, 500, 500, 207),
    ]);

    expect(topology.edges).toHaveLength(3);
    expect(topology.junctions.some((junction) => junction.degree === 3)).toBe(true);
  });

  it("splits both walls at a cross intersection", () => {
    const topology = semanticTopology([
      line(100, 300, 900, 300),
      line(500, 100, 500, 700),
    ]);

    expect(topology.edges).toHaveLength(4);
    expect(topology.junctions.some((junction) => junction.degree === 4)).toBe(true);
  });

  it("merges collinear overlaps before graph construction", () => {
    const topology = semanticTopology([
      line(100, 200, 550, 200),
      line(500, 200, 900, 200),
    ]);

    expect(topology.edges).toHaveLength(1);
    expect(topology.edges[0]?.startPx.x).toBeCloseTo(100);
    expect(topology.edges[0]?.endPx.x).toBeCloseTo(900);
    expect(topology.edges[0]?.evidenceCount).toBe(4);
  });

  it("produces identical IDs for reversed and permuted inputs", () => {
    const forward = [
      line(100, 200, 900, 200),
      line(500, 100, 500, 700),
    ];
    const reversedPermutation = [
      line(500, 700, 500, 100),
      line(900, 200, 100, 200),
    ];

    expect(semanticTopology(forward)).toEqual(semanticTopology(reversedPermutation));
  });

  it("diagnoses disconnected isolated edges without emitting zero-length fragments", () => {
    const topology = semanticTopology([
      line(100, 100, 400, 100),
      line(700, 600, 900, 600),
      line(200, 300, 205, 300),
    ]);

    expect(topology.diagnostics.some((diagnostic) => diagnostic.code === "disconnected-components")).toBe(true);
    expect(topology.diagnostics.filter((diagnostic) => diagnostic.code === "isolated-edge")).toHaveLength(2);
    expect(topology.edges.every((edge) => Math.hypot(
      edge.endPx.x - edge.startPx.x,
      edge.endPx.y - edge.startPx.y,
    ) >= OPTIONS.minimumEdgeLengthPx)).toBe(true);
  });

  it("fails closed for invalid tolerances", () => {
    expect(() => buildLocalWallTopology({
      centerlines: [],
      ...OPTIONS,
      endpointSnapTolerancePx: -1,
    })).toThrow(/Допуск привязки/);
  });
});

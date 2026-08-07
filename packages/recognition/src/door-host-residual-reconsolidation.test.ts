import { describe, expect, it } from "vitest";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { reconsolidateDoorHostResiduals } from "./door-host-residual-reconsolidation";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  x2: number,
  reasons: readonly string[] = ["topology-edge", "filled-wall-region-evidence"],
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: 100 / HEIGHT },
    end: { x: x2 / WIDTH, y: 100 / HEIGHT },
    estimatedThicknessPx: 30,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: [...reasons] },
    origin: "local",
    conflict: null,
  };
}

function door(overrides: Partial<RecognitionOpeningCandidate> = {}): RecognitionOpeningCandidate {
  return {
    id: "entrance",
    kind: "door",
    hostWallCandidateId: "door-residual-after",
    center: { x: 435 / WIDTH, y: 100 / HEIGHT },
    widthPx: 90,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.78,
      cloudScore: null,
      reasons: ["host-wall-validated", "opening-span-validated", "perpendicular-door-leaf"],
    },
    origin: "local",
    conflict: null,
    ...overrides,
  };
}

const left = wall("left", 100, 330);
const residual = wall(
  "door-residual-after",
  330,
  590,
  [
    "door-host-residual",
    "door-leaf-anchored",
    "door-symbol-host-bridge",
    "filled-wall-region-evidence",
    "topology-edge",
  ],
);
const right = wall("right", 590, 900);

function run(
  walls: readonly RecognitionWallCandidate[] = [left, residual, right],
  openings: readonly RecognitionOpeningCandidate[] = [door()],
) {
  return reconsolidateDoorHostResiduals({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: walls,
    openings,
  });
}

describe("door host residual reconsolidation", () => {
  it("splits a sandwiched residual around its validated door and rebinds to the provenance-side stub", () => {
    const result = run();

    expect(result.reconsolidatedCount).toBe(1);
    expect(result.walls).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: "left", conflict: null }),
      expect.objectContaining({ id: "right", conflict: null }),
      expect.objectContaining({
        id: "door-residual-after",
        confidence: "low",
        conflict: "unsupported",
      }),
      expect.objectContaining({
        id: "door-residual-after-split-before",
        start: { x: 330 / WIDTH, y: 100 / HEIGHT },
        end: { x: 390 / WIDTH, y: 100 / HEIGHT },
        conflict: null,
      }),
      expect.objectContaining({
        id: "door-residual-after-split-after",
        start: { x: 480 / WIDTH, y: 100 / HEIGHT },
        end: { x: 590 / WIDTH, y: 100 / HEIGHT },
        conflict: null,
      }),
    ]));
    expect(result.openings).toEqual([
      expect.objectContaining({
        id: "entrance",
        hostWallCandidateId: "door-residual-after-split-before",
        evidence: expect.objectContaining({
          reasons: expect.arrayContaining(["door-host-residual-reconsolidated"]),
        }),
      }),
    ]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "door-host-residual-reconsolidated",
      candidateId: "door-residual-after",
    }));
  });

  it("does nothing without active collinear walls on both residual endpoints", () => {
    const result = run([left, residual], [door()]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([left, residual]);
    expect(result.openings).toEqual([door()]);
  });

  it("does nothing when no validated door is hosted by the residual", () => {
    const result = run([left, residual, right], []);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([left, residual, right]);
    expect(result.openings).toEqual([]);
  });

  it("does not split when either residual stub would be shorter than the safe fragment minimum", () => {
    const nearEdgeDoor = door({
      center: { x: 365 / WIDTH, y: 100 / HEIGHT },
      widthPx: 90,
    });
    const result = run([left, residual, right], [nearEdgeDoor]);

    expect(result.reconsolidatedCount).toBe(0);
    expect(result.walls).toEqual([left, residual, right]);
    expect(result.openings).toEqual([nearEdgeDoor]);
  });
});

import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { fuseRecognitionWallEvidence } from "./wall-evidence-fusion";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(input: Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  score?: number;
  thicknessPx?: number;
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: input.thicknessPx ?? 20,
    confidence: "medium",
    evidence: {
      localScore: input.score ?? 0.75,
      cloudScore: null,
      reasons: ["adaptive-hough-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

function fuse(
  primaryWalls: readonly RecognitionWallCandidate[],
  supplementalWalls: readonly RecognitionWallCandidate[],
) {
  return fuseRecognitionWallEvidence({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    primaryWalls,
    supplementalWalls,
  });
}

describe("recognition wall evidence fusion", () => {
  it("accepts a supplemental wall whose two endpoints are anchored to the primary network", () => {
    const result = fuse(
      [
        wall({ id: "left", x1: 200, y1: 100, x2: 200, y2: 500 }),
        wall({ id: "right", x1: 800, y1: 100, x2: 800, y2: 500 }),
      ],
      [wall({ id: "connector", x1: 200, y1: 300, x2: 800, y2: 300, score: 0.91 })],
    );

    expect(result.acceptedSupplementalCount).toBe(1);
    const supplemental = result.walls.find((candidate) => candidate.id.startsWith("supplemental-"));
    expect(supplemental).toMatchObject({
      confidence: "medium",
      origin: "local",
      conflict: null,
    });
    expect(supplemental?.evidence.reasons).toContain("supplemental-hough-topology-anchor");
  });

  it("rejects an isolated numeral-like segment", () => {
    const result = fuse(
      [wall({ id: "primary", x1: 100, y1: 100, x2: 900, y2: 100 })],
      [wall({ id: "numeral", x1: 450, y1: 260, x2: 550, y2: 260, score: 0.95 })],
    );

    expect(result.acceptedSupplementalCount).toBe(0);
    expect(result.walls.map((candidate) => candidate.id)).toEqual(["primary"]);
  });

  it("rejects a short furniture segment with only one structural anchor", () => {
    const result = fuse(
      [wall({ id: "primary", x1: 200, y1: 100, x2: 200, y2: 500 })],
      [wall({ id: "furniture", x1: 200, y1: 300, x2: 320, y2: 300, score: 0.9 })],
    );

    expect(result.acceptedSupplementalCount).toBe(0);
  });

  it("accepts a bounded collinear fragment that closes a gap between primary walls", () => {
    const result = fuse(
      [
        wall({ id: "left", x1: 100, y1: 300, x2: 450, y2: 300 }),
        wall({ id: "right", x1: 550, y1: 300, x2: 900, y2: 300 }),
      ],
      [wall({ id: "gap", x1: 440, y1: 302, x2: 560, y2: 302, score: 0.88 })],
    );

    expect(result.acceptedSupplementalCount).toBe(1);
    expect(result.walls.some((candidate) => candidate.evidence.reasons.includes("supplemental-hough-topology-anchor")))
      .toBe(true);
  });

  it("rejects a physical duplicate of a primary wall", () => {
    const result = fuse(
      [wall({ id: "primary", x1: 100, y1: 200, x2: 900, y2: 200 })],
      [wall({ id: "duplicate", x1: 120, y1: 205, x2: 880, y2: 205, score: 0.99 })],
    );

    expect(result.acceptedSupplementalCount).toBe(0);
    expect(result.walls).toHaveLength(1);
  });

  it("is deterministic under primary and supplemental input ordering", () => {
    const primary = [
      wall({ id: "left", x1: 200, y1: 100, x2: 200, y2: 500 }),
      wall({ id: "right", x1: 800, y1: 100, x2: 800, y2: 500 }),
    ];
    const supplemental = [
      wall({ id: "connector-low", x1: 200, y1: 350, x2: 800, y2: 350, score: 0.8 }),
      wall({ id: "connector-high", x1: 200, y1: 250, x2: 800, y2: 250, score: 0.9 }),
    ];

    expect(fuse([...primary].reverse(), [...supplemental].reverse()))
      .toEqual(fuse(primary, supplemental));
  });

  it("fails closed when the primary candidate budget is exceeded", () => {
    const primary = Array.from({ length: 97 }, (_, index) => wall({
      id: `primary-${String(index).padStart(3, "0")}`,
      x1: 20,
      y1: 20 + index * 4,
      x2: 980,
      y2: 20 + index * 4,
    }));

    const result = fuse(primary, [wall({ id: "supplement", x1: 200, y1: 100, x2: 800, y2: 100 })]);

    expect(result.acceptedSupplementalCount).toBe(0);
    expect(result.walls).toEqual([...primary].sort((first, second) => first.id.localeCompare(second.id)));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "wall-evidence-fusion-budget-exceeded",
      severity: "warning",
    }));
  });
});

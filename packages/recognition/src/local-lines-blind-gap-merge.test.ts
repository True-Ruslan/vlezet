import { describe, expect, it } from "vitest";
import { buildWallCandidates } from "./local-lines";

const WIDTH = 1000;
const HEIGHT = 800;

function wallFragment(x1: number, x2: number, y: number, thicknessPx = 20) {
  return [
    { x1, y1: y, x2, y2: y },
    { x1, y1: y + thicknessPx, x2, y2: y + thicknessPx },
  ] as const;
}

describe("blind collinear wall-gap merging", () => {
  it("preserves a large opening-sized gap for later window or door evidence", () => {
    const candidates = buildWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments: [
        ...wallFragment(100, 430, 200),
        ...wallFragment(490, 900, 200),
      ],
    });

    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) =>
      !candidate.evidence.reasons.includes("bounded-opening-gap-bridge"))).toBe(true);
  });

  it("still merges a small segmentation gap bounded by wall thickness", () => {
    const candidates = buildWallCandidates({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      segments: [
        ...wallFragment(100, 430, 200),
        ...wallFragment(450, 900, 200),
      ],
    });

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.evidence.reasons).toContain("bounded-opening-gap-bridge");
  });
});

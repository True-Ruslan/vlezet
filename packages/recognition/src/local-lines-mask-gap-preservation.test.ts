import { describe, expect, it } from "vitest";
import { buildWallCandidates } from "./local-lines";

const WIDTH = 1000;
const HEIGHT = 800;
const GAP_START = 430;
const GAP_END = 490;

function wallFragment(x1: number, x2: number, y: number, thicknessPx = 20) {
  return [
    { x1, y1: y, x2, y2: y },
    { x1, y1: y + thicknessPx, x2, y2: y + thicknessPx },
  ] as const;
}

function input(structuralInGap: boolean | null) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    segments: [
      ...wallFragment(100, GAP_START, 200),
      ...wallFragment(GAP_END, 900, 200),
    ],
    ...(structuralInGap === null
      ? {}
      : {
          structuralMask: {
            widthPx: WIDTH,
            heightPx: HEIGHT,
            isStructural: (x: number, y: number) => {
              const insideWallBand = y >= 199 && y <= 221;
              if (!insideWallBand) return false;
              if (x > GAP_START && x < GAP_END) return structuralInGap;
              return true;
            },
          },
        }),
  };
}

describe("mask-gated opening gap preservation", () => {
  it("keeps legacy merging when no structural mask is supplied", () => {
    const candidates = buildWallCandidates(input(null));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.evidence.reasons).toContain("bounded-opening-gap-bridge");
  });

  it("preserves a clean opening-sized corridor through topology construction", () => {
    const candidates = buildWallCandidates(input(false));

    expect(candidates).toHaveLength(2);
    expect(candidates.every((candidate) =>
      candidate.evidence.reasons.includes("mask-preserved-opening-gap"))).toBe(true);
    expect(candidates.some((candidate) =>
      candidate.evidence.reasons.includes("bounded-opening-gap-bridge"))).toBe(false);
  });

  it("still merges when the structural mask confirms continuity across the gap", () => {
    const candidates = buildWallCandidates(input(true));

    expect(candidates).toHaveLength(1);
    expect(candidates[0]?.evidence.reasons).toContain("bounded-opening-gap-bridge");
  });
});

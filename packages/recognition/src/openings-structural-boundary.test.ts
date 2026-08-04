import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { buildOpeningHypotheses } from "./openings";

const WIDTH = 1000;
const HEIGHT = 800;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["topology-edge"] },
    origin: "local",
    conflict: null,
  };
}

function network(targetY: number) {
  return [
    wall("target", 100, targetY, 900, targetY),
    wall("top-boundary", 100, 100, 900, 100),
    wall("bottom-boundary", 100, 700, 900, 700),
    wall("left-boundary", 100, 100, 100, 700),
    wall("right-boundary", 900, 100, 900, 700),
  ];
}

function openingKind(targetY: number) {
  const candidates = buildOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: network(targetY),
    wallSegments: [
      { x1: 100, y1: targetY - 10, x2: 400, y2: targetY - 10 },
      { x1: 520, y1: targetY - 10, x2: 900, y2: targetY - 10 },
    ],
    symbolSegments: [],
  });
  return candidates.find((candidate) => candidate.hostWallCandidateId === "target")?.kind ?? null;
}

describe("structural-network exterior boundary opening classification", () => {
  it("classifies a gap on the structural top boundary as a window despite image whitespace", () => {
    expect(openingKind(100)).toBe("window");
  });

  it("keeps an equivalent gap on an internal wall unknown", () => {
    expect(openingKind(300)).toBe("unknown-opening");
  });

  it("preserves the existing image-edge fallback", () => {
    const candidates = buildOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("target", 100, 30, 900, 30)],
      wallSegments: [
        { x1: 100, y1: 20, x2: 400, y2: 20 },
        { x1: 520, y1: 20, x2: 900, y2: 20 },
      ],
      symbolSegments: [],
    });

    expect(candidates.find((candidate) => candidate.hostWallCandidateId === "target")?.kind)
      .toBe("window");
  });
});

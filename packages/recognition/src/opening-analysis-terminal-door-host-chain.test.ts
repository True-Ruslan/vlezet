import { describe, expect, it } from "vitest";
import type {
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "./model";
import { validateOpeningHypotheses } from "./opening-analysis-runtime-with-window-proposals";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  options: Readonly<{
    conflict?: RecognitionWallCandidate["conflict"];
    reasons?: readonly string[];
  }> = {},
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 22,
    confidence: options.conflict ? "low" : "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: [...(options.reasons ?? ["filled-wall-region-evidence", "topology-edge"])],
    },
    origin: "local",
    conflict: options.conflict ?? null,
  };
}

function terminalDoor(exact = true): RecognitionOpeningCandidate {
  return {
    id: exact ? "terminal-chain-door" : "generic-chain-door",
    kind: "door",
    hostWallCandidateId: "residual-host",
    center: { x: 400 / WIDTH, y: 250 / HEIGHT },
    widthPx: 80,
    orientationDeg: 90,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: exact
        ? [
            "continuous-host-mask-door-gap",
            "door-host-residual",
            "door-leaf-anchored",
            "perpendicular-door-leaf",
            "terminal-host-mask-door-gap",
          ]
        : ["door-host-residual", "wall-gap"],
    },
    origin: "local",
    conflict: null,
  };
}

function validate(
  chainWall: RecognitionWallCandidate | null,
  candidate = terminalDoor(),
) {
  return validateOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("residual-host", 400, 300, 400, 500, {
        reasons: ["door-host-residual", "topology-edge"],
      }),
      ...(chainWall ? [chainWall] : []),
    ],
    hypotheses: [candidate],
  });
}

describe("terminal door host-chain validation", () => {
  it("accepts an exact terminal door through a connected active collinear host fragment", () => {
    const result = validate(wall("source-host", 400, 100, 400, 300, {
      reasons: [
        "bounded-opening-gap-bridge",
        "topology-mask-opening-gap-confidence-capped",
        "topology-edge",
      ],
    }));

    expect(result.rejections).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]?.evidence.reasons).toContain("host-wall-chain-validated");
  });

  it("keeps the outside-span rejection without a connected chain fragment", () => {
    const result = validate(null);

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("rejects a collinear fragment separated by more than the bounded chain gap", () => {
    const result = validate(wall("distant-source", 400, 100, 400, 270));

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("rejects a conflicting fragment", () => {
    const result = validate(wall("conflicting-source", 400, 100, 400, 300, {
      conflict: "unsupported",
    }));

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("does not grant chain validation to a generic door hypothesis", () => {
    const result = validate(
      wall("source-host", 400, 100, 400, 300),
      terminalDoor(false),
    );

    expect(result.candidates).toEqual([]);
    expect(result.rejections).toHaveLength(1);
    expect(result.rejections[0]?.code).toBe("opening-outside-host-span");
  });
});

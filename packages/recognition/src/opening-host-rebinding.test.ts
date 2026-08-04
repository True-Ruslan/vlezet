import { describe, expect, it } from "vitest";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
// RED: implemented after this contract is observed failing.
// @ts-expect-error planned M7.10 host rebinding module does not exist in the RED commit
import { rebindOpeningHypothesesToWalls } from "./opening-host-rebinding";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  conflict: RecognitionWallCandidate["conflict"] = null,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: 20,
    confidence: conflict === null ? "medium" : "low",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: ["door-symbol-host-bridge"],
    },
    origin: "local",
    conflict,
  };
}

function opening(
  id = "door",
  hostWallCandidateId = "stale-host",
  centerX = 500,
  centerY = 300,
  widthPx = 120,
  orientationDeg = 0,
): RecognitionOpeningCandidate {
  return {
    id,
    kind: "door",
    hostWallCandidateId,
    center: { x: centerX / WIDTH, y: centerY / HEIGHT },
    widthPx,
    orientationDeg,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: ["door-gap-from-bridge", "door-symbol-host-bridge"],
    },
    origin: "local",
    conflict: null,
  };
}

describe("post-topology opening host rebinding", () => {
  it("preserves an already active exact host", () => {
    const hypothesis = opening("door", "exact-host");
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("exact-host", 100, 300, 900, 300)],
      hypotheses: [hypothesis],
    });

    expect(result.reboundCount).toBe(0);
    expect(result.hypotheses).toEqual([hypothesis]);
    expect(result.diagnostics).toEqual([]);
  });

  it("rebinds a stale host id to one unique collinear wall containing the full opening span", () => {
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("post-topology-host", 100, 300, 900, 300)],
      hypotheses: [opening()],
    });

    expect(result.reboundCount).toBe(1);
    expect(result.hypotheses[0]).toMatchObject({
      id: "door",
      hostWallCandidateId: "post-topology-host",
    });
    expect(result.hypotheses[0]?.evidence.reasons).toContain("host-wall-rebound-by-geometry");
    expect(result.diagnostics).toContain("opening-host-rebound");
  });

  it("selects the only split wall segment that fully contains the opening", () => {
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("left-residual", 100, 300, 380, 300),
        wall("opening-host", 380, 300, 650, 300),
        wall("right-residual", 650, 300, 900, 300),
      ],
      hypotheses: [opening("door", "consumed-host", 500, 300, 120)],
    });

    expect(result.reboundCount).toBe(1);
    expect(result.hypotheses[0]?.hostWallCandidateId).toBe("opening-host");
  });

  it("supports rotated post-topology walls", () => {
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("rotated-host", 100, 100, 570, 570)],
      hypotheses: [opening("rotated-door", "stale", 365, 365, Math.hypot(130, 130), 45)],
    });

    expect(result.reboundCount).toBe(1);
    expect(result.hypotheses[0]?.hostWallCandidateId).toBe("rotated-host");
  });

  it("fails closed for ambiguous parallel twins", () => {
    const hypothesis = opening();
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("parallel-a", 100, 296, 900, 296),
        wall("parallel-b", 100, 304, 900, 304),
      ],
      hypotheses: [hypothesis],
    });

    expect(result.reboundCount).toBe(0);
    expect(result.hypotheses).toEqual([hypothesis]);
    expect(result.diagnostics).toContain("opening-host-rebind-ambiguous");
  });

  it("ignores conflicted walls and fails closed when no active host contains the opening", () => {
    const hypothesis = opening();
    const result = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("blocked", 100, 300, 900, 300, "unsupported"),
        wall("too-short", 100, 300, 450, 300),
        wall("wrong-angle", 500, 100, 500, 500),
      ],
      hypotheses: [hypothesis],
    });

    expect(result.reboundCount).toBe(0);
    expect(result.hypotheses).toEqual([hypothesis]);
    expect(result.diagnostics).toContain("opening-host-rebind-not-found");
  });

  it("is deterministic under input ordering", () => {
    const walls = [
      wall("left-residual", 100, 300, 380, 300),
      wall("opening-host", 380, 300, 650, 300),
      wall("right-residual", 650, 300, 900, 300),
    ];
    const hypotheses = [
      opening("door-b", "stale-b", 500, 300, 120),
      opening("door-a", "stale-a", 500, 300, 80),
    ];
    const forward = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: walls,
      hypotheses,
    });
    const reverse = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [...walls].reverse(),
      hypotheses: [...hypotheses].reverse(),
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when wall or hypothesis budgets are exceeded", () => {
    const hypothesis = opening();
    const wallBudget = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: Array.from({ length: 129 }, (_, index) =>
        wall(`wall-${index}`, 100, 100 + index, 900, 100 + index)),
      hypotheses: [hypothesis],
    });
    expect(wallBudget.reboundCount).toBe(0);
    expect(wallBudget.hypotheses).toEqual([hypothesis]);
    expect(wallBudget.diagnostics).toContain("opening-host-rebind-budget-exceeded");

    const hypothesisBudget = rebindOpeningHypothesesToWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("host", 100, 300, 900, 300)],
      hypotheses: Array.from({ length: 65 }, (_, index) => opening(`door-${index}`)),
    });
    expect(hypothesisBudget.reboundCount).toBe(0);
    expect(hypothesisBudget.hypotheses).toHaveLength(65);
    expect(hypothesisBudget.diagnostics).toContain("opening-host-rebind-budget-exceeded");
  });
});

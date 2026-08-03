import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { applyStructuralClutterVeto } from "./structural-clutter-veto";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 30,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function mask(predicate: (x: number, y: number) => boolean): StructuralMaskView {
  return { widthPx: WIDTH, heightPx: HEIGHT, isStructural: predicate };
}

const denseSymbols: DetectedLineSegment[] = [
  { x1: 455, y1: 285, x2: 545, y2: 285 },
  { x1: 455, y1: 315, x2: 545, y2: 315 },
  { x1: 470, y1: 270, x2: 470, y2: 330 },
];

function lowSupportMask(): StructuralMaskView {
  return mask((x, y) =>
    x >= 445 && x <= 555
    && ((y >= 282 && y <= 286) || (y >= 314 && y <= 318)));
}

describe("structural clutter veto", () => {
  it("blocks a short low-support one-anchor sanitary contour", () => {
    const anchor = wall("anchor", 450, 80, 450, 300, 30);
    const sanitary = wall("sanitary", 450, 300, 550, 300, 36);
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [anchor, sanitary],
      symbolSegments: denseSymbols,
      mask: lowSupportMask(),
    });

    expect(result.blockedCount).toBe(1);
    expect(result.walls.find((candidate) => candidate.id === "sanitary")).toMatchObject({
      confidence: "low",
      conflict: "unsupported",
    });
    expect(result.walls.find((candidate) => candidate.id === "sanitary")?.evidence.reasons)
      .toContain("structural-clutter-veto");
    expect(result.walls.find((candidate) => candidate.id === "anchor")?.conflict).toBeNull();
  });

  it("keeps a long partition even with sparse raster support", () => {
    const partition = wall("partition", 500, 50, 500, 550, 30);
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [partition],
      symbolSegments: denseSymbols,
      mask: lowSupportMask(),
    });
    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([partition]);
  });

  it("keeps a short wall attached to the network at both endpoints", () => {
    const left = wall("left", 450, 100, 450, 500, 30);
    const right = wall("right", 550, 100, 550, 500, 30);
    const bridge = wall("bridge", 450, 300, 550, 300, 36);
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [left, right, bridge],
      symbolSegments: denseSymbols,
      mask: lowSupportMask(),
    });
    expect(result.blockedCount).toBe(0);
    expect(result.walls.find((candidate) => candidate.id === "bridge")?.conflict).toBeNull();
  });

  it("keeps a short one-anchor wall with high structural support", () => {
    const anchor = wall("anchor", 450, 80, 450, 300, 30);
    const supported = wall("supported", 450, 300, 550, 300, 36);
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [anchor, supported],
      symbolSegments: denseSymbols,
      mask: mask((x, y) => x >= 445 && x <= 555 && y >= 280 && y <= 320),
    });
    expect(result.blockedCount).toBe(0);
    expect(result.walls.find((candidate) => candidate.id === "supported")?.conflict).toBeNull();
  });

  it("is deterministic under candidate and symbol ordering", () => {
    const candidates = [
      wall("anchor", 450, 80, 450, 300, 30),
      wall("sanitary", 450, 300, 550, 300, 36),
      wall("partition", 700, 50, 700, 550, 30),
    ];
    const forward = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: candidates,
      symbolSegments: denseSymbols,
      mask: lowSupportMask(),
    });
    const reverse = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [...candidates].reverse(),
      symbolSegments: [...denseSymbols].reverse(),
      mask: lowSupportMask(),
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when the candidate budget is exceeded", () => {
    const overloaded = Array.from({ length: 97 }, (_, index) =>
      wall(`wall-${String(index).padStart(3, "0")}`, 10, 10 + index * 4, 990, 10 + index * 4, 10));
    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: overloaded,
      symbolSegments: denseSymbols,
      mask: mask(() => false),
    });
    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([...overloaded].sort((first, second) => first.id.localeCompare(second.id)));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "structural-clutter-veto-budget-exceeded",
      severity: "warning",
    }));
  });
});

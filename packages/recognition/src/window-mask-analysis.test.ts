import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { detectMaskSupportedWindows } from "./window-mask-analysis";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(id = "host"): RecognitionWallCandidate {
  return {
    id,
    start: { x: 100 / WIDTH, y: 200 / HEIGHT },
    end: { x: 900 / WIDTH, y: 200 / HEIGHT },
    estimatedThicknessPx: 40,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function structuralMask(gapStart = 430, gapEnd = 570): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: (x, y) =>
      x >= 90 && x <= 910
      && y >= 178 && y <= 222
      && (x < gapStart || x > gapEnd),
  };
}

const windowRails: DetectedLineSegment[] = [
  { x1: 430, y1: 194, x2: 570, y2: 194 },
  { x1: 430, y1: 206, x2: 570, y2: 206 },
];

function summary(candidate: ReturnType<typeof detectMaskSupportedWindows>[number]) {
  return {
    id: candidate.id,
    kind: candidate.kind,
    host: candidate.hostWallCandidateId,
    center: [Math.round(candidate.center.x * WIDTH), Math.round(candidate.center.y * HEIGHT)],
    width: Math.round(candidate.widthPx ?? 0),
    confidence: candidate.confidence,
    reasons: candidate.evidence.reasons,
  };
}

describe("mask-supported window analysis", () => {
  it("emits one host-bound window for a bounded structural gap with two rails", () => {
    const result = detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      symbolSegments: windowRails,
      mask: structuralMask(),
    });

    expect(result).toHaveLength(1);
    expect(summary(result[0]!)).toMatchObject({
      kind: "window",
      host: "host",
      center: [500, 200],
      width: 140,
      confidence: "medium",
    });
    expect(result[0]?.evidence.reasons).toContain("mask-supported-window-gap");
    expect(result[0]?.evidence.reasons).toContain("paired-window-rails");
  });

  it("does not emit a window from one rail", () => {
    expect(detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      symbolSegments: windowRails.slice(0, 1),
      mask: structuralMask(),
    })).toEqual([]);
  });

  it("does not classify a door gap with a perpendicular anchored leaf as a window", () => {
    const doorLeaf: DetectedLineSegment = { x1: 430, y1: 200, x2: 430, y2: 320 };
    expect(detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      symbolSegments: [...windowRails, doorLeaf],
      mask: structuralMask(),
    })).toEqual([]);
  });

  it("rejects a low-occupancy interval at the host-wall endpoint", () => {
    const endGapMask: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural: (x, y) => x >= 250 && x <= 910 && y >= 178 && y <= 222,
    };
    const endRails: DetectedLineSegment[] = [
      { x1: 100, y1: 194, x2: 250, y2: 194 },
      { x1: 100, y1: 206, x2: 250, y2: 206 },
    ];
    expect(detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall()],
      symbolSegments: endRails,
      mask: endGapMask,
    })).toEqual([]);
  });

  it("is deterministic under wall and symbol input ordering", () => {
    const secondWall: RecognitionWallCandidate = {
      ...wall("second"),
      start: { x: 100 / WIDTH, y: 400 / HEIGHT },
      end: { x: 900 / WIDTH, y: 400 / HEIGHT },
    };
    const mask: StructuralMaskView = {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural: (x, y) =>
        x >= 90 && x <= 910
        && ((y >= 178 && y <= 222) || (y >= 378 && y <= 422))
        && (x < 430 || x > 570),
    };
    const rails = [
      ...windowRails,
      { x1: 430, y1: 394, x2: 570, y2: 394 },
      { x1: 430, y1: 406, x2: 570, y2: 406 },
    ];
    const forward = detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall(), secondWall],
      symbolSegments: rails,
      mask,
    });
    const reverse = detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [secondWall, wall()],
      symbolSegments: [...rails].reverse(),
      mask,
    });
    expect(reverse).toEqual(forward);
  });

  it("fails closed when the wall budget is exceeded", () => {
    const overloaded = Array.from({ length: 97 }, (_, index) => ({
      ...wall(`wall-${String(index).padStart(3, "0")}`),
      start: { x: 0.1, y: (20 + index * 4) / HEIGHT },
      end: { x: 0.9, y: (20 + index * 4) / HEIGHT },
    }));
    expect(detectMaskSupportedWindows({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: overloaded,
      symbolSegments: windowRails,
      mask: structuralMask(),
    })).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { recoverWindowTerminalHosts } from "./window-terminal-host-recovery";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx = 24,
): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: y1 / HEIGHT },
    end: { x: x2 / WIDTH, y: y2 / HEIGHT },
    estimatedThicknessPx: thicknessPx,
    confidence: "medium",
    evidence: { localScore: 0.74, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function segment(x1: number, y1: number, x2: number, y2: number): DetectedLineSegment {
  return { x1, y1, x2, y2 };
}

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

const source = wall("source-host", 500, 100, 500, 300, 24);
const anchor = wall("bottom-anchor", 250, 470, 750, 470, 30);
const rails: DetectedLineSegment[] = [
  segment(496, 330, 496, 440),
  segment(504, 330, 504, 440),
];

describe("terminal window host recovery", () => {
  it("extends one known host to an independent perpendicular anchor when paired rails occupy the terminal span", () => {
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, anchor],
      symbolSegments: rails,
    });

    expect(result.recoveredHosts).toHaveLength(1);
    expect(result.recoveredHostCount).toBe(1);
    expect(coordinates(result.recoveredHosts[0]!)).toEqual([500, 300, 500, 470]);
    expect(result.recoveredHosts[0]?.confidence).toBe("medium");
    expect(result.recoveredHosts[0]?.evidence.reasons).toEqual(expect.arrayContaining([
      "paired-window-rails",
      "perpendicular-structural-anchor",
      "window-symbol-host-bridge",
      "window-terminal-host-extension",
    ]));

    expect(result.proposalEvidence).toHaveLength(1);
    expect(result.proposalEvidence[0]).toMatchObject({
      sourceWallCandidateIds: ["source-host", "bottom-anchor"],
      bridgeKind: "symbol",
      openingEligible: true,
      gap: {
        center: { x: 500, y: 385 },
        widthPx: 110,
        orientationDeg: 90,
      },
    });
  });

  it("rejects a single rail even with a valid source and perpendicular anchor", () => {
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, anchor],
      symbolSegments: rails.slice(0, 1),
    });
    expect(result.recoveredHosts).toEqual([]);
    expect(result.proposalEvidence).toEqual([]);
  });

  it("rejects paired rails that are outside the source-host thickness band", () => {
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, anchor],
      symbolSegments: [
        segment(450, 330, 450, 440),
        segment(458, 330, 458, 440),
      ],
    });
    expect(result.recoveredHosts).toEqual([]);
  });

  it("rejects rails without an independent perpendicular terminal anchor", () => {
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source],
      symbolSegments: rails,
    });
    expect(result.recoveredHosts).toEqual([]);
  });

  it("rejects a terminal span when the rail window leaves less than the bounded evidence margin", () => {
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, anchor],
      symbolSegments: [
        segment(496, 306, 496, 458),
        segment(504, 306, 504, 458),
      ],
    });
    expect(result.recoveredHosts).toEqual([]);
  });

  it("rejects an extension crossing another active structural wall", () => {
    const blocker = wall("interior-blocker", 300, 380, 700, 380, 24);
    const result = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, blocker, anchor],
      symbolSegments: rails,
    });
    expect(result.recoveredHosts).toEqual([]);
  });

  it("is deterministic under wall and symbol ordering", () => {
    const forward = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [source, anchor],
      symbolSegments: rails,
    });
    const reverse = recoverWindowTerminalHosts({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [anchor, source],
      symbolSegments: [...rails].reverse(),
    });
    expect(reverse).toEqual(forward);
  });
});

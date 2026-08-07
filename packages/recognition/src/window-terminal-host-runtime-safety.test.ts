import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { consolidateWindowHostWalls } from "./window-host-consolidation-runtime";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  thicknessPx: number,
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

const rails: DetectedLineSegment[] = [
  { x1: 496, y1: 330, x2: 496, y2: 440 },
  { x1: 504, y1: 330, x2: 504, y2: 440 },
];
const anchor = wall("bottom-anchor", 250, 470, 750, 470, 30);

function terminalIds(result: ReturnType<typeof consolidateWindowHostWalls>): string[] {
  return result.walls
    .map((candidate) => candidate.id)
    .filter((id) => id.startsWith("local-window-terminal-"));
}

describe("terminal window host runtime safety", () => {
  it("rejects terminal recovery from a weak thin-wall source", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [wall("weak-source", 500, 100, 500, 300, 2), anchor],
      symbolSegments: rails,
    });

    expect(terminalIds(result)).toEqual([]);
    expect(result.diagnostics).toContain("window-terminal-host-weak-source-rejected");
  });

  it("rejects terminal recovery when a substantial collinear continuation already occupies the extension", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("source", 500, 100, 500, 300, 24),
        wall("existing-continuation", 500, 360, 500, 430, 24),
        anchor,
      ],
      symbolSegments: rails,
    });

    expect(terminalIds(result)).toEqual([]);
    expect(result.diagnostics).toContain("window-terminal-host-existing-continuation-rejected");
  });

  it("keeps an anchored robust terminal source eligible when only a short collinear terminal fragment exists", () => {
    const result = consolidateWindowHostWalls({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [
        wall("source", 500, 100, 500, 300, 24),
        wall("short-terminal-fragment", 500, 300, 500, 312, 24),
        anchor,
      ],
      symbolSegments: rails,
    });

    expect(terminalIds(result)).toHaveLength(1);
    expect(result.proposalEvidence.some((evidence) =>
      evidence.generatedHost.candidateId.startsWith("local-window-terminal-")
      && evidence.openingEligible)).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { applyStructuralClutterVeto } from "./structural-clutter-veto";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(input: Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessPx: number;
  retained?: boolean;
  conflict?: RecognitionWallCandidate["conflict"];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: input.thicknessPx,
    confidence: input.conflict ? "low" : "medium",
    evidence: {
      localScore: input.conflict ? 0.45 : 0.72,
      cloudScore: null,
      reasons: input.retained
        ? [
            "dominant-wall-thickness-band",
            "paired-parallel-edges",
            "retained-disconnected-structural-component",
            "topology-edge",
          ]
        : [
            "dominant-wall-thickness-band",
            "paired-parallel-edges",
            "primary-structural-component",
            "topology-edge",
          ],
    },
    origin: "local",
    conflict: input.conflict ?? null,
  };
}

function denseMask(): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: () => true,
  };
}

describe("disconnected structural blob veto", () => {
  it("blocks an active retained disconnected component shorter than its own structural thickness", () => {
    const blob = wall({
      id: "retained-blob",
      x1: 500,
      y1: 300,
      x2: 513,
      y2: 300,
      thicknessPx: 26,
      retained: true,
    });

    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [blob],
      symbolSegments: [],
      mask: denseMask(),
    });

    expect(result.blockedCount).toBe(1);
    expect(result.walls[0]).toMatchObject({
      id: "retained-blob",
      confidence: "low",
      conflict: "unsupported",
    });
    expect(result.walls[0]?.evidence.reasons).toContain("disconnected-structural-blob-veto");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "disconnected-structural-blob-veto",
      candidateId: "retained-blob",
    }));
  });

  it("keeps the same compact geometry when it belongs to the primary structural component", () => {
    const primary = wall({
      id: "primary-blob",
      x1: 500,
      y1: 300,
      x2: 513,
      y2: 300,
      thicknessPx: 26,
    });

    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [primary],
      symbolSegments: [],
      mask: denseMask(),
    });

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([primary]);
  });

  it("keeps a retained disconnected component once it has a real wall-like run length", () => {
    const run = wall({
      id: "retained-run",
      x1: 450,
      y1: 300,
      x2: 480,
      y2: 300,
      thicknessPx: 26,
      retained: true,
    });

    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [run],
      symbolSegments: [],
      mask: denseMask(),
    });

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([run]);
  });

  it("does not count an already unsupported retained blob as a new veto decision", () => {
    const unsupported = wall({
      id: "already-unsupported",
      x1: 500,
      y1: 300,
      x2: 513,
      y2: 300,
      thicknessPx: 26,
      retained: true,
      conflict: "unsupported",
    });

    const result = applyStructuralClutterVeto({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [unsupported],
      symbolSegments: [],
      mask: denseMask(),
    });

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([unsupported]);
  });
});

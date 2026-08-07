import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import type { StructuralMaskView } from "./wall-completion";
import { applyStructuralClutterVeto } from "./structural-clutter-veto";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(input: Readonly<{
  id: string;
  lengthPx: number;
  thicknessPx: number;
  reasons?: readonly string[];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: 0.4, y: 0.5 },
    end: { x: (400 + input.lengthPx) / WIDTH, y: 0.5 },
    estimatedThicknessPx: input.thicknessPx,
    confidence: "medium",
    evidence: {
      localScore: 0.72,
      cloudScore: null,
      reasons: input.reasons
        ? [...input.reasons]
        : [
            "architectural-line-filter",
            "dominant-wall-thickness-band",
            "evidence:1",
            "filled-wall-region-evidence",
            "junction-degree:1",
            "paired-parallel-edges",
            "primary-structural-component",
            "topology-edge",
          ],
    },
    origin: "local",
    conflict: null,
  };
}

function denseMask(): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural: () => true,
  };
}

function apply(candidate: RecognitionWallCandidate) {
  return applyStructuralClutterVeto({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [candidate],
    symbolSegments: [],
    mask: denseMask(),
  });
}

describe("primary structural blob veto", () => {
  it("blocks a one-ended primary structural fragment shorter than 0.8 of its own thickness", () => {
    const blob = wall({ id: "primary-blob", lengthPx: 15.9, thicknessPx: 21 });

    const result = apply(blob);

    expect(result.blockedCount).toBe(1);
    expect(result.walls[0]).toMatchObject({
      id: "primary-blob",
      confidence: "low",
      conflict: "unsupported",
    });
    expect(result.walls[0]?.evidence.reasons).toContain("primary-structural-blob-veto");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "primary-structural-blob-veto",
      candidateId: "primary-blob",
    }));
  });

  it("keeps the same compact geometry when it is not a one-ended topology fragment", () => {
    const candidate = wall({
      id: "junction-supported",
      lengthPx: 15.9,
      thicknessPx: 21,
      reasons: [
        "architectural-line-filter",
        "dominant-wall-thickness-band",
        "filled-wall-region-evidence",
        "junction-degree:2",
        "paired-parallel-edges",
        "primary-structural-component",
        "topology-edge",
      ],
    });

    const result = apply(candidate);

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([candidate]);
  });

  it("keeps a compact primary fragment with independent wall-run support", () => {
    const candidate = wall({
      id: "supported-run",
      lengthPx: 15.9,
      thicknessPx: 21,
      reasons: [
        "architectural-line-filter",
        "dominant-wall-thickness-band",
        "filled-wall-region-evidence",
        "junction-degree:1",
        "mask-supported-wall-run",
        "paired-parallel-edges",
        "primary-structural-component",
        "topology-edge",
      ],
    });

    const result = apply(candidate);

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([candidate]);
  });

  it("keeps a one-ended primary component once its length is wall-like", () => {
    const candidate = wall({ id: "wall-like-run", lengthPx: 42, thicknessPx: 21 });

    const result = apply(candidate);

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toEqual([candidate]);
  });
});

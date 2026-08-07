import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { analyzeOpeningHypotheses } from "./opening-analysis-runtime-with-window-proposals";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 818;
const HEIGHT = 1270;

function wall(id: string): RecognitionWallCandidate {
  return {
    id,
    start: { x: 124 / WIDTH, y: 959.5 / HEIGHT },
    end: { x: 290 / WIDTH, y: 959.5 / HEIGHT },
    estimatedThicknessPx: 29,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: [
        "paired-window-rails",
        "perpendicular-structural-anchor",
        "short-terminal-jamb-evidence",
        "window-boundary-band-recovery",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

function candidate(extraReasons: readonly string[] = []): RecognitionOpeningCandidate {
  return {
    id: "boundary-band-window",
    kind: "window",
    hostWallCandidateId: "recovered-host",
    center: { x: 219.5 / WIDTH, y: 959.5 / HEIGHT },
    widthPx: 135,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: 0.76,
      cloudScore: null,
      reasons: [
        "host-wall-validated",
        "opening-span-validated",
        "paired-window-rails",
        "window-host-proposal-evidence",
        ...extraReasons,
      ],
    },
    origin: "local",
    conflict: null,
  };
}

const jambs: DetectedLineSegment[] = [
  { x1: 287, y1: 945, x2: 287, y2: 973 },
  { x1: 293, y1: 945, x2: 294, y2: 973 },
];

function mask(enabled = true): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y) {
      return enabled && x >= 285 && x <= 296 && y >= 942 && y <= 976;
    },
  };
}

function run(input: Readonly<{
  segments?: readonly DetectedLineSegment[];
  mask?: StructuralMaskView;
  proposal?: RecognitionOpeningCandidate;
}> = {}) {
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [wall("recovered-host")],
    symbolSegments: input.segments ?? jambs,
    structuralMask: input.mask ?? mask(),
    additionalHypotheses: [input.proposal ?? candidate(["short-terminal-jamb-evidence"])],
  });
}

describe("short structural jamb exact-window retry", () => {
  it("accepts one deficient end only for exact proposal evidence with a paired mask-supported short jamb", () => {
    const result = run();
    const accepted = result.candidates.find(({ id }) => id === "boundary-band-window");
    expect(accepted).toBeDefined();
    expect(accepted?.evidence.reasons).toContain("short-structural-jamb-terminated");
    expect(result.rejections.some(({ candidateId }) => candidateId === "boundary-band-window")).toBe(false);
  });

  it("keeps the ordinary end-margin rejection with only one jamb edge", () => {
    const result = run({ segments: jambs.slice(0, 1) });
    expect(result.candidates.some(({ id }) => id === "boundary-band-window")).toBe(false);
    expect(result.rejections.find(({ candidateId }) => candidateId === "boundary-band-window")?.code)
      .toBe("opening-end-margin");
  });

  it("keeps the ordinary end-margin rejection when jamb ink is not structural", () => {
    const result = run({ mask: mask(false) });
    expect(result.candidates.some(({ id }) => id === "boundary-band-window")).toBe(false);
    expect(result.rejections.find(({ candidateId }) => candidateId === "boundary-band-window")?.code)
      .toBe("opening-end-margin");
  });

  it("does not grant the short-jamb exception to ordinary exact window proposals", () => {
    const result = run({ proposal: candidate() });
    expect(result.candidates.some(({ id }) => id === "boundary-band-window")).toBe(false);
    expect(result.rejections.find(({ candidateId }) => candidateId === "boundary-band-window")?.code)
      .toBe("opening-end-margin");
  });
});

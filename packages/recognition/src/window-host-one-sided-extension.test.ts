import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import { applyStructuralClutterVeto } from "./structural-clutter-veto-runtime";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;
const AXIS_Y = 200;
const THICKNESS = 32;

function wall(id: string, x1: number, x2: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: x1 / WIDTH, y: AXIS_Y / HEIGHT },
    end: { x: x2 / WIDTH, y: AXIS_Y / HEIGHT },
    estimatedThicknessPx: THICKNESS,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

const rails: readonly DetectedLineSegment[] = [
  { x1: 247.5, y1: 193, x2: 382.5, y2: 193 },
  { x1: 247.5, y1: 200, x2: 382.5, y2: 200 },
  { x1: 247.5, y1: 207, x2: 382.5, y2: 207 },
];

function mask(includeSeparator: boolean): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (Math.abs(y - AXIS_Y) > THICKNESS / 2) return false;
      return (x >= 100 && x <= 247)
        || (includeSeparator && x >= 382 && x <= 450)
        || (x >= 540 && x <= 900);
    },
  };
}

function run(input: Readonly<{
  symbolSegments?: readonly DetectedLineSegment[];
  includeSeparator?: boolean;
  includeRightAnchor?: boolean;
}> = {}) {
  return applyStructuralClutterVeto({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [
      wall("left", 100, 247),
      ...(input.includeRightAnchor === false ? [] : [wall("right", 540, 900)]),
    ],
    symbolSegments: input.symbolSegments ?? rails,
    mask: mask(input.includeSeparator !== false),
  });
}

function endX(candidate: RecognitionWallCandidate): number {
  return Math.round(Math.max(candidate.start.x, candidate.end.x) * WIDTH);
}

describe("one-sided window host extension", () => {
  it("extends an existing host through paired rails and a mask-backed separator", () => {
    const result = run();

    expect(result.blockedCount).toBe(0);
    expect(result.walls).toHaveLength(2);
    const left = result.walls.find((candidate) => candidate.id === "left")!;
    expect(endX(left)).toBe(450);
    expect(left.confidence).toBe("medium");
    expect(left.evidence.reasons).toEqual(expect.arrayContaining([
      "one-sided-window-host-extension",
      "paired-window-rails",
      "mask-backed-window-separator",
    ]));
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "window-host-one-sided-extension",
    }));
  });

  it("does not extend without paired rails", () => {
    const result = run({ symbolSegments: rails.slice(0, 1) });

    expect(endX(result.walls.find((candidate) => candidate.id === "left")!)).toBe(247);
  });

  it("does not extend without a mask-backed separator", () => {
    const result = run({ includeSeparator: false });

    expect(endX(result.walls.find((candidate) => candidate.id === "left")!)).toBe(247);
  });

  it("does not extend without a second structural anchor after a door-sized gap", () => {
    const result = run({ includeRightAnchor: false });

    expect(endX(result.walls.find((candidate) => candidate.id === "left")!)).toBe(247);
  });
});

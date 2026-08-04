import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { sanitizeRecognitionWallTopology } from "./topology-sanity";

const WIDTH = 1000;
const HEIGHT = 600;

type Rect = Readonly<{ x1: number; y1: number; x2: number; y2: number }>;

function wall(input: Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessPx?: number;
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: input.thicknessPx ?? 23,
    confidence: "high",
    evidence: {
      localScore: 0.88,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence", "paired-boundaries", "structural-region"],
    },
    origin: "local",
    conflict: null,
  };
}

function mask(rectangles: readonly Rect[]) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x: number, y: number): boolean {
      return rectangles.some((rectangle) =>
        x >= rectangle.x1 && x <= rectangle.x2 && y >= rectangle.y1 && y <= rectangle.y2);
    },
  };
}

function input(structuralMask: ReturnType<typeof mask>) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    millimetersPerPixel: 10,
    structuralMask,
    wallCandidates: [
      wall({ id: "double-trimmed", x1: 360, y1: 20, x2: 360, y2: 130 }),
      wall({ id: "upper", x1: 100, y1: 55, x2: 800, y2: 55 }),
      wall({ id: "lower", x1: 100, y1: 95, x2: 800, y2: 95 }),
    ],
  } as const;
}

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

describe("double-trimmed topology continuity", () => {
  it("blocks a short double-trimmed bridge whose central span has no structural continuity", () => {
    const result = sanitizeRecognitionWallTopology(input(mask([
      { x1: 100, y1: 44, x2: 800, y2: 66 },
      { x1: 100, y1: 84, x2: 800, y2: 106 },
    ])));

    const candidate = result.walls.find((wallCandidate) => wallCandidate.id === "double-trimmed")!;
    expect(coordinates(candidate)).toEqual([360, 55, 360, 95]);
    expect(candidate).toMatchObject({ confidence: "low", conflict: "unsupported" });
    expect(candidate.evidence.reasons).toContain("topology-double-trim-low-continuity");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "topology-double-trim-low-continuity",
      candidateId: "double-trimmed",
    }));
  });

  it("keeps an equally short double-trimmed connector when the central span is continuous", () => {
    const result = sanitizeRecognitionWallTopology(input(mask([
      { x1: 100, y1: 44, x2: 800, y2: 66 },
      { x1: 100, y1: 84, x2: 800, y2: 106 },
      { x1: 349, y1: 55, x2: 371, y2: 95 },
    ])));

    const candidate = result.walls.find((wallCandidate) => wallCandidate.id === "double-trimmed")!;
    expect(coordinates(candidate)).toEqual([360, 55, 360, 95]);
    expect(candidate).toMatchObject({ confidence: "high", conflict: null });
    expect(candidate.evidence.reasons).toContain("topology-endpoint-overshoot-trimmed");
    expect(candidate.evidence.reasons).not.toContain("topology-double-trim-low-continuity");
  });

  it("preserves legacy fail-closed behavior when no structural mask is supplied", () => {
    const source = input(mask([]));
    const { structuralMask: _mask, ...withoutMask } = source;
    const result = sanitizeRecognitionWallTopology(withoutMask);

    expect(result.walls.find((candidate) => candidate.id === "double-trimmed"))
      .toMatchObject({ confidence: "high", conflict: null });
  });
});

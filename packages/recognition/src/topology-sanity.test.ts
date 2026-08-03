import { describe, expect, it } from "vitest";
import type { RecognitionWallCandidate } from "./model";
import { sanitizeRecognitionWallTopology } from "./topology-sanity";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(input: Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  thicknessPx?: number;
  score?: number;
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: input.thicknessPx ?? 20,
    confidence: "high",
    evidence: {
      localScore: input.score ?? 0.9,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

function coordinates(candidate: RecognitionWallCandidate): [number, number, number, number] {
  return [
    Math.round(candidate.start.x * WIDTH),
    Math.round(candidate.start.y * HEIGHT),
    Math.round(candidate.end.x * WIDTH),
    Math.round(candidate.end.y * HEIGHT),
  ];
}

describe("recognition topology sanitation", () => {
  it("trims a bounded endpoint overshoot to an existing perpendicular intersection", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "horizontal", x1: 100, y1: 200, x2: 860, y2: 200 }),
        wall({ id: "vertical", x1: 820, y1: 100, x2: 820, y2: 500 }),
      ],
    });

    expect(coordinates(result.walls.find((candidate) => candidate.id === "horizontal")!))
      .toEqual([100, 200, 820, 200]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "topology-endpoint-overshoot-trimmed",
      candidateId: "horizontal",
    }));
  });

  it("trims the same bounded overshoot for a thin raster wall", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "horizontal", x1: 100, y1: 200, x2: 860, y2: 200, thicknessPx: 10 }),
        wall({ id: "vertical", x1: 820, y1: 100, x2: 820, y2: 500, thicknessPx: 10 }),
      ],
    });

    expect(coordinates(result.walls.find((candidate) => candidate.id === "horizontal")!))
      .toEqual([100, 200, 820, 200]);
  });

  it("rejects a short stub instead of collapsing it to a zero-length wall", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "stub", x1: 373, y1: 56, x2: 389, y2: 56, thicknessPx: 38 }),
        wall({ id: "vertical", x1: 373, y1: 56, x2: 373, y2: 250, thicknessPx: 28 }),
      ],
    });

    const stub = result.walls.find((candidate) => candidate.id === "stub")!;
    expect(coordinates(stub)).toEqual([373, 56, 389, 56]);
    expect(stub).toMatchObject({ confidence: "low", conflict: "unsupported" });
    expect(stub.evidence.reasons).toContain("topology-degenerate-after-trim");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "topology-degenerate-after-trim",
      candidateId: "stub",
    }));
  });

  it("never extends a wall endpoint forward to reach a perpendicular wall", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "horizontal", x1: 100, y1: 200, x2: 780, y2: 200 }),
        wall({ id: "vertical", x1: 820, y1: 100, x2: 820, y2: 500 }),
      ],
    });

    expect(coordinates(result.walls.find((candidate) => candidate.id === "horizontal")!))
      .toEqual([100, 200, 780, 200]);
  });

  it("blocks the weaker of two physically overlapping parallel wall candidates", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "primary", x1: 100, y1: 200, x2: 900, y2: 200, thicknessPx: 24, score: 0.94 }),
        wall({ id: "duplicate", x1: 120, y1: 210, x2: 880, y2: 210, thicknessPx: 24, score: 0.7 }),
      ],
    });

    expect(result.walls.find((candidate) => candidate.id === "primary")?.conflict).toBeNull();
    expect(result.walls.find((candidate) => candidate.id === "duplicate")).toMatchObject({
      confidence: "low",
      conflict: "unsupported",
    });
    expect(result.walls.find((candidate) => candidate.id === "duplicate")?.evidence.reasons)
      .toContain("topology-parallel-duplicate");
  });

  it("keeps distinct parallel corridor walls when their physical bands do not overlap", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "upper", x1: 100, y1: 180, x2: 900, y2: 180, thicknessPx: 20 }),
        wall({ id: "lower", x1: 100, y1: 260, x2: 900, y2: 260, thicknessPx: 20 }),
      ],
    });

    expect(result.walls.every((candidate) => candidate.conflict === null)).toBe(true);
  });

  it("keeps widely separated candidates when raw raster thickness is implausibly large", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 2,
      wallCandidates: [
        wall({ id: "upper", x1: 100, y1: 100, x2: 900, y2: 100, thicknessPx: 200 }),
        wall({ id: "middle", x1: 100, y1: 300, x2: 900, y2: 300, thicknessPx: 400 }),
        wall({ id: "lower", x1: 100, y1: 500, x2: 900, y2: 500, thicknessPx: 600 }),
      ],
    });

    expect(result.walls.every((candidate) => candidate.conflict === null)).toBe(true);
  });

  it("blocks a closed service-symbol enclosure below 0.5 square metres", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "top", x1: 500, y1: 300, x2: 550, y2: 300 }),
        wall({ id: "right", x1: 550, y1: 300, x2: 550, y2: 350 }),
        wall({ id: "bottom", x1: 550, y1: 350, x2: 500, y2: 350 }),
        wall({ id: "left", x1: 500, y1: 350, x2: 500, y2: 300 }),
      ],
    });

    expect(result.walls.every((candidate) => candidate.conflict === "unsupported")).toBe(true);
    expect(result.walls.every((candidate) => candidate.confidence === "low")).toBe(true);
    expect(result.diagnostics.filter((item) => item.code === "topology-small-enclosure"))
      .toHaveLength(4);
  });

  it("keeps an otherwise identical structural room above the minimum area", () => {
    const result = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [
        wall({ id: "top", x1: 400, y1: 200, x2: 520, y2: 200 }),
        wall({ id: "right", x1: 520, y1: 200, x2: 520, y2: 320 }),
        wall({ id: "bottom", x1: 520, y1: 320, x2: 400, y2: 320 }),
        wall({ id: "left", x1: 400, y1: 320, x2: 400, y2: 200 }),
      ],
    });

    expect(result.walls.every((candidate) => candidate.conflict === null)).toBe(true);
  });

  it("is deterministic under input ordering", () => {
    const candidates = [
      wall({ id: "horizontal", x1: 100, y1: 200, x2: 860, y2: 200 }),
      wall({ id: "vertical", x1: 820, y1: 100, x2: 820, y2: 500 }),
      wall({ id: "duplicate", x1: 120, y1: 210, x2: 780, y2: 210, score: 0.6 }),
    ];
    const forward = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: candidates,
    });
    const reverse = sanitizeRecognitionWallTopology({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      millimetersPerPixel: 10,
      wallCandidates: [...candidates].reverse(),
    });

    expect(reverse).toEqual(forward);
  });
});

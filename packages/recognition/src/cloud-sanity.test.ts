import { describe, expect, it } from "vitest";
import { sanitizeCloudRecognitionResult } from "./cloud-sanity";
import type { RecognitionProviderResult, RecognitionWallCandidate } from "./index";

function wall(id: string, start: [number, number], end: [number, number], origin: "local" | "cloud" = "cloud"): RecognitionWallCandidate {
  return {
    id,
    start: { x: start[0], y: start[1] },
    end: { x: end[0], y: end[1] },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: { localScore: origin === "local" ? 0.8 : null, cloudScore: origin === "cloud" ? 0.8 : null, reasons: [origin] },
    origin,
    conflict: null,
  };
}

describe("cloud recognition sanity filter", () => {
  it("drops a large unsupported frame around locally observed apartment geometry", () => {
    const localWalls = [
      wall("l1", [0.28, 0.22], [0.68, 0.22], "local"),
      wall("l2", [0.28, 0.22], [0.28, 0.72], "local"),
      wall("l3", [0.28, 0.72], [0.68, 0.72], "local"),
      wall("l4", [0.68, 0.22], [0.68, 0.72], "local"),
    ];
    const result: RecognitionProviderResult = {
      walls: [
        wall("frame-top", [0.08, 0.08], [0.9, 0.08]),
        wall("frame-left", [0.08, 0.08], [0.08, 0.9]),
        wall("frame-bottom", [0.08, 0.9], [0.9, 0.9]),
        wall("frame-right", [0.9, 0.08], [0.9, 0.9]),
        wall("useful", [0.29, 0.48], [0.67, 0.48]),
      ],
      openings: [
        {
          id: "orphan-door",
          kind: "door",
          hostWallCandidateId: "frame-left",
          center: { x: 0.08, y: 0.5 },
          widthPx: 50,
          orientationDeg: 90,
          confidence: "medium",
          evidence: { localScore: null, cloudScore: 0.8, reasons: ["cloud"] },
          origin: "cloud",
          conflict: null,
        },
      ],
      roomLabels: [],
    };

    const sanitized = sanitizeCloudRecognitionResult({ result, localSummary: { walls: localWalls, openings: [] } });

    expect(sanitized.walls.map((item) => item.id)).toEqual(["useful"]);
    expect(sanitized.openings).toHaveLength(0);
    expect(sanitized.diagnostics?.filter((item) => item.code === "cloud-frame-artifact")).toHaveLength(4);
  });

  it("does not aggressively filter cloud walls when local evidence is sparse", () => {
    const result: RecognitionProviderResult = { walls: [wall("long", [0.05, 0.05], [0.95, 0.05])], openings: [], roomLabels: [] };
    const sanitized = sanitizeCloudRecognitionResult({ result, localSummary: { walls: [wall("local", [0.4, 0.4], [0.6, 0.4], "local")], openings: [] } });
    expect(sanitized.walls).toHaveLength(1);
  });
});

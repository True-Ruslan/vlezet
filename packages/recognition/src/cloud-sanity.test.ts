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
      wall("useful", [0.29, 0.48], [0.67, 0.48], "local"),
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

  it("drops an almost full-frame unsupported wall when local evidence is sparse", () => {
    const result: RecognitionProviderResult = {
      walls: [
        wall("full-frame", [0.02, 0.14], [0.98, 0.14]),
        wall("moderate", [0.2, 0.4], [0.72, 0.4]),
      ],
      openings: [],
      roomLabels: [],
    };

    const sanitized = sanitizeCloudRecognitionResult({
      result,
      localSummary: { walls: [wall("moderate", [0.2, 0.4], [0.72, 0.4], "local")], openings: [] },
    });

    expect(sanitized.walls.map((item) => item.id)).toEqual(["moderate"]);
    expect(sanitized.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-unbounded-wall",
      candidateId: "full-frame",
    }));
  });

  it("drops a cloud wall whose id is absent from the local verification set", () => {
    const sanitized = sanitizeCloudRecognitionResult({
      result: { walls: [wall("invented", [0.2, 0.4], [0.72, 0.4])], openings: [], roomLabels: [] },
      localSummary: { walls: [wall("local-1", [0.2, 0.4], [0.72, 0.4], "local")], openings: [] },
    });

    expect(sanitized.walls).toEqual([]);
    expect(sanitized.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-unknown-local-wall",
      candidateId: "invented",
    }));
  });

  it("drops a cloud wall that reuses a local id with different geometry", () => {
    const sanitized = sanitizeCloudRecognitionResult({
      result: { walls: [wall("local-1", [0.1, 0.75], [0.9, 0.75])], openings: [], roomLabels: [] },
      localSummary: { walls: [wall("local-1", [0.2, 0.4], [0.72, 0.4], "local")], openings: [] },
    });

    expect(sanitized.walls).toEqual([]);
    expect(sanitized.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-local-wall-mismatch",
      candidateId: "local-1",
    }));
  });

  it("keeps a same-id cloud verification with matching local geometry", () => {
    const sanitized = sanitizeCloudRecognitionResult({
      result: { walls: [wall("local-1", [0.2, 0.4], [0.72, 0.4])], openings: [], roomLabels: [] },
      localSummary: { walls: [wall("local-1", [0.2, 0.4], [0.72, 0.4], "local")], openings: [] },
    });

    expect(sanitized.walls.map((item) => item.id)).toEqual(["local-1"]);
    expect(sanitized.diagnostics).toEqual([]);
  });

  it("fails closed on an unreviewable cloud wall explosion", () => {
    const result: RecognitionProviderResult = {
      walls: Array.from({ length: 81 }, (_, index) => wall(`cloud-${index}`, [0.1, index / 100], [0.6, index / 100])),
      openings: [],
      roomLabels: [],
    };

    const sanitized = sanitizeCloudRecognitionResult({ result, localSummary: null });

    expect(sanitized.walls).toEqual([]);
    expect(sanitized.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-wall-candidate-overload",
      severity: "warning",
    }));
  });
});

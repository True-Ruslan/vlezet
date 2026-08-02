import { describe, expect, it } from "vitest";
import { sanitizeCloudRecognitionResult } from "./cloud-sanity";
import type {
  RecognitionOpeningCandidate,
  RecognitionProviderResult,
  RecognitionWallCandidate,
} from "./index";

function wall(id = "wall-1", origin: "local" | "cloud" = "local"): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: 0.5 },
    end: { x: 0.9, y: 0.5 },
    estimatedThicknessPx: 20,
    confidence: "medium",
    evidence: {
      localScore: origin === "local" ? 0.72 : null,
      cloudScore: origin === "cloud" ? 0.9 : null,
      reasons: [origin],
    },
    origin,
    conflict: null,
  };
}

function opening(
  id = "opening-1",
  origin: "local" | "cloud" = "local",
  overrides: Partial<RecognitionOpeningCandidate> = {},
): RecognitionOpeningCandidate {
  return {
    id,
    kind: "door",
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.5 },
    widthPx: 100,
    orientationDeg: 0,
    confidence: "medium",
    evidence: {
      localScore: origin === "local" ? 0.72 : null,
      cloudScore: origin === "cloud" ? 0.9 : null,
      reasons: [origin],
    },
    origin,
    conflict: null,
    ...overrides,
  };
}

function sanitize(cloudOpenings: readonly RecognitionOpeningCandidate[]) {
  const result: RecognitionProviderResult = {
    walls: [wall("wall-1", "cloud")],
    openings: cloudOpenings,
    roomLabels: [],
  };
  return sanitizeCloudRecognitionResult({
    result,
    localSummary: {
      walls: [wall()],
      openings: [opening()],
    },
  });
}

describe("cloud opening verification safety", () => {
  it("drops a cloud-only opening with an unknown local id", () => {
    const result = sanitize([opening("invented-opening", "cloud")]);

    expect(result.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-unknown-local-opening",
      candidateId: "invented-opening",
    }));
  });

  it("drops a same-id opening when cloud changes its host wall", () => {
    const result = sanitize([
      opening("opening-1", "cloud", { hostWallCandidateId: "other-wall" }),
    ]);

    expect(result.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-local-opening-host-mismatch",
      candidateId: "opening-1",
    }));
  });

  it("drops a same-id opening when cloud moves or resizes local geometry", () => {
    const result = sanitize([
      opening("opening-1", "cloud", {
        center: { x: 0.61, y: 0.5 },
        widthPx: 140,
        orientationDeg: 12,
      }),
    ]);

    expect(result.openings).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-local-opening-geometry-mismatch",
      candidateId: "opening-1",
    }));
  });

  it("keeps exact local geometry while allowing cloud classification evidence", () => {
    const result = sanitize([
      opening("opening-1", "cloud", { kind: "window", confidence: "high" }),
    ]);

    expect(result.openings).toHaveLength(1);
    expect(result.openings[0]).toMatchObject({
      id: "opening-1",
      kind: "window",
      hostWallCandidateId: "wall-1",
      center: { x: 0.5, y: 0.5 },
      widthPx: 100,
      orientationDeg: 0,
    });
  });

  it("fails closed on an unreviewable cloud opening explosion", () => {
    const result: RecognitionProviderResult = {
      walls: [wall("wall-1", "cloud")],
      openings: Array.from({ length: 81 }, (_, index) =>
        opening(`opening-${index}`, "cloud")),
      roomLabels: [],
    };
    const sanitized = sanitizeCloudRecognitionResult({
      result,
      localSummary: {
        walls: [wall()],
        openings: Array.from({ length: 81 }, (_, index) => opening(`opening-${index}`)),
      },
    });

    expect(sanitized.openings).toEqual([]);
    expect(sanitized.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-opening-candidate-overload",
      severity: "warning",
    }));
  });
});

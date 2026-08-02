import { describe, expect, it } from "vitest";
import { reconcileRecognition } from "./reconcile";
import { validateRecognitionDraft, type RecognitionDraft, type RecognitionProviderResult, type RecognitionWallCandidate } from "./index";

const now = "2026-07-22T00:00:00.000Z";

function wall(id: string, y: number, origin: "local" | "cloud" = "local"): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y },
    end: { x: 0.9, y },
    estimatedThicknessPx: 20,
    confidence: origin === "local" ? "medium" : "high",
    evidence: { localScore: origin === "local" ? 0.8 : null, cloudScore: origin === "cloud" ? 0.95 : null, reasons: [origin] },
    origin,
    conflict: null,
  };
}

function localDraft(): RecognitionDraft {
  return {
    id: "draft", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion: "1",
    status: "local-complete", walls: [wall("local-1", 0.2)], openings: [], roomLabels: [], diagnostics: [],
    decisions: { "local-1": "accepted" }, source: { local: true, cloud: false }, createdAt: now, updatedAt: now,
  };
}

describe("hybrid recognition reconciliation", () => {
  it("merges agreeing local/cloud walls without moving local geometry and preserves user decision", () => {
    const cloud: RecognitionProviderResult = { walls: [wall("cloud-1", 0.202, "cloud")], openings: [], roomLabels: [] };
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });
    expect(result.walls).toHaveLength(1);
    expect(result.walls[0]?.origin).toBe("merged");
    expect(result.walls[0]?.confidence).toBe("high");
    expect(result.walls[0]?.start).toEqual({ x: 0.1, y: 0.2 });
    expect(result.walls[0]?.end).toEqual({ x: 0.9, y: 0.2 });
    expect(result.decisions["local-1"]).toBe("accepted");
  });

  it("defers unsupported cloud-only walls instead of adding new topology", () => {
    const cloud: RecognitionProviderResult = { walls: [wall("cloud-only", 0.7, "cloud")], openings: [], roomLabels: [] };
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });

    expect(result.walls.map((item) => item.id)).toEqual(["local-1"]);
    expect(result.decisions).not.toHaveProperty("cloud-only");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-only-wall-deferred",
      severity: "warning",
      candidateId: "cloud-only",
    }));
  });

  it("keeps the local wall count stable when cloud returns a mixed unsupported network", () => {
    const cloud: RecognitionProviderResult = {
      walls: [
        wall("cloud-match", 0.202, "cloud"),
        wall("cloud-horizontal-1", 0.45, "cloud"),
        wall("cloud-horizontal-2", 0.65, "cloud"),
      ],
      openings: [],
      roomLabels: [],
    };

    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });

    expect(result.walls).toHaveLength(1);
    expect(result.walls[0]?.origin).toBe("merged");
    expect(result.decisions).not.toHaveProperty("cloud-horizontal-1");
    expect(result.decisions).not.toHaveProperty("cloud-horizontal-2");
    expect(result.diagnostics.filter((item) => item.code === "cloud-only-wall-deferred")).toHaveLength(2);
  });

  it("defers cloud-only openings until host-wall classification is implemented", () => {
    const cloud: RecognitionProviderResult = {
      walls: [wall("cloud-match", 0.202, "cloud")],
      openings: [{
        id: "cloud-door",
        kind: "door",
        hostWallCandidateId: "cloud-match",
        center: { x: 0.5, y: 0.2 },
        widthPx: 72,
        orientationDeg: 0,
        confidence: "high",
        evidence: { localScore: null, cloudScore: 0.95, reasons: ["cloud"] },
        origin: "cloud",
        conflict: null,
      }],
      roomLabels: [],
    };

    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });

    expect(result.openings).toEqual([]);
    expect(result.decisions).not.toHaveProperty("cloud-door");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "cloud-only-opening-deferred",
      severity: "warning",
      candidateId: "cloud-door",
    }));
  });

  it("flags candidates duplicating existing geometry", () => {
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: { walls: [], openings: [], roomLabels: [] }, existingWalls: [{ start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.2 } }], now });
    expect(result.walls[0]?.conflict).toBe("duplicate-existing");
    expect(result.decisions["local-1"]).toBe("rejected");
  });

  it("drops stale decisions when a repeated cloud check replaces room-label candidates", () => {
    const previous = localDraft();
    const rerunDraft: RecognitionDraft = {
      ...previous,
      status: "reconciled",
      roomLabels: [{ id: "rl1", text: "Старая подпись", anchor: { x: 0.4, y: 0.4 }, confidence: "medium", origin: "cloud" }],
      decisions: { ...previous.decisions, rl1: "accepted" },
      source: { local: true, cloud: true },
    };
    const cloud: RecognitionProviderResult = {
      walls: [],
      openings: [],
      roomLabels: [{ id: "rl2", text: "Новая подпись", anchor: { x: 0.45, y: 0.45 }, confidence: "high", origin: "cloud" }],
    };

    const result = reconcileRecognition({ localDraft: rerunDraft, cloudResult: cloud, existingWalls: [], now });

    expect(result.roomLabels.map((label) => label.id)).toEqual(["rl2"]);
    expect(result.decisions).not.toHaveProperty("rl1");
    expect(result.decisions.rl2).toBe("pending");
    expect(() => validateRecognitionDraft(result)).not.toThrow();
  });
});

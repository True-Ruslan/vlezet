import { describe, expect, it } from "vitest";
import { reconcileRecognition } from "./reconcile";
import type { RecognitionDraft, RecognitionProviderResult, RecognitionWallCandidate } from "./index";

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
  it("merges agreeing local/cloud walls and preserves user decision", () => {
    const cloud: RecognitionProviderResult = { walls: [wall("cloud-1", 0.202, "cloud")], openings: [], roomLabels: [] };
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });
    expect(result.walls).toHaveLength(1);
    expect(result.walls[0]?.origin).toBe("merged");
    expect(result.walls[0]?.confidence).toBe("high");
    expect(result.decisions["local-1"]).toBe("accepted");
  });

  it("keeps unsupported cloud-only walls reviewable instead of authoritative", () => {
    const cloud: RecognitionProviderResult = { walls: [wall("cloud-only", 0.7, "cloud")], openings: [], roomLabels: [] };
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: cloud, existingWalls: [], now });
    const candidate = result.walls.find((item) => item.id === "cloud-only");
    expect(candidate?.origin).toBe("cloud");
    expect(candidate?.confidence).not.toBe("high");
    expect(result.decisions["cloud-only"]).toBe("pending");
  });

  it("flags candidates duplicating existing geometry", () => {
    const result = reconcileRecognition({ localDraft: localDraft(), cloudResult: { walls: [], openings: [], roomLabels: [] }, existingWalls: [{ start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.2 } }], now });
    expect(result.walls[0]?.conflict).toBe("duplicate-existing");
    expect(result.decisions["local-1"]).toBe("rejected");
  });
});

import { describe, expect, it, vi } from "vitest";
import { MemoryRecognitionSessionRepository, type RecognitionDraft, type RecognitionSessionRecord } from "@vlezet/recognition";
import { RecognitionController } from "./recognition-controller";

const NOW = "2026-07-22T00:00:00.000Z";

function draft(): RecognitionDraft {
  return {
    id: "draft", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion: "1",
    status: "local-complete",
    walls: [{ id: "w1", start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.1 }, estimatedThicknessPx: 20, confidence: "high", evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] }, origin: "local", conflict: null }],
    openings: [], roomLabels: [], diagnostics: [], decisions: { w1: "pending" }, source: { local: true, cloud: false }, createdAt: NOW, updatedAt: NOW,
  };
}

function session(): RecognitionSessionRecord {
  const value = draft();
  return { id: "session", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion: "1", draft: value, cloudMetadata: null, createdAt: NOW, updatedAt: NOW };
}

describe("recognition controller", () => {
  it("creates and persists a local draft then updates review decisions", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    const states: string[] = [];
    const controller = new RecognitionController({
      repository,
      runLocal: async (_input, options) => { options.onProgress?.({ phase: "walls", progress: 0.7 }); return draft(); },
      onState: (state) => states.push(state.kind),
    });
    await controller.startLocal({ imageData: new ImageData(1, 1), projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", now: NOW });
    expect(states).toContain("running-local");
    expect(controller.state.kind).toBe("review");
    await controller.updateDecision("w1", "accepted");
    expect((await repository.getForProject("project"))?.draft.decisions.w1).toBe("accepted");
  });

  it("restores a matching session and explicitly marks revision mismatches stale", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
    expect(controller.state.kind).toBe("review");
    await controller.restore("project", { assetId: "asset", referenceRevision: "new-revision" });
    expect(controller.state.kind).toBe("stale");
  });

  it("preserves an existing session when a local retry fails", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: async () => { throw new Error("cv failed"); }, onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
    await controller.startLocal({ imageData: new ImageData(1, 1), projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", now: NOW });
    expect(controller.state.kind).toBe("error");
    expect(controller.state.session?.id).toBe("session");
    expect(await repository.getForProject("project")).not.toBeNull();
  });
});

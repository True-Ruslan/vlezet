import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_RECOGNITION_ENGINE_VERSION,
  MemoryRecognitionSessionRepository,
  type RecognitionDraft,
  type RecognitionSessionRecord,
} from "@vlezet/recognition";
import { RecognitionController } from "./recognition-controller";

const NOW = "2026-07-22T00:00:00.000Z";

function fakeImageData(width = 1, height = 1): ImageData {
  return { width, height, data: new Uint8ClampedArray(width * height * 4), colorSpace: "srgb" } as ImageData;
}

function draft(engineVersion: string = LOCAL_RECOGNITION_ENGINE_VERSION): RecognitionDraft {
  return {
    id: "draft", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion,
    status: "local-complete",
    walls: [{ id: "w1", start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.1 }, estimatedThicknessPx: 20, confidence: "high", evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] }, origin: "local", conflict: null }],
    openings: [], roomLabels: [], diagnostics: [], decisions: { w1: "pending" }, source: { local: true, cloud: false }, createdAt: NOW, updatedAt: NOW,
  };
}

function session(engineVersion: string = LOCAL_RECOGNITION_ENGINE_VERSION): RecognitionSessionRecord {
  const value = draft(engineVersion);
  return { id: "session", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion, draft: value, cloudMetadata: null, createdAt: NOW, updatedAt: NOW };
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
    await controller.startLocal({ imageData: fakeImageData(), projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", now: NOW });
    expect(states).toContain("running-local");
    expect(controller.state.kind).toBe("review");
    await controller.updateDecision("w1", "accepted");
    expect((await repository.getForProject("project"))?.draft.decisions.w1).toBe("accepted");
  });

  it("persists endpoint edits only in the recognition draft", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });

    await controller.editWall("w1", { start: { x: 0.2, y: 0.25 } });

    const persisted = await repository.getForProject("project");
    expect(persisted?.draft.walls[0]?.start).toEqual({ x: 0.2, y: 0.25 });
    expect(persisted?.draft.decisions.w1).toBe("edited");
    expect(controller.state.kind).toBe("review");
  });

  it("restores a matching current-engine session and explicitly marks revision mismatches stale", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
    expect(controller.state.kind).toBe("review");
    await controller.restore("project", { assetId: "asset", referenceRevision: "new-revision" });
    expect(controller.state.kind).toBe("stale");
  });

  it("marks sessions from an older local-recognition engine stale", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session("1"));
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });

    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });

    expect(controller.state.kind).toBe("stale");
  });

  it("preserves an existing session when a local retry fails", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: async () => { throw new Error("cv failed"); }, onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
    await controller.startLocal({ imageData: fakeImageData(), projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", now: NOW });
    expect(controller.state.kind).toBe("error");
    expect(controller.state.session?.id).toBe("session");
    expect(await repository.getForProject("project")).not.toBeNull();
  });

  it("preserves the current session when cloud recognition returns an error", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(session());
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
    await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });

    controller.setRunningCloud();
    expect(controller.state.kind).toBe("running-cloud");
    await controller.returnToReviewWithError("provider failed");

    expect(controller.state.kind).toBe("error");
    expect(controller.state.session?.id).toBe("session");
    expect((await repository.getForProject("project"))?.draft).toEqual(draft());
  });
});

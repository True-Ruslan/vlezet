import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_RECOGNITION_ENGINE_VERSION,
  MemoryRecognitionSessionRepository,
  type RecognitionDraft,
  type RecognitionSessionRecord,
} from "@vlezet/recognition";
import { RecognitionController } from "./recognition-controller";

const NOW = "2026-08-03T00:00:00.000Z";

function session(cloud: boolean): RecognitionSessionRecord {
  const draft: RecognitionDraft = {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "applied",
    walls: [],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: {},
    source: { local: true, cloud },
    createdAt: NOW,
    updatedAt: NOW,
  };
  return {
    id: "session",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    draft,
    cloudMetadata: cloud ? { providerId: "openrouter", modelId: "model", completedAt: NOW } : null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

async function controllerWithSession(cloud: boolean) {
  const repository = new MemoryRecognitionSessionRepository();
  await repository.put(session(cloud));
  const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
  await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
  return { controller, repository };
}

describe("recognition applied state", () => {
  it("returns a local applied draft to local review after Undo", async () => {
    const { controller, repository } = await controllerWithSession(false);
    await controller.setAppliedState(false);
    expect(controller.state.session?.draft.status).toBe("local-complete");
    expect((await repository.getForProject("project"))?.draft.status).toBe("local-complete");
  });

  it("returns an AI-verified applied draft to reconciled review after Undo", async () => {
    const { controller } = await controllerWithSession(true);
    await controller.setAppliedState(false);
    expect(controller.state.session?.draft.status).toBe("reconciled");
  });

  it("marks the same draft applied again after Redo", async () => {
    const { controller } = await controllerWithSession(true);
    await controller.setAppliedState(false);
    await controller.setAppliedState(true);
    expect(controller.state.session?.draft.status).toBe("applied");
  });
});

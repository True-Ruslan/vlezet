import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_RECOGNITION_ENGINE_VERSION,
  MemoryRecognitionSessionRepository,
  type RecognitionSessionRecord,
  type RecognitionWallCandidate,
  type ValidatedRecognitionDraft,
} from "@vlezet/recognition";
import { RecognitionController } from "./recognition-controller";

const NOW = "2026-08-03T00:00:00.000Z";

function wall(id: string, y: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y },
    end: { x: 0.9, y },
    estimatedThicknessPx: 18,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: null,
  };
}

function session(cloud: boolean): RecognitionSessionRecord {
  const draft: ValidatedRecognitionDraft = {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "applied",
    walls: [wall("wall-1", 0.2), wall("wall-2", 0.6)],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "accepted", "wall-2": "pending" },
    source: { local: true, cloud },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
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

  it("reopens a local applied draft when another candidate is accepted", async () => {
    const { controller, repository } = await controllerWithSession(false);

    await controller.updateDecision("wall-2", "accepted");

    expect(controller.state.session?.draft.status).toBe("local-complete");
    expect(controller.state.session?.draft.decisions["wall-2"]).toBe("accepted");
    expect((await repository.getForProject("project"))?.draft.status).toBe("local-complete");
  });

  it("reopens an AI-verified applied draft as reconciled when a decision changes", async () => {
    const { controller } = await controllerWithSession(true);

    await controller.updateDecision("wall-2", "accepted");

    expect(controller.state.session?.draft.status).toBe("reconciled");
  });

  it("reopens an applied draft when an accepted wall is edited", async () => {
    const { controller } = await controllerWithSession(false);

    await controller.editWall("wall-1", { end: { x: 0.8, y: 0.2 } });

    expect(controller.state.session?.draft.status).toBe("local-complete");
    expect(controller.state.session?.draft.decisions["wall-1"]).toBe("edited");
    expect(controller.state.session?.draft.walls.find((candidate) => candidate.id === "wall-1")?.end)
      .toEqual({ x: 0.8, y: 0.2 });
  });
});

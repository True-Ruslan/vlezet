import { describe, expect, it, vi } from "vitest";
import {
  LOCAL_RECOGNITION_ENGINE_VERSION,
  MemoryRecognitionSessionRepository,
  validateRecognitionDraft,
  type RecognitionSessionRecord,
} from "@vlezet/recognition";
import { RecognitionController } from "./recognition-controller";

const now = "2026-08-06T15:10:00.000Z";

function session(): RecognitionSessionRecord {
  const draft = validateRecognitionDraft({
    id: "cancel-draft",
    projectId: "cancel-project",
    referenceAssetId: "cancel-asset",
    referenceRevision: "cancel-revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 18,
      confidence: "medium",
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: "cancel-session",
    projectId: draft.projectId,
    referenceAssetId: draft.referenceAssetId,
    referenceRevision: draft.referenceRevision,
    engineVersion: draft.engineVersion,
    draft,
    cloudMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

async function restoredController() {
  const repository = new MemoryRecognitionSessionRepository();
  const initial = session();
  await repository.put(initial);
  const controller = new RecognitionController({
    repository,
    runLocal: vi.fn(),
    onState: vi.fn(),
  });
  await controller.restore(initial.projectId, {
    assetId: initial.referenceAssetId,
    referenceRevision: initial.referenceRevision,
  });
  return { controller, repository, initial };
}

describe("AI proposal discovery cancellation", () => {
  it("aborts the current request, returns to review and preserves the session", async () => {
    const { controller, repository, initial } = await restoredController();

    let wasAborted = false;
    const running = controller.startAiProposalDiscovery(async (input) => new Promise((resolve) => {
      input.signal.addEventListener("abort", () => {
        wasAborted = input.signal.aborted;
        resolve(null);
      }, { once: true });
    }));
    expect(controller.state.kind).toBe("running-ai-proposals");

    controller.cancelAiProposalDiscovery();
    await running;

    expect(wasAborted).toBe(true);
    expect(controller.state.kind).toBe("review");
    expect(await repository.getForProject(initial.projectId)).toEqual(initial);
  });

  it("is a no-op when proposal discovery is not running", async () => {
    const { controller, repository, initial } = await restoredController();

    controller.cancelAiProposalDiscovery();

    expect(controller.state.kind).toBe("review");
    expect(await repository.getForProject(initial.projectId)).toEqual(initial);
  });
});

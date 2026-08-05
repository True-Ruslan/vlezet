import { describe, expect, it, vi } from "vitest";
import {
  AI_PROPOSAL_SCHEMA_VERSION,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  MemoryRecognitionSessionRepository,
  createLocalDraftFingerprint,
  reconcileAiProposalBatch,
  validateRecognitionDraft,
  type RecognitionAiProposalMetadata,
  type RecognitionSessionRecord,
  type RecognitionSessionRepository,
  type SanitizedRecognitionProposal,
  type ValidatedRecognitionDraft,
} from "@vlezet/recognition";
import {
  RecognitionController,
  type RecognitionAiProposalRunResult,
  type RecognitionAiProposalRunner,
} from "./recognition-controller";

const NOW = "2026-08-06T00:00:00.000Z";
const COMPLETE_AT = "2026-08-06T00:01:00.000Z";

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, resolve, reject };
}

function draft(): ValidatedRecognitionDraft {
  return validateRecognitionDraft({
    id: "draft-ai-controller",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "local-complete",
    walls: [
      {
        id: "wall-1",
        start: { x: 0.1, y: 0.2 },
        end: { x: 0.9, y: 0.2 },
        estimatedThicknessPx: 18,
        confidence: "high",
        evidence: { localScore: 0.94, cloudScore: null, reasons: ["parallel-edges"] },
        origin: "local",
        conflict: null,
      },
      {
        id: "wall-clutter",
        start: { x: 0.7, y: 0.45 },
        end: { x: 0.76, y: 0.45 },
        estimatedThicknessPx: 12,
        confidence: "low",
        evidence: {
          localScore: 0.24,
          cloudScore: null,
          reasons: ["structural-clutter-veto", "sanitary-symbol-overlap"],
        },
        origin: "local",
        conflict: "unsupported",
      },
    ],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "accepted", "wall-clutter": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: NOW,
    updatedAt: NOW,
  });
}

function session(value: ValidatedRecognitionDraft = draft()): RecognitionSessionRecord {
  return {
    id: "session",
    projectId: value.projectId,
    referenceAssetId: value.referenceAssetId,
    referenceRevision: value.referenceRevision,
    engineVersion: value.engineVersion,
    draft: value,
    cloudMetadata: null,
    createdAt: value.createdAt,
    updatedAt: value.updatedAt,
  };
}

class DelayedRecognitionSessionRepository implements RecognitionSessionRepository {
  #current: RecognitionSessionRecord | null;
  #putCount = 0;
  readonly firstPutStarted = deferred<void>();
  readonly releaseFirstPut = deferred<void>();

  constructor(initial: RecognitionSessionRecord) {
    this.#current = structuredClone(initial);
  }

  async getForProject(projectId: string): Promise<RecognitionSessionRecord | null> {
    return this.#current?.projectId === projectId ? structuredClone(this.#current) : null;
  }

  async put(value: RecognitionSessionRecord): Promise<void> {
    this.#putCount += 1;
    if (this.#putCount === 1) {
      this.firstPutStarted.resolve();
      await this.releaseFirstPut.promise;
    }
    this.#current = structuredClone(value);
  }

  async deleteForProject(projectId: string): Promise<void> {
    if (this.#current?.projectId === projectId) this.#current = null;
  }
}

function metadata(
  value: ValidatedRecognitionDraft,
  requestId: string,
): RecognitionAiProposalMetadata {
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId,
    referenceRevision: value.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(value),
    providerId: "openrouter-direct",
    modelId: "provider/model",
    completedAt: COMPLETE_AT,
  };
}

function advisory(
  value: ValidatedRecognitionDraft,
  requestId: string,
  id = `ai-proposal:${requestId}:wall-review`,
): SanitizedRecognitionProposal {
  return {
    id,
    rawProposalId: "wall-review",
    kind: "local-wall-review",
    state: "eligible",
    geometry: null,
    targetLocalCandidateId: "wall-clutter",
    hostWallCandidateId: null,
    provider: { providerId: "openrouter-direct", modelId: "provider/model", requestId },
    modelConfidence: 0.84,
    deterministicConfidence: "low",
    sourceRegion: { x: 0.68, y: 0.41, width: 0.1, height: 0.08 },
    evidence: {
      providerReasons: ["sanitary-symbol-overlap", "short-clutter-profile"],
      validatorReasons: ["structural-clutter-veto"],
    },
    localDraftFingerprint: createLocalDraftFingerprint(value),
  };
}

function blockedDoor(
  value: ValidatedRecognitionDraft,
  requestId: string,
): SanitizedRecognitionProposal {
  return {
    id: `ai-proposal:${requestId}:blocked-door`,
    rawProposalId: "blocked-door",
    kind: "door",
    state: "blocked",
    geometry: {
      kind: "opening",
      center: { x: 0.5, y: 0.2 },
      widthNormalized: 0.08,
      orientationDeg: 0,
    },
    targetLocalCandidateId: null,
    hostWallCandidateId: null,
    provider: { providerId: "openrouter-direct", modelId: "provider/model", requestId },
    modelConfidence: 0.99,
    deterministicConfidence: "low",
    sourceRegion: { x: 0.46, y: 0.16, width: 0.08, height: 0.08 },
    evidence: { providerReasons: ["visible-gap"], validatorReasons: ["host-wall-not-found"] },
    localDraftFingerprint: createLocalDraftFingerprint(value),
  };
}

function result(
  value: ValidatedRecognitionDraft,
  requestId: string,
  proposals: readonly SanitizedRecognitionProposal[] = [advisory(value, requestId)],
): RecognitionAiProposalRunResult {
  return { sanitized: proposals, metadata: metadata(value, requestId) };
}

async function restoredController(initial: ValidatedRecognitionDraft = draft()) {
  const repository = new MemoryRecognitionSessionRepository();
  await repository.put(session(initial));
  const states: string[] = [];
  const controller = new RecognitionController({
    repository,
    runLocal: vi.fn(),
    onState: (state) => states.push(state.kind),
  });
  await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
  return { controller, repository, states };
}

async function controllerWithRepository(repository: RecognitionSessionRepository) {
  const controller = new RecognitionController({
    repository,
    runLocal: vi.fn(),
    onState: vi.fn(),
  });
  await controller.restore("project", { assetId: "asset", referenceRevision: "revision" });
  return controller;
}

describe("recognition controller AI proposals", () => {
  it("does not mutate a missing session or a runner that reports unavailable evidence/key", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    const controller = new RecognitionController({ repository, runLocal: vi.fn(), onState: vi.fn() });
    const run = vi.fn<RecognitionAiProposalRunner>();

    await controller.startAiProposalDiscovery(run);
    expect(run).not.toHaveBeenCalled();
    expect(controller.state.kind).toBe("idle");

    const restored = await restoredController();
    const before = await restored.repository.getForProject("project");
    const unavailable: RecognitionAiProposalRunner = async () => null;
    await restored.controller.startAiProposalDiscovery(unavailable);

    expect(restored.controller.state.kind).toBe("review");
    expect(await restored.repository.getForProject("project")).toEqual(before);
  });

  it("publishes exact running identity and only the latest request may reconcile", async () => {
    const { controller, repository, states } = await restoredController();
    const first = deferred<RecognitionAiProposalRunResult | null>();
    const second = deferred<RecognitionAiProposalRunResult | null>();
    const requestIds: string[] = [];
    let call = 0;
    const run: RecognitionAiProposalRunner = async (input) => {
      requestIds.push(input.requestId);
      expect(input.localDraftFingerprint).toBe(createLocalDraftFingerprint(input.session.draft));
      expect(input.referenceRevision).toBe("revision");
      return (call++ === 0 ? first : second).promise;
    };

    const firstRun = controller.startAiProposalDiscovery(run);
    expect(controller.state).toMatchObject({
      kind: "running-ai-proposals",
      requestId: requestIds[0],
      referenceRevision: "revision",
    });
    const secondRun = controller.startAiProposalDiscovery(run);
    second.resolve(result(draft(), requestIds[1]!));
    await secondRun;

    first.resolve(result(draft(), requestIds[0]!));
    await firstRun;

    const persisted = await repository.getForProject("project");
    expect(states.filter((kind) => kind === "running-ai-proposals")).toHaveLength(2);
    expect(persisted?.draft.aiProposalMetadata?.requestId).toBe(requestIds[1]);
    expect(persisted?.draft.aiProposals[0]?.provider.requestId).toBe(requestIds[1]);
  });

  it("keeps the newer request final when an older persistence is already in flight", async () => {
    const repository = new DelayedRecognitionSessionRepository(session());
    const controller = await controllerWithRepository(repository);
    const requestIds: string[] = [];
    const run: RecognitionAiProposalRunner = async (input) => {
      requestIds.push(input.requestId);
      return result(input.session.draft, input.requestId);
    };

    const firstRun = controller.startAiProposalDiscovery(run);
    await repository.firstPutStarted.promise;
    const secondRun = controller.startAiProposalDiscovery(run);
    await Promise.resolve();
    repository.releaseFirstPut.resolve();
    await Promise.all([firstRun, secondRun]);

    const persisted = await repository.getForProject("project");
    expect(persisted?.draft.aiProposalMetadata?.requestId).toBe(requestIds[1]);
    expect(persisted?.draft.aiProposals[0]?.provider.requestId).toBe(requestIds[1]);
  });

  it("keeps a local edit final when proposal persistence is already in flight", async () => {
    const repository = new DelayedRecognitionSessionRepository(session());
    const controller = await controllerWithRepository(repository);
    const running = controller.startAiProposalDiscovery(async (input) =>
      result(input.session.draft, input.requestId));
    await repository.firstPutStarted.promise;

    const editing = controller.editWall("wall-1", { end: { x: 0.85, y: 0.2 } });
    await Promise.resolve();
    repository.releaseFirstPut.resolve();
    await Promise.all([running, editing]);

    const persisted = await repository.getForProject("project");
    expect(persisted?.draft.walls.find(({ id }) => id === "wall-1")?.end).toEqual({ x: 0.85, y: 0.2 });
    expect(persisted?.draft.aiProposals).toEqual([]);
    expect(persisted?.draft.proposalDecisions).toEqual({});
    expect(persisted?.draft.aiProposalMetadata).toBeNull();
  });

  it("cancellation prevents a late response from replacing proposal state", async () => {
    const { controller, repository } = await restoredController();
    const pending = deferred<RecognitionAiProposalRunResult | null>();
    let requestId = "";
    const run: RecognitionAiProposalRunner = async (input) => {
      requestId = input.requestId;
      return pending.promise;
    };
    const before = await repository.getForProject("project");

    const running = controller.startAiProposalDiscovery(run);
    controller.cancelRunning();
    pending.resolve(result(draft(), requestId));
    await running;

    expect(await repository.getForProject("project")).toEqual(before);
  });

  it("rejects stale reference/fingerprint and preserves the previous valid batch", async () => {
    const base = draft();
    const seeded = reconcileAiProposalBatch({
      localDraft: base,
      sanitized: [advisory(base, "previous")],
      metadata: metadata(base, "previous"),
      now: COMPLETE_AT,
    });
    const { controller, repository } = await restoredController(seeded);
    const before = await repository.getForProject("project");
    const run: RecognitionAiProposalRunner = async ({ requestId }) => ({
      sanitized: [{
        ...advisory(seeded, requestId),
        localDraftFingerprint: `recognition-local-draft-v1:${"f".repeat(64)}`,
      }],
      metadata: {
        ...metadata(seeded, requestId),
        localDraftFingerprint: `recognition-local-draft-v1:${"f".repeat(64)}`,
      },
    });

    await controller.startAiProposalDiscovery(run);

    const persisted = await repository.getForProject("project");
    expect(controller.state.kind).toBe("review");
    expect(persisted?.draft.aiProposals).toEqual(before?.draft.aiProposals);
    expect(persisted?.draft.proposalDecisions).toEqual(before?.draft.proposalDecisions);
    expect(persisted?.draft.diagnostics.at(-1)?.code).toBe("ai-proposal-reconciliation-rejected");
  });

  it("returns to review after timeout/error with prior state intact and a redacted bounded diagnostic", async () => {
    const base = draft();
    const seeded = reconcileAiProposalBatch({
      localDraft: base,
      sanitized: [advisory(base, "previous")],
      metadata: metadata(base, "previous"),
      now: COMPLETE_AT,
    });
    const { controller, repository } = await restoredController(seeded);
    const run: RecognitionAiProposalRunner = async () => {
      throw new Error("Authorization: Bearer sk-secret data:image/png;base64,PRIVATE");
    };

    await controller.startAiProposalDiscovery(run);

    const persisted = await repository.getForProject("project");
    expect(controller.state.kind).toBe("review");
    expect(persisted?.draft.aiProposals).toEqual(seeded.aiProposals);
    expect(persisted?.draft.proposalDecisions).toEqual(seeded.proposalDecisions);
    const diagnostic = persisted?.draft.diagnostics.at(-1);
    expect(diagnostic).toMatchObject({ code: "ai-proposal-run-failed", severity: "warning", candidateId: null });
    expect(diagnostic?.message).not.toMatch(/sk-secret|Authorization|base64|PRIVATE/i);
    expect(persisted?.draft.diagnostics.filter(({ code }) => code === "ai-proposal-run-failed")).toHaveLength(1);
  });

  it("updates decisions only for known eligible proposals", async () => {
    const base = draft();
    const requestId = "decision-run";
    const reconciled = reconcileAiProposalBatch({
      localDraft: base,
      sanitized: [advisory(base, requestId), blockedDoor(base, requestId)],
      metadata: metadata(base, requestId),
      now: COMPLETE_AT,
    });
    const { controller, repository } = await restoredController(reconciled);
    const eligibleId = advisory(base, requestId).id;
    const blockedId = blockedDoor(base, requestId).id;

    await controller.updateProposalDecision(eligibleId, "accepted");
    await controller.updateProposalDecision(blockedId, "accepted");
    await controller.updateProposalDecision("unknown", "accepted");

    const persisted = await repository.getForProject("project");
    expect(persisted?.draft.proposalDecisions).toEqual({ [eligibleId]: "accepted" });
  });

  it("agrees with an advisory atomically by rejecting only its exact local target", async () => {
    const base = draft();
    const requestId = "advisory-run";
    const proposal = advisory(base, requestId);
    const reconciled = reconcileAiProposalBatch({
      localDraft: base,
      sanitized: [proposal],
      metadata: metadata(base, requestId),
      now: COMPLETE_AT,
    });
    const { controller, repository } = await restoredController(reconciled);
    const wallsBefore = reconciled.walls;
    const openingsBefore = reconciled.openings;

    await controller.agreeWithWallAdvisory(proposal.id);

    const persisted = await repository.getForProject("project");
    expect(persisted?.draft.decisions).toEqual({ "wall-1": "accepted", "wall-clutter": "rejected" });
    expect(persisted?.draft.proposalDecisions).toEqual({ [proposal.id]: "accepted" });
    expect(persisted?.draft.walls).toEqual(wallsBefore);
    expect(persisted?.draft.openings).toEqual(openingsBefore);
  });

  it("invalidates proposal state when local geometry is edited or local recognition reruns", async () => {
    const base = draft();
    const requestId = "invalidate-run";
    const reconciled = reconcileAiProposalBatch({
      localDraft: base,
      sanitized: [advisory(base, requestId)],
      metadata: metadata(base, requestId),
      now: COMPLETE_AT,
    });
    const { controller, repository } = await restoredController(reconciled);

    await controller.editWall("wall-1", { end: { x: 0.85, y: 0.2 } });
    let persisted = await repository.getForProject("project");
    expect(persisted?.draft.aiProposals).toEqual([]);
    expect(persisted?.draft.proposalDecisions).toEqual({});
    expect(persisted?.draft.aiProposalMetadata).toBeNull();

    const localAgain = { ...draft(), updatedAt: "2026-08-06T00:03:00.000Z" };
    const rerunController = new RecognitionController({
      repository,
      runLocal: async () => validateRecognitionDraft({
        ...localAgain,
        aiProposals: reconciled.aiProposals,
        proposalDecisions: reconciled.proposalDecisions,
        aiProposalMetadata: reconciled.aiProposalMetadata,
      }),
      onState: vi.fn(),
    });
    await rerunController.restore("project", { assetId: "asset", referenceRevision: "revision" });
    await rerunController.startLocal({
      imageData: { width: 1, height: 1, data: new Uint8ClampedArray(4), colorSpace: "srgb" } as ImageData,
      projectId: "project",
      referenceAssetId: "asset",
      referenceRevision: "revision",
      now: localAgain.updatedAt,
    });

    persisted = await repository.getForProject("project");
    expect(persisted?.draft.aiProposals).toEqual([]);
    expect(persisted?.draft.proposalDecisions).toEqual({});
    expect(persisted?.draft.aiProposalMetadata).toBeNull();
  });
});

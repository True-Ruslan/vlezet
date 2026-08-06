import {
  createLocalDraftFingerprint,
  emptyAiProposalDraftState,
  enforceLocalWallReviewBudget,
  isRecognitionSessionStale,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  reconcileAiProposalBatch,
  validateRecognitionDraft,
  type NormalizedPoint,
  type RecognitionAiProposalMetadata,
  type RecognitionDecision,
  type RecognitionDiagnostic,
  type RecognitionDraft,
  type RecognitionDraftStatus,
  type RecognitionProposalDecision,
  type RecognitionSessionRecord,
  type RecognitionSessionRepository,
  type SanitizedRecognitionProposal,
  type ValidatedRecognitionDraft,
} from "@vlezet/recognition";
import type { LocalRecognitionInput, LocalRecognitionProgress } from "./local-recognition-types";

export type RecognitionAiProposalRunResult = Readonly<{
  sanitized: readonly SanitizedRecognitionProposal[];
  metadata: RecognitionAiProposalMetadata;
}>;

export type RecognitionAiProposalRunnerInput = Readonly<{
  session: RecognitionSessionRecord;
  requestId: string;
  referenceRevision: string;
  localDraftFingerprint: string;
  signal: AbortSignal;
}>;

export type RecognitionAiProposalRunner = (
  input: RecognitionAiProposalRunnerInput,
) => Promise<RecognitionAiProposalRunResult | null>;

export type RecognitionProposalReviewActions = Readonly<{
  updateDecision: (
    proposalId: string,
    decision: RecognitionProposalDecision,
  ) => Promise<void>;
  agreeWithWallAdvisory: (proposalId: string) => Promise<void>;
}>;

export type RecognitionControllerState =
  | Readonly<{ kind: "idle"; session: null }>
  | Readonly<{ kind: "running-local"; session: RecognitionSessionRecord | null; progress: LocalRecognitionProgress }>
  | Readonly<{
      kind: "review";
      session: RecognitionSessionRecord;
      proposalActions?: RecognitionProposalReviewActions;
    }>
  | Readonly<{
      kind: "running-ai-proposals";
      session: RecognitionSessionRecord;
      requestId: string;
      referenceRevision: string;
      localDraftFingerprint: string;
    }>
  | Readonly<{ kind: "running-cloud"; session: RecognitionSessionRecord }>
  | Readonly<{ kind: "stale"; session: RecognitionSessionRecord }>
  | Readonly<{ kind: "error"; session: RecognitionSessionRecord | null; message: string }>;

export type RecognitionReferenceIdentity = Readonly<{ assetId: string; referenceRevision: string }>;

export type RecognitionControllerOptions = Readonly<{
  repository: RecognitionSessionRepository;
  runLocal: (input: LocalRecognitionInput, options: Readonly<{ signal?: AbortSignal; onProgress?: (progress: LocalRecognitionProgress) => void }>) => Promise<RecognitionDraft>;
  onState: (state: RecognitionControllerState) => void;
}>;

const AI_PROPOSAL_RUN_FAILED_DIAGNOSTIC: RecognitionDiagnostic = Object.freeze({
  code: "ai-proposal-run-failed",
  severity: "warning",
  message: "AI-поиск пропущенных элементов не завершён. Локальный черновик и предыдущие предложения сохранены без изменений.",
  candidateId: null,
});

function sessionFromDraft(
  draft: ValidatedRecognitionDraft,
  previous?: RecognitionSessionRecord | null,
): RecognitionSessionRecord {
  return {
    id: previous?.id ?? crypto.randomUUID(),
    projectId: draft.projectId,
    referenceAssetId: draft.referenceAssetId,
    referenceRevision: draft.referenceRevision,
    engineVersion: draft.engineVersion,
    draft,
    cloudMetadata: previous?.cloudMetadata ?? null,
    createdAt: previous?.createdAt ?? draft.createdAt,
    updatedAt: draft.updatedAt,
  };
}

function appendBoundedDiagnostic(
  diagnostics: readonly RecognitionDiagnostic[],
  diagnostic: RecognitionDiagnostic,
): RecognitionDiagnostic[] {
  const withoutPrevious = diagnostics.filter(({ code, candidateId }) =>
    code !== diagnostic.code || candidateId !== diagnostic.candidateId);
  return [...withoutPrevious, diagnostic];
}

function enforceReviewableLocalDraft(draft: ValidatedRecognitionDraft): ValidatedRecognitionDraft {
  const budget = enforceLocalWallReviewBudget({ walls: draft.walls });
  if (!budget.overloaded) return draft;
  return {
    ...draft,
    walls: [],
    openings: [],
    decisions: {},
    diagnostics: [
      ...draft.diagnostics,
      {
        code: "local-wall-candidate-overload",
        severity: "warning",
        message: `Локальный анализ создал ${budget.originalWallCount} кандидатов стен. Результат отклонён целиком, потому что такой набор нельзя надёжно проверить. Повторите распознавание после обрезки изображения или используйте ручную обводку.`,
        candidateId: null,
      },
    ],
  };
}

function reviewStatus(session: RecognitionSessionRecord): RecognitionDraftStatus {
  if (session.cloudMetadata || session.draft.source.cloud) return "reconciled";
  return "local-complete";
}

export class RecognitionController {
  readonly #repository: RecognitionSessionRepository;
  readonly #runLocal: RecognitionControllerOptions["runLocal"];
  readonly #onState: RecognitionControllerOptions["onState"];
  readonly #proposalReviewActions: RecognitionProposalReviewActions;
  #state: RecognitionControllerState = { kind: "idle", session: null };
  #abortController: AbortController | null = null;
  #requestGeneration = 0;
  #persistenceTail: Promise<void> = Promise.resolve();

  constructor(options: RecognitionControllerOptions) {
    this.#repository = options.repository;
    this.#runLocal = options.runLocal;
    this.#onState = options.onState;
    this.#proposalReviewActions = Object.freeze({
      updateDecision: (proposalId, decision) => this.updateProposalDecision(proposalId, decision),
      agreeWithWallAdvisory: (proposalId) => this.agreeWithWallAdvisory(proposalId),
    });
  }

  get state(): RecognitionControllerState { return this.#state; }

  #setState(state: RecognitionControllerState): void {
    this.#state = state;
    this.#onState(state);
  }

  #setReviewState(session: RecognitionSessionRecord): void {
    this.#setState({
      kind: "review",
      session,
      proposalActions: this.#proposalReviewActions,
    });
  }

  #enqueuePersistence<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#persistenceTail.then(operation, operation);
    this.#persistenceTail = result.then(() => undefined, () => undefined);
    return result;
  }

  #putSession(
    session: RecognitionSessionRecord,
    guard?: () => boolean,
  ): Promise<boolean> {
    return this.#enqueuePersistence(async () => {
      if (guard && !guard()) return false;
      await this.#repository.put(session);
      return true;
    });
  }

  #deleteProject(projectId: string): Promise<void> {
    return this.#enqueuePersistence(() => this.#repository.deleteForProject(projectId));
  }

  #isCurrentAiProposalRun(
    generation: number,
    abortController: AbortController,
    requestId: string,
    referenceRevision: string,
    localDraftFingerprint: string,
  ): boolean {
    return !abortController.signal.aborted
      && this.#requestGeneration === generation
      && this.#abortController === abortController
      && this.#state.kind === "running-ai-proposals"
      && this.#state.requestId === requestId
      && this.#state.referenceRevision === referenceRevision
      && this.#state.localDraftFingerprint === localDraftFingerprint
      && this.#state.session.referenceRevision === referenceRevision
      && createLocalDraftFingerprint(this.#state.session.draft) === localDraftFingerprint;
  }

  async restore(projectId: string, reference: RecognitionReferenceIdentity | null): Promise<void> {
    this.cancelRunning();
    await this.#persistenceTail;
    const session = await this.#repository.getForProject(projectId);
    if (!session) { this.#setState({ kind: "idle", session: null }); return; }
    if (isRecognitionSessionStale(session, reference) || session.engineVersion !== LOCAL_RECOGNITION_ENGINE_VERSION) {
      this.#setState({ kind: "stale", session });
      return;
    }
    const reviewableDraft = enforceReviewableLocalDraft(validateRecognitionDraft(session.draft));
    if (reviewableDraft === session.draft) {
      this.#setReviewState(session);
      return;
    }
    const reviewableSession = {
      ...session,
      draft: reviewableDraft,
      cloudMetadata: null,
      updatedAt: reviewableDraft.updatedAt,
    };
    await this.#putSession(reviewableSession);
    this.#setReviewState(reviewableSession);
  }

  async startLocal(input: LocalRecognitionInput): Promise<void> {
    this.cancelRunning();
    const previous = this.#state.session;
    const abortController = new AbortController();
    this.#abortController = abortController;
    this.#setState({ kind: "running-local", session: previous, progress: { phase: "prepare", progress: 0 } });
    try {
      const rawDraft = await this.#runLocal(input, {
        signal: abortController.signal,
        onProgress: (progress) => {
          if (!abortController.signal.aborted && this.#abortController === abortController) {
            this.#setState({ kind: "running-local", session: previous, progress });
          }
        },
      });
      if (abortController.signal.aborted || this.#abortController !== abortController) return;
      const localDraft = validateRecognitionDraft({
        ...validateRecognitionDraft(rawDraft),
        ...emptyAiProposalDraftState(),
      });
      const reviewableDraft = enforceReviewableLocalDraft(localDraft);
      const session = { ...sessionFromDraft(reviewableDraft, previous), cloudMetadata: null };
      await this.#putSession(session);
      if (abortController.signal.aborted || this.#abortController !== abortController) return;
      this.#setReviewState(session);
    } catch (cause) {
      if (abortController.signal.aborted || this.#abortController !== abortController) return;
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
      this.#setState({ kind: "error", session: previous, message });
    } finally {
      if (this.#abortController === abortController) this.#abortController = null;
    }
  }

  async startAiProposalDiscovery(run: RecognitionAiProposalRunner): Promise<void> {
    const session = this.#state.session;
    if (!session) return;

    this.cancelRunning();
    const abortController = new AbortController();
    const generation = ++this.#requestGeneration;
    const requestId = crypto.randomUUID();
    const referenceRevision = session.referenceRevision;
    const localDraftFingerprint = createLocalDraftFingerprint(session.draft);
    this.#abortController = abortController;
    this.#setState({
      kind: "running-ai-proposals",
      session,
      requestId,
      referenceRevision,
      localDraftFingerprint,
    });

    const isCurrent = () => this.#isCurrentAiProposalRun(
      generation,
      abortController,
      requestId,
      referenceRevision,
      localDraftFingerprint,
    );

    try {
      const result = await run({
        session,
        requestId,
        referenceRevision,
        localDraftFingerprint,
        signal: abortController.signal,
      });
      if (!isCurrent()) return;

      if (!result) {
        this.#setReviewState(session);
        return;
      }

      const currentSession = this.#state.session;
      if (!currentSession) return;
      const reconciled = reconcileAiProposalBatch({
        localDraft: currentSession.draft,
        sanitized: result.sanitized,
        metadata: result.metadata,
        now: new Date().toISOString(),
      });
      const updated = sessionFromDraft(reconciled, currentSession);
      if (!isCurrent()) return;
      const persisted = await this.#putSession(updated, isCurrent);
      if (!persisted || !isCurrent()) return;
      this.#setReviewState(updated);
    } catch {
      if (!isCurrent()) return;
      const currentSession = this.#state.session;
      if (!currentSession) return;
      const now = new Date().toISOString();
      const failedDraft = validateRecognitionDraft({
        ...currentSession.draft,
        diagnostics: appendBoundedDiagnostic(
          currentSession.draft.diagnostics,
          AI_PROPOSAL_RUN_FAILED_DIAGNOSTIC,
        ),
        updatedAt: now,
      });
      const updated = sessionFromDraft(failedDraft, currentSession);
      const persisted = await this.#putSession(updated, isCurrent);
      if (!persisted || !isCurrent()) return;
      this.#setReviewState(updated);
    } finally {
      if (this.#abortController === abortController) this.#abortController = null;
    }
  }

  async updateDecision(candidateId: string, decision: RecognitionDecision): Promise<void> {
    await this.#updateDraft((draft) => ({
      ...draft,
      decisions: { ...draft.decisions, [candidateId]: decision },
      updatedAt: new Date().toISOString(),
    }));
  }

  async updateProposalDecision(
    proposalId: string,
    decision: RecognitionProposalDecision,
  ): Promise<void> {
    const session = this.#state.session;
    const proposal = session?.draft.aiProposals.find(({ id }) => id === proposalId);
    if (!session || !proposal || proposal.state !== "eligible") return;
    if (!Object.prototype.hasOwnProperty.call(session.draft.proposalDecisions, proposalId)) return;
    await this.#updateDraft((draft) => ({
      ...draft,
      proposalDecisions: { ...draft.proposalDecisions, [proposalId]: decision },
      updatedAt: new Date().toISOString(),
    }));
  }

  async agreeWithWallAdvisory(proposalId: string): Promise<void> {
    const session = this.#state.session;
    if (!session) return;
    const draft = session.draft;
    const proposal = draft.aiProposals.find(({ id }) => id === proposalId);
    const metadata = draft.aiProposalMetadata;
    const currentFingerprint = createLocalDraftFingerprint(draft);
    if (
      !proposal
      || proposal.kind !== "local-wall-review"
      || proposal.state !== "eligible"
      || !proposal.targetLocalCandidateId
      || !metadata
      || metadata.referenceRevision !== draft.referenceRevision
      || metadata.localDraftFingerprint !== currentFingerprint
      || proposal.localDraftFingerprint !== currentFingerprint
      || proposal.provider.requestId !== metadata.requestId
      || !Object.prototype.hasOwnProperty.call(draft.proposalDecisions, proposalId)
      || !draft.walls.some(({ id }) => id === proposal.targetLocalCandidateId)
    ) return;

    const targetId = proposal.targetLocalCandidateId;
    await this.#updateDraft((current) => {
      const currentProposal = current.aiProposals.find(({ id }) => id === proposalId);
      const currentMetadata = current.aiProposalMetadata;
      const fingerprint = createLocalDraftFingerprint(current);
      if (
        !currentProposal
        || currentProposal.kind !== "local-wall-review"
        || currentProposal.state !== "eligible"
        || currentProposal.targetLocalCandidateId !== targetId
        || !currentMetadata
        || currentMetadata.referenceRevision !== current.referenceRevision
        || currentMetadata.localDraftFingerprint !== fingerprint
        || currentProposal.localDraftFingerprint !== fingerprint
        || !current.walls.some(({ id }) => id === targetId)
      ) return current;
      return {
        ...current,
        decisions: { ...current.decisions, [targetId]: "rejected" },
        proposalDecisions: { ...current.proposalDecisions, [proposalId]: "accepted" },
        updatedAt: new Date().toISOString(),
      };
    });
  }

  async editWall(candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>): Promise<void> {
    await this.#updateDraft((draft) => ({
      ...draft,
      ...emptyAiProposalDraftState(),
      walls: draft.walls.map((wall) => wall.id === candidateId ? { ...wall, ...patch } : wall),
      decisions: { ...draft.decisions, [candidateId]: "edited" },
      updatedAt: new Date().toISOString(),
    }));
  }

  async replaceDraft(draft: RecognitionDraft, cloudMetadata: RecognitionSessionRecord["cloudMetadata"] = null): Promise<void> {
    this.cancelRunning();
    const current = this.#state.session;
    const session = { ...sessionFromDraft(validateRecognitionDraft(draft), current), cloudMetadata };
    await this.#putSession(session);
    this.#setReviewState(session);
  }

  setRunningCloud(): void {
    const session = this.#state.session;
    if (session) this.#setState({ kind: "running-cloud", session });
  }

  async returnToReviewWithError(message: string): Promise<void> {
    const session = this.#state.session;
    this.#setState({ kind: "error", session, message });
  }

  async discard(projectId: string): Promise<void> {
    this.cancelRunning();
    await this.#deleteProject(projectId);
    this.#setState({ kind: "idle", session: null });
  }

  async setAppliedState(applied: boolean): Promise<void> {
    const session = this.#state.session;
    if (!session) return;
    const status: RecognitionDraftStatus = applied ? "applied" : reviewStatus(session);
    if (session.draft.status === status) return;
    this.cancelRunning();
    const updatedAt = new Date().toISOString();
    const draft: ValidatedRecognitionDraft = { ...session.draft, status, updatedAt };
    const updated = { ...session, draft, updatedAt };
    await this.#putSession(updated);
    this.#setReviewState(updated);
  }

  async markApplied(): Promise<void> {
    await this.setAppliedState(true);
  }

  cancelRunning(): void {
    this.#requestGeneration += 1;
    this.#abortController?.abort();
    this.#abortController = null;
  }

  async #updateDraft(
    update: (draft: ValidatedRecognitionDraft) => ValidatedRecognitionDraft,
  ): Promise<void> {
    const session = this.#state.session;
    if (!session) return;
    this.cancelRunning();
    const changed = update(session.draft);
    const reviewable = session.draft.status === "applied"
      ? { ...changed, status: reviewStatus(session) }
      : changed;
    const draft = validateRecognitionDraft(reviewable);
    if (draft === session.draft) return;
    const updated = { ...session, draft, updatedAt: draft.updatedAt };
    await this.#putSession(updated);
    this.#setReviewState(updated);
  }
}

import {
  isRecognitionSessionStale,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  validateRecognitionDraft,
  type NormalizedPoint,
  type RecognitionDecision,
  type RecognitionDraft,
  type RecognitionSessionRecord,
  type RecognitionSessionRepository,
} from "@vlezet/recognition";
import type { LocalRecognitionInput, LocalRecognitionProgress } from "./local-recognition-types";

export type RecognitionControllerState =
  | Readonly<{ kind: "idle"; session: null }>
  | Readonly<{ kind: "running-local"; session: RecognitionSessionRecord | null; progress: LocalRecognitionProgress }>
  | Readonly<{ kind: "review"; session: RecognitionSessionRecord }>
  | Readonly<{ kind: "running-cloud"; session: RecognitionSessionRecord }>
  | Readonly<{ kind: "stale"; session: RecognitionSessionRecord }>
  | Readonly<{ kind: "error"; session: RecognitionSessionRecord | null; message: string }>;

export type RecognitionReferenceIdentity = Readonly<{ assetId: string; referenceRevision: string }>;

export type RecognitionControllerOptions = Readonly<{
  repository: RecognitionSessionRepository;
  runLocal: (input: LocalRecognitionInput, options: Readonly<{ signal?: AbortSignal; onProgress?: (progress: LocalRecognitionProgress) => void }>) => Promise<RecognitionDraft>;
  onState: (state: RecognitionControllerState) => void;
}>;

function sessionFromDraft(draft: RecognitionDraft, previous?: RecognitionSessionRecord | null): RecognitionSessionRecord {
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

export class RecognitionController {
  readonly #repository: RecognitionSessionRepository;
  readonly #runLocal: RecognitionControllerOptions["runLocal"];
  readonly #onState: RecognitionControllerOptions["onState"];
  #state: RecognitionControllerState = { kind: "idle", session: null };
  #abortController: AbortController | null = null;

  constructor(options: RecognitionControllerOptions) {
    this.#repository = options.repository;
    this.#runLocal = options.runLocal;
    this.#onState = options.onState;
  }

  get state(): RecognitionControllerState { return this.#state; }

  #setState(state: RecognitionControllerState): void {
    this.#state = state;
    this.#onState(state);
  }

  async restore(projectId: string, reference: RecognitionReferenceIdentity | null): Promise<void> {
    this.cancelRunning();
    const session = await this.#repository.getForProject(projectId);
    if (!session) { this.#setState({ kind: "idle", session: null }); return; }
    if (isRecognitionSessionStale(session, reference) || session.engineVersion !== LOCAL_RECOGNITION_ENGINE_VERSION) {
      this.#setState({ kind: "stale", session });
      return;
    }
    this.#setState({ kind: "review", session });
  }

  async startLocal(input: LocalRecognitionInput): Promise<void> {
    this.cancelRunning();
    const previous = this.#state.session;
    const abortController = new AbortController();
    this.#abortController = abortController;
    this.#setState({ kind: "running-local", session: previous, progress: { phase: "prepare", progress: 0 } });
    try {
      const draft = await this.#runLocal(input, {
        signal: abortController.signal,
        onProgress: (progress) => this.#setState({ kind: "running-local", session: previous, progress }),
      });
      if (abortController.signal.aborted) return;
      const session = { ...sessionFromDraft(validateRecognitionDraft(draft), previous), cloudMetadata: null };
      await this.#repository.put(session);
      this.#setState({ kind: "review", session });
    } catch (cause) {
      if (abortController.signal.aborted) return;
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
      this.#setState({ kind: "error", session: previous, message });
    } finally {
      if (this.#abortController === abortController) this.#abortController = null;
    }
  }

  async updateDecision(candidateId: string, decision: RecognitionDecision): Promise<void> {
    await this.#updateDraft((draft) => ({ ...draft, decisions: { ...draft.decisions, [candidateId]: decision }, updatedAt: new Date().toISOString() }));
  }

  async editWall(candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>): Promise<void> {
    await this.#updateDraft((draft) => ({
      ...draft,
      walls: draft.walls.map((wall) => wall.id === candidateId ? { ...wall, ...patch } : wall),
      decisions: { ...draft.decisions, [candidateId]: "edited" },
      updatedAt: new Date().toISOString(),
    }));
  }

  async replaceDraft(draft: RecognitionDraft, cloudMetadata: RecognitionSessionRecord["cloudMetadata"] = null): Promise<void> {
    const current = this.#state.session;
    const session = { ...sessionFromDraft(validateRecognitionDraft(draft), current), cloudMetadata };
    await this.#repository.put(session);
    this.#setState({ kind: "review", session });
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
    await this.#repository.deleteForProject(projectId);
    this.#setState({ kind: "idle", session: null });
  }

  async markApplied(): Promise<void> {
    const session = this.#state.session;
    if (!session) return;
    const draft: RecognitionDraft = { ...session.draft, status: "applied", updatedAt: new Date().toISOString() };
    const updated = { ...session, draft, updatedAt: draft.updatedAt };
    await this.#repository.put(updated);
    this.#setState({ kind: "review", session: updated });
  }

  cancelRunning(): void {
    this.#abortController?.abort();
    this.#abortController = null;
  }

  async #updateDraft(update: (draft: RecognitionDraft) => RecognitionDraft): Promise<void> {
    const session = this.#state.session;
    if (!session) return;
    const draft = validateRecognitionDraft(update(session.draft));
    const updated = { ...session, draft, updatedAt: draft.updatedAt };
    await this.#repository.put(updated);
    this.#setState({ kind: "review", session: updated });
  }
}

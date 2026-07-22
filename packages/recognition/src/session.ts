import { validateRecognitionSession, type RecognitionSessionRecord } from "./model";

export type RecognitionReferenceIdentity = Readonly<{
  assetId: string;
  referenceRevision: string;
}>;

export interface RecognitionSessionRepository {
  getForProject(projectId: string): Promise<RecognitionSessionRecord | null>;
  put(session: RecognitionSessionRecord): Promise<void>;
  deleteForProject(projectId: string): Promise<void>;
}

export class MemoryRecognitionSessionRepository implements RecognitionSessionRepository {
  readonly #sessions = new Map<string, RecognitionSessionRecord>();

  async getForProject(projectId: string): Promise<RecognitionSessionRecord | null> {
    const value = this.#sessions.get(projectId);
    return value ? structuredClone(value) : null;
  }

  async put(session: RecognitionSessionRecord): Promise<void> {
    const valid = validateRecognitionSession(session);
    for (const [projectId, existing] of this.#sessions) {
      if (existing.id === valid.id && projectId !== valid.projectId) this.#sessions.delete(projectId);
    }
    this.#sessions.set(valid.projectId, structuredClone(valid));
  }

  async deleteForProject(projectId: string): Promise<void> {
    this.#sessions.delete(projectId);
  }
}

export function isRecognitionSessionStale(
  session: Pick<RecognitionSessionRecord, "referenceAssetId" | "referenceRevision">,
  reference: RecognitionReferenceIdentity | null,
): boolean {
  return !reference ||
    session.referenceAssetId !== reference.assetId ||
    session.referenceRevision !== reference.referenceRevision;
}

import { validateProject, type VlezetProjectRecord } from "./project";

export interface ProjectRepository {
  list(): Promise<readonly VlezetProjectRecord[]>;
  get(id: string): Promise<VlezetProjectRecord | null>;
  put(project: VlezetProjectRecord): Promise<void>;
  delete(id: string): Promise<void>;
  getLastProjectId(): Promise<string | null>;
  setLastProjectId(id: string | null): Promise<void>;
}

function cloneProject(project: VlezetProjectRecord): VlezetProjectRecord {
  return validateProject(structuredClone(project));
}

export class MemoryProjectRepository implements ProjectRepository {
  readonly #projects = new Map<string, VlezetProjectRecord>();
  #lastProjectId: string | null = null;

  async list(): Promise<readonly VlezetProjectRecord[]> {
    return [...this.#projects.values()]
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id))
      .map(cloneProject);
  }

  async get(id: string): Promise<VlezetProjectRecord | null> {
    const project = this.#projects.get(id);
    return project ? cloneProject(project) : null;
  }

  async put(project: VlezetProjectRecord): Promise<void> {
    const valid = cloneProject(project);
    this.#projects.set(valid.id, valid);
  }

  async delete(id: string): Promise<void> {
    this.#projects.delete(id);
    if (this.#lastProjectId === id) this.#lastProjectId = null;
  }

  async getLastProjectId(): Promise<string | null> {
    return this.#lastProjectId;
  }

  async setLastProjectId(id: string | null): Promise<void> {
    this.#lastProjectId = id;
  }
}

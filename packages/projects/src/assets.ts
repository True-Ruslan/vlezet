export const MAX_REFERENCE_ASSET_BYTES = 20 * 1024 * 1024;

export type ProjectAssetMimeType = "image/png" | "image/jpeg";

export type ProjectAssetRecord = Readonly<{
  id: string;
  projectId: string;
  kind: "reference-raster";
  mimeType: ProjectAssetMimeType;
  byteLength: number;
  createdAt: string;
  blob: Blob;
}>;

export type CreateProjectAssetInput = Readonly<{
  id: string;
  projectId: string;
  mimeType: ProjectAssetMimeType;
  createdAt: string;
  blob: Blob;
}>;

export class ProjectAssetValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ProjectAssetValidationError";
  }
}

export function createProjectAsset(input: CreateProjectAssetInput): ProjectAssetRecord {
  const id = input.id.trim();
  const projectId = input.projectId.trim();
  if (!id || !projectId) throw new ProjectAssetValidationError("Подложка должна принадлежать проекту.");
  if (input.mimeType !== "image/png" && input.mimeType !== "image/jpeg") {
    throw new ProjectAssetValidationError("Формат подложки не поддерживается.");
  }
  if (input.blob.type !== input.mimeType) {
    throw new ProjectAssetValidationError("Тип бинарных данных подложки не совпадает с метаданными.");
  }
  if (input.blob.size <= 0 || input.blob.size > MAX_REFERENCE_ASSET_BYTES) {
    throw new ProjectAssetValidationError("Размер подложки не поддерживается.");
  }
  if (Number.isNaN(Date.parse(input.createdAt))) {
    throw new ProjectAssetValidationError("Дата создания подложки некорректна.");
  }
  return {
    id,
    projectId,
    kind: "reference-raster",
    mimeType: input.mimeType,
    byteLength: input.blob.size,
    createdAt: input.createdAt,
    blob: input.blob,
  };
}

export function validateProjectAsset(value: unknown): ProjectAssetRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectAssetValidationError("Подложка содержит некорректные данные.");
  }
  const input = value as Partial<ProjectAssetRecord>;
  if (!(input.blob instanceof Blob)) throw new ProjectAssetValidationError("Бинарные данные подложки отсутствуют.");
  const asset = createProjectAsset({
    id: String(input.id ?? ""),
    projectId: String(input.projectId ?? ""),
    mimeType: input.mimeType as ProjectAssetMimeType,
    createdAt: String(input.createdAt ?? ""),
    blob: input.blob,
  });
  if (input.kind !== "reference-raster" || input.byteLength !== asset.byteLength) {
    throw new ProjectAssetValidationError("Метаданные подложки повреждены.");
  }
  return asset;
}

export interface ProjectAssetRepository {
  getAsset(id: string): Promise<ProjectAssetRecord | null>;
  putAsset(asset: ProjectAssetRecord): Promise<void>;
  deleteAsset(id: string): Promise<void>;
  deleteAssetsForProject(projectId: string): Promise<void>;
}

export class MemoryProjectAssetRepository implements ProjectAssetRepository {
  readonly #assets = new Map<string, ProjectAssetRecord>();

  async getAsset(id: string): Promise<ProjectAssetRecord | null> {
    return this.#assets.get(id) ?? null;
  }

  async putAsset(asset: ProjectAssetRecord): Promise<void> {
    const valid = validateProjectAsset(asset);
    this.#assets.set(valid.id, valid);
  }

  async deleteAsset(id: string): Promise<void> {
    this.#assets.delete(id);
  }

  async deleteAssetsForProject(projectId: string): Promise<void> {
    for (const [id, asset] of this.#assets) {
      if (asset.projectId === projectId) this.#assets.delete(id);
    }
  }
}

export type ReferenceAssetTransactionEvent =
  | "new-asset-written"
  | "metadata-written"
  | "old-asset-deleted";

export async function replaceReferenceAssetTransaction(input: Readonly<{
  repository: ProjectAssetRepository;
  oldAssetId: string | null;
  newAsset: ProjectAssetRecord;
  persistMetadata: () => Promise<void>;
  onEvent?: (event: ReferenceAssetTransactionEvent) => void;
}>): Promise<void> {
  await input.repository.putAsset(input.newAsset);
  input.onEvent?.("new-asset-written");
  try {
    await input.persistMetadata();
    input.onEvent?.("metadata-written");
  } catch (error) {
    await input.repository.deleteAsset(input.newAsset.id);
    throw error;
  }
  if (input.oldAssetId && input.oldAssetId !== input.newAsset.id) {
    await input.repository.deleteAsset(input.oldAssetId);
    input.onEvent?.("old-asset-deleted");
  }
}

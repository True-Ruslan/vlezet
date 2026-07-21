import {
  MAX_REFERENCE_ASSET_BYTES,
  createProjectAsset,
  type ProjectAssetRecord,
  type ProjectAssetMimeType,
} from "./assets";
import {
  DEFAULT_PROJECT_VIEWPORT,
  ProjectValidationError,
  createProject,
  normalizeProjectName,
  parseAndMigrateDocument,
  validateProject,
  validateProjectUi,
  validateProjectViewport,
  validateReferencePlan,
  type ProjectViewport,
  type ReferencePlan,
  type VlezetProjectRecord,
} from "./project";

export type ProjectFileErrorCode = "invalid-json" | "invalid-format" | "unsupported-version" | "invalid-data" | "asset-too-large";

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;

  constructor(code: ProjectFileErrorCode, message: string) {
    super(message);
    this.name = "ProjectFileError";
    this.code = code;
  }
}

export type ParseProjectFileOptions = Readonly<{ id: string; now: string }>;
export type ParsePortableProjectFileOptions = ParseProjectFileOptions & Readonly<{ assetId: string }>;
export type ParsedPortableProjectFile = Readonly<{ project: VlezetProjectRecord; asset: ProjectAssetRecord | null }>;

function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new ProjectFileError("invalid-data", "Файл содержит некорректные данные проекта.");
  }
  return value as Record<string, unknown>;
}

function validTimestamp(value: unknown): string {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    throw new ProjectFileError("invalid-data", "Файл содержит некорректную дату экспорта.");
  }
  return value;
}

function parseEnvelope(text: string): Record<string, unknown> {
  let parsed: unknown;
  try { parsed = JSON.parse(text); }
  catch { throw new ProjectFileError("invalid-json", "Файл не является корректным JSON."); }
  const envelope = object(parsed);
  if (envelope.format !== "vlezet-project") {
    throw new ProjectFileError("invalid-format", "Это не файл проекта Vlezet: формат не поддерживается.");
  }
  return envelope;
}

function createImportedProject(project: Record<string, unknown>, options: ParseProjectFileOptions): VlezetProjectRecord {
  const viewport: ProjectViewport = project.viewport === undefined
    ? DEFAULT_PROJECT_VIEWPORT
    : validateProjectViewport(project.viewport);
  return createProject({
    id: options.id,
    name: normalizeProjectName(project.name),
    now: options.now,
    document: parseAndMigrateDocument(project.document),
    viewport,
    ui: project.ui === undefined ? undefined : validateProjectUi(project.ui),
  });
}

export function serializeProjectFile(project: VlezetProjectRecord, exportedAt = new Date().toISOString()): string {
  const valid = validateProject(project);
  validTimestamp(exportedAt);
  return JSON.stringify({
    format: "vlezet-project",
    fileVersion: 1,
    exportedAt,
    project: { name: valid.name, document: valid.document, viewport: valid.viewport },
  }, null, 2);
}

export function parseProjectFile(text: string, options: ParseProjectFileOptions): VlezetProjectRecord {
  const envelope = parseEnvelope(text);
  if (envelope.fileVersion !== 1) {
    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается этим режимом импорта.");
  }
  validTimestamp(envelope.exportedAt);
  try { return createImportedProject(object(envelope.project), options); }
  catch (error) {
    if (error instanceof ProjectFileError) throw error;
    if (error instanceof ProjectValidationError || error instanceof Error) {
      throw new ProjectFileError("invalid-data", "Файл содержит некорректные данные проекта.");
    }
    throw error;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunk = 0x8000;
  for (let index = 0; index < bytes.length; index += chunk) {
    binary += String.fromCharCode(...bytes.subarray(index, Math.min(index + chunk, bytes.length)));
  }
  return btoa(binary);
}

function base64ToBytes(value: string): Uint8Array {
  if (value.length > Math.ceil(MAX_REFERENCE_ASSET_BYTES * 4 / 3) + 16) {
    throw new ProjectFileError("asset-too-large", "Подложка в файле слишком большая.");
  }
  let binary: string;
  try { binary = atob(value); }
  catch { throw new ProjectFileError("invalid-data", "Подложка в файле повреждена."); }
  if (binary.length > MAX_REFERENCE_ASSET_BYTES) {
    throw new ProjectFileError("asset-too-large", "Подложка в файле слишком большая.");
  }
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

function portableReference(referencePlan: ReferencePlan): Omit<ReferencePlan, "assetId"> {
  const { assetId: _assetId, ...portable } = referencePlan;
  return portable;
}

export async function serializePortableProjectFile(
  project: VlezetProjectRecord,
  asset: ProjectAssetRecord | null,
  exportedAt = new Date().toISOString(),
): Promise<string> {
  const valid = validateProject(project);
  validTimestamp(exportedAt);
  if (valid.referencePlan && (!asset || asset.id !== valid.referencePlan.assetId || asset.projectId !== valid.id)) {
    throw new ProjectFileError("invalid-data", "Подложка проекта отсутствует и не может быть добавлена в резервную копию.");
  }
  const assets = asset ? [{
    role: "reference-raster",
    mimeType: asset.mimeType,
    dataBase64: bytesToBase64(new Uint8Array(await asset.blob.arrayBuffer())),
  }] : undefined;
  return JSON.stringify({
    format: "vlezet-project",
    fileVersion: 2,
    exportedAt,
    project: {
      name: valid.name,
      document: valid.document,
      viewport: valid.viewport,
      ui: valid.ui,
      referencePlan: valid.referencePlan ? portableReference(valid.referencePlan) : null,
    },
    ...(assets ? { assets } : {}),
  }, null, 2);
}

export async function parsePortableProjectFile(
  text: string,
  options: ParsePortableProjectFileOptions,
): Promise<ParsedPortableProjectFile> {
  const envelope = parseEnvelope(text);
  if (envelope.fileVersion === 1) {
    return { project: parseProjectFile(text, options), asset: null };
  }
  if (envelope.fileVersion !== 2) {
    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");
  }
  validTimestamp(envelope.exportedAt);

  try {
    const sourceProject = object(envelope.project);
    const referenceValue = sourceProject.referencePlan;
    const reference = referenceValue == null ? null : validateReferencePlan({
      ...object(referenceValue),
      assetId: options.assetId,
    });
    const project = createProject({
      id: options.id,
      name: normalizeProjectName(sourceProject.name),
      now: options.now,
      document: parseAndMigrateDocument(sourceProject.document),
      viewport: sourceProject.viewport === undefined ? DEFAULT_PROJECT_VIEWPORT : validateProjectViewport(sourceProject.viewport),
      ui: sourceProject.ui === undefined ? undefined : validateProjectUi(sourceProject.ui),
      referencePlan: reference,
    });

    if (!reference) return { project, asset: null };
    if (!Array.isArray(envelope.assets) || envelope.assets.length !== 1) {
      throw new ProjectFileError("invalid-data", "Файл не содержит подложку проекта.");
    }
    const embedded = object(envelope.assets[0]);
    if (embedded.role !== "reference-raster") throw new ProjectFileError("invalid-data", "Роль подложки в файле некорректна.");
    if (embedded.mimeType !== "image/png" && embedded.mimeType !== "image/jpeg") {
      throw new ProjectFileError("invalid-data", "Формат подложки в файле не поддерживается.");
    }
    if (typeof embedded.dataBase64 !== "string") throw new ProjectFileError("invalid-data", "Подложка в файле повреждена.");
    const bytes = base64ToBytes(embedded.dataBase64);
    const mimeType = embedded.mimeType as ProjectAssetMimeType;
    const assetBuffer = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(assetBuffer).set(bytes);
    const asset = createProjectAsset({
      id: options.assetId,
      projectId: options.id,
      mimeType,
      createdAt: options.now,
      blob: new Blob([assetBuffer], { type: mimeType }),
    });
    return { project, asset };
  } catch (error) {
    if (error instanceof ProjectFileError) throw error;
    if (error instanceof ProjectValidationError || error instanceof Error) {
      throw new ProjectFileError("invalid-data", "Файл содержит некорректные данные проекта.");
    }
    throw error;
  }
}

const TRANSLITERATION: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "ts", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
};

export function projectFileSlug(name: string): string {
  const source = name.trim().toLowerCase();
  const transliterated = [...source].map((character) => TRANSLITERATION[character] ?? character).join("");
  const slug = transliterated.replace(/№/g, "-").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").replace(/-+/g, "-");
  return slug || "vlezet-project";
}

export function projectJsonFilename(name: string): string {
  return `${projectFileSlug(name)}.vlezet.json`;
}

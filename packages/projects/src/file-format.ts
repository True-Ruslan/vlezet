import {
  DEFAULT_PROJECT_VIEWPORT,
  ProjectValidationError,
  createProject,
  normalizeProjectName,
  parseAndMigrateDocument,
  validateProject,
  validateProjectViewport,
  type ProjectViewport,
  type VlezetProjectRecord,
} from "./project";

export type ProjectFileErrorCode = "invalid-json" | "invalid-format" | "unsupported-version" | "invalid-data";

export class ProjectFileError extends Error {
  readonly code: ProjectFileErrorCode;

  constructor(code: ProjectFileErrorCode, message: string) {
    super(message);
    this.name = "ProjectFileError";
    this.code = code;
  }
}

export type ParseProjectFileOptions = Readonly<{
  id: string;
  now: string;
}>;

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

export function serializeProjectFile(project: VlezetProjectRecord, exportedAt = new Date().toISOString()): string {
  const valid = validateProject(project);
  validTimestamp(exportedAt);
  return JSON.stringify({
    format: "vlezet-project",
    fileVersion: 1,
    exportedAt,
    project: {
      name: valid.name,
      document: valid.document,
      viewport: valid.viewport,
    },
  }, null, 2);
}

export function parseProjectFile(text: string, options: ParseProjectFileOptions): VlezetProjectRecord {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProjectFileError("invalid-json", "Файл не является корректным JSON.");
  }

  const envelope = object(parsed);
  if (envelope.format !== "vlezet-project") {
    throw new ProjectFileError("invalid-format", "Это не файл проекта Vlezet: формат не поддерживается.");
  }
  if (envelope.fileVersion !== 1) {
    throw new ProjectFileError("unsupported-version", "Версия файла Vlezet пока не поддерживается.");
  }
  validTimestamp(envelope.exportedAt);

  try {
    const project = object(envelope.project);
    const viewport: ProjectViewport = project.viewport === undefined
      ? DEFAULT_PROJECT_VIEWPORT
      : validateProjectViewport(project.viewport);
    return createProject({
      id: options.id,
      name: normalizeProjectName(project.name),
      now: options.now,
      document: parseAndMigrateDocument(project.document),
      viewport,
    });
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
  const slug = transliterated
    .replace(/№/g, "-")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-");
  return slug || "vlezet-project";
}

export function projectJsonFilename(name: string): string {
  return `${projectFileSlug(name)}.vlezet.json`;
}

export {
  DEFAULT_PROJECT_UI,
  DEFAULT_PROJECT_VIEWPORT,
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECT_SCALE,
  MIN_PROJECT_SCALE,
  PROJECT_STORAGE_VERSION,
  ProjectValidationError,
  createProject,
  duplicateProject,
  normalizeProjectName,
  parseAndMigrateDocument,
  parseDocumentInput,
  renameProject,
  replaceProjectDocument,
  replaceProjectUi,
  replaceProjectViewport,
  validateProject,
  validateProjectUi,
  validateProjectViewport,
} from "./project";
export type {
  CreateProjectInput,
  ProjectUiState,
  ProjectViewport,
  VlezetProjectRecord,
} from "./project";

export { MemoryProjectRepository } from "./repository";
export type { ProjectRepository } from "./repository";

export {
  IndexedDbProjectRepository,
  ProjectStorageError,
  createIndexedDbProjectRepository,
} from "./indexeddb";

export {
  ProjectFileError,
  parseProjectFile,
  projectFileSlug,
  projectJsonFilename,
  serializeProjectFile,
} from "./file-format";
export type { ParseProjectFileOptions, ProjectFileErrorCode } from "./file-format";

export { AutosaveCoordinator } from "./autosave";
export type { AutosaveCoordinatorOptions, SaveStatus } from "./autosave";

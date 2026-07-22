export {
  DEFAULT_PROJECT_UI,
  DEFAULT_PROJECT_VIEWPORT,
  MAX_PROJECT_NAME_LENGTH,
  MAX_PROJECT_SCALE,
  MAX_REFERENCE_SCALE,
  MIN_PROJECT_SCALE,
  MIN_REFERENCE_SCALE,
  PROJECT_STORAGE_VERSION,
  ProjectValidationError,
  createProject,
  duplicateProject,
  normalizeProjectName,
  parseAndMigrateDocument,
  parseDocumentInput,
  renameProject,
  replaceProjectDocument,
  replaceProjectReferencePlan,
  replaceProjectUi,
  replaceProjectViewport,
  updateReferencePlanDisplay,
  validateProject,
  validateProjectUi,
  validateProjectViewport,
  validateReferencePlan,
} from "./project";
export type {
  CreateProjectInput,
  ProjectUiState,
  ProjectViewport,
  ReferenceAlignment,
  ReferencePlan,
  ReferencePlanCalibration,
  ReferencePlanDisplay,
  ReferencePlanSource,
  ReferencePlanTransform,
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
  MAX_REFERENCE_ASSET_BYTES,
  MemoryProjectAssetRepository,
  ProjectAssetValidationError,
  createProjectAsset,
  replaceReferenceAssetTransaction,
  validateProjectAsset,
} from "./assets";
export type {
  CreateProjectAssetInput,
  ProjectAssetMimeType,
  ProjectAssetRecord,
  ProjectAssetRepository,
  ReferenceAssetTransactionEvent,
} from "./assets";

export {
  ProjectFileError,
  parsePortableProjectFile,
  parseProjectFile,
  projectFileSlug,
  projectJsonFilename,
  serializePortableProjectFile,
  serializeProjectFile,
} from "./file-format";
export type {
  ParsePortableProjectFileOptions,
  ParseProjectFileOptions,
  ParsedPortableProjectFile,
  ProjectFileErrorCode,
} from "./file-format";

export { AutosaveCoordinator } from "./autosave";
export type { AutosaveCoordinatorOptions, SaveStatus } from "./autosave";

export {
  ASSETS_STORE,
  LAST_PROJECT_KEY,
  PROJECTS_STORE,
  PROJECT_ID_INDEX,
  RECOGNITION_SESSIONS_STORE,
  SETTINGS_STORE,
  UPDATED_AT_INDEX,
  VLEZET_DATABASE_NAME,
  VLEZET_DATABASE_VERSION,
} from "./indexeddb-schema";

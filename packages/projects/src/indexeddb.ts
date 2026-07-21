import { validateProjectAsset, type ProjectAssetRecord, type ProjectAssetRepository } from "./assets";
import { validateProject, type VlezetProjectRecord } from "./project";
import type { ProjectRepository } from "./repository";

const DATABASE_NAME = "vlezet";
const DATABASE_VERSION = 2;
const PROJECTS_STORE = "projects";
const SETTINGS_STORE = "settings";
const ASSETS_STORE = "assets";
const UPDATED_AT_INDEX = "updatedAt";
const PROJECT_ID_INDEX = "projectId";
const LAST_PROJECT_KEY = "lastProjectId";

type SettingRecord = Readonly<{ key: string; value: string | null }>;

export class ProjectStorageError extends Error {
  constructor(message = "Не удалось открыть локальное хранилище проектов.", options?: ErrorOptions) {
    super(message, options);
    this.name = "ProjectStorageError";
  }
}

function requestResult<T>(request: IDBRequest<T>, message = "Не удалось прочитать локальные проекты."): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new ProjectStorageError(message, { cause: request.error }));
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(new ProjectStorageError("Не удалось сохранить изменения проекта.", { cause: transaction.error }));
    transaction.onerror = () => reject(new ProjectStorageError("Не удалось сохранить изменения проекта.", { cause: transaction.error }));
  });
}

function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let request: IDBOpenDBRequest;
    try {
      request = factory.open(DATABASE_NAME, DATABASE_VERSION);
    } catch (error) {
      reject(new ProjectStorageError(undefined, { cause: error }));
      return;
    }

    request.onupgradeneeded = () => {
      const database = request.result;
      const projects = database.objectStoreNames.contains(PROJECTS_STORE)
        ? request.transaction!.objectStore(PROJECTS_STORE)
        : database.createObjectStore(PROJECTS_STORE, { keyPath: "id" });
      if (!projects.indexNames.contains(UPDATED_AT_INDEX)) {
        projects.createIndex(UPDATED_AT_INDEX, "updatedAt", { unique: false });
      }
      if (!database.objectStoreNames.contains(SETTINGS_STORE)) {
        database.createObjectStore(SETTINGS_STORE, { keyPath: "key" });
      }
      const assets = database.objectStoreNames.contains(ASSETS_STORE)
        ? request.transaction!.objectStore(ASSETS_STORE)
        : database.createObjectStore(ASSETS_STORE, { keyPath: "id" });
      if (!assets.indexNames.contains(PROJECT_ID_INDEX)) {
        assets.createIndex(PROJECT_ID_INDEX, "projectId", { unique: false });
      }
    };
    request.onsuccess = () => {
      const database = request.result;
      database.onversionchange = () => database.close();
      resolve(database);
    };
    request.onblocked = () => reject(new ProjectStorageError("Закройте другие вкладки Vlezet и попробуйте снова."));
    request.onerror = () => reject(new ProjectStorageError(undefined, { cause: request.error }));
  });
}

async function deleteAssetsInTransaction(transaction: IDBTransaction, projectId: string): Promise<void> {
  const store = transaction.objectStore(ASSETS_STORE);
  const keys = await requestResult(store.index(PROJECT_ID_INDEX).getAllKeys(projectId), "Не удалось прочитать подложки проекта.");
  for (const key of keys) store.delete(key);
}

export class IndexedDbProjectRepository implements ProjectRepository, ProjectAssetRepository {
  readonly #database: Promise<IDBDatabase>;

  constructor(factory: IDBFactory) {
    this.#database = openDatabase(factory);
  }

  async list(): Promise<readonly VlezetProjectRecord[]> {
    const database = await this.#database;
    const transaction = database.transaction(PROJECTS_STORE, "readonly");
    const values = await requestResult(transaction.objectStore(PROJECTS_STORE).getAll());
    await transactionDone(transaction);
    return values
      .map((value) => validateProject(value))
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt) || first.id.localeCompare(second.id));
  }

  async get(id: string): Promise<VlezetProjectRecord | null> {
    const database = await this.#database;
    const transaction = database.transaction(PROJECTS_STORE, "readonly");
    const value = await requestResult(transaction.objectStore(PROJECTS_STORE).get(id));
    await transactionDone(transaction);
    return value === undefined ? null : validateProject(value);
  }

  async put(project: VlezetProjectRecord): Promise<void> {
    const valid = validateProject(project);
    const database = await this.#database;
    const transaction = database.transaction(PROJECTS_STORE, "readwrite");
    transaction.objectStore(PROJECTS_STORE).put(valid);
    await transactionDone(transaction);
  }

  async delete(id: string): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction([PROJECTS_STORE, SETTINGS_STORE, ASSETS_STORE], "readwrite");
    transaction.objectStore(PROJECTS_STORE).delete(id);
    await deleteAssetsInTransaction(transaction, id);
    const settings = transaction.objectStore(SETTINGS_STORE);
    const current = await requestResult<SettingRecord | undefined>(settings.get(LAST_PROJECT_KEY));
    if (current?.value === id) settings.put({ key: LAST_PROJECT_KEY, value: null } satisfies SettingRecord);
    await transactionDone(transaction);
  }

  async getLastProjectId(): Promise<string | null> {
    const database = await this.#database;
    const transaction = database.transaction(SETTINGS_STORE, "readonly");
    const value = await requestResult<SettingRecord | undefined>(transaction.objectStore(SETTINGS_STORE).get(LAST_PROJECT_KEY));
    await transactionDone(transaction);
    return value?.value ?? null;
  }

  async setLastProjectId(id: string | null): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(SETTINGS_STORE, "readwrite");
    transaction.objectStore(SETTINGS_STORE).put({ key: LAST_PROJECT_KEY, value: id } satisfies SettingRecord);
    await transactionDone(transaction);
  }

  async getAsset(id: string): Promise<ProjectAssetRecord | null> {
    const database = await this.#database;
    const transaction = database.transaction(ASSETS_STORE, "readonly");
    const value = await requestResult(transaction.objectStore(ASSETS_STORE).get(id), "Не удалось прочитать подложку.");
    await transactionDone(transaction);
    return value === undefined ? null : validateProjectAsset(value);
  }

  async putAsset(asset: ProjectAssetRecord): Promise<void> {
    const valid = validateProjectAsset(asset);
    const database = await this.#database;
    const transaction = database.transaction(ASSETS_STORE, "readwrite");
    transaction.objectStore(ASSETS_STORE).put(valid);
    await transactionDone(transaction);
  }

  async deleteAsset(id: string): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(ASSETS_STORE, "readwrite");
    transaction.objectStore(ASSETS_STORE).delete(id);
    await transactionDone(transaction);
  }

  async deleteAssetsForProject(projectId: string): Promise<void> {
    const database = await this.#database;
    const transaction = database.transaction(ASSETS_STORE, "readwrite");
    await deleteAssetsInTransaction(transaction, projectId);
    await transactionDone(transaction);
  }
}

export function createIndexedDbProjectRepository(factory: IDBFactory | undefined = globalThis.indexedDB): IndexedDbProjectRepository {
  if (!factory) throw new ProjectStorageError("Этот браузер не поддерживает локальное хранилище проектов.");
  return new IndexedDbProjectRepository(factory);
}

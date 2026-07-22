import {
  PROJECT_ID_INDEX,
  RECOGNITION_SESSIONS_STORE,
  VLEZET_DATABASE_NAME,
  VLEZET_DATABASE_VERSION,
} from "@vlezet/projects";
import {
  validateRecognitionSession,
  type RecognitionSessionRecord,
  type RecognitionSessionRepository,
} from "@vlezet/recognition";

export class RecognitionSessionStorageError extends Error {
  constructor(message = "Не удалось сохранить черновик распознавания в этом браузере.", options?: ErrorOptions) {
    super(message, options);
    this.name = "RecognitionSessionStorageError";
  }
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error ?? new RecognitionSessionStorageError());
  });
}

function transactionDone(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => {
    transaction.oncomplete = () => resolve();
    transaction.onabort = () => reject(transaction.error ?? new RecognitionSessionStorageError());
    transaction.onerror = () => reject(transaction.error ?? new RecognitionSessionStorageError());
  });
}

function containsSecretKey(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  if (Array.isArray(value)) return value.some(containsSecretKey);
  for (const [key, nested] of Object.entries(value as Record<string, unknown>)) {
    const normalized = key.toLowerCase().replace(/[^a-z]/g, "");
    if (normalized === "apikey" || normalized === "authorization" || normalized === "bearertoken") return true;
    if (containsSecretKey(nested)) return true;
  }
  return false;
}

export function assertRecognitionSessionHasNoSecrets(value: unknown): void {
  if (containsSecretKey(value)) {
    throw new RecognitionSessionStorageError("Секреты провайдера нельзя сохранять в черновике распознавания.");
  }
}

async function openDatabase(factory: IDBFactory): Promise<IDBDatabase> {
  let request: IDBOpenDBRequest;
  try {
    request = factory.open(VLEZET_DATABASE_NAME, VLEZET_DATABASE_VERSION);
  } catch (cause) {
    throw new RecognitionSessionStorageError(undefined, { cause });
  }
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new RecognitionSessionStorageError(undefined, { cause: request.error }));
    request.onblocked = () => reject(new RecognitionSessionStorageError("Хранилище Vlezet заблокировано другой вкладкой."));
  });
}

export class IndexedDbRecognitionSessionRepository implements RecognitionSessionRepository {
  readonly #factory: IDBFactory;

  constructor(factory: IDBFactory = indexedDB) {
    this.#factory = factory;
  }

  async getForProject(projectId: string): Promise<RecognitionSessionRecord | null> {
    const database = await openDatabase(this.#factory);
    try {
      const transaction = database.transaction(RECOGNITION_SESSIONS_STORE, "readonly");
      const store = transaction.objectStore(RECOGNITION_SESSIONS_STORE);
      const index = store.index(PROJECT_ID_INDEX);
      const result = await requestResult(index.get(projectId));
      await transactionDone(transaction);
      return result === undefined ? null : validateRecognitionSession(result);
    } catch (cause) {
      if (cause instanceof RecognitionSessionStorageError) throw cause;
      throw new RecognitionSessionStorageError(undefined, { cause });
    } finally {
      database.close();
    }
  }

  async put(session: RecognitionSessionRecord): Promise<void> {
    const valid = validateRecognitionSession(session);
    assertRecognitionSessionHasNoSecrets(valid);
    const database = await openDatabase(this.#factory);
    try {
      const transaction = database.transaction(RECOGNITION_SESSIONS_STORE, "readwrite");
      transaction.objectStore(RECOGNITION_SESSIONS_STORE).put(structuredClone(valid));
      await transactionDone(transaction);
    } catch (cause) {
      if (cause instanceof RecognitionSessionStorageError) throw cause;
      throw new RecognitionSessionStorageError(undefined, { cause });
    } finally {
      database.close();
    }
  }

  async deleteForProject(projectId: string): Promise<void> {
    const database = await openDatabase(this.#factory);
    try {
      const transaction = database.transaction(RECOGNITION_SESSIONS_STORE, "readwrite");
      const store = transaction.objectStore(RECOGNITION_SESSIONS_STORE);
      const key = await requestResult(store.index(PROJECT_ID_INDEX).getKey(projectId));
      if (key !== undefined) store.delete(key);
      await transactionDone(transaction);
    } catch (cause) {
      if (cause instanceof RecognitionSessionStorageError) throw cause;
      throw new RecognitionSessionStorageError(undefined, { cause });
    } finally {
      database.close();
    }
  }
}

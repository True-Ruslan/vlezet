import { describe, expect, it, vi } from "vitest";
import {
  ASSETS_STORE,
  PROJECTS_STORE,
  PROJECT_ID_INDEX,
  RECOGNITION_SESSIONS_STORE,
  SETTINGS_STORE,
  UPDATED_AT_INDEX,
  VLEZET_DATABASE_NAME,
  VLEZET_DATABASE_VERSION,
} from "./indexeddb-schema";
import { createIndexedDbProjectRepository } from "./indexeddb";

function names(values: readonly string[]): DOMStringList {
  return {
    contains: (value: string) => values.includes(value),
    item: (index: number) => values[index] ?? null,
    length: values.length,
    [Symbol.iterator]: function* () {
      yield* values;
    },
  } as unknown as DOMStringList;
}

function factoryForUpgrade(input: Readonly<{
  existingStores?: readonly string[];
  existingIndexes?: Readonly<Record<string, readonly string[]>>;
}>) {
  let readTransaction: IDBTransaction;
  const stores = new Map<string, { value: IDBObjectStore; createIndex: ReturnType<typeof vi.fn> }>();

  const makeStore = (indexes: readonly string[] = []) => {
    const createIndex = vi.fn();
    const getAllRequest = {
      onsuccess: null,
      onerror: null,
      result: [],
      error: null,
    } as unknown as IDBRequest<unknown[]>;
    const value = {
      indexNames: names(indexes),
      createIndex,
      getAll: () => {
        queueMicrotask(() => {
          getAllRequest.onsuccess?.call(getAllRequest, new Event("success"));
          queueMicrotask(() => readTransaction.oncomplete?.call(readTransaction, new Event("complete")));
        });
        return getAllRequest;
      },
    } as unknown as IDBObjectStore;
    return { value, createIndex };
  };

  for (const storeName of input.existingStores ?? []) {
    stores.set(storeName, makeStore(input.existingIndexes?.[storeName] ?? []));
  }

  const createObjectStore = vi.fn((storeName: string) => {
    const created = makeStore();
    stores.set(storeName, created);
    return created.value;
  });
  const close = vi.fn();
  readTransaction = {
    oncomplete: null,
    onabort: null,
    onerror: null,
    error: null,
    objectStore(storeName: string) {
      const store = stores.get(storeName);
      if (!store) throw new Error(`Missing store ${storeName}`);
      return store.value;
    },
  } as unknown as IDBTransaction;
  const upgradeTransaction = {
    objectStore(storeName: string) {
      const store = stores.get(storeName);
      if (!store) throw new Error(`Missing existing store ${storeName}`);
      return store.value;
    },
  } as unknown as IDBTransaction;
  const database = {
    objectStoreNames: names(input.existingStores ?? []),
    createObjectStore,
    onversionchange: null,
    close,
    transaction: () => readTransaction,
  } as unknown as IDBDatabase;
  const request = {
    onupgradeneeded: null,
    onsuccess: null,
    onblocked: null,
    onerror: null,
    result: database,
    transaction: upgradeTransaction,
    error: null,
  } as unknown as IDBOpenDBRequest;
  const open = vi.fn((name: string, version: number) => {
    expect(name).toBe(VLEZET_DATABASE_NAME);
    expect(version).toBe(VLEZET_DATABASE_VERSION);
    queueMicrotask(() => {
      request.onupgradeneeded?.call(request, new Event("upgradeneeded") as IDBVersionChangeEvent);
      request.onsuccess?.call(request, new Event("success"));
    });
    return request;
  });

  return {
    factory: { open } as unknown as IDBFactory,
    stores,
    createObjectStore,
  };
}

describe("IndexedDbProjectRepository schema upgrade", () => {
  it("creates the complete v3 schema and indexes for an empty database", async () => {
    const fixture = factoryForUpgrade({});
    const repository = createIndexedDbProjectRepository(fixture.factory);

    await expect(repository.list()).resolves.toEqual([]);

    expect(fixture.createObjectStore.mock.calls.map(([name]) => name)).toEqual([
      PROJECTS_STORE,
      SETTINGS_STORE,
      ASSETS_STORE,
      RECOGNITION_SESSIONS_STORE,
    ]);
    expect(fixture.stores.get(PROJECTS_STORE)?.createIndex).toHaveBeenCalledWith(
      UPDATED_AT_INDEX,
      "updatedAt",
      { unique: false },
    );
    expect(fixture.stores.get(ASSETS_STORE)?.createIndex).toHaveBeenCalledWith(
      PROJECT_ID_INDEX,
      "projectId",
      { unique: false },
    );
    expect(fixture.stores.get(RECOGNITION_SESSIONS_STORE)?.createIndex).toHaveBeenCalledWith(
      PROJECT_ID_INDEX,
      "projectId",
      { unique: true },
    );
  });

  it("reuses existing stores and creates only missing indexes", async () => {
    const fixture = factoryForUpgrade({
      existingStores: [PROJECTS_STORE, SETTINGS_STORE, ASSETS_STORE, RECOGNITION_SESSIONS_STORE],
      existingIndexes: {
        [PROJECTS_STORE]: [],
        [ASSETS_STORE]: [],
        [RECOGNITION_SESSIONS_STORE]: [],
      },
    });
    const repository = createIndexedDbProjectRepository(fixture.factory);

    await expect(repository.list()).resolves.toEqual([]);

    expect(fixture.createObjectStore).not.toHaveBeenCalled();
    expect(fixture.stores.get(PROJECTS_STORE)?.createIndex).toHaveBeenCalledTimes(1);
    expect(fixture.stores.get(ASSETS_STORE)?.createIndex).toHaveBeenCalledTimes(1);
    expect(fixture.stores.get(RECOGNITION_SESSIONS_STORE)?.createIndex).toHaveBeenCalledTimes(1);
  });

  it("does not recreate indexes that already exist", async () => {
    const fixture = factoryForUpgrade({
      existingStores: [PROJECTS_STORE, SETTINGS_STORE, ASSETS_STORE, RECOGNITION_SESSIONS_STORE],
      existingIndexes: {
        [PROJECTS_STORE]: [UPDATED_AT_INDEX],
        [ASSETS_STORE]: [PROJECT_ID_INDEX],
        [RECOGNITION_SESSIONS_STORE]: [PROJECT_ID_INDEX],
      },
    });
    const repository = createIndexedDbProjectRepository(fixture.factory);

    await expect(repository.list()).resolves.toEqual([]);

    expect(fixture.createObjectStore).not.toHaveBeenCalled();
    expect(fixture.stores.get(PROJECTS_STORE)?.createIndex).not.toHaveBeenCalled();
    expect(fixture.stores.get(ASSETS_STORE)?.createIndex).not.toHaveBeenCalled();
    expect(fixture.stores.get(RECOGNITION_SESSIONS_STORE)?.createIndex).not.toHaveBeenCalled();
  });
});

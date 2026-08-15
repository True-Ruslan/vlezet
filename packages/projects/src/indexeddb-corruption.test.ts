import { describe, expect, it } from "vitest";
import { createIndexedDbProjectRepository } from "./indexeddb";

function dispatch(target: object, handler: unknown, type: string): void {
  (handler as ((this: object, event: Event) => unknown) | null)?.call(target, new Event(type));
}

function corruptedProject(): unknown {
  return {
    storageVersion: 2,
    id: "corrupt-project",
    name: 42,
    createdAt: "2026-08-15T00:00:00.000Z",
    updatedAt: "2026-08-15T00:00:00.000Z",
    document: {
      schemaVersion: 3,
      vertices: [],
      walls: [],
      openings: [],
      roomAnnotations: [],
      placedObjects: [],
    },
    viewport: { offsetX: 140, offsetY: 140, pixelsPerMillimeter: 0.12 },
    ui: { furnitureCatalogOpen: true, referencePanelOpen: false },
    referencePlan: null,
  };
}

function repositoryReading(value: unknown) {
  const resultRequest = {
    onsuccess: null,
    onerror: null,
    result: undefined,
    error: null,
  } as unknown as IDBRequest<unknown[]>;

  const transaction = {
    oncomplete: null,
    onabort: null,
    onerror: null,
    error: null,
    objectStore() {
      return {
        getAll() {
          queueMicrotask(() => {
            Object.defineProperty(resultRequest, "result", { configurable: true, value: [value] });
            dispatch(resultRequest, resultRequest.onsuccess, "success");
            queueMicrotask(() => dispatch(transaction, transaction.oncomplete, "complete"));
          });
          return resultRequest;
        },
      } as unknown as IDBObjectStore;
    },
  } as unknown as IDBTransaction;

  const database = {
    onversionchange: null,
    close() {},
    transaction() {
      return transaction;
    },
  } as unknown as IDBDatabase;

  const openRequest = {
    onsuccess: null,
    onerror: null,
    onblocked: null,
    onupgradeneeded: null,
    result: database,
    error: null,
  } as unknown as IDBOpenDBRequest;

  const factory = {
    open() {
      queueMicrotask(() => dispatch(openRequest, openRequest.onsuccess, "success"));
      return openRequest;
    },
  } as unknown as IDBFactory;

  return createIndexedDbProjectRepository(factory);
}

describe("IndexedDbProjectRepository persisted corruption boundary", () => {
  it("converts a corrupted persisted project into a stable storage error", async () => {
    const repository = repositoryReading(corruptedProject());

    await expect(repository.list()).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Локальный проект повреждён и не был открыт.",
    });
  });
});

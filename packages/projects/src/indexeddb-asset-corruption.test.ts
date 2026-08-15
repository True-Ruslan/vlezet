import { describe, expect, it } from "vitest";
import { createIndexedDbProjectRepository } from "./indexeddb";

function dispatch(target: object, handler: unknown, type: string): void {
  (handler as ((this: object, event: Event) => unknown) | null)?.call(target, new Event(type));
}

function corruptedAsset(): unknown {
  const blob = new Blob(["asset"], { type: "image/png" });
  return {
    id: "corrupt-asset",
    projectId: "project-a",
    kind: "reference-raster",
    mimeType: "image/png",
    byteLength: blob.size + 1,
    createdAt: "2026-08-15T00:00:00.000Z",
    blob,
  };
}

function repositoryReadingAsset(value: unknown) {
  const resultRequest = {
    onsuccess: null,
    onerror: null,
    result: undefined,
    error: null,
  } as unknown as IDBRequest<unknown>;

  const transaction = {
    oncomplete: null,
    onabort: null,
    onerror: null,
    error: null,
    objectStore() {
      return {
        get() {
          queueMicrotask(() => {
            Object.defineProperty(resultRequest, "result", { configurable: true, value });
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

describe("IndexedDbProjectRepository persisted asset corruption boundary", () => {
  it("converts a corrupted persisted asset into a stable storage error", async () => {
    const repository = repositoryReadingAsset(corruptedAsset());

    await expect(repository.getAsset("corrupt-asset")).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Подложка проекта повреждена и не была открыта.",
    });
  });
});

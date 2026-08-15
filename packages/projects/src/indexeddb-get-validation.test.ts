import { describe, expect, it } from "vitest";
import { createProject } from "./index";
import { createIndexedDbProjectRepository } from "./indexeddb";

function dispatch(target: object, handler: unknown, type: string): void {
  (handler as ((this: object, event: Event) => unknown) | null)?.call(target, new Event(type));
}

function repositoryReadingProject(value: unknown) {
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

describe("IndexedDbProjectRepository persisted project get boundary", () => {
  it("returns a valid persisted project through get", async () => {
    const project = createProject({
      id: "project-get",
      name: "Persisted project",
      now: "2026-08-15T00:00:00.000Z",
    });
    const repository = repositoryReadingProject(project);

    await expect(repository.get(project.id)).resolves.toEqual(project);
  });
});

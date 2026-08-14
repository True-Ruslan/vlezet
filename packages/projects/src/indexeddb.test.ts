import { afterEach, describe, expect, it, vi } from "vitest";
import { PROJECTS_STORE } from "./indexeddb-schema";
import {
  ProjectStorageError,
  createIndexedDbProjectRepository,
} from "./indexeddb";
import {
  controlledOpen,
  controlledRequest,
  controlledTransaction,
  databaseWithTransaction,
} from "./indexeddb.test-support";

afterEach(() => vi.unstubAllGlobals());

describe("IndexedDbProjectRepository open lifecycle", () => {
  it("fails explicitly when IndexedDB is unavailable", () => {
    vi.stubGlobal("indexedDB", undefined);
    expect(() => createIndexedDbProjectRepository()).toThrow(
      "Этот браузер не поддерживает локальное хранилище проектов.",
    );
  });

  it("wraps a synchronous factory.open exception", async () => {
    const cause = new Error("open exploded");
    const factory = {
      open() {
        throw cause;
      },
    } as unknown as IDBFactory;
    const repository = createIndexedDbProjectRepository(factory);

    await expect(repository.list()).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось открыть локальное хранилище проектов.",
      cause,
    } satisfies Partial<ProjectStorageError>);
  });

  it("rejects an asynchronous open request error", async () => {
    const open = controlledOpen();
    const repository = createIndexedDbProjectRepository(open.factory);
    const pending = repository.list();

    open.fail(new DOMException("open failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось открыть локальное хранилище проектов.",
    });
  });

  it("rejects a blocked database upgrade with the dedicated message", async () => {
    const open = controlledOpen();
    const repository = createIndexedDbProjectRepository(open.factory);
    const pending = repository.list();

    open.block();

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Закройте другие вкладки Vlezet и попробуйте снова.",
    });
  });

  it("opens successfully, lists through the repository and closes on versionchange", async () => {
    const getAll = controlledRequest<unknown[]>();
    const store = {
      getAll: () => getAll.request,
    } as unknown as IDBObjectStore;
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, store]]));
    const close = vi.fn();
    const database = databaseWithTransaction(() => transaction.transaction, close);
    const open = controlledOpen();
    const repository = createIndexedDbProjectRepository(open.factory);
    const pending = repository.list();

    open.succeed(database);
    await Promise.resolve();
    getAll.succeed([]);
    await Promise.resolve();
    transaction.complete();

    await expect(pending).resolves.toEqual([]);
    expect(database.onversionchange).toBeTypeOf("function");
    database.onversionchange?.call(database, new Event("versionchange"));
    expect(close).toHaveBeenCalledTimes(1);
  });
});

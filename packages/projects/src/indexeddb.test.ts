import { afterEach, describe, expect, it, vi } from "vitest";
import { createProject, createProjectAsset } from "./index";
import {
  ASSETS_STORE,
  LAST_PROJECT_KEY,
  PROJECTS_STORE,
  PROJECT_ID_INDEX,
  SETTINGS_STORE,
} from "./indexeddb-schema";
import {
  ProjectStorageError,
  createIndexedDbProjectRepository,
} from "./indexeddb";

type EventHandler = ((...args: never[]) => unknown) | null;

type RequestController<T> = Readonly<{
  request: IDBRequest<T>;
  succeed(value: T): void;
  fail(error: DOMException): void;
}>;

type TransactionController = Readonly<{
  transaction: IDBTransaction;
  complete(): void;
  abort(error: DOMException): void;
  fail(error: DOMException): void;
}>;

type OpenController = Readonly<{
  factory: IDBFactory;
  succeed(database: IDBDatabase): void;
  fail(error: DOMException): void;
  block(): void;
}>;

function dispatch(target: object, handler: EventHandler): void {
  const callable = handler as ((this: object, event: Event) => unknown) | null;
  callable?.call(target, new Event("test"));
}

function controlledRequest<T>(): RequestController<T> {
  let result: T;
  let error: DOMException | null = null;
  const request = {
    onsuccess: null,
    onerror: null,
    get result() {
      return result;
    },
    get error() {
      return error;
    },
  } as unknown as IDBRequest<T>;

  return {
    request,
    succeed(value) {
      result = value;
      dispatch(request, request.onsuccess);
    },
    fail(nextError) {
      error = nextError;
      dispatch(request, request.onerror);
    },
  };
}

function controlledTransaction(stores: ReadonlyMap<string, IDBObjectStore>): TransactionController {
  let error: DOMException | null = null;
  const transaction = {
    oncomplete: null,
    onabort: null,
    onerror: null,
    get error() {
      return error;
    },
    objectStore(name: string) {
      const value = stores.get(name);
      if (!value) throw new DOMException(`Unknown object store: ${name}`, "NotFoundError");
      return value;
    },
  } as unknown as IDBTransaction;

  return {
    transaction,
    complete() {
      dispatch(transaction, transaction.oncomplete);
    },
    abort(nextError) {
      error = nextError;
      dispatch(transaction, transaction.onabort);
    },
    fail(nextError) {
      error = nextError;
      dispatch(transaction, transaction.onerror);
    },
  };
}

function controlledOpen(): OpenController {
  let result: IDBDatabase;
  let error: DOMException | null = null;
  const request = {
    onsuccess: null,
    onerror: null,
    onblocked: null,
    onupgradeneeded: null,
    get result() {
      return result;
    },
    get error() {
      return error;
    },
  } as unknown as IDBOpenDBRequest;
  const factory = {
    open() {
      return request;
    },
  } as unknown as IDBFactory;

  return {
    factory,
    succeed(database) {
      result = database;
      dispatch(request, request.onsuccess);
    },
    fail(nextError) {
      error = nextError;
      dispatch(request, request.onerror);
    },
    block() {
      dispatch(request, request.onblocked);
    },
  };
}

function databaseWithTransaction(
  transactionFactory: (storeNames: string | string[], mode?: IDBTransactionMode) => IDBTransaction,
  close: () => void,
): IDBDatabase {
  return {
    transaction: transactionFactory,
    onversionchange: null,
    close,
  } as unknown as IDBDatabase;
}

const NOW = "2026-08-15T00:00:00.000Z";

afterEach(() => vi.unstubAllGlobals());

async function drainMicrotasks(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function project(id: string, updatedAt = NOW) {
  return createProject({ id, name: id, now: updatedAt });
}

function asset(id: string, projectId: string) {
  return createProjectAsset({
    id,
    projectId,
    mimeType: "image/png",
    createdAt: NOW,
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  });
}

function repositoryFor(transaction: IDBTransaction) {
  const open = controlledOpen();
  const database = databaseWithTransaction(() => transaction, vi.fn());
  const repository = createIndexedDbProjectRepository(open.factory);
  open.succeed(database);
  return { database, repository };
}

function store(methods: Partial<IDBObjectStore>): IDBObjectStore {
  return methods as IDBObjectStore;
}

function index(methods: Partial<IDBIndex>): IDBIndex {
  return methods as IDBIndex;
}

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

  it("opens successfully and closes the connection on versionchange", async () => {
    const getAll = controlledRequest<unknown[]>();
    const projects = store({ getAll: () => getAll.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const close = vi.fn();
    const database = databaseWithTransaction(() => transaction.transaction, close);
    const open = controlledOpen();
    const repository = createIndexedDbProjectRepository(open.factory);
    const pending = repository.list();

    open.succeed(database);
    await drainMicrotasks();
    getAll.succeed([]);
    await drainMicrotasks();
    transaction.complete();

    await expect(pending).resolves.toEqual([]);
    expect(database.onversionchange).toBeTypeOf("function");
    database.onversionchange?.call(database, new Event("versionchange") as IDBVersionChangeEvent);
    expect(close).toHaveBeenCalledTimes(1);
  });
});

describe("IndexedDbProjectRepository request and transaction failures", () => {
  it("surfaces a project request error", async () => {
    const get = controlledRequest<unknown>();
    const projects = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.get("project-a");

    await drainMicrotasks();
    get.fail(new DOMException("read failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось прочитать локальные проекты.",
    });
  });

  it("surfaces the dedicated asset request error", async () => {
    const get = controlledRequest<unknown>();
    const assets = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.getAsset("asset-a");

    await drainMicrotasks();
    get.fail(new DOMException("asset read failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось прочитать подложку.",
    });
  });

  it("surfaces the dedicated asset-index request error", async () => {
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const projectIndex = index({ getAllKeys: () => getAllKeys.request });
    const assets = store({ index: () => projectIndex, delete: vi.fn() });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.deleteAssetsForProject("project-a");

    await drainMicrotasks();
    getAllKeys.fail(new DOMException("asset index failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось прочитать подложки проекта.",
    });
  });

  it("resolves a write only after transaction completion", async () => {
    const put = vi.fn();
    const projects = store({ put });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const value = project("project-a");
    const pending = repository.put(value);

    await drainMicrotasks();
    expect(put).toHaveBeenCalledWith(value);
    transaction.complete();
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects a write on transaction abort", async () => {
    const projects = store({ put: vi.fn() });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.put(project("project-a"));

    await drainMicrotasks();
    transaction.abort(new DOMException("aborted", "AbortError"));
    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось сохранить изменения проекта.",
    });
  });

  it("rejects a write on transaction error", async () => {
    const projects = store({ put: vi.fn() });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.put(project("project-a"));

    await drainMicrotasks();
    transaction.fail(new DOMException("failed", "UnknownError"));
    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось сохранить изменения проекта.",
    });
  });
});

describe("IndexedDbProjectRepository public semantics", () => {
  it("returns null for a missing project", async () => {
    const get = controlledRequest<unknown>();
    const projects = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.get("missing");

    await drainMicrotasks();
    get.succeed(undefined);
    await drainMicrotasks();
    transaction.complete();
    await expect(pending).resolves.toBeNull();
  });

  it("lists newest first and uses id as a deterministic tie-break", async () => {
    const getAll = controlledRequest<unknown[]>();
    const projects = store({ getAll: () => getAll.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.list();

    await drainMicrotasks();
    getAll.succeed([
      project("b", "2026-08-15T10:00:00.000Z"),
      project("c", "2026-08-15T11:00:00.000Z"),
      project("a", "2026-08-15T10:00:00.000Z"),
    ]);
    await drainMicrotasks();
    transaction.complete();

    const values = await pending;
    expect(values.map((value) => value.id)).toEqual(["c", "a", "b"]);
  });

  it("returns null when the last-project setting is absent", async () => {
    const get = controlledRequest<unknown>();
    const settings = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[SETTINGS_STORE, settings]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.getLastProjectId();

    await drainMicrotasks();
    get.succeed(undefined);
    await drainMicrotasks();
    transaction.complete();
    await expect(pending).resolves.toBeNull();
  });

  it("writes and clears the last-project setting exactly", async () => {
    for (const value of ["project-a", null] as const) {
      const put = vi.fn();
      const settings = store({ put });
      const transaction = controlledTransaction(new Map([[SETTINGS_STORE, settings]]));
      const { repository } = repositoryFor(transaction.transaction);
      const pending = repository.setLastProjectId(value);

      await drainMicrotasks();
      expect(put).toHaveBeenCalledWith({ key: LAST_PROJECT_KEY, value });
      transaction.complete();
      await expect(pending).resolves.toBeUndefined();
    }
  });

  it("deletes project assets and clears a matching last-project reference", async () => {
    const projectDelete = vi.fn();
    const projects = store({ delete: projectDelete });
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const assetDelete = vi.fn();
    const projectIndex = index({ getAllKeys: () => getAllKeys.request });
    const assets = store({ index: () => projectIndex, delete: assetDelete });
    const getSetting = controlledRequest<unknown>();
    const settingPut = vi.fn();
    const settings = store({ get: () => getSetting.request, put: settingPut });
    const transaction = controlledTransaction(new Map([
      [PROJECTS_STORE, projects],
      [SETTINGS_STORE, settings],
      [ASSETS_STORE, assets],
    ]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.delete("project-a");

    await drainMicrotasks();
    expect(projectDelete).toHaveBeenCalledWith("project-a");
    getAllKeys.succeed(["asset-a1", "asset-a2"]);
    await drainMicrotasks();
    expect(assetDelete.mock.calls.map(([id]) => id)).toEqual(["asset-a1", "asset-a2"]);
    getSetting.succeed({ key: LAST_PROJECT_KEY, value: "project-a" });
    await drainMicrotasks();
    expect(settingPut).toHaveBeenCalledWith({ key: LAST_PROJECT_KEY, value: null });
    transaction.complete();
    await expect(pending).resolves.toBeUndefined();
  });

  it("preserves an unrelated last-project reference when deleting another project", async () => {
    const projects = store({ delete: vi.fn() });
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const projectIndex = index({ getAllKeys: () => getAllKeys.request });
    const assets = store({ index: () => projectIndex, delete: vi.fn() });
    const getSetting = controlledRequest<unknown>();
    const settingPut = vi.fn();
    const settings = store({ get: () => getSetting.request, put: settingPut });
    const transaction = controlledTransaction(new Map([
      [PROJECTS_STORE, projects],
      [SETTINGS_STORE, settings],
      [ASSETS_STORE, assets],
    ]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.delete("project-a");

    await drainMicrotasks();
    getAllKeys.succeed([]);
    await drainMicrotasks();
    getSetting.succeed({ key: LAST_PROJECT_KEY, value: "project-b" });
    await drainMicrotasks();
    transaction.complete();

    await expect(pending).resolves.toBeUndefined();
    expect(settingPut).not.toHaveBeenCalled();
  });

  it("gets, writes and deletes assets through the public repository", async () => {
    const expected = asset("asset-a", "project-a");

    const get = controlledRequest<unknown>();
    const readAssets = store({ get: () => get.request });
    const readTransaction = controlledTransaction(new Map([[ASSETS_STORE, readAssets]]));
    const { repository: readRepository } = repositoryFor(readTransaction.transaction);
    const readPending = readRepository.getAsset("asset-a");
    await drainMicrotasks();
    get.succeed(expected);
    await drainMicrotasks();
    readTransaction.complete();
    await expect(readPending).resolves.toEqual(expected);

    const missingGet = controlledRequest<unknown>();
    const missingAssets = store({ get: () => missingGet.request });
    const missingTransaction = controlledTransaction(new Map([[ASSETS_STORE, missingAssets]]));
    const { repository: missingRepository } = repositoryFor(missingTransaction.transaction);
    const missingPending = missingRepository.getAsset("missing");
    await drainMicrotasks();
    missingGet.succeed(undefined);
    await drainMicrotasks();
    missingTransaction.complete();
    await expect(missingPending).resolves.toBeNull();

    const put = vi.fn();
    const writeAssets = store({ put });
    const writeTransaction = controlledTransaction(new Map([[ASSETS_STORE, writeAssets]]));
    const { repository: writeRepository } = repositoryFor(writeTransaction.transaction);
    const writePending = writeRepository.putAsset(expected);
    await drainMicrotasks();
    expect(put).toHaveBeenCalledWith(expected);
    writeTransaction.complete();
    await expect(writePending).resolves.toBeUndefined();

    const remove = vi.fn();
    const deleteAssets = store({ delete: remove });
    const deleteTransaction = controlledTransaction(new Map([[ASSETS_STORE, deleteAssets]]));
    const { repository: deleteRepository } = repositoryFor(deleteTransaction.transaction);
    const deletePending = deleteRepository.deleteAsset("asset-a");
    await drainMicrotasks();
    expect(remove).toHaveBeenCalledWith("asset-a");
    deleteTransaction.complete();
    await expect(deletePending).resolves.toBeUndefined();
  });

  it("deletes only asset keys returned by the project index", async () => {
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const projectIndex = index({ getAllKeys: () => getAllKeys.request });
    const remove = vi.fn();
    const assets = store({ index: () => projectIndex, delete: remove });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.deleteAssetsForProject("project-a");

    await drainMicrotasks();
    getAllKeys.succeed(["asset-a1", "asset-a2"]);
    await drainMicrotasks();
    transaction.complete();

    await expect(pending).resolves.toBeUndefined();
    expect(remove.mock.calls.map(([id]) => id)).toEqual(["asset-a1", "asset-a2"]);
  });
});

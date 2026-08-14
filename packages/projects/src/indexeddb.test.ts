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
import {
  controlledOpen,
  controlledRequest,
  controlledTransaction,
  databaseWithTransaction,
} from "./indexeddb.test-support";

const NOW = "2026-08-15T00:00:00.000Z";

afterEach(() => vi.unstubAllGlobals());

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

  it("opens successfully, lists through the repository and closes on versionchange", async () => {
    const getAll = controlledRequest<unknown[]>();
    const projects = store({ getAll: () => getAll.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
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

describe("IndexedDbProjectRepository request and transaction failures", () => {
  it("surfaces the generic project read error", async () => {
    const get = controlledRequest<unknown>();
    const projects = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.get("project-a");

    await Promise.resolve();
    get.fail(new DOMException("read failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось прочитать локальные проекты.",
    });
  });

  it("surfaces the dedicated asset read error", async () => {
    const get = controlledRequest<unknown>();
    const assets = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.getAsset("asset-a");

    await Promise.resolve();
    get.fail(new DOMException("asset read failed", "UnknownError"));

    await expect(pending).rejects.toMatchObject({
      name: "ProjectStorageError",
      message: "Не удалось прочитать подложку.",
    });
  });

  it("surfaces the dedicated asset-index read error", async () => {
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const projectIndex = index({ getAllKeys: () => getAllKeys.request });
    const assets = store({
      index: () => projectIndex,
      delete: vi.fn(),
    });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.deleteAssetsForProject("project-a");

    await Promise.resolve();
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

    await Promise.resolve();
    expect(put).toHaveBeenCalledWith(value);
    transaction.complete();
    await expect(pending).resolves.toBeUndefined();
  });

  it("rejects a write on transaction abort", async () => {
    const projects = store({ put: vi.fn() });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.put(project("project-a"));

    await Promise.resolve();
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

    await Promise.resolve();
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

    await Promise.resolve();
    get.succeed(undefined);
    await Promise.resolve();
    transaction.complete();

    await expect(pending).resolves.toBeNull();
  });

  it("lists newest first and uses id as the deterministic tie-break", async () => {
    const getAll = controlledRequest<unknown[]>();
    const projects = store({ getAll: () => getAll.request });
    const transaction = controlledTransaction(new Map([[PROJECTS_STORE, projects]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.list();

    await Promise.resolve();
    getAll.succeed([
      project("b", "2026-08-15T10:00:00.000Z"),
      project("c", "2026-08-15T11:00:00.000Z"),
      project("a", "2026-08-15T10:00:00.000Z"),
    ]);
    await Promise.resolve();
    transaction.complete();

    await expect(pending).resolves.toSatisfy((values: readonly { id: string }[]) =>
      values.map((value) => value.id).join(",") === "c,a,b",
    );
  });

  it("returns null when the last-project setting is absent", async () => {
    const get = controlledRequest<unknown>();
    const settings = store({ get: () => get.request });
    const transaction = controlledTransaction(new Map([[SETTINGS_STORE, settings]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.getLastProjectId();

    await Promise.resolve();
    get.succeed(undefined);
    await Promise.resolve();
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

      await Promise.resolve();
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
    const projectIndex = index({ getAllKeys: vi.fn(() => getAllKeys.request) });
    const assets = store({
      index: vi.fn((name: string) => {
        expect(name).toBe(PROJECT_ID_INDEX);
        return projectIndex;
      }),
      delete: assetDelete,
    });
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

    await Promise.resolve();
    expect(projectDelete).toHaveBeenCalledWith("project-a");
    getAllKeys.succeed(["asset-a1", "asset-a2"]);
    await Promise.resolve();
    expect(assetDelete.mock.calls.map(([id]) => id)).toEqual(["asset-a1", "asset-a2"]);
    getSetting.succeed({ key: LAST_PROJECT_KEY, value: "project-a" });
    await Promise.resolve();
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

    await Promise.resolve();
    getAllKeys.succeed([]);
    await Promise.resolve();
    getSetting.succeed({ key: LAST_PROJECT_KEY, value: "project-b" });
    await Promise.resolve();
    transaction.complete();

    await expect(pending).resolves.toBeUndefined();
    expect(settingPut).not.toHaveBeenCalled();
  });

  it("gets, writes and deletes assets through the public repository", async () => {
    const expected = asset("asset-a", "project-a");

    {
      const get = controlledRequest<unknown>();
      const assets = store({ get: () => get.request });
      const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
      const { repository } = repositoryFor(transaction.transaction);
      const pending = repository.getAsset("asset-a");
      await Promise.resolve();
      get.succeed(expected);
      await Promise.resolve();
      transaction.complete();
      await expect(pending).resolves.toEqual(expected);
    }

    {
      const get = controlledRequest<unknown>();
      const assets = store({ get: () => get.request });
      const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
      const { repository } = repositoryFor(transaction.transaction);
      const pending = repository.getAsset("missing");
      await Promise.resolve();
      get.succeed(undefined);
      await Promise.resolve();
      transaction.complete();
      await expect(pending).resolves.toBeNull();
    }

    {
      const put = vi.fn();
      const assets = store({ put });
      const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
      const { repository } = repositoryFor(transaction.transaction);
      const pending = repository.putAsset(expected);
      await Promise.resolve();
      expect(put).toHaveBeenCalledWith(expected);
      transaction.complete();
      await expect(pending).resolves.toBeUndefined();
    }

    {
      const remove = vi.fn();
      const assets = store({ delete: remove });
      const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
      const { repository } = repositoryFor(transaction.transaction);
      const pending = repository.deleteAsset("asset-a");
      await Promise.resolve();
      expect(remove).toHaveBeenCalledWith("asset-a");
      transaction.complete();
      await expect(pending).resolves.toBeUndefined();
    }
  });

  it("deletes only the asset keys returned by the project index", async () => {
    const getAllKeys = controlledRequest<IDBValidKey[]>();
    const projectIndex = index({ getAllKeys: vi.fn(() => getAllKeys.request) });
    const remove = vi.fn();
    const assets = store({ index: () => projectIndex, delete: remove });
    const transaction = controlledTransaction(new Map([[ASSETS_STORE, assets]]));
    const { repository } = repositoryFor(transaction.transaction);
    const pending = repository.deleteAssetsForProject("project-a");

    await Promise.resolve();
    getAllKeys.succeed(["asset-a1", "asset-a2"]);
    await Promise.resolve();
    transaction.complete();

    await expect(pending).resolves.toBeUndefined();
    expect(remove.mock.calls.map(([id]) => id)).toEqual(["asset-a1", "asset-a2"]);
  });
});

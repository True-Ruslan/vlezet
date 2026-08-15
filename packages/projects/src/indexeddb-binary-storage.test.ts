import { describe, expect, it } from "vitest";
import { createProjectAsset } from "./assets";
import { createIndexedDbProjectRepository, ProjectStorageError } from "./indexeddb";

function dispatch(target: object, handler: unknown, type: string): void {
  (handler as ((this: object, event: Event) => unknown) | null)?.call(target, new Event(type));
}

function repositoryWithAssetStore(input: Readonly<{
  readValue?: unknown;
  onPut?: (value: unknown) => void;
}>) {
  const request = {
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
            Object.defineProperty(request, "result", { configurable: true, value: input.readValue });
            dispatch(request, request.onsuccess, "success");
            queueMicrotask(() => dispatch(transaction, transaction.oncomplete, "complete"));
          });
          return request;
        },
        put(value: unknown) {
          input.onPut?.(value);
          queueMicrotask(() => dispatch(transaction, transaction.oncomplete, "complete"));
          return {} as IDBRequest<IDBValidKey>;
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

const CREATED_AT = "2026-08-15T00:00:00.000Z";

function asset() {
  return createProjectAsset({
    id: "asset-1",
    projectId: "project-1",
    mimeType: "image/png",
    createdAt: CREATED_AT,
    blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
  });
}

async function expectCorruptedAsset(readValue: unknown) {
  const repository = repositoryWithAssetStore({ readValue });
  await expect(repository.getAsset("asset-1")).rejects.toMatchObject({
    name: "ProjectStorageError",
    message: "Подложка проекта повреждена и не была открыта.",
  } satisfies Partial<ProjectStorageError>);
}

describe("IndexedDbProjectRepository binary asset persistence", () => {
  it("serializes Blob payloads to ArrayBuffer before writing IndexedDB", async () => {
    const capture: { persisted?: Record<string, unknown> } = {};
    const repository = repositoryWithAssetStore({
      onPut: (value) => {
        capture.persisted = value as Record<string, unknown>;
      },
    });

    await repository.putAsset(asset());

    const persisted = capture.persisted;
    expect(persisted).toBeDefined();
    if (!persisted) throw new Error("IndexedDB asset write was not captured.");
    expect(persisted).not.toHaveProperty("blob");
    expect(persisted.blobBytes).toBeInstanceOf(ArrayBuffer);
    expect(Array.from(new Uint8Array(persisted.blobBytes as ArrayBuffer))).toEqual([1, 2, 3, 4]);
    expect(persisted).toMatchObject({
      id: "asset-1",
      projectId: "project-1",
      kind: "reference-raster",
      mimeType: "image/png",
      byteLength: 4,
      createdAt: CREATED_AT,
    });
  });

  it("hydrates ArrayBuffer-backed persisted assets into the public Blob contract", async () => {
    const repository = repositoryWithAssetStore({
      readValue: {
        id: "asset-1",
        projectId: "project-1",
        kind: "reference-raster",
        mimeType: "image/png",
        byteLength: 4,
        createdAt: CREATED_AT,
        blobBytes: new Uint8Array([1, 2, 3, 4]).buffer,
      },
    });

    const loaded = await repository.getAsset("asset-1");

    expect(loaded).not.toBeNull();
    expect(loaded?.blob).toBeInstanceOf(Blob);
    expect(loaded?.blob.type).toBe("image/png");
    expect(loaded?.blob.size).toBe(4);
    expect(Array.from(new Uint8Array(await loaded!.blob.arrayBuffer()))).toEqual([1, 2, 3, 4]);
  });

  it("keeps backward compatibility with legacy Blob-backed IndexedDB records", async () => {
    const legacy = asset();
    const repository = repositoryWithAssetStore({ readValue: legacy });

    await expect(repository.getAsset(legacy.id)).resolves.toEqual(legacy);
  });

  it("fails closed for malformed scalar and array records", async () => {
    await expectCorruptedAsset("not-an-asset");
    await expectCorruptedAsset([]);
  });

  it("fails closed when ArrayBuffer-backed records have a non-string MIME type", async () => {
    await expectCorruptedAsset({
      id: "asset-1",
      projectId: "project-1",
      kind: "reference-raster",
      mimeType: null,
      byteLength: 4,
      createdAt: CREATED_AT,
      blobBytes: new Uint8Array([1, 2, 3, 4]).buffer,
    });
  });

  it("fails closed when persisted ArrayBuffer metadata does not match the payload", async () => {
    await expectCorruptedAsset({
      id: "asset-1",
      projectId: "project-1",
      kind: "reference-raster",
      mimeType: "image/png",
      byteLength: 99,
      createdAt: CREATED_AT,
      blobBytes: new Uint8Array([1, 2, 3, 4]).buffer,
    });
  });
});

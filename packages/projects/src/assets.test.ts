import { describe, expect, it } from "vitest";
import {
  MemoryProjectAssetRepository,
  createProjectAsset,
  replaceReferenceAssetTransaction,
} from "./index";

const NOW = "2026-07-21T20:00:00.000Z";

function asset(id: string, projectId = "project-1") {
  return createProjectAsset({
    id,
    projectId,
    createdAt: NOW,
    mimeType: "image/png",
    blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  });
}

describe("project assets", () => {
  it("stores, reads and deletes project-scoped reference assets", async () => {
    const repository = new MemoryProjectAssetRepository();
    await repository.putAsset(asset("asset-1"));
    await repository.putAsset(asset("asset-2", "project-2"));
    expect((await repository.getAsset("asset-1"))?.byteLength).toBe(3);
    await repository.deleteAssetsForProject("project-1");
    expect(await repository.getAsset("asset-1")).toBeNull();
    expect(await repository.getAsset("asset-2")).not.toBeNull();
  });

  it("rejects invalid MIME and byte length metadata", () => {
    expect(() => createProjectAsset({
      id: "asset",
      projectId: "project",
      createdAt: NOW,
      mimeType: "image/svg+xml" as "image/png",
      blob: new Blob(["<svg/>"] , { type: "image/svg+xml" }),
    })).toThrow();
  });

  it("replaces an asset in safe order and removes the previous asset last", async () => {
    const repository = new MemoryProjectAssetRepository();
    await repository.putAsset(asset("old"));
    const events: string[] = [];
    await replaceReferenceAssetTransaction({
      repository,
      oldAssetId: "old",
      newAsset: asset("new"),
      persistMetadata: async () => { events.push("metadata"); },
      onEvent: (event) => events.push(event),
    });
    expect(events).toEqual(["new-asset-written", "metadata", "metadata-written", "old-asset-deleted"]);
    expect(await repository.getAsset("old")).toBeNull();
    expect(await repository.getAsset("new")).not.toBeNull();
  });

  it("rolls back the new asset when metadata persistence fails", async () => {
    const repository = new MemoryProjectAssetRepository();
    await repository.putAsset(asset("old"));
    await expect(replaceReferenceAssetTransaction({
      repository,
      oldAssetId: "old",
      newAsset: asset("new"),
      persistMetadata: async () => { throw new Error("write failed"); },
    })).rejects.toThrow("write failed");
    expect(await repository.getAsset("old")).not.toBeNull();
    expect(await repository.getAsset("new")).toBeNull();
  });
});

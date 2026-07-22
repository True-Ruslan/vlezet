import { describe, expect, it } from "vitest";
import { MemoryRecognitionSessionRepository, isRecognitionSessionStale } from "./session";
import type { RecognitionSessionRecord } from "./model";

function sessionFixture(): RecognitionSessionRecord {
  const now = "2026-07-22T00:00:00.000Z";
  return {
    id: "session-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "1",
    draft: {
      id: "draft-1",
      projectId: "project-1",
      referenceAssetId: "asset-1",
      referenceRevision: "revision-1",
      engineVersion: "1",
      status: "local-complete",
      walls: [], openings: [], roomLabels: [], diagnostics: [], decisions: {},
      source: { local: true, cloud: false }, createdAt: now, updatedAt: now,
    },
    cloudMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("recognition session repository", () => {
  it("stores one independently validated session per project", async () => {
    const repository = new MemoryRecognitionSessionRepository();
    await repository.put(sessionFixture());
    expect(await repository.getForProject("project-1")).toEqual(sessionFixture());
    await repository.deleteForProject("project-1");
    expect(await repository.getForProject("project-1")).toBeNull();
  });

  it("marks raster or metric revision changes stale but not display changes", () => {
    const session = sessionFixture();
    expect(isRecognitionSessionStale(session, { assetId: "asset-1", referenceRevision: "revision-1" })).toBe(false);
    expect(isRecognitionSessionStale(session, { assetId: "asset-2", referenceRevision: "revision-1" })).toBe(true);
    expect(isRecognitionSessionStale(session, { assetId: "asset-1", referenceRevision: "revision-2" })).toBe(true);
  });
});

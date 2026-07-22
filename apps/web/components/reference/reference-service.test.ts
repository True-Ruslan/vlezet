import { describe, expect, it } from "vitest";
import {
  MemoryProjectAssetRepository,
  MemoryProjectRepository,
  createProject,
  type ProjectAssetRecord,
  type VlezetProjectRecord,
} from "@vlezet/projects";
import { installReferencePlan, removeReferencePlan, type ReferenceRepository } from "./reference-service";

class MemoryReferenceRepository implements ReferenceRepository {
  readonly projects = new MemoryProjectRepository();
  readonly assets = new MemoryProjectAssetRepository();
  list = () => this.projects.list();
  get = (id: string) => this.projects.get(id);
  put = (project: VlezetProjectRecord) => this.projects.put(project);
  delete = (id: string) => this.projects.delete(id);
  getLastProjectId = () => this.projects.getLastProjectId();
  setLastProjectId = (id: string | null) => this.projects.setLastProjectId(id);
  getAsset = (id: string) => this.assets.getAsset(id);
  putAsset = (asset: ProjectAssetRecord) => this.assets.putAsset(asset);
  deleteAsset = (id: string) => this.assets.deleteAsset(id);
  deleteAssetsForProject = (projectId: string) => this.assets.deleteAssetsForProject(projectId);
}

const NOW = "2026-07-21T20:00:00.000Z";
const raster = {
  blob: new Blob([new Uint8Array([1, 2, 3])], { type: "image/png" }),
  mimeType: "image/png" as const,
  widthPx: 1000,
  heightPx: 800,
};

describe("reference service", () => {
  it("installs a calibrated asset and project metadata transactionally", async () => {
    const repository = new MemoryReferenceRepository();
    const project = createProject({ id: "project", name: "Квартира", now: NOW });
    await repository.put(project);
    const installed = await installReferencePlan({
      project,
      repository,
      raster,
      source: { kind: "image", originalMimeType: "image/png" },
      pointA: { x: 100, y: 100 },
      pointB: { x: 600, y: 100 },
      knownLengthMm: 2500,
      alignment: "horizontal",
      originWorld: { x: 0, y: 0 },
      assetId: "asset",
      referenceRevision: "revision-1",
      now: NOW,
    });
    expect(installed.referencePlan?.transform.millimetersPerPixel).toBe(5);
    expect(installed.referencePlan?.referenceRevision).toBe("revision-1");
    expect((await repository.get("project"))?.referencePlan?.assetId).toBe("asset");
    expect((await repository.getAsset("asset"))?.projectId).toBe("project");
  });

  it("replaces the previous asset only after the new project metadata is valid", async () => {
    const repository = new MemoryReferenceRepository();
    const project = createProject({ id: "project", name: "Квартира", now: NOW });
    const first = await installReferencePlan({ project, repository, raster, source: { kind: "image", originalMimeType: "image/png" }, pointA: { x: 0, y: 0 }, pointB: { x: 500, y: 0 }, knownLengthMm: 1000, alignment: "horizontal", originWorld: { x: 0, y: 0 }, assetId: "old", referenceRevision: "revision-old", now: NOW });
    const second = await installReferencePlan({ project: first, repository, raster, source: { kind: "image", originalMimeType: "image/png" }, pointA: { x: 0, y: 0 }, pointB: { x: 500, y: 0 }, knownLengthMm: 1500, alignment: "horizontal", originWorld: { x: 0, y: 0 }, assetId: "new", referenceRevision: "revision-new", now: "2026-07-21T20:01:00.000Z" });
    expect(second.referencePlan?.referenceRevision).toBe("revision-new");
    expect(await repository.getAsset("old")).toBeNull();
    expect(await repository.getAsset("new")).not.toBeNull();
  });

  it("removes only the reference source and preserves apartment geometry", async () => {
    const repository = new MemoryReferenceRepository();
    const project = createProject({ id: "project", name: "Квартира", now: NOW });
    const installed = await installReferencePlan({ project, repository, raster, source: { kind: "image", originalMimeType: "image/png" }, pointA: { x: 0, y: 0 }, pointB: { x: 500, y: 0 }, knownLengthMm: 1000, alignment: "horizontal", originWorld: { x: 0, y: 0 }, assetId: "asset", referenceRevision: "revision-1", now: NOW });
    const removed = await removeReferencePlan(installed, repository, "2026-07-21T20:02:00.000Z");
    expect(removed.referencePlan).toBeNull();
    expect(removed.document).toEqual(installed.document);
    expect(await repository.getAsset("asset")).toBeNull();
  });
});

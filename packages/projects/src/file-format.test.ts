import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import {
  MAX_REFERENCE_ASSET_BYTES,
  ProjectFileError,
  createProject,
  createProjectAsset,
  parsePortableProjectFile,
  parseProjectFile,
  projectJsonFilename,
  serializePortableProjectFile,
  serializeProjectFile,
} from "./index";

const NOW = "2026-07-21T19:00:00.000Z";
const referencePlan = {
  assetId: "asset-source",
  referenceRevision: "revision-source",
  source: { kind: "image" as const, originalMimeType: "image/png" as const },
  widthPx: 800,
  heightPx: 600,
  transform: { originWorld: { x: 100, y: 200 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 500, y: 0 }, knownLengthMm: 1000, alignment: "horizontal" as const },
  display: { visible: true, opacity: 0.45, locked: true },
};

describe("Vlezet project file", () => {
  it("keeps the legacy synchronous v1 round trip", () => {
    const source = createProject({ id: "source", name: "Квартира / вариант 1", now: NOW });
    const text = serializeProjectFile(source, "2026-07-21T20:00:00.000Z");
    const imported = parseProjectFile(text, { id: "imported", now: "2026-07-21T21:00:00.000Z" });
    expect(imported.id).toBe("imported");
    expect(imported.document).toEqual(source.document);
  });

  it("imports schema-v1 backups through the portable parser", async () => {
    const text = JSON.stringify({
      format: "vlezet-project",
      fileVersion: 1,
      exportedAt: NOW,
      project: {
        name: "Старый проект",
        document: { schemaVersion: 1, walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 }] },
      },
    });
    const parsed = await parsePortableProjectFile(text, { id: "new", assetId: "asset-new", now: NOW });
    expect(parsed.project.document.schemaVersion).toBe(3);
    expect(parsed.project.referencePlan).toBeNull();
    expect(parsed.asset).toBeNull();
  });

  it("round-trips fileVersion 2 with an embedded normalized raster", async () => {
    const project = createProject({ id: "source", name: "С планом", now: NOW, referencePlan });
    const asset = createProjectAsset({
      id: "asset-source",
      projectId: project.id,
      mimeType: "image/png",
      createdAt: NOW,
      blob: new Blob([new Uint8Array([1, 2, 3, 4])], { type: "image/png" }),
    });
    const text = await serializePortableProjectFile(project, asset, "2026-07-21T20:00:00.000Z");
    const parsed = await parsePortableProjectFile(text, { id: "imported", assetId: "asset-imported", now: "2026-07-21T21:00:00.000Z" });
    expect(parsed.project.id).toBe("imported");
    expect(parsed.project.referencePlan?.assetId).toBe("asset-imported");
    expect(parsed.project.referencePlan?.referenceRevision).toBe("revision-source");
    expect(parsed.asset?.projectId).toBe("imported");
    expect([...new Uint8Array(await parsed.asset!.blob.arrayBuffer())]).toEqual([1, 2, 3, 4]);
  });

  it("rejects reference metadata without an asset and oversized decoded assets", async () => {
    const project = createProject({ id: "source", name: "С планом", now: NOW, referencePlan });
    await expect(serializePortableProjectFile(project, null)).rejects.toThrow(ProjectFileError);
    const oversized = JSON.stringify({
      format: "vlezet-project",
      fileVersion: 2,
      exportedAt: NOW,
      project: { name: "X", document: createEmptyDocument(), referencePlan: { ...referencePlan, assetId: undefined } },
      assets: [{ role: "reference-raster", mimeType: "image/png", dataBase64: "A".repeat(Math.ceil(MAX_REFERENCE_ASSET_BYTES * 4 / 3) + 8) }],
    });
    await expect(parsePortableProjectFile(oversized, { id: "x", assetId: "a", now: NOW })).rejects.toThrow(/больш/i);
  });

  it("rejects invalid JSON, format and future versions without guessing", async () => {
    await expect(parsePortableProjectFile("{", { id: "x", assetId: "a", now: NOW })).rejects.toThrow(ProjectFileError);
    await expect(parsePortableProjectFile(JSON.stringify({ format: "other", fileVersion: 2 }), { id: "x", assetId: "a", now: NOW })).rejects.toThrow(/формат/i);
    await expect(parsePortableProjectFile(JSON.stringify({ format: "vlezet-project", fileVersion: 99 }), { id: "x", assetId: "a", now: NOW })).rejects.toThrow(/верси/i);
  });

  it("creates a filesystem-safe filename", () => {
    expect(projectJsonFilename(" Квартира / Вариант №1 ")).toBe("kvartira-variant-1.vlezet.json");
    expect(projectJsonFilename("***")).toBe("vlezet-project.vlezet.json");
  });
});

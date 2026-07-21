import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import {
  ProjectFileError,
  createProject,
  parseProjectFile,
  projectJsonFilename,
  serializeProjectFile,
} from "./index";

const NOW = "2026-07-21T19:00:00.000Z";

describe("Vlezet project file", () => {
  it("round-trips a current project into a fresh local project", () => {
    const source = createProject({ id: "source", name: "Квартира / вариант 1", now: NOW });
    const text = serializeProjectFile(source, "2026-07-21T20:00:00.000Z");
    const imported = parseProjectFile(text, { id: "imported", now: "2026-07-21T21:00:00.000Z" });
    expect(imported.id).toBe("imported");
    expect(imported.name).toBe(source.name);
    expect(imported.document).toEqual(source.document);
    expect(imported.createdAt).toBe("2026-07-21T21:00:00.000Z");
  });

  it("migrates a schema v1 document", () => {
    const text = JSON.stringify({
      format: "vlezet-project",
      fileVersion: 1,
      exportedAt: NOW,
      project: {
        name: "Старый проект",
        document: {
          schemaVersion: 1,
          walls: [{ id: "wall", start: { x: 0, y: 0 }, end: { x: 3000, y: 0 }, thickness: 150 }],
        },
      },
    });
    const imported = parseProjectFile(text, { id: "new", now: NOW });
    expect(imported.document.schemaVersion).toBe(3);
    expect(imported.document.vertices).toHaveLength(2);
    expect(imported.document.placedObjects).toEqual([]);
  });

  it("rejects invalid JSON, format, version and malformed data without guessing", () => {
    expect(() => parseProjectFile("{", { id: "x", now: NOW })).toThrow(ProjectFileError);
    expect(() => parseProjectFile(JSON.stringify({ format: "other", fileVersion: 1 }), { id: "x", now: NOW })).toThrow(/формат/i);
    expect(() => parseProjectFile(JSON.stringify({ format: "vlezet-project", fileVersion: 2 }), { id: "x", now: NOW })).toThrow(/верси/i);
    expect(() => parseProjectFile(JSON.stringify({
      format: "vlezet-project",
      fileVersion: 1,
      exportedAt: NOW,
      project: { name: "X", document: { ...createEmptyDocument(), vertices: "bad" } },
    }), { id: "x", now: NOW })).toThrow(/данн/i);
  });

  it("creates a filesystem-safe filename", () => {
    expect(projectJsonFilename(" Квартира / Вариант №1 ")).toBe("kvartira-variant-1.vlezet.json");
    expect(projectJsonFilename("***")).toBe("vlezet-project.vlezet.json");
  });
});

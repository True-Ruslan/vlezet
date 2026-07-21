import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import {
  DEFAULT_PROJECT_UI,
  DEFAULT_PROJECT_VIEWPORT,
  createProject,
  duplicateProject,
  renameProject,
  replaceProjectDocument,
  replaceProjectUi,
  replaceProjectViewport,
  validateProject,
} from "./index";

const NOW = "2026-07-21T19:00:00.000Z";

describe("project model", () => {
  it("creates a normalized local project with stable defaults", () => {
    const project = createProject({ id: "project-1", name: "  Квартира  ", now: NOW });
    expect(project).toEqual({
      storageVersion: 1,
      id: "project-1",
      name: "Квартира",
      createdAt: NOW,
      updatedAt: NOW,
      document: createEmptyDocument(),
      viewport: DEFAULT_PROJECT_VIEWPORT,
      ui: DEFAULT_PROJECT_UI,
    });
    expect(validateProject(project)).toEqual(project);
  });

  it("rejects blank, overlong and invalid project data", () => {
    expect(() => createProject({ id: "p", name: "   ", now: NOW })).toThrow();
    expect(() => createProject({ id: "p", name: "x".repeat(81), now: NOW })).toThrow();
    expect(() => validateProject({
      storageVersion: 1,
      id: "p",
      name: "Plan",
      createdAt: NOW,
      updatedAt: NOW,
      document: createEmptyDocument(),
      viewport: { ...DEFAULT_PROJECT_VIEWPORT, offsetX: Number.NaN },
      ui: DEFAULT_PROJECT_UI,
    })).toThrow();
  });

  it("renames and replaces snapshots immutably", () => {
    const original = createProject({ id: "project-1", name: "A", now: NOW });
    const document = { ...createEmptyDocument(), roomAnnotations: [{ id: "r", name: "Спальня", anchor: { x: 100, y: 100 } }] };
    const renamed = renameProject(original, " B ", "2026-07-21T19:01:00.000Z");
    const withDocument = replaceProjectDocument(renamed, document, "2026-07-21T19:02:00.000Z");
    const withViewport = replaceProjectViewport(withDocument, { offsetX: 10, offsetY: 20, pixelsPerMillimeter: 0.2 }, "2026-07-21T19:03:00.000Z");
    const withUi = replaceProjectUi(withViewport, { furnitureCatalogOpen: false }, "2026-07-21T19:04:00.000Z");

    expect(original.name).toBe("A");
    expect(renamed.name).toBe("B");
    expect(withDocument.document).toEqual(document);
    expect(withViewport.viewport).toEqual({ offsetX: 10, offsetY: 20, pixelsPerMillimeter: 0.2 });
    expect(withUi.ui.furnitureCatalogOpen).toBe(false);
    expect(withUi.updatedAt).toBe("2026-07-21T19:04:00.000Z");
  });

  it("duplicates an independent alternative layout", () => {
    const original = createProject({ id: "project-1", name: "Основной вариант", now: NOW });
    const duplicate = duplicateProject(original, "project-2", "2026-07-21T20:00:00.000Z");
    expect(duplicate.id).toBe("project-2");
    expect(duplicate.name).toBe("Основной вариант — копия");
    expect(duplicate.createdAt).toBe("2026-07-21T20:00:00.000Z");
    expect(duplicate.document).toEqual(original.document);
    expect(duplicate.document).not.toBe(original.document);
  });
});

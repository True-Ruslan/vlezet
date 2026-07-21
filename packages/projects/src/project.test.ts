import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import {
  DEFAULT_PROJECT_UI,
  DEFAULT_PROJECT_VIEWPORT,
  createProject,
  duplicateProject,
  renameProject,
  replaceProjectDocument,
  replaceProjectReferencePlan,
  replaceProjectUi,
  replaceProjectViewport,
  updateReferencePlanDisplay,
  validateProject,
} from "./index";

const NOW = "2026-07-21T19:00:00.000Z";

const referencePlan = {
  assetId: "asset-1",
  source: { kind: "image" as const, originalMimeType: "image/png" as const },
  widthPx: 2000,
  heightPx: 1400,
  transform: { originWorld: { x: 1000, y: 800 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: {
    pointA: { x: 100, y: 100 },
    pointB: { x: 600, y: 100 },
    knownLengthMm: 1000,
    alignment: "horizontal" as const,
  },
  display: { visible: true, opacity: 0.45, locked: true },
};

describe("project model", () => {
  it("creates storage v2 projects with reference-safe defaults", () => {
    const project = createProject({ id: "project-1", name: "  Квартира  ", now: NOW });
    expect(project).toEqual({
      storageVersion: 2,
      id: "project-1",
      name: "Квартира",
      createdAt: NOW,
      updatedAt: NOW,
      document: createEmptyDocument(),
      viewport: DEFAULT_PROJECT_VIEWPORT,
      ui: DEFAULT_PROJECT_UI,
      referencePlan: null,
    });
    expect(DEFAULT_PROJECT_UI).toEqual({ furnitureCatalogOpen: true, referencePanelOpen: false });
    expect(validateProject(project)).toEqual(project);
  });

  it("migrates storage v1 records without a reference plan", () => {
    const migrated = validateProject({
      storageVersion: 1,
      id: "legacy",
      name: "Старый проект",
      createdAt: NOW,
      updatedAt: NOW,
      document: createEmptyDocument(),
      viewport: DEFAULT_PROJECT_VIEWPORT,
      ui: { furnitureCatalogOpen: false },
    });
    expect(migrated.storageVersion).toBe(2);
    expect(migrated.referencePlan).toBeNull();
    expect(migrated.ui).toEqual({ furnitureCatalogOpen: false, referencePanelOpen: false });
  });

  it("validates calibrated reference metadata strictly", () => {
    const project = createProject({ id: "p", name: "Plan", now: NOW, referencePlan });
    expect(project.referencePlan).toEqual(referencePlan);
    expect(() => validateProject({ ...project, referencePlan: { ...referencePlan, widthPx: 0 } })).toThrow();
    expect(() => validateProject({ ...project, referencePlan: { ...referencePlan, display: { ...referencePlan.display, opacity: 1.5 } } })).toThrow();
    expect(() => validateProject({ ...project, referencePlan: { ...referencePlan, transform: { ...referencePlan.transform, millimetersPerPixel: 0 } } })).toThrow();
  });

  it("renames and replaces snapshots immutably", () => {
    const original = createProject({ id: "project-1", name: "A", now: NOW });
    const document = { ...createEmptyDocument(), roomAnnotations: [{ id: "r", name: "Спальня", anchor: { x: 100, y: 100 } }] };
    const renamed = renameProject(original, " B ", "2026-07-21T19:01:00.000Z");
    const withDocument = replaceProjectDocument(renamed, document, "2026-07-21T19:02:00.000Z");
    const withViewport = replaceProjectViewport(withDocument, { offsetX: 10, offsetY: 20, pixelsPerMillimeter: 0.2 }, "2026-07-21T19:03:00.000Z");
    const withUi = replaceProjectUi(withViewport, { furnitureCatalogOpen: false, referencePanelOpen: true }, "2026-07-21T19:04:00.000Z");
    const withReference = replaceProjectReferencePlan(withUi, referencePlan, "2026-07-21T19:05:00.000Z");
    const hidden = updateReferencePlanDisplay(withReference, { visible: false }, "2026-07-21T19:06:00.000Z");

    expect(original.name).toBe("A");
    expect(renamed.name).toBe("B");
    expect(withDocument.document).toEqual(document);
    expect(withViewport.viewport).toEqual({ offsetX: 10, offsetY: 20, pixelsPerMillimeter: 0.2 });
    expect(withUi.ui.referencePanelOpen).toBe(true);
    expect(withReference.referencePlan).toEqual(referencePlan);
    expect(hidden.referencePlan?.display.visible).toBe(false);
    expect(withReference.referencePlan?.display.visible).toBe(true);
  });

  it("duplicates an independent alternative layout including reference metadata", () => {
    const original = createProject({ id: "project-1", name: "Основной вариант", now: NOW, referencePlan });
    const duplicate = duplicateProject(original, "project-2", "2026-07-21T20:00:00.000Z");
    expect(duplicate.id).toBe("project-2");
    expect(duplicate.name).toBe("Основной вариант — копия");
    expect(duplicate.document).not.toBe(original.document);
    expect(duplicate.referencePlan).toEqual(original.referencePlan);
    expect(duplicate.referencePlan).not.toBe(original.referencePlan);
  });
});

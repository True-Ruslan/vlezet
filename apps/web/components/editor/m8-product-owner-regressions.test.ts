import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { loadEditorDocument } from "./editor-session";
import { entitiesIntersectingMarquee } from "./editor-selection-geometry";
import { editorStore, type EditorStoreState } from "./use-editor-store";

function roomWithFurnitureAndOpening(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [
      {
        id: "door",
        wallId: "top",
        kind: "door",
        offset: 900,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
    roomAnnotations: [],
    placedObjects: [
      {
        id: "chair-a",
        presetId: null,
        name: "Стул A",
        category: "chair",
        position: { x: 1200, y: 1200 },
        width: 500,
        depth: 500,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
      {
        id: "chair-b",
        presetId: null,
        name: "Стул B",
        category: "chair",
        position: { x: 2800, y: 1800 },
        width: 500,
        depth: 500,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      },
    ],
  };
}

describe("M8.2 product-owner regression contracts", () => {
  it("marquee around a complete room selects the semantic room root plus furniture, not backing walls/openings", () => {
    const document = roomWithFurnitureAndOpening();
    const room = deriveRooms(document).rooms[0];
    expect(room).toBeDefined();

    const hits = entitiesIntersectingMarquee(document, {
      minX: -250,
      minY: -250,
      maxX: 4250,
      maxY: 3250,
    });

    expect(hits).toEqual([
      { kind: "room", id: room!.id },
      { kind: "placed-object", id: "chair-a" },
      { kind: "placed-object", id: "chair-b" },
    ]);
    expect(hits.some((ref) => ref.kind === "wall" || ref.kind === "opening")).toBe(false);
  });

  it("keeps ordinary concrete marquee behavior when no whole room is enclosed", () => {
    const document = roomWithFurnitureAndOpening();
    const hits = entitiesIntersectingMarquee(document, {
      minX: 850,
      minY: -150,
      maxX: 1850,
      maxY: 250,
    });

    expect(hits.some((ref) => ref.kind === "room")).toBe(false);
    expect(hits.some((ref) => ref.kind === "wall" || ref.kind === "opening")).toBe(true);
  });

  it("repairs enhanced opening actions when a live editor store has stale Turbopack/HMR action shape", () => {
    const document = roomWithFurnitureAndOpening();
    const original = editorStore.getState();
    const originalActions = {
      beginStructuralOpeningGesture: original.beginStructuralOpeningGesture,
      previewStructuralOpeningGesture: original.previewStructuralOpeningGesture,
      commitStructuralGesture: original.commitStructuralGesture,
      cancelStructuralGesture: original.cancelStructuralGesture,
    };

    try {
      editorStore.setState({
        beginStructuralOpeningGesture: undefined,
        previewStructuralOpeningGesture: undefined,
      } as unknown as Partial<EditorStoreState>);

      loadEditorDocument(document);

      const repaired = editorStore.getState();
      expect(typeof repaired.beginStructuralOpeningGesture).toBe("function");
      expect(typeof repaired.previewStructuralOpeningGesture).toBe("function");
      expect(typeof repaired.commitStructuralGesture).toBe("function");
      expect(typeof repaired.cancelStructuralGesture).toBe("function");

      repaired.beginStructuralOpeningGesture("door");
      expect(editorStore.getState().structuralGesture).toMatchObject({
        kind: "translate-opening",
        entityId: "door",
      });
    } finally {
      editorStore.setState(originalActions);
      editorStore.getState().cancelStructuralGesture();
    }
  });
});

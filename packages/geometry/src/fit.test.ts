import { describe, expect, it } from "vitest";
import { doorSwingPolygon, evaluateObjectFits, objectRectangle, type FitDocumentLike, type FitPlacedObjectLike } from "./fit";

function object(overrides: Partial<FitPlacedObjectLike> & Pick<FitPlacedObjectLike, "id" | "name">): FitPlacedObjectLike {
  return {
    id: overrides.id,
    name: overrides.name,
    position: overrides.position ?? { x: 3000, y: 2000 },
    width: overrides.width ?? 1000,
    depth: overrides.depth ?? 600,
    rotationDeg: overrides.rotationDeg ?? 0,
    clearance: overrides.clearance ?? { front: 0, right: 0, back: 0, left: 0 },
  };
}

function roomDocument(placedObjects: readonly FitPlacedObjectLike[], withDoor = false): FitDocumentLike {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "c", position: { x: 6000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 200 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 200 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 200 },
    ],
    roomAnnotations: [],
    openings: withDoor
      ? [{ id: "door", wallId: "top", kind: "door", offset: 2000, width: 900, doorSwing: { hinge: "start", side: "left" } }]
      : [],
    placedObjects,
  };
}

describe("furniture fit evaluation", () => {
  it("reports a clean placement as fits", () => {
    const bed = object({ id: "bed", name: "Кровать", width: 1600, depth: 2000 });
    const result = evaluateObjectFits(roomDocument([bed])).byObjectId.get("bed");
    expect(result).toEqual(expect.objectContaining({ status: "fits", diagnostics: [], roomId: expect.any(String) }));
  });

  it("blocks an object that leaves the usable room polygon", () => {
    const bed = object({ id: "bed", name: "Кровать", position: { x: 250, y: 2000 }, width: 500, depth: 1200 });
    const result = evaluateObjectFits(roomDocument([bed])).byObjectId.get("bed")!;
    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "outside-room", severity: "collision" }));
  });

  it("reports object-object collisions symmetrically", () => {
    const bed = object({ id: "bed", name: "Кровать", width: 1600, depth: 2000 });
    const wardrobe = object({ id: "wardrobe", name: "Шкаф", position: { x: 3600, y: 2000 }, width: 1200, depth: 600 });
    const result = evaluateObjectFits(roomDocument([bed, wardrobe]));
    expect(result.byObjectId.get("bed")?.status).toBe("blocked");
    expect(result.byObjectId.get("wardrobe")?.diagnostics).toContainEqual(
      expect.objectContaining({ code: "object-collision", relatedObjectId: "bed" }),
    );
  });

  it("blocks furniture inside the deterministic door swing sector", () => {
    const wardrobe = object({
      id: "wardrobe",
      name: "Шкаф",
      position: { x: 2450, y: 450 },
      width: 500,
      depth: 500,
    });
    const document = roomDocument([wardrobe], true);
    expect(doorSwingPolygon(document, document.openings[0]!)).toHaveLength(18);
    const result = evaluateObjectFits(document).byObjectId.get("wardrobe")!;
    expect(result.status).toBe("blocked");
    expect(result.diagnostics).toContainEqual(
      expect.objectContaining({ code: "door-obstructed", relatedOpeningId: "door", severity: "collision" }),
    );
  });

  it("returns tight when only a recommended front clearance reaches a wall", () => {
    const wardrobe = object({
      id: "wardrobe",
      name: "Шкаф",
      position: { x: 3000, y: 3200 },
      width: 1600,
      depth: 600,
      clearance: { front: 800, right: 0, back: 0, left: 0 },
    });
    const result = evaluateObjectFits(roomDocument([wardrobe])).byObjectId.get("wardrobe")!;
    expect(result.status).toBe("tight");
    expect(result.diagnostics).toContainEqual(expect.objectContaining({ code: "clearance-wall", severity: "recommendation" }));
  });

  it("keeps rectangle derivation independent from rendering", () => {
    expect(objectRectangle(object({ id: "desk", name: "Стол", position: { x: 10, y: 20 }, width: 1400, depth: 700, rotationDeg: 90 }))).toEqual({
      center: { x: 10, y: 20 }, width: 1400, depth: 700, rotationDeg: 90,
    });
  });
});

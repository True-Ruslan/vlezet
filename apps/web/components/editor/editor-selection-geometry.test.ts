import { createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import {
  deriveRooms,
  objectRectangle,
  orientedRectangleCorners,
} from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { addToSelection, replaceSelection } from "./editor-selection";
import {
  deriveEntityWorldBounds,
  deriveSelectionWorldBounds,
  entitiesIntersectingMarquee,
  type WorldRect,
} from "./editor-selection-geometry";

function documentFixture(): VlezetDocument {
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
    openings: [
      { id: "door-1", wallId: "top", kind: "door", offset: 2000, width: 1000 },
    ],
    roomAnnotations: [],
    placedObjects: [
      createPlacedObject({
        id: "rotated",
        presetId: null,
        name: "Повернутый стол",
        category: "table",
        position: { x: 4000, y: 1200 },
        width: 1000,
        depth: 400,
        rotationDeg: 45,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "opening-object",
        presetId: null,
        name: "Предмет у проёма",
        category: "custom",
        position: { x: 2500, y: 0 },
        width: 300,
        depth: 300,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
      createPlacedObject({
        id: "wall-object",
        presetId: null,
        name: "Предмет у стены",
        category: "custom",
        position: { x: 1000, y: 0 },
        width: 300,
        depth: 300,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }),
    ],
  };
}

function rectAround(x: number, y: number, half = 5): WorldRect {
  return { minX: x - half, minY: y - half, maxX: x + half, maxY: y + half };
}

function boundsOfPoints(points: readonly Readonly<{ x: number; y: number }>[]): WorldRect {
  return {
    minX: Math.min(...points.map((point) => point.x)),
    minY: Math.min(...points.map((point) => point.y)),
    maxX: Math.max(...points.map((point) => point.x)),
    maxY: Math.max(...points.map((point) => point.y)),
  };
}

describe("M8.1 semantic selection geometry", () => {
  it("derives rotation-aware placed-object bounds from the physical oriented rectangle", () => {
    const document = documentFixture();
    const object = document.placedObjects.find((candidate) => candidate.id === "rotated")!;
    const expected = boundsOfPoints(orientedRectangleCorners(objectRectangle(object)));

    expect(deriveEntityWorldBounds(document, { kind: "placed-object", id: object.id })).toEqual(expected);
  });

  it("hits a true rotated furniture corner but rejects an empty AABB corner", () => {
    const document = documentFixture();
    const object = document.placedObjects.find((candidate) => candidate.id === "rotated")!;
    const corners = orientedRectangleCorners(objectRectangle(object));
    const actualCorner = corners[0]!;
    const bounds = boundsOfPoints(corners);

    expect(entitiesIntersectingMarquee(document, rectAround(actualCorner.x, actualCorner.y, 8))).toContainEqual({
      kind: "placed-object",
      id: "rotated",
    });

    const emptyAabbCorner = rectAround(bounds.minX + 8, bounds.minY + 8, 4);
    expect(entitiesIntersectingMarquee(document, emptyAabbCorner)).not.toContainEqual({
      kind: "placed-object",
      id: "rotated",
    });
  });

  it("uses the physical wall band and excludes the hosted opening gap from wall hits", () => {
    const document = documentFixture();

    expect(entitiesIntersectingMarquee(document, {
      minX: 450,
      minY: 90,
      maxX: 550,
      maxY: 110,
    })).toContainEqual({ kind: "wall", id: "top" });

    expect(entitiesIntersectingMarquee(document, {
      minX: 450,
      minY: 101,
      maxX: 550,
      maxY: 130,
    })).not.toContainEqual({ kind: "wall", id: "top" });

    const openingGap = entitiesIntersectingMarquee(document, {
      minX: 2450,
      minY: -40,
      maxX: 2550,
      maxY: 40,
    });
    expect(openingGap).not.toContainEqual({ kind: "wall", id: "top" });
  });

  it("hits an opening through its hosted physical band and orders it before overlapping furniture", () => {
    const document = documentFixture();

    expect(entitiesIntersectingMarquee(document, {
      minX: 2450,
      minY: -40,
      maxX: 2550,
      maxY: 40,
    })).toEqual([
      { kind: "opening", id: "door-1" },
      { kind: "placed-object", id: "opening-object" },
    ]);
  });

  it("orders furniture before a visible wall and preserves document order within a semantic priority", () => {
    const document = documentFixture();
    const result = entitiesIntersectingMarquee(document, {
      minX: 850,
      minY: -80,
      maxX: 1200,
      maxY: 80,
    });

    expect(result).toEqual([
      { kind: "placed-object", id: "wall-object" },
      { kind: "wall", id: "top" },
    ]);
  });

  it("unions mixed semantic selection bounds and ignores stale refs", () => {
    const document = documentFixture();
    const openingBounds = deriveEntityWorldBounds(document, { kind: "opening", id: "door-1" })!;
    const objectBounds = deriveEntityWorldBounds(document, { kind: "placed-object", id: "rotated" })!;
    const selection = addToSelection(
      replaceSelection({ kind: "opening", id: "door-1" }),
      [
        { kind: "placed-object", id: "rotated" },
        { kind: "wall", id: "missing-wall" },
      ],
    );

    expect(deriveSelectionWorldBounds(document, selection)).toEqual({
      minX: Math.min(openingBounds.minX, objectBounds.minX),
      minY: Math.min(openingBounds.minY, objectBounds.minY),
      maxX: Math.max(openingBounds.maxX, objectBounds.maxX),
      maxY: Math.max(openingBounds.maxY, objectBounds.maxY),
    });
  });

  it("supports direct room selection bounds while excluding rooms and vertices from marquee results", () => {
    const document = documentFixture();
    const room = deriveRooms(document).rooms[0]!;
    const roomBounds = boundsOfPoints(room.polygon);

    expect(deriveEntityWorldBounds(document, { kind: "room", id: room.id })).toEqual(roomBounds);
    expect(deriveSelectionWorldBounds(document, replaceSelection({ kind: "room", id: room.id }))).toEqual(roomBounds);

    const entirePlan = entitiesIntersectingMarquee(document, {
      minX: -1000,
      minY: -1000,
      maxX: 7000,
      maxY: 5000,
    });
    expect(entirePlan.some((ref) => ref.kind === "room" || ref.kind === "vertex")).toBe(false);
  });
});

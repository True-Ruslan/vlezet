import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import {
  DEFAULT_WALL_HEIGHT_MM,
  projectDocumentToSpatialScene,
} from "./index";

function emptyDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [],
    walls: [],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

function rectangularDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 3650, y: 0 } },
      { id: "v3", position: { x: 3650, y: 3400 } },
      { id: "v4", position: { x: 0, y: 3400 } },
    ],
    walls: [
      { id: "top", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [
      { id: "door-1", wallId: "top", kind: "door", offset: 500, width: 900 },
      { id: "window-1", wallId: "top", kind: "window", offset: 2200, width: 1000 },
    ],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("projectDocumentToSpatialScene", () => {
  it("returns an empty valid scene for an empty document without mutating it", () => {
    const document = emptyDocument();
    const before = JSON.stringify(document);

    const result = projectDocumentToSpatialScene(document);

    expect(result.scene.wallSegments).toEqual([]);
    expect(result.scene.openingMarkers).toEqual([]);
    expect(result.scene.floors).toEqual([]);
    expect(result.diagnostics).toEqual([]);
    expect(JSON.stringify(document)).toBe(before);
  });

  it("maps document x/y to scene X/Z and preserves exact wall interval dimensions", () => {
    const document: VlezetDocument = {
      ...emptyDocument(),
      vertices: [
        { id: "a", position: { x: 100, y: 200 } },
        { id: "b", position: { x: 3650, y: 200 } },
      ],
      walls: [
        { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 120 },
      ],
    };

    const result = projectDocumentToSpatialScene(document);
    const segment = result.scene.wallSegments[0]!;

    expect(segment.lengthMm).toBe(3550);
    expect(segment.thicknessMm).toBe(120);
    expect(segment.heightMm).toBe(DEFAULT_WALL_HEIGHT_MM);
    expect(segment.center).toEqual({ x: 1875, y: DEFAULT_WALL_HEIGHT_MM / 2, z: 200 });
    expect(segment.rotationYRad).toBeCloseTo(0, 12);
  });

  it("derives rotation deterministically from the 2D wall direction", () => {
    const document: VlezetDocument = {
      ...emptyDocument(),
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 0, y: 3550 } },
      ],
      walls: [
        { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      ],
    };

    const segment = projectDocumentToSpatialScene(document).scene.wallSegments[0]!;
    expect(segment.lengthMm).toBe(3550);
    expect(segment.rotationYRad).toBeCloseTo(-Math.PI / 2, 12);
  });

  it("splits walls around multiple openings and preserves semantic opening markers", () => {
    const result = projectDocumentToSpatialScene(rectangularDocument());
    const topSegments = result.scene.wallSegments.filter((segment) => segment.wallId === "top");

    expect(topSegments.map((segment) => [segment.startOffsetMm, segment.endOffsetMm])).toEqual([
      [0, 500],
      [1400, 2200],
      [3200, 3650],
    ]);
    expect(topSegments.map((segment) => segment.lengthMm)).toEqual([500, 800, 450]);

    expect(result.scene.openingMarkers.map((marker) => ({
      id: marker.openingId,
      kind: marker.kind,
      width: marker.widthMm,
      center: marker.center,
    }))).toEqual([
      { id: "door-1", kind: "door", width: 900, center: { x: 950, y: DEFAULT_WALL_HEIGHT_MM / 2, z: 0 } },
      { id: "window-1", kind: "window", width: 1000, center: { x: 2700, y: DEFAULT_WALL_HEIGHT_MM / 2, z: 0 } },
    ]);
  });

  it("rejects an opening outside its host wall instead of projecting misleading 3D", () => {
    const base = rectangularDocument();
    const document: VlezetDocument = {
      ...base,
      openings: [{ id: "broken-opening", wallId: "top", kind: "door", offset: 3400, width: 900 }],
    };

    const result = projectDocumentToSpatialScene(document);

    expect(result.scene.openingMarkers).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      entityId: "broken-opening",
      entityKind: "opening",
      code: "invalid-opening",
      severity: "error",
    }));
  });

  it("projects derived room inner polygons directly onto the X/Z floor plane", () => {
    const result = projectDocumentToSpatialScene(rectangularDocument());

    expect(result.scene.floors).toHaveLength(1);
    expect(result.scene.floors[0]?.polygon).toEqual([
      { x: 50, y: 0, z: 50 },
      { x: 3600, y: 0, z: 50 },
      { x: 3600, y: 0, z: 3350 },
      { x: 50, y: 0, z: 3350 },
    ]);
  });

  it("isolates invalid wall projection with a deterministic diagnostic", () => {
    const document: VlezetDocument = {
      ...emptyDocument(),
      walls: [
        { id: "broken", startVertexId: "missing-a", endVertexId: "missing-b", junctionVertexIds: [], thickness: 100 },
      ],
    };

    const result = projectDocumentToSpatialScene(document);

    expect(result.scene.wallSegments).toEqual([]);
    expect(result.diagnostics).toEqual([
      expect.objectContaining({ entityId: "broken", entityKind: "wall", severity: "error" }),
    ]);
  });
});

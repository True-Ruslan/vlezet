import { describe, expect, it } from "vitest";
import { migrateDocument, type VlezetDocumentV1, type VlezetDocumentV2 } from "./index";

describe("document migration", () => {
  it("migrates shared v1 endpoints into shared explicit vertices", () => {
    const v1: VlezetDocumentV1 = {
      schemaVersion: 1,
      walls: [
        { id: "wall-a", start: { x: 0, y: 0 }, end: { x: 4000, y: 0 }, thickness: 200 },
        { id: "wall-b", start: { x: 4000, y: 0 }, end: { x: 4000, y: 3000 }, thickness: 150 },
      ],
    };

    const migrated = migrateDocument(v1);

    expect(migrated.schemaVersion).toBe(2);
    expect(migrated.vertices).toEqual([
      { id: "v1-vertex-0", position: { x: 0, y: 0 } },
      { id: "v1-vertex-1", position: { x: 4000, y: 0 } },
      { id: "v1-vertex-2", position: { x: 4000, y: 3000 } },
    ]);
    expect(migrated.walls).toEqual([
      {
        id: "wall-a",
        startVertexId: "v1-vertex-0",
        endVertexId: "v1-vertex-1",
        junctionVertexIds: [],
        thickness: 200,
      },
      {
        id: "wall-b",
        startVertexId: "v1-vertex-1",
        endVertexId: "v1-vertex-2",
        junctionVertexIds: [],
        thickness: 150,
      },
    ]);
    expect(migrated.openings).toEqual([]);
    expect(migrated.roomAnnotations).toEqual([]);
  });

  it("does not proximity-merge distinct serialized coordinates", () => {
    const migrated = migrateDocument({
      schemaVersion: 1,
      walls: [
        { id: "a", start: { x: 0, y: 0 }, end: { x: 1000, y: 0 }, thickness: 100 },
        { id: "b", start: { x: 1000.0001, y: 0 }, end: { x: 2000, y: 0 }, thickness: 100 },
      ],
    });

    expect(migrated.vertices).toHaveLength(4);
    expect(migrated.walls[0]?.endVertexId).not.toBe(migrated.walls[1]?.startVertexId);
  });

  it("returns schema-v2 input unchanged", () => {
    const v2: VlezetDocumentV2 = {
      schemaVersion: 2,
      vertices: [{ id: "v", position: { x: 10, y: 20 } }],
      walls: [],
      openings: [],
      roomAnnotations: [],
    };

    expect(migrateDocument(v2)).toBe(v2);
  });
});

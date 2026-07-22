import { MAX_PLACED_OBJECT_DIMENSION_MM, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { projectDocumentToSpatialScene } from "./index";

describe("spatial object projection bounds", () => {
  it("rejects finite object dimensions outside the persistent domain contract", () => {
    const document: VlezetDocument = {
      schemaVersion: 3,
      vertices: [],
      walls: [],
      openings: [],
      roomAnnotations: [],
      placedObjects: [{
        id: "oversized-object",
        presetId: null,
        name: "Oversized",
        category: "custom",
        position: { x: 0, y: 0 },
        width: MAX_PLACED_OBJECT_DIMENSION_MM + 1,
        depth: 500,
        rotationDeg: 0,
        clearance: { front: 0, right: 0, back: 0, left: 0 },
      }],
    };

    const result = projectDocumentToSpatialScene(document);

    expect(result.scene.objects).toEqual([]);
    expect(result.diagnostics).toContainEqual(expect.objectContaining({
      code: "invalid-object",
      entityKind: "placed-object",
      entityId: "oversized-object",
      severity: "error",
    }));
  });
});

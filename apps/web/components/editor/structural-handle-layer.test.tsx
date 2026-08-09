import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import {
  STRUCTURAL_HANDLE_HIT_RADIUS_PX,
  STRUCTURAL_HANDLE_VISUAL_RADIUS_PX,
  deriveStructuralHandleDescriptors,
} from "./structural-handle-layer";

function documentWithJunction(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 1000, y: 1000 } },
      { id: "j", position: { x: 3000, y: 1000 } },
      { id: "b", position: { x: 5000, y: 1000 } },
      { id: "p", position: { x: 3000, y: 3000 } },
    ],
    walls: [
      { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 180 },
      { id: "branch", startVertexId: "j", endVertexId: "p", junctionVertexIds: [], thickness: 120 },
    ],
  };
}

describe("M8.2 structural handle layer", () => {
  it("derives only selected-wall endpoints and junctions in stable wall order", () => {
    const handles = deriveStructuralHandleDescriptors(
      documentWithJunction(),
      "host",
      { pixelsPerMillimeter: 0.1, offsetX: 20, offsetY: 30 },
    );

    expect(handles.map((handle) => ({ vertexId: handle.vertexId, kind: handle.kind }))).toEqual([
      { vertexId: "a", kind: "endpoint" },
      { vertexId: "j", kind: "junction" },
      { vertexId: "b", kind: "endpoint" },
    ]);
    expect(handles.map((handle) => handle.screenPoint)).toEqual([
      { x: 120, y: 130 },
      { x: 320, y: 130 },
      { x: 520, y: 130 },
    ]);
  });

  it("backs deterministic 24px hit metadata with an actual >=12px hit radius", () => {
    expect(STRUCTURAL_HANDLE_VISUAL_RADIUS_PX).toBeGreaterThan(0);
    expect(STRUCTURAL_HANDLE_VISUAL_RADIUS_PX).toBeLessThan(STRUCTURAL_HANDLE_HIT_RADIUS_PX);
    expect(STRUCTURAL_HANDLE_HIT_RADIUS_PX).toBeGreaterThanOrEqual(12);

    const [handle] = deriveStructuralHandleDescriptors(
      documentWithJunction(),
      "host",
      { pixelsPerMillimeter: 0.1, offsetX: 0, offsetY: 0 },
    );
    expect(handle).toMatchObject({ hitRadiusPx: 12, dataHitDiameter: "24" });
  });

  it("returns no handles for a missing wall and does not mutate the document", () => {
    const document = documentWithJunction();
    const before = structuredClone(document);

    expect(deriveStructuralHandleDescriptors(
      document,
      "missing",
      { pixelsPerMillimeter: 0.1, offsetX: 0, offsetY: 0 },
    )).toEqual([]);
    expect(document).toEqual(before);
  });
});

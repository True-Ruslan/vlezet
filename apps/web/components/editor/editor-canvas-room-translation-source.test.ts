import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.2 direct room translation Canvas routing", () => {
  it("models room translation as an existing structural pointer gesture", () => {
    expect(source).toContain('kind: "translate-room"');
    expect(source).toContain("roomId: string");
    expect(source).toContain("movedVertexIds: ReadonlySet<string>");
    expect(source).toContain("movedWallIds: ReadonlySet<string>");
  });

  it("starts room drag only from the selected free room interior after concrete hit priority", () => {
    expect(source).toContain("beginStructuralRoomGesture");
    expect(source).toContain("canvasEntityFromKonvaNode");
    expect(source).toContain("entitiesAtPoint");
    expect(source).toContain("selectedRoomId");
    expect(source).toMatch(/if \(directEntity\) return false/);
    expect(source).toContain("editorStore.getState().beginStructuralRoomGesture(roomId)");
    expect(source).toContain('roomGesture?.kind !== "translate-room"');
  });

  it("previews the exact snapped delta and excludes the moving room from self-snapping", () => {
    expect(source).toContain('pointerGesture.kind === "translate-room"');
    expect(source).toContain("resolveCanvasStructuralSnap");
    expect(source).toContain("vertexIds: pointerGesture.movedVertexIds");
    expect(source).toContain("wallIds: pointerGesture.movedWallIds");
    expect(source).toContain("previewStructuralRoomGesture({");
    expect(source).toContain("x: resolved.point.x - pointerGesture.anchorStartWorld.x");
    expect(source).toContain("y: resolved.point.y - pointerGesture.anchorStartWorld.y");
  });

  it("projects explicit room furniture from the same structural preview document", () => {
    expect(source).toContain("structuralDisplayDocument.placedObjects.map");
    expect(source).not.toContain("pasteStructuralFragment");
  });
});

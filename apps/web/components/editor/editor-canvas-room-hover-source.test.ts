import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.2 room hover routing", () => {
  it("falls back to geometric room hit testing when Konva has no concrete entity under the pointer", () => {
    expect(source).toContain("entitiesAtPoint,");
    const moveStart = source.indexOf("const onMouseMove");
    const moveEnd = source.indexOf("const endPan", moveStart);
    const moveSource = source.slice(moveStart, moveEnd);

    expect(moveStart).toBeGreaterThanOrEqual(0);
    expect(moveSource).toContain("canvasEntityFromKonvaNode(hitNode)");
    expect(moveSource).toContain("entitiesAtPoint(structuralDisplayDocument, pointerWorld)");
    expect(moveSource).toContain('ref.kind === "room"');
    expect(moveSource).toContain("setHoveredCanvasEntity(hoveredFromNode ?? hoveredRoom)");
  });
});

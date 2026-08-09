import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");
const shapeSource = readFileSync(new URL("./placed-object-shape.tsx", import.meta.url), "utf8");

describe("M8.1 snapped group drag reconciliation", () => {
  it("returns the effective snapped world position from the Canvas gesture preview", () => {
    const start = canvasSource.indexOf("const previewObjectGesture");
    const end = canvasSource.indexOf("const onWheel", start);
    const body = canvasSource.slice(start, end);

    expect(body).toContain("const previewObjectGesture = (objectId: string, patch: PlacedObjectPatch): Point2 | null =>");
    expect(body).toContain("state.previewObjectGesture({ ...patch, position: snap.position });");
    expect(body).toContain("return snap.position;");
    expect(body).toContain("state.previewObjectGesture(patch);");
    expect(body).toContain("return null;");
  });

  it("forces the actively dragged Konva node back to the effective snapped preview on every move and end", () => {
    expect(shapeSource).toContain("onGesturePreview?: (patch: PlacedObjectPatch) => Point2 | null;");
    expect(shapeSource).toContain("const reconcileMovePreview = (node: Konva.Group) => {");
    expect(shapeSource).toContain("const resolvedPosition = onGesturePreview?.({ position: rawPosition });");
    expect(shapeSource).toContain("if (!resolvedPosition) return;");
    expect(shapeSource).toContain("node.position(worldToScreen(resolvedPosition, viewport));");

    const dragMoveStart = shapeSource.indexOf("onDragMove={(event) => {");
    const dragEndStart = shapeSource.indexOf("onDragEnd={(event) => {");
    const transformStart = shapeSource.indexOf("onTransformStart=", dragEndStart);
    const dragMoveBody = shapeSource.slice(dragMoveStart, dragEndStart);
    const dragEndBody = shapeSource.slice(dragEndStart, transformStart);

    expect(dragMoveBody).toContain("reconcileMovePreview(event.target as Konva.Group);");
    expect(dragEndBody).toContain("reconcileMovePreview(event.target as Konva.Group);");
    expect(dragEndBody).toContain("onGestureCommit?.();");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");
const shapeSource = readFileSync(new URL("./placed-object-shape.tsx", import.meta.url), "utf8");

describe("M8.1 snapped group drag reconciliation", () => {
  it("keeps Canvas as the single snap authority and writes the resolved position into gesture preview", () => {
    const start = canvasSource.indexOf("const previewObjectGesture");
    const end = canvasSource.indexOf("const onWheel", start);
    const body = canvasSource.slice(start, end);

    expect(body).toContain("const snap = snapPlacedObject({");
    expect(body).toContain("state.previewObjectGesture({ ...patch, position: snap.position });");
    expect(body).not.toContain("event.target.position(");
  });

  it("reconciles the imperative Konva node from authoritative snapped object props on every preview render", () => {
    expect(shapeSource).toContain('import { useEffect, useLayoutEffect, useRef } from "react";');
    expect(shapeSource).toContain("useLayoutEffect(() => {");
    expect(shapeSource).toContain("const group = groupRef.current;");
    expect(shapeSource).toContain("if (!group || preview) return;");
    expect(shapeSource).toContain("group.position(worldToScreen(object.position, viewport));");
    expect(shapeSource).toContain("group.getLayer()?.batchDraw();");
    expect(shapeSource).toContain("}, [object, preview, viewport]);");

    expect(shapeSource).toContain("onGesturePreview?: (patch: PlacedObjectPatch) => void;");
    expect(shapeSource).toContain("onDragMove={(event) => {");
    expect(shapeSource).toContain("onDragEnd={(event) => {");
  });
});

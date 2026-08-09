import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.1 empty-canvas context-menu integration", () => {
  it("suppresses the native menu and forwards the nullable semantic hit target", () => {
    const start = canvasSource.indexOf("const onCanvasContextMenu");
    const end = canvasSource.indexOf("const finalizeMarquee", start);
    const body = canvasSource.slice(start, end);

    expect(body).toContain("const target = entitiesIntersectingMarquee(document");
    expect(body).toContain(")[0] ?? null;");
    expect(body).toContain("event.evt.preventDefault()");
    expect(body).toContain("position: { x: event.evt.clientX, y: event.evt.clientY }");
    expect(body).toContain("target,");
    expect(body).not.toContain("if (!target) {\n      onContextMenuRequest(null);");
  });
});

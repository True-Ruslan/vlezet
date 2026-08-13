import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const canvasSource = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");
const editorSource = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M8.2 Canvas pointer paste anchor", () => {
  it("publishes the latest world-space pointer before pointer-mode early returns", () => {
    expect(canvasSource).toContain("onPointerWorldChange: (point: Point2) => void");
    const moveStart = canvasSource.indexOf("const onMouseMove");
    const firstEarlyReturn = canvasSource.indexOf("if (panRef.current.active)", moveStart);
    const publication = canvasSource.indexOf("onPointerWorldChange(screenToWorld(pointer, viewport))", moveStart);

    expect(moveStart).toBeGreaterThanOrEqual(0);
    expect(publication).toBeGreaterThan(moveStart);
    expect(publication).toBeLessThan(firstEarlyReturn);
  });

  it("keeps the pointer ephemeral in ApartmentEditor and resets it between projects", () => {
    expect(editorSource).toContain("latestCanvasPointerWorldRef");
    expect(editorSource).toContain("latestCanvasPointerWorldRef.current = null");
    expect(editorSource).toContain("onPointerWorldChange={rememberCanvasPointer}");
    expect(editorSource).not.toContain("onViewportChange(latestCanvasPointer");
  });

  it("routes Paste to the latest Canvas pointer with clipboard origin as a deterministic fallback", () => {
    expect(editorSource).toContain("const anchor = latestCanvasPointerWorldRef.current ?? origin");
    expect(editorSource).toContain("store.pasteClipboard(anchor)");
    expect(editorSource).not.toContain("origin.x + 200");
    expect(editorSource).not.toContain("origin.y + 200");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.1 Canvas context-menu boundary", () => {
  it("emits only a semantic entity target and screen position to the shell", () => {
    expect(source).toContain('from "./editor-context-menu"');
    expect(source).toContain("onContextMenuRequest: (request: EditorContextMenuRequest | null) => void");
    expect(source).toContain("const onCanvasContextMenu");
    expect(source).toContain("entitiesIntersectingMarquee(document, {");
    expect(source).toContain("minX: world.x");
    expect(source).toContain("maxY: world.y");
    expect(source).toContain("onContextMenuRequest({");
    expect(source).toContain("position: { x: event.evt.clientX, y: event.evt.clientY }");
    expect(source).toContain("target,");
    expect(source).toContain("onContextMenu={onCanvasContextMenu}");
  });

  it("keeps mutation and registered-command execution out of Canvas", () => {
    expect(source).not.toContain("onCopyContext");
    expect(source).not.toContain("onDeleteContext");
    expect(source).not.toContain("onDuplicateContext");
    expect(source).not.toContain("availableContextMenuCommands");
    expect(source).not.toContain("executeEditorCommand");
  });
});

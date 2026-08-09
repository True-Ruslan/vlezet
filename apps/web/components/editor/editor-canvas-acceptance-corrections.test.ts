import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.1 product-owner acceptance Canvas corrections", () => {
  it("uses the calibrated pure-controller factor for modified wheel/trackpad zoom", () => {
    const start = source.indexOf("const onWheel");
    const end = source.indexOf("const onCanvasContextMenu", start);
    const wheelBody = source.slice(start, end);

    expect(wheelBody).toContain("wheelGestureToViewportAction(event.evt)");
    expect(wheelBody).toContain("zoomViewportAt(");
    expect(wheelBody).toContain("pointer,");
    expect(wheelBody).toContain("action.factor,");
    expect(wheelBody).not.toContain("Math.exp(-action.deltaY * 0.0015)");
  });

  it("derives group selection bounds from the live object gesture preview", () => {
    expect(source).toContain("const selectionPreviewDocument = useMemo");
    expect(source).toContain("placedObjects: displayedObjects");

    const start = source.indexOf("const selectionGroupBounds");
    const end = source.indexOf("const groupSelectionVisual", start);
    const boundsBody = source.slice(start, end);

    expect(boundsBody).toContain("deriveSelectionWorldBounds(selectionPreviewDocument, selection)");
    expect(boundsBody).not.toContain("deriveSelectionWorldBounds(document, selection)");
  });

  it("keeps wall snap metadata in TopologySnapTarget instead of corrupting SnapResult", () => {
    expect(source).toContain('snap: { point, kind: "wall", guides: [] }');
    expect(source).toContain('target: { kind: "wall", wallId: wallCandidate.resolved.wall.id, point }');
    expect(source).not.toContain('snap: { point, kind: "wall", wallId:');
  });
});

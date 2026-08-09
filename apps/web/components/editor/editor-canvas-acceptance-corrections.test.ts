import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.1 product-owner acceptance Canvas corrections", () => {
  it("uses the calibrated pure-controller factor for modified wheel/trackpad zoom", () => {
    expect(source).toContain("const MODIFIED_WHEEL_DELTA_FACTOR = 2");
    expect(source).toContain("deltaY: event.evt.deltaY * MODIFIED_WHEEL_DELTA_FACTOR");
  });

  it("derives group selection bounds from the live object gesture preview", () => {
    expect(source).toContain("const displayObjects = objectGesture?.active ? objectGesture.previewObjects : objects");
    expect(source).toContain("const displayPlacedObjects");
    expect(source).toContain("placedObjectSelection(displayObjects");
  });

  it("keeps wall snap metadata in TopologySnapTarget instead of corrupting SnapResult", () => {
    const updateDraftStart = source.indexOf("const updateWallDraftFromPointer");
    const updateDraftEnd = source.indexOf("const updateOpeningPreview", updateDraftStart);
    const updateDraftSource = source.slice(updateDraftStart, updateDraftEnd);

    expect(source).toContain("function draftSnapFromStructural(snap: StructuralSnapResult): SnapResult");
    expect(source).toContain("return { point: snap.point, kind, guides: [] };");
    expect(updateDraftSource).toContain("const target = point === resolved.point ? structuralTargetToTopologyTarget(resolved.target) : null;");
    expect(updateDraftSource).toContain("{ ...draftSnapFromStructural(resolved), point },");
    expect(updateDraftSource).toContain("target,");
    expect(source).not.toContain('snap: { point, kind: "wall", wallId:');
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M8.2 structural Canvas integration contract", () => {
  it("routes structural snapping through the shared semantic resolver instead of local endpoint/wall ranking", () => {
    expect(source).toContain("resolveStructuralSnap");
    expect(source).toContain("structuralSnappingSettingsStore");
    expect(source).toContain("const acquisitionTolerance = SNAP_TOLERANCE_PX / viewport.pixelsPerMillimeter");
    expect(source).toContain("const releaseTolerance = STRUCTURAL_SNAP_RELEASE_PX / viewport.pixelsPerMillimeter");
    expect(source).toContain("const replacementAdvantage = STRUCTURAL_SNAP_REPLACEMENT_PX / viewport.pixelsPerMillimeter");
    expect(source).not.toContain("const snapPointer =");
    expect(source).not.toContain("const vertexCandidate = document.vertices.map");
    expect(source).not.toContain("const wallCandidate = resolvedWalls.map");
  });

  it("uses the approved dynamic input, handle layer and snap overlay rather than inventing inline equivalents", () => {
    expect(source).toContain('from "./wall-dynamic-input"');
    expect(source).toContain('from "./wall-dynamic-input-model"');
    expect(source).toContain('from "./structural-handle-layer"');
    expect(source).toContain('from "./structural-snap-overlay"');
    expect(source).toContain("<WallDynamicInput");
    expect(source).toContain("<StructuralHandleLayer");
    expect(source).toContain("<StructuralSnapOverlay");
  });

  it("renders structural preview geometry without replacing committed history authority", () => {
    expect(source).toContain("const structuralGesture = useStore(editorStore, (state) => state.structuralGesture)");
    expect(source).toContain("structuralGesture?.previewDocument ?? document");
    expect(source).toContain("commitStructuralGesture()");
    expect(source).toContain("cancelStructuralGesture()");
  });

  it("keeps temporary Alt/Option snap suppression Canvas-gesture-local", () => {
    expect(source).toContain("event.evt.altKey");
    expect(source).toContain("snappingEnabled && !event.evt.altKey");
    expect(source).not.toContain("window.addEventListener(\"keydown\", onAlt");
  });
});

import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const source = fs.readFileSync(path.join(__dirname, "editor-canvas.tsx"), "utf8");
const apartmentSource = fs.readFileSync(path.join(__dirname, "apartment-editor.tsx"), "utf8");

describe("M8.2 Canvas structural integration contract", () => {
  it("uses the semantic structural snap resolver as the single wall/structural snap authority", () => {
    expect(source).toContain("resolveStructuralSnap");
    expect(source).toContain("StructuralSnapResult");
    expect(source).not.toContain("snapWallPoint(");
  });

  it("converts acquisition, release and replacement hysteresis from CSS pixels only at the web boundary", () => {
    expect(source).toContain("const SNAP_TOLERANCE_PX = 12;");
    expect(source).toContain("const STRUCTURAL_SNAP_RELEASE_PX = 18;");
    expect(source).toContain("const STRUCTURAL_SNAP_REPLACEMENT_PX = 1;");
    expect(source).toMatch(/const acquisitionTolerance\s*=\s*SNAP_TOLERANCE_PX\s*\/\s*viewport\.pixelsPerMillimeter;/);
    expect(source).toMatch(/const releaseTolerance\s*=\s*STRUCTURAL_SNAP_RELEASE_PX\s*\/\s*viewport\.pixelsPerMillimeter;/);
    expect(source).toMatch(/const replacementAdvantage\s*=\s*STRUCTURAL_SNAP_REPLACEMENT_PX\s*\/\s*viewport\.pixelsPerMillimeter;/);
  });

  it("renders the approved exact-input, structural handles and named snap overlay", () => {
    expect(source).toContain("WallDynamicInput");
    expect(source).toContain("StructuralHandleLayer");
    expect(source).toContain("StructuralSnapOverlay");
  });

  it("renders structural previews from runtime gesture state without replacing committed history authority", () => {
    expect(source).toContain("structuralGesture");
    expect(source).toMatch(/structuralGesture\?\.previewDocument\s*\?\?\s*document/);
  });

  it("supports gesture-local Alt/Option suppression without consuming native editable controls", () => {
    expect(source).toContain("altKey");
    expect(source).toContain("data-editor-native-editable");
  });

  it("routes Escape through the structural gesture priority before ordinary object gesture cancellation", () => {
    expect(apartmentSource).toContain("hasStructuralGesture: store.structuralGesture !== null");
    expect(apartmentSource).toContain('case "cancel-structural-gesture": store.cancelStructuralGesture(); break;');
    expect(apartmentSource.indexOf('case "cancel-structural-gesture"'))
      .toBeLessThan(apartmentSource.indexOf('case "cancel-object-gesture"'));
  });
});

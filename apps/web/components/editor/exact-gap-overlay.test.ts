import { readFileSync } from "node:fs";
import { worldToScreen, type ViewportTransform } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import type { ExactGapAnnotation } from "../planning/exact-gap-annotation";
import { deriveExactGapOverlayLayout } from "./exact-gap-overlay";

const viewport: ViewportTransform = {
  offsetX: 100,
  offsetY: 50,
  pixelsPerMillimeter: 0.1,
};

const annotation: ExactGapAnnotation = {
  pairKey: "sofa|table",
  firstPoint: { x: 500, y: 500 },
  secondPoint: { x: 1342, y: 500 },
  actualMm: 842,
  requiredMm: 800,
  satisfied: true,
  zeroLength: false,
  label: "↔ Зазор 842 мм",
};

describe("deriveExactGapOverlayLayout", () => {
  it("converts witness points to screen space", () => {
    const layout = deriveExactGapOverlayLayout(annotation, viewport, { width: 900, height: 700 });
    expect(layout.first).toEqual(worldToScreen(annotation.firstPoint, viewport));
    expect(layout.second).toEqual(worldToScreen(annotation.secondPoint, viewport));
    expect(layout.zeroLength).toBe(false);
  });

  it("clamps the label inside the stage", () => {
    const edge = {
      ...annotation,
      firstPoint: { x: -1000, y: -1000 },
      secondPoint: { x: -900, y: -1000 },
    };
    const layout = deriveExactGapOverlayLayout(edge, viewport, { width: 320, height: 240 });
    expect(layout.label.x).toBeGreaterThanOrEqual(8);
    expect(layout.label.x + layout.labelWidth).toBeLessThanOrEqual(312);
    expect(layout.label.y).toBeGreaterThanOrEqual(8);
    expect(layout.label.y).toBeLessThanOrEqual(210);
  });

  it("offsets a zero-length contact label", () => {
    const contact = {
      ...annotation,
      firstPoint: { x: 500, y: 500 },
      secondPoint: { x: 500, y: 500 },
      actualMm: 0,
      zeroLength: true,
      label: "↔ Зазор 0 мм",
    };
    const layout = deriveExactGapOverlayLayout(contact, viewport, { width: 900, height: 700 });
    expect(layout.zeroLength).toBe(true);
    expect(layout.label.y).not.toBe(layout.first.y);
  });
});

describe("ExactGapOverlay source contract", () => {
  it("uses a distinct non-interactive exact-gap visual language", () => {
    const source = readFileSync(new URL("./exact-gap-overlay.tsx", import.meta.url), "utf8");
    expect(source).toContain("listening={false}");
    expect(source).toContain("dash={[7, 5]}");
    expect(source).toContain("#7c3aed");
    expect(source).toContain("pointerAtBeginning");
    expect(source).toContain("pointerAtEnding");
  });
});

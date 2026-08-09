import type { StructuralSnapResult } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import { deriveStructuralSnapOverlayModel } from "./structural-snap-overlay";

const viewport = { pixelsPerMillimeter: 0.1, offsetX: 20, offsetY: 30 } as const;

describe("M8.2 structural snap overlay", () => {
  it("projects only the active snap marker, guides and stable Russian label", () => {
    const snap: StructuralSnapResult = {
      candidateId: "vertex:a",
      point: { x: 1000, y: 1500 },
      kind: "endpoint",
      label: "Конечная точка",
      guides: [
        { kind: "point", point: { x: 1000, y: 1500 } },
        { kind: "axis", axis: "y", value: 1500 },
        { kind: "segment", start: { x: 0, y: 0 }, end: { x: 1000, y: 1500 } },
      ],
      target: { kind: "vertex", vertexId: "a", point: { x: 1000, y: 1500 } },
    };

    expect(deriveStructuralSnapOverlayModel(snap, viewport, { width: 1000, height: 700 })).toEqual({
      label: "Конечная точка",
      marker: { x: 120, y: 180 },
      guides: [
        { kind: "point", point: { x: 120, y: 180 } },
        { kind: "segment", start: { x: 0, y: 180 }, end: { x: 1000, y: 180 } },
        { kind: "segment", start: { x: 20, y: 30 }, end: { x: 120, y: 180 } },
      ],
    });
  });

  it.each([
    ["junction", "Соединение"],
    ["midpoint", "Середина"],
    ["intersection", "Пересечение"],
    ["wall-axis", "По стене"],
    ["parallel", "Параллельно"],
    ["perpendicular", "Перпендикулярно"],
    ["horizontal", "Горизонталь"],
    ["vertical", "Вертикаль"],
    ["grid", "Сетка"],
  ] as const)("preserves stable product vocabulary for %s", (kind, label) => {
    const snap: StructuralSnapResult = {
      candidateId: kind,
      point: { x: 0, y: 0 },
      kind,
      label,
      guides: [],
      target: null,
    };
    expect(deriveStructuralSnapOverlayModel(snap, viewport, { width: 100, height: 100 })?.label).toBe(label);
  });

  it("renders no overlay model for an unsnapped pointer", () => {
    expect(deriveStructuralSnapOverlayModel({
      candidateId: null,
      point: { x: 100, y: 200 },
      kind: "none",
      label: null,
      guides: [],
      target: null,
    }, viewport, { width: 1000, height: 700 })).toBeNull();
  });
});

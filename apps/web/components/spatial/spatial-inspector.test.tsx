import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SpatialInspector } from "./spatial-inspector";

describe("SpatialInspector", () => {
  it("shows authoritative room area and clear dimensions", () => {
    const html = renderToStaticMarkup(
      <SpatialInspector
        details={{
          kind: "room",
          id: "room",
          name: "Спальня",
          areaM2: 11.715,
          clearWidthMm: 3550,
          clearLengthMm: 3300,
        }}
        selected={false}
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Спальня");
    expect(html).toContain("11.72 м²");
    expect(html).toContain("3550 × 3300 мм");
    expect(html).toContain("Чистые внутренние размеры");
  });

  it("shows wall centreline semantics and thickness", () => {
    const html = renderToStaticMarkup(
      <SpatialInspector
        details={{
          kind: "wall",
          id: "wall",
          lengthMm: 3650,
          thicknessMm: 100,
          visibleSegmentCount: 2,
        }}
        selected
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Стена");
    expect(html).toContain("Длина по оси стены");
    expect(html).toContain("3650 мм");
    expect(html).toContain("Толщина");
    expect(html).toContain("100 мм");
    expect(html).toContain("2 видимых сегмента");
    expect(html).toContain("Снять выбор");
  });

  it("shows deterministic fit status and reasons for placed objects", () => {
    const html = renderToStaticMarkup(
      <SpatialInspector
        details={{
          kind: "placed-object",
          id: "sofa",
          name: "Диван",
          category: "seating",
          widthMm: 2200,
          depthMm: 900,
          heightMm: 850,
          heightWasDefaulted: false,
          rotationDeg: 90,
          fitStatus: "blocked",
          diagnostics: ["Пересекается с «Стол»."],
        }}
        selected
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Диван");
    expect(html).toContain("2200 × 900 × 850 мм");
    expect(html).toContain("Поворот: 90°");
    expect(html).toContain("Не влезает");
    expect(html).toContain("Пересекается с «Стол».");
  });

  it("labels projection-only default height honestly", () => {
    const html = renderToStaticMarkup(
      <SpatialInspector
        details={{
          kind: "placed-object",
          id: "custom",
          name: "Объект",
          category: "custom",
          widthMm: 1000,
          depthMm: 600,
          heightMm: 700,
          heightWasDefaulted: true,
          rotationDeg: 0,
          fitStatus: "fits",
          diagnostics: [],
        }}
        selected={false}
        onClear={() => {}}
      />,
    );

    expect(html).toContain("Высота 700 мм показана только для 3D");
    expect(html).toContain("Влезает");
  });
});

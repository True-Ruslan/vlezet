import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { FurnitureOrientationCue } from "./furniture-orientation-cue";

describe("FurnitureOrientationCue", () => {
  it("explains exact rotation, local sides, recommended and actual distances", () => {
    const html = renderToStaticMarkup(
      <FurnitureOrientationCue
        widthMm={1600}
        depthMm={600}
        rotationDeg={45}
        sides={{
          front: { recommendedMm: 800, actualMm: 620, invalid: false },
          right: { recommendedMm: 0, actualMm: null, invalid: false },
          back: { recommendedMm: 0, actualMm: 140, invalid: false },
          left: { recommendedMm: 0, actualMm: 500, invalid: true },
        }}
      />,
    );

    expect(html).toContain("Перед предмета");
    expect(html).toContain("Поворот 45°");
    expect(html).toContain("Рекомендуется 800 мм");
    expect(html).toContain("Свободно сейчас 620 мм");
    expect(html).toContain("Нет ближайшего препятствия");
    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain("rotate(45deg)");
  });
});

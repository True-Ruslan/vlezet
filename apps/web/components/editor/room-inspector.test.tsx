import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedRoomInspector } from "./wall-inspector";

const room = {
  id: "room",
  faceId: "face",
  polygon: [
    { x: 50, y: 50 },
    { x: 3600, y: 50 },
    { x: 3600, y: 3350 },
    { x: 50, y: 3350 },
  ],
  areaMm2: 11_715_000,
  areaM2: 11.715,
  labelPoint: { x: 1825, y: 1700 },
  name: "Комната",
} as const;

describe("room inspector precision semantics", () => {
  it("shows editable clear internal dimensions for a rectangular room", () => {
    const html = renderToStaticMarkup(<SelectedRoomInspector room={room} />);

    expect(html).toContain("Чистые внутренние размеры");
    expect(html).toContain("Ширина");
    expect(html).toContain("Длина");
    expect(html).toContain("3550");
    expect(html).toContain("3300");
    expect(html).toContain("Левая сторона");
    expect(html).toContain("Правая сторона");
    expect(html).toContain("Верхняя сторона");
    expect(html).toContain("Нижняя сторона");
    expect(html).toContain("11.71");
  });
});

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
  it("ties each editable value to a visible physical interior span", () => {
    const html = renderToStaticMarkup(<SelectedRoomInspector room={room} />);

    expect(html).toContain("Внутренние размеры");
    expect(html).toContain("По горизонтали");
    expect(html).toContain("По вертикали");
    expect(html.match(/между внутренними поверхностями стен/g)).toHaveLength(2);
    expect(html).toContain('id="room-clear-width"');
    expect(html).toContain('id="room-clear-height"');
    expect(html).toContain("Левая сторона");
    expect(html).toContain("Правая сторона");
    expect(html).toContain("Верхняя сторона");
    expect(html).toContain("Нижняя сторона");
    expect(html).toContain("Применить горизонтальный размер");
    expect(html).toContain("Применить вертикальный размер");
    expect(html).not.toContain("Применить ширину");
    expect(html).not.toContain("Применить длину");
    expect(html).toContain("11,72");
  });
});

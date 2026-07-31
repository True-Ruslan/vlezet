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
  it("uses shared fields and actions while preserving exact room controls", () => {
    const html = renderToStaticMarkup(<SelectedRoomInspector room={room} />);

    expect(html).toContain("Чистые внутренние размеры");
    expect(html).toContain("Ширина");
    expect(html).toContain("Длина");
    expect(html).toContain('id="room-name"');
    expect(html).toContain('id="room-clear-width"');
    expect(html).toContain('id="room-clear-height"');
    expect(html.match(/class="ui-field"/g)?.length).toBeGreaterThanOrEqual(5);
    expect(html).toContain('class="ui-button ui-button-primary room-inspector-action"');
    expect(html).toContain('class="ui-button ui-button-secondary room-inspector-action"');
    expect(html).toContain("Левая сторона");
    expect(html).toContain("Правая сторона");
    expect(html).toContain("Верхняя сторона");
    expect(html).toContain("Нижняя сторона");
    expect(html).toContain("11,72");
  });
});

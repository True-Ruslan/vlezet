import type { VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedWallInspector } from "./wall-inspector";

function simpleWallDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 3550, y: 0 } },
    ],
    walls: [
      { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("wall inspector precision semantics", () => {
  it("names centreline length explicitly and exposes fixed-anchor choices", () => {
    const document = simpleWallDocument();
    const wall = document.walls[0]!;
    const html = renderToStaticMarkup(<SelectedWallInspector document={document} wall={wall} />);

    expect(html).toContain("Длина по оси стены");
    expect(html).toContain("Что остаётся на месте");
    expect(html).toContain("Начало");
    expect(html).toContain("Центр");
    expect(html).toContain("Конец");
    expect(html).toContain("Это не всегда равно чистому внутреннему размеру комнаты");
    expect(html).not.toContain("Точная длина");
  });
});

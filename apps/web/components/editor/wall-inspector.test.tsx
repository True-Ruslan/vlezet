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

function rectangleDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
      { id: "d", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 100 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 100 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 100 },
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

  it("shows inside/center/outside thickness intent when the room side is unambiguous", () => {
    const document = rectangleDocument();
    const wall = document.walls.find((candidate) => candidate.id === "top")!;
    const html = renderToStaticMarkup(<SelectedWallInspector document={document} wall={wall} />);

    expect(html).toContain("Куда меняется толщина");
    expect(html).toContain("Внутрь помещения");
    expect(html).toContain("По центру");
    expect(html).toContain("Наружу");
  });

  it("does not guess inside/outside for a wall without an unambiguous room side", () => {
    const document = simpleWallDocument();
    const wall = document.walls[0]!;
    const html = renderToStaticMarkup(<SelectedWallInspector document={document} wall={wall} />);

    expect(html).toContain("Сохранить грань");
    expect(html).toContain("Левая грань");
    expect(html).toContain("Правая грань");
    expect(html).not.toContain("Внутрь помещения");
  });
});

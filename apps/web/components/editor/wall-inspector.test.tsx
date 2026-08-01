import type { VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedWallInspector } from "./wall-inspector";

function simpleWallDocument(reverse = false): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 3550, y: 0 } },
    ],
    walls: [
      {
        id: "wall",
        startVertexId: reverse ? "b" : "a",
        endVertexId: reverse ? "a" : "b",
        junctionVertexIds: [],
        thickness: 150,
      },
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
  it("names centreline length explicitly with stable visible endpoints", () => {
    const forwardDocument = simpleWallDocument();
    const reverseDocument = simpleWallDocument(true);
    const forward = renderToStaticMarkup(
      <SelectedWallInspector document={forwardDocument} wall={forwardDocument.walls[0]!} />,
    );
    const reverse = renderToStaticMarkup(
      <SelectedWallInspector document={reverseDocument} wall={reverseDocument.walls[0]!} />,
    );

    for (const html of [forward, reverse]) {
      expect(html).toContain("Длина по оси стены");
      expect(html).toContain("Что оставить на месте");
      expect(html).toContain("Левый конец");
      expect(html).toContain("Центр");
      expect(html).toContain("Правый конец");
      expect(html).toContain("Применить осевую длину");
      expect(html).toContain("Это не всегда равно чистому внутреннему размеру комнаты");
      expect(html).not.toContain(">Начало<");
      expect(html).not.toContain(">Конец<");
    }
  });

  it("shows fixed inside, axis and outside surfaces when room side is unambiguous", () => {
    const document = rectangleDocument();
    const wall = document.walls.find((candidate) => candidate.id === "top")!;
    const html = renderToStaticMarkup(<SelectedWallInspector document={document} wall={wall} />);

    expect(html).toContain("Что оставить на месте");
    expect(html).toContain("Внутренняя поверхность");
    expect(html).toContain("Ось стены");
    expect(html).toContain("Наружная поверхность");
    expect(html).not.toContain("Куда меняется толщина");
  });

  it("uses physical screen surfaces when inside and outside are ambiguous", () => {
    const document = simpleWallDocument();
    const wall = document.walls[0]!;
    const html = renderToStaticMarkup(<SelectedWallInspector document={document} wall={wall} />);

    expect(html).toContain("Верхняя поверхность");
    expect(html).toContain("Ось стены");
    expect(html).toContain("Нижняя поверхность");
    expect(html).not.toContain("Внутренняя поверхность");
    expect(html).not.toContain("Наружная поверхность");
  });
});

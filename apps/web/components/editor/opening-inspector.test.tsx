import type { VlezetDocument } from "@vlezet/domain";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SelectedOpeningInspector } from "./wall-inspector";

function openingDocument(kind: "door" | "window", reverse = false): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [{
      id: "wall",
      startVertexId: reverse ? "b" : "a",
      endVertexId: reverse ? "a" : "b",
      junctionVertexIds: [],
      thickness: 150,
    }],
    openings: [{
      id: "opening",
      wallId: "wall",
      kind,
      offset: 600,
      width: kind === "door" ? 900 : 1200,
      ...(kind === "door" ? { doorSwing: { hinge: "start" as const, side: "left" as const } } : {}),
    }],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("opening inspector physical semantics", () => {
  it("separates width, visible position reference and four door choices", () => {
    const document = openingDocument("door");
    const html = renderToStaticMarkup(
      <SelectedOpeningInspector
        document={document}
        wall={document.walls[0]!}
        opening={document.openings[0]!}
      />,
    );

    expect(html).toContain("Размер проёма");
    expect(html).toContain("Ширина проёма");
    expect(html).toContain("Положение на стене");
    expect(html).toContain("От левого конца");
    expect(html).toContain("От правого конца");
    expect(html).toContain("До проёма слева");
    expect(html).toContain("Направление двери");
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html).toContain("Применить параметры проёма");
    expect(html).not.toContain("От начала стены");
    expect(html).not.toContain("направления стены");
  });

  it("keeps visible reference labels stable for a reverse-directed wall", () => {
    const document = openingDocument("door", true);
    const html = renderToStaticMarkup(
      <SelectedOpeningInspector
        document={document}
        wall={document.walls[0]!}
        opening={document.openings[0]!}
      />,
    );

    expect(html).toContain("От левого конца");
    expect(html).toContain("От правого конца");
    expect(html).toContain("Петли справа, открывание вверх");
  });

  it("does not show door controls for a window", () => {
    const document = openingDocument("window");
    const html = renderToStaticMarkup(
      <SelectedOpeningInspector
        document={document}
        wall={document.walls[0]!}
        opening={document.openings[0]!}
      />,
    );

    expect(html).toContain("Размер проёма");
    expect(html).toContain("Положение на стене");
    expect(html).not.toContain("Направление двери");
    expect(html).not.toContain('role="radiogroup"');
  });
});

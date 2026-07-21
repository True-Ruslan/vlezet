import { describe, expect, it } from "vitest";
import { createEmptyDocument, createWall } from "./index";

describe("Vlezet document", () => {
  it("creates a schema-versioned empty document", () => {
    expect(createEmptyDocument()).toEqual({ schemaVersion: 1, walls: [] });
  });

  it("preserves wall geometry in exact millimetres", () => {
    expect(
      createWall({
        id: "wall-1",
        start: { x: 1250, y: -500 },
        end: { x: 4250, y: -500 },
        thickness: 180,
      }),
    ).toEqual({
      id: "wall-1",
      start: { x: 1250, y: -500 },
      end: { x: 4250, y: -500 },
      thickness: 180,
    });
  });
});

import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "./index";

describe("Vlezet document", () => {
  it("creates an empty schema-v2 topology document", () => {
    expect(createEmptyDocument()).toEqual({
      schemaVersion: 2,
      vertices: [],
      walls: [],
      openings: [],
      roomAnnotations: [],
    });
  });
});

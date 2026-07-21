import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "./index";

describe("Vlezet document", () => {
  it("creates an empty schema-v3 furnishing document", () => {
    expect(createEmptyDocument()).toEqual({
      schemaVersion: 3,
      vertices: [],
      walls: [],
      openings: [],
      roomAnnotations: [],
      placedObjects: [],
    });
  });
});

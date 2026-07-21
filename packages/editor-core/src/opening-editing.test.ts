import { describe, expect, it } from "vitest";
import type { VlezetDocumentV2 } from "@vlezet/domain";
import { addOpening, deleteOpening, updateOpening } from "./opening-editing";

function documentWithHost(): VlezetDocumentV2 {
  return {
    schemaVersion: 2,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "j", position: { x: 3000, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
    ],
    walls: [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 200 }],
    openings: [],
    roomAnnotations: [],
  };
}

describe("opening editing", () => {
  it("adds valid door and window openings to a stable semantic host wall", () => {
    const door = addOpening(documentWithHost(), {
      id: "door",
      wallId: "host",
      kind: "door",
      offset: 500,
      width: 900,
      doorSwing: { hinge: "start", side: "left" },
    });
    const windowed = addOpening(door, {
      id: "window",
      wallId: "host",
      kind: "window",
      offset: 4000,
      width: 1200,
    });

    expect(windowed.openings).toHaveLength(2);
    expect(windowed.openings.map((opening) => opening.wallId)).toEqual(["host", "host"]);
  });

  it("rejects missing hosts, out-of-bounds intervals, overlap and T-junction straddles", () => {
    const base = documentWithHost();
    expect(() => addOpening(base, { id: "x", wallId: "missing", kind: "window", offset: 0, width: 1000 })).toThrow();
    expect(() => addOpening(base, { id: "x", wallId: "host", kind: "window", offset: 5500, width: 1000 })).toThrow();
    expect(() => addOpening(base, { id: "x", wallId: "host", kind: "window", offset: 2500, width: 1000 })).toThrow(/соедин/i);

    const withDoor = addOpening(base, {
      id: "door",
      wallId: "host",
      kind: "door",
      offset: 500,
      width: 900,
      doorSwing: { hinge: "start", side: "left" },
    });
    expect(() => addOpening(withDoor, { id: "x", wallId: "host", kind: "window", offset: 1000, width: 1000 })).toThrow(/пересек/i);
  });

  it("updates and deletes an opening without changing its unrelated host topology", () => {
    const base = addOpening(documentWithHost(), {
      id: "door",
      wallId: "host",
      kind: "door",
      offset: 500,
      width: 900,
      doorSwing: { hinge: "start", side: "left" },
    });
    const updated = updateOpening(base, "door", {
      offset: 900,
      width: 1000,
      doorSwing: { hinge: "end", side: "right" },
    });
    expect(updated.openings[0]).toEqual({
      id: "door",
      wallId: "host",
      kind: "door",
      offset: 900,
      width: 1000,
      doorSwing: { hinge: "end", side: "right" },
    });
    expect(updated.walls).toEqual(base.walls);
    expect(deleteOpening(updated, "door").openings).toEqual([]);
  });

  it("keeps opening host and offset stable when host wall has derived junction subdivision", () => {
    const document = addOpening(documentWithHost(), {
      id: "window",
      wallId: "host",
      kind: "window",
      offset: 4000,
      width: 1000,
    });
    expect(document.openings[0]?.wallId).toBe("host");
    expect(document.openings[0]?.offset).toBe(4000);
    expect(document.walls[0]?.junctionVertexIds).toEqual(["j"]);
  });
});

import { createEmptyDocument, type VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import {
  evaluateStructuralVertexMove,
  evaluateStructuralWallTranslation,
  evaluateWallThicknessBatch,
} from "./structural-editing";
import { topologicalWallLength } from "./topology-editing";

function isolatedWallWithOpening(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
    ],
    walls: [
      { id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
    ],
    openings: [
      {
        id: "door",
        wallId: "wall",
        kind: "door",
        offset: 1000,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
  };
}

function cornerDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 4000, y: 0 } },
      { id: "c", position: { x: 4000, y: 3000 } },
    ],
    walls: [
      { id: "ab", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 },
      { id: "bc", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 150 },
    ],
  };
}

function tJunctionDocument(): VlezetDocument {
  return {
    ...createEmptyDocument(),
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 6000, y: 0 } },
      { id: "j", position: { x: 3000, y: 0 } },
      { id: "p", position: { x: 3000, y: 3000 } },
    ],
    walls: [
      { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 200 },
      { id: "branch", startVertexId: "j", endVertexId: "p", junctionVertexIds: [], thickness: 120 },
    ],
    openings: [
      {
        id: "branch-door",
        wallId: "branch",
        kind: "door",
        offset: 1000,
        width: 900,
        doorSwing: { hinge: "start", side: "left" },
      },
    ],
  };
}

function vertexPosition(document: VlezetDocument, id: string) {
  return document.vertices.find((vertex) => vertex.id === id)?.position;
}

function expectAccepted(result: ReturnType<typeof evaluateStructuralVertexMove>): VlezetDocument {
  expect(result.ok).toBe(true);
  if (!result.ok) throw new Error(result.reason);
  return result.document;
}

describe("M8.2 structural transaction authority", () => {
  it("moves a terminal vertex through one immutable accepted candidate", () => {
    const document = isolatedWallWithOpening();
    const before = structuredClone(document);

    const result = evaluateStructuralVertexMove(document, "b", { x: 4500, y: 500 });
    const updated = expectAccepted(result);

    expect(vertexPosition(updated, "b")).toEqual({ x: 4500, y: 500 });
    expect(result.affectedVertexIds).toEqual(["b"]);
    expect(result.affectedWallIds).toEqual(["wall"]);
    expect(document).toEqual(before);
  });

  it("moves one shared corner and keeps every incident wall connected to the same vertex", () => {
    const document = cornerDocument();
    const updated = expectAccepted(
      evaluateStructuralVertexMove(document, "b", { x: 4500, y: 500 }),
    );

    expect(vertexPosition(updated, "b")).toEqual({ x: 4500, y: 500 });
    expect(updated.walls.find((wall) => wall.id === "ab")?.endVertexId).toBe("b");
    expect(updated.walls.find((wall) => wall.id === "bc")?.startVertexId).toBe("b");
  });

  it("moves a declared T-junction along its host wall and preserves branch identity/opening offset", () => {
    const document = tJunctionDocument();
    const updated = expectAccepted(
      evaluateStructuralVertexMove(document, "j", { x: 3500, y: 0 }),
    );

    expect(vertexPosition(updated, "j")).toEqual({ x: 3500, y: 0 });
    expect(updated.walls.find((wall) => wall.id === "host")?.junctionVertexIds).toEqual(["j"]);
    expect(updated.walls.find((wall) => wall.id === "branch")?.startVertexId).toBe("j");
    expect(updated.openings.find((opening) => opening.id === "branch-door")?.offset).toBe(1000);
  });

  it("rejects a T-junction move off its host wall without mutating the document", () => {
    const document = tJunctionDocument();
    const before = structuredClone(document);

    const result = evaluateStructuralVertexMove(document, "j", { x: 3500, y: 400 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.code).toBe("topology");
    expect(result.reason).toMatch(/соедин|стен/i);
    expect(document).toEqual(before);
  });

  it("rejects collapse or reversal of an affected wall even when references remain syntactically valid", () => {
    const document = isolatedWallWithOpening();

    const collapsed = evaluateStructuralVertexMove(document, "b", { x: 0, y: 0 });
    expect(collapsed.ok).toBe(false);
    if (!collapsed.ok) expect(collapsed.code).toBe("topology");

    const reversed = evaluateStructuralVertexMove(document, "b", { x: -1000, y: 0 });
    expect(reversed.ok).toBe(false);
    if (!reversed.ok) expect(reversed.reason).toMatch(/развер|направ|схлоп/i);
  });

  it("rejects a vertex move that would leave a hosted opening outside its wall", () => {
    const document = isolatedWallWithOpening();
    const result = evaluateStructuralVertexMove(document, "b", { x: 1500, y: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) throw new Error("expected rejection");
    expect(result.code).toBe("opening");
    expect(result.reason).toMatch(/проём/i);
    expect(document.openings[0]?.offset).toBe(1000);
  });

  it("rigidly translates a wall and preserves its exact length and hosted-opening offset", () => {
    const document = isolatedWallWithOpening();
    const beforeLength = topologicalWallLength(document, "wall");

    const result = evaluateStructuralWallTranslation(document, "wall", { x: 250, y: 500 });
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(vertexPosition(result.document, "a")).toEqual({ x: 250, y: 500 });
    expect(vertexPosition(result.document, "b")).toEqual({ x: 4250, y: 500 });
    expect(topologicalWallLength(result.document, "wall")).toBe(beforeLength);
    expect(result.document.openings[0]?.offset).toBe(1000);
    expect(result.affectedVertexIds).toEqual(["a", "b"]);
  });

  it("translates host junctions with the target wall while reshaping only incident walls", () => {
    const document = tJunctionDocument();
    const result = evaluateStructuralWallTranslation(document, "host", { x: 0, y: 500 });

    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);
    expect(vertexPosition(result.document, "a")).toEqual({ x: 0, y: 500 });
    expect(vertexPosition(result.document, "b")).toEqual({ x: 6000, y: 500 });
    expect(vertexPosition(result.document, "j")).toEqual({ x: 3000, y: 500 });
    expect(vertexPosition(result.document, "p")).toEqual({ x: 3000, y: 3000 });
    expect(result.document.openings.find((opening) => opening.id === "branch-door")?.offset).toBe(1000);
  });

  it("rejects a wall translation when a moved vertex is constrained by an unrelated host", () => {
    const document: VlezetDocument = {
      ...createEmptyDocument(),
      vertices: [
        { id: "h0", position: { x: 0, y: 0 } },
        { id: "j", position: { x: 3000, y: 0 } },
        { id: "h1", position: { x: 6000, y: 0 } },
        { id: "p", position: { x: 3000, y: 2500 } },
      ],
      walls: [
        { id: "host", startVertexId: "h0", endVertexId: "h1", junctionVertexIds: ["j"], thickness: 200 },
        { id: "branch", startVertexId: "j", endVertexId: "p", junctionVertexIds: [], thickness: 120 },
      ],
    };

    const result = evaluateStructuralWallTranslation(document, "branch", { x: 500, y: 0 });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.code).toBe("topology");
      expect(result.reason).toMatch(/соедин|стен/i);
    }
  });

  it("applies centred wall thickness to every selected wall atomically", () => {
    const document = cornerDocument();
    const beforeVertices = structuredClone(document.vertices);

    const result = evaluateWallThicknessBatch(document, ["ab", "bc"], 320);
    expect(result.ok).toBe(true);
    if (!result.ok) throw new Error(result.reason);

    expect(result.document.walls.map((wall) => wall.thickness)).toEqual([320, 320]);
    expect(result.document.vertices).toEqual(beforeVertices);
    expect(result.affectedWallIds).toEqual(["ab", "bc"]);
  });

  it("rejects the whole thickness batch when one member or value is invalid", () => {
    const document = cornerDocument();
    const before = structuredClone(document);

    const missing = evaluateWallThicknessBatch(document, ["ab", "missing"], 300);
    expect(missing.ok).toBe(false);

    const invalidThickness = evaluateWallThicknessBatch(document, ["ab", "bc"], 20);
    expect(invalidThickness.ok).toBe(false);

    expect(document).toEqual(before);
    expect(document.walls.map((wall) => wall.thickness)).toEqual([200, 150]);
  });
});

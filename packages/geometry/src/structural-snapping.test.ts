import type { TopologyDocumentLike } from "./topology";
import { describe, expect, it } from "vitest";
import { resolveStructuralSnap } from "./structural-snapping";

function documentOf(
  vertices: TopologyDocumentLike["vertices"],
  walls: TopologyDocumentLike["walls"],
): TopologyDocumentLike {
  return { schemaVersion: 3, vertices, walls };
}

const EMPTY = documentOf([], []);

const baseInput = {
  gridStep: 25,
  acquisitionTolerance: 10,
  releaseTolerance: 18,
  replacementAdvantage: 1,
  snappingEnabled: true,
} as const;

describe("M8.2 semantic structural snapping", () => {
  it("prefers an existing endpoint over lower-priority construction aids", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 100, y: 0 } },
      ],
      [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );

    const result = resolveStructuralSnap({
      ...baseInput,
      document,
      rawPoint: { x: 7, y: 3 },
      startPoint: { x: 50, y: 50 },
    });

    expect(result).toMatchObject({
      kind: "endpoint",
      label: "Конечная точка",
      point: { x: 0, y: 0 },
      target: { kind: "vertex", vertexId: "a", point: { x: 0, y: 0 } },
    });
  });

  it("names a declared host-wall junction distinctly", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "j", position: { x: 50, y: 0 } },
        { id: "b", position: { x: 100, y: 0 } },
        { id: "c", position: { x: 50, y: 100 } },
      ],
      [
        { id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 150 },
        { id: "branch", startVertexId: "j", endVertexId: "c", junctionVertexIds: [], thickness: 100 },
      ],
    );

    expect(resolveStructuralSnap({ ...baseInput, document, rawPoint: { x: 52, y: 3 } })).toMatchObject({
      kind: "junction",
      label: "Соединение",
      point: { x: 50, y: 0 },
      target: { kind: "vertex", vertexId: "j" },
    });
  });

  it("materialises midpoint and wall-axis candidates against one host wall", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 100, y: 0 } },
      ],
      [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );

    expect(resolveStructuralSnap({ ...baseInput, document, rawPoint: { x: 51, y: 4 } })).toMatchObject({
      kind: "midpoint",
      label: "Середина",
      point: { x: 50, y: 0 },
      target: { kind: "wall", wallId: "wall", point: { x: 50, y: 0 } },
    });

    expect(resolveStructuralSnap({ ...baseInput, document, rawPoint: { x: 30, y: 4 } })).toMatchObject({
      kind: "wall-axis",
      label: "По стене",
      point: { x: 30, y: 0 },
      target: { kind: "wall", wallId: "wall", point: { x: 30, y: 0 } },
    });
  });

  it("offers an eligible construction-guide intersection with exactly one host wall", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 60, y: -30 } },
        { id: "b", position: { x: 60, y: 70 } },
      ],
      [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );

    expect(resolveStructuralSnap({
      ...baseInput,
      document,
      rawPoint: { x: 59, y: 3 },
      startPoint: { x: 0, y: 0 },
    })).toMatchObject({
      kind: "intersection",
      label: "Пересечение",
      point: { x: 60, y: 0 },
      target: { kind: "wall", wallId: "host", point: { x: 60, y: 0 } },
    });
  });

  it("does not invent an intersection target for an undeclared crossing of existing walls", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 0, y: 50 } },
        { id: "b", position: { x: 100, y: 50 } },
        { id: "c", position: { x: 50, y: 0 } },
        { id: "d", position: { x: 50, y: 100 } },
      ],
      [
        { id: "horizontal", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
        { id: "vertical", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 150 },
      ],
    );

    const result = resolveStructuralSnap({ ...baseInput, document, rawPoint: { x: 50, y: 50 } });
    // The crossing is also the midpoint of both walls, so the approved priority must
    // keep the existing midpoint snap rather than inventing an authoritative split.
    expect(result.kind).toBe("midpoint");
    expect(result.kind).not.toBe("intersection");
  });

  it("provides horizontal and vertical construction assistance without a reference wall", () => {
    expect(resolveStructuralSnap({
      ...baseInput,
      document: EMPTY,
      rawPoint: { x: 73, y: 4 },
      startPoint: { x: 0, y: 0 },
      gridStep: 0,
    })).toMatchObject({ kind: "horizontal", label: "Горизонталь", point: { x: 73, y: 0 }, target: null });

    expect(resolveStructuralSnap({
      ...baseInput,
      document: EMPTY,
      rawPoint: { x: 4, y: 73 },
      startPoint: { x: 0, y: 0 },
      gridStep: 0,
    })).toMatchObject({ kind: "vertical", label: "Вертикаль", point: { x: 0, y: 73 }, target: null });
  });

  it("provides deterministic parallel and perpendicular assistance from a nearby wall", () => {
    const horizontalReference = documentOf(
      [
        { id: "a", position: { x: 0, y: 15 } },
        { id: "b", position: { x: 100, y: 15 } },
      ],
      [{ id: "reference", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );

    expect(resolveStructuralSnap({
      ...baseInput,
      document: horizontalReference,
      rawPoint: { x: 70, y: 4 },
      startPoint: { x: 0, y: 0 },
      gridStep: 0,
    })).toMatchObject({ kind: "parallel", label: "Параллельно", target: null });

    const verticalReference = documentOf(
      [
        { id: "a", position: { x: 15, y: 0 } },
        { id: "b", position: { x: 15, y: 100 } },
      ],
      [{ id: "reference", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );

    expect(resolveStructuralSnap({
      ...baseInput,
      document: verticalReference,
      rawPoint: { x: 70, y: 4 },
      startPoint: { x: 0, y: 0 },
      gridStep: 0,
    })).toMatchObject({ kind: "perpendicular", label: "Перпендикулярно", target: null });
  });

  it("keeps an active same-priority candidate through jitter until another is materially closer", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 100, y: 100 } },
        { id: "b", position: { x: 106, y: 100 } },
      ],
      [],
    );

    const acquired = resolveStructuralSnap({ ...baseInput, document, rawPoint: { x: 101, y: 100 } });
    expect(acquired.target).toMatchObject({ kind: "vertex", vertexId: "a" });
    expect(acquired.candidateId).not.toBeNull();

    const jitter = resolveStructuralSnap({
      ...baseInput,
      document,
      rawPoint: { x: 103.2, y: 100 },
      activeCandidateId: acquired.candidateId,
    });
    expect(jitter.target).toMatchObject({ kind: "vertex", vertexId: "a" });

    const decisive = resolveStructuralSnap({
      ...baseInput,
      document,
      rawPoint: { x: 105, y: 100 },
      activeCandidateId: acquired.candidateId,
    });
    expect(decisive.target).toMatchObject({ kind: "vertex", vertexId: "b" });
  });

  it("falls back to grid and allows explicit snapping suppression", () => {
    expect(resolveStructuralSnap({ ...baseInput, document: EMPTY, rawPoint: { x: 43, y: 57 } })).toMatchObject({
      kind: "grid",
      label: "Сетка",
      point: { x: 50, y: 50 },
      target: null,
    });

    expect(resolveStructuralSnap({
      ...baseInput,
      document: EMPTY,
      rawPoint: { x: 43, y: 57 },
      snappingEnabled: false,
    })).toEqual({
      candidateId: null,
      kind: "none",
      label: null,
      point: { x: 43, y: 57 },
      guides: [],
      target: null,
    });
  });

  it("honours exclusion sets and never mutates input topology", () => {
    const document = documentOf(
      [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 100, y: 0 } },
      ],
      [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    );
    const before = structuredClone(document);

    const result = resolveStructuralSnap({
      ...baseInput,
      document,
      rawPoint: { x: 3, y: 2 },
      gridStep: 0,
      excludeVertexIds: new Set(["a"]),
      excludeWallIds: new Set(["wall"]),
    });

    expect(result.kind).toBe("none");
    expect(document).toEqual(before);
  });
});

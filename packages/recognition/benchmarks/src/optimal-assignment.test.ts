import { describe, expect, it } from "vitest";
import { solveOptimalAssignment, type AssignmentEdge } from "./optimal-assignment";

const cardinalityEdges: readonly AssignmentEdge[] = [
  { leftIndex: 0, rightIndex: 0, costKey: [0], tieKey: "a" },
  { leftIndex: 0, rightIndex: 1, costKey: [1], tieKey: "b" },
  { leftIndex: 1, rightIndex: 0, costKey: [1], tieKey: "c" },
];

describe("optimal benchmark assignment", () => {
  it("maximises cardinality before minimising cost", () => {
    expect(solveOptimalAssignment({ leftCount: 2, rightCount: 2, edges: cardinalityEdges }))
      .toEqual([
        { leftIndex: 0, rightIndex: 1 },
        { leftIndex: 1, rightIndex: 0 },
      ]);
  });

  it("is invariant to admissible-edge input order", () => {
    const forward = solveOptimalAssignment({ leftCount: 2, rightCount: 2, edges: cardinalityEdges });
    const reverse = solveOptimalAssignment({ leftCount: 2, rightCount: 2, edges: [...cardinalityEdges].reverse() });
    expect(reverse).toEqual(forward);
  });

  it("uses stable tie keys when cardinality and total cost are equal", () => {
    const edges: readonly AssignmentEdge[] = [
      { leftIndex: 0, rightIndex: 0, costKey: [1], tieKey: "z" },
      { leftIndex: 0, rightIndex: 1, costKey: [1], tieKey: "a" },
    ];
    expect(solveOptimalAssignment({ leftCount: 1, rightCount: 2, edges }))
      .toEqual([{ leftIndex: 0, rightIndex: 1 }]);
  });

  it("returns pairs sorted by left and right indices", () => {
    const edges: readonly AssignmentEdge[] = [
      { leftIndex: 1, rightIndex: 1, costKey: [0], tieKey: "b" },
      { leftIndex: 0, rightIndex: 0, costKey: [0], tieKey: "a" },
    ];
    expect(solveOptimalAssignment({ leftCount: 2, rightCount: 2, edges }))
      .toEqual([
        { leftIndex: 0, rightIndex: 0 },
        { leftIndex: 1, rightIndex: 1 },
      ]);
  });

  it("fails closed on invalid indices and non-finite costs", () => {
    expect(() => solveOptimalAssignment({
      leftCount: 1,
      rightCount: 1,
      edges: [{ leftIndex: 1, rightIndex: 0, costKey: [0], tieKey: "invalid" }],
    })).toThrow();
    expect(() => solveOptimalAssignment({
      leftCount: 1,
      rightCount: 1,
      edges: [{ leftIndex: 0, rightIndex: 0, costKey: [Number.NaN], tieKey: "invalid" }],
    })).toThrow();
  });
});

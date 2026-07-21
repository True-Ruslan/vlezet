import { describe, expect, it } from "vitest";
import { validateTopology } from "./diagnostics";

describe("topology diagnostics", () => {
  it("reports an undeclared X crossing instead of inventing connectivity", () => {
    const diagnostics = validateTopology({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 4000 } },
        { id: "c", position: { x: 0, y: 4000 } },
        { id: "d", position: { x: 4000, y: 0 } },
      ],
      walls: [
        { id: "one", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 },
        { id: "two", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 150 },
      ],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "undeclared-crossing", severity: "error", wallIds: ["one", "two"] }),
    );
  });

  it("reports an internal junction that is not on its host wall", () => {
    const diagnostics = validateTopology({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 0, y: 0 } },
        { id: "b", position: { x: 4000, y: 0 } },
        { id: "j", position: { x: 2000, y: 100 } },
      ],
      walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: ["j"], thickness: 150 }],
    });

    expect(diagnostics).toContainEqual(
      expect.objectContaining({ code: "junction-off-wall", severity: "error", wallIds: ["wall"], vertexIds: ["j"] }),
    );
  });

  it("reports missing vertex references and zero-length wall runs", () => {
    const missing = validateTopology({
      schemaVersion: 2,
      vertices: [{ id: "a", position: { x: 0, y: 0 } }],
      walls: [{ id: "wall", startVertexId: "a", endVertexId: "missing", junctionVertexIds: [], thickness: 150 }],
    });
    expect(missing.some((item) => item.code === "missing-vertex")).toBe(true);

    const zero = validateTopology({
      schemaVersion: 2,
      vertices: [
        { id: "a", position: { x: 10, y: 10 } },
        { id: "b", position: { x: 10, y: 10 } },
      ],
      walls: [{ id: "wall", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 150 }],
    });
    expect(zero.some((item) => item.code === "zero-length-wall")).toBe(true);
  });
});

import type { Opening, VlezetDocument } from "@vlezet/domain";
import { describe, expect, it } from "vitest";
import { evaluateHostedOpeningMove } from "./hosted-opening-move";

function documentWithOpening(input: Readonly<{
  end?: Readonly<{ x: number; y: number }>;
  opening?: Opening;
  extraOpenings?: readonly Opening[];
}> = {}): VlezetDocument {
  const opening = input.opening ?? {
    id: "door-a",
    wallId: "host",
    kind: "door",
    offset: 500,
    width: 900,
    doorSwing: { hinge: "start", side: "left" },
  };
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: input.end ?? { x: 6000, y: 0 } },
    ],
    walls: [{ id: "host", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 200 }],
    openings: [opening, ...(input.extraOpenings ?? [])],
    roomAnnotations: [],
    placedObjects: [],
  };
}

describe("evaluateHostedOpeningMove", () => {
  it("moves a door by projecting the pointer to its current horizontal host and preserves semantics", () => {
    const source = documentWithOpening();
    const sourceDoor = source.openings[0]!;
    const snapshot = structuredClone(source);

    const result = evaluateHostedOpeningMove(source, "door-a", { x: 3400, y: 700 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opening.offset).toBeCloseTo(2950, 6);
    expect(result.opening.wallId).toBe("host");
    expect(result.opening.kind).toBe("door");
    expect(result.opening.width).toBe(900);
    expect(result.opening.doorSwing).toEqual(sourceDoor.doorSwing);
    expect(result.changed).toBe(true);
    expect(source).toEqual(snapshot);
  });

  it("uses the same primitive for a window on a vertical host", () => {
    const source = documentWithOpening({
      end: { x: 0, y: 6000 },
      opening: { id: "window-a", wallId: "host", kind: "window", offset: 500, width: 1000 },
    });

    const result = evaluateHostedOpeningMove(source, "window-a", { x: 250, y: 3500 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opening.offset).toBeCloseTo(3000, 6);
    expect(result.opening.wallId).toBe("host");
    expect(result.opening.kind).toBe("window");
    expect(result.opening.width).toBe(1000);
  });

  it("projects correctly on an angled host", () => {
    const source = documentWithOpening({ end: { x: 6000, y: 6000 } });

    const result = evaluateHostedOpeningMove(source, "door-a", { x: 4000, y: 4000 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.opening.offset).toBeCloseTo(Math.hypot(4000, 4000) - 450, 6);
  });

  it("clamps requested movement to both physical host endpoints accounting for opening width", () => {
    const source = documentWithOpening();

    const beforeStart = evaluateHostedOpeningMove(source, "door-a", { x: -2000, y: 0 });
    expect(beforeStart.ok).toBe(true);
    if (beforeStart.ok) expect(beforeStart.opening.offset).toBe(0);

    const beyondEnd = evaluateHostedOpeningMove(source, "door-a", { x: 9000, y: 0 });
    expect(beyondEnd.ok).toBe(true);
    if (beyondEnd.ok) expect(beyondEnd.opening.offset).toBe(5100);
  });

  it("rejects overlap with another opening through the unchanged opening validator", () => {
    const source = documentWithOpening({
      extraOpenings: [{ id: "window-b", wallId: "host", kind: "window", offset: 2500, width: 1000 }],
    });

    const result = evaluateHostedOpeningMove(source, "door-a", { x: 3000, y: 0 });

    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.candidate).not.toBeNull();
    expect(result.reason).toMatch(/пересек/i);
  });

  it("reports zero movement as a valid no-op", () => {
    const source = documentWithOpening();
    const currentCenter = 500 + 900 / 2;

    const result = evaluateHostedOpeningMove(source, "door-a", { x: currentCenter, y: 900 });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.changed).toBe(false);
    expect(result.opening.offset).toBe(500);
  });

  it("fails closed for missing opening or missing host", () => {
    const source = documentWithOpening();
    expect(evaluateHostedOpeningMove(source, "missing", { x: 1000, y: 0 }).ok).toBe(false);

    const invalidHost: VlezetDocument = { ...source, walls: [] };
    expect(evaluateHostedOpeningMove(invalidHost, "door-a", { x: 1000, y: 0 }).ok).toBe(false);
  });
});

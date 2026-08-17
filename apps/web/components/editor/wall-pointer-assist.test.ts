import type { Point2, StructuralSnapKind, StructuralSnapResult } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";
import { resolveWallPointerAssist } from "./wall-pointer-assist";

function structural(kind: StructuralSnapKind, point: Point2 = { x: 100, y: 200 }): StructuralSnapResult {
  return {
    candidateId: kind === "none" ? null : `${kind}:candidate`,
    point,
    kind,
    label: kind === "none" ? null : kind,
    guides: [],
    target: ["endpoint", "junction"].includes(kind)
      ? { kind: "vertex", vertexId: "vertex-1", point }
      : ["midpoint", "intersection", "wall-axis"].includes(kind)
        ? { kind: "wall", wallId: "wall-1", point }
        : null,
  };
}

function source(
  reason: ReferenceSourceAssistResult["reason"] = "acquired",
  worldPoint: Point2 = { x: 111, y: 222 },
): ReferenceSourceAssistResult {
  const acquired = reason === "acquired";
  return {
    acquired,
    candidateId: acquired ? "line:v:55" : null,
    kind: acquired ? "line-center" : "none",
    sourcePoint: acquired ? { x: 55, y: 70 } : { x: 50, y: 70 },
    worldPoint,
    reason,
  };
}

const TOPOLOGY_KINDS: readonly StructuralSnapKind[] = [
  "endpoint",
  "junction",
  "midpoint",
  "intersection",
  "wall-axis",
];

const FALLBACK_KINDS: readonly StructuralSnapKind[] = [
  "parallel",
  "perpendicular",
  "horizontal",
  "vertical",
  "grid",
  "none",
];

describe("M8.4 wall pointer authority", () => {
  it.each(TOPOLOGY_KINDS)("keeps %s topology above an acquired source candidate", (kind) => {
    const ordinary = structural(kind);
    const decision = resolveWallPointerAssist({ structuralSnap: ordinary, sourceAssist: source() });

    expect(decision.authority).toBe("structural");
    expect(decision.point).toBe(ordinary.point);
    expect(decision.structuralSnap).toBe(ordinary);
    expect(decision.sourceAssist).toBeNull();
  });

  it.each(FALLBACK_KINDS)("lets an acquired source candidate beat %s fallback", (kind) => {
    const ordinary = structural(kind);
    const assisted = source("acquired", { x: 333, y: 444 });
    const decision = resolveWallPointerAssist({ structuralSnap: ordinary, sourceAssist: assisted });

    expect(decision.authority).toBe("source");
    expect(decision.point).toBe(assisted.worldPoint);
    expect(decision.structuralSnap).toBe(ordinary);
    expect(decision.sourceAssist).toBe(assisted);
    expect(decision.sourceAssist?.candidateId).toBe("line:v:55");
  });

  it.each(["ambiguous", "none", "disabled", "suppressed", "outside-reference"] as const)(
    "preserves the exact structural fallback when source result is %s",
    (reason) => {
      const ordinary = structural("grid", { x: 500, y: 600 });
      const decision = resolveWallPointerAssist({ structuralSnap: ordinary, sourceAssist: source(reason) });

      expect(decision.authority).toBe("structural");
      expect(decision.point).toBe(ordinary.point);
      expect(decision.structuralSnap).toBe(ordinary);
      expect(decision.sourceAssist).toBeNull();
    },
  );

  it("preserves ordinary behavior when no source result exists", () => {
    const ordinary = structural("horizontal");
    const decision = resolveWallPointerAssist({ structuralSnap: ordinary, sourceAssist: null });

    expect(decision).toEqual({
      authority: "structural",
      point: ordinary.point,
      structuralSnap: ordinary,
      sourceAssist: null,
    });
  });

  it("never turns a source candidate into a topology target", () => {
    const assisted = source();
    const decision = resolveWallPointerAssist({
      structuralSnap: structural("grid"),
      sourceAssist: assisted,
    });

    expect(decision.authority).toBe("source");
    expect(decision.structuralSnap.target).toBeNull();
    expect(decision.sourceAssist).toBe(assisted);
  });
});

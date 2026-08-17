import type { Point2, StructuralSnapKind, StructuralSnapResult } from "@vlezet/geometry";
import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";

const TOPOLOGY_KINDS: ReadonlySet<StructuralSnapKind> = new Set([
  "endpoint",
  "junction",
  "midpoint",
  "intersection",
  "wall-axis",
]);

export function isTopologyStructuralSnapKind(kind: StructuralSnapKind): boolean {
  return TOPOLOGY_KINDS.has(kind);
}

export type WallPointerAssistDecision = Readonly<{
  authority: "structural" | "source";
  point: Point2;
  structuralSnap: StructuralSnapResult;
  sourceAssist: ReferenceSourceAssistResult | null;
}>;

export type ResolveWallPointerAssistInput = Readonly<{
  structuralSnap: StructuralSnapResult;
  sourceAssist: ReferenceSourceAssistResult | null;
}>;

export function resolveWallPointerAssist(input: ResolveWallPointerAssistInput): WallPointerAssistDecision {
  if (isTopologyStructuralSnapKind(input.structuralSnap.kind) || !input.sourceAssist?.acquired) {
    return {
      authority: "structural",
      point: input.structuralSnap.point,
      structuralSnap: input.structuralSnap,
      sourceAssist: null,
    };
  }

  return {
    authority: "source",
    point: input.sourceAssist.worldPoint,
    structuralSnap: input.structuralSnap,
    sourceAssist: input.sourceAssist,
  };
}

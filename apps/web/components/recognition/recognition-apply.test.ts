import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import type { ReferencePlan } from "@vlezet/projects";
import type { RecognitionDraft, RecognitionWallCandidate } from "@vlezet/recognition";
import { planRecognitionApply } from "./recognition-apply";

const NOW = "2026-07-22T00:00:00.000Z";
const referencePlan: ReferencePlan = {
  assetId: "asset",
  referenceRevision: "revision",
  source: { kind: "image", originalMimeType: "image/png" },
  widthPx: 1000,
  heightPx: 500,
  transform: { originWorld: { x: 100, y: 200 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: { pointA: { x: 0, y: 0 }, pointB: { x: 500, y: 0 }, knownLengthMm: 1000, alignment: "horizontal" },
  display: { visible: true, opacity: 0.45, locked: true },
};

function draft(): RecognitionDraft {
  return {
    id: "draft", projectId: "project", referenceAssetId: "asset", referenceRevision: "revision", engineVersion: "1", status: "local-complete",
    walls: [{
      id: "wall-candidate", start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.2 }, estimatedThicknessPx: 75,
      confidence: "high", evidence: { localScore: 0.9, cloudScore: null, reasons: ["parallel-edges"] }, origin: "local", conflict: null,
    }],
    openings: [], roomLabels: [], diagnostics: [], decisions: { "wall-candidate": "accepted" }, source: { local: true, cloud: false }, createdAt: NOW, updatedAt: NOW,
  };
}

function wallCandidate(input: Readonly<{
  id: string;
  start: RecognitionWallCandidate["start"];
  end: RecognitionWallCandidate["end"];
  estimatedThicknessPx?: number;
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: input.start,
    end: input.end,
    estimatedThicknessPx: input.estimatedThicknessPx ?? 75,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function ids() {
  let index = 0;
  return (kind: "wall" | "vertex" | "opening") => `${kind}-${++index}`;
}

function wallEndpointsAt(plan: ReturnType<typeof planRecognitionApply>, wallIndex: number) {
  const wall = plan.document.walls[wallIndex]!;
  return {
    start: plan.document.vertices.find((vertex) => vertex.id === wall.startVertexId)!.position,
    end: plan.document.vertices.find((vertex) => vertex.id === wall.endVertexId)!.position,
  };
}

function wallEndpoints(plan: ReturnType<typeof planRecognitionApply>) {
  return wallEndpointsAt(plan, 0);
}

describe("recognition apply planning", () => {
  it("projects normalized image candidates through calibrated reference into millimetres", () => {
    const plan = planRecognitionApply({ draft: draft(), referencePlan, document: createEmptyDocument(), idFactory: ids() });
    expect(plan.document.walls).toHaveLength(1);
    const wall = plan.document.walls[0]!;
    const { start, end } = wallEndpoints(plan);
    expect(start).toEqual({ x: 300, y: 400 });
    expect(end).toEqual({ x: 1900, y: 400 });
    expect(wall.thickness).toBe(150);
    expect(plan.appliedCandidateIds).toEqual(["wall-candidate"]);
  });

  it("removes small raster skew from an almost-horizontal wall before creating real geometry", () => {
    const source = draft();
    const plan = planRecognitionApply({
      draft: {
        ...source,
        walls: [{ ...source.walls[0]!, start: { x: 0.1, y: 0.2 }, end: { x: 0.9, y: 0.212 } }],
      },
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids(),
    });
    const { start, end } = wallEndpoints(plan);
    expect(start.y).toBe(end.y);
    expect(start.y).toBeCloseTo(406, 6);
    expect(start.x).toBe(300);
    expect(end.x).toBe(1900);
  });

  it("preserves a genuinely diagonal recognized wall", () => {
    const source = draft();
    const plan = planRecognitionApply({
      draft: {
        ...source,
        walls: [{ ...source.walls[0]!, start: { x: 0.1, y: 0.2 }, end: { x: 0.7, y: 0.5 } }],
      },
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids(),
    });
    const { start, end } = wallEndpoints(plan);
    expect(start).toEqual({ x: 300, y: 400 });
    expect(end).toEqual({ x: 1500, y: 700 });
  });

  it("normalizes an implausibly thick raster cohort into architectural wall thicknesses", () => {
    const source = draft();
    const walls = [
      wallCandidate({ id: "thin", start: { x: 0.1, y: 0.1 }, end: { x: 0.9, y: 0.1 }, estimatedThicknessPx: 200 }),
      wallCandidate({ id: "median", start: { x: 0.1, y: 0.3 }, end: { x: 0.9, y: 0.3 }, estimatedThicknessPx: 400 }),
      wallCandidate({ id: "thick", start: { x: 0.1, y: 0.5 }, end: { x: 0.9, y: 0.5 }, estimatedThicknessPx: 600 }),
    ];
    const plan = planRecognitionApply({
      draft: {
        ...source,
        walls,
        decisions: { thin: "accepted", median: "accepted", thick: "accepted" },
      },
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids(),
    });

    expect(plan.document.walls.map((wall) => wall.thickness)).toEqual([80, 150, 230]);
    expect(Math.max(...plan.document.walls.map((wall) => wall.thickness))).toBeLessThanOrEqual(400);
  });

  it("canonicalizes connected near-axis candidates into one shared orthogonal topology", () => {
    const source = draft();
    const walls = [
      wallCandidate({ id: "upper-vertical", start: { x: 0.5, y: 0.1 }, end: { x: 0.5, y: 0.5 } }),
      wallCandidate({ id: "lower-vertical", start: { x: 0.508, y: 0.5 }, end: { x: 0.508, y: 0.9 } }),
      wallCandidate({ id: "horizontal", start: { x: 0.2, y: 0.506 }, end: { x: 0.504, y: 0.506 } }),
    ];
    const plan = planRecognitionApply({
      draft: {
        ...source,
        walls,
        decisions: { "upper-vertical": "accepted", "lower-vertical": "accepted", horizontal: "accepted" },
      },
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids(),
    });

    expect(plan.document.walls).toHaveLength(3);
    const upper = wallEndpointsAt(plan, 0);
    const lower = wallEndpointsAt(plan, 1);
    const horizontal = wallEndpointsAt(plan, 2);
    expect(upper.start.x).toBe(upper.end.x);
    expect(lower.start.x).toBe(lower.end.x);
    expect(horizontal.start.y).toBe(horizontal.end.y);
    expect(upper.start.x).toBe(lower.start.x);
    expect(upper.end).toEqual(lower.start);
    expect(horizontal.end).toEqual(lower.start);
  });

  it("refuses drafts from another reference revision", () => {
    expect(() => planRecognitionApply({ draft: { ...draft(), referenceRevision: "old" }, referencePlan, document: createEmptyDocument(), idFactory: ids() })).toThrow(/другой версии/i);
  });

  it("does not re-apply a wall already present in the document", () => {
    const first = planRecognitionApply({ draft: draft(), referencePlan, document: createEmptyDocument(), idFactory: ids() });
    const second = planRecognitionApply({ draft: draft(), referencePlan, document: first.document, idFactory: ids() });
    expect(second.document.walls).toHaveLength(1);
    expect(second.appliedCandidateIds).toEqual([]);
    expect(second.diagnostics[0]?.message).toMatch(/не добавлена повторно/i);
  });

  it("can attach a reviewed opening to a matching wall that already exists", () => {
    const first = planRecognitionApply({ draft: draft(), referencePlan, document: createEmptyDocument(), idFactory: ids() });
    const source = draft();
    const withDoor: RecognitionDraft = {
      ...source,
      openings: [{
        id: "door-candidate", kind: "door", hostWallCandidateId: "wall-candidate", center: { x: 0.5, y: 0.2 }, widthPx: 50, orientationDeg: 0,
        confidence: "medium", evidence: { localScore: 0.7, cloudScore: null, reasons: ["wall-gap", "door-arc-like-line"] }, origin: "local", conflict: null,
      }],
      decisions: { ...source.decisions, "door-candidate": "accepted" },
    };
    const second = planRecognitionApply({ draft: withDoor, referencePlan, document: first.document, idFactory: ids() });
    expect(second.document.walls).toHaveLength(1);
    expect(second.document.openings).toHaveLength(1);
    expect(second.appliedCandidateIds).toEqual(["door-candidate"]);
  });

  it("skips unknown openings until they are classified", () => {
    const source = draft();
    const withOpening: RecognitionDraft = {
      ...source,
      openings: [{
        id: "opening-candidate", kind: "unknown-opening", hostWallCandidateId: "wall-candidate", center: { x: 0.5, y: 0.2 }, widthPx: 50, orientationDeg: 0,
        confidence: "low", evidence: { localScore: 0.4, cloudScore: null, reasons: ["wall-gap"] }, origin: "local", conflict: null,
      }],
      decisions: { ...source.decisions, "opening-candidate": "accepted" },
    };
    const plan = planRecognitionApply({ draft: withOpening, referencePlan, document: createEmptyDocument(), idFactory: ids() });
    expect(plan.document.openings).toHaveLength(0);
    expect(plan.diagnostics.some((item) => item.candidateId === "opening-candidate" && /классифицировать/i.test(item.message))).toBe(true);
  });
});

import { describe, expect, it } from "vitest";
import { createEmptyDocument } from "@vlezet/domain";
import type { ReferencePlan } from "@vlezet/projects";
import type { RecognitionDraft } from "@vlezet/recognition";
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

function ids() {
  let index = 0;
  return (kind: "wall" | "vertex" | "opening") => `${kind}-${++index}`;
}

describe("recognition apply planning", () => {
  it("projects normalized image candidates through calibrated reference into millimetres", () => {
    const plan = planRecognitionApply({ draft: draft(), referencePlan, document: createEmptyDocument(), idFactory: ids() });
    expect(plan.document.walls).toHaveLength(1);
    const wall = plan.document.walls[0]!;
    const start = plan.document.vertices.find((vertex) => vertex.id === wall.startVertexId)!;
    const end = plan.document.vertices.find((vertex) => vertex.id === wall.endVertexId)!;
    expect(start.position).toEqual({ x: 300, y: 400 });
    expect(end.position).toEqual({ x: 1900, y: 400 });
    expect(wall.thickness).toBe(150);
    expect(plan.appliedCandidateIds).toEqual(["wall-candidate"]);
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

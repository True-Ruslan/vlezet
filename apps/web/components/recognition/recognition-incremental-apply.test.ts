import { createEmptyDocument } from "@vlezet/domain";
import type { ReferencePlan } from "@vlezet/projects";
import type {
  RecognitionDraft,
  RecognitionOpeningCandidate,
  RecognitionWallCandidate,
} from "@vlezet/recognition";
import { describe, expect, it } from "vitest";
import { planRecognitionApply } from "./recognition-apply";

const NOW = "2026-08-03T00:00:00.000Z";
const referencePlan: ReferencePlan = {
  assetId: "asset",
  referenceRevision: "revision",
  source: { kind: "image", originalMimeType: "image/png" },
  widthPx: 1000,
  heightPx: 500,
  transform: { originWorld: { x: 0, y: 0 }, millimetersPerPixel: 2, rotationDeg: 0 },
  calibration: {
    pointA: { x: 0, y: 0 },
    pointB: { x: 500, y: 0 },
    knownLengthMm: 1000,
    alignment: "horizontal",
  },
  display: { visible: true, opacity: 0.45, locked: true },
};

function wall(id: string, y: number): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y },
    end: { x: 0.9, y },
    estimatedThicknessPx: 75,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function opening(kind: RecognitionOpeningCandidate["kind"] = "door"): RecognitionOpeningCandidate {
  return {
    id: `${kind}-candidate`,
    kind,
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.2 },
    widthPx: 50,
    orientationDeg: 0,
    confidence: "high",
    evidence: { localScore: 0.9, cloudScore: null, reasons: ["wall-gap", "door-arc-like-line"] },
    origin: "local",
    conflict: null,
  };
}

function draft(input: Readonly<{
  walls?: readonly RecognitionWallCandidate[];
  openings?: readonly RecognitionOpeningCandidate[];
  accepted?: readonly string[];
}> = {}): RecognitionDraft {
  const walls = input.walls ?? [wall("wall-1", 0.2)];
  const openings = input.openings ?? [];
  const accepted = new Set(input.accepted ?? [...walls, ...openings].map((candidate) => candidate.id));
  return {
    id: "draft",
    projectId: "project",
    referenceAssetId: "asset",
    referenceRevision: "revision",
    engineVersion: "5",
    status: "local-complete",
    walls,
    openings,
    roomLabels: [],
    diagnostics: [],
    decisions: Object.fromEntries(
      [...walls, ...openings].map((candidate) => [candidate.id, accepted.has(candidate.id) ? "accepted" : "pending"]),
    ),
    source: { local: true, cloud: false },
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function ids(prefix: string) {
  let index = 0;
  return (kind: "wall" | "vertex" | "opening") => `${prefix}-${kind}-${++index}`;
}

describe("incremental recognition apply", () => {
  it("treats an equivalent already-applied door as an informational no-op", () => {
    const source = draft({ openings: [opening("door")] });
    const first = planRecognitionApply({
      draft: source,
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids("first"),
    });

    const second = planRecognitionApply({
      draft: source,
      referencePlan,
      document: first.document,
      idFactory: ids("second"),
    });

    expect(second.document).toEqual(first.document);
    expect(second.document.openings).toHaveLength(1);
    expect(second.appliedCandidateIds).toEqual([]);
    expect(second.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: "door-candidate",
      severity: "info",
      message: expect.stringMatching(/не добавлен повторно/i),
    }));
  });

  it("adds only a newly accepted wall in a second independent apply batch", () => {
    const wall1 = wall("wall-1", 0.2);
    const wall2 = wall("wall-2", 0.7);
    const first = planRecognitionApply({
      draft: draft({ walls: [wall1, wall2], accepted: [wall1.id] }),
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids("first"),
    });

    const second = planRecognitionApply({
      draft: draft({ walls: [wall1, wall2], accepted: [wall1.id, wall2.id] }),
      referencePlan,
      document: first.document,
      idFactory: ids("second"),
    });

    expect(first.document.walls).toHaveLength(1);
    expect(second.document.walls).toHaveLength(2);
    expect(second.appliedCandidateIds).toEqual(["wall-2"]);
    expect(second.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: "wall-1",
      severity: "info",
      message: expect.stringMatching(/не добавлена повторно/i),
    }));
  });

  it("rejects a different opening type that overlaps an existing applied opening", () => {
    const firstSource = draft({ openings: [opening("door")] });
    const first = planRecognitionApply({
      draft: firstSource,
      referencePlan,
      document: createEmptyDocument(),
      idFactory: ids("first"),
    });
    const conflicting = opening("window");

    const second = planRecognitionApply({
      draft: draft({ openings: [conflicting] }),
      referencePlan,
      document: first.document,
      idFactory: ids("second"),
    });

    expect(second.document.openings).toHaveLength(1);
    expect(second.appliedCandidateIds).toEqual([]);
    expect(second.diagnostics).toContainEqual(expect.objectContaining({
      candidateId: "window-candidate",
      severity: "warning",
      message: expect.stringMatching(/перекрывает существующий проём/i),
    }));
  });
});

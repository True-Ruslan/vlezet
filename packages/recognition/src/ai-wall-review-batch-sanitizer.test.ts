import { describe, expect, it } from "vitest";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import { AI_PROPOSAL_SCHEMA_VERSION, type AiProposalBatch } from "./ai-proposals";
import { sanitizeAiProposalBatch } from "./ai-proposal-sanity-runtime";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionDraft, RecognitionWallCandidate } from "./model";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(input: Readonly<{
  id: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  conflict?: RecognitionWallCandidate["conflict"];
  reasons?: readonly string[];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: 36,
    confidence: input.conflict ? "low" : "medium",
    evidence: {
      localScore: input.conflict ? 0.48 : 0.72,
      cloudScore: null,
      reasons: input.reasons ?? ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: input.conflict ?? null,
  };
}

function draft(): RecognitionDraft {
  const walls = [
    wall({ id: "anchor-left", x1: 450, y1: 80, x2: 450, y2: 300 }),
    wall({
      id: "wall-washbasin",
      x1: 450,
      y1: 300,
      x2: 550,
      y2: 300,
      conflict: "unsupported",
      reasons: ["filled-wall-region-evidence", "structural-clutter-veto"],
    }),
  ];
  return {
    id: "draft-wall-review-batch",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls,
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: Object.fromEntries(walls.map(({ id }) => [id, "pending"])),
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function evidence(localDraft: RecognitionDraft): RecognitionAiLocalEvidenceSnapshot {
  const target = localDraft.walls.find(({ id }) => id === "wall-washbasin")!;
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: ["anchor-left"],
    planBounds: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
    structuralMask: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural(x, y): boolean {
        return x >= 445 && x <= 555
          && ((y >= 282 && y <= 286) || (y >= 314 && y <= 318));
      },
    },
    doorEvidence: [],
    windowEvidence: [],
    clutterEvidence: [{
      wallCandidateId: target.id,
      reasonCodes: [...target.evidence.reasons],
    }],
  };
}

function batch(localDraft: RecognitionDraft): AiProposalBatch {
  return {
    schemaVersion: AI_PROPOSAL_SCHEMA_VERSION,
    requestId: "request-wall-review-batch",
    referenceRevision: localDraft.referenceRevision,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    proposals: [{
      id: "raw-wall-review-1",
      kind: "local-wall-review",
      targetWallCandidateId: "wall-washbasin",
      recommendation: "likely-clutter",
      sourceRegion: { x: 0.44, y: 0.45, width: 0.12, height: 0.1 },
      modelConfidence: 0.96,
      reasonCodes: [
        "sanitary-symbol-overlap",
        "weak-structural-mask-support",
        "short-clutter-profile",
      ],
    }],
    diagnostics: [],
  };
}

describe("AI wall review batch sanitation", () => {
  it("delegates an exact-ID washbasin advisory without mutating local geometry or decisions", () => {
    const localDraft = draft();
    const before = JSON.stringify(localDraft);
    const value = batch(localDraft);

    const result = sanitizeAiProposalBatch({
      batch: value,
      expectedIdentity: {
        requestId: value.requestId,
        referenceRevision: value.referenceRevision,
        localDraftFingerprint: value.localDraftFingerprint,
      },
      provider: {
        providerId: "openrouter-direct",
        modelId: "provider/model",
        requestId: value.requestId,
      },
      localDraft,
      localEvidence: evidence(localDraft),
    });

    expect(result.diagnostics).toEqual([]);
    expect(result.sanitized).toMatchObject([{
      rawProposalId: "raw-wall-review-1",
      kind: "local-wall-review",
      state: "eligible",
      geometry: null,
      targetLocalCandidateId: "wall-washbasin",
      deterministicConfidence: "low",
    }]);
    expect(JSON.stringify(localDraft)).toBe(before);
  });
});

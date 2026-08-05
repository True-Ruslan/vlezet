import { beforeEach, describe, expect, it } from "vitest";
import type { AiOpeningAdditionProposal, SanitizedRecognitionProposal } from "./ai-proposals";
import {
  clearAiRejectedOpeningEvidenceForDraft,
  createRejectedOpeningEvidenceTransfer,
  registerAiRejectedOpeningEvidenceForDraft,
} from "./ai-rejected-opening-evidence";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import { sanitizeAiOpeningProposal } from "./ai-opening-sanitizer-runtime";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import type { RecognitionDraft, RecognitionWallCandidate } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";

const WIDTH = 1000;
const HEIGHT = 500;

function wall(id = "wall-1", y = 0.5): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y },
    end: { x: 0.9, y },
    estimatedThicknessPx: 20,
    confidence: "high",
    evidence: { localScore: 0.91, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
    origin: "local",
    conflict: null,
  };
}

function draft(overrides: Partial<RecognitionDraft> = {}): RecognitionDraft {
  return {
    id: "draft-door-sanitizer",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [wall()],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
    ...overrides,
  };
}

function proposal(overrides: Partial<AiOpeningAdditionProposal> = {}): AiOpeningAdditionProposal {
  return {
    id: "raw-door-1",
    kind: "opening-addition",
    openingKind: "door",
    center: { x: 0.5, y: 0.5 },
    widthNormalized: 0.1,
    orientationDeg: 0,
    hostWallHintIds: ["wall-1"],
    sourceRegion: { x: 0.44, y: 0.42, width: 0.12, height: 0.16 },
    modelConfidence: 0.94,
    reasonCodes: ["visible-gap", "door-leaf"],
    ...overrides,
  };
}

function rejection(overrides: Partial<OpeningHypothesisRejection> = {}): OpeningHypothesisRejection {
  const candidate = {
    id: "local-rejected-door-1",
    kind: "door" as const,
    hostWallCandidateId: "wall-1",
    center: { x: 0.5, y: 0.5 },
    widthPx: 100,
    orientationDeg: 0,
    confidence: "low" as const,
    evidence: {
      localScore: 0.64,
      cloudScore: null,
      reasons: ["door-leaf-anchored", "wall-gap"],
    },
    origin: "local" as const,
    conflict: "invalid-host" as const,
  };
  return {
    candidateId: candidate.id,
    hostWallCandidateId: candidate.hostWallCandidateId,
    candidate,
    code: "opening-end-margin",
    message: "Локальная гипотеза не прошла один из строгих фильтров.",
    ...overrides,
  };
}

function evidence(
  localDraft: RecognitionDraft,
  structural: (x: number, y: number) => boolean = (x, y) =>
    y >= 245 && y <= 255 && (x < 445 || x > 555),
): RecognitionAiLocalEvidenceSnapshot {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: localDraft.walls.filter(({ conflict }) => conflict === null).map(({ id }) => id),
    planBounds: { x: 0.1, y: 0.45, width: 0.8, height: 0.1 },
    structuralMask: { widthPx: WIDTH, heightPx: HEIGHT, isStructural: structural },
    doorEvidence: [],
    windowEvidence: [],
    clutterEvidence: [],
  };
}

function registerRejections(localDraft: RecognitionDraft, rejections = [rejection()]): void {
  registerAiRejectedOpeningEvidenceForDraft(localDraft, createRejectedOpeningEvidenceTransfer({
    localDraft,
    rejections,
    analysisWidthPx: WIDTH,
    analysisHeightPx: HEIGHT,
    sourceWidthPx: WIDTH,
    sourceHeightPx: HEIGHT,
  }));
}

function sanitize(
  localDraft: RecognitionDraft,
  rawProposal = proposal(),
  localEvidence = evidence(localDraft),
  acceptedSiblingProposals: readonly SanitizedRecognitionProposal[] = [],
) {
  return sanitizeAiOpeningProposal({
    proposal: rawProposal,
    localDraft,
    localEvidence,
    provider: {
      providerId: "openrouter-direct",
      modelId: "provider/model",
      requestId: "request-door-1",
    },
    acceptedSiblingProposals,
  });
}

beforeEach(() => {
  clearAiRejectedOpeningEvidenceForDraft(draft());
});

describe("AI door proposal sanitizer", () => {
  it("authorizes a locally evidenced door through the common opening authority", () => {
    const localDraft = draft();
    registerRejections(localDraft);

    const result = sanitize(localDraft);

    expect(result).toMatchObject({
      kind: "door",
      state: "eligible",
      hostWallCandidateId: "wall-1",
      deterministicConfidence: "medium",
      geometry: {
        kind: "opening",
        center: { x: 0.5, y: 0.5 },
        widthNormalized: 0.1,
        orientationDeg: 0,
      },
      rawGeometry: {
        center: { x: 0.5, y: 0.5 },
        widthNormalized: 0.1,
        orientationDeg: 0,
      },
    });
    expect(result.evidence.validatorReasons).toEqual(expect.arrayContaining([
      "local-rejected-door-evidence-matched",
      "host-wall-validated",
      "opening-span-validated",
      "structural-gap-validated",
    ]));
  });

  it("blocks missing, unknown and ambiguous host selection", () => {
    const localDraft = draft({ walls: [wall(), wall("wall-2", 0.51)] });
    registerRejections(localDraft, [
      rejection(),
      rejection({
        candidateId: "local-rejected-door-2",
        hostWallCandidateId: "wall-2",
        candidate: {
          ...rejection().candidate,
          id: "local-rejected-door-2",
          hostWallCandidateId: "wall-2",
          center: { x: 0.5, y: 0.51 },
        },
      }),
    ]);

    expect(sanitize(localDraft, proposal({ hostWallHintIds: ["unknown"] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["unknown-host-wall-hint"] },
    });
    expect(sanitize(localDraft, proposal({ hostWallHintIds: ["wall-1", "wall-2"] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["ambiguous-host-wall"] },
    });
    expect(sanitize(localDraft, proposal({ hostWallHintIds: [] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["ambiguous-host-wall"] },
    });
  });

  it("blocks proposals outside the host span, at protected ends, or with invalid width/orientation", () => {
    const localDraft = draft();
    registerRejections(localDraft);

    expect(sanitize(localDraft, proposal({ center: { x: 0.97, y: 0.5 } }))).toMatchObject({ state: "blocked" });
    expect(sanitize(localDraft, proposal({ center: { x: 0.13, y: 0.5 }, widthNormalized: 0.06 }))).toMatchObject({ state: "blocked" });
    expect(sanitize(localDraft, proposal({ widthNormalized: 0.005 }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["invalid-opening-width"]) },
    });
    expect(sanitize(localDraft, proposal({ orientationDeg: 90 }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["opening-orientation-mismatch"]) },
    });
  });

  it("blocks absent or incompatible local door evidence", () => {
    const localDraft = draft();
    registerAiRejectedOpeningEvidenceForDraft(localDraft, createRejectedOpeningEvidenceTransfer({
      localDraft,
      rejections: [],
      analysisWidthPx: WIDTH,
      analysisHeightPx: HEIGHT,
      sourceWidthPx: WIDTH,
      sourceHeightPx: HEIGHT,
    }));
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["missing-local-door-evidence"] },
    });

    registerRejections(localDraft, [rejection({
      candidate: {
        ...rejection().candidate,
        evidence: { localScore: 0.64, cloudScore: null, reasons: ["sanitary-symbol-overlap"] },
      },
    })]);
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["forbidden-local-clutter-evidence"]) },
    });
  });

  it("blocks a structurally filled opening even when model confidence is one", () => {
    const localDraft = draft();
    registerRejections(localDraft);
    const fullyStructural = evidence(localDraft, (x, y) =>
      y >= 245 && y <= 255 && x >= 100 && x <= 900);

    expect(sanitize(localDraft, proposal({ modelConfidence: 1 }), fullyStructural)).toMatchObject({
      state: "blocked",
      deterministicConfidence: "low",
      evidence: { validatorReasons: expect.arrayContaining(["structural-mask-blocked"]) },
    });
  });

  it("blocks overlap with local openings or an already eligible sibling proposal", () => {
    const localDraft = draft({
      openings: [{
        id: "existing-door",
        kind: "door",
        hostWallCandidateId: "wall-1",
        center: { x: 0.53, y: 0.5 },
        widthPx: 80,
        orientationDeg: 0,
        confidence: "medium",
        evidence: { localScore: 0.8, cloudScore: null, reasons: ["host-wall-validated"] },
        origin: "local",
        conflict: null,
      }],
      decisions: { "wall-1": "pending", "existing-door": "pending" },
    });
    registerRejections(localDraft);
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["opening-overlap-existing"]) },
    });

    const noOpeningDraft = draft();
    registerRejections(noOpeningDraft);
    const sibling: SanitizedRecognitionProposal = {
      id: "sibling",
      rawProposalId: "raw-sibling",
      kind: "door",
      state: "eligible",
      geometry: { kind: "opening", center: { x: 0.53, y: 0.5 }, widthNormalized: 0.08, orientationDeg: 0 },
      targetLocalCandidateId: null,
      hostWallCandidateId: "wall-1",
      provider: { providerId: "openrouter-direct", modelId: "provider/model", requestId: "request-door-1" },
      modelConfidence: 0.8,
      deterministicConfidence: "medium",
      sourceRegion: { x: 0.48, y: 0.42, width: 0.1, height: 0.16 },
      evidence: { providerReasons: ["visible-gap"], validatorReasons: ["host-wall-validated"] },
      localDraftFingerprint: createLocalDraftFingerprint(noOpeningDraft),
    };
    expect(sanitize(noOpeningDraft, proposal(), evidence(noOpeningDraft), [sibling])).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["opening-overlap-sibling"]) },
    });
  });
});

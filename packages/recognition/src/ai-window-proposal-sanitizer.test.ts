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
import type { RecognitionDraft, RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";

const WIDTH = 1000;
const HEIGHT = 500;

type DraftOverrides = Readonly<{
  walls?: RecognitionDraft["walls"];
  openings?: RecognitionDraft["openings"];
  decisions?: RecognitionDraft["decisions"];
}>;

function wall(
  id = "wall-window",
  y = 0.08,
  reasons: readonly string[] = ["filled-wall-region-evidence", "exterior-boundary-host-bridge"],
): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y },
    end: { x: 0.9, y },
    estimatedThicknessPx: 20,
    confidence: "high",
    evidence: { localScore: 0.91, cloudScore: null, reasons },
    origin: "local",
    conflict: null,
  };
}

function draft(overrides: DraftOverrides = {}): RecognitionDraft {
  const walls = overrides.walls ?? [wall()];
  return {
    id: "draft-window-sanitizer",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls,
    openings: overrides.openings ?? [],
    roomLabels: [],
    diagnostics: [],
    decisions: overrides.decisions ?? Object.fromEntries(walls.map(({ id }) => [id, "pending"])),
    source: { local: true, cloud: false },
    createdAt: "2026-08-05T00:00:00.000Z",
    updatedAt: "2026-08-05T00:00:00.000Z",
  };
}

function proposal(overrides: Partial<AiOpeningAdditionProposal> = {}): AiOpeningAdditionProposal {
  return {
    id: "raw-window-1",
    kind: "opening-addition",
    openingKind: "window",
    center: { x: 0.5, y: 0.08 },
    widthNormalized: 0.12,
    orientationDeg: 0,
    hostWallHintIds: ["wall-window"],
    sourceRegion: { x: 0.43, y: 0.02, width: 0.14, height: 0.12 },
    modelConfidence: 0.96,
    reasonCodes: ["visible-gap", "parallel-window-rails", "exterior-boundary-context"],
    ...overrides,
  };
}

function rejection(overrides: Partial<OpeningHypothesisRejection> = {}): OpeningHypothesisRejection {
  const candidate = {
    id: "local-rejected-window-1",
    kind: "window" as const,
    hostWallCandidateId: "wall-window",
    center: { x: 0.5, y: 0.08 },
    widthPx: 120,
    orientationDeg: 0,
    confidence: "low" as const,
    evidence: {
      localScore: 0.66,
      cloudScore: null,
      reasons: ["wall-gap", "paired-window-rails", "paired-cross-lines"],
    },
    origin: "local" as const,
    conflict: "invalid-host" as const,
  };
  return {
    candidateId: candidate.id,
    hostWallCandidateId: candidate.hostWallCandidateId,
    candidate,
    code: "opening-end-margin",
    message: "Локальная оконная гипотеза не прошла один строгий фильтр.",
    ...overrides,
  };
}

function evidence(
  localDraft: RecognitionDraft,
  structural: (x: number, y: number) => boolean = (x, y) =>
    y >= 35 && y <= 45 && (x < 435 || x > 565),
): RecognitionAiLocalEvidenceSnapshot {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: localDraft.walls.filter(({ conflict }) => conflict === null).map(({ id }) => id),
    planBounds: { x: 0.1, y: 0.06, width: 0.8, height: 0.84 },
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
      requestId: "request-window-1",
    },
    acceptedSiblingProposals,
  });
}

beforeEach(() => {
  clearAiRejectedOpeningEvidenceForDraft(draft());
});

describe("AI window proposal sanitizer", () => {
  it("authorizes an exterior locally evidenced window through the common opening authority", () => {
    const localDraft = draft();
    registerRejections(localDraft);

    const result = sanitize(localDraft);

    expect(result).toMatchObject({
      kind: "window",
      state: "eligible",
      hostWallCandidateId: "wall-window",
      deterministicConfidence: "medium",
      geometry: {
        kind: "opening",
        center: { x: 0.5, y: 0.08 },
        widthNormalized: 0.12,
        orientationDeg: 0,
      },
      rawGeometry: {
        center: { x: 0.5, y: 0.08 },
        widthNormalized: 0.12,
        orientationDeg: 0,
      },
    });
    expect(result.evidence.validatorReasons).toEqual(expect.arrayContaining([
      "local-rejected-window-evidence-matched",
      "window-host-context-validated",
      "host-wall-validated",
      "opening-span-validated",
      "structural-gap-validated",
    ]));
  });

  it("returns duplicate for a geometric duplicate of an existing local window", () => {
    const existing: RecognitionOpeningCandidate = {
      id: "existing-window",
      kind: "window",
      hostWallCandidateId: "wall-window",
      center: { x: 0.505, y: 0.08 },
      widthPx: 118,
      orientationDeg: 0,
      confidence: "medium",
      evidence: { localScore: 0.82, cloudScore: null, reasons: ["paired-window-rails"] },
      origin: "local",
      conflict: null,
    };
    const localDraft = draft({
      openings: [existing],
      decisions: { "wall-window": "pending", "existing-window": "pending" },
    });

    expect(sanitize(localDraft)).toMatchObject({
      kind: "window",
      state: "duplicate",
      geometry: null,
      hostWallCandidateId: "wall-window",
      evidence: { validatorReasons: expect.arrayContaining(["opening-duplicate-existing"]) },
    });
  });

  it("does not reinterpret door evidence or an unexplained gap as a window", () => {
    const localDraft = draft();
    registerRejections(localDraft, [rejection({
      candidate: {
        ...rejection().candidate,
        kind: "door",
        evidence: { localScore: 0.66, cloudScore: null, reasons: ["wall-gap", "door-leaf-anchored"] },
      },
    })]);
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["window-evidence-is-door-classified"]) },
    });

    registerRejections(localDraft, [rejection({
      candidate: {
        ...rejection().candidate,
        kind: "unknown-opening",
        evidence: { localScore: 0.45, cloudScore: null, reasons: ["wall-gap"] },
      },
    })]);
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["missing-local-window-rail-evidence"]) },
    });
  });

  it("blocks an interior host without local exterior or balcony compatibility", () => {
    const interiorWall = wall("wall-window", 0.5, ["filled-wall-region-evidence"]);
    const localDraft = draft({ walls: [interiorWall] });
    registerRejections(localDraft, [rejection({
      candidate: { ...rejection().candidate, center: { x: 0.5, y: 0.5 } },
    })]);

    expect(sanitize(
      localDraft,
      proposal({ center: { x: 0.5, y: 0.5 }, sourceRegion: { x: 0.43, y: 0.42, width: 0.14, height: 0.16 } }),
      evidence(localDraft, (x, y) => y >= 245 && y <= 255 && (x < 435 || x > 565)),
    )).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["window-host-not-exterior-or-balcony-compatible"]) },
    });
  });

  it.each([
    ["single rail", ["wall-gap", "single-window-rail"], "missing-local-window-rail-evidence"],
    ["source frame", ["wall-gap", "paired-window-rails", "source-frame"], "forbidden-local-window-evidence"],
    ["dimension line", ["wall-gap", "paired-window-rails", "dimension-line"], "forbidden-local-window-evidence"],
    ["sanitary edge", ["wall-gap", "paired-window-rails", "sanitary-symbol-overlap"], "forbidden-local-window-evidence"],
  ])("blocks %s evidence", (_label, reasons, expectedReason) => {
    const localDraft = draft();
    registerRejections(localDraft, [rejection({
      candidate: {
        ...rejection().candidate,
        evidence: { localScore: 0.5, cloudScore: null, reasons },
      },
    })]);

    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining([expectedReason]) },
    });
  });

  it("blocks ambiguous hosts, endpoint violations and overlap with a door", () => {
    const secondWall = wall("wall-window-2", 0.09);
    const ambiguousDraft = draft({ walls: [wall(), secondWall] });
    registerRejections(ambiguousDraft);
    expect(sanitize(ambiguousDraft, proposal({ hostWallHintIds: ["wall-window", "wall-window-2"] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["ambiguous-host-wall"]) },
    });

    const endpointDraft = draft();
    registerRejections(endpointDraft, [rejection({
      candidate: {
        ...rejection().candidate,
        center: { x: 0.11, y: 0.08 },
        widthPx: 60,
      },
    })]);
    expect(sanitize(endpointDraft, proposal({
      center: { x: 0.11, y: 0.08 },
      widthNormalized: 0.06,
      sourceRegion: { x: 0.08, y: 0.02, width: 0.08, height: 0.12 },
    }))).toMatchObject({ state: "blocked" });

    const existingDoor: RecognitionOpeningCandidate = {
      id: "existing-door",
      kind: "door",
      hostWallCandidateId: "wall-window",
      center: { x: 0.51, y: 0.08 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "medium",
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["door-leaf-anchored"] },
      origin: "local",
      conflict: null,
    };
    const overlapDraft = draft({
      openings: [existingDoor],
      decisions: { "wall-window": "pending", "existing-door": "pending" },
    });
    registerRejections(overlapDraft);
    expect(sanitize(overlapDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: expect.arrayContaining(["opening-overlap-existing"]) },
    });
  });

  it("does not let model confidence bypass missing provider window evidence", () => {
    const localDraft = draft();
    registerRejections(localDraft);

    expect(sanitize(localDraft, proposal({
      modelConfidence: 1,
      reasonCodes: ["visible-gap", "exterior-boundary-context"],
    }))).toMatchObject({
      state: "blocked",
      deterministicConfidence: "low",
      evidence: { validatorReasons: expect.arrayContaining(["provider-window-evidence-incomplete"]) },
    });
  });
});

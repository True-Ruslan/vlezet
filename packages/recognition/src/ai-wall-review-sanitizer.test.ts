import { describe, expect, it } from "vitest";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import type { AiLocalWallReviewProposal } from "./ai-proposals";
import { sanitizeAiLocalWallReviewProposal } from "./ai-wall-review-sanitizer";
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
  confidence?: RecognitionWallCandidate["confidence"];
}>): RecognitionWallCandidate {
  return {
    id: input.id,
    start: { x: input.x1 / WIDTH, y: input.y1 / HEIGHT },
    end: { x: input.x2 / WIDTH, y: input.y2 / HEIGHT },
    estimatedThicknessPx: 36,
    confidence: input.confidence ?? (input.conflict ? "low" : "medium"),
    evidence: {
      localScore: input.conflict ? 0.48 : 0.72,
      cloudScore: null,
      reasons: input.reasons ?? ["filled-wall-region-evidence"],
    },
    origin: "local",
    conflict: input.conflict ?? null,
  };
}

function anchor(id = "anchor-left", x = 450): RecognitionWallCandidate {
  return wall({ id, x1: x, y1: 80, x2: x, y2: 300 });
}

function clutterWall(overrides: Partial<RecognitionWallCandidate> = {}): RecognitionWallCandidate {
  return {
    ...wall({
      id: "wall-washbasin",
      x1: 450,
      y1: 300,
      x2: 550,
      y2: 300,
      conflict: "unsupported",
      reasons: [
        "filled-wall-region-evidence",
        "structural-clutter-veto",
      ],
    }),
    ...overrides,
  };
}

function draft(input: Readonly<{
  target?: RecognitionWallCandidate;
  activeWalls?: readonly RecognitionWallCandidate[];
}> = {}): RecognitionDraft {
  const target = input.target ?? clutterWall();
  const activeWalls = input.activeWalls ?? [anchor()];
  const walls = [...activeWalls, target];
  return {
    id: "draft-wall-review",
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

function proposal(overrides: Partial<AiLocalWallReviewProposal> = {}): AiLocalWallReviewProposal {
  return {
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
    ...overrides,
  };
}

function lowSupport(x: number, y: number): boolean {
  return x >= 445 && x <= 555
    && ((y >= 282 && y <= 286) || (y >= 314 && y <= 318));
}

function evidence(
  localDraft: RecognitionDraft,
  overrides: Partial<RecognitionAiLocalEvidenceSnapshot> = {},
): RecognitionAiLocalEvidenceSnapshot {
  const target = localDraft.walls.find(({ id }) => id === "wall-washbasin");
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: localDraft.walls
      .filter(({ conflict }) => conflict === null)
      .map(({ id }) => id)
      .sort(),
    planBounds: { x: 0.08, y: 0.08, width: 0.84, height: 0.84 },
    structuralMask: {
      widthPx: WIDTH,
      heightPx: HEIGHT,
      isStructural: lowSupport,
    },
    doorEvidence: [],
    windowEvidence: [],
    clutterEvidence: target
      ? [{ wallCandidateId: target.id, reasonCodes: [...target.evidence.reasons] }]
      : [],
    ...overrides,
  };
}

function sanitize(
  localDraft: RecognitionDraft,
  rawProposal = proposal(),
  localEvidence = evidence(localDraft),
) {
  return sanitizeAiLocalWallReviewProposal({
    proposal: rawProposal,
    localDraft,
    localEvidence,
    provider: {
      providerId: "openrouter-direct",
      modelId: "provider/model",
      requestId: "request-wall-review-1",
    },
  });
}

describe("AI exact-ID wall review sanitizer", () => {
  it("authorizes a low-confidence advisory for an exact short washbasin clutter candidate", () => {
    const localDraft = draft();
    const before = JSON.stringify(localDraft);

    const result = sanitize(localDraft);

    expect(result).toMatchObject({
      rawProposalId: "raw-wall-review-1",
      kind: "local-wall-review",
      state: "eligible",
      geometry: null,
      targetLocalCandidateId: "wall-washbasin",
      hostWallCandidateId: null,
      deterministicConfidence: "low",
    });
    expect(result.evidence.validatorReasons).toEqual(expect.arrayContaining([
      "exact-local-wall-target-validated",
      "source-region-overlap-validated",
      "local-clutter-profile-validated",
      "weak-structural-support-validated",
      "single-anchor-or-less-validated",
    ]));
    expect(JSON.stringify(localDraft)).toBe(before);
  });

  it("blocks an unknown target and stale local evidence identity", () => {
    const localDraft = draft();
    expect(sanitize(localDraft, proposal({ targetWallCandidateId: "unknown-wall" }))).toMatchObject({
      state: "blocked",
      targetLocalCandidateId: "unknown-wall",
      evidence: { validatorReasons: ["unknown-local-wall-target"] },
    });

    const otherDraft = draft({ target: clutterWall({ id: "changed-wall-id" }) });
    expect(sanitize(localDraft, proposal(), evidence(localDraft, {
      localDraftFingerprint: createLocalDraftFingerprint(otherDraft),
    }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["stale-local-evidence-fingerprint"] },
    });
  });

  it("blocks a source region that does not overlap the exact target", () => {
    const localDraft = draft();
    expect(sanitize(localDraft, proposal({
      sourceRegion: { x: 0.7, y: 0.7, width: 0.1, height: 0.1 },
    }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["source-region-does-not-overlap-target"] },
    });
  });

  it("protects a long structural wall", () => {
    const target = clutterWall({
      start: { x: 0.2, y: 0.5 },
      end: { x: 0.8, y: 0.5 },
    });
    const localDraft = draft({ target });
    expect(sanitize(localDraft, proposal({
      sourceRegion: { x: 0.15, y: 0.45, width: 0.7, height: 0.1 },
    }))).toMatchObject({
      state: "blocked",
      deterministicConfidence: "low",
      evidence: { validatorReasons: ["protected-long-structural-wall"] },
    });
  });

  it("protects a strong mask-backed wall even when provider confidence is one", () => {
    const localDraft = draft();
    const strongMask = evidence(localDraft, {
      structuralMask: {
        widthPx: WIDTH,
        heightPx: HEIGHT,
        isStructural(x, y): boolean {
          return x >= 440 && x <= 560 && y >= 275 && y <= 325;
        },
      },
    });
    expect(sanitize(localDraft, proposal({ modelConfidence: 1 }), strongMask)).toMatchObject({
      state: "blocked",
      deterministicConfidence: "low",
      evidence: { validatorReasons: ["protected-strong-structural-mask"] },
    });
  });

  it("protects a two-anchor partition", () => {
    const localDraft = draft({
      activeWalls: [anchor(), anchor("anchor-right", 550)],
    });
    expect(sanitize(localDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["protected-two-anchor-wall"] },
    });
  });

  it("blocks candidates outside the bounded local clutter profile", () => {
    const activeTarget = clutterWall({
      conflict: null,
      confidence: "medium",
      evidence: {
        localScore: 0.72,
        cloudScore: null,
        reasons: ["filled-wall-region-evidence"],
      },
    });
    const localDraft = draft({ target: activeTarget });
    expect(sanitize(localDraft, proposal(), evidence(localDraft, { clutterEvidence: [] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["target-outside-local-clutter-profile"] },
    });

    const blockedWithoutLocalVeto = clutterWall({
      evidence: {
        localScore: 0.48,
        cloudScore: null,
        reasons: ["filled-wall-region-evidence"],
      },
    });
    const secondDraft = draft({ target: blockedWithoutLocalVeto });
    expect(sanitize(secondDraft)).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["target-outside-local-clutter-profile"] },
    });
  });

  it("requires a complete provider clutter explanation", () => {
    const localDraft = draft();
    expect(sanitize(localDraft, proposal({ reasonCodes: ["sanitary-symbol-overlap"] }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["provider-wall-review-evidence-incomplete"] },
    });
  });

  it("blocks unsupported delete or move instructions instead of mutating geometry", () => {
    const localDraft = draft();
    const before = JSON.stringify(localDraft);
    const unsafe = {
      ...proposal(),
      recommendation: "delete-wall",
    } as unknown as AiLocalWallReviewProposal;

    expect(sanitize(localDraft, unsafe)).toMatchObject({
      state: "blocked",
      geometry: null,
      deterministicConfidence: "low",
      evidence: { validatorReasons: ["unsupported-wall-review-recommendation"] },
    });
    expect(JSON.stringify(localDraft)).toBe(before);
  });

  it("blocks evidence with inconsistent mask dimensions or active wall identity", () => {
    const localDraft = draft();
    expect(sanitize(localDraft, proposal(), evidence(localDraft, {
      structuralMask: { widthPx: 500, heightPx: HEIGHT, isStructural: () => false },
    }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["invalid-local-evidence-dimensions"] },
    });
    expect(sanitize(localDraft, proposal(), evidence(localDraft, {
      activeWallIds: [],
    }))).toMatchObject({
      state: "blocked",
      evidence: { validatorReasons: ["stale-active-wall-identity"] },
    });
  });
});

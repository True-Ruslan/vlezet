import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import type { RecognitionAiLocalEvidenceSnapshot } from "./ai-local-evidence";
import {
  clearAiRejectedOpeningEvidenceForDraft,
  createRejectedOpeningEvidenceTransfer,
  registerAiRejectedOpeningEvidenceForDraft,
} from "./ai-rejected-opening-evidence";
import { sanitizeAiProposalBatch } from "./ai-proposal-sanity-runtime";
import {
  validateAiProposalBatch,
  type AiProposalBatch,
  type NormalizedBox,
  type SanitizedRecognitionProposal,
} from "./ai-proposals";
import { createLocalDraftFingerprint } from "./draft-fingerprint";
import { validateRecognitionDraft, type RecognitionDraft } from "./model";
import type { OpeningHypothesisRejection } from "./opening-analysis";

type RecordedExpectation = Readonly<{
  eligibleDoorsMinimum: number;
  eligibleWindowsMinimum: number;
  eligibleWashbasinAdvisory: boolean;
  eligibleUnknownHostOpenings: number;
  eligibleOutsideHostOpenings: number;
  directLocalMutationCount: number;
  staleDecisionCount: number;
  protectedStrongWallAdvisories: number;
  forbiddenRegionEligibleProposals: number;
  replayMismatchCount: number;
}>;

type RecordedFixture = Readonly<{
  id: string;
  responsePath: string;
  contextPath: string;
  expected: RecordedExpectation;
}>;

type RecordedManifest = Readonly<{
  fixtures: readonly RecordedFixture[];
}>;

type StructuralRegion = Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}>;

type RecordedContext = Readonly<{
  schemaVersion: "recognition-ai-proposal-context-v1";
  provider: Readonly<{ providerId: string; modelId: string }>;
  localDraft: RecognitionDraft;
  localEvidence: Readonly<{
    widthPx: number;
    heightPx: number;
    activeWallIds: readonly string[];
    planBounds: NormalizedBox | null;
    structuralRegions: readonly StructuralRegion[];
    doorEvidence: RecognitionAiLocalEvidenceSnapshot["doorEvidence"];
    windowEvidence: RecognitionAiLocalEvidenceSnapshot["windowEvidence"];
    clutterEvidence: RecognitionAiLocalEvidenceSnapshot["clutterEvidence"];
  }>;
  rejectedOpenings: readonly OpeningHypothesisRejection[];
  groundTruth: Readonly<{
    recoveredDoorProposalIds: readonly string[];
    recoveredWindowProposalIds: readonly string[];
    washbasinAdvisoryProposalIds: readonly string[];
    protectedStrongWallIds: readonly string[];
    forbiddenRegions: readonly NormalizedBox[];
  }>;
}>;

type ProposalEvaluation = Readonly<{
  recoveredDoorTruePositiveCount: number;
  recoveredDoorFalsePositiveCount: number;
  recoveredDoorFalseNegativeCount: number;
  recoveredWindowTruePositiveCount: number;
  recoveredWindowFalsePositiveCount: number;
  recoveredWindowFalseNegativeCount: number;
  eligibleWashbasinAdvisoryCount: number;
  sanitizerAcceptedCount: number;
  sanitizerTruePositiveCount: number;
  eligibleUnknownHostOpeningCount: number;
  eligibleOutsideHostOpeningCount: number;
  directLocalMutationCount: number;
  staleDecisionCount: number;
  protectedStrongWallAdvisoryCount: number;
  forbiddenRegionEligibleProposalCount: number;
  replayCount: number;
  replayMismatchCount: number;
}>;

const corpusRoot = new URL("../benchmarks/real-analogues/recorded-ai-proposals/", import.meta.url);
const manifest = JSON.parse(readFileSync(new URL("manifest.json", corpusRoot), "utf8")) as RecordedManifest;

function buildLocalEvidence(
  context: RecordedContext,
  draft: RecognitionDraft,
): RecognitionAiLocalEvidenceSnapshot {
  const regions = context.localEvidence.structuralRegions;
  return {
    widthPx: context.localEvidence.widthPx,
    heightPx: context.localEvidence.heightPx,
    localDraftFingerprint: createLocalDraftFingerprint(draft),
    activeWallIds: [...context.localEvidence.activeWallIds],
    planBounds: context.localEvidence.planBounds,
    structuralMask: {
      widthPx: context.localEvidence.widthPx,
      heightPx: context.localEvidence.heightPx,
      isStructural(x, y): boolean {
        return regions.some((region) =>
          x >= region.minimumX
          && x <= region.maximumX
          && y >= region.minimumY
          && y <= region.maximumY);
      },
    },
    doorEvidence: context.localEvidence.doorEvidence,
    windowEvidence: context.localEvidence.windowEvidence,
    clutterEvidence: context.localEvidence.clutterEvidence,
  };
}

function sanitizeRecorded(
  context: RecordedContext,
  draft: RecognitionDraft,
  batch: AiProposalBatch,
): readonly SanitizedRecognitionProposal[] {
  const result = sanitizeAiProposalBatch({
    batch,
    expectedIdentity: {
      requestId: batch.requestId,
      referenceRevision: batch.referenceRevision,
      localDraftFingerprint: batch.localDraftFingerprint,
    },
    provider: {
      providerId: context.provider.providerId,
      modelId: context.provider.modelId,
      requestId: batch.requestId,
    },
    localDraft: draft,
    localEvidence: buildLocalEvidence(context, draft),
  });
  expect(result.diagnostics.filter(({ severity }) => severity === "error")).toEqual([]);
  return result.sanitized;
}

function eligibleRawIds(
  proposals: readonly SanitizedRecognitionProposal[],
  kind: SanitizedRecognitionProposal["kind"],
): Set<string> {
  return new Set(proposals
    .filter((proposal) => proposal.state === "eligible" && proposal.kind === kind)
    .map(({ rawProposalId }) => rawProposalId));
}

function countSetIntersection(first: ReadonlySet<string>, second: ReadonlySet<string>): number {
  let count = 0;
  for (const value of first) if (second.has(value)) count += 1;
  return count;
}

function pointInsideBox(point: Readonly<{ x: number; y: number }>, box: NormalizedBox): boolean {
  return point.x >= box.x
    && point.x <= box.x + box.width
    && point.y >= box.y
    && point.y <= box.y + box.height;
}

function openingOutsideHost(
  proposal: SanitizedRecognitionProposal,
  draft: RecognitionDraft,
  widthPx: number,
  heightPx: number,
): boolean {
  if (proposal.kind === "local-wall-review" || !proposal.geometry || !proposal.hostWallCandidateId) return true;
  const host = draft.walls.find(({ id }) => id === proposal.hostWallCandidateId);
  if (!host) return true;
  const center = proposal.geometry.center;
  const dx = host.end.x - host.start.x;
  const dy = host.end.y - host.start.y;
  const lengthSquared = dx * dx + dy * dy;
  if (lengthSquared <= Number.EPSILON) return true;
  const projection = ((center.x - host.start.x) * dx + (center.y - host.start.y) * dy) / lengthSquared;
  if (projection < 0 || projection > 1) return true;
  const closest = { x: host.start.x + dx * projection, y: host.start.y + dy * projection };
  const distance = Math.hypot(center.x - closest.x, center.y - closest.y);
  const tolerance = Math.max(0.01, (host.estimatedThicknessPx ?? 20) / Math.min(widthPx, heightPx));
  return distance > tolerance;
}

function proposalPoint(
  proposal: SanitizedRecognitionProposal,
  draft: RecognitionDraft,
): Readonly<{ x: number; y: number }> | null {
  if (proposal.geometry) return proposal.geometry.center;
  if (!proposal.targetLocalCandidateId) return null;
  const target = draft.walls.find(({ id }) => id === proposal.targetLocalCandidateId);
  return target
    ? { x: (target.start.x + target.end.x) / 2, y: (target.start.y + target.end.y) / 2 }
    : null;
}

function evaluate(
  context: RecordedContext,
  draft: RecognitionDraft,
  batch: AiProposalBatch,
  first: readonly SanitizedRecognitionProposal[],
  second: readonly SanitizedRecognitionProposal[],
  beforeDraft: string,
): ProposalEvaluation {
  const eligible = first.filter(({ state }) => state === "eligible");
  const doors = eligibleRawIds(first, "door");
  const windows = eligibleRawIds(first, "window");
  const advisories = eligibleRawIds(first, "local-wall-review");
  const expectedDoors = new Set(context.groundTruth.recoveredDoorProposalIds);
  const expectedWindows = new Set(context.groundTruth.recoveredWindowProposalIds);
  const expectedAdvisories = new Set(context.groundTruth.washbasinAdvisoryProposalIds);
  const trueDoorCount = countSetIntersection(doors, expectedDoors);
  const trueWindowCount = countSetIntersection(windows, expectedWindows);
  const trueAdvisoryCount = countSetIntersection(advisories, expectedAdvisories);
  const eligibleOpenings = eligible.filter(({ kind }) => kind === "door" || kind === "window");
  const knownWalls = new Set(draft.walls.map(({ id }) => id));
  const protectedWalls = new Set(context.groundTruth.protectedStrongWallIds);

  return {
    recoveredDoorTruePositiveCount: trueDoorCount,
    recoveredDoorFalsePositiveCount: doors.size - trueDoorCount,
    recoveredDoorFalseNegativeCount: expectedDoors.size - trueDoorCount,
    recoveredWindowTruePositiveCount: trueWindowCount,
    recoveredWindowFalsePositiveCount: windows.size - trueWindowCount,
    recoveredWindowFalseNegativeCount: expectedWindows.size - trueWindowCount,
    eligibleWashbasinAdvisoryCount: trueAdvisoryCount,
    sanitizerAcceptedCount: eligible.length,
    sanitizerTruePositiveCount: trueDoorCount + trueWindowCount + trueAdvisoryCount,
    eligibleUnknownHostOpeningCount: eligibleOpenings.filter(({ hostWallCandidateId }) =>
      !hostWallCandidateId || !knownWalls.has(hostWallCandidateId)).length,
    eligibleOutsideHostOpeningCount: eligibleOpenings.filter((proposal) => openingOutsideHost(
      proposal,
      draft,
      context.localEvidence.widthPx,
      context.localEvidence.heightPx,
    )).length,
    directLocalMutationCount: JSON.stringify(draft) === beforeDraft ? 0 : 1,
    staleDecisionCount: eligible.filter((proposal) =>
      proposal.provider.requestId !== batch.requestId
      || proposal.localDraftFingerprint !== batch.localDraftFingerprint).length,
    protectedStrongWallAdvisoryCount: eligible.filter((proposal) =>
      proposal.kind === "local-wall-review"
      && proposal.targetLocalCandidateId !== null
      && protectedWalls.has(proposal.targetLocalCandidateId)).length,
    forbiddenRegionEligibleProposalCount: eligible.filter((proposal) => {
      const point = proposalPoint(proposal, draft);
      return point !== null && context.groundTruth.forbiddenRegions.some((region) => pointInsideBox(point, region));
    }).length,
    replayCount: 2,
    replayMismatchCount: JSON.stringify(first) === JSON.stringify(second) ? 0 : 1,
  };
}

describe("deterministic AI proposal benchmark contract", () => {
  it("replays recorded provider responses through the real sanitizer", () => {
    expect(manifest.fixtures.length).toBeGreaterThan(0);
    const output: Array<Readonly<{ fixtureId: string; proposalEvaluation: ProposalEvaluation }>> = [];

    for (const fixture of manifest.fixtures) {
      expect(fixture.contextPath, `${fixture.id} must declare contextPath`).toMatch(/^contexts\/[a-z0-9-]+\.json$/);
      const contextUrl = new URL(fixture.contextPath, corpusRoot);
      expect(existsSync(contextUrl), `${fixture.id} context must exist`).toBe(true);
      const context = JSON.parse(readFileSync(contextUrl, "utf8")) as RecordedContext;
      expect(context.schemaVersion).toBe("recognition-ai-proposal-context-v1");
      const draft = validateRecognitionDraft(context.localDraft);
      const batch = validateAiProposalBatch(JSON.parse(
        readFileSync(new URL(fixture.responsePath, corpusRoot), "utf8"),
      ));
      const fingerprint = createLocalDraftFingerprint(draft);
      expect(batch.referenceRevision).toBe(draft.referenceRevision);
      expect(batch.localDraftFingerprint).toBe(fingerprint);
      const beforeDraft = JSON.stringify(draft);

      clearAiRejectedOpeningEvidenceForDraft(draft);
      registerAiRejectedOpeningEvidenceForDraft(draft, createRejectedOpeningEvidenceTransfer({
        localDraft: draft,
        rejections: context.rejectedOpenings,
        analysisWidthPx: context.localEvidence.widthPx,
        analysisHeightPx: context.localEvidence.heightPx,
        sourceWidthPx: context.localEvidence.widthPx,
        sourceHeightPx: context.localEvidence.heightPx,
      }));
      const first = sanitizeRecorded(context, draft, batch);
      const second = sanitizeRecorded(context, draft, batch);
      clearAiRejectedOpeningEvidenceForDraft(draft);

      const evaluation = evaluate(context, draft, batch, first, second, beforeDraft);
      expect(first).toHaveLength(3);
      expect(first.every(({ state }) => state === "eligible")).toBe(true);
      expect(evaluation.recoveredDoorTruePositiveCount).toBeGreaterThanOrEqual(
        fixture.expected.eligibleDoorsMinimum,
      );
      expect(evaluation.recoveredWindowTruePositiveCount).toBeGreaterThanOrEqual(
        fixture.expected.eligibleWindowsMinimum,
      );
      expect(evaluation.eligibleWashbasinAdvisoryCount > 0).toBe(
        fixture.expected.eligibleWashbasinAdvisory,
      );
      expect(evaluation).toMatchObject({
        eligibleUnknownHostOpeningCount: fixture.expected.eligibleUnknownHostOpenings,
        eligibleOutsideHostOpeningCount: fixture.expected.eligibleOutsideHostOpenings,
        directLocalMutationCount: fixture.expected.directLocalMutationCount,
        staleDecisionCount: fixture.expected.staleDecisionCount,
        protectedStrongWallAdvisoryCount: fixture.expected.protectedStrongWallAdvisories,
        forbiddenRegionEligibleProposalCount: fixture.expected.forbiddenRegionEligibleProposals,
        replayMismatchCount: fixture.expected.replayMismatchCount,
      });
      output.push({ fixtureId: fixture.id, proposalEvaluation: evaluation });
    }

    const outputPath = process.env.AI_PROPOSAL_GATE_OUTPUT;
    if (outputPath) {
      writeFileSync(outputPath, `${JSON.stringify({
        schemaVersion: "recognition-ai-proposal-corpus-result-v1",
        fixtures: output,
      }, null, 2)}\n`);
    }
  });

  it("keeps recorded contexts and responses source-byte free", () => {
    for (const fixture of manifest.fixtures) {
      const serialized = [
        readFileSync(new URL(fixture.responsePath, corpusRoot), "utf8"),
        readFileSync(new URL(fixture.contextPath, corpusRoot), "utf8"),
      ].join("\n");
      expect(serialized).not.toMatch(/data:image|base64|private-raster|private-source|authorization|api[-_ ]?key/i);
    }
  });
});

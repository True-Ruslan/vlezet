import { describe, expect, it, vi } from "vitest";
import {
  createLocalDraftFingerprint,
  type RecognitionAiLocalEvidenceSnapshot,
  type ValidatedRecognitionDraft,
} from "@vlezet/recognition";
import {
  buildRecognitionAiProposalRequest,
  recognitionAiProposalImageInputs,
} from "./recognition-ai-request";
import type {
  RecognitionAiOverlayCanvas,
  RecognitionAiOverlayContext,
} from "./recognition-ai-overlay";

const NOW = "2026-08-05T00:00:00.000Z";

class RequestContext implements RecognitionAiOverlayContext {
  lineWidth = 1;
  strokeStyle: string | CanvasGradient | CanvasPattern = "";
  fillStyle: string | CanvasGradient | CanvasPattern = "";
  font = "";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";
  globalAlpha = 1;
  clearRect(): void {}
  beginPath(): void {}
  moveTo(): void {}
  lineTo(): void {}
  stroke(): void {}
  arc(): void {}
  fill(): void {}
  fillText(): void {}
  save(): void {}
  restore(): void {}
}

class RequestCanvas implements RecognitionAiOverlayCanvas {
  width = 0;
  height = 0;
  readonly context = new RequestContext();
  getContext(type: "2d"): RecognitionAiOverlayContext | null { return type === "2d" ? this.context : null; }
  toDataURL(): string { return "data:image/png;base64,T1ZFUkxBWQ=="; }
}

function draft(reverse = false): ValidatedRecognitionDraft {
  const walls = [
    {
      id: "wall-b",
      start: { x: 0.1, y: 0.7 },
      end: { x: 0.9, y: 0.7 },
      estimatedThicknessPx: 18,
      confidence: "medium" as const,
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local" as const,
      conflict: null,
    },
    {
      id: "wall-a",
      start: { x: 0.2, y: 0.2 },
      end: { x: 0.8, y: 0.2 },
      estimatedThicknessPx: 20,
      confidence: "high" as const,
      evidence: { localScore: 0.95, cloudScore: null, reasons: ["parallel-edges"] },
      origin: "local" as const,
      conflict: null,
    },
  ];
  const openings = [{
    id: "opening-door",
    kind: "door" as const,
    hostWallCandidateId: "wall-b",
    center: { x: 0.4, y: 0.7 },
    widthPx: 80,
    orientationDeg: 0,
    confidence: "medium" as const,
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["door-leaf", "host-wall-validated"] },
    origin: "local" as const,
    conflict: null,
  }];
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: reverse ? [...walls].reverse() : walls,
    openings,
    roomLabels: [],
    diagnostics: [],
    decisions: {},
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: NOW,
    updatedAt: NOW,
  };
}

function evidence(localDraft: ValidatedRecognitionDraft): RecognitionAiLocalEvidenceSnapshot {
  return {
    widthPx: 1200,
    heightPx: 800,
    localDraftFingerprint: createLocalDraftFingerprint(localDraft),
    activeWallIds: ["wall-a", "wall-b"],
    planBounds: { x: 0.1, y: 0.2, width: 0.8, height: 0.5 },
    structuralMask: {
      widthPx: 1200,
      heightPx: 800,
      isStructural: () => false,
    },
    doorEvidence: [{
      openingCandidateId: "opening-door",
      hostWallCandidateId: "wall-b",
      reasonCodes: ["door-leaf", "host-wall-validated"],
    }],
    windowEvidence: [],
    clutterEvidence: [],
  };
}

function build(localDraft = draft(), localEvidence = evidence(localDraft)) {
  return buildRecognitionAiProposalRequest({
    requestId: "request-1",
    sourceImageDataUrl: "data:image/png;base64,U09VUkNF",
    sourceImage: {} as CanvasImageSource,
    referenceRevision: "revision-1",
    localDraft,
    evidence: localEvidence,
    canvasFactory: () => new RequestCanvas(),
  });
}

describe("provider-neutral AI proposal request", () => {
  it("contains exact identity, dimensions, allowed kinds, evidence and hard budgets", () => {
    const localDraft = draft();
    const request = build(localDraft);
    expect(request).toMatchObject({
      mode: "proposal-discovery-stage1",
      requestId: "request-1",
      referenceRevision: "revision-1",
      localDraftFingerprint: createLocalDraftFingerprint(localDraft),
      imageWidthPx: 1200,
      imageHeightPx: 800,
      sourceImageDataUrl: "data:image/png;base64,U09VUkNF",
      overlayImageDataUrl: "data:image/png;base64,T1ZFUkxBWQ==",
      budgets: {
        allowedProposalKinds: ["door", "window", "local-wall-review"],
        maxOpeningProposals: 12,
        maxWallReviewProposals: 12,
        maxDiagnostics: 20,
        maxResponseBytes: 96 * 1024,
        maxTokens: 4096,
      },
    });
    expect(request.localSummary.activeWallIds).toEqual(["wall-a", "wall-b"]);
    expect(request.localSummary.walls.map((wall) => wall.id)).toEqual(["wall-a", "wall-b"]);
    expect(request.localSummary.doorEvidence).toEqual([{
      openingCandidateId: "opening-door",
      hostWallCandidateId: "wall-b",
      reasonCodes: ["door-leaf", "host-wall-validated"],
    }]);
  });

  it("produces exactly two downstream image_url inputs in source then overlay order", () => {
    expect(recognitionAiProposalImageInputs(build())).toEqual([
      { type: "image_url", image_url: { url: "data:image/png;base64,U09VUkNF" } },
      { type: "image_url", image_url: { url: "data:image/png;base64,T1ZFUkxBWQ==" } },
    ]);
  });

  it("keeps the structured summary canonical across local candidate array order", () => {
    const first = build(draft()).localSummary;
    const reversed = draft(true);
    const second = build(reversed, evidence(reversed)).localSummary;
    expect(second).toEqual(first);
  });

  it("fails closed on missing or mismatched evidence before rendering", () => {
    const canvasFactory = vi.fn(() => new RequestCanvas());
    expect(() => buildRecognitionAiProposalRequest({
      requestId: "request-1",
      sourceImageDataUrl: "data:image/png;base64,U09VUkNF",
      sourceImage: {} as CanvasImageSource,
      referenceRevision: "revision-1",
      localDraft: draft(),
      evidence: null as unknown as RecognitionAiLocalEvidenceSnapshot,
      canvasFactory,
    })).toThrow();
    expect(canvasFactory).not.toHaveBeenCalled();

    const localDraft = draft();
    expect(() => build(localDraft, {
      ...evidence(localDraft),
      localDraftFingerprint: "recognition-local-draft-v1:" + "b".repeat(64),
    })).toThrow();
  });

  it("rejects revision, dimension and unsafe image data mismatches with redacted errors", () => {
    const localDraft = draft();
    const unsafe = "data:text/plain;base64,SECRET_PAYLOAD";
    const calls = [
      () => buildRecognitionAiProposalRequest({
        requestId: "request-1",
        sourceImageDataUrl: "data:image/png;base64,U09VUkNF",
        sourceImage: {} as CanvasImageSource,
        referenceRevision: "revision-2",
        localDraft,
        evidence: evidence(localDraft),
        canvasFactory: () => new RequestCanvas(),
      }),
      () => build(localDraft, { ...evidence(localDraft), widthPx: 1199 }),
      () => buildRecognitionAiProposalRequest({
        requestId: "request-1",
        sourceImageDataUrl: unsafe,
        sourceImage: {} as CanvasImageSource,
        referenceRevision: "revision-1",
        localDraft,
        evidence: evidence(localDraft),
        canvasFactory: () => new RequestCanvas(),
      }),
    ];
    for (const call of calls) {
      try {
        call();
        throw new Error("expected failure");
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect((error as Error).message).not.toContain("SECRET_PAYLOAD");
        expect((error as Error).message).not.toContain("base64");
      }
    }
  });
});

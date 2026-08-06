"use client";

import {
  clearAiRejectedOpeningEvidenceForDraft,
  createLocalDraftFingerprint,
  createRejectedOpeningEvidenceTransfer,
  registerAiRejectedOpeningEvidenceForDraft,
  sanitizeAiProposalBatch,
  validateAiProposalBatch,
  validateRecognitionDraft,
  type AiProposalBatch,
  type NormalizedBox,
  type OpeningHypothesisRejection,
  type RecognitionAiLocalEvidenceSnapshot,
  type RecognitionAiProposalRequest,
  type RecognitionDiagnostic,
  type RecognitionDraft,
  type SanitizedRecognitionProposal,
} from "@vlezet/recognition";
import { useEffect } from "react";
import { buildRecognitionAiProposalRequest } from "./recognition-ai-request";
import {
  runLocalRecognitionEngine,
  type LocalRecognitionEngineDebug,
} from "./local-recognition-engine";
import { runLocalRecognition } from "./local-recognition-client";
import type { MaterializedLocalRecognitionInput } from "./local-recognition-types";

export type RecognitionBenchmarkDebugResult = Readonly<{
  draft: RecognitionDraft;
  debug: LocalRecognitionEngineDebug;
}>;

type StructuralRegion = Readonly<{
  minimumX: number;
  minimumY: number;
  maximumX: number;
  maximumY: number;
}>;

type RecognitionBenchmarkProposalContext = Readonly<{
  schemaVersion: "recognition-ai-proposal-context-v1";
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
}>;

type PreparedProposalState = Readonly<{
  request: RecognitionAiProposalRequest;
  draft: RecognitionDraft;
  evidence: RecognitionAiLocalEvidenceSnapshot;
  rejectedOpenings: readonly OpeningHypothesisRejection[];
}>;

export type RecognitionBenchmarkProposalSanitizeResult = Readonly<{
  first: readonly SanitizedRecognitionProposal[];
  second: readonly SanitizedRecognitionProposal[];
  firstDiagnostics: readonly RecognitionDiagnostic[];
  secondDiagnostics: readonly RecognitionDiagnostic[];
  draftUnchanged: boolean;
}>;

export type RecognitionBenchmarkHarnessApi = Readonly<{
  runEngine: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
  runEngineDebug: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionBenchmarkDebugResult>;
  runWorker: (input: MaterializedLocalRecognitionInput) => Promise<RecognitionDraft>;
  prepareProposal: (input: Readonly<{
    requestId: string;
    sourceImageDataUrl: string;
    context: RecognitionBenchmarkProposalContext;
  }>) => Promise<Readonly<{ request: RecognitionAiProposalRequest }>>;
  sanitizeProposal: (input: Readonly<{
    requestId: string;
    batch: AiProposalBatch;
    providerId: string;
    modelId: string;
  }>) => RecognitionBenchmarkProposalSanitizeResult;
}>;

declare global {
  interface Window {
    __vlezetRecognitionBenchmark?: RecognitionBenchmarkHarnessApi;
  }
}

const MAX_PREPARED_PROPOSALS = 8;

async function sourceCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  const response = await fetch(dataUrl);
  if (!response.ok) throw new Error("Benchmark source image is unavailable.");
  const bitmap = await createImageBitmap(await response.blob());
  try {
    const canvas = document.createElement("canvas");
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) throw new Error("Canvas 2D context is unavailable.");
    context.drawImage(bitmap, 0, 0);
    return canvas;
  } finally {
    bitmap.close();
  }
}

function localEvidence(
  context: RecognitionBenchmarkProposalContext,
  draft: RecognitionDraft,
): RecognitionAiLocalEvidenceSnapshot {
  const widthPx = context.localEvidence.widthPx;
  const heightPx = context.localEvidence.heightPx;
  const regions = context.localEvidence.structuralRegions;
  return {
    widthPx,
    heightPx,
    localDraftFingerprint: createLocalDraftFingerprint(draft),
    activeWallIds: [...context.localEvidence.activeWallIds],
    planBounds: context.localEvidence.planBounds,
    structuralMask: {
      widthPx,
      heightPx,
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

export function RecognitionBenchmarkHarness() {
  useEffect(() => {
    const prepared = new Map<string, PreparedProposalState>();
    const remember = (requestId: string, state: PreparedProposalState) => {
      prepared.delete(requestId);
      prepared.set(requestId, state);
      while (prepared.size > MAX_PREPARED_PROPOSALS) {
        const oldest = prepared.keys().next().value as string | undefined;
        if (!oldest) break;
        prepared.delete(oldest);
      }
    };

    const api: RecognitionBenchmarkHarnessApi = {
      runEngine: (input) => runLocalRecognitionEngine(input, { createDraftId: () => "benchmark-draft" }),
      runEngineDebug: async (input) => {
        let debug: LocalRecognitionEngineDebug | null = null;
        const draft = await runLocalRecognitionEngine(input, {
          createDraftId: () => "benchmark-draft",
          onDebug: (snapshot) => { debug = snapshot; },
        });
        if (!debug) throw new Error("Recognition engine did not emit a debug snapshot.");
        return { draft, debug };
      },
      runWorker: (input) => runLocalRecognition({
        ...input,
        sourceMillimetersPerPixel: input.sourceMillimetersPerPixel ?? undefined,
      }),
      prepareProposal: async ({ requestId, sourceImageDataUrl, context }) => {
        if (context.schemaVersion !== "recognition-ai-proposal-context-v1") {
          throw new Error("Unsupported live proposal context schema.");
        }
        const draft = validateRecognitionDraft(context.localDraft);
        const evidence = localEvidence(context, draft);
        const canvas = await sourceCanvas(sourceImageDataUrl);
        if (
          canvas.width !== evidence.widthPx
          || canvas.height !== evidence.heightPx
        ) {
          throw new Error("Public source dimensions do not match proposal evidence.");
        }
        const request = buildRecognitionAiProposalRequest({
          requestId,
          sourceImageDataUrl,
          sourceImage: canvas,
          sourceWidthPx: evidence.widthPx,
          sourceHeightPx: evidence.heightPx,
          referenceRevision: draft.referenceRevision,
          localDraft: draft,
          evidence,
        });
        remember(requestId, {
          request,
          draft,
          evidence,
          rejectedOpenings: context.rejectedOpenings,
        });
        return { request };
      },
      sanitizeProposal: ({ requestId, batch, providerId, modelId }) => {
        const state = prepared.get(requestId);
        if (!state) throw new Error("Prepared live proposal state is unavailable or expired.");
        prepared.delete(requestId);
        const validBatch = validateAiProposalBatch(batch);
        const before = JSON.stringify(state.draft);
        clearAiRejectedOpeningEvidenceForDraft(state.draft);
        registerAiRejectedOpeningEvidenceForDraft(state.draft, createRejectedOpeningEvidenceTransfer({
          localDraft: state.draft,
          rejections: state.rejectedOpenings,
          analysisWidthPx: state.evidence.widthPx,
          analysisHeightPx: state.evidence.heightPx,
          sourceWidthPx: state.evidence.widthPx,
          sourceHeightPx: state.evidence.heightPx,
        }));
        try {
          const sanitize = () => sanitizeAiProposalBatch({
            batch: validBatch,
            expectedIdentity: {
              requestId: state.request.requestId,
              referenceRevision: state.request.referenceRevision,
              localDraftFingerprint: state.request.localDraftFingerprint,
            },
            provider: {
              providerId,
              modelId,
              requestId: state.request.requestId,
            },
            localDraft: state.draft,
            localEvidence: state.evidence,
          });
          const first = sanitize();
          const second = sanitize();
          return {
            first: first.sanitized,
            second: second.sanitized,
            firstDiagnostics: first.diagnostics,
            secondDiagnostics: second.diagnostics,
            draftUnchanged: JSON.stringify(state.draft) === before,
          };
        } finally {
          clearAiRejectedOpeningEvidenceForDraft(state.draft);
        }
      },
    };
    window.__vlezetRecognitionBenchmark = api;
    return () => {
      prepared.clear();
      if (window.__vlezetRecognitionBenchmark === api) delete window.__vlezetRecognitionBenchmark;
    };
  }, []);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <h1>Recognition Benchmark Harness</h1>
      <p role="status">Ready</p>
      <p>This route exists only for deterministic browser benchmark execution.</p>
    </main>
  );
}

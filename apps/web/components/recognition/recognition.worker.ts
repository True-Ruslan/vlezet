/// <reference lib="webworker" />

import cvModule from "@techstark/opencv-js";
import {
  buildOpeningHypotheses,
  buildWallCandidates,
  createAdaptiveLocalRecognitionOptions,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  rescaleRecognitionPixelEvidence,
  sourceRasterPixelScale,
} from "@vlezet/recognition";
import type { DetectedLineSegment, RecognitionDraft, RecognitionWallCandidate } from "@vlezet/recognition";
import type { RecognitionWorkerMessage, RecognitionWorkerRequest } from "./local-recognition-types";
import { resolveOpenCvModule } from "./opencv-loader";

const context: DedicatedWorkerGlobalScope = self as DedicatedWorkerGlobalScope;
const MIN_STRICT_WALLS = 3;

function post(message: RecognitionWorkerMessage): void {
  context.postMessage(message);
}

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function markAdaptiveCandidates(candidates: readonly RecognitionWallCandidate[]): RecognitionWallCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    confidence: "medium",
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.68, 0.72),
      reasons: [...new Set([...candidate.evidence.reasons, "adaptive-physical-thresholds"])],
    },
  }));
}

async function recognize(request: RecognitionWorkerRequest): Promise<RecognitionDraft> {
  const { input, requestId } = request;
  post({ type: "progress", requestId, progress: { phase: "prepare", progress: 0.05 } });
  const { cv } = await resolveOpenCvModule(cvModule);
  let source: InstanceType<typeof cv.Mat> | null = null;
  let gray: InstanceType<typeof cv.Mat> | null = null;
  let blurred: InstanceType<typeof cv.Mat> | null = null;
  let edges: InstanceType<typeof cv.Mat> | null = null;
  let lines: InstanceType<typeof cv.Mat> | null = null;
  try {
    const rasterScale = sourceRasterPixelScale({
      analysisWidthPx: input.imageData.width,
      analysisHeightPx: input.imageData.height,
      sourceWidthPx: input.sourceWidthPx,
      sourceHeightPx: input.sourceHeightPx,
    });
    const analysisMillimetersPerPixel = input.sourceMillimetersPerPixel == null
      ? null
      : input.sourceMillimetersPerPixel * rasterScale;
    const adaptiveOptions = analysisMillimetersPerPixel == null
      ? null
      : createAdaptiveLocalRecognitionOptions({
          analysisMillimetersPerPixel,
          widthPx: input.imageData.width,
          heightPx: input.imageData.height,
        });

    source = cv.matFromImageData(input.imageData);
    gray = new cv.Mat();
    blurred = new cv.Mat();
    edges = new cv.Mat();
    lines = new cv.Mat();

    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, blurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
    post({ type: "progress", requestId, progress: { phase: "edges", progress: 0.25 } });
    cv.Canny(blurred, edges, 50, 150, 3, false);
    post({ type: "progress", requestId, progress: { phase: "lines", progress: 0.5 } });
    const houghMinimumLength = adaptiveOptions ? Math.round(adaptiveOptions.minimumSegmentLengthPx) : 40;
    const houghMaximumGap = adaptiveOptions ? Math.round(clamp(adaptiveOptions.collinearMergeGapPx / 3, 12, 36)) : 12;
    cv.HoughLinesP(edges, lines, 1, Math.PI / 180, 50, houghMinimumLength, houghMaximumGap);

    const segments: DetectedLineSegment[] = [];
    for (let row = 0; row < lines.rows; row += 1) {
      const offset = row * 4;
      segments.push({
        x1: lines.data32S[offset] ?? 0,
        y1: lines.data32S[offset + 1] ?? 0,
        x2: lines.data32S[offset + 2] ?? 0,
        y2: lines.data32S[offset + 3] ?? 0,
      });
    }

    post({ type: "progress", requestId, progress: { phase: "walls", progress: 0.72 } });
    const strictWalls = buildWallCandidates({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      segments,
    });
    let usedAdaptiveFallback = false;
    let analysisWalls = strictWalls;
    if (strictWalls.length < MIN_STRICT_WALLS && adaptiveOptions) {
      const adaptiveWalls = buildWallCandidates({
        widthPx: input.imageData.width,
        heightPx: input.imageData.height,
        segments,
        options: adaptiveOptions,
      });
      if (adaptiveWalls.length > strictWalls.length) {
        analysisWalls = markAdaptiveCandidates(adaptiveWalls);
        usedAdaptiveFallback = true;
      }
    }

    post({ type: "progress", requestId, progress: { phase: "openings", progress: 0.9 } });
    const analysisOpenings = buildOpeningHypotheses({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      wallCandidates: analysisWalls,
      segments,
    });
    const { walls, openings } = rescaleRecognitionPixelEvidence({
      walls: analysisWalls,
      openings: analysisOpenings,
      analysisWidthPx: input.imageData.width,
      analysisHeightPx: input.imageData.height,
      sourceWidthPx: input.sourceWidthPx,
      sourceHeightPx: input.sourceHeightPx,
    });

    const diagnostics = [];
    if (usedAdaptiveFallback) {
      diagnostics.push({
        code: "adaptive-local-fallback",
        severity: "info" as const,
        message: "Строгий локальный анализ нашёл мало стен, поэтому применены более гибкие пороги по физическому масштабу. Проверьте найденные линии перед применением.",
        candidateId: null,
      });
    }
    if (walls.length === 0) {
      diagnostics.push({
        code: "no-structural-walls",
        severity: "warning" as const,
        message: "Локальный CV не выделил стены уверенно. Можно сразу использовать AI-проверку или продолжить ручную обводку.",
        candidateId: null,
      });
    }

    const decisions = Object.fromEntries([...walls, ...openings].map((candidate) => [candidate.id, "pending" as const]));
    const draft: RecognitionDraft = {
      id: crypto.randomUUID(),
      projectId: input.projectId,
      referenceAssetId: input.referenceAssetId,
      referenceRevision: input.referenceRevision,
      engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
      status: "local-complete",
      walls,
      openings,
      roomLabels: [],
      diagnostics,
      decisions,
      source: { local: true, cloud: false },
      createdAt: input.now,
      updatedAt: input.now,
    };
    post({ type: "progress", requestId, progress: { phase: "complete", progress: 1 } });
    return draft;
  } finally {
    lines?.delete();
    edges?.delete();
    blurred?.delete();
    gray?.delete();
    source?.delete();
  }
}

context.onmessage = async (event: MessageEvent<RecognitionWorkerRequest>) => {
  const request = event.data;
  if (!request || request.type !== "recognize") return;
  try {
    post({ type: "result", requestId: request.requestId, draft: await recognize(request) });
  } catch (cause) {
    const message = cause instanceof Error ? cause.message : "Не удалось выполнить локальное распознавание.";
    post({ type: "error", requestId: request.requestId, message });
  }
};

export {};

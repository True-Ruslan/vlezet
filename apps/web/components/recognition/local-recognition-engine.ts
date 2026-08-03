import cvModule from "@techstark/opencv-js";
import {
  analyzeOpeningHypotheses,
  analyzeWallCandidates,
  buildLocalWallTopology,
  completeWallCenterlines,
  consolidateWindowHostWalls,
  createAdaptiveLocalRecognitionOptions,
  DEFAULT_WALL_COMPLETION_OPTIONS,
  extractStructuralWallRegions,
  LOCAL_RECOGNITION_ENGINE_VERSION,
  rescaleRecognitionPixelEvidence,
  sourceRasterPixelScale,
  topologyWallCandidates,
} from "@vlezet/recognition";
import type {
  DetectedLineSegment,
  LocalRecognitionOptions,
  LocalWallTopology,
  RecognitionDraft,
  RecognitionWallCandidate,
} from "@vlezet/recognition";
import type { LocalRecognitionProgress, MaterializedLocalRecognitionInput } from "./local-recognition-types";
import { resolveOpenCvModule } from "./opencv-loader";

const MIN_STRICT_WALLS = 3;
const MIN_STRUCTURAL_REGIONS = 3;

export type LocalRecognitionWallStageDebug = Readonly<{
  normalisedSegmentCount: number;
  pairedCenterlineCount: number;
  topologyEdgeCount: number;
  topologyJunctionCount: number;
  topologyDiagnostics: readonly string[];
}>;

export type LocalRecognitionEngineDebug = Readonly<{
  structuralRegionCount: number;
  rawSegmentCount: number;
  strictUniqueSegmentCount: number;
  uniqueSegmentCount: number;
  strict: LocalRecognitionWallStageDebug;
  adaptive: LocalRecognitionWallStageDebug | null;
  selectedMode: "regions" | "strict" | "adaptive";
  completionAcceptedCount: number;
  completionDiagnosticCodes: readonly string[];
}>;

export type LocalRecognitionEngineOptions = Readonly<{
  onProgress?: (progress: LocalRecognitionProgress) => void;
  onDebug?: (debug: LocalRecognitionEngineDebug) => void;
  createDraftId?: () => string;
}>;

function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

function oddKernelSize(shortSidePx: number): number {
  const rounded = Math.round(clamp(shortSidePx * 0.006, 3, 9));
  return rounded % 2 === 0 ? rounded + 1 : rounded;
}

function imageRelativeAdaptiveOptions(widthPx: number, heightPx: number): LocalRecognitionOptions {
  const shortSide = Math.min(widthPx, heightPx);
  return {
    minimumSegmentLengthPx: clamp(shortSide * 0.018, 18, 60),
    maximumAngleDeltaDeg: 7,
    minimumWallThicknessPx: 3,
    maximumWallThicknessPx: clamp(shortSide * 0.18, 90, 320),
    minimumParallelOverlapRatio: 0.22,
    collinearMergeGapPx: clamp(shortSide * 0.04, 24, 120),
    collinearOffsetTolerancePx: clamp(shortSide * 0.008, 4, 18),
    axisToleranceDeg: 10,
    duplicateEndpointTolerancePx: clamp(shortSide * 0.003, 1.5, 5),
    borderMarginPx: clamp(shortSide * 0.008, 3, 12),
    borderSpanRatio: 0.95,
    endpointSnapTolerancePx: clamp(shortSide * 0.018, 6, 24),
    endpointExtensionTolerancePx: clamp(shortSide * 0.032, 10, 42),
    intersectionTolerancePx: clamp(shortSide * 0.008, 2, 12),
    minimumTopologyEdgeLengthPx: clamp(shortSide * 0.015, 10, 40),
  };
}

function canonicalSegment(segment: DetectedLineSegment): DetectedLineSegment {
  if (segment.x1 < segment.x2 || (segment.x1 === segment.x2 && segment.y1 <= segment.y2)) return segment;
  return { x1: segment.x2, y1: segment.y2, x2: segment.x1, y2: segment.y1 };
}

function quantize(value: number, tolerancePx: number): number {
  return Math.round(value / tolerancePx);
}

function deduplicateDetectedSegments(
  segments: readonly DetectedLineSegment[],
  tolerancePx: number,
): DetectedLineSegment[] {
  const grouped = new Map<string, {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    count: number;
  }>();
  for (const source of segments) {
    if (![source.x1, source.y1, source.x2, source.y2].every(Number.isFinite)) continue;
    const segment = canonicalSegment(source);
    const key = [
      quantize(segment.x1, tolerancePx),
      quantize(segment.y1, tolerancePx),
      quantize(segment.x2, tolerancePx),
      quantize(segment.y2, tolerancePx),
    ].join(":");
    const existing = grouped.get(key);
    if (existing) {
      existing.x1 += segment.x1;
      existing.y1 += segment.y1;
      existing.x2 += segment.x2;
      existing.y2 += segment.y2;
      existing.count += 1;
    } else {
      grouped.set(key, { ...segment, count: 1 });
    }
  }
  return [...grouped.values()]
    .map((entry): DetectedLineSegment => ({
      x1: entry.x1 / entry.count,
      y1: entry.y1 / entry.count,
      x2: entry.x2 / entry.count,
      y2: entry.y2 / entry.count,
    }))
    .sort((first, second) =>
      first.x1 - second.x1
      || first.y1 - second.y1
      || first.x2 - second.x2
      || first.y2 - second.y2);
}

function markAdaptiveCandidates(candidates: readonly RecognitionWallCandidate[]): RecognitionWallCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    confidence: "medium",
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.68, 0.72),
      reasons: [...new Set([...candidate.evidence.reasons, "adaptive-thresholds"])],
    },
  }));
}

function markRegionCandidates(candidates: readonly RecognitionWallCandidate[]): RecognitionWallCandidate[] {
  return candidates.map((candidate) => ({
    ...candidate,
    confidence: candidate.confidence === "low" ? "low" : "medium",
    evidence: {
      ...candidate.evidence,
      localScore: Math.min(candidate.evidence.localScore ?? 0.74, 0.74),
      reasons: [...new Set([...candidate.evidence.reasons, "filled-wall-region-evidence"])],
    },
  }));
}

function wallStageDebug(
  analysis: ReturnType<typeof analyzeWallCandidates>,
  topology: LocalWallTopology = analysis.topology,
): LocalRecognitionWallStageDebug {
  return {
    normalisedSegmentCount: analysis.normalisedSegmentCount,
    pairedCenterlineCount: analysis.pairedCenterlineCount,
    topologyEdgeCount: topology.edges.length,
    topologyJunctionCount: topology.junctions.length,
    topologyDiagnostics: topology.diagnostics.map((diagnostic) => diagnostic.code),
  };
}

export async function runLocalRecognitionEngine(
  input: MaterializedLocalRecognitionInput,
  options: LocalRecognitionEngineOptions = {},
): Promise<RecognitionDraft> {
  options.onProgress?.({ phase: "prepare", progress: 0.05 });
  const { cv } = await resolveOpenCvModule(cvModule);
  let source: InstanceType<typeof cv.Mat> | null = null;
  let gray: InstanceType<typeof cv.Mat> | null = null;
  let structuralBinary: InstanceType<typeof cv.Mat> | null = null;
  let structuralMask: InstanceType<typeof cv.Mat> | null = null;
  let structuralKernel: InstanceType<typeof cv.Mat> | null = null;
  let strictBlurred: InstanceType<typeof cv.Mat> | null = null;
  let permissiveBlurred: InstanceType<typeof cv.Mat> | null = null;
  let strictEdges: InstanceType<typeof cv.Mat> | null = null;
  let permissiveEdges: InstanceType<typeof cv.Mat> | null = null;
  let strictLines: InstanceType<typeof cv.Mat> | null = null;
  let permissiveLines: InstanceType<typeof cv.Mat> | null = null;
  let symbolBlurred: InstanceType<typeof cv.Mat> | null = null;
  let symbolEdges: InstanceType<typeof cv.Mat> | null = null;
  let symbolLines: InstanceType<typeof cv.Mat> | null = null;
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
      ? imageRelativeAdaptiveOptions(input.imageData.width, input.imageData.height)
      : createAdaptiveLocalRecognitionOptions({
          analysisMillimetersPerPixel,
          widthPx: input.imageData.width,
          heightPx: input.imageData.height,
        });

    source = cv.matFromImageData(input.imageData);
    gray = new cv.Mat();
    structuralBinary = new cv.Mat();
    structuralMask = new cv.Mat();
    strictBlurred = new cv.Mat();
    permissiveBlurred = new cv.Mat();
    strictEdges = new cv.Mat();
    permissiveEdges = new cv.Mat();
    strictLines = new cv.Mat();
    permissiveLines = new cv.Mat();
    symbolBlurred = new cv.Mat();
    symbolEdges = new cv.Mat();
    symbolLines = new cv.Mat();

    cv.cvtColor(source, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, symbolBlurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
    cv.Canny(symbolBlurred, symbolEdges, 45, 120, 3, false);
    const symbolMinimumLengthPx = Math.round(clamp(adaptiveOptions.minimumSegmentLengthPx * 0.45, 10, 28));
    const symbolMaximumGapPx = Math.round(clamp(adaptiveOptions.collinearMergeGapPx * 0.12, 3, 10));
    cv.HoughLinesP(
      symbolEdges,
      symbolLines,
      1,
      Math.PI / 180,
      18,
      symbolMinimumLengthPx,
      symbolMaximumGapPx,
    );
    const symbolSegments: DetectedLineSegment[] = [];
    for (let offset = 0; offset + 3 < symbolLines.data32S.length; offset += 4) {
      symbolSegments.push({
        x1: symbolLines.data32S[offset] ?? 0,
        y1: symbolLines.data32S[offset + 1] ?? 0,
        x2: symbolLines.data32S[offset + 2] ?? 0,
        y2: symbolLines.data32S[offset + 3] ?? 0,
      });
    }

    cv.threshold(gray, structuralBinary, 0, 255, cv.THRESH_BINARY_INV | cv.THRESH_OTSU);
    const structuralKernelSize = oddKernelSize(Math.min(input.imageData.width, input.imageData.height));
    structuralKernel = cv.getStructuringElement(
      cv.MORPH_RECT,
      new cv.Size(structuralKernelSize, structuralKernelSize),
    );
    cv.morphologyEx(structuralBinary, structuralMask, cv.MORPH_OPEN, structuralKernel);

    const structuralRegionEvidence = extractStructuralWallRegions({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      pixels: structuralMask.data,
      options: {
        minimumLengthPx: adaptiveOptions.minimumSegmentLengthPx,
        minimumThicknessPx: Math.max(adaptiveOptions.minimumWallThicknessPx, structuralKernelSize + 1),
        maximumThicknessPx: adaptiveOptions.maximumWallThicknessPx,
        minimumRunOverlapRatio: 0.65,
        minimumRunLengthSimilarityRatio: 0.55,
        minimumAspectRatio: 2.5,
      },
    });
    const useStructuralRegionEvidence = structuralRegionEvidence.regions.length >= MIN_STRUCTURAL_REGIONS;
    const rawSegments: DetectedLineSegment[] = useStructuralRegionEvidence
      ? [...structuralRegionEvidence.boundarySegments]
      : [];
    let strictUniqueCount = rawSegments.length;
    let usedMultiPassEvidence = false;

    if (!useStructuralRegionEvidence) {
      cv.GaussianBlur(structuralMask, strictBlurred, new cv.Size(5, 5), 0, 0, cv.BORDER_DEFAULT);
      cv.GaussianBlur(structuralMask, permissiveBlurred, new cv.Size(3, 3), 0, 0, cv.BORDER_DEFAULT);
      options.onProgress?.({ phase: "edges", progress: 0.25 });
      cv.Canny(strictBlurred, strictEdges, 50, 150, 3, false);
      cv.Canny(permissiveBlurred, permissiveEdges, 25, 90, 3, false);
      options.onProgress?.({ phase: "lines", progress: 0.5 });

      const houghMinimumLength = Math.round(adaptiveOptions.minimumSegmentLengthPx);
      const houghMaximumGap = Math.round(clamp(adaptiveOptions.collinearMergeGapPx / 3, 12, 36));
      const appendHoughSegments = ({
        edges,
        lines,
        threshold,
      }: Readonly<{
        edges: InstanceType<typeof cv.Mat>;
        lines: InstanceType<typeof cv.Mat>;
        threshold: number;
      }>) => {
        cv.HoughLinesP(
          edges,
          lines,
          1,
          Math.PI / 180,
          threshold,
          houghMinimumLength,
          houghMaximumGap,
        );
        for (let offset = 0; offset + 3 < lines.data32S.length; offset += 4) {
          rawSegments.push({
            x1: lines.data32S[offset] ?? 0,
            y1: lines.data32S[offset + 1] ?? 0,
            x2: lines.data32S[offset + 2] ?? 0,
            y2: lines.data32S[offset + 3] ?? 0,
          });
        }
      };

      appendHoughSegments({ edges: strictEdges, lines: strictLines, threshold: 50 });
      strictUniqueCount = deduplicateDetectedSegments(
        rawSegments,
        adaptiveOptions.duplicateEndpointTolerancePx,
      ).length;
      appendHoughSegments({ edges: permissiveEdges, lines: permissiveLines, threshold: 32 });
      usedMultiPassEvidence = deduplicateDetectedSegments(
        rawSegments,
        adaptiveOptions.duplicateEndpointTolerancePx,
      ).length > strictUniqueCount;
    } else {
      options.onProgress?.({ phase: "edges", progress: 0.25 });
      options.onProgress?.({ phase: "lines", progress: 0.5 });
    }

    const segments = deduplicateDetectedSegments(
      rawSegments,
      adaptiveOptions.duplicateEndpointTolerancePx,
    );

    options.onProgress?.({ phase: "walls", progress: 0.72 });
    const strictAnalysis = analyzeWallCandidates({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      segments,
      ...(useStructuralRegionEvidence ? { options: adaptiveOptions } : {}),
    });

    const completion = useStructuralRegionEvidence
      ? completeWallCenterlines({
          centerlines: strictAnalysis.topology.edges.map((edge) => ({
            startPx: edge.startPx,
            endPx: edge.endPx,
            thicknessPx: edge.thicknessPx,
            evidenceCount: edge.evidenceCount,
            confidence: edge.confidence,
            reasons: edge.reasons,
          })),
          mask: {
            widthPx: input.imageData.width,
            heightPx: input.imageData.height,
            isStructural: (x, y) => {
              if (x < 0 || y < 0 || x >= input.imageData.width || y >= input.imageData.height) return false;
              return (structuralMask?.data[Math.floor(y) * input.imageData.width + Math.floor(x)] ?? 0) > 0;
            },
          },
          options: {
            ...DEFAULT_WALL_COMPLETION_OPTIONS,
            maximumAngleDeltaDeg: Math.min(
              DEFAULT_WALL_COMPLETION_OPTIONS.maximumAngleDeltaDeg,
              adaptiveOptions.maximumAngleDeltaDeg,
            ),
            maximumGapPx: Math.min(
              DEFAULT_WALL_COMPLETION_OPTIONS.maximumGapPx,
              adaptiveOptions.endpointExtensionTolerancePx,
            ),
          },
        })
      : null;
    const analysis = {
      completionAcceptedCount: completion?.acceptedCompletionCount ?? 0,
      completionDiagnostics: completion?.diagnostics ?? [],
    };
    const strictTopology = completion
      ? buildLocalWallTopology({
          centerlines: completion.centerlines,
          endpointSnapTolerancePx: adaptiveOptions.endpointSnapTolerancePx,
          endpointExtensionTolerancePx: adaptiveOptions.endpointExtensionTolerancePx,
          intersectionTolerancePx: adaptiveOptions.intersectionTolerancePx,
          minimumEdgeLengthPx: adaptiveOptions.minimumTopologyEdgeLengthPx,
        })
      : strictAnalysis.topology;
    const strictWalls = useStructuralRegionEvidence
      ? markRegionCandidates(topologyWallCandidates({
          topology: strictTopology,
          widthPx: input.imageData.width,
          heightPx: input.imageData.height,
        }))
      : [...strictAnalysis.candidates];

    let adaptiveAnalysis: ReturnType<typeof analyzeWallCandidates> | null = null;
    let usedAdaptiveFallback = false;
    let analysisWalls = strictWalls;
    if (!useStructuralRegionEvidence && strictWalls.length < MIN_STRICT_WALLS) {
      adaptiveAnalysis = analyzeWallCandidates({
        widthPx: input.imageData.width,
        heightPx: input.imageData.height,
        segments,
        options: adaptiveOptions,
      });
      if (adaptiveAnalysis.candidates.length > strictWalls.length) {
        analysisWalls = markAdaptiveCandidates(adaptiveAnalysis.candidates);
        usedAdaptiveFallback = true;
      }
    }
    const windowHostConsolidation = consolidateWindowHostWalls({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      wallCandidates: analysisWalls,
      symbolSegments,
    });
    analysisWalls = [...windowHostConsolidation.walls];

    const debugSelection = useStructuralRegionEvidence
      ? { selectedMode: "regions" as const }
      : { selectedMode: usedAdaptiveFallback ? "adaptive" as const : "strict" as const };
    options.onDebug?.({
      structuralRegionCount: structuralRegionEvidence.regions.length,
      rawSegmentCount: rawSegments.length,
      strictUniqueSegmentCount: strictUniqueCount,
      uniqueSegmentCount: segments.length,
      strict: wallStageDebug(strictAnalysis, strictTopology),
      adaptive: adaptiveAnalysis ? wallStageDebug(adaptiveAnalysis) : null,
      completionAcceptedCount: analysis.completionAcceptedCount,
      completionDiagnosticCodes: analysis.completionDiagnostics.map((diagnostic) => diagnostic.code),
      ...debugSelection,
    });

    options.onProgress?.({ phase: "openings", progress: 0.9 });
    const openingAnalysis = analyzeOpeningHypotheses({
      widthPx: input.imageData.width,
      heightPx: input.imageData.height,
      wallCandidates: analysisWalls,
      wallSegments: segments,
      symbolSegments,
    });
    const analysisOpenings = [...openingAnalysis.candidates];
    const { walls, openings } = rescaleRecognitionPixelEvidence({
      walls: analysisWalls,
      openings: analysisOpenings,
      analysisWidthPx: input.imageData.width,
      analysisHeightPx: input.imageData.height,
      sourceWidthPx: input.sourceWidthPx,
      sourceHeightPx: input.sourceHeightPx,
    });

    const diagnostics = [];
    diagnostics.push({
      code: "thick-ink-structural-mask",
      severity: "info" as const,
      message: "Перед поиском стен тонкие подписи и контуры предметов подавлены структурным фильтром.",
      candidateId: null,
    });
    if (useStructuralRegionEvidence) {
      diagnostics.push({
        code: "region-first-wall-evidence",
        severity: "info" as const,
        message: `Стены построены по ${structuralRegionEvidence.regions.length} заполненным структурным областям; линейный Hough-поиск не использовался.`,
        candidateId: null,
      });
    }
    if (analysis.completionAcceptedCount > 0) {
      diagnostics.push({
        code: "evidence-gated-wall-completion",
        severity: "info" as const,
        message: `По непрерывному структурному растру восстановлено безопасных фрагментов стен: ${analysis.completionAcceptedCount}.`,
        candidateId: null,
      });
    }
    if (analysis.completionDiagnostics.some((item) => item.code === "completion-budget-exceeded")) {
      diagnostics.push({
        code: "wall-completion-budget-exceeded",
        severity: "warning" as const,
        message: "Восстановление разрывов пропущено из-за безопасного лимита сложности; исходные локальные стены сохранены без изменений.",
        candidateId: null,
      });
    }
    if (usedMultiPassEvidence) {
      diagnostics.push({
        code: "multi-pass-source-normalisation",
        severity: "info" as const,
        message: "Для слабых и сжатых линий использован дополнительный локальный проход. Проверьте найденную геометрию перед применением.",
        candidateId: null,
      });
    }
    if (usedAdaptiveFallback) {
      diagnostics.push({
        code: "adaptive-local-fallback",
        severity: "info" as const,
        message: analysisMillimetersPerPixel == null
          ? "Строгий локальный анализ нашёл мало стен, поэтому применены более гибкие пороги относительно размера изображения. Проверьте найденные линии перед применением."
          : "Строгий локальный анализ нашёл мало стен, поэтому применены более гибкие пороги по физическому масштабу. Проверьте найденные линии перед применением.",
        candidateId: null,
      });
    }
    if (windowHostConsolidation.acceptedBridgeCount > 0) {
      diagnostics.push({
        code: "window-symbol-host-consolidation",
        severity: "info" as const,
        message: `По подтверждённым оконным линиям безопасно объединено фрагментов стен: ${windowHostConsolidation.acceptedBridgeCount}.`,
        candidateId: null,
      });
    }
    if (windowHostConsolidation.diagnostics.some((code) =>
      code === "window-host-budget-exceeded"
      || code === "window-symbol-budget-exceeded"
      || code === "window-host-bridge-budget-reached")) {
      diagnostics.push({
        code: "window-host-consolidation-budget",
        severity: "warning" as const,
        message: "Объединение оконных host-стен пропущено или ограничено безопасным лимитом; исходная локальная геометрия сохранена.",
        candidateId: null,
      });
    }
    if (openingAnalysis.candidates.length > 0) {
      diagnostics.push({
        code: "opening-host-validation",
        severity: "info" as const,
        message: `К известным стенам безопасно привязано проёмов: ${openingAnalysis.candidates.length}.`,
        candidateId: null,
      });
    }
    for (const rejected of openingAnalysis.rejections) {
      diagnostics.push({
        code: "opening-hypothesis-rejected",
        severity: "warning" as const,
        message: rejected.message,
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
      id: options.createDraftId?.() ?? crypto.randomUUID(),
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
    options.onProgress?.({ phase: "complete", progress: 1 });
    return draft;
  } finally {
    symbolLines?.delete();
    symbolEdges?.delete();
    symbolBlurred?.delete();
    permissiveLines?.delete();
    strictLines?.delete();
    permissiveEdges?.delete();
    strictEdges?.delete();
    permissiveBlurred?.delete();
    strictBlurred?.delete();
    structuralKernel?.delete();
    structuralMask?.delete();
    structuralBinary?.delete();
    gray?.delete();
    source?.delete();
  }
}

import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import { retryTerminalPartitionDoor } from "./opening-analysis-terminal-partition-door-retry";
import {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
} from "./opening-analysis-runtime-with-short-jamb";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 600;
const HOST_X = 400;
const HOST_END_Y = 195;
const FAR_SIDE_Y = 277;

function wall(options: Readonly<{
  startY?: number;
  thicknessPx?: number;
}> = {}): RecognitionWallCandidate {
  const startY = options.startY ?? 100;
  return {
    id: "partition-stub",
    start: { x: HOST_X / WIDTH, y: startY / HEIGHT },
    end: { x: HOST_X / WIDTH, y: HOST_END_Y / HEIGHT },
    estimatedThicknessPx: options.thicknessPx ?? 21,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: [
        "dominant-wall-thickness-band",
        "filled-wall-region-evidence",
        "paired-parallel-edges",
        "topology-edge",
      ],
    },
    origin: "local",
    conflict: null,
  };
}

const leaf: DetectedLineSegment = {
  x1: HOST_X,
  y1: HOST_END_Y,
  x2: HOST_X + 82,
  y2: HOST_END_Y,
};

function mask(options: Readonly<{ fillGap?: boolean }> = {}): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      if (Math.abs(x - HOST_X) <= 11 && y >= 95 && y <= HOST_END_Y) return true;
      if (Math.abs(x - HOST_X) <= 11 && y >= FAR_SIDE_Y && y <= FAR_SIDE_Y + 40) return true;
      if (options.fillGap && Math.abs(x - HOST_X) <= 11 && y > HOST_END_Y && y < FAR_SIDE_Y) return true;
      return false;
    },
  };
}

function input(options: Readonly<{
  host?: RecognitionWallCandidate;
  structuralMask?: StructuralMaskView;
  symbolSegments?: readonly DetectedLineSegment[];
}> = {}) {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [options.host ?? wall()],
    symbolSegments: options.symbolSegments ?? [leaf],
    structuralMask: options.structuralMask ?? mask(),
  } as const;
}

function detectedCandidate(options: Parameters<typeof input>[0] = {}): RecognitionOpeningCandidate {
  const current = input(options);
  const detection = detectContinuousHostDoorOpenings({
    widthPx: current.widthPx,
    heightPx: current.heightPx,
    wallCandidates: current.wallCandidates,
    symbolSegments: current.symbolSegments,
    mask: current.structuralMask,
  });
  expect(detection.openingHypotheses).toHaveLength(1);
  return detection.openingHypotheses[0]!;
}

function outsideRejection(candidate: RecognitionOpeningCandidate, host = wall()) {
  const validation = validateOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [host],
    hypotheses: [candidate],
  });
  expect(validation.candidates).toEqual([]);
  const rejection = validation.rejections.find(({ candidateId }) => candidateId === candidate.id);
  expect(rejection?.code).toBe("opening-outside-host-span");
  return rejection!;
}

describe("terminal partition-stub door validation retry", () => {
  it("accepts a detector-replayed terminal door on a short partition stub", () => {
    const current = input();
    const candidate = detectedCandidate();
    const rejection = outsideRejection(candidate);

    const recovered = retryTerminalPartitionDoor(current, rejection);

    expect(recovered).toBeDefined();
    expect(recovered?.kind).toBe("door");
    expect(recovered?.hostWallCandidateId).toBe("partition-stub");
    expect(recovered?.evidence.reasons).toContain("terminal-partition-stub-validated");
  });

  it("is wired into the full analyzer while leaving the common validator fail-closed", () => {
    const current = input();
    const analyzed = analyzeOpeningHypotheses(current);

    expect(analyzed.rejections).toEqual([]);
    expect(analyzed.candidates).toHaveLength(1);
    expect(analyzed.candidates[0]?.evidence.reasons).toContain("terminal-partition-stub-validated");

    const candidate = detectedCandidate();
    const direct = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: current.wallCandidates,
      hypotheses: [candidate],
    });
    expect(direct.candidates).toEqual([]);
    expect(direct.rejections[0]?.code).toBe("opening-outside-host-span");
  });

  it("rejects a host that is too long relative to the door width", () => {
    const host = wall({ startY: 45 });
    const current = input({ host });
    const candidate = detectedCandidate({ host });
    const rejection = outsideRejection(candidate, host);

    expect(retryTerminalPartitionDoor(current, rejection)).toBeNull();
  });

  it("rejects an opening that is too wide relative to the structural wall thickness", () => {
    const host = wall({ thicknessPx: 14 });
    const current = input({ host });
    const candidate = detectedCandidate({ host });
    const rejection = outsideRejection(candidate, host);

    expect(retryTerminalPartitionDoor(current, rejection)).toBeNull();
  });

  it("rejects stale provenance even when the detector can reproduce the geometry", () => {
    const current = input();
    const exact = detectedCandidate();
    const generic: RecognitionOpeningCandidate = {
      ...exact,
      id: "generic-terminal-door",
      evidence: {
        ...exact.evidence,
        reasons: exact.evidence.reasons.filter((reason) => reason !== "terminal-host-mask-door-gap"),
      },
    };
    const rejection = outsideRejection(generic);

    expect(retryTerminalPartitionDoor(current, rejection)).toBeNull();
  });

  it("rejects when the mask gap is occupied even if an old candidate is supplied", () => {
    const exact = detectedCandidate();
    const current = input({ structuralMask: mask({ fillGap: true }) });
    const rejection = outsideRejection(exact);

    expect(retryTerminalPartitionDoor(current, rejection)).toBeNull();
  });

  it("rejects when the perpendicular leaf cannot be replayed", () => {
    const exact = detectedCandidate();
    const current = input({ symbolSegments: [] });
    const rejection = outsideRejection(exact);

    expect(retryTerminalPartitionDoor(current, rejection)).toBeNull();
  });
});

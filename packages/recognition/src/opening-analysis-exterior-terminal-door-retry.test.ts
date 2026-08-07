import { describe, expect, it } from "vitest";
import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionOpeningCandidate, RecognitionWallCandidate } from "./model";
import {
  analyzeOpeningHypotheses,
  validateOpeningHypotheses,
} from "./opening-analysis-runtime-with-short-jamb";
import type { StructuralMaskView } from "./wall-completion";

const WIDTH = 1000;
const HEIGHT = 700;
const HOST_X = 500;
const HOST_START_Y = 80;
const HOST_END_Y = 300;
const HINGE_Y = 320;
const DOOR_WIDTH = 96;
const THICKNESS = 32;

function host(reasons: readonly string[] = [
  "filled-wall-region-evidence",
  "paired-parallel-edges",
  "primary-structural-component",
  "topology-edge",
  "junction-degree:4",
]): RecognitionWallCandidate {
  return {
    id: "exterior-terminal-host",
    start: { x: HOST_X / WIDTH, y: HOST_START_Y / HEIGHT },
    end: { x: HOST_X / WIDTH, y: HOST_END_Y / HEIGHT },
    estimatedThicknessPx: THICKNESS,
    confidence: "medium",
    evidence: {
      localScore: 0.74,
      cloudScore: null,
      reasons: [...reasons],
    },
    origin: "local",
    conflict: null,
  };
}

function terminalLeaf(widthPx = DOOR_WIDTH): DetectedLineSegment {
  return {
    x1: HOST_X,
    y1: HINGE_Y,
    x2: HOST_X - widthPx,
    y2: HINGE_Y,
  };
}

const leaf = terminalLeaf();

function mask(options: Readonly<{
  continuation?: boolean;
  openingFilled?: boolean;
}> = {}): StructuralMaskView {
  return {
    widthPx: WIDTH,
    heightPx: HEIGHT,
    isStructural(x, y): boolean {
      const onHost = Math.abs(x - HOST_X) <= THICKNESS / 2;
      if (!onHost) return false;
      if (y >= HOST_START_Y && y <= HOST_END_Y) return true;
      if (options.continuation !== false && y > HOST_END_Y && y <= HINGE_Y) return true;
      if (options.openingFilled === true && y > HINGE_Y && y <= HINGE_Y + DOOR_WIDTH) return true;
      return false;
    },
  };
}

function analyze(options: Readonly<{
  wall?: RecognitionWallCandidate;
  symbolSegments?: readonly DetectedLineSegment[];
  structuralMask?: StructuralMaskView | null;
  additionalHypotheses?: readonly RecognitionOpeningCandidate[];
}> = {}) {
  const structuralMask = options.structuralMask === null ? undefined : options.structuralMask ?? mask();
  return analyzeOpeningHypotheses({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [options.wall ?? host()],
    symbolSegments: options.symbolSegments ?? [leaf],
    structuralMask,
    additionalHypotheses: options.additionalHypotheses,
  });
}

function detectedCandidate(): RecognitionOpeningCandidate {
  const detection = detectContinuousHostDoorOpenings({
    widthPx: WIDTH,
    heightPx: HEIGHT,
    wallCandidates: [host()],
    symbolSegments: [leaf],
    mask: mask(),
  });
  const candidate = detection.openingHypotheses.find((opening) =>
    opening.evidence.reasons.includes("exterior-terminal-door-leaf"));
  expect(candidate).toBeDefined();
  if (!candidate) throw new Error("Expected exterior terminal detector candidate.");
  return candidate;
}

function validatedExterior(result: ReturnType<typeof analyze>) {
  return result.candidates.filter((candidate) =>
    candidate.evidence.reasons.includes("exterior-terminal-door-validated"));
}

describe("exterior terminal door validation retry", () => {
  it("accepts exactly one replayed exterior terminal door through validation-only host extension", () => {
    const sourceHost = host();
    const before = JSON.stringify(sourceHost);
    const result = analyze({ wall: sourceHost });
    const recovered = validatedExterior(result);

    expect(recovered).toHaveLength(1);
    expect(recovered[0]?.kind).toBe("door");
    expect(recovered[0]?.hostWallCandidateId).toBe(sourceHost.id);
    expect(recovered[0]?.evidence.reasons).toContain("host-wall-validated");
    expect(recovered[0]?.evidence.reasons).toContain("opening-span-validated");
    expect(JSON.stringify(sourceHost)).toBe(before);
    expect(result.rejections.some(({ candidateId }) => candidateId === recovered[0]?.id)).toBe(false);
  });

  it("rejects a terminal leaf that is too short relative to host thickness", () => {
    expect(validatedExterior(analyze({ symbolSegments: [terminalLeaf(70)] }))).toEqual([]);
  });

  it("rejects a terminal leaf that is too wide relative to host thickness", () => {
    expect(validatedExterior(analyze({ symbolSegments: [terminalLeaf(190)] }))).toEqual([]);
  });

  it("keeps the common validator fail-closed for the same outside-host candidate", () => {
    const candidate = detectedCandidate();
    const direct = validateOpeningHypotheses({
      widthPx: WIDTH,
      heightPx: HEIGHT,
      wallCandidates: [host()],
      hypotheses: [candidate],
    });

    expect(direct.candidates).toEqual([]);
    expect(direct.rejections.find(({ candidateId }) => candidateId === candidate.id)?.code)
      .toBe("opening-outside-host-span");
  });

  it("does not retry without a structural mask", () => {
    expect(validatedExterior(analyze({ structuralMask: null }))).toEqual([]);
  });

  it("does not retry when the detector leaf cannot be replayed", () => {
    expect(validatedExterior(analyze({ symbolSegments: [] }))).toEqual([]);
  });

  it("does not retry a weak host that lacks strong exterior provenance", () => {
    const weak = host(["filled-wall-region-evidence", "topology-edge", "junction-degree:4"]);
    expect(validatedExterior(analyze({ wall: weak }))).toEqual([]);
  });

  it("does not retry when the exterior opening span is structural", () => {
    expect(validatedExterior(analyze({ structuralMask: mask({ openingFilled: true }) }))).toEqual([]);
  });

  it("does not accept a stale exterior candidate that exact detector replay does not reproduce", () => {
    const exact = detectedCandidate();
    const tampered: RecognitionOpeningCandidate = {
      ...exact,
      id: "tampered-exterior-terminal-door",
      center: {
        x: exact.center.x,
        y: exact.center.y + 0.12,
      },
      widthPx: (exact.widthPx ?? DOOR_WIDTH) + 28,
    };
    const result = analyze({ additionalHypotheses: [tampered] });

    expect(result.candidates.some(({ id }) => id === tampered.id)).toBe(false);
  });

  it("does not grant the retry to an outside-host door without exterior-terminal provenance", () => {
    const exact = detectedCandidate();
    const generic: RecognitionOpeningCandidate = {
      ...exact,
      id: "generic-outside-host-door",
      evidence: {
        ...exact.evidence,
        reasons: exact.evidence.reasons.filter((reason) =>
          reason !== "exterior-terminal-door-leaf"
          && reason !== "terminal-host-mask-continuation"),
      },
    };
    const result = analyze({ additionalHypotheses: [generic] });

    expect(result.candidates.some(({ id }) => id === generic.id)).toBe(false);
  });
});

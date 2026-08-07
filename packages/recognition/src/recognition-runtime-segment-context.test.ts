import { describe, expect, it } from "vitest";
import type { DetectedLineSegment } from "./local-lines";
import type { RecognitionWallCandidate } from "./model";
import {
  registerStructuralSegmentsForActiveWalls,
  takeStructuralSegmentsForWalls,
} from "./recognition-runtime-context";

const WIDTH = 1000;
const HEIGHT = 600;

function wall(id: string, conflict: RecognitionWallCandidate["conflict"] = null): RecognitionWallCandidate {
  return {
    id,
    start: { x: 0.1, y: 0.2 },
    end: { x: 0.9, y: 0.2 },
    estimatedThicknessPx: 30,
    confidence: "medium",
    evidence: { localScore: 0.72, cloudScore: null, reasons: ["topology-edge"] },
    origin: "local",
    conflict,
  };
}

const segments: DetectedLineSegment[] = [
  { x1: 100, y1: 90, x2: 900, y2: 90 },
  { x1: 100, y1: 110, x2: 900, y2: 110 },
];

describe("recognition runtime structural-segment context", () => {
  it("registers immutable structural segments for active walls and consumes them once", () => {
    const active = wall("active");

    registerStructuralSegmentsForActiveWalls([active], segments, WIDTH, HEIGHT);
    const first = takeStructuralSegmentsForWalls([active], WIDTH, HEIGHT);

    expect(first).toEqual(segments);
    expect(first).not.toBe(segments);
    expect(takeStructuralSegmentsForWalls([active], WIDTH, HEIGHT)).toBeNull();
  });

  it("does not expose segments through blocked walls", () => {
    const blocked = wall("blocked", "unsupported");

    registerStructuralSegmentsForActiveWalls([blocked], segments, WIDTH, HEIGHT);

    expect(takeStructuralSegmentsForWalls([blocked], WIDTH, HEIGHT)).toBeNull();
  });

  it("keeps registered segments available after a mismatched dimension lookup", () => {
    const active = wall("active");

    registerStructuralSegmentsForActiveWalls([active], segments, WIDTH, HEIGHT);

    expect(takeStructuralSegmentsForWalls([active], WIDTH + 1, HEIGHT)).toBeNull();
    expect(takeStructuralSegmentsForWalls([active], WIDTH, HEIGHT)).toEqual(segments);
  });

  it("does not leak segment evidence through a different wall object with the same id", () => {
    const registered = wall("shared-id");
    const lookalike = wall("shared-id");

    registerStructuralSegmentsForActiveWalls([registered], segments, WIDTH, HEIGHT);

    expect(takeStructuralSegmentsForWalls([lookalike], WIDTH, HEIGHT)).toBeNull();
    expect(takeStructuralSegmentsForWalls([registered], WIDTH, HEIGHT)).toEqual(segments);
  });
});

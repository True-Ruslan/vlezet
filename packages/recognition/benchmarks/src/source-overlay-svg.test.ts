import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import type { RecognitionDraft, RecognitionWallCandidate } from "../../src/model";
import { validateRecognitionBenchmarkFixtureV1 } from "../schema/fixture-v1";
import { renderRecognitionSourceOverlaySvg } from "./source-overlay-svg";

const fixture = validateRecognitionBenchmarkFixtureV1(JSON.parse(readFileSync(
  fileURLToPath(new URL("../fixtures/clean-studio/fixture.json", import.meta.url)),
  "utf8",
)) as unknown);

function wall(id: string, start: Readonly<{ x: number; y: number }>, end: Readonly<{ x: number; y: number }>): RecognitionWallCandidate {
  return {
    id,
    start,
    end,
    estimatedThicknessPx: 15,
    confidence: "medium",
    evidence: { localScore: 0.7, cloudScore: null, reasons: ["benchmark"] },
    origin: "local",
    conflict: null,
  };
}

const matchedTopWall = wall(
  "matched-top",
  { x: 30 / 660, y: 30 / 510 },
  { x: 630 / 660, y: 30 / 510 },
);
const falsePositiveWall = wall(
  "false-positive",
  { x: 0.15, y: 0.25 },
  { x: 0.85, y: 0.75 },
);
const draft: RecognitionDraft = {
  id: "overlay-test",
  projectId: "benchmark-clean-studio",
  referenceAssetId: "asset-clean-studio",
  referenceRevision: "recognition-corpus-v1",
  engineVersion: "3",
  status: "local-complete",
  walls: [matchedTopWall, falsePositiveWall],
  openings: [],
  roomLabels: [],
  diagnostics: [],
  decisions: { "matched-top": "pending", "false-positive": "pending" },
  source: { local: true, cloud: false },
  createdAt: "2026-08-01T00:00:00.000Z",
  updatedAt: "2026-08-01T00:00:00.000Z",
};

describe("recognition source overlay SVG", () => {
  it("renders the source plus colour-independent expected/predicted and match-state evidence", () => {
    const svg = renderRecognitionSourceOverlaySvg({ fixture, draft, sourceBase64: "AA==" });

    expect(svg).toMatch(/^<svg[^>]+>/);
    expect(svg).toContain('href="data:image/png;base64,AA=="');
    expect(svg).toContain('data-layer="expected-rooms"');
    expect(svg).toContain('data-layer="expected-walls"');
    expect(svg).toContain('data-layer="predicted-walls"');
    expect(svg).toContain('data-layer="expected-openings"');
    expect(svg).toContain('data-status="true-positive"');
    expect(svg).toContain('data-status="false-negative"');
    expect(svg).toContain('data-status="false-positive"');
    expect(svg).toContain('stroke-dasharray="12 8"');
    expect(svg).toContain('stroke-dasharray="16 4 2 4"');
    expect(svg).toContain(">FN<");
    expect(svg).toContain(">FP<");
    expect(svg).toContain("Expected: solid/square");
    expect(svg).toContain("Predicted: dotted/circle");
  });
});

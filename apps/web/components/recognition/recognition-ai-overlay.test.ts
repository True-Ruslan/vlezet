import { describe, expect, it } from "vitest";
import type { ValidatedRecognitionDraft } from "@vlezet/recognition";
import {
  renderRecognitionAiOverlay,
  type RecognitionAiOverlayCanvas,
  type RecognitionAiOverlayContext,
} from "./recognition-ai-overlay";

const NOW = "2026-08-05T00:00:00.000Z";

type Operation = readonly [string, ...unknown[]];

class FakeContext implements RecognitionAiOverlayContext {
  readonly operations: Operation[] = [];
  lineWidth = 1;
  strokeStyle: string | CanvasGradient | CanvasPattern = "";
  fillStyle: string | CanvasGradient | CanvasPattern = "";
  font = "";
  textAlign: CanvasTextAlign = "start";
  textBaseline: CanvasTextBaseline = "alphabetic";
  globalAlpha = 1;

  clearRect(...args: [number, number, number, number]): void { this.operations.push(["clearRect", ...args]); }
  beginPath(): void { this.operations.push(["beginPath"]); }
  moveTo(...args: [number, number]): void { this.operations.push(["moveTo", ...args]); }
  lineTo(...args: [number, number]): void { this.operations.push(["lineTo", ...args]); }
  stroke(): void { this.operations.push(["stroke"]); }
  arc(...args: [number, number, number, number, number]): void { this.operations.push(["arc", ...args]); }
  fill(): void { this.operations.push(["fill"]); }
  fillText(...args: [string, number, number]): void { this.operations.push(["fillText", ...args]); }
  save(): void { this.operations.push(["save"]); }
  restore(): void { this.operations.push(["restore"]); }
}

class FakeCanvas implements RecognitionAiOverlayCanvas {
  width = 0;
  height = 0;
  readonly context = new FakeContext();
  getContext(type: "2d"): RecognitionAiOverlayContext | null {
    return type === "2d" ? this.context : null;
  }
  toDataURL(type?: string): string {
    return `data:${type ?? "image/png"};base64,OVERLAY`;
  }
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
  const openings = [
    {
      id: "opening-window",
      kind: "window" as const,
      hostWallCandidateId: "wall-a",
      center: { x: 0.65, y: 0.2 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "medium" as const,
      evidence: { localScore: 0.7, cloudScore: null, reasons: ["parallel-window-rails"] },
      origin: "local" as const,
      conflict: null,
    },
    {
      id: "opening-door",
      kind: "door" as const,
      hostWallCandidateId: "wall-b",
      center: { x: 0.4, y: 0.7 },
      widthPx: 80,
      orientationDeg: 0,
      confidence: "medium" as const,
      evidence: { localScore: 0.72, cloudScore: null, reasons: ["door-leaf"] },
      origin: "local" as const,
      conflict: null,
    },
  ];
  return {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: reverse ? [...walls].reverse() : walls,
    openings: reverse ? [...openings].reverse() : openings,
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

function render(localDraft: ValidatedRecognitionDraft) {
  const canvas = new FakeCanvas();
  const dataUrl = renderRecognitionAiOverlay({
    sourceImage: {} as CanvasImageSource,
    widthPx: 1200,
    heightPx: 800,
    localDraft,
    canvasFactory: () => canvas,
  });
  return { canvas, dataUrl };
}

describe("recognition AI proposal overlay", () => {
  it("uses a transparent canvas with dimensions exactly aligned to the source raster", () => {
    const { canvas, dataUrl } = render(draft());
    expect(canvas.width).toBe(1200);
    expect(canvas.height).toBe(800);
    expect(canvas.context.operations[0]).toEqual(["clearRect", 0, 0, 1200, 800]);
    expect(canvas.context.operations.some(([name]) => name === "drawImage")).toBe(false);
    expect(dataUrl).toBe("data:image/png;base64,OVERLAY");
  });

  it("renders canonical local-ID labels independent of candidate array order", () => {
    const first = render(draft()).canvas.context.operations;
    const second = render(draft(true)).canvas.context.operations;
    const firstLabels = first.filter(([name]) => name === "fillText");
    const secondLabels = second.filter(([name]) => name === "fillText");
    expect(secondLabels).toEqual(firstLabels);
    expect(firstLabels.map((operation) => operation[1])).toEqual([
      "W wall-a",
      "W wall-b",
      "D opening-door",
      "O opening-window",
    ]);
  });

  it("draws only local Draft candidates and no provider-result geometry", () => {
    const operations = render(draft()).canvas.context.operations;
    const labels = operations
      .filter(([name]) => name === "fillText")
      .map((operation) => String(operation[1]));
    expect(labels.every((label) => /^(W|D|O) (wall-|opening-)/.test(label))).toBe(true);
    expect(JSON.stringify(operations)).not.toContain("provider");
    expect(JSON.stringify(operations)).not.toContain("proposal-");
  });
});

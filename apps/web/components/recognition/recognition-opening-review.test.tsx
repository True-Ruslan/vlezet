import type { RecognitionSessionRecord } from "@vlezet/recognition";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecognitionPanel } from "./recognition-panel";

const now = "2026-08-03T00:00:00.000Z";

const session: RecognitionSessionRecord = {
  id: "session-1",
  projectId: "project-1",
  referenceAssetId: "asset-1",
  referenceRevision: "revision-1",
  engineVersion: "5",
  draft: {
    id: "draft-1",
    projectId: "project-1",
    referenceAssetId: "asset-1",
    referenceRevision: "revision-1",
    engineVersion: "5",
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.5 },
      end: { x: 0.9, y: 0.5 },
      estimatedThicknessPx: 20,
      confidence: "medium",
      evidence: { localScore: 0.72, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings: [{
      id: "opening-1",
      kind: "door",
      hostWallCandidateId: "wall-1",
      center: { x: 0.5, y: 0.5 },
      widthPx: 90,
      orientationDeg: 0,
      confidence: "medium",
      evidence: {
        localScore: 0.72,
        cloudScore: null,
        reasons: ["wall-gap", "door-arc-like-line", "host-wall-validated", "opening-span-validated"],
      },
      origin: "local",
      conflict: null,
    }],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending", "opening-1": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: now,
    updatedAt: now,
  },
  cloudMetadata: null,
  createdAt: now,
  updatedAt: now,
};

const callbacks = {
  selectedCandidateId: "opening-1",
  hasReferencePlan: true,
  missingReferenceAsset: false,
  navigation: { label: "К комнате", onActivate: () => undefined },
  onStartLocal: () => undefined,
  onSelect: () => undefined,
  onDecision: () => undefined,
  onReclassifyOpening: () => undefined,
  onAcceptHighConfidence: () => undefined,
  onRunCloud: () => undefined,
  onApply: () => undefined,
  onDiscard: () => undefined,
} as const;

describe("opening review evidence", () => {
  it("shows validated host, source width and explainable classification evidence", () => {
    const markup = renderToStaticMarkup(
      <RecognitionPanel state={{ kind: "review", session }} {...callbacks} />,
    );

    expect(markup).toContain("Привязка к стене подтверждена");
    expect(markup).toContain("Ширина гипотезы в исходнике");
    expect(markup).toContain("90 px");
    expect(markup).toContain("Обнаружен разрыв в стене");
    expect(markup).toContain("Есть признак дверной дуги");
    expect(markup).not.toContain("wall-1");
  });
});

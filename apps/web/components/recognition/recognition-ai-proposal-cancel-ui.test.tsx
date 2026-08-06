import { LOCAL_RECOGNITION_ENGINE_VERSION, validateRecognitionDraft, type RecognitionSessionRecord } from "@vlezet/recognition";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecognitionPanel } from "./recognition-panel";

const now = "2026-08-06T15:10:00.000Z";

function session(): RecognitionSessionRecord {
  const draft = validateRecognitionDraft({
    id: "cancel-ui-draft",
    projectId: "cancel-ui-project",
    referenceAssetId: "cancel-ui-asset",
    referenceRevision: "cancel-ui-revision",
    engineVersion: LOCAL_RECOGNITION_ENGINE_VERSION,
    status: "local-complete",
    walls: [{
      id: "wall-1",
      start: { x: 0.1, y: 0.2 },
      end: { x: 0.9, y: 0.2 },
      estimatedThicknessPx: 18,
      confidence: "medium",
      evidence: { localScore: 0.8, cloudScore: null, reasons: ["filled-wall-region-evidence"] },
      origin: "local",
      conflict: null,
    }],
    openings: [],
    roomLabels: [],
    diagnostics: [],
    decisions: { "wall-1": "pending" },
    source: { local: true, cloud: false },
    aiProposals: [],
    proposalDecisions: {},
    aiProposalMetadata: null,
    createdAt: now,
    updatedAt: now,
  });
  return {
    id: "cancel-ui-session",
    projectId: draft.projectId,
    referenceAssetId: draft.referenceAssetId,
    referenceRevision: draft.referenceRevision,
    engineVersion: draft.engineVersion,
    draft,
    cloudMetadata: null,
    createdAt: now,
    updatedAt: now,
  };
}

describe("AI proposal discovery progress UI", () => {
  it("exposes an explicit cancellation action while omission discovery is running", () => {
    const markup = renderToStaticMarkup(
      <RecognitionPanel
        state={{
          kind: "running-ai-proposals",
          session: session(),
          requestId: "cancel-request",
          referenceRevision: "cancel-ui-revision",
          localDraftFingerprint: "recognition-local-draft-v1:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
        }}
        selectedCandidateId={null}
        hasReferencePlan
        missingReferenceAsset={false}
        navigation={{ label: "К плану", onActivate: () => undefined }}
        onStartLocal={() => undefined}
        onSelect={() => undefined}
        onDecision={() => undefined}
        onReclassifyOpening={() => undefined}
        onAcceptHighConfidence={() => undefined}
        onRunCloud={() => undefined}
        onFindAiProposals={() => undefined}
        aiProposalDiscoveryAvailable
        onCancelAiProposalDiscovery={() => undefined}
        onProposalDecision={() => undefined}
        onAgreeWithWallAdvisory={() => undefined}
        onApply={() => undefined}
        onDiscard={() => undefined}
      />,
    );

    expect(markup).toContain("AI-поиск пропущенных элементов");
    expect(markup).toContain("Отменить AI-поиск");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const projectAppSource = readFileSync(
  new URL("../projects/project-app.tsx", import.meta.url),
  "utf8",
);
const apartmentEditorSource = readFileSync(
  new URL("../editor/apartment-editor.tsx", import.meta.url),
  "utf8",
);
const workflowSource = readFileSync(
  new URL("./recognition-ai-proposal-workflow.ts", import.meta.url),
  "utf8",
);
const panelSource = readFileSync(new URL("./recognition-panel.tsx", import.meta.url), "utf8");
const applySource = readFileSync(new URL("./recognition-apply.ts", import.meta.url), "utf8");

function functionSlice(source: string, start: string, end: string): string {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex + start.length);
  expect(startIndex).toBeGreaterThanOrEqual(0);
  expect(endIndex).toBeGreaterThan(startIndex);
  return source.slice(startIndex, endIndex);
}

describe("hybrid AI proposal orchestration source contract", () => {
  it("routes omission discovery through the controller-owned proposal runner", () => {
    expect(projectAppSource).toContain("runRecognitionAiProposalDiscovery");
    expect(workflowSource).toContain("startAiProposalDiscovery");
    expect(workflowSource).toContain("buildRecognitionAiProposalRequest");
    expect(workflowSource).toContain("peekAiLocalEvidenceForDraft");
    expect(workflowSource).toContain("recognizeProposals");
    expect(workflowSource).toContain("sanitizeAiProposalBatch");
    expect(workflowSource).toContain("AI_PROPOSAL_SCHEMA_VERSION");
  });

  it("never sends raw provider proposal output into Draft replacement or document mutation", () => {
    const proposalFlow = functionSlice(
      workflowSource,
      "export async function runRecognitionAiProposalDiscovery",
      "\n}",
    );
    expect(proposalFlow).not.toContain("replaceDraft(");
    expect(proposalFlow).not.toContain("reconcileRecognition(");
    expect(proposalFlow).not.toContain("replaceProjectDocument(");
    expect(proposalFlow).not.toContain("commitRecognitionDocument(");
    expect(proposalFlow).toContain("sanitizeAiProposalBatch");
    expect(proposalFlow).toContain("sanitized: sanitizedResult.sanitized");
  });

  it("keeps local-only recognition available while proposal discovery requires an explicit provider selection", () => {
    expect(projectAppSource).toContain('"verification" | "proposals"');
    expect(projectAppSource).toContain("setCloudDialogPurpose(\"proposals\")");
    expect(projectAppSource).toContain("setCloudDialogPurpose(\"verification\")");
    expect(apartmentEditorSource).toContain("onFindAiProposals");
    expect(apartmentEditorSource).toContain("aiProposalDiscoveryAvailable");
    expect(panelSource).toContain("Найти пропущенные двери и окна с AI");
  });

  it("uses only the existing atomic recognition Apply and semantic history boundary", () => {
    expect(applySource).toContain("prepareAtomicRecognitionApply");
    expect(projectAppSource).toContain("planRecognitionApply");
    expect(projectAppSource).toContain("commitRecognitionDocument(editorStore, plan.document)");
    expect(projectAppSource).not.toContain("addOpening(");
    expect(projectAppSource).not.toContain("addTopologicalWall(");
    expect(projectAppSource).not.toContain("executeCommand(");
  });
});

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const engineSource = readFileSync(new URL("./local-recognition-engine.ts", import.meta.url), "utf8");
const workerSource = readFileSync(new URL("./recognition.worker.ts", import.meta.url), "utf8");
const clientSource = readFileSync(new URL("./local-recognition-client.ts", import.meta.url), "utf8");

describe("local recognition AI evidence source contract", () => {
  it("performs final opening analysis before creating and returning the Draft", () => {
    const analysisIndex = engineSource.indexOf("const openingAnalysis = analyzeOpeningHypotheses");
    const draftIndex = engineSource.indexOf("const draft: RecognitionDraft");
    const returnIndex = engineSource.indexOf("return draft;", draftIndex);
    expect(analysisIndex).toBeGreaterThan(-1);
    expect(draftIndex).toBeGreaterThan(analysisIndex);
    expect(returnIndex).toBeGreaterThan(draftIndex);
  });

  it("materializes rejected openings before the consuming structural evidence transfer and before posting", () => {
    const engineIndex = workerSource.indexOf("await runLocalRecognitionEngine");
    const rejectedIndex = workerSource.indexOf(
      "materializePendingAiRejectedOpeningEvidenceForDraft(",
      engineIndex,
    );
    const evidenceIndex = workerSource.indexOf(
      "materializePendingAiLocalEvidenceForDraft(",
      rejectedIndex,
    );
    const postIndex = workerSource.indexOf("type: \"result\"", evidenceIndex);
    expect(engineIndex).toBeGreaterThan(-1);
    expect(rejectedIndex).toBeGreaterThan(engineIndex);
    expect(evidenceIndex).toBeGreaterThan(rejectedIndex);
    expect(postIndex).toBeGreaterThan(evidenceIndex);
  });

  it("validates the Draft and registers both evidence transfers before resolving", () => {
    const validationIndex = clientSource.indexOf("validateRecognitionDraft(message.draft)");
    const localRegistrationIndex = clientSource.indexOf(
      "registerAiLocalEvidenceForDraft(",
      validationIndex,
    );
    const rejectedRegistrationIndex = clientSource.indexOf(
      "registerAiRejectedOpeningEvidenceForDraft(",
      localRegistrationIndex,
    );
    const resolveIndex = clientSource.indexOf("resolve(draft)", rejectedRegistrationIndex);
    expect(validationIndex).toBeGreaterThan(-1);
    expect(localRegistrationIndex).toBeGreaterThan(validationIndex);
    expect(rejectedRegistrationIndex).toBeGreaterThan(localRegistrationIndex);
    expect(resolveIndex).toBeGreaterThan(rejectedRegistrationIndex);
  });

  it("does not persist or log structural mask or rejected-opening payload bytes", () => {
    expect(engineSource).not.toContain("aiLocalEvidence:");
    expect(clientSource).not.toMatch(/recognitionInfo\([^)]*(bits|structuralMask|rejectedOpeningEvidence)/s);
  });
});

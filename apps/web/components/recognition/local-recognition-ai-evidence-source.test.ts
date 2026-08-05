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

  it("materializes bounded evidence after the engine result and before posting it", () => {
    const engineIndex = workerSource.indexOf("await runLocalRecognitionEngine");
    const evidenceIndex = workerSource.indexOf("materializePendingAiLocalEvidenceForDraft(", engineIndex);
    const postIndex = workerSource.indexOf('post({ type: "result"', evidenceIndex);
    expect(engineIndex).toBeGreaterThan(-1);
    expect(evidenceIndex).toBeGreaterThan(engineIndex);
    expect(postIndex).toBeGreaterThan(evidenceIndex);
  });

  it("validates the Draft and registers transferred evidence before resolving", () => {
    const validationIndex = clientSource.indexOf("validateRecognitionDraft(message.draft)");
    const registrationIndex = clientSource.indexOf("registerAiLocalEvidenceForDraft(", validationIndex);
    const resolveIndex = clientSource.indexOf("resolve(draft)", registrationIndex);
    expect(validationIndex).toBeGreaterThan(-1);
    expect(registrationIndex).toBeGreaterThan(validationIndex);
    expect(resolveIndex).toBeGreaterThan(registrationIndex);
  });

  it("does not persist or log structural mask bytes", () => {
    expect(engineSource).not.toContain("aiLocalEvidence:");
    expect(clientSource).not.toMatch(/recognitionInfo\([^)]*(bits|structuralMask)/s);
  });
});

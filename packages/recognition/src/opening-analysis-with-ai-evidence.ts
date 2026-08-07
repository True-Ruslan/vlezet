import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses,
} from "./opening-analysis-runtime-with-short-jamb";
import { registerPendingAiLocalEvidenceContext } from "./recognition-runtime-context";

export { validateOpeningHypotheses };

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const result = analyzeOpeningHypothesesBase(input);
  if (input.structuralMask) {
    registerPendingAiLocalEvidenceContext(
      input.wallCandidates,
      input.structuralMask,
      result.rejections,
    );
  }
  return result;
}

export type { ValidateOpeningHypothesesInput };

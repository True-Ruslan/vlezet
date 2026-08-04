import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis-runtime";
import { createWindowHostOpeningHypotheses } from "./window-host-opening-hypotheses";

export function validateOpeningHypotheses(
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  return validateOpeningHypothesesBase(input);
}

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const windowHostProposals = createWindowHostOpeningHypotheses({
    widthPx: input.widthPx,
    heightPx: input.heightPx,
    wallCandidates: input.wallCandidates,
  });
  return analyzeOpeningHypothesesBase({
    ...input,
    additionalHypotheses: [
      ...(input.additionalHypotheses ?? []),
      ...windowHostProposals,
    ],
  });
}

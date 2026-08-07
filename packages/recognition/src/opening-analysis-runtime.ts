import { detectContinuousHostDoorOpenings } from "./continuous-door-host-analysis-runtime";
import type {
  AnalyzeOpeningHypothesesInput,
  OpeningAnalysisResult,
  ValidateOpeningHypothesesInput,
} from "./opening-analysis";
import {
  analyzeOpeningHypotheses as analyzeOpeningHypothesesBase,
  validateOpeningHypotheses as validateOpeningHypothesesBase,
} from "./opening-analysis";
import { deduplicateOpeningCandidatesAcrossHosts } from "./opening-cross-host-dedup";
import { retryTerminalDoorHostValidation } from "./terminal-door-host-validation";

export function validateOpeningHypotheses(
  input: ValidateOpeningHypothesesInput,
): OpeningAnalysisResult {
  return deduplicateOpeningCandidatesAcrossHosts(
    retryTerminalDoorHostValidation(
      validateOpeningHypothesesBase(input),
      input,
    ),
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
}

export function analyzeOpeningHypotheses(
  input: AnalyzeOpeningHypothesesInput,
): OpeningAnalysisResult {
  const continuousDoorOpenings = input.structuralMask
    ? detectContinuousHostDoorOpenings({
        widthPx: input.widthPx,
        heightPx: input.heightPx,
        wallCandidates: input.wallCandidates,
        symbolSegments: input.symbolSegments ?? input.segments ?? [],
        mask: input.structuralMask,
      })
    : { openingHypotheses: [], diagnostics: [] };
  const result = analyzeOpeningHypothesesBase({
    ...input,
    additionalHypotheses: [
      ...(input.additionalHypotheses ?? []),
      ...continuousDoorOpenings.openingHypotheses,
    ],
  });
  return deduplicateOpeningCandidatesAcrossHosts(
    retryTerminalDoorHostValidation(result, {
      widthPx: input.widthPx,
      heightPx: input.heightPx,
      wallCandidates: input.wallCandidates,
      hypotheses: result.candidates,
      options: input.options,
    }),
    input.wallCandidates,
    input.widthPx,
    input.heightPx,
  );
}

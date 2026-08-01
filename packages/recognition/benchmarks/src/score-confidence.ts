import type { RecognitionConfidence } from "../../src/model";

export type ConfidenceScore = Readonly<{
  highConfidenceTruePositiveCount: number;
  highConfidenceFalsePositiveCount: number;
  mediumLowTruePositiveCount: number;
  mediumLowFalsePositiveCount: number;
  incorrectHighConfidenceRate: number;
  reviewRequiredCount: number;
}>;

export function scoreConfidence(input: Readonly<{
  matchedPredictionKeys: ReadonlySet<string>;
  predictions: readonly Readonly<{ key: string; confidence: RecognitionConfidence }>[];
}>): ConfidenceScore {
  const keys = new Set<string>();
  let highConfidenceTruePositiveCount = 0;
  let highConfidenceFalsePositiveCount = 0;
  let mediumLowTruePositiveCount = 0;
  let mediumLowFalsePositiveCount = 0;

  for (const prediction of input.predictions) {
    if (!prediction.key.trim() || keys.has(prediction.key)) {
      throw new Error("Confidence predictions должны иметь уникальные непустые keys.");
    }
    keys.add(prediction.key);
    const matched = input.matchedPredictionKeys.has(prediction.key);
    if (prediction.confidence === "high") {
      if (matched) highConfidenceTruePositiveCount += 1;
      else highConfidenceFalsePositiveCount += 1;
    } else if (matched) mediumLowTruePositiveCount += 1;
    else mediumLowFalsePositiveCount += 1;
  }

  const highConfidenceCount = highConfidenceTruePositiveCount + highConfidenceFalsePositiveCount;
  return {
    highConfidenceTruePositiveCount,
    highConfidenceFalsePositiveCount,
    mediumLowTruePositiveCount,
    mediumLowFalsePositiveCount,
    incorrectHighConfidenceRate: highConfidenceCount === 0 ? 0 : highConfidenceFalsePositiveCount / highConfidenceCount,
    reviewRequiredCount: mediumLowTruePositiveCount + mediumLowFalsePositiveCount,
  };
}

export const DEFAULT_AI_BENCHMARK_LIMITS = Object.freeze({
  maximumModels: 3,
  maximumFixtures: 12,
  maximumRepetitions: 5,
  maximumTokens: 2048,
  timeoutMs: 90_000,
  maximumCostUsd: 5,
  maximumPromptPricePerMillionUsd: 3,
  maximumCompletionPricePerMillionUsd: 15,
});

const ALLOWED_MODES = new Set(["verification", "disputed-zones", "proposal-discovery-stage1"]);

function boundedInteger(value, label, minimum, maximum) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be an integer between ${minimum} and ${maximum}.`);
  }
  return value;
}

function boundedNumber(value, label, minimumExclusive, maximum) {
  if (
    typeof value !== "number"
    || !Number.isFinite(value)
    || value <= minimumExclusive
    || value > maximum
  ) {
    throw new Error(`${label} cost must be a finite number greater than ${minimumExclusive} and at most ${maximum}.`);
  }
  return value;
}

function uniqueStrings(value, label, maximum) {
  if (!Array.isArray(value) || value.length === 0 || value.length > maximum) {
    throw new Error(`${label} must contain between 1 and ${maximum} entries.`);
  }
  const normalized = value.map((entry, index) => {
    if (typeof entry !== "string" || entry.trim().length === 0) {
      throw new Error(`${label}[${index}] must be a non-empty string.`);
    }
    return entry.trim();
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new Error(`${label} must not contain duplicates.`);
  }
  return normalized;
}

export function validateAiBenchmarkConfig(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new Error("AI benchmark config must be an object.");
  }
  const modelIds = uniqueStrings(input.modelIds, "models", DEFAULT_AI_BENCHMARK_LIMITS.maximumModels);
  const fixtureIds = uniqueStrings(input.fixtureIds, "fixtures", DEFAULT_AI_BENCHMARK_LIMITS.maximumFixtures);
  const repetitions = boundedInteger(
    input.repetitions,
    "repetitions",
    1,
    DEFAULT_AI_BENCHMARK_LIMITS.maximumRepetitions,
  );
  const maximumTokens = boundedInteger(
    input.maximumTokens,
    "maximumTokens",
    1,
    DEFAULT_AI_BENCHMARK_LIMITS.maximumTokens,
  );
  const timeoutMs = boundedInteger(
    input.timeoutMs,
    "timeoutMs",
    1_000,
    DEFAULT_AI_BENCHMARK_LIMITS.timeoutMs,
  );
  const maximumCostUsd = boundedNumber(
    input.maximumCostUsd ?? DEFAULT_AI_BENCHMARK_LIMITS.maximumCostUsd,
    "maximumCostUsd",
    0,
    DEFAULT_AI_BENCHMARK_LIMITS.maximumCostUsd,
  );
  if (!ALLOWED_MODES.has(input.mode)) {
    throw new Error(`mode must be one of: ${[...ALLOWED_MODES].join(", ")}.`);
  }
  return Object.freeze({
    schemaVersion: "recognition-ai-benchmark-config-v1",
    modelIds: Object.freeze(modelIds),
    fixtureIds: Object.freeze(fixtureIds),
    repetitions,
    maximumTokens,
    timeoutMs,
    maximumCostUsd,
    maximumPromptPricePerMillionUsd: DEFAULT_AI_BENCHMARK_LIMITS.maximumPromptPricePerMillionUsd,
    maximumCompletionPricePerMillionUsd: DEFAULT_AI_BENCHMARK_LIMITS.maximumCompletionPricePerMillionUsd,
    mode: input.mode,
    qualified: false,
  });
}

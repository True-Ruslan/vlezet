import {
  validateRecognitionBenchmarkResultV1,
  type RecognitionBenchmarkResultV1,
} from "./result-v1";

export type RecognitionBenchmarkBaselineV1 = Readonly<{
  schemaVersion: "recognition-benchmark-baseline-v1";
  productBaseSha: string;
  harnessSourceSha: string;
  result: RecognitionBenchmarkResultV1;
}>;

export class RecognitionBenchmarkBaselineValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RecognitionBenchmarkBaselineValidationError";
  }
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new RecognitionBenchmarkBaselineValidationError("Baseline должен быть объектом.");
  }
  return value as Record<string, unknown>;
}

function commitSha(value: unknown, label: string): string {
  if (typeof value !== "string" || !/^[a-f0-9]{40}$/i.test(value)) {
    throw new RecognitionBenchmarkBaselineValidationError(`${label} должен быть 40-символьным commit SHA.`);
  }
  const normalized = value.toLowerCase();
  if (normalized === "0".repeat(40)) {
    throw new RecognitionBenchmarkBaselineValidationError(`${label} не может быть all-zero marker.`);
  }
  return normalized;
}

export function validateRecognitionBenchmarkBaselineV1(value: unknown): RecognitionBenchmarkBaselineV1 {
  const input = record(value);
  if (input.schemaVersion !== "recognition-benchmark-baseline-v1") {
    throw new RecognitionBenchmarkBaselineValidationError("Неподдерживаемая версия baseline schema.");
  }
  const productBaseSha = commitSha(input.productBaseSha, "productBaseSha");
  const harnessSourceSha = commitSha(input.harnessSourceSha, "harnessSourceSha");
  const result = validateRecognitionBenchmarkResultV1(input.result);
  if (result.commitSha !== harnessSourceSha) {
    throw new RecognitionBenchmarkBaselineValidationError("result.commitSha должен совпадать с harnessSourceSha.");
  }
  if (result.baselineComparison !== null) {
    throw new RecognitionBenchmarkBaselineValidationError("Committed baseline result не должен содержать baselineComparison.");
  }
  return {
    schemaVersion: "recognition-benchmark-baseline-v1",
    productBaseSha,
    harnessSourceSha,
    result,
  };
}

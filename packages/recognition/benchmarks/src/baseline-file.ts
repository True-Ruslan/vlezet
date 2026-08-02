import { mkdir, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import type { RecognitionBenchmarkResultV1 } from "../schema/result-v1";
import { canonicalBenchmarkJson } from "./canonical-json";

export async function writeRecognitionBaseline(input: Readonly<{
  result: RecognitionBenchmarkResultV1;
  path: string;
  environment: Readonly<Record<string, string | undefined>>;
}>): Promise<void> {
  if (input.environment.RECOGNITION_BENCHMARK_WRITE_BASELINE !== "1") {
    throw new Error("Baseline write requires RECOGNITION_BENCHMARK_WRITE_BASELINE=1.");
  }
  if (input.result.commitSha === "0".repeat(40)) throw new Error("Baseline cannot use an uncommitted all-zero SHA.");
  await mkdir(dirname(input.path), { recursive: true });
  await writeFile(input.path, canonicalBenchmarkJson(input.result), "utf8");
}

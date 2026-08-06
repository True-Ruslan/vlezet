import type { AiBenchmarkConfig } from "./config.mjs";
import type { AiBenchmarkFetcher } from "./openrouter-client.mjs";

export function configFromEnvironment(environment?: NodeJS.ProcessEnv): AiBenchmarkConfig;

export function runAiBenchmark(input?: Readonly<{
  config?: AiBenchmarkConfig;
  environment?: NodeJS.ProcessEnv;
  fixturesRoot?: string;
  predictionsRoot?: string;
  outputPath?: string;
  apiKey?: string;
  fetcher?: AiBenchmarkFetcher;
  commitSha?: string | null;
}>): Promise<unknown>;

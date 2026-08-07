export type AiVerificationWall = Readonly<{
  id: string;
  confidence: "high" | "medium" | "low";
  score: number;
}>;

export type AiVerificationOpening = Readonly<{
  id: string;
  kind: "door" | "window" | "unknown-opening";
  confidence: "high" | "medium" | "low";
  score: number;
}>;

export type AiVerificationResponse = Readonly<{
  walls: readonly AiVerificationWall[];
  openings: readonly AiVerificationOpening[];
}>;

export type AiLocalCandidate = Readonly<{
  id: string;
  confidence: "high" | "medium" | "low";
  conflict: string | null;
  [key: string]: unknown;
}>;

export type AiLocalSummary = Readonly<{
  walls: readonly AiLocalCandidate[];
  openings: readonly (AiLocalCandidate & Readonly<{ kind: "door" | "window" | "unknown-opening" }>)[];
}>;

export type AiBenchmarkFetchResponse = Readonly<{
  ok: boolean;
  status?: number;
  json(): Promise<unknown>;
  text(): Promise<string>;
}>;

export type AiBenchmarkFetcher = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<AiBenchmarkFetchResponse>;

export function normalizeVerificationResponse(
  payload: unknown,
  localSummary: AiLocalSummary,
): AiVerificationResponse;

export function redactAiBenchmarkText(value: unknown): string;

export function createOpenRouterBenchmarkClient(input: Readonly<{
  apiKey: string;
  fetcher?: AiBenchmarkFetcher;
}>): Readonly<{
  verify(input: Readonly<{
    modelId: string;
    imageDataUrl: string;
    localSummary: AiLocalSummary;
    maximumTokens: number;
    timeoutMs: number;
    mode: "verification" | "disputed-zones";
    maximumPromptPricePerMillionUsd: number;
    maximumCompletionPricePerMillionUsd: number;
    signal?: AbortSignal;
  }>): Promise<Readonly<{
    response: AiVerificationResponse;
    latencyMs: number;
    usage: Readonly<{
      promptTokens: number | null;
      completionTokens: number | null;
      totalTokens: number | null;
      costUsd: number | null;
    }> | null;
    modelId: string;
  }>>;
}>;

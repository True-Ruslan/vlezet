import type { AiBenchmarkProviderMaxPrice } from "./cost-budget.mjs";

export type AiBenchmarkFetchInit = Readonly<{
  method?: string;
  headers?: Readonly<Record<string, string>>;
  signal?: AbortSignal;
  body?: string;
}>;

export type AiBenchmarkFetchResponse = Readonly<{
  ok: boolean;
  status: number;
  text(): Promise<string>;
  json(): Promise<unknown>;
}>;

export type AiBenchmarkFetcher = (
  input: string,
  init?: AiBenchmarkFetchInit,
) => Promise<AiBenchmarkFetchResponse>;

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

export type AiBenchmarkModelDescriptor = Readonly<{
  requestedModelId: string;
  modelId: string;
  contextLength: number;
  maximumCompletionTokens: number | null;
  supportsReasoning: boolean;
}>;

export function normalizeVerificationResponse(
  payload: unknown,
  localSummary: AiLocalSummary,
): AiVerificationResponse;

export function redactAiBenchmarkText(value: unknown): string;

export function createOpenRouterBenchmarkClient(input: Readonly<{
  apiKey: string;
  fetcher?: AiBenchmarkFetcher;
}>): Readonly<{
  describeModel(input: Readonly<{
    modelId: string;
    timeoutMs: number;
    signal?: AbortSignal;
  }>): Promise<AiBenchmarkModelDescriptor>;
  verify(input: Readonly<{
    modelId: string;
    imageDataUrl: string;
    localSummary: AiLocalSummary;
    maximumTokens: number;
    timeoutMs: number;
    mode: "verification" | "disputed-zones";
    providerMaxPrice: AiBenchmarkProviderMaxPrice;
    disableReasoning: boolean;
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

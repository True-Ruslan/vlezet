export type AiBenchmarkProviderMaxPrice = Readonly<{
  prompt: number;
  completion: number;
  image: number;
  request: number;
}>;

export function createAiBenchmarkCostBudget(input: Readonly<{
  maximumCostUsd: number;
  totalRequestCount: number;
}>): Readonly<{
  next(request: Readonly<{
    contextLength: number;
    maximumTokens: number;
    imageCount: number;
  }>): Readonly<{
    allocationUsd: number;
    providerMaxPrice: AiBenchmarkProviderMaxPrice;
  }>;
}>;

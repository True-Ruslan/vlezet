const TOKENS_PER_MILLION = 1_000_000;
const PRICE_BUDGET_WEIGHTS = Object.freeze({
  prompt: 0.8,
  completion: 0.15,
  image: 0.025,
  request: 0.025,
});

function positiveFinite(value, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be a positive finite number.`);
  }
  return value;
}

function positiveInteger(value, label) {
  if (!Number.isInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive integer.`);
  }
  return value;
}

export function createAiBenchmarkCostBudget(input) {
  const maximumCostUsd = positiveFinite(input?.maximumCostUsd, "maximumCostUsd");
  const totalRequestCount = positiveInteger(input?.totalRequestCount, "totalRequestCount");
  const allocationUsd = maximumCostUsd / totalRequestCount;
  let allocationCount = 0;

  return Object.freeze({
    next(request) {
      if (allocationCount >= totalRequestCount) {
        throw new Error("AI benchmark cost budget is exhausted.");
      }
      const contextLength = positiveInteger(request?.contextLength, "contextLength");
      const maximumTokens = positiveInteger(request?.maximumTokens, "maximumTokens");
      const imageCount = positiveInteger(request?.imageCount, "imageCount");
      if (contextLength <= maximumTokens) {
        throw new Error("contextLength must exceed maximumTokens to bound prompt cost.");
      }
      allocationCount += 1;
      const maximumPromptTokens = contextLength - maximumTokens;
      return Object.freeze({
        allocationUsd,
        providerMaxPrice: Object.freeze({
          prompt: allocationUsd * PRICE_BUDGET_WEIGHTS.prompt * TOKENS_PER_MILLION / maximumPromptTokens,
          completion: allocationUsd * PRICE_BUDGET_WEIGHTS.completion * TOKENS_PER_MILLION / maximumTokens,
          image: allocationUsd * PRICE_BUDGET_WEIGHTS.image / imageCount,
          request: allocationUsd * PRICE_BUDGET_WEIGHTS.request,
        }),
      });
    },
  });
}

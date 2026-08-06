import { describe, expect, it } from "vitest";
import { createAiBenchmarkCostBudget } from "../../../tools/recognition-benchmark/ai-benchmark/cost-budget.mjs";

describe("AI benchmark hard cost allocator", () => {
  it("keeps the absolute prompt, completion, image and request maximum inside one allocation", () => {
    const budget = createAiBenchmarkCostBudget({ maximumCostUsd: 3, totalRequestCount: 3 });
    const allocation = budget.next({
      contextLength: 1_000_000,
      maximumTokens: 2_000,
      imageCount: 2,
    });
    expect(allocation.allocationUsd).toBe(1);
    const maximumCost = allocation.providerMaxPrice.prompt * 998_000 / 1_000_000
      + allocation.providerMaxPrice.completion * 2_000 / 1_000_000
      + allocation.providerMaxPrice.image * 2
      + allocation.providerMaxPrice.request;
    expect(maximumCost).toBeLessThanOrEqual(1);
  });

  it("never allocates more paid requests than the declared schedule", () => {
    const budget = createAiBenchmarkCostBudget({ maximumCostUsd: 1, totalRequestCount: 1 });
    budget.next({ contextLength: 10_000, maximumTokens: 1_000, imageCount: 1 });
    expect(() => budget.next({
      contextLength: 10_000,
      maximumTokens: 1_000,
      imageCount: 1,
    })).toThrow(/exhausted/i);
  });

  it("fails closed when the model context cannot bound prompt tokens", () => {
    const budget = createAiBenchmarkCostBudget({ maximumCostUsd: 1, totalRequestCount: 1 });
    expect(() => budget.next({
      contextLength: 1_000,
      maximumTokens: 1_000,
      imageCount: 1,
    })).toThrow(/contextLength/i);
  });
});

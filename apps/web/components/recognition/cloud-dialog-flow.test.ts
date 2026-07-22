import { describe, expect, it, vi } from "vitest";
import { resolveCloudRecognitionRequest } from "./cloud-dialog-flow";

const models = [
  { id: "model-a", name: "Model A", contextLength: 100_000 },
  { id: "model-b", name: "Model B", contextLength: 200_000 },
] as const;

describe("cloud recognition dialog flow", () => {
  it("uses an already selected compatible model without reloading models", async () => {
    const loadModels = vi.fn(async () => models);
    const result = await resolveCloudRecognitionRequest({
      apiKey: "  secret-key  ",
      selectedModelId: "model-b",
      knownModels: models,
      loadModels,
    });

    expect(loadModels).not.toHaveBeenCalled();
    expect(result).toEqual({ apiKey: "secret-key", modelId: "model-b", models });
  });

  it("loads compatible models and auto-selects the first one when Analyze is pressed directly", async () => {
    const loadModels = vi.fn(async () => models);
    const result = await resolveCloudRecognitionRequest({
      apiKey: "secret-key",
      selectedModelId: "",
      knownModels: [],
      loadModels,
    });

    expect(loadModels).toHaveBeenCalledOnce();
    expect(result.modelId).toBe("model-a");
    expect(result.models).toEqual(models);
  });

  it("fails visibly instead of silently doing nothing when no compatible model exists", async () => {
    await expect(resolveCloudRecognitionRequest({
      apiKey: "secret-key",
      selectedModelId: "",
      knownModels: [],
      loadModels: async () => [],
    })).rejects.toThrow(/совместим/i);
  });
});

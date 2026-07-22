import type { OpenRouterModelOption } from "./openrouter-provider";

export type ResolveCloudRecognitionRequestInput = Readonly<{
  apiKey: string;
  selectedModelId: string;
  knownModels: readonly OpenRouterModelOption[];
  loadModels: () => Promise<readonly OpenRouterModelOption[]>;
}>;

export type ResolvedCloudRecognitionRequest = Readonly<{
  apiKey: string;
  modelId: string;
  models: readonly OpenRouterModelOption[];
}>;

export async function resolveCloudRecognitionRequest(
  input: ResolveCloudRecognitionRequestInput,
): Promise<ResolvedCloudRecognitionRequest> {
  const apiKey = input.apiKey.trim();
  if (!apiKey) throw new Error("Введите OpenRouter API key.");

  if (input.selectedModelId && input.knownModels.some((model) => model.id === input.selectedModelId)) {
    return { apiKey, modelId: input.selectedModelId, models: input.knownModels };
  }

  const models = await input.loadModels();
  const modelId = models[0]?.id ?? "";
  if (!modelId) throw new Error("Не найдено совместимых vision-моделей со structured output.");
  return { apiKey, modelId, models };
}

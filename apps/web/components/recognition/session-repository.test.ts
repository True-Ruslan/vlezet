import { describe, expect, it } from "vitest";
import { assertRecognitionSessionHasNoSecrets } from "./session-repository";

describe("recognition session persistence security", () => {
  it("accepts non-secret cloud metadata", () => {
    expect(() => assertRecognitionSessionHasNoSecrets({ cloudMetadata: { providerId: "openrouter", modelId: "model" } })).not.toThrow();
  });

  it.each([
    { apiKey: "sk-secret" },
    { nested: { authorization: "Bearer secret" } },
    { nested: [{ bearer_token: "secret" }] },
  ])("rejects persisted secret-shaped keys %#", (value) => {
    expect(() => assertRecognitionSessionHasNoSecrets(value)).toThrow(/секрет/i);
  });
});

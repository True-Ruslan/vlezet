import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./recognition-panel.tsx", import.meta.url), "utf8");

describe("recognition AI verification warning presentation", () => {
  it("surfaces weak verification diagnostics without changing candidate decisions", () => {
    expect(source).toContain('diagnostic.code === "weak-ai-verification-profile"');
    expect(source).toContain('title="AI-проверка требует сравнения"');
    expect(source).toContain("{aiVerificationWarning.message}");
    expect(source).not.toContain("onDecision(candidate.id, \"rejected\")");
    expect(source).not.toContain("autoRevert");
  });
});

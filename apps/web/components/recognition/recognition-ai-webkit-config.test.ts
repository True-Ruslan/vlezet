import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const webkitConfig = readFileSync(
  new URL("../../../../tools/m7-browser-audit/playwright.webkit.config.mjs", import.meta.url),
  "utf8",
);
const representativeSpec = readFileSync(
  new URL("../../../../tools/m7-browser-audit/recognition-ai-proposals-webkit.spec.mjs", import.meta.url),
  "utf8",
);

describe("WebKit AI proposal acceptance wiring", () => {
  it("uses the isolated representative spec instead of the Chromium source-and-cancellation flow", () => {
    expect(webkitConfig).toContain('"recognition-ai-proposals-webkit.spec.mjs"');
    expect(webkitConfig).not.toContain('"recognition-ai-proposals.spec.mjs"');
  });

  it("seeds project and recognition session through separate production-shaped transactions", () => {
    expect(representativeSpec).toContain('await write(\n        ["projects", "settings"]');
    expect(representativeSpec).toContain('await write(\n        ["recognitionSessions"]');
    expect(representativeSpec).not.toContain('["projects", "assets", "settings"');
    expect(representativeSpec).toContain("WebKit reviews, applies and restores an eligible recorded AI door");
  });
});

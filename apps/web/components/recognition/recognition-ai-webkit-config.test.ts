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

  it("creates the production IndexedDB schema when the fixture wins the version upgrade race", () => {
    expect(representativeSpec).toContain("request.onupgradeneeded = () =>");
    expect(representativeSpec).toContain('ensureStore("projects", "id")');
    expect(representativeSpec).toContain('ensureStore("recognitionSessions", "id")');
    expect(representativeSpec).toContain('createIndex("projectId", "projectId", { unique: true })');
  });

  it("uses the canonical four-wall local Draft that owns the recorded fingerprint", () => {
    for (const wallId of ["wall-door-host", "wall-window-host", "anchor-left", "wall-washbasin"]) {
      expect(representativeSpec).toContain(`id: "${wallId}"`);
      expect(representativeSpec).toContain(`"${wallId}": "pending"`);
    }
    expect(representativeSpec).toContain("structural-clutter-veto");
    expect(representativeSpec).toContain(
      "recognition-local-draft-v1:bc170b3e112ce71ab22b8d3e66a081b70ee063c645557377b917c70bc1543abf",
    );
  });

  it("waits for the real autosave lifecycle before inspecting persisted Apply state", () => {
    expect(representativeSpec).toContain("armAutosaveTransitionProbe");
    expect(representativeSpec).toContain("waitForAutosaveCycle");
    expect(representativeSpec).toContain('.project-title-stack');
    expect(representativeSpec).toContain('.save-status');
    expect(representativeSpec).toContain('transition.saving');
    expect(representativeSpec).toContain('transition.saved');
    expect(representativeSpec).not.toContain('expect.poll(async () => {\n    const project = await readRecord');
  });
});

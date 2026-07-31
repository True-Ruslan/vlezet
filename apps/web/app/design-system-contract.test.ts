import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("M7.3 design-system foundation", () => {
  it("defines balanced-density semantic tokens and compatibility aliases", () => {
    const tokens = readFileSync(new URL("./design-tokens.css", import.meta.url), "utf8");

    for (const token of [
      "--color-surface",
      "--color-text-primary",
      "--color-accent",
      "--color-success",
      "--color-warning",
      "--color-danger",
      "--color-info",
      "--font-body",
      "--font-compact",
      "--font-helper",
      "--control-height",
      "--control-height-compact",
      "--focus-ring",
      "--bg",
      "--panel",
      "--text",
      "--muted",
      "--line",
      "--accent",
      "--accent-soft",
      "--danger",
    ]) {
      expect(tokens).toContain(token);
    }

    expect(tokens).toContain("--font-helper: 12px");
    expect(tokens).toContain("--control-height: 40px");
  });

  it("loads tokens and primitives before feature styles", () => {
    const primitives = readFileSync(new URL("./ui-primitives.css", import.meta.url), "utf8");

    expect(layout.indexOf('"./design-tokens.css"')).toBeGreaterThanOrEqual(0);
    expect(layout.indexOf('"./ui-primitives.css"')).toBeGreaterThanOrEqual(0);
    expect(layout.indexOf('"./design-tokens.css"')).toBeLessThan(layout.indexOf('"./globals.css"'));
    expect(layout.indexOf('"./ui-primitives.css"')).toBeLessThan(layout.indexOf('"./globals.css"'));
    expect(primitives).toContain(".ui-button");
  });
});

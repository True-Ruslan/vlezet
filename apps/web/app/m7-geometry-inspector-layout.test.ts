import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const css = readFileSync(new URL("./m7-geometry-inspector.css", import.meta.url), "utf8")
  .replace(/\s+/g, " ");
const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");

describe("M7.6 geometry inspector layout", () => {
  it("keeps cards and visual cues inside the context column", () => {
    expect(css).toContain(".geometry-inspector-card { min-width: 0; overflow: hidden;");
    expect(css).toContain(".geometry-cue { width: 100%; max-width: 100%;");
    expect(css).toContain(".door-swing-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr));");
  });

  it("stacks door choices at compact width and imports the stylesheet", () => {
    expect(css).toContain("@media (max-width: 420px)");
    expect(css).toContain(".door-swing-grid { grid-template-columns: minmax(0, 1fr);");
    expect(layout).toContain('import "./m7-geometry-inspector.css";');
  });
});

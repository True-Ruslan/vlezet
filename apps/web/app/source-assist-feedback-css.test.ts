import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const layout = readFileSync(new URL("./layout.tsx", import.meta.url), "utf8");
const feedback = readFileSync(new URL("./source-assist-feedback.css", import.meta.url), "utf8");

describe("M8.4 source assist visible feedback", () => {
  it("loads a dedicated stylesheet from the root layout", () => {
    expect(layout).toContain('import "./source-assist-feedback.css"');
  });

  it("shows explicit non-interactive feedback only for an acquired canvas source candidate", () => {
    expect(feedback).toContain('.canvas-shell[data-source-assist="acquired"]::after');
    expect(feedback).toContain('content:"По подложке"');
    expect(feedback).toContain("pointer-events:none");
    expect(feedback).not.toContain('.canvas-shell[data-source-assist="idle"]::after');
  });
});

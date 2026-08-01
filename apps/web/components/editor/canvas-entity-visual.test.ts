import { describe, expect, it } from "vitest";
import { deriveCanvasEntityVisual } from "./canvas-entity-visual";

describe("M7.4 Canvas entity visual roles", () => {
  it("keeps ordinary, hover and selection visually ordered", () => {
    const ordinary = deriveCanvasEntityVisual("ordinary");
    const hover = deriveCanvasEntityVisual("hover");
    const selected = deriveCanvasEntityVisual("selected");

    expect(ordinary).toEqual({ strokeRole: "ordinary", dash: null, marker: "none", emphasized: false });
    expect(hover).toEqual({ strokeRole: "hover", dash: [4, 3], marker: "none", emphasized: false });
    expect(selected).toEqual({ strokeRole: "accent", dash: null, marker: "none", emphasized: true });
  });

  it("marks both previews as temporary and invalid preview explicitly", () => {
    expect(deriveCanvasEntityVisual("preview-valid")).toEqual({
      strokeRole: "accent",
      dash: [7, 5],
      marker: "preview",
      emphasized: true,
    });
    expect(deriveCanvasEntityVisual("preview-invalid")).toEqual({
      strokeRole: "danger",
      dash: [7, 5],
      marker: "invalid",
      emphasized: true,
    });
  });
});

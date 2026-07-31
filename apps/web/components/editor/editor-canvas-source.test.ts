import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M7.4 live Canvas feedback integration", () => {
  it("keeps hovered identity local while publishing only semantic feedback", () => {
    expect(source).toContain('from "./canvas-transient-feedback-store"');
    expect(source).toContain('from "./canvas-entity-visual"');
    expect(source).toContain("const [hoveredEntity, setHoveredEntity]");
    expect(source).toContain("setHoveredCanvasEntity");
    expect(source).toContain("canvasTransientFeedbackStore.getState().setHoveredSelectable");
    expect(source).toContain("canvasTransientFeedbackStore.getState().reset()");
  });

  it("applies hover semantics to rooms, walls, openings and furniture", () => {
    expect(source).toContain('kind: "room"');
    expect(source).toContain('kind: "wall"');
    expect(source).toContain('kind: "opening"');
    expect(source).toContain('kind: "object"');
    expect(source).toContain("deriveCanvasEntityVisual");
    expect(source).toContain("hovered={hoveredEntity?.kind === \"object\" && hoveredEntity.id === object.id}");
    expect(source).toContain("onHoverChange={(hovered) => setHoveredCanvasEntity");
  });

  it("publishes valid and invalid preview state and labels opening previews", () => {
    expect(source).toContain("setPreviewState");
    expect(source).toContain('text={visibleOpeningPreview.valid ? "Предпросмотр" : "Недопустимо"}');
    expect(source).toContain('data-preview-state={livePreviewState}');
  });

  it("publishes ready and active pan state without changing viewport authority", () => {
    expect(source).toContain('setPanState(spacePressed ? "ready" : "idle")');
    expect(source).toContain('setPanState("active")');
    expect(source).toContain("commitViewport(next)");
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { CanvasFeedback } from "./editor-canvas-feedback";
import { EditorCanvasStatus } from "./editor-canvas-status";

const base: CanvasFeedback = {
  mode: "wall-finish",
  label: "Стена · вторая точка",
  instruction: "Укажите вторую точку стены.",
  escapeInstruction: "Esc — отменить текущий отрезок.",
  cursor: "crosshair",
  previewState: "none",
};

describe("M7.4 Canvas status", () => {
  it("renders authoritative mode, next action and cancellation copy", () => {
    const html = renderToStaticMarkup(<EditorCanvasStatus feedback={base} />);

    expect(html).toContain('role="status"');
    expect(html).toContain('aria-live="polite"');
    expect(html).toContain('data-canvas-mode="wall-finish"');
    expect(html).toContain("Стена · вторая точка");
    expect(html).toContain("Укажите вторую точку стены.");
    expect(html).toContain("Esc — отменить текущий отрезок.");
  });

  it("labels temporary and invalid previews with text", () => {
    const valid = renderToStaticMarkup(<EditorCanvasStatus feedback={{ ...base, previewState: "valid" }} />);
    const invalid = renderToStaticMarkup(<EditorCanvasStatus feedback={{ ...base, previewState: "invalid" }} />);

    expect(valid).toContain("Предпросмотр");
    expect(valid).toContain('data-preview-state="valid"');
    expect(invalid).toContain("Недопустимо");
    expect(invalid).toContain('data-preview-state="invalid"');
  });

  it("omits empty cancellation copy", () => {
    const html = renderToStaticMarkup(<EditorCanvasStatus feedback={{ ...base, escapeInstruction: null }} />);
    expect(html).not.toContain("canvas-mode-escape");
  });
});

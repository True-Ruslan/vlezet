import type { CanvasFeedback } from "./editor-canvas-feedback";

export function EditorCanvasStatus({ feedback }: Readonly<{ feedback: CanvasFeedback }>) {
  const previewLabel = feedback.previewState === "valid"
    ? "Предпросмотр"
    : feedback.previewState === "invalid"
      ? "Недопустимо"
      : null;

  return (
    <div
      className="canvas-mode-status"
      role="status"
      aria-live="polite"
      aria-atomic="true"
      data-canvas-mode={feedback.mode}
      data-preview-state={feedback.previewState}
    >
      <div className="canvas-mode-status-heading">
        <strong className="canvas-mode-label">{feedback.label}</strong>
        {previewLabel ? <span className={`canvas-mode-preview is-${feedback.previewState}`}>{previewLabel}</span> : null}
      </div>
      <span className="canvas-mode-instruction">{feedback.instruction}</span>
      {feedback.escapeInstruction ? <span className="canvas-mode-escape">{feedback.escapeInstruction}</span> : null}
    </div>
  );
}

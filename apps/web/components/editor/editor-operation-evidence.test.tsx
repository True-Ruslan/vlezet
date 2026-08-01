import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorOperationEvidenceNotice } from "./editor-operation-evidence";
import type { EditorOperationEvidence } from "./editor-operation-evidence-store";

function render(evidence: EditorOperationEvidence) {
  return renderToStaticMarkup(
    <EditorOperationEvidenceNotice
      evidence={evidence}
      onAction={() => {}}
      onDismiss={() => {}}
    />,
  );
}

describe("M7.5 durable operation evidence", () => {
  it("renders successful evidence through the shared notice system", () => {
    const html = render({
      id: "e1",
      projectId: "p1",
      kind: "planning-applied",
      tone: "success",
      title: "Вариант расстановки применён",
      description: "Положение выбранной мебели обновлено.",
      sourceContext: "planning",
      action: { kind: "undo" },
    });
    expect(html).toContain("ui-notice");
    expect(html).toContain('data-operation-kind="planning-applied"');
    expect(html).toContain("Отменить изменение");
    expect(html).toContain('aria-label="Закрыть подтверждение операции"');
    expect(html).not.toContain(">ОК<");
  });

  it("renders recovery evidence with an explicit workflow action", () => {
    const html = render({
      id: "e2",
      projectId: "p1",
      kind: "recoverable-failure",
      tone: "error",
      title: "Не удалось применить распознавание",
      description: "Проект не изменён. Черновик проверки сохранён.",
      sourceContext: "recognition",
      action: { kind: "open-recognition-review" },
    });
    expect(html).toContain('data-tone="error"');
    expect(html).toContain("Вернуться к проверке");
  });
});

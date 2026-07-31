import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RecognitionPanel, recognitionWorkflowPhase } from "./recognition-panel";

const callbacks = {
  selectedCandidateId: null,
  navigation: { label: "К предмету «Диван»", onNavigate: () => undefined },
  onStartLocal: () => undefined,
  onSelect: () => undefined,
  onDecision: () => undefined,
  onReclassifyOpening: () => undefined,
  onAcceptHighConfidence: () => undefined,
  onRunCloud: () => undefined,
  onApply: () => undefined,
  onDiscard: () => undefined,
} as const;

describe("RecognitionPanel design-system migration", () => {
  it("uses shared prerequisite and error feedback without changing workflow labels", () => {
    const idle = renderToStaticMarkup(
      <RecognitionPanel
        state={{ kind: "idle", session: null }}
        hasReferencePlan={false}
        missingReferenceAsset={false}
        {...callbacks}
      />,
    );
    const error = renderToStaticMarkup(
      <RecognitionPanel
        state={{ kind: "error", session: null, message: "Не удалось распознать план." }}
        hasReferencePlan
        missingReferenceAsset={false}
        {...callbacks}
      />,
    );

    expect(idle).toContain("ui-notice-warning");
    expect(idle).toContain("ui-button ui-button-primary");
    expect(error).toContain("ui-notice-error");
    expect(error).toContain('role="alert"');
    expect(recognitionWorkflowPhase({ kind: "idle", session: null })).toBe("Готово к локальному анализу");
  });

  it("delegates shared anatomy to primitives and keeps recognition-specific layout external", () => {
    const source = readFileSync(new URL("./recognition-panel.tsx", import.meta.url), "utf8");
    const featureStyles = readFileSync(new URL("../../app/recognition-panel.css", import.meta.url), "utf8");
    const migrationStyles = readFileSync(new URL("../../app/design-system-migrations.css", import.meta.url), "utf8");

    expect(source).not.toContain("const styles = `");
    expect(source).not.toContain("<style>{styles}</style>");
    for (const primitive of ["UiNotice", "UiBadge", "UiCard", "UiField", "UiButton", "UiEmptyState"]) {
      expect(source).toContain(primitive);
    }
    expect(source).toContain("Уверенность:");
    expect(source).toContain("props.onDecision");
    expect(source).toContain("props.onApply");
    expect(featureStyles).toContain(".recognition-candidate-list");
    expect(featureStyles).not.toContain(".recognition-modal");
    expect(migrationStyles).toContain(".canvas-help");
    expect(migrationStyles).toContain("font-size: var(--font-helper)");
  });
});

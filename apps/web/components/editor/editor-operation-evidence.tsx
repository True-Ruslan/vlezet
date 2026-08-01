import { UiButton } from "../ui/ui-button";
import { UiNotice } from "../ui/ui-feedback";
import type { EditorEvidenceAction, EditorOperationEvidence } from "./editor-operation-evidence-store";

export type EditorOperationEvidenceNoticeProps = Readonly<{
  evidence: EditorOperationEvidence;
  onAction: (action: EditorEvidenceAction) => void;
  onDismiss: () => void;
}>;

function actionLabel(action: EditorEvidenceAction): string {
  switch (action.kind) {
    case "select-room": return "Открыть комнату";
    case "open-recognition-review": return "Вернуться к проверке";
    case "undo": return "Отменить изменение";
    case "dismiss": return "Закрыть";
  }
}

export function EditorOperationEvidenceNotice({ evidence, onAction, onDismiss }: EditorOperationEvidenceNoticeProps) {
  const action = evidence.action;
  return (
    <section className="editor-operation-evidence" data-operation-kind={evidence.kind}>
      <UiNotice
        tone={evidence.tone}
        title={evidence.title}
        live
        action={(
          <div className="editor-operation-evidence-actions">
            {action ? (
              <UiButton variant={evidence.tone === "error" ? "primary" : "secondary"} onClick={() => onAction(action)}>
                {actionLabel(action)}
              </UiButton>
            ) : null}
            <UiButton
              variant="icon"
              aria-label="Закрыть подтверждение операции"
              onClick={onDismiss}
            >
              ×
            </UiButton>
          </div>
        )}
      >
        <p>{evidence.description}</p>
      </UiNotice>
    </section>
  );
}

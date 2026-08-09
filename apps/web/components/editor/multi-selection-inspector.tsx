import type { VlezetDocument } from "@vlezet/domain";
import { ContextActionArea, ContextPanelFrame, ContextSection } from "./context-panel-frame";
import { EDITOR_COMMANDS, type EditorCommandId } from "./editor-commands";
import {
  deriveSelectionCapabilities,
  type SelectionCapabilities,
} from "./editor-selection-capabilities";
import {
  sanitizeEditorSelection,
  type EditorEntityKind,
  type EditorSelection,
} from "./editor-selection";

const TYPE_SUMMARIES: readonly Readonly<{
  kind: EditorEntityKind;
  label: string;
}>[] = [
  { kind: "wall", label: "Стены" },
  { kind: "vertex", label: "Узлы" },
  { kind: "room", label: "Комнаты" },
  { kind: "opening", label: "Проёмы" },
  { kind: "placed-object", label: "Предметы" },
];

const COMMON_COMMANDS: readonly Readonly<{
  command: EditorCommandId;
  capability: keyof Pick<SelectionCapabilities, "copy" | "cut" | "duplicate" | "delete">;
}>[] = [
  { command: "selection.copy", capability: "copy" },
  { command: "selection.cut", capability: "cut" },
  { command: "selection.duplicate", capability: "duplicate" },
  { command: "selection.delete", capability: "delete" },
];

const COMMAND_LABELS = new Map(EDITOR_COMMANDS.map((descriptor) => [descriptor.id, descriptor.label]));

function blockedReason(capabilities: SelectionCapabilities): string | null {
  for (const capability of [
    capabilities.copy,
    capabilities.cut,
    capabilities.duplicate,
    capabilities.delete,
  ]) {
    if (!capability.enabled && capability.reason) return capability.reason;
  }
  return null;
}

export function MultiSelectionInspector({
  document,
  selection,
  hasPlacedObjectClipboard,
  executeCommand,
}: Readonly<{
  document: VlezetDocument;
  selection: EditorSelection;
  hasPlacedObjectClipboard: boolean;
  executeCommand: (command: EditorCommandId) => unknown;
}>) {
  const safeSelection = sanitizeEditorSelection(document, selection);
  const capabilities = deriveSelectionCapabilities({
    document,
    selection: safeSelection,
    hasPlacedObjectClipboard,
  });
  const reason = blockedReason(capabilities);
  const counts = new Map<EditorEntityKind, number>();
  for (const ref of safeSelection.refs) counts.set(ref.kind, (counts.get(ref.kind) ?? 0) + 1);
  const commands = COMMON_COMMANDS.flatMap(({ command, capability }) => {
    if (!capabilities[capability].enabled) return [];
    const label = COMMAND_LABELS.get(command);
    return label ? [{ command, label }] : [];
  });

  return (
    <ContextPanelFrame
      descriptor={{
        kind: "multi-selection",
        category: "selection",
        eyebrow: "Выделение",
        title: `Выбрано: ${safeSelection.refs.length}`,
        subtitle: "Общие свойства показываются только когда они действительно общие.",
      }}
      className="multi-selection-inspector"
    >
      <ContextSection title="Состав">
        <ul className="multi-selection-summary" aria-label="Состав выделения">
          {TYPE_SUMMARIES.flatMap(({ kind, label }) => {
            const count = counts.get(kind) ?? 0;
            return count > 0 ? [<li key={kind}>{label}: {count}</li>] : [];
          })}
        </ul>
      </ContextSection>

      <ContextSection>
        <ContextActionArea>
          {commands.length > 0 ? (
            <details className="multi-selection-actions-menu" style={{ position: "relative" }}>
              <summary className="secondary-action multi-selection-actions-trigger">
                <span>Действия</span>
                <span aria-hidden="true">···</span>
              </summary>
              <div className="editor-actions-popover multi-selection-actions-popover">
                {commands.map(({ command, label }) => (
                  <button key={command} type="button" onClick={() => executeCommand(command)}>
                    {label}
                  </button>
                ))}
              </div>
            </details>
          ) : null}
        </ContextActionArea>
        {reason ? <p className="multi-selection-blocked-reason">{reason}</p> : null}
      </ContextSection>
    </ContextPanelFrame>
  );
}

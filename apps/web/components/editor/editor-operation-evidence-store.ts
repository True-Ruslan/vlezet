import { createStore } from "zustand/vanilla";

export type EditorOperationKind =
  | "first-room-created"
  | "recognition-applied"
  | "planning-applied"
  | "project-backup-exported"
  | "recoverable-failure";

export type EditorEvidenceAction =
  | Readonly<{ kind: "select-room"; roomId: string }>
  | Readonly<{ kind: "open-recognition-review" }>
  | Readonly<{ kind: "retry-project-backup" }>
  | Readonly<{ kind: "undo" }>
  | Readonly<{ kind: "dismiss" }>;

export type EditorOperationEvidence = Readonly<{
  id: string;
  projectId: string;
  kind: EditorOperationKind;
  tone: "success" | "warning" | "error";
  title: string;
  description: string;
  sourceContext: "canvas" | "recognition" | "planning" | "project";
  entityId?: string;
  action?: EditorEvidenceAction;
}>;

export type EditorOperationEvidenceState = Readonly<{
  evidence: EditorOperationEvidence | null;
  publish: (evidence: EditorOperationEvidence) => void;
  dismiss: () => void;
  clearForProjectSwitch: () => void;
}>;

export function createEditorOperationEvidenceStore() {
  return createStore<EditorOperationEvidenceState>()((set) => ({
    evidence: null,
    publish: (evidence) => set({ evidence }),
    dismiss: () => set({ evidence: null }),
    clearForProjectSwitch: () => set({ evidence: null }),
  }));
}

export const editorOperationEvidenceStore = createEditorOperationEvidenceStore();

export function visibleEditorOperationEvidence(
  evidence: EditorOperationEvidence | null,
  projectId: string,
  validRoomIds: ReadonlySet<string> = new Set(),
): EditorOperationEvidence | null {
  if (!evidence || evidence.projectId !== projectId) return null;
  if (evidence.action?.kind === "select-room" && !validRoomIds.has(evidence.action.roomId)) return null;
  return evidence;
}

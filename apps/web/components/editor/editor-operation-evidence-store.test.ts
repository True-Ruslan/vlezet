import { describe, expect, it } from "vitest";
import {
  createEditorOperationEvidenceStore,
  visibleEditorOperationEvidence,
  type EditorOperationEvidence,
} from "./editor-operation-evidence-store";

function evidence(patch: Partial<EditorOperationEvidence> = {}): EditorOperationEvidence {
  return {
    id: "evidence-1",
    projectId: "project-1",
    kind: "first-room-created",
    tone: "success",
    title: "Первая комната создана",
    description: "Комната готова.",
    sourceContext: "canvas",
    action: { kind: "select-room", roomId: "room-1" },
    ...patch,
  };
}

describe("M7.5 editor operation evidence store", () => {
  it("keeps at most one active evidence item", () => {
    const store = createEditorOperationEvidenceStore();
    store.getState().publish(evidence());
    store.getState().publish(evidence({ id: "evidence-2", kind: "project-backup-exported" }));
    expect(store.getState().evidence?.id).toBe("evidence-2");
  });

  it("dismisses and clears evidence at project boundaries", () => {
    const store = createEditorOperationEvidenceStore();
    store.getState().publish(evidence());
    store.getState().dismiss();
    expect(store.getState().evidence).toBeNull();
    store.getState().publish(evidence());
    store.getState().clearForProjectSwitch();
    expect(store.getState().evidence).toBeNull();
  });

  it("shows evidence only for the current project", () => {
    expect(visibleEditorOperationEvidence(evidence(), "project-1", new Set(["room-1"]))).not.toBeNull();
    expect(visibleEditorOperationEvidence(evidence(), "project-2", new Set(["room-1"]))).toBeNull();
  });

  it("discards stale room actions when the referenced room is gone", () => {
    expect(visibleEditorOperationEvidence(evidence(), "project-1", new Set())).toBeNull();
    expect(visibleEditorOperationEvidence(
      evidence({ kind: "project-backup-exported", action: { kind: "dismiss" } }),
      "project-1",
      new Set(),
    )).not.toBeNull();
  });
});

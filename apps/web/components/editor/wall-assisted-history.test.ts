import { describe, expect, it } from "vitest";
import { resolveWallPointerAssist } from "./wall-pointer-assist";
import { editorStore } from "./use-editor-store";

const structural = {
  candidateId: "grid:1000:0",
  point: { x: 1000, y: 0 },
  kind: "grid" as const,
  label: "Сетка",
  guides: [],
  target: null,
};

const sourceAssist = {
  acquired: true,
  candidateId: "source-line-1",
  kind: "line-center" as const,
  sourcePoint: { x: 100, y: 50 },
  worldPoint: { x: 1200, y: 0 },
  reason: "acquired" as const,
};

describe("M8.4 source-assisted wall history", () => {
  it("commits one ordinary history command and preserves semantic Undo/Redo without source metadata", () => {
    editorStore.setState(editorStore.getInitialState(), true);
    const initialDocument = editorStore.getState().history.document;

    const decision = resolveWallPointerAssist({ structuralSnap: structural, sourceAssist });
    expect(decision.authority).toBe("source");

    editorStore.getState().beginWall({ x: 0, y: 0 });
    editorStore.getState().updateDraftWall({
      point: decision.point,
      kind: "none",
      guides: [],
    });
    editorStore.getState().commitDraftWall();

    const afterCommit = editorStore.getState();
    expect(afterCommit.history.past).toHaveLength(1);
    expect(afterCommit.history.document.walls).toHaveLength(1);
    expect(afterCommit.history.document.vertices.map((vertex) => vertex.position)).toContainEqual({ x: 1200, y: 0 });
    expect(JSON.stringify(afterCommit.history.document)).not.toMatch(/sourceAssist|sourceCandidate|candidateId|referenceRevision/);

    afterCommit.undo();
    expect(editorStore.getState().history.document).toEqual(initialDocument);
    expect(editorStore.getState().history.document.walls).toHaveLength(0);

    editorStore.getState().redo();
    const afterRedo = editorStore.getState().history.document;
    expect(afterRedo.walls).toHaveLength(1);
    expect(afterRedo.vertices.map((vertex) => vertex.position)).toContainEqual({ x: 1200, y: 0 });
    expect(JSON.stringify(afterRedo)).not.toMatch(/sourceAssist|sourceCandidate|candidateId|referenceRevision/);
  });
});

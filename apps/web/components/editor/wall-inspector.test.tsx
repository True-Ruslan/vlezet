import { createHistoryState } from "@vlezet/editor-core";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it } from "vitest";
import { WallInspector } from "./wall-inspector";
import { editorStore } from "./use-editor-store";

const noSnap = (x: number, y: number) => ({ point: { x, y }, kind: "none" as const, guides: [] });

function selectSimpleWall(): void {
  editorStore.setState({
    history: createHistoryState(),
    tool: "select",
    selectedWallId: null,
    selectedRoomId: null,
    selectedOpeningId: null,
    selectedObjectId: null,
    placementPresetId: null,
    draftWall: null,
    objectGesture: null,
  });
  editorStore.getState().setTool("wall");
  editorStore.getState().beginWall({ x: 0, y: 0 });
  editorStore.getState().updateDraftWall(noSnap(3550, 0));
  editorStore.getState().commitDraftWall();
  editorStore.getState().cancelDraft();
  const wallId = editorStore.getState().history.document.walls[0]?.id;
  if (!wallId) throw new Error("Test wall was not created");
  editorStore.getState().selectWall(wallId);
}

describe("wall inspector precision semantics", () => {
  beforeEach(() => selectSimpleWall());

  it("names centreline length explicitly and exposes fixed-anchor choices", () => {
    const html = renderToStaticMarkup(<WallInspector />);

    expect(html).toContain("Длина по оси стены");
    expect(html).toContain("Что остаётся на месте");
    expect(html).toContain("Начало");
    expect(html).toContain("Центр");
    expect(html).toContain("Конец");
    expect(html).toContain("Это не всегда равно чистому внутреннему размеру комнаты");
    expect(html).not.toContain("Точная длина");
  });
});

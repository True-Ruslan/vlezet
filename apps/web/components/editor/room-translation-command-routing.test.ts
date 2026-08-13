import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { EDITOR_COMMANDS } from "./editor-commands";
import { availableContextMenuCommands } from "./editor-context-menu";
import { replaceSelection } from "./editor-selection";

function roomDocument(): VlezetDocument {
  return {
    schemaVersion: 3,
    vertices: [
      { id: "a", position: { x: 0, y: 0 } },
      { id: "b", position: { x: 5000, y: 0 } },
      { id: "c", position: { x: 5000, y: 4000 } },
      { id: "d", position: { x: 0, y: 4000 } },
    ],
    walls: [
      { id: "top", startVertexId: "a", endVertexId: "b", junctionVertexIds: [], thickness: 180 },
      { id: "right", startVertexId: "b", endVertexId: "c", junctionVertexIds: [], thickness: 180 },
      { id: "bottom", startVertexId: "c", endVertexId: "d", junctionVertexIds: [], thickness: 180 },
      { id: "left", startVertexId: "d", endVertexId: "a", junctionVertexIds: [], thickness: 180 },
    ],
    openings: [],
    roomAnnotations: [],
    placedObjects: [],
  };
}

const apartmentSource = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M8.2 room furniture helper command routing", () => {
  it("registers a semantic no-shortcut command with the approved Russian label", () => {
    expect(EDITOR_COMMANDS).toContainEqual({
      id: "selection.select-furniture-in-room",
      label: "Выбрать мебель в комнате",
      shortcut: null,
    });
  });

  it("routes the command through the shared capability authority to the store selection-only action", () => {
    const commandCase = apartmentSource.slice(
      apartmentSource.indexOf('case "selection.select-furniture-in-room"'),
      apartmentSource.indexOf('case "selection.clear"'),
    );

    expect(commandCase).toContain('case "selection.select-furniture-in-room"');
    expect(commandCase).toContain("capabilities.selectFurnitureInRoom.enabled");
    expect(commandCase).toContain("store.selectFurnitureInSelectedRoom()");
    expect(commandCase).toContain("return true");
  });

  it("offers the helper in the room context menu and not for ordinary furniture selection", () => {
    const document = roomDocument();
    const room = deriveRooms(document).rooms[0]!;
    const roomCommands = availableContextMenuCommands(
      document,
      replaceSelection({ kind: "room", id: room.id }),
      null,
    ).map((command) => command.id);

    expect(roomCommands).toContain("selection.select-furniture-in-room");
    expect(availableContextMenuCommands(
      document,
      { refs: [], primary: null },
      null,
    ).map((command) => command.id)).not.toContain("selection.select-furniture-in-room");
  });
});

import type { VlezetDocument, Wall } from "@vlezet/domain";

export type EditorCommand =
  | Readonly<{ type: "wall/add"; wall: Wall }>
  | Readonly<{ type: "wall/replace"; before: Wall; after: Wall }>;

type InternalEditorCommand =
  | EditorCommand
  | Readonly<{ type: "wall/remove"; wall: Wall }>;

export function applyEditorCommand(document: VlezetDocument, command: InternalEditorCommand): VlezetDocument {
  switch (command.type) {
    case "wall/add": {
      if (document.walls.some((wall) => wall.id === command.wall.id)) {
        throw new Error(`Wall already exists: ${command.wall.id}`);
      }
      return { ...document, walls: [...document.walls, command.wall] };
    }
    case "wall/remove": {
      if (!document.walls.some((wall) => wall.id === command.wall.id)) {
        throw new Error(`Wall does not exist: ${command.wall.id}`);
      }
      return { ...document, walls: document.walls.filter((wall) => wall.id !== command.wall.id) };
    }
    case "wall/replace": {
      if (command.before.id !== command.after.id) {
        throw new Error("Replacing a wall cannot change its id");
      }
      let found = false;
      const walls = document.walls.map((wall) => {
        if (wall.id !== command.before.id) return wall;
        found = true;
        return command.after;
      });
      if (!found) throw new Error(`Wall does not exist: ${command.before.id}`);
      return { ...document, walls };
    }
  }
}

export function invertEditorCommand(command: EditorCommand): InternalEditorCommand {
  switch (command.type) {
    case "wall/add":
      return { type: "wall/remove", wall: command.wall };
    case "wall/replace":
      return { type: "wall/replace", before: command.after, after: command.before };
  }
}

export type { InternalEditorCommand };

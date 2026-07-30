import type { ReactNode } from "react";

export type EditorCommandIconName =
  | "select"
  | "wall"
  | "door"
  | "window"
  | "measure"
  | "furniture"
  | "reference"
  | "recognition"
  | "dimensions"
  | "2d"
  | "3d"
  | "context"
  | "actions"
  | "undo"
  | "redo";

function paths(name: EditorCommandIconName): ReactNode {
  switch (name) {
    case "select":
      return <><path d="M5 3l11 8-6 1.5L7 18 5 3z" /><path d="M10 12.5l4 5" /></>;
    case "wall":
      return <><path d="M3 7h18v10H3z" /><path d="M7 7v4h5v6M16 7v4h5" /></>;
    case "door":
      return <><path d="M5 20V4h10v16" /><path d="M5 20h14" /><path d="M15 4v16" /><path d="M15 4a16 16 0 0 1 4 12" /></>;
    case "window":
      return <><rect x="4" y="5" width="16" height="14" rx="1" /><path d="M12 5v14M4 12h16" /></>;
    case "measure":
      return <><path d="M4 17L17 4l3 3L7 20l-3-3z" /><path d="M9 15l-2-2M12 12l-2-2M15 9l-2-2" /></>;
    case "furniture":
      return <><path d="M4 12v7M20 12v7M4 15h16" /><path d="M6 12V8a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v4" /><path d="M3 12a2 2 0 0 1 3 0M18 12a2 2 0 0 1 3 0" /></>;
    case "reference":
      return <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M7 16l4-4 3 3 2-2 2 3" /><circle cx="9" cy="9" r="1" /></>;
    case "recognition":
      return <><path d="M12 3l1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1-4.1-1.4 4.1-1.4L12 3z" /><path d="M18 13l.8 2.2L21 16l-2.2.8L18 19l-.8-2.2L15 16l2.2-.8L18 13z" /></>;
    case "dimensions":
      return <><path d="M4 7h16M4 17h16M7 4v6M17 4v6M7 14v6M17 14v6" /><path d="M9 12h6M9 12l2-2M9 12l2 2M15 12l-2-2M15 12l-2 2" /></>;
    case "2d":
      return <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M8 16l3-4 2 2 3-5" /></>;
    case "3d":
      return <><path d="M12 3l8 4.5v9L12 21l-8-4.5v-9L12 3z" /><path d="M4 7.5l8 4.5 8-4.5M12 12v9" /></>;
    case "context":
      return <><path d="M4 7h16M4 12h16M4 17h16" /><circle cx="9" cy="7" r="2" /><circle cx="15" cy="12" r="2" /><circle cx="11" cy="17" r="2" /></>;
    case "actions":
      return <><circle cx="5" cy="12" r="1.5" /><circle cx="12" cy="12" r="1.5" /><circle cx="19" cy="12" r="1.5" /></>;
    case "undo":
      return <><path d="M9 7H4v-5" /><path d="M4 7a9 9 0 1 1 2 10" /></>;
    case "redo":
      return <><path d="M15 7h5v-5" /><path d="M20 7a9 9 0 1 0-2 10" /></>;
  }
}

export function EditorCommandIcon({ name }: Readonly<{ name: EditorCommandIconName }>) {
  return (
    <svg className="editor-command-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        {paths(name)}
      </g>
    </svg>
  );
}

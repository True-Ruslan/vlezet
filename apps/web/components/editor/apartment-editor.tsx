"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { getEditorShortcut } from "./keyboard";
import { editorStore } from "./use-editor-store";
import { WallInspector } from "./wall-inspector";

const EditorCanvas = dynamic(() => import("./editor-canvas").then((module) => module.EditorCanvas), {
  ssr: false,
  loading: () => <div className="canvas-loading">Подготавливаем рабочее поле…</div>,
});

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export function ApartmentEditor() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) && event.key !== "Escape") return;
      const shortcut = getEditorShortcut(event);
      if (!shortcut) return;
      event.preventDefault();
      const store = editorStore.getState();
      switch (shortcut) {
        case "undo": store.undo(); break;
        case "redo": store.redo(); break;
        case "select-tool": store.setTool("select"); break;
        case "wall-tool": store.setTool("wall"); break;
        case "cancel": store.cancelDraft(); store.setTool("select"); break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return <main className="editor-app"><EditorToolbar /><section className="editor-workspace"><EditorCanvas /><WallInspector /></section></main>;
}

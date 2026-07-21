"use client";

import dynamic from "next/dynamic";
import { useEffect } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { FurnitureCatalog } from "./furniture-catalog";
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
        case "door-tool": store.setTool("door"); break;
        case "window-tool": store.setTool("window"); break;
        case "furnishing-catalog": document.querySelector<HTMLButtonElement>(".preset-card")?.focus(); break;
        case "rotate-object": store.rotateSelectedObject90(); break;
        case "duplicate-object": store.duplicateSelectedObject(); break;
        case "delete-selection":
          if (store.selectedObjectId) store.deleteSelectedObject();
          else if (store.selectedOpeningId) store.deleteSelectedOpening();
          break;
        case "cancel": store.cancelCurrentAction(); break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <main className="editor-app">
      <EditorToolbar />
      <section className="editor-workspace">
        <FurnitureCatalog />
        <EditorCanvas />
        <WallInspector />
      </section>
    </main>
  );
}

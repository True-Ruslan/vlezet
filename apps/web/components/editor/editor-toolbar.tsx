"use client";

import { useStore } from "zustand";
import { editorStore } from "./use-editor-store";

export function EditorToolbar() {
  const tool = useStore(editorStore, (state) => state.tool);
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0);
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0);
  const wallCount = useStore(editorStore, (state) => state.history.document.walls.length);
  const openingCount = useStore(editorStore, (state) => state.history.document.openings.length);

  return (
    <header className="editor-toolbar">
      <div className="brand-block">
        <div className="brand-mark">V</div>
        <div><strong>Vlezet</strong><span>Проверим, что влезет.</span></div>
      </div>

      <div className="tool-group" aria-label="Инструменты редактора">
        <button className={tool === "select" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("select")} title="Выбор (V)">Выбор <kbd>V</kbd></button>
        <button className={tool === "wall" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("wall")} title="Стена (W)">Стена <kbd>W</kbd></button>
        <button className={tool === "door" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("door")} title="Дверь (D)">Дверь <kbd>D</kbd></button>
        <button className={tool === "window" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("window")} title="Окно (O)">Окно <kbd>O</kbd></button>
      </div>

      <div className="toolbar-spacer" />
      <div className="document-status" title="Объекты текущего плана">{wallCount} стен · {openingCount} проёмов</div>
      <div className="tool-group" aria-label="История изменений">
        <button className="icon-button" type="button" disabled={!canUndo} onClick={() => editorStore.getState().undo()} title="Отменить (Ctrl/Cmd+Z)">↶</button>
        <button className="icon-button" type="button" disabled={!canRedo} onClick={() => editorStore.getState().redo()} title="Повторить (Ctrl/Cmd+Shift+Z)">↷</button>
      </div>
    </header>
  );
}

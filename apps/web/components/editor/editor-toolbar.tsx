"use client";

import type { SaveStatus } from "@vlezet/projects";
import { useState } from "react";
import { useStore } from "zustand";
import { editorStore } from "./use-editor-store";

export type EditorToolbarProps = Readonly<{
  projectName: string;
  saveStatus: SaveStatus;
  furnitureCatalogOpen: boolean;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleFurnitureCatalog: () => void;
  onRetrySave: () => void;
  onFit: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
}>;

function ProjectNameField({ name, onRename }: Readonly<{ name: string; onRename: (name: string) => void }>) {
  const [value, setValue] = useState(name);
  const commit = () => {
    const next = value.trim();
    if (!next) {
      setValue(name);
      return;
    }
    if (next !== name) onRename(next);
  };
  return (
    <input
      className="toolbar-project-name"
      value={value}
      maxLength={80}
      aria-label="Название проекта"
      onChange={(event) => setValue(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") event.currentTarget.blur();
        if (event.key === "Escape") { setValue(name); event.currentTarget.blur(); }
      }}
    />
  );
}

function SaveIndicator({ status, onRetry }: Readonly<{ status: SaveStatus; onRetry: () => void }>) {
  if (status.kind === "failed") {
    return <button className="save-status is-failed" type="button" onClick={onRetry} aria-live="polite" title={status.message}>Не сохранено · повторить</button>;
  }
  if (status.kind === "saving") return <span className="save-status is-saving" aria-live="polite">Сохранение…</span>;
  if (status.kind === "saved") return <span className="save-status is-saved" aria-live="polite" title={new Date(status.savedAt).toLocaleString("ru")}>Сохранено</span>;
  return <span className="save-status" aria-live="polite">Локальный проект</span>;
}

export function EditorToolbar({
  projectName,
  saveStatus,
  furnitureCatalogOpen,
  onBack,
  onRenameProject,
  onToggleFurnitureCatalog,
  onRetrySave,
  onFit,
  onExportJson,
  onExportPng,
}: EditorToolbarProps) {
  const tool = useStore(editorStore, (state) => state.tool);
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const selectedObjectId = useStore(editorStore, (state) => state.selectedObjectId);
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0);
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0);
  const wallCount = useStore(editorStore, (state) => state.history.document.walls.length);
  const openingCount = useStore(editorStore, (state) => state.history.document.openings.length);
  const objectCount = useStore(editorStore, (state) => state.history.document.placedObjects.length);

  return (
    <header className="editor-toolbar">
      <div className="project-toolbar-block">
        <button className="back-button" type="button" onClick={onBack} title="К моим проектам" aria-label="Вернуться к моим проектам">←</button>
        <div className="brand-mark compact-brand-mark">V</div>
        <div className="project-title-stack">
          <ProjectNameField key={projectName} name={projectName} onRename={onRenameProject} />
          <SaveIndicator status={saveStatus} onRetry={onRetrySave} />
        </div>
      </div>

      <div className="tool-group" aria-label="Инструменты редактора">
        <button className={tool === "select" && !placementPresetId ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("select")} title="Выбор (V)">Выбор <kbd>V</kbd></button>
        <button className={tool === "wall" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("wall")} title="Стена (W)">Стена <kbd>W</kbd></button>
        <button className={tool === "door" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("door")} title="Дверь (D)">Дверь <kbd>D</kbd></button>
        <button className={tool === "window" ? "tool-button is-active" : "tool-button"} type="button" onClick={() => editorStore.getState().setTool("window")} title="Окно (O)">Окно <kbd>O</kbd></button>
        <button
          className={furnitureCatalogOpen || placementPresetId ? "tool-button furniture-tool is-active" : "tool-button furniture-tool"}
          type="button"
          onClick={onToggleFurnitureCatalog}
          title="Показать или скрыть мебель и технику (F)"
          aria-pressed={furnitureCatalogOpen}
        >
          Мебель <kbd>F</kbd>
        </button>
      </div>

      <div className="toolbar-spacer" />
      {selectedObjectId ? <div className="selection-shortcuts" title="Горячие клавиши выбранного предмета">R — 90° · ⌘D — копия · Delete</div> : null}
      <div className="document-status" title="Объекты текущего плана">{wallCount} стен · {openingCount} проёмов · {objectCount} предметов</div>
      <button className="toolbar-utility-button" type="button" onClick={onFit} title="Показать весь план">Весь план</button>
      <details className="export-menu">
        <summary className="toolbar-utility-button">Экспорт</summary>
        <div className="export-popover">
          <button type="button" onClick={onExportPng}><strong>PNG</strong><span>Чистое изображение плана</span></button>
          <button type="button" onClick={onExportJson}><strong>Vlezet JSON</strong><span>Резервная копия для редактирования</span></button>
        </div>
      </details>
      <div className="tool-group" aria-label="История изменений">
        <button className="icon-button" type="button" disabled={!canUndo} onClick={() => editorStore.getState().undo()} title="Отменить (Ctrl/Cmd+Z)">↶</button>
        <button className="icon-button" type="button" disabled={!canRedo} onClick={() => editorStore.getState().redo()} title="Повторить (Ctrl/Cmd+Shift+Z)">↷</button>
      </div>
    </header>
  );
}

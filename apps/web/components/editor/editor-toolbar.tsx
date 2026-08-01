"use client";

import type { SaveStatus } from "@vlezet/projects";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { spatialViewModeStore, type SpatialViewMode } from "../spatial/view-mode-store";
import { EditorCommandIcon, type EditorCommandIconName } from "./editor-command-icon";
import { dimensionVisibilityStore } from "./dimension-visibility-store";
import { measurementToolStore } from "./measurement-tool-store";
import { editorStore, type EditorTool } from "./use-editor-store";

export type EditorToolbarProps = Readonly<{
  projectName: string;
  saveStatus: SaveStatus;
  furnitureCatalogOpen: boolean;
  referencePanelOpen: boolean;
  recognitionPanelOpen: boolean;
  hasReferencePlan: boolean;
  contextTriggerVisible?: boolean;
  contextOpen?: boolean;
  contextLabel?: string;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleFurnitureCatalog: () => void;
  onToggleReferencePanel: () => void;
  onToggleRecognitionPanel: () => void;
  onToggleContext?: () => void;
  onRetrySave: () => void;
  onFit: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onExportPngWithReference: () => void;
}>;

export type EditorProjectBarViewProps = Readonly<{
  projectName: string;
  saveStatus: SaveStatus;
  contextTriggerVisible: boolean;
  contextOpen: boolean;
  contextLabel: string;
  hasReferencePlan: boolean;
  canUndo: boolean;
  canRedo: boolean;
  wallCount: number;
  openingCount: number;
  objectCount: number;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleContext: () => void;
  onRetrySave: () => void;
  onFit: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onExportPngWithReference: () => void;
  onUndo: () => void;
  onRedo: () => void;
}>;

export type EditorToolBarViewProps = Readonly<{
  tool: EditorTool;
  measurementActive: boolean;
  dimensionsVisible: boolean;
  viewMode: SpatialViewMode;
  placementPresetId: string | null;
  furnitureCatalogOpen: boolean;
  referencePanelOpen: boolean;
  recognitionPanelOpen: boolean;
  hasReferencePlan: boolean;
  editingDisabled: boolean;
  onChooseTool: (tool: EditorTool) => void;
  onActivateMeasurement: () => void;
  onToggleDimensions: () => void;
  onToggleFurniture: () => void;
  onToggleReference: () => void;
  onToggleRecognition: () => void;
  onChooseViewMode: (mode: SpatialViewMode) => void;
}>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable);
}

export function normalizedKeyboardKey(event: unknown): string | null {
  if (typeof event !== "object" || event === null || !("key" in event)) return null;
  const key = (event as { key?: unknown }).key;
  return typeof key === "string" ? key.toLowerCase() : null;
}

function ProjectNameField({ name, onRename }: Readonly<{ name: string; onRename: (name: string) => void }>) {
  const [value, setValue] = useState(name);
  const commit = () => {
    const next = value.trim();
    if (!next) { setValue(name); return; }
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

export function saveStatusCopy(status: SaveStatus): string {
  if (status.kind === "failed") return "Не сохранено — повторить";
  if (status.kind === "saving") return "Сохраняем локально…";
  if (status.kind === "saved") return "Сохранено локально";
  return "Локальный проект";
}

function SaveIndicator({ status, onRetry }: Readonly<{ status: SaveStatus; onRetry: () => void }>) {
  const copy = saveStatusCopy(status);
  if (status.kind === "failed") {
    return <button className="save-status is-failed" type="button" onClick={onRetry} aria-live="polite" title={status.message}>{copy}</button>;
  }
  if (status.kind === "saving") return <span className="save-status is-saving" aria-live="polite">{copy}</span>;
  if (status.kind === "saved") {
    return <span className="save-status is-saved" aria-live="polite" title={new Date(status.savedAt).toLocaleString("ru")}>{copy}</span>;
  }
  return <span className="save-status" aria-live="polite">{copy}</span>;
}

function closeParentDetails(target: HTMLElement) {
  const details = target.closest("details");
  if (details instanceof HTMLDetailsElement) details.open = false;
}

export function EditorProjectBarView(props: EditorProjectBarViewProps) {
  return (
    <header className="editor-toolbar editor-project-bar">
      <div className="project-toolbar-block">
        <button className="back-button" type="button" onClick={props.onBack} title="К моим проектам" aria-label="Вернуться к моим проектам">←</button>
        <div className="brand-mark compact-brand-mark" aria-hidden="true">V</div>
        <div className="project-title-stack">
          <ProjectNameField key={props.projectName} name={props.projectName} onRename={props.onRenameProject} />
          <SaveIndicator status={props.saveStatus} onRetry={props.onRetrySave} />
        </div>
      </div>

      <div className="editor-project-bar-spacer" />

      {props.contextTriggerVisible ? (
        <button
          className={props.contextOpen ? "editor-context-trigger is-active" : "editor-context-trigger"}
          type="button"
          aria-controls="editor-context-surface"
          aria-expanded={props.contextOpen}
          onClick={props.onToggleContext}
        >
          <EditorCommandIcon name="context" />
          <span>{props.contextLabel}</span>
        </button>
      ) : null}

      <details className="editor-actions-menu">
        <summary className="editor-project-action">
          <EditorCommandIcon name="actions" />
          <span>Действия</span>
        </summary>
        <div className="editor-actions-popover">
          <p className="editor-actions-facts">{props.wallCount} стен · {props.openingCount} проёмов · {props.objectCount} предметов</p>
          <button type="button" onClick={(event) => { closeParentDetails(event.currentTarget); props.onFit(); }}>
            <strong>Показать весь план</strong><span>Вписать текущую геометрию в рабочую область</span>
          </button>
          <button type="button" onClick={(event) => { closeParentDetails(event.currentTarget); props.onExportPng(); }}>
            <strong>PNG</strong><span>Чистое изображение плана</span>
          </button>
          {props.hasReferencePlan ? (
            <button type="button" onClick={(event) => { closeParentDetails(event.currentTarget); props.onExportPngWithReference(); }}>
              <strong>PNG с подложкой</strong><span>Исходный план и обводка</span>
            </button>
          ) : null}
          <button type="button" onClick={(event) => { closeParentDetails(event.currentTarget); props.onExportJson(); }}>
            <strong>Vlezet JSON</strong><span>Резервная копия для редактирования</span>
          </button>
        </div>
      </details>

      <div className="editor-history-actions" aria-label="История изменений">
        <button className="editor-history-button" type="button" disabled={!props.canUndo} onClick={props.onUndo} title="Отменить (Ctrl/Cmd+Z)" aria-label="Отменить">
          <EditorCommandIcon name="undo" />
        </button>
        <button className="editor-history-button" type="button" disabled={!props.canRedo} onClick={props.onRedo} title="Повторить (Ctrl/Cmd+Shift+Z)" aria-label="Повторить">
          <EditorCommandIcon name="redo" />
        </button>
      </div>
    </header>
  );
}

type CommandButtonProps = Readonly<{
  icon: EditorCommandIconName;
  label: string;
  shortcut?: string;
  active?: boolean;
  disabled?: boolean;
  title?: string;
  indicator?: boolean;
  onClick: () => void;
}>;

const EXCLUSIVE_TOOL_ICONS: ReadonlySet<EditorCommandIconName> = new Set(["select", "wall", "door", "window", "measure"]);

function CommandButton({ icon, label, shortcut, active = false, disabled = false, title, indicator = false, onClick }: CommandButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={active ? "tool-button editor-command-button is-active" : "tool-button editor-command-button"}
      aria-label={label}
      aria-pressed={active}
      data-active-tool={active && EXCLUSIVE_TOOL_ICONS.has(icon) ? "true" : undefined}
      title={title ?? (shortcut ? `${label} (${shortcut})` : label)}
      onClick={onClick}
    >
      <EditorCommandIcon name={icon} />
      <span className="editor-command-label">{label}</span>
      {shortcut ? <kbd>{shortcut}</kbd> : null}
      {indicator ? <span className="reference-present-dot" aria-label="подложка загружена" /> : null}
    </button>
  );
}

export function EditorToolBarView(props: EditorToolBarViewProps) {
  return (
    <nav className="editor-tool-bar" aria-label="Команды редактора">
      <div className="editor-command-group" aria-label="Инструменты редактирования">
        <CommandButton icon="select" label="Выбор" shortcut="V" disabled={props.editingDisabled} active={props.tool === "select" && !props.placementPresetId && !props.measurementActive} onClick={() => props.onChooseTool("select")} />
        <CommandButton icon="wall" label="Стена" shortcut="W" disabled={props.editingDisabled} active={props.tool === "wall" && !props.measurementActive} onClick={() => props.onChooseTool("wall")} />
        <CommandButton icon="door" label="Дверь" shortcut="D" disabled={props.editingDisabled} active={props.tool === "door" && !props.measurementActive} onClick={() => props.onChooseTool("door")} />
        <CommandButton icon="window" label="Окно" shortcut="O" disabled={props.editingDisabled} active={props.tool === "window" && !props.measurementActive} onClick={() => props.onChooseTool("window")} />
        <CommandButton icon="measure" label="Измерить" shortcut="M" disabled={props.editingDisabled} active={props.measurementActive} title="Измерить произвольное расстояние между двумя точками (M)" onClick={props.onActivateMeasurement} />
      </div>

      <div className="editor-command-group" aria-label="Рабочие процессы">
        <CommandButton icon="furniture" label="Мебель" shortcut="F" disabled={props.editingDisabled} active={props.furnitureCatalogOpen || Boolean(props.placementPresetId)} onClick={props.onToggleFurniture} />
        <CommandButton icon="reference" label="Подложка" disabled={props.editingDisabled} active={props.referencePanelOpen} indicator={props.hasReferencePlan} onClick={props.onToggleReference} />
        <CommandButton icon="recognition" label="Распознать" disabled={props.editingDisabled || !props.hasReferencePlan} active={props.recognitionPanelOpen} onClick={props.onToggleRecognition} />
      </div>

      <div className="editor-tool-bar-spacer" />

      <div className="editor-command-group" aria-label="Представление">
        <CommandButton icon="dimensions" label="Размеры" disabled={props.editingDisabled} active={props.dimensionsVisible} title="Показать или скрыть размерные линии выбранной комнаты или стены" onClick={props.onToggleDimensions} />
        <CommandButton icon="2d" label="2D" active={props.viewMode === "2d"} onClick={() => props.onChooseViewMode("2d")} />
        <CommandButton icon="3d" label="3D" active={props.viewMode === "3d"} onClick={() => props.onChooseViewMode("3d")} />
      </div>
    </nav>
  );
}

export function EditorToolbar(props: EditorToolbarProps) {
  const tool = useStore(editorStore, (state) => state.tool);
  const measurementActive = useStore(measurementToolStore, (state) => state.active);
  const dimensionsVisible = useStore(dimensionVisibilityStore, (state) => state.visible);
  const viewMode = useStore(spatialViewModeStore, (state) => state.mode);
  const placementPresetId = useStore(editorStore, (state) => state.placementPresetId);
  const canUndo = useStore(editorStore, (state) => state.history.past.length > 0);
  const canRedo = useStore(editorStore, (state) => state.history.future.length > 0);
  const wallCount = useStore(editorStore, (state) => state.history.document.walls.length);
  const openingCount = useStore(editorStore, (state) => state.history.document.openings.length);
  const objectCount = useStore(editorStore, (state) => state.history.document.placedObjects.length);
  const editingDisabled = viewMode === "3d";

  const chooseTool = (next: EditorTool) => {
    if (editingDisabled) return;
    measurementToolStore.getState().setActive(false);
    editorStore.getState().setTool(next);
  };
  const activateMeasurement = () => {
    if (editingDisabled) return;
    editorStore.getState().setTool("select");
    measurementToolStore.getState().setActive(true);
  };
  const chooseViewMode = (next: SpatialViewMode) => {
    if (next === "3d") {
      measurementToolStore.getState().setActive(false);
      editorStore.getState().cancelCurrentAction();
    }
    spatialViewModeStore.getState().setMode(next);
  };

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (normalizedKeyboardKey(event) !== "m" || event.metaKey || event.ctrlKey || event.altKey || isEditableTarget(event.target) || editingDisabled) return;
      event.preventDefault();
      editorStore.getState().setTool("select");
      measurementToolStore.getState().setActive(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editingDisabled]);

  const toggleFurniture = () => {
    measurementToolStore.getState().setActive(false);
    props.onToggleFurnitureCatalog();
  };

  return <>
    <EditorProjectBarView
      projectName={props.projectName}
      saveStatus={props.saveStatus}
      contextTriggerVisible={props.contextTriggerVisible ?? false}
      contextOpen={props.contextOpen ?? false}
      contextLabel={props.contextLabel ?? "Свойства"}
      hasReferencePlan={props.hasReferencePlan}
      canUndo={!editingDisabled && canUndo}
      canRedo={!editingDisabled && canRedo}
      wallCount={wallCount}
      openingCount={openingCount}
      objectCount={objectCount}
      onBack={props.onBack}
      onRenameProject={props.onRenameProject}
      onToggleContext={props.onToggleContext ?? (() => {})}
      onRetrySave={props.onRetrySave}
      onFit={props.onFit}
      onExportJson={props.onExportJson}
      onExportPng={props.onExportPng}
      onExportPngWithReference={props.onExportPngWithReference}
      onUndo={() => editorStore.getState().undo()}
      onRedo={() => editorStore.getState().redo()}
    />
    <EditorToolBarView
      tool={tool}
      measurementActive={measurementActive}
      dimensionsVisible={dimensionsVisible}
      viewMode={viewMode}
      placementPresetId={placementPresetId}
      furnitureCatalogOpen={props.furnitureCatalogOpen}
      referencePanelOpen={props.referencePanelOpen}
      recognitionPanelOpen={props.recognitionPanelOpen}
      hasReferencePlan={props.hasReferencePlan}
      editingDisabled={editingDisabled}
      onChooseTool={chooseTool}
      onActivateMeasurement={activateMeasurement}
      onToggleDimensions={() => dimensionVisibilityStore.getState().toggle()}
      onToggleFurniture={toggleFurniture}
      onToggleReference={props.onToggleReferencePanel}
      onToggleRecognition={props.onToggleRecognitionPanel}
      onChooseViewMode={chooseViewMode}
    />
  </>;
}

"use client";

import type { ProjectViewport, SaveStatus } from "@vlezet/projects";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { EditorToolbar } from "./editor-toolbar";
import { FurnitureCatalog } from "./furniture-catalog";
import { getEditorShortcut } from "./keyboard";
import { editorStore } from "./use-editor-store";
import { WallInspector } from "./wall-inspector";

const EditorCanvas = dynamic(() => import("./editor-canvas").then((module) => module.EditorCanvas), {
  ssr: false,
  loading: () => <div className="canvas-loading">Подготавливаем рабочее поле…</div>,
});

export type ApartmentEditorProps = Readonly<{
  projectId: string;
  projectName: string;
  saveStatus: SaveStatus;
  initialViewport: ProjectViewport;
  furnitureCatalogOpen: boolean;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleFurnitureCatalog: () => void;
  onViewportChange: (viewport: ProjectViewport) => void;
  onRetrySave: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
}>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export function ApartmentEditor({
  projectId,
  projectName,
  saveStatus,
  initialViewport,
  furnitureCatalogOpen,
  onBack,
  onRenameProject,
  onToggleFurnitureCatalog,
  onViewportChange,
  onRetrySave,
  onExportJson,
  onExportPng,
}: ApartmentEditorProps) {
  const [fitRequest, setFitRequest] = useState(0);

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
        case "furnishing-catalog": onToggleFurnitureCatalog(); break;
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
  }, [onToggleFurnitureCatalog]);

  return (
    <main className="editor-app">
      <EditorToolbar
        projectName={projectName}
        saveStatus={saveStatus}
        furnitureCatalogOpen={furnitureCatalogOpen}
        onBack={onBack}
        onRenameProject={onRenameProject}
        onToggleFurnitureCatalog={onToggleFurnitureCatalog}
        onRetrySave={onRetrySave}
        onFit={() => setFitRequest((value) => value + 1)}
        onExportJson={onExportJson}
        onExportPng={onExportPng}
      />
      <section className={furnitureCatalogOpen ? "editor-workspace" : "editor-workspace catalog-closed"}>
        {furnitureCatalogOpen ? <FurnitureCatalog /> : null}
        <EditorCanvas
          key={projectId}
          initialViewport={initialViewport}
          onViewportChange={onViewportChange}
          fitRequest={fitRequest}
        />
        <WallInspector />
      </section>
    </main>
  );
}

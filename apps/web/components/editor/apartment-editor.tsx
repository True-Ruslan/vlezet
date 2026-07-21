"use client";

import type { ProjectViewport, ReferencePlan, SaveStatus } from "@vlezet/projects";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { ReferencePanel, type ReferenceInstallDraft } from "../reference/reference-panel";
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
  referencePanelOpen: boolean;
  referencePlan: ReferencePlan | null;
  referenceAssetBlob: Blob | null;
  missingReferenceAsset: boolean;
  tracingMode: boolean;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleFurnitureCatalog: () => void;
  onToggleReferencePanel: () => void;
  onViewportChange: (viewport: ProjectViewport) => void;
  onRetrySave: () => void;
  onExportJson: () => void;
  onExportPng: () => void;
  onExportPngWithReference: () => void;
  onInstallReference: (draft: ReferenceInstallDraft) => Promise<void>;
  onUpdateReference: (referencePlan: ReferencePlan) => void;
  onRemoveReference: () => Promise<void>;
  onStartTracing: () => void;
  onStopTracing: () => void;
  onReferenceMoveEnd: (originWorld: Readonly<{ x: number; y: number }>) => void;
}>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

export function ApartmentEditor(props: ApartmentEditorProps) {
  const [fitRequest, setFitRequest] = useState(0);
  const [fitReferenceRequest, setFitReferenceRequest] = useState(0);

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
        case "furnishing-catalog": props.onToggleFurnitureCatalog(); break;
        case "rotate-object": store.rotateSelectedObject90(); break;
        case "duplicate-object": store.duplicateSelectedObject(); break;
        case "delete-selection":
          if (store.selectedObjectId) store.deleteSelectedObject();
          else if (store.selectedOpeningId) store.deleteSelectedOpening();
          break;
        case "cancel":
          store.cancelCurrentAction();
          if (props.tracingMode) props.onStopTracing();
          break;
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  const workspaceClass = [
    "editor-workspace",
    props.furnitureCatalogOpen ? "" : "catalog-closed",
    props.referencePanelOpen ? "reference-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className="editor-app">
      <EditorToolbar
        projectName={props.projectName}
        saveStatus={props.saveStatus}
        furnitureCatalogOpen={props.furnitureCatalogOpen}
        referencePanelOpen={props.referencePanelOpen}
        hasReferencePlan={props.referencePlan !== null}
        onBack={props.onBack}
        onRenameProject={props.onRenameProject}
        onToggleFurnitureCatalog={props.onToggleFurnitureCatalog}
        onToggleReferencePanel={props.onToggleReferencePanel}
        onRetrySave={props.onRetrySave}
        onFit={() => setFitRequest((value) => value + 1)}
        onExportJson={props.onExportJson}
        onExportPng={props.onExportPng}
        onExportPngWithReference={props.onExportPngWithReference}
      />
      <section className={workspaceClass}>
        {props.furnitureCatalogOpen ? <FurnitureCatalog /> : null}
        <EditorCanvas
          key={props.projectId}
          initialViewport={props.initialViewport}
          onViewportChange={props.onViewportChange}
          fitRequest={fitRequest}
          fitReferenceRequest={fitReferenceRequest}
          referencePlan={props.referencePlan}
          referenceAssetBlob={props.referenceAssetBlob}
          tracingMode={props.tracingMode}
          onReferenceMoveEnd={props.onReferenceMoveEnd}
        />
        {props.referencePanelOpen ? (
          <ReferencePanel
            referencePlan={props.referencePlan}
            assetBlob={props.referenceAssetBlob}
            missingAsset={props.missingReferenceAsset}
            onInstall={props.onInstallReference}
            onUpdate={props.onUpdateReference}
            onRemove={props.onRemoveReference}
            onStartTracing={props.onStartTracing}
            onFitReference={() => setFitReferenceRequest((value) => value + 1)}
            onClose={props.onToggleReferencePanel}
          />
        ) : <WallInspector />}
      </section>
      {props.tracingMode ? <div className="tracing-banner" role="status"><strong>Режим обводки</strong><span>Создавайте стены поверх подложки. Esc завершит обводку.</span><button type="button" onClick={props.onStopTracing}>Готово</button></div> : null}
    </main>
  );
}

"use client";

import type { ProjectViewport, ReferencePlan, SaveStatus } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDecision, RecognitionOpeningCandidate } from "@vlezet/recognition";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { RecognitionPanel } from "../recognition/recognition-panel";
import type { RecognitionControllerState } from "../recognition/recognition-controller";
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
  recognitionPanelOpen: boolean;
  referencePlan: ReferencePlan | null;
  referenceAssetBlob: Blob | null;
  missingReferenceAsset: boolean;
  tracingMode: boolean;
  recognitionState: RecognitionControllerState;
  selectedRecognitionCandidateId: string | null;
  onBack: () => void;
  onRenameProject: (name: string) => void;
  onToggleFurnitureCatalog: () => void;
  onToggleReferencePanel: () => void;
  onToggleRecognitionPanel: () => void;
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
  onStartRecognition: () => void;
  onSelectRecognitionCandidate: (candidateId: string | null) => void;
  onRecognitionDecision: (candidateId: string, decision: RecognitionDecision) => void;
  onEditRecognitionWall: (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => void;
  onReclassifyRecognitionOpening: (candidateId: string, kind: RecognitionOpeningCandidate["kind"]) => void;
  onAcceptHighConfidenceRecognition: () => void;
  onRunCloudRecognition: () => void;
  onApplyRecognition: () => void;
  onDiscardRecognition: () => void;
}>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

function reviewDraft(state: RecognitionControllerState) {
  if (state.kind === "review" || state.kind === "running-cloud" || state.kind === "error") return state.session?.draft ?? null;
  return null;
}

export function ApartmentEditor(props: ApartmentEditorProps) {
  const [fitRequest, setFitRequest] = useState(0);
  const [fitReferenceRequest, setFitReferenceRequest] = useState(0);
  const recognitionDraft = reviewDraft(props.recognitionState);

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
        case "select-tool": if (!props.recognitionPanelOpen) store.setTool("select"); break;
        case "wall-tool": if (!props.recognitionPanelOpen) store.setTool("wall"); break;
        case "door-tool": if (!props.recognitionPanelOpen) store.setTool("door"); break;
        case "window-tool": if (!props.recognitionPanelOpen) store.setTool("window"); break;
        case "furnishing-catalog": if (!props.recognitionPanelOpen) props.onToggleFurnitureCatalog(); break;
        case "rotate-object": if (!props.recognitionPanelOpen) store.rotateSelectedObject90(); break;
        case "duplicate-object": if (!props.recognitionPanelOpen) store.duplicateSelectedObject(); break;
        case "delete-selection":
          if (props.recognitionPanelOpen) break;
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
    props.recognitionPanelOpen ? "recognition-open" : "",
  ].filter(Boolean).join(" ");

  return (
    <main className="editor-app">
      <EditorToolbar
        projectName={props.projectName}
        saveStatus={props.saveStatus}
        furnitureCatalogOpen={props.furnitureCatalogOpen}
        referencePanelOpen={props.referencePanelOpen}
        recognitionPanelOpen={props.recognitionPanelOpen}
        hasReferencePlan={props.referencePlan !== null}
        onBack={props.onBack}
        onRenameProject={props.onRenameProject}
        onToggleFurnitureCatalog={props.onToggleFurnitureCatalog}
        onToggleReferencePanel={props.onToggleReferencePanel}
        onToggleRecognitionPanel={props.onToggleRecognitionPanel}
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
          recognitionDraft={recognitionDraft}
          selectedRecognitionCandidateId={props.selectedRecognitionCandidateId}
          recognitionReviewActive={props.recognitionPanelOpen && recognitionDraft !== null}
          onSelectRecognitionCandidate={props.onSelectRecognitionCandidate}
          onEditRecognitionWall={props.onEditRecognitionWall}
          onReferenceMoveEnd={props.onReferenceMoveEnd}
        />
        {props.recognitionPanelOpen ? (
          <RecognitionPanel
            state={props.recognitionState}
            selectedCandidateId={props.selectedRecognitionCandidateId}
            hasReferencePlan={props.referencePlan !== null}
            missingReferenceAsset={props.missingReferenceAsset}
            onStartLocal={props.onStartRecognition}
            onSelect={props.onSelectRecognitionCandidate}
            onDecision={props.onRecognitionDecision}
            onReclassifyOpening={props.onReclassifyRecognitionOpening}
            onAcceptHighConfidence={props.onAcceptHighConfidenceRecognition}
            onRunCloud={props.onRunCloudRecognition}
            onApply={props.onApplyRecognition}
            onDiscard={props.onDiscardRecognition}
            onClose={props.onToggleRecognitionPanel}
          />
        ) : props.referencePanelOpen ? (
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
      {props.recognitionPanelOpen && recognitionDraft ? <div className="recognition-banner" role="status"><strong>Проверка распознавания</strong><span>Цветные линии — только черновик. Реальная квартира не изменится до применения.</span></div> : null}
    </main>
  );
}

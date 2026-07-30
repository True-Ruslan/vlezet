"use client";

import type { ProjectViewport, ReferencePlan, SaveStatus } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDecision, RecognitionOpeningCandidate } from "@vlezet/recognition";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";
import { useStore } from "zustand";
import { planningUiStore } from "../planning/planning-ui-store";
import { RecognitionPanel } from "../recognition/recognition-panel";
import type { RecognitionControllerState } from "../recognition/recognition-controller";
import { ReferencePanel, type ReferenceInstallDraft } from "../reference/reference-panel";
import { spatialViewModeStore } from "../spatial/view-mode-store";
import {
  deriveEditorContextKind,
  editorContextLabel,
  nextCompactEditorSurface,
  type CompactEditorSurface,
} from "./editor-context-kind";
import { EditorSideSurface } from "./editor-side-surface";
import { EditorToolbar } from "./editor-toolbar";
import { FurnitureCatalog } from "./furniture-catalog";
import { getEditorShortcut } from "./keyboard";
import { editorStore } from "./use-editor-store";
import { useCompactEditorLayout } from "./use-compact-editor-layout";
import { WallInspector } from "./wall-inspector";

const EditorCanvas = dynamic(() => import("./editor-canvas").then((module) => module.EditorCanvas), {
  ssr: false,
  loading: () => <div className="canvas-loading">Подготавливаем рабочее поле…</div>,
});

const SpatialViewer = dynamic(() => import("../spatial/spatial-viewer").then((module) => module.SpatialViewer), {
  ssr: false,
  loading: () => <div className="canvas-loading">Строим пространственный вид…</div>,
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
  const [fit3dRequest, setFit3dRequest] = useState(0);
  const [compactSurface, setCompactSurface] = useState<CompactEditorSurface>(null);
  const compactLayout = useCompactEditorLayout();
  const viewMode = useStore(spatialViewModeStore, (state) => state.mode);
  const selectedObjectId = useStore(editorStore, (state) => state.selectedObjectId);
  const selectedOpening = useStore(editorStore, (state) => state.history.document.openings.find((opening) => opening.id === state.selectedOpeningId) ?? null);
  const selectedRoomId = useStore(editorStore, (state) => state.selectedRoomId);
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const planningRoomId = useStore(planningUiStore, (state) => state.roomId);
  const recognitionDraft = reviewDraft(props.recognitionState);
  const contextKind = deriveEditorContextKind({
    recognitionPanelOpen: props.recognitionPanelOpen,
    referencePanelOpen: props.referencePanelOpen,
    planningRoomId,
    selectedObjectId,
    selectedOpeningKind: selectedOpening?.kind ?? null,
    selectedRoomId,
    selectedWallId,
  });

  const openCatalogueSurface = () => setCompactSurface((current) => nextCompactEditorSurface(current, { kind: "open-catalogue" }));
  const openContextSurface = () => setCompactSurface((current) => nextCompactEditorSurface(current, { kind: "open-context" }));
  const closeCompactSurface = () => setCompactSurface((current) => nextCompactEditorSurface(current, { kind: "close" }));

  const toggleFurnitureSurface = () => {
    const closing = props.furnitureCatalogOpen;
    props.onToggleFurnitureCatalog();
    if (compactLayout) {
      if (closing) closeCompactSurface();
      else openCatalogueSurface();
    }
  };

  const toggleReferenceSurface = () => {
    props.onToggleReferencePanel();
    if (compactLayout) openContextSurface();
  };

  const toggleRecognitionSurface = () => {
    props.onToggleRecognitionPanel();
    if (compactLayout) openContextSurface();
  };

  useEffect(() => {
    spatialViewModeStore.getState().setMode("2d");
    setCompactSurface(null);
  }, [props.projectId]);

  useEffect(() => {
    setCompactSurface((current) => nextCompactEditorSurface(current, { kind: "view-changed", view: viewMode }));
  }, [viewMode]);

  useEffect(() => {
    if (!compactLayout) return;
    setCompactSurface((current) => nextCompactEditorSurface(current, { kind: "context-changed", context: contextKind }));
  }, [compactLayout, contextKind]);

  useEffect(() => {
    if (compactLayout && !props.furnitureCatalogOpen) {
      setCompactSurface((current) => current === "catalogue" ? null : current);
    }
  }, [compactLayout, props.furnitureCatalogOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) && event.key !== "Escape") return;
      const shortcut = getEditorShortcut(event);
      if (!shortcut) return;
      if (viewMode === "3d") {
        if (shortcut === "cancel") {
          event.preventDefault();
          spatialViewModeStore.getState().setMode("2d");
        }
        return;
      }
      event.preventDefault();
      const store = editorStore.getState();
      switch (shortcut) {
        case "undo": store.undo(); break;
        case "redo": store.redo(); break;
        case "select-tool": if (!props.recognitionPanelOpen) store.setTool("select"); break;
        case "wall-tool": if (!props.recognitionPanelOpen) store.setTool("wall"); break;
        case "door-tool": if (!props.recognitionPanelOpen) store.setTool("door"); break;
        case "window-tool": if (!props.recognitionPanelOpen) store.setTool("window"); break;
        case "furnishing-catalog": if (!props.recognitionPanelOpen) toggleFurnitureSurface(); break;
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
  }, [compactLayout, props, viewMode]);

  const workspaceClass = [
    "editor-workspace",
    viewMode === "3d" ? "is-spatial" : "",
    viewMode === "3d" || !props.furnitureCatalogOpen ? "catalog-closed" : "",
    props.referencePanelOpen ? "reference-open" : "",
    props.recognitionPanelOpen ? "recognition-open" : "",
    compactLayout ? "is-compact-layout" : "",
    compactSurface === "catalogue" ? "catalogue-sheet-open" : "",
    compactSurface === "context" ? "context-sheet-open" : "",
  ].filter(Boolean).join(" ");

  const contextPanel = props.recognitionPanelOpen ? (
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
  ) : <WallInspector />;

  return (
    <main className="editor-app">
      <EditorToolbar
        projectName={props.projectName}
        saveStatus={props.saveStatus}
        furnitureCatalogOpen={props.furnitureCatalogOpen}
        referencePanelOpen={props.referencePanelOpen}
        recognitionPanelOpen={props.recognitionPanelOpen}
        hasReferencePlan={props.referencePlan !== null}
        contextTriggerVisible={compactLayout && viewMode === "2d"}
        contextOpen={compactSurface === "context"}
        contextLabel={editorContextLabel(contextKind)}
        onBack={props.onBack}
        onRenameProject={props.onRenameProject}
        onToggleFurnitureCatalog={toggleFurnitureSurface}
        onToggleReferencePanel={toggleReferenceSurface}
        onToggleRecognitionPanel={toggleRecognitionSurface}
        onToggleContext={() => compactSurface === "context" ? closeCompactSurface() : openContextSurface()}
        onRetrySave={props.onRetrySave}
        onFit={() => viewMode === "3d" ? setFit3dRequest((value) => value + 1) : setFitRequest((value) => value + 1)}
        onExportJson={props.onExportJson}
        onExportPng={props.onExportPng}
        onExportPngWithReference={props.onExportPngWithReference}
      />
      <section className={workspaceClass}>
        {viewMode === "2d" && props.furnitureCatalogOpen ? (
          <EditorSideSurface id="editor-catalogue-surface" side="left" label="Мебель и техника" compact={compactLayout} open={!compactLayout || compactSurface === "catalogue"} onClose={closeCompactSurface}>
            <FurnitureCatalog />
          </EditorSideSurface>
        ) : null}
        <div className="editor-canvas-slot" style={{ display: viewMode === "2d" ? "contents" : "none" }}>
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
        </div>
        {viewMode === "3d" ? <SpatialViewer fitRequest={fit3dRequest} /> : null}
        {viewMode === "2d" ? (
          <EditorSideSurface id="editor-context-surface" side="right" label={editorContextLabel(contextKind)} compact={compactLayout} open={!compactLayout || compactSurface === "context"} onClose={closeCompactSurface}>
            {contextPanel}
          </EditorSideSurface>
        ) : null}
      </section>
      {viewMode === "2d" && props.tracingMode ? <div className="tracing-banner" role="status"><strong>Режим обводки</strong><span>Создавайте стены поверх подложки. Esc завершит обводку.</span><button type="button" onClick={props.onStopTracing}>Готово</button></div> : null}
      {viewMode === "2d" && props.recognitionPanelOpen && recognitionDraft ? <div className="recognition-banner" role="status"><strong>Проверка распознавания</strong><span>Цветные линии — только черновик. Реальная квартира не изменится до применения.</span></div> : null}
    </main>
  );
}

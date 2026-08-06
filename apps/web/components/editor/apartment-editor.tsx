"use client";

import type { ProjectViewport, ReferencePlan, SaveStatus } from "@vlezet/projects";
import type { NormalizedPoint, RecognitionDecision, RecognitionOpeningCandidate } from "@vlezet/recognition";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { planningUiStore } from "../planning/planning-ui-store";
import { RecognitionPanel } from "../recognition/recognition-panel";
import type { RecognitionControllerState } from "../recognition/recognition-controller";
import { ReferencePanel, type ReferenceInstallDraft } from "../reference/reference-panel";
import { spatialViewModeStore } from "../spatial/view-mode-store";
import {
  preserveWorkflowReturnTarget,
  type WorkflowReturnTarget,
} from "./context-panel-contract";
import {
  captureEditorWorkflowReturnTarget,
  selectionForWorkflowReturnTarget,
  workflowReturnActionLabel,
  type EditorOrdinarySelection,
} from "./context-workflow-return";
import { EditorCanvasModeStatus } from "./editor-canvas-mode-status";
import {
  deriveEditorContextKind,
  editorContextLabel,
  nextCompactEditorSurface,
  type CompactEditorSurface,
} from "./editor-context-kind";
import { deriveEditorEscapeAction } from "./editor-escape-priority";
import { EditorOnboardingOverlay } from "./editor-onboarding-overlay";
import { EditorSideSurface } from "./editor-side-surface";
import { EditorToolbar } from "./editor-toolbar";
import { FurnitureCatalog } from "./furniture-catalog";
import { getEditorShortcut } from "./keyboard";
import { measurementToolStore } from "./measurement-tool-store";
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
  onFindAiProposals: () => void;
  aiProposalDiscoveryAvailable: boolean;
  onApplyRecognition: () => void;
  onDiscardRecognition: () => void;
}>;

type CompactSurfaceChoice = Readonly<{
  surface: Exclude<CompactEditorSurface, null>;
  contextKey: string;
}>;

function isEditableTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || (target instanceof HTMLElement && target.isContentEditable);
}

function reviewDraft(state: RecognitionControllerState) {
  if (state.kind === "review" || state.kind === "running-cloud" || state.kind === "error") return state.session?.draft ?? null;
  return null;
}

const EMPTY_SELECTION: EditorOrdinarySelection = {
  selectedWallId: null,
  selectedRoomId: null,
  selectedOpeningId: null,
  selectedObjectId: null,
};

export function ApartmentEditor(props: ApartmentEditorProps) {
  const [fitRequest, setFitRequest] = useState(0);
  const [fitReferenceRequest, setFitReferenceRequest] = useState(0);
  const [fit3dRequest, setFit3dRequest] = useState(0);
  const [compactSurfaceChoice, setCompactSurfaceChoice] = useState<CompactSurfaceChoice | null>(null);
  const [dismissedContextKey, setDismissedContextKey] = useState<string | null>(null);
  const [workflowReturnTarget, setWorkflowReturnTarget] = useState<WorkflowReturnTarget | null>(null);
  const compactLayout = useCompactEditorLayout();
  const viewMode = useStore(spatialViewModeStore, (state) => state.mode);
  const document = useStore(editorStore, (state) => state.history.document);
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
  const contextKey = [
    props.projectId,
    contextKind,
    planningRoomId,
    selectedObjectId,
    selectedOpening?.id,
    selectedRoomId,
    selectedWallId,
  ].join(":");

  const currentSelection = useMemo<EditorOrdinarySelection>(() => ({
    selectedWallId,
    selectedRoomId,
    selectedOpeningId: selectedOpening?.id ?? null,
    selectedObjectId,
  }), [selectedObjectId, selectedOpening?.id, selectedRoomId, selectedWallId]);

  const planningReturnTarget = useMemo(() => planningRoomId
    ? captureEditorWorkflowReturnTarget({ ...EMPTY_SELECTION, selectedRoomId: planningRoomId }, document)
    : null, [document, planningRoomId]);
  const activeWorkflowReturnTarget = workflowReturnTarget ?? planningReturnTarget;

  const compactSurface: CompactEditorSurface = viewMode === "3d" ? null : (() => {
    if (compactSurfaceChoice?.surface === "context") return "context";
    if (
      compactSurfaceChoice?.surface === "catalogue" &&
      props.furnitureCatalogOpen &&
      (compactSurfaceChoice.contextKey === contextKey || contextKind === "empty")
    ) return "catalogue";
    if (contextKind !== "empty" && dismissedContextKey !== contextKey) return "context";
    if (compactSurfaceChoice?.surface === "catalogue" && props.furnitureCatalogOpen) return "catalogue";
    return null;
  })();

  const openCatalogueSurface = useCallback(() => {
    const surface = nextCompactEditorSurface(null, { kind: "open-catalogue" });
    if (surface) setCompactSurfaceChoice({ surface, contextKey });
  }, [contextKey]);

  const openContextSurface = useCallback(() => {
    const surface = nextCompactEditorSurface(null, { kind: "open-context" });
    if (surface) setCompactSurfaceChoice({ surface, contextKey });
    setDismissedContextKey(null);
  }, [contextKey]);

  const closeCompactSurface = useCallback(() => {
    nextCompactEditorSurface(compactSurface, { kind: "close" });
    if (compactSurface === "context") setDismissedContextKey(contextKey);
    setCompactSurfaceChoice(null);
  }, [compactSurface, contextKey]);

  const beginBoundedWorkflow = useCallback(() => {
    const captured = captureEditorWorkflowReturnTarget(currentSelection, document);
    setWorkflowReturnTarget((current) => preserveWorkflowReturnTarget(current, captured));
  }, [currentSelection, document]);

  const returnFromWorkflow = useCallback(() => {
    const target = activeWorkflowReturnTarget;
    if (planningRoomId) planningUiStore.getState().close();
    if (props.recognitionPanelOpen) props.onToggleRecognitionPanel();
    if (props.referencePanelOpen) props.onToggleReferencePanel();

    const selection = target ? selectionForWorkflowReturnTarget(target, document) : EMPTY_SELECTION;
    const store = editorStore.getState();
    store.selectWall(null);
    if (selection.selectedWallId) store.selectWall(selection.selectedWallId);
    else if (selection.selectedRoomId) store.selectRoom(selection.selectedRoomId);
    else if (selection.selectedOpeningId) store.selectOpening(selection.selectedOpeningId);
    else if (selection.selectedObjectId) store.selectObject(selection.selectedObjectId);
    setWorkflowReturnTarget(null);
    if (compactLayout) openContextSurface();
  }, [activeWorkflowReturnTarget, compactLayout, document, openContextSurface, planningRoomId, props]);

  const workflowNavigation = useMemo(() => ({
    label: workflowReturnActionLabel(activeWorkflowReturnTarget ?? { kind: "empty", label: "Ничего не выбрано" }),
    onActivate: returnFromWorkflow,
  }), [activeWorkflowReturnTarget, returnFromWorkflow]);

  const toggleFurnitureSurface = useCallback(() => {
    if (!compactLayout) {
      props.onToggleFurnitureCatalog();
      return;
    }
    if (compactSurface === "catalogue") {
      closeCompactSurface();
      return;
    }
    if (!props.furnitureCatalogOpen) props.onToggleFurnitureCatalog();
    openCatalogueSurface();
  }, [closeCompactSurface, compactLayout, compactSurface, openCatalogueSurface, props.furnitureCatalogOpen, props.onToggleFurnitureCatalog]);

  const toggleReferenceSurface = useCallback(() => {
    if (props.referencePanelOpen) {
      returnFromWorkflow();
      return;
    }
    beginBoundedWorkflow();
    props.onToggleReferencePanel();
    if (compactLayout) openContextSurface();
  }, [beginBoundedWorkflow, compactLayout, openContextSurface, props.onToggleReferencePanel, props.referencePanelOpen, returnFromWorkflow]);

  const toggleRecognitionSurface = useCallback(() => {
    if (props.recognitionPanelOpen) {
      returnFromWorkflow();
      return;
    }
    beginBoundedWorkflow();
    props.onToggleRecognitionPanel();
    if (compactLayout) openContextSurface();
  }, [beginBoundedWorkflow, compactLayout, openContextSurface, props.onToggleRecognitionPanel, props.recognitionPanelOpen, returnFromWorkflow]);

  useEffect(() => {
    spatialViewModeStore.getState().setMode("2d");
  }, [props.projectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (isEditableTarget(event.target) && event.key !== "Escape") return;
      const shortcut = getEditorShortcut(event);
      if (!shortcut) return;
      if (viewMode === "3d" && shortcut !== "cancel") return;

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
        case "cancel": {
          const measurement = measurementToolStore.getState();
          const escapeAction = deriveEditorEscapeAction({
            viewMode,
            hasObjectGesture: store.objectGesture !== null,
            measurementActive: measurement.active,
            measurementPhase: measurement.phase,
            hasWallDraft: store.draftWall !== null,
            hasPlacement: store.placementPresetId !== null,
            tracingMode: props.tracingMode,
            workflowOpen: props.recognitionPanelOpen || props.referencePanelOpen || planningUiStore.getState().roomId !== null,
            tool: store.tool,
            hasSelection: Boolean(store.selectedWallId || store.selectedRoomId || store.selectedOpeningId || store.selectedObjectId),
          });
          switch (escapeAction) {
            case "cancel-object-gesture": store.cancelObjectGesture(); break;
            case "reset-measurement": measurementToolStore.getState().resetMeasurement(); break;
            case "cancel-wall-draft": store.cancelDraft(); break;
            case "cancel-placement": store.setPlacementPreset(null); break;
            case "finish-tracing": props.onStopTracing(); break;
            case "exit-measurement": measurementToolStore.getState().setActive(false); break;
            case "close-workflow": returnFromWorkflow(); break;
            case "exit-tool": store.setTool("select"); break;
            case "clear-selection": store.selectWall(null); break;
            case "return-to-2d": spatialViewModeStore.getState().setMode("2d"); break;
            case "none": break;
          }
          break;
        }
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props.onStopTracing, props.recognitionPanelOpen, props.referencePanelOpen, props.tracingMode, returnFromWorkflow, toggleFurnitureSurface, viewMode]);

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
      navigation={workflowNavigation}
      onStartLocal={props.onStartRecognition}
      onSelect={props.onSelectRecognitionCandidate}
      onDecision={props.onRecognitionDecision}
      onReclassifyOpening={props.onReclassifyRecognitionOpening}
      onAcceptHighConfidence={props.onAcceptHighConfidenceRecognition}
      onRunCloud={props.onRunCloudRecognition}
      onFindAiProposals={props.onFindAiProposals}
      aiProposalDiscoveryAvailable={props.aiProposalDiscoveryAvailable}
      onApply={props.onApplyRecognition}
      onDiscard={props.onDiscardRecognition}
    />
  ) : props.referencePanelOpen ? (
    <ReferencePanel
      referencePlan={props.referencePlan}
      assetBlob={props.referenceAssetBlob}
      missingAsset={props.missingReferenceAsset}
      navigation={workflowNavigation}
      onInstall={props.onInstallReference}
      onUpdate={props.onUpdateReference}
      onRemove={props.onRemoveReference}
      onStartTracing={props.onStartTracing}
      onFitReference={() => setFitReferenceRequest((value) => value + 1)}
    />
  ) : <WallInspector planningNavigation={workflowNavigation} />;

  return (
    <main className="editor-app">
      <EditorToolbar
        projectName={props.projectName}
        saveStatus={props.saveStatus}
        furnitureCatalogOpen={compactLayout ? compactSurface === "catalogue" : props.furnitureCatalogOpen}
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
        <EditorCanvasModeStatus
          viewMode={viewMode}
          recognitionReviewActive={props.recognitionPanelOpen && recognitionDraft !== null}
          tracingMode={props.tracingMode}
        />
        <EditorOnboardingOverlay
          projectId={props.projectId}
          viewMode={viewMode}
          planningOpen={planningRoomId !== null}
          recognitionPanelOpen={props.recognitionPanelOpen}
          referencePanelOpen={props.referencePanelOpen}
          tracingMode={props.tracingMode}
          onOpenRecognitionReview={toggleRecognitionSurface}
        />
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

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
  commandForKeyboardEvent,
  isNativeEditableTarget,
  type EditorCommandId,
} from "./editor-commands";
import {
  deriveEditorContextKind,
  editorContextLabel,
  nextCompactEditorSurface,
  type CompactEditorSurface,
} from "./editor-context-kind";
import {
  EditorContextMenu,
  selectionForContextMenuTarget,
  type EditorContextMenuRequest,
} from "./editor-context-menu";
import { deriveEditorEscapeAction } from "./editor-escape-priority";
import { EditorOnboardingOverlay } from "./editor-onboarding-overlay";
import { EditorSideSurface } from "./editor-side-surface";
import { EditorToolbar } from "./editor-toolbar";
import {
  type EditorViewportCommand,
  type EditorViewportCommandRequest,
} from "./editor-viewport-controller";
import { FurnitureCatalog } from "./furniture-catalog";
import { getEditorLegacyShortcut } from "./keyboard";
import { measurementToolStore } from "./measurement-tool-store";
import { MultiSelectionInspector } from "./multi-selection-inspector";
import {
  editorStore,
  selectedObjectId as selectedObjectIdFromSelection,
  selectedOpeningId as selectedOpeningIdFromSelection,
  selectedRoomId as selectedRoomIdFromSelection,
  selectedWallId as selectedWallIdFromSelection,
} from "./use-editor-store";
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

type CompactSurfaceChoice = Readonly<{
  surface: Exclude<CompactEditorSurface, null>;
  contextKey: string;
}>;

type OwnedEditorContextMenuRequest = Readonly<{
  ownerKey: string;
  request: EditorContextMenuRequest;
}>;

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
  const [viewCommandRequest, setViewCommandRequest] = useState<EditorViewportCommandRequest | null>(null);
  const [fitReferenceRequest, setFitReferenceRequest] = useState(0);
  const [fit3dRequest, setFit3dRequest] = useState(0);
  const [compactSurfaceChoice, setCompactSurfaceChoice] = useState<CompactSurfaceChoice | null>(null);
  const [dismissedContextKey, setDismissedContextKey] = useState<string | null>(null);
  const [workflowReturnTarget, setWorkflowReturnTarget] = useState<WorkflowReturnTarget | null>(null);
  const [ownedContextMenuRequest, setOwnedContextMenuRequest] = useState<OwnedEditorContextMenuRequest | null>(null);
  const compactLayout = useCompactEditorLayout();
  const viewMode = useStore(spatialViewModeStore, (state) => state.mode);
  const document = useStore(editorStore, (state) => state.history.document);
  const selection = useStore(editorStore, (state) => state.selection);
  const hasPlacedObjectClipboard = useStore(editorStore, (state) => state.clipboard.payload !== null);
  const selectedObjectId = selectedObjectIdFromSelection(selection);
  const selectedOpeningId = selectedOpeningIdFromSelection(selection);
  const selectedOpening = document.openings.find((opening) => opening.id === selectedOpeningId) ?? null;
  const selectedRoomId = selectedRoomIdFromSelection(selection);
  const selectedWallId = selectedWallIdFromSelection(selection);
  const planningRoomId = useStore(planningUiStore, (state) => state.roomId);
  const recognitionDraft = reviewDraft(props.recognitionState);
  const contextKind = deriveEditorContextKind({
    recognitionPanelOpen: props.recognitionPanelOpen,
    referencePanelOpen: props.referencePanelOpen,
    planningRoomId,
    selectionCount: selection.refs.length,
    selectedObjectId,
    selectedOpeningKind: selectedOpening?.kind ?? null,
    selectedRoomId,
    selectedWallId,
  });
  const selectionContextKey = selection.refs.map((ref) => `${ref.kind}:${ref.id}`).join("|");
  const contextKey = [
    props.projectId,
    contextKind,
    planningRoomId,
    selectedObjectId,
    selectedOpening?.id,
    selectedRoomId,
    selectedWallId,
    selectionContextKey,
  ].join(":");
  const contextMenuOwnerKey = [
    props.projectId,
    viewMode,
    props.recognitionPanelOpen ? "recognition" : "editor",
    props.referencePanelOpen ? "reference" : "editor",
    planningRoomId ?? "no-planning",
    props.tracingMode ? "tracing" : "editing",
  ].join(":");
  const contextMenuRequest = ownedContextMenuRequest?.ownerKey === contextMenuOwnerKey
    ? ownedContextMenuRequest.request
    : null;

  const currentSelection: EditorOrdinarySelection = {
    selectedWallId,
    selectedRoomId,
    selectedOpeningId: selectedOpening?.id ?? null,
    selectedObjectId,
  };

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

  const requestViewportCommand = useCallback((command: EditorViewportCommand) => {
    setViewCommandRequest((current) => ({
      serial: (current?.serial ?? 0) + 1,
      command,
    }));
  }, []);

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

    const nextSelection = target ? selectionForWorkflowReturnTarget(target, document) : EMPTY_SELECTION;
    const store = editorStore.getState();
    store.clearSelection();
    if (nextSelection.selectedWallId) store.selectWall(nextSelection.selectedWallId);
    else if (nextSelection.selectedRoomId) store.selectRoom(nextSelection.selectedRoomId);
    else if (nextSelection.selectedOpeningId) store.selectOpening(nextSelection.selectedOpeningId);
    else if (nextSelection.selectedObjectId) store.selectObject(nextSelection.selectedObjectId);
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

  const executeEditorCommand = useCallback((command: EditorCommandId): boolean => {
    const store = editorStore.getState();
    const editingBlocked = props.recognitionPanelOpen;
    const selectedFurnitureOnly = store.selection.refs.length > 0 &&
      store.selection.refs.every((ref) => ref.kind === "placed-object");

    switch (command) {
      case "history.undo":
        store.undo();
        return true;
      case "history.redo":
        store.redo();
        return true;
      case "selection.selectAll":
        if (editingBlocked) return false;
        store.selectAllConcreteEntities();
        return true;
      case "selection.copy":
        if (editingBlocked || !selectedFurnitureOnly) return false;
        store.copySelection();
        return true;
      case "selection.cut":
        if (editingBlocked || !selectedFurnitureOnly) return false;
        store.cutSelection();
        return true;
      case "selection.paste": {
        if (editingBlocked || !store.clipboard.payload) return false;
        const origin = store.clipboard.payload.copiedAtOrigin;
        store.pasteClipboard({ x: origin.x + 200, y: origin.y + 200 });
        return true;
      }
      case "selection.duplicate":
        if (editingBlocked || !selectedFurnitureOnly) return false;
        store.duplicateSelection();
        return true;
      case "selection.delete":
        if (editingBlocked) return false;
        if (selectedFurnitureOnly) {
          store.deleteSelection();
          return true;
        }
        if (selectedOpeningIdFromSelection(store.selection)) {
          store.deleteSelectedOpening();
          return true;
        }
        return false;
      case "selection.clear":
        if (store.selection.refs.length === 0) return false;
        store.clearSelection();
        return true;
      case "view.zoomIn":
        if (viewMode !== "2d") return false;
        requestViewportCommand("zoom-in");
        return true;
      case "view.zoomOut":
        if (viewMode !== "2d") return false;
        requestViewportCommand("zoom-out");
        return true;
      case "view.actualSize":
        if (viewMode !== "2d") return false;
        requestViewportCommand("actual-size");
        return true;
      case "view.fitPlan":
        if (viewMode !== "2d") return false;
        requestViewportCommand("fit-plan");
        return true;
      case "view.fitSelection":
        if (viewMode !== "2d") return false;
        if (store.selection.refs.length === 0) return false;
        requestViewportCommand("fit-selection");
        return true;
      case "tool.select":
        if (editingBlocked) return false;
        store.setPlacementPreset(null);
        store.setTool("select");
        return true;
      case "tool.wall":
        if (editingBlocked) return false;
        store.setPlacementPreset(null);
        store.setTool("wall");
        return true;
      case "tool.door":
        if (editingBlocked) return false;
        store.setPlacementPreset(null);
        store.setTool("door");
        return true;
      case "tool.window":
        if (editingBlocked) return false;
        store.setPlacementPreset(null);
        store.setTool("window");
        return true;
      case "object.rotate90":
        if (editingBlocked || !selectedObjectIdFromSelection(store.selection)) return false;
        store.rotateSelectedObject90();
        return true;
    }
  }, [props.recognitionPanelOpen, requestViewportCommand, viewMode]);

  const openContextMenu = useCallback((request: EditorContextMenuRequest | null) => {
    if (!request) {
      setOwnedContextMenuRequest(null);
      return;
    }
    const store = editorStore.getState();
    const nextSelection = selectionForContextMenuTarget(store.selection, request.target);
    if (nextSelection !== store.selection) store.replaceSelection(request.target);
    setOwnedContextMenuRequest({ ownerKey: contextMenuOwnerKey, request });
  }, [contextMenuOwnerKey]);

  useEffect(() => {
    spatialViewModeStore.getState().setMode("2d");
  }, [props.projectId]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const escapePressed = event.key === "Escape";
      if (isNativeEditableTarget(event.target) && !escapePressed) return;
      if (escapePressed && contextMenuRequest) {
        event.preventDefault();
        setOwnedContextMenuRequest(null);
        return;
      }

      const legacyShortcut = getEditorLegacyShortcut(event);
      if (legacyShortcut === "cancel") {
        event.preventDefault();
        const store = editorStore.getState();
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
          hasSelection: store.selection.refs.length > 0,
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
          case "clear-selection": store.clearSelection(); break;
          case "return-to-2d": spatialViewModeStore.getState().setMode("2d"); break;
          case "none": break;
        }
        return;
      }

      if (viewMode === "3d") return;

      if (legacyShortcut === "furnishing-catalog") {
        if (!props.recognitionPanelOpen) {
          event.preventDefault();
          toggleFurnitureSurface();
        }
        return;
      }

      const command = commandForKeyboardEvent(event);
      if (!command) return;
      if (executeEditorCommand(command)) event.preventDefault();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [contextMenuRequest, executeEditorCommand, props.onStopTracing, props.recognitionPanelOpen, props.referencePanelOpen, props.tracingMode, returnFromWorkflow, toggleFurnitureSurface, viewMode]);

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
  ) : contextKind === "multi-selection" ? (
    <MultiSelectionInspector
      document={document}
      selection={selection}
      hasPlacedObjectClipboard={hasPlacedObjectClipboard}
      executeCommand={executeEditorCommand}
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
        onFit={() => viewMode === "3d" ? setFit3dRequest((value) => value + 1) : requestViewportCommand("fit-plan")}
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
            viewCommandRequest={viewCommandRequest}
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
            onContextMenuRequest={openContextMenu}
          />
        </div>
        {viewMode === "3d" ? <SpatialViewer fitRequest={fit3dRequest} /> : null}
        {viewMode === "2d" ? (
          <EditorSideSurface id="editor-context-surface" side="right" label={editorContextLabel(contextKind)} compact={compactLayout} open={!compactLayout || compactSurface === "context"} onClose={closeCompactSurface}>
            {contextPanel}
          </EditorSideSurface>
        ) : null}
      </section>
      {viewMode === "2d" && contextMenuRequest && !props.recognitionPanelOpen ? (
        <EditorContextMenu
          position={contextMenuRequest.position}
          document={document}
          selection={selection}
          hasPlacedObjectClipboard={hasPlacedObjectClipboard}
          executeCommand={executeEditorCommand}
          onDismiss={() => setOwnedContextMenuRequest(null)}
        />
      ) : null}
      {viewMode === "2d" && props.tracingMode ? <div className="tracing-banner" role="status"><strong>Режим обводки</strong><span>Создавайте стены поверх подложки. Esc завершит обводку.</span><button type="button" onClick={props.onStopTracing}>Готово</button></div> : null}
      {viewMode === "2d" && props.recognitionPanelOpen && recognitionDraft ? <div className="recognition-banner" role="status"><strong>Проверка распознавания</strong><span>Цветные линии — только черновик. Реальная квартира не изменится до применения.</span></div> : null}
    </main>
  );
}
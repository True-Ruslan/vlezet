import fs from "node:fs";

const path = "apps/web/components/projects/project-app.tsx";
let text = fs.readFileSync(path, "utf8");

function replaceOnce(search, replacement, label) {
  const first = text.indexOf(search);
  if (first < 0) throw new Error(`Missing expected snippet: ${label}`);
  if (text.indexOf(search, first + search.length) >= 0) throw new Error(`Expected unique snippet: ${label}`);
  text = text.slice(0, first) + replacement + text.slice(first + search.length);
}

replaceOnce(
`} from "@vlezet/projects";
import { useCallback, useEffect, useRef, useState } from "react";`,
`} from "@vlezet/projects";
import { reconcileRecognition, type NormalizedPoint, type RecognitionDecision, type RecognitionOpeningCandidate } from "@vlezet/recognition";
import { useCallback, useEffect, useRef, useState } from "react";`,
"recognition core imports",
);

replaceOnce(
`import { ApartmentEditor } from "../editor/apartment-editor";
import { editorStore } from "../editor/use-editor-store";`,
`import { ApartmentEditor } from "../editor/apartment-editor";
import { editorStore } from "../editor/use-editor-store";
import { CloudDialog, type CloudRecognitionRequest } from "../recognition/cloud-dialog";
import { existingWallsInReferenceSpace } from "../recognition/existing-geometry";
import { runLocalRecognition } from "../recognition/local-recognition-client";
import { OpenRouterDirectProvider } from "../recognition/openrouter-provider";
import { planRecognitionApply } from "../recognition/recognition-apply";
import { RecognitionController, type RecognitionControllerState } from "../recognition/recognition-controller";
import { commitRecognitionDocument } from "../recognition/recognition-editor-apply";
import { blobToDataUrl, referenceBlobToAnalysisImageData } from "../recognition/recognition-image";
import { IndexedDbRecognitionSessionRepository } from "../recognition/session-repository";`,
"recognition application imports",
);

replaceOnce(
`  const repositoryRef = useRef<ReferenceRepository | null>(null);
  const activeProjectRef = useRef<VlezetProjectRecord | null>(null);`,
`  const repositoryRef = useRef<ReferenceRepository | null>(null);
  const recognitionRepositoryRef = useRef<IndexedDbRecognitionSessionRepository | null>(null);
  const recognitionControllerRef = useRef<RecognitionController | null>(null);
  const cloudAbortRef = useRef<AbortController | null>(null);
  const activeProjectRef = useRef<VlezetProjectRecord | null>(null);`,
"recognition refs",
);

replaceOnce(
`  const [tracingMode, setTracingMode] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });`,
`  const [tracingMode, setTracingMode] = useState(false);
  const [recognitionState, setRecognitionState] = useState<RecognitionControllerState>({ kind: "idle", session: null });
  const [recognitionPanelOpen, setRecognitionPanelOpen] = useState(false);
  const [selectedRecognitionCandidateId, setSelectedRecognitionCandidateId] = useState<string | null>(null);
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });`,
"recognition state",
);

replaceOnce(
`  const refreshProjects = useCallback(async () => {`,
`  const ensureRecognitionController = useCallback(() => {
    if (!recognitionRepositoryRef.current) recognitionRepositoryRef.current = new IndexedDbRecognitionSessionRepository();
    if (!recognitionControllerRef.current) {
      recognitionControllerRef.current = new RecognitionController({
        repository: recognitionRepositoryRef.current,
        runLocal: runLocalRecognition,
        onState: setRecognitionState,
      });
    }
    return recognitionControllerRef.current;
  }, []);

  const refreshProjects = useCallback(async () => {`,
"controller factory",
);

replaceOnce(
`  const stopSession = useCallback(async () => {
    applyPendingViewport();`,
`  const stopSession = useCallback(async () => {
    recognitionControllerRef.current?.cancelRunning();
    cloudAbortRef.current?.abort();
    cloudAbortRef.current = null;
    setCloudDialogOpen(false);
    setRecognitionPanelOpen(false);
    setSelectedRecognitionCandidateId(null);
    applyPendingViewport();`,
"stop recognition session",
);

replaceOnce(
`    await loadReferenceAsset(project, repository);

    const coordinator = new AutosaveCoordinator<VlezetProjectRecord>({`,
`    await loadReferenceAsset(project, repository);
    await ensureRecognitionController().restore(project.id, project.referencePlan ? {
      assetId: project.referencePlan.assetId,
      referenceRevision: project.referencePlan.referenceRevision,
    } : null);
    setSelectedRecognitionCandidateId(null);

    const coordinator = new AutosaveCoordinator<VlezetProjectRecord>({`,
"restore recognition on project open",
);

replaceOnce(
`  }, [loadReferenceAsset, queueProject, stopSession]);`,
`  }, [ensureRecognitionController, loadReferenceAsset, queueProject, stopSession]);`,
"start session dependencies",
);

replaceOnce(
`    autosaveRef.current?.dispose();
  }, []);`,
`    autosaveRef.current?.dispose();
    recognitionControllerRef.current?.cancelRunning();
    cloudAbortRef.current?.abort();
  }, []);`,
"cleanup recognition",
);

replaceOnce(
`    try { await repository.delete(project.id); setDeleteProject(null); await refreshProjects(); showToast("Проект удалён."); }`,
`    try { await recognitionRepositoryRef.current?.deleteForProject(project.id); await repository.delete(project.id); setDeleteProject(null); await refreshProjects(); showToast("Проект удалён."); }`,
"delete recognition with project",
);

replaceOnce(
`    setSaveStatus({ kind: "saved", savedAt: installed.updatedAt });
    showToast("Подложка сохранена. Можно начинать обводку.");`,
`    setSaveStatus({ kind: "saved", savedAt: installed.updatedAt });
    await ensureRecognitionController().restore(installed.id, { assetId: installed.referencePlan!.assetId, referenceRevision: installed.referencePlan!.referenceRevision });
    setSelectedRecognitionCandidateId(null);
    showToast("Подложка сохранена. Можно начинать обводку или распознавание.");`,
"stale recognition after reference install",
);

replaceOnce(
`    setTracingMode(false);
    showToast("Подложка удалена. Геометрия квартиры сохранена.");`,
`    setTracingMode(false);
    await ensureRecognitionController().restore(next.id, null);
    setSelectedRecognitionCandidateId(null);
    showToast("Подложка удалена. Геометрия квартиры сохранена.");`,
"stale recognition after reference remove",
);

replaceOnce(
`  const exportJson = async () => {`,
`  const startRecognition = async () => {
    const project = activeProjectRef.current;
    if (!project?.referencePlan || !referenceAsset) return;
    setRecognitionPanelOpen(true);
    setTracingMode(false);
    try {
      const imageData = await referenceBlobToAnalysisImageData(referenceAsset.blob);
      await ensureRecognitionController().startLocal({
        imageData,
        projectId: project.id,
        referenceAssetId: project.referencePlan.assetId,
        referenceRevision: project.referencePlan.referenceRevision,
        now: new Date().toISOString(),
      });
    } catch (cause) {
      setError(friendlyError(cause, "Не удалось запустить распознавание."));
    }
  };

  const updateRecognitionDecision = (candidateId: string, decision: RecognitionDecision) => {
    void ensureRecognitionController().updateDecision(candidateId, decision);
  };

  const editRecognitionWall = (candidateId: string, patch: Readonly<{ start?: NormalizedPoint; end?: NormalizedPoint }>) => {
    void ensureRecognitionController().editWall(candidateId, patch);
  };

  const reclassifyRecognitionOpening = (candidateId: string, kind: RecognitionOpeningCandidate["kind"]) => {
    const controller = ensureRecognitionController();
    const session = controller.state.session;
    if (!session) return;
    const now = new Date().toISOString();
    const draft = {
      ...session.draft,
      openings: session.draft.openings.map((opening) => opening.id === candidateId ? { ...opening, kind } : opening),
      decisions: { ...session.draft.decisions, [candidateId]: "edited" as const },
      updatedAt: now,
    };
    void controller.replaceDraft(draft, session.cloudMetadata);
  };

  const acceptHighConfidenceRecognition = () => {
    const controller = ensureRecognitionController();
    const session = controller.state.session;
    if (!session) return;
    const nextDecisions = { ...session.draft.decisions };
    for (const wall of session.draft.walls) if (wall.confidence === "high" && !wall.conflict) nextDecisions[wall.id] = "accepted";
    for (const opening of session.draft.openings) if (opening.confidence === "high" && !opening.conflict && opening.kind !== "unknown-opening") nextDecisions[opening.id] = "accepted";
    const draft = { ...session.draft, decisions: nextDecisions, updatedAt: new Date().toISOString() };
    void controller.replaceDraft(draft, session.cloudMetadata);
  };

  const runCloudRecognition = async (request: CloudRecognitionRequest) => {
    const project = activeProjectRef.current;
    const controller = ensureRecognitionController();
    const session = controller.state.session;
    if (!project?.referencePlan || !referenceAsset || !session) throw new Error("Сначала выполните локальное распознавание.");
    cloudAbortRef.current?.abort();
    const abortController = new AbortController();
    cloudAbortRef.current = abortController;
    controller.setRunningCloud();
    try {
      const provider = new OpenRouterDirectProvider({ apiKey: request.apiKey, modelId: request.modelId });
      const result = await provider.recognize({
        imageDataUrl: await blobToDataUrl(referenceAsset.blob),
        imageWidthPx: project.referencePlan.widthPx,
        imageHeightPx: project.referencePlan.heightPx,
        localSummary: { walls: session.draft.walls, openings: session.draft.openings },
      }, abortController.signal);
      const now = new Date().toISOString();
      const reconciled = reconcileRecognition({
        localDraft: session.draft,
        cloudResult: result,
        existingWalls: existingWallsInReferenceSpace(editorStore.getState().history.document, project.referencePlan),
        now,
      });
      await controller.replaceDraft(reconciled, { providerId: provider.id, modelId: request.modelId, completedAt: now });
      setCloudDialogOpen(false);
      showToast("AI-проверка завершена. Проверьте объединённый черновик.");
    } catch (cause) {
      if (abortController.signal.aborted) throw cause;
      const message = cause instanceof Error ? cause.message : "Не удалось выполнить AI-проверку.";
      await controller.returnToReviewWithError(message);
      throw cause;
    } finally {
      if (cloudAbortRef.current === abortController) cloudAbortRef.current = null;
    }
  };

  const applyRecognition = async () => {
    const project = activeProjectRef.current;
    const controller = ensureRecognitionController();
    const session = controller.state.session;
    if (!project?.referencePlan || !session) return;
    try {
      const plan = planRecognitionApply({
        draft: session.draft,
        referencePlan: project.referencePlan,
        document: editorStore.getState().history.document,
        idFactory: () => crypto.randomUUID(),
      });
      if (plan.appliedCandidateIds.length === 0) {
        showToast("Нет безопасных выбранных элементов для применения.");
        return;
      }
      commitRecognitionDocument(editorStore, plan.document);
      await controller.markApplied();
      showToast(`Применено элементов: ${plan.appliedCandidateIds.length}. Всё можно отменить одним Undo.`);
    } catch (cause) {
      setError(friendlyError(cause, "Не удалось применить черновик распознавания."));
    }
  };

  const discardRecognition = async () => {
    const project = activeProjectRef.current;
    if (!project) return;
    await ensureRecognitionController().discard(project.id);
    setSelectedRecognitionCandidateId(null);
    showToast("Черновик распознавания удалён. План квартиры не изменён.");
  };

  const exportJson = async () => {`,
"recognition action handlers",
);

replaceOnce(
`        referencePanelOpen={activeProject.ui.referencePanelOpen}
        referencePlan={activeProject.referencePlan}`, 
`        referencePanelOpen={activeProject.ui.referencePanelOpen}
        recognitionPanelOpen={recognitionPanelOpen}
        referencePlan={activeProject.referencePlan}`,
"editor recognition panel prop",
);

replaceOnce(
`        tracingMode={tracingMode}
        onBack={() => void backToProjects()}`, 
`        tracingMode={tracingMode}
        recognitionState={recognitionState}
        selectedRecognitionCandidateId={selectedRecognitionCandidateId}
        onBack={() => void backToProjects()}`,
"editor recognition state props",
);

replaceOnce(
`        onToggleReferencePanel={() => updateUi({ referencePanelOpen: !activeProject.ui.referencePanelOpen })}
        onViewportChange={onViewportChange}`, 
`        onToggleReferencePanel={() => { setRecognitionPanelOpen(false); updateUi({ referencePanelOpen: !activeProject.ui.referencePanelOpen }); }}
        onToggleRecognitionPanel={() => { setRecognitionPanelOpen((value) => !value); setTracingMode(false); }}
        onViewportChange={onViewportChange}`,
"editor recognition toggle",
);

replaceOnce(
`        onStartTracing={startTracing}
        onStopTracing={() => setTracingMode(false)}
        onReferenceMoveEnd={(originWorld) => {`, 
`        onStartTracing={startTracing}
        onStopTracing={() => setTracingMode(false)}
        onStartRecognition={() => void startRecognition()}
        onSelectRecognitionCandidate={setSelectedRecognitionCandidateId}
        onRecognitionDecision={updateRecognitionDecision}
        onEditRecognitionWall={editRecognitionWall}
        onReclassifyRecognitionOpening={reclassifyRecognitionOpening}
        onAcceptHighConfidenceRecognition={acceptHighConfidenceRecognition}
        onRunCloudRecognition={() => setCloudDialogOpen(true)}
        onApplyRecognition={() => void applyRecognition()}
        onDiscardRecognition={() => void discardRecognition()}
        onReferenceMoveEnd={(originWorld) => {`,
"editor recognition callbacks",
);

replaceOnce(
`      {error ? <div className="global-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Закрыть</button></div> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>;`,
`      <CloudDialog
        open={cloudDialogOpen}
        busy={recognitionState.kind === "running-cloud"}
        onClose={() => { cloudAbortRef.current?.abort(); cloudAbortRef.current = null; setCloudDialogOpen(false); }}
        onRun={runCloudRecognition}
      />
      {error ? <div className="global-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Закрыть</button></div> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>;`,
"cloud dialog render",
);

fs.writeFileSync(path, text);
console.log("M4.5 project recognition lifecycle integration applied.");

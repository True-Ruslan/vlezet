"use client";

import {
  AutosaveCoordinator,
  ProjectFileError,
  ProjectStorageError,
  createIndexedDbProjectRepository,
  createProject,
  createProjectAsset,
  duplicateProject,
  parsePortableProjectFile,
  projectFileSlug,
  projectJsonFilename,
  renameProject,
  replaceProjectDocument,
  replaceProjectReferencePlan,
  replaceProjectUi,
  replaceProjectViewport,
  serializePortableProjectFile,
  type ProjectAssetRecord,
  type ProjectViewport,
  type ReferencePlan,
  type SaveStatus,
  type VlezetProjectRecord,
} from "@vlezet/projects";
import {
  reconcileRecognition,
  type NormalizedPoint,
  type RecognitionDecision,
  type RecognitionOpeningCandidate,
} from "@vlezet/recognition";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApartmentEditor } from "../editor/apartment-editor";
import { loadEditorDocument } from "../editor/editor-session";
import { editorStore } from "../editor/use-editor-store";
import { CloudDialog, type CloudRecognitionRequest } from "../recognition/cloud-dialog";
import { existingWallsInReferenceSpace } from "../recognition/existing-geometry";
import { runLocalRecognition } from "../recognition/local-recognition-client";
import { OpenRouterDirectProvider } from "../recognition/openrouter-provider";
import { planRecognitionApply } from "../recognition/recognition-apply";
import { RecognitionController, type RecognitionControllerState } from "../recognition/recognition-controller";
import { commitRecognitionDocument } from "../recognition/recognition-editor-apply";
import { blobToDataUrl, referenceBlobToAnalysisImageData } from "../recognition/recognition-image";
import { IndexedDbRecognitionSessionRepository } from "../recognition/session-repository";
import type { ReferenceInstallDraft } from "../reference/reference-panel";
import {
  installReferencePlan,
  removeReferencePlan,
  type ReferenceRepository,
} from "../reference/reference-service";
import { ConfirmDialog } from "./confirm-dialog";
import { downloadBlob, downloadText } from "./download";
import { renderPlanPngBlob } from "./plan-png";
import { ProjectDashboard } from "./project-dashboard";

type AppMode = "loading" | "dashboard" | "editor" | "recovery";

function friendlyError(error: unknown, fallback: string): string {
  if (error instanceof ProjectFileError || error instanceof ProjectStorageError) return error.message;
  console.error(error);
  return fallback;
}

export function ProjectApp() {
  const repositoryRef = useRef<ReferenceRepository | null>(null);
  const recognitionRepositoryRef = useRef<IndexedDbRecognitionSessionRepository | null>(null);
  const recognitionControllerRef = useRef<RecognitionController | null>(null);
  const cloudAbortRef = useRef<AbortController | null>(null);
  const activeProjectRef = useRef<VlezetProjectRecord | null>(null);
  const autosaveRef = useRef<AutosaveCoordinator<VlezetProjectRecord> | null>(null);
  const unsubscribeEditorRef = useRef<(() => void) | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRef = useRef<ProjectViewport | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<AppMode>("loading");
  const [projects, setProjects] = useState<readonly VlezetProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<VlezetProjectRecord | null>(null);
  const [referenceAsset, setReferenceAsset] = useState<ProjectAssetRecord | null>(null);
  const [missingReferenceAsset, setMissingReferenceAsset] = useState(false);
  const [tracingMode, setTracingMode] = useState(false);
  const [recognitionState, setRecognitionState] = useState<RecognitionControllerState>({ kind: "idle", session: null });
  const [recognitionPanelOpen, setRecognitionPanelOpen] = useState(false);
  const [selectedRecognitionCandidateId, setSelectedRecognitionCandidateId] = useState<string | null>(null);
  const [cloudDialogOpen, setCloudDialogOpen] = useState(false);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<VlezetProjectRecord | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const ensureRecognitionController = useCallback(() => {
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

  const refreshProjects = useCallback(async () => {
    const repository = repositoryRef.current;
    if (repository) setProjects(await repository.list());
  }, []);

  const queueProject = useCallback((project: VlezetProjectRecord) => {
    activeProjectRef.current = project;
    setActiveProject(project);
    autosaveRef.current?.schedule(project);
  }, []);

  const applyPendingViewport = useCallback(() => {
    const viewport = pendingViewportRef.current;
    const project = activeProjectRef.current;
    pendingViewportRef.current = null;
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = null;
    if (viewport && project) queueProject(replaceProjectViewport(project, viewport, new Date().toISOString()));
  }, [queueProject]);

  const stopSession = useCallback(async () => {
    recognitionControllerRef.current?.cancelRunning();
    cloudAbortRef.current?.abort();
    cloudAbortRef.current = null;
    setCloudDialogOpen(false);
    setRecognitionPanelOpen(false);
    setSelectedRecognitionCandidateId(null);
    applyPendingViewport();
    const coordinator = autosaveRef.current;
    if (coordinator) await coordinator.flush();
    unsubscribeEditorRef.current?.();
    unsubscribeEditorRef.current = null;
    coordinator?.dispose();
    autosaveRef.current = null;
  }, [applyPendingViewport]);

  const loadReferenceAsset = useCallback(async (project: VlezetProjectRecord, repository: ReferenceRepository) => {
    if (!project.referencePlan) {
      setReferenceAsset(null);
      setMissingReferenceAsset(false);
      return;
    }
    const asset = await repository.getAsset(project.referencePlan.assetId);
    setReferenceAsset(asset);
    setMissingReferenceAsset(asset === null);
  }, []);

  const startSession = useCallback(async (project: VlezetProjectRecord, repository: ReferenceRepository) => {
    if (activeProjectRef.current) await stopSession();
    activeProjectRef.current = project;
    setActiveProject(project);
    setTracingMode(false);
    loadEditorDocument(project.document);
    await loadReferenceAsset(project, repository);
    await ensureRecognitionController().restore(project.id, project.referencePlan ? {
      assetId: project.referencePlan.assetId,
      referenceRevision: project.referencePlan.referenceRevision,
    } : null);
    setSelectedRecognitionCandidateId(null);

    const coordinator = new AutosaveCoordinator<VlezetProjectRecord>({
      delayMs: 150,
      save: (snapshot) => repository.put(snapshot),
      onStatus: setSaveStatus,
      failureMessage: "Не удалось сохранить проект в этом браузере.",
    });
    autosaveRef.current = coordinator;
    setSaveStatus({ kind: "saved", savedAt: project.updatedAt });
    unsubscribeEditorRef.current = editorStore.subscribe((state, previous) => {
      if (state.history.document === previous.history.document) return;
      const current = activeProjectRef.current;
      if (current) queueProject(replaceProjectDocument(current, state.history.document, new Date().toISOString()));
    });
    await repository.setLastProjectId(project.id);
    setError(null);
    setMode("editor");
  }, [ensureRecognitionController, loadReferenceAsset, queueProject, stopSession]);

  useEffect(() => {
    let cancelled = false;
    const initialize = async () => {
      try {
        const repository = createIndexedDbProjectRepository();
        repositoryRef.current = repository;
        const listed = await repository.list();
        if (cancelled) return;
        setProjects(listed);
        const lastProjectId = await repository.getLastProjectId();
        if (lastProjectId) {
          const project = await repository.get(lastProjectId);
          if (project && !cancelled) {
            await startSession(project, repository);
            return;
          }
        }
        setMode("dashboard");
      } catch (cause) {
        if (!cancelled) {
          setError(friendlyError(cause, "Не удалось прочитать локальные проекты."));
          setMode("recovery");
        }
      }
    };
    void initialize();
    return () => { cancelled = true; };
  }, [startSession]);

  useEffect(() => {
    const onPageHide = () => {
      applyPendingViewport();
      void autosaveRef.current?.flush().catch(() => undefined);
    };
    window.addEventListener("pagehide", onPageHide);
    return () => window.removeEventListener("pagehide", onPageHide);
  }, [applyPendingViewport]);

  useEffect(() => () => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    unsubscribeEditorRef.current?.();
    autosaveRef.current?.dispose();
    recognitionControllerRef.current?.cancelRunning();
    cloudAbortRef.current?.abort();
  }, []);

  const createNewProject = async (openReferencePanel = false) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      const project = createProject({
        id: crypto.randomUUID(),
        name: projects.length === 0 ? "Моя квартира" : `Новый проект ${projects.length + 1}`,
        now: new Date().toISOString(),
        ui: { furnitureCatalogOpen: true, referencePanelOpen: openReferencePanel },
      });
      await repository.put(project);
      await startSession(project, repository);
    } catch (cause) { setError(friendlyError(cause, "Не удалось создать проект.")); }
  };

  const openProject = async (project: VlezetProjectRecord) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try { await startSession(project, repository); }
    catch (cause) { setError(friendlyError(cause, "Не удалось открыть проект.")); }
  };

  const renameDashboardProject = async (project: VlezetProjectRecord, name: string) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try { await repository.put(renameProject(project, name, new Date().toISOString())); await refreshProjects(); }
    catch (cause) { setError(friendlyError(cause, "Не удалось переименовать проект.")); }
  };

  const duplicateDashboardProject = async (project: VlezetProjectRecord) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const now = new Date().toISOString();
    const projectId = crypto.randomUUID();
    let copy = duplicateProject(project, projectId, now);
    let copiedAsset: ProjectAssetRecord | null = null;
    try {
      if (project.referencePlan) {
        const sourceAsset = await repository.getAsset(project.referencePlan.assetId);
        if (!sourceAsset) throw new ProjectStorageError("Подложка исходного проекта не найдена.");
        copiedAsset = createProjectAsset({
          id: crypto.randomUUID(),
          projectId,
          createdAt: now,
          mimeType: sourceAsset.mimeType,
          blob: sourceAsset.blob,
        });
        copy = replaceProjectReferencePlan(copy, { ...project.referencePlan, assetId: copiedAsset.id }, now);
        await repository.putAsset(copiedAsset);
      }
      await repository.put(copy);
      await refreshProjects();
      showToast("Создана независимая копия проекта без черновика распознавания.");
    } catch (cause) {
      if (copiedAsset) await repository.deleteAsset(copiedAsset.id).catch(() => undefined);
      setError(friendlyError(cause, "Не удалось создать копию проекта."));
    }
  };

  const confirmDelete = async () => {
    const repository = repositoryRef.current;
    const project = deleteProject;
    if (!repository || !project) return;
    try {
      const recognitionRepository = recognitionRepositoryRef.current ?? new IndexedDbRecognitionSessionRepository();
      recognitionRepositoryRef.current = recognitionRepository;
      await recognitionRepository.deleteForProject(project.id);
      await repository.delete(project.id);
      setDeleteProject(null);
      await refreshProjects();
      showToast("Проект удалён.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось удалить проект.")); }
  };

  const importProject = async (file: File) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    const projectId = crypto.randomUUID();
    const assetId = crypto.randomUUID();
    try {
      const parsed = await parsePortableProjectFile(await file.text(), { id: projectId, assetId, now: new Date().toISOString() });
      if (parsed.asset) await repository.putAsset(parsed.asset);
      try { await repository.put(parsed.project); }
      catch (cause) { if (parsed.asset) await repository.deleteAsset(parsed.asset.id).catch(() => undefined); throw cause; }
      await startSession(parsed.project, repository);
      showToast("Проект импортирован без незавершённых recognition sessions.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось импортировать проект.")); }
  };

  const backToProjects = async () => {
    const repository = repositoryRef.current;
    try {
      await stopSession();
      activeProjectRef.current = null;
      setActiveProject(null);
      setReferenceAsset(null);
      await repository?.setLastProjectId(null);
      await refreshProjects();
      setMode("dashboard");
    } catch (cause) { setError(friendlyError(cause, "Не удалось сохранить проект перед выходом.")); }
  };

  const renameActiveProject = (name: string) => {
    const current = activeProjectRef.current;
    if (!current) return;
    try { queueProject(renameProject(current, name, new Date().toISOString())); }
    catch (cause) { setError(friendlyError(cause, "Не удалось переименовать проект.")); }
  };

  const updateUi = (patch: Partial<VlezetProjectRecord["ui"]>) => {
    const current = activeProjectRef.current;
    if (current) queueProject(replaceProjectUi(current, { ...current.ui, ...patch }, new Date().toISOString()));
  };

  const onViewportChange = (viewport: ProjectViewport) => {
    pendingViewportRef.current = viewport;
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(applyPendingViewport, 500);
  };

  const installReference = async (draft: ReferenceInstallDraft) => {
    const repository = repositoryRef.current;
    const project = activeProjectRef.current;
    if (!repository || !project) return;
    const installed = await installReferencePlan({
      project,
      repository,
      raster: draft.raster,
      source: draft.source,
      pointA: draft.pointA,
      pointB: draft.pointB,
      knownLengthMm: draft.knownLengthMm,
      alignment: draft.alignment,
      originWorld: { x: 0, y: 0 },
      assetId: crypto.randomUUID(),
      referenceRevision: crypto.randomUUID(),
      now: new Date().toISOString(),
    });
    activeProjectRef.current = installed;
    setActiveProject(installed);
    await loadReferenceAsset(installed, repository);
    setSaveStatus({ kind: "saved", savedAt: installed.updatedAt });
    await ensureRecognitionController().restore(installed.id, {
      assetId: installed.referencePlan!.assetId,
      referenceRevision: installed.referencePlan!.referenceRevision,
    });
    setSelectedRecognitionCandidateId(null);
    showToast("Подложка сохранена. Можно начинать обводку или распознавание.");
  };

  const updateReference = (referencePlan: ReferencePlan) => {
    const current = activeProjectRef.current;
    if (current) queueProject(replaceProjectReferencePlan(current, referencePlan, new Date().toISOString()));
  };

  const removeReference = async () => {
    const repository = repositoryRef.current;
    const project = activeProjectRef.current;
    if (!repository || !project) return;
    const next = await removeReferencePlan(project, repository, new Date().toISOString());
    activeProjectRef.current = next;
    setActiveProject(next);
    setReferenceAsset(null);
    setMissingReferenceAsset(false);
    setTracingMode(false);
    await ensureRecognitionController().restore(next.id, null);
    setSelectedRecognitionCandidateId(null);
    showToast("Подложка удалена. Геометрия квартиры сохранена.");
  };

  const startTracing = () => {
    const current = activeProjectRef.current;
    if (!current?.referencePlan) return;
    const next = replaceProjectReferencePlan(current, {
      ...current.referencePlan,
      display: { ...current.referencePlan.display, visible: true, locked: true },
    }, new Date().toISOString());
    queueProject(replaceProjectUi(next, { ...next.ui, referencePanelOpen: true }, new Date().toISOString()));
    setRecognitionPanelOpen(false);
    editorStore.getState().setTool("wall");
    setTracingMode(true);
  };

  const startRecognition = async () => {
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
    void controller.replaceDraft({
      ...session.draft,
      openings: session.draft.openings.map((opening) => opening.id === candidateId ? { ...opening, kind } : opening),
      decisions: { ...session.draft.decisions, [candidateId]: "edited" },
      updatedAt: now,
    }, session.cloudMetadata);
  };

  const acceptHighConfidenceRecognition = () => {
    const controller = ensureRecognitionController();
    const session = controller.state.session;
    if (!session) return;
    const decisions = { ...session.draft.decisions };
    for (const wall of session.draft.walls) {
      if (wall.confidence === "high" && !wall.conflict) decisions[wall.id] = "accepted";
    }
    for (const opening of session.draft.openings) {
      if (opening.confidence === "high" && !opening.conflict && opening.kind !== "unknown-opening") decisions[opening.id] = "accepted";
    }
    void controller.replaceDraft({ ...session.draft, decisions, updatedAt: new Date().toISOString() }, session.cloudMetadata);
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
      await controller.replaceDraft(reconciled, {
        providerId: provider.id,
        modelId: request.modelId,
        completedAt: now,
      });
      setCloudDialogOpen(false);
      showToast("AI-проверка завершена. Проверьте объединённый черновик.");
    } catch (cause) {
      if (abortController.signal.aborted) {
        await controller.replaceDraft(session.draft, session.cloudMetadata);
        return;
      }
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

  const exportJson = async () => {
    const repository = repositoryRef.current;
    const project = activeProjectRef.current;
    if (!repository || !project) return;
    try {
      const asset = project.referencePlan ? await repository.getAsset(project.referencePlan.assetId) : null;
      downloadText(await serializePortableProjectFile(project, asset), projectJsonFilename(project.name));
      showToast("Резервная копия Vlezet скачана.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось создать резервную копию.")); }
  };

  const exportPng = async (includeReference: boolean) => {
    const project = activeProjectRef.current;
    if (!project) return;
    try {
      const blob = await renderPlanPngBlob(project.document, includeReference && project.referencePlan && referenceAsset
        ? { reference: { plan: project.referencePlan, blob: referenceAsset.blob } }
        : {});
      downloadBlob(blob, `${projectFileSlug(project.name)}${includeReference ? "-source" : ""}.png`);
      showToast(includeReference ? "PNG с исходным планом скачан." : "PNG плана скачан.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось создать PNG плана.")); }
  };

  if (mode === "loading") return <main className="project-loading"><div className="brand-mark">V</div><strong>Открываем Vlezet…</strong><span>Проверяем локальные проекты</span></main>;
  if (mode === "recovery") return <main className="project-recovery"><div className="brand-mark">V</div><h1>Не удалось открыть локальные проекты</h1><p role="alert">{error}</p><button className="primary-action recovery-action" type="button" onClick={() => window.location.reload()}>Повторить</button></main>;

  if (mode === "editor" && activeProject) {
    return <>
      <ApartmentEditor
        projectId={activeProject.id}
        projectName={activeProject.name}
        saveStatus={saveStatus}
        initialViewport={activeProject.viewport}
        furnitureCatalogOpen={activeProject.ui.furnitureCatalogOpen}
        referencePanelOpen={activeProject.ui.referencePanelOpen}
        recognitionPanelOpen={recognitionPanelOpen}
        referencePlan={activeProject.referencePlan}
        referenceAssetBlob={referenceAsset?.blob ?? null}
        missingReferenceAsset={missingReferenceAsset}
        tracingMode={tracingMode}
        recognitionState={recognitionState}
        selectedRecognitionCandidateId={selectedRecognitionCandidateId}
        onBack={() => void backToProjects()}
        onRenameProject={renameActiveProject}
        onToggleFurnitureCatalog={() => updateUi({ furnitureCatalogOpen: !activeProject.ui.furnitureCatalogOpen })}
        onToggleReferencePanel={() => {
          setRecognitionPanelOpen(false);
          updateUi({ referencePanelOpen: !activeProject.ui.referencePanelOpen });
        }}
        onToggleRecognitionPanel={() => {
          setRecognitionPanelOpen((value) => !value);
          setTracingMode(false);
          if (activeProject.ui.referencePanelOpen) updateUi({ referencePanelOpen: false });
        }}
        onViewportChange={onViewportChange}
        onRetrySave={() => void autosaveRef.current?.retry()}
        onExportJson={() => void exportJson()}
        onExportPng={() => void exportPng(false)}
        onExportPngWithReference={() => void exportPng(true)}
        onInstallReference={installReference}
        onUpdateReference={updateReference}
        onRemoveReference={removeReference}
        onStartTracing={startTracing}
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
        onReferenceMoveEnd={(originWorld) => {
          const current = activeProjectRef.current;
          if (current?.referencePlan) updateReference({ ...current.referencePlan, transform: { ...current.referencePlan.transform, originWorld } });
        }}
      />
      <CloudDialog
        open={cloudDialogOpen}
        busy={recognitionState.kind === "running-cloud"}
        onClose={() => {
          cloudAbortRef.current?.abort();
          cloudAbortRef.current = null;
          setCloudDialogOpen(false);
        }}
        onRun={runCloudRecognition}
      />
      {error ? <div className="global-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Закрыть</button></div> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>;
  }

  return <>
    <ProjectDashboard
      projects={projects}
      error={error}
      onCreate={() => createNewProject(false)}
      onCreateFromPlan={() => createNewProject(true)}
      onOpen={openProject}
      onRename={renameDashboardProject}
      onDuplicate={duplicateDashboardProject}
      onRequestDelete={setDeleteProject}
      onImport={importProject}
    />
    <ConfirmDialog
      open={deleteProject !== null}
      title="Удалить проект?"
      description={deleteProject ? `«${deleteProject.name}» будет удалён только из этого браузера. Отменить действие после подтверждения нельзя.` : ""}
      confirmLabel="Удалить проект"
      danger
      onCancel={() => setDeleteProject(null)}
      onConfirm={() => void confirmDelete()}
    />
    {toast ? <div className="toast" role="status">{toast}</div> : null}
  </>;
}

"use client";

import {
  AutosaveCoordinator,
  ProjectFileError,
  ProjectStorageError,
  createIndexedDbProjectRepository,
  createProject,
  duplicateProject,
  parseProjectFile,
  projectFileSlug,
  projectJsonFilename,
  renameProject,
  replaceProjectDocument,
  replaceProjectUi,
  replaceProjectViewport,
  serializeProjectFile,
  type ProjectRepository,
  type ProjectViewport,
  type SaveStatus,
  type VlezetProjectRecord,
} from "@vlezet/projects";
import { useCallback, useEffect, useRef, useState } from "react";
import { ApartmentEditor } from "../editor/apartment-editor";
import { editorStore } from "../editor/use-editor-store";
import { loadEditorDocument } from "../editor/editor-session";
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
  const repositoryRef = useRef<ProjectRepository | null>(null);
  const activeProjectRef = useRef<VlezetProjectRecord | null>(null);
  const autosaveRef = useRef<AutosaveCoordinator<VlezetProjectRecord> | null>(null);
  const unsubscribeEditorRef = useRef<(() => void) | null>(null);
  const viewportTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingViewportRef = useRef<ProjectViewport | null>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const [mode, setMode] = useState<AppMode>("loading");
  const [projects, setProjects] = useState<readonly VlezetProjectRecord[]>([]);
  const [activeProject, setActiveProject] = useState<VlezetProjectRecord | null>(null);
  const [saveStatus, setSaveStatus] = useState<SaveStatus>({ kind: "idle" });
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [deleteProject, setDeleteProject] = useState<VlezetProjectRecord | null>(null);

  const showToast = useCallback((message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(message);
    toastTimerRef.current = setTimeout(() => setToast(null), 2600);
  }, []);

  const refreshProjects = useCallback(async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    setProjects(await repository.list());
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
    if (!viewport || !project) return;
    queueProject(replaceProjectViewport(project, viewport, new Date().toISOString()));
  }, [queueProject]);

  const stopSession = useCallback(async () => {
    applyPendingViewport();
    const coordinator = autosaveRef.current;
    if (coordinator) await coordinator.flush();
    unsubscribeEditorRef.current?.();
    unsubscribeEditorRef.current = null;
    coordinator?.dispose();
    autosaveRef.current = null;
  }, [applyPendingViewport]);

  const startSession = useCallback(async (project: VlezetProjectRecord, repository: ProjectRepository) => {
    if (activeProjectRef.current) await stopSession();
    activeProjectRef.current = project;
    setActiveProject(project);
    loadEditorDocument(project.document);

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
      if (!current) return;
      queueProject(replaceProjectDocument(current, state.history.document, new Date().toISOString()));
    });

    await repository.setLastProjectId(project.id);
    setError(null);
    setMode("editor");
  }, [queueProject, stopSession]);

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
        if (cancelled) return;
        if (lastProjectId) {
          const project = await repository.get(lastProjectId);
          if (project && !cancelled) {
            await startSession(project, repository);
            return;
          }
        }
        setMode("dashboard");
      } catch (cause) {
        if (cancelled) return;
        setError(friendlyError(cause, "Не удалось прочитать локальные проекты."));
        setMode("recovery");
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
  }, []);

  const createNewProject = async () => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      const project = createProject({
        id: crypto.randomUUID(),
        name: projects.length === 0 ? "Моя квартира" : `Новый проект ${projects.length + 1}`,
        now: new Date().toISOString(),
      });
      await repository.put(project);
      await startSession(project, repository);
    } catch (cause) {
      setError(friendlyError(cause, "Не удалось создать проект."));
    }
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
    try {
      await repository.put(renameProject(project, name, new Date().toISOString()));
      await refreshProjects();
    } catch (cause) { setError(friendlyError(cause, "Не удалось переименовать проект.")); }
  };

  const duplicateDashboardProject = async (project: VlezetProjectRecord) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      const copy = duplicateProject(project, crypto.randomUUID(), new Date().toISOString());
      await repository.put(copy);
      await refreshProjects();
      showToast("Создана независимая копия проекта.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось создать копию проекта.")); }
  };

  const confirmDelete = async () => {
    const repository = repositoryRef.current;
    const project = deleteProject;
    if (!repository || !project) return;
    try {
      await repository.delete(project.id);
      setDeleteProject(null);
      await refreshProjects();
      showToast("Проект удалён.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось удалить проект.")); }
  };

  const importProject = async (file: File) => {
    const repository = repositoryRef.current;
    if (!repository) return;
    try {
      const imported = parseProjectFile(await file.text(), { id: crypto.randomUUID(), now: new Date().toISOString() });
      await repository.put(imported);
      await startSession(imported, repository);
      showToast("Проект импортирован.");
    } catch (cause) { setError(friendlyError(cause, "Не удалось импортировать проект.")); }
  };

  const backToProjects = async () => {
    const repository = repositoryRef.current;
    try {
      await stopSession();
      activeProjectRef.current = null;
      setActiveProject(null);
      await repository?.setLastProjectId(null);
      await refreshProjects();
      setMode("dashboard");
    } catch (cause) {
      setError(friendlyError(cause, "Не удалось сохранить проект перед выходом."));
    }
  };

  const renameActiveProject = (name: string) => {
    const current = activeProjectRef.current;
    if (!current) return;
    try { queueProject(renameProject(current, name, new Date().toISOString())); }
    catch (cause) { setError(friendlyError(cause, "Не удалось переименовать проект.")); }
  };

  const toggleFurnitureCatalog = () => {
    const current = activeProjectRef.current;
    if (!current) return;
    queueProject(replaceProjectUi(current, { furnitureCatalogOpen: !current.ui.furnitureCatalogOpen }, new Date().toISOString()));
  };

  const onViewportChange = (viewport: ProjectViewport) => {
    pendingViewportRef.current = viewport;
    if (viewportTimerRef.current) clearTimeout(viewportTimerRef.current);
    viewportTimerRef.current = setTimeout(applyPendingViewport, 500);
  };

  const exportJson = () => {
    const project = activeProjectRef.current;
    if (!project) return;
    downloadText(serializeProjectFile(project), projectJsonFilename(project.name));
    showToast("Резервная копия Vlezet скачана.");
  };

  const exportPng = async () => {
    const project = activeProjectRef.current;
    if (!project) return;
    try {
      const blob = await renderPlanPngBlob(project.document);
      downloadBlob(blob, `${projectFileSlug(project.name)}.png`);
      showToast("PNG плана скачан.");
    } catch (cause) {
      setError(friendlyError(cause, "Не удалось создать PNG плана."));
    }
  };

  if (mode === "loading") {
    return <main className="project-loading"><div className="brand-mark">V</div><strong>Открываем Vlezet…</strong><span>Проверяем локальные проекты</span></main>;
  }

  if (mode === "recovery") {
    return <main className="project-recovery"><div className="brand-mark">V</div><h1>Не удалось открыть локальные проекты</h1><p role="alert">{error}</p><button className="primary-action recovery-action" type="button" onClick={() => window.location.reload()}>Повторить</button></main>;
  }

  if (mode === "editor" && activeProject) {
    return <>
      <ApartmentEditor
        projectId={activeProject.id}
        projectName={activeProject.name}
        saveStatus={saveStatus}
        initialViewport={activeProject.viewport}
        furnitureCatalogOpen={activeProject.ui.furnitureCatalogOpen}
        onBack={() => void backToProjects()}
        onRenameProject={renameActiveProject}
        onToggleFurnitureCatalog={toggleFurnitureCatalog}
        onViewportChange={onViewportChange}
        onRetrySave={() => void autosaveRef.current?.retry()}
        onExportJson={exportJson}
        onExportPng={() => void exportPng()}
      />
      {error ? <div className="global-error" role="alert"><span>{error}</span><button type="button" onClick={() => setError(null)}>Закрыть</button></div> : null}
      {toast ? <div className="toast" role="status">{toast}</div> : null}
    </>;
  }

  return <>
    <ProjectDashboard
      projects={projects}
      error={error}
      onCreate={createNewProject}
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

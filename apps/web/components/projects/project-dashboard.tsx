"use client";

import { deriveRooms } from "@vlezet/geometry";
import type { VlezetProjectRecord } from "@vlezet/projects";
import { useRef, useState } from "react";
import { UiButton } from "../ui/ui-button";
import { UiEmptyState, UiNotice } from "../ui/ui-feedback";

export type ProjectDashboardProps = Readonly<{
  projects: readonly VlezetProjectRecord[];
  error: string | null;
  onCreate: () => void | Promise<void>;
  onCreateFromPlan: () => void | Promise<void>;
  onOpen: (project: VlezetProjectRecord) => void | Promise<void>;
  onRename: (project: VlezetProjectRecord, name: string) => void | Promise<void>;
  onDuplicate: (project: VlezetProjectRecord) => void | Promise<void>;
  onRequestDelete: (project: VlezetProjectRecord) => void;
  onImport: (file: File) => void | Promise<void>;
}>;

function relativeDate(timestamp: string): string {
  const value = new Date(timestamp).getTime();
  const deltaMinutes = Math.round((value - Date.now()) / 60_000);
  const formatter = new Intl.RelativeTimeFormat("ru", { numeric: "auto" });
  if (Math.abs(deltaMinutes) < 60) return formatter.format(deltaMinutes, "minute");
  const deltaHours = Math.round(deltaMinutes / 60);
  if (Math.abs(deltaHours) < 24) return formatter.format(deltaHours, "hour");
  return formatter.format(Math.round(deltaHours / 24), "day");
}

function projectFacts(project: VlezetProjectRecord): string {
  const roomCount = deriveRooms(project.document).rooms.length;
  const source = project.referencePlan ? " · есть подложка" : "";
  return `${roomCount} комнат · ${project.document.walls.length} стен · ${project.document.placedObjects.length} предметов${source}`;
}

export function ProjectDashboard({
  projects,
  error,
  onCreate,
  onCreateFromPlan,
  onOpen,
  onRename,
  onDuplicate,
  onRequestDelete,
  onImport,
}: ProjectDashboardProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");

  const beginRename = (project: VlezetProjectRecord) => { setEditingId(project.id); setDraftName(project.name); };
  const commitRename = (project: VlezetProjectRecord) => {
    const name = draftName.trim();
    if (!name || name === project.name) { setEditingId(null); return; }
    void Promise.resolve(onRename(project, name)).then(() => setEditingId(null));
  };

  return (
    <main className="projects-page">
      <header className="projects-header">
        <div className="projects-brand"><div className="brand-mark project-brand-mark">V</div><div><strong>Vlezet</strong><span>Проверим, что влезет.</span></div></div>
        <div className="projects-header-actions">
          <input ref={fileRef} className="visually-hidden" type="file" accept=".json,.vlezet.json,application/json" aria-label="Импортировать проект Vlezet" onChange={(event) => { const file = event.target.files?.[0]; event.currentTarget.value = ""; if (file) void onImport(file); }} />
          <UiButton variant="secondary" className="dashboard-action" onClick={() => fileRef.current?.click()}>Импортировать</UiButton>
          <UiButton variant="secondary" className="dashboard-action" onClick={() => void onCreateFromPlan()}>Из плана JPG/PDF</UiButton>
          <UiButton variant="primary" className="dashboard-action" onClick={() => void onCreate()}>Новый проект</UiButton>
        </div>
      </header>

      <section className="projects-content">
        <div className="projects-intro">
          <div><p className="eyebrow">Мои проекты</p><h1>Планировки, к которым можно вернуться</h1><p>Начните с чистого листа или загрузите план застройщика. Всё обрабатывается и сохраняется только в этом браузере.</p></div>
          <UiNotice tone="local" title="Ключевые данные остаются в браузере" className="local-storage-note">
            Без регистрации и отправки плана на сервер.
          </UiNotice>
        </div>
        {error ? <UiNotice tone="error" title="Не удалось выполнить действие" className="dashboard-error">{error}</UiNotice> : null}
        {projects.length === 0 ? (
          <UiEmptyState
            className="projects-empty"
            icon="⌂"
            title="Создайте первую квартиру"
            primaryAction={<UiButton variant="primary" className="empty-action" onClick={() => void onCreateFromPlan()}>Загрузить план</UiButton>}
            secondaryAction={<UiButton variant="secondary" className="empty-action" onClick={() => void onCreate()}>Начать с нуля</UiButton>}
          >
            Загрузите реальный план и обведите его или нарисуйте стены с нуля.
          </UiEmptyState>
        ) : (
          <div className="project-grid">
            {projects.map((project) => (
              <article className="project-card" key={project.id}>
                <button className="project-card-open" type="button" onClick={() => void onOpen(project)} aria-label={`Открыть проект ${project.name}`}><div className="project-preview" aria-hidden="true"><span /><span /><span /></div></button>
                <div className="project-card-body">
                  {editingId === project.id ? <input className="project-name-input" value={draftName} maxLength={80} autoFocus onChange={(event) => setDraftName(event.target.value)} onBlur={() => commitRename(project)} onKeyDown={(event) => { if (event.key === "Enter") commitRename(project); if (event.key === "Escape") setEditingId(null); }} /> : <button className="project-title-button" type="button" onDoubleClick={() => beginRename(project)} onClick={() => void onOpen(project)}>{project.name}</button>}
                  <p className="project-facts">{projectFacts(project)}</p>
                  <p className="project-updated" title={new Date(project.updatedAt).toLocaleString("ru")}>Изменён {relativeDate(project.updatedAt)}</p>
                </div>
                <div className="project-card-actions" aria-label={`Действия с проектом ${project.name}`}><button type="button" onClick={() => beginRename(project)}>Переименовать</button><button type="button" onClick={() => void onDuplicate(project)}>Копия</button><button className="project-delete-button" type="button" onClick={() => onRequestDelete(project)}>Удалить</button></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

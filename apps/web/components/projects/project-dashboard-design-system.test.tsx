import { createProject } from "@vlezet/projects";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { focusTriggerThenRequestDelete, ProjectDashboard } from "./project-dashboard";

const callbacks = {
  onCreate: () => undefined,
  onCreateFromPlan: () => undefined,
  onOpen: () => undefined,
  onRename: () => undefined,
  onDuplicate: () => undefined,
  onRequestDelete: () => undefined,
  onImport: () => undefined,
} as const;

describe("project feedback design-system migration", () => {
  it("uses shared local, error and empty-state anatomy on the dashboard", () => {
    const html = renderToStaticMarkup(
      <ProjectDashboard projects={[]} error="Не удалось прочитать проекты." {...callbacks} />,
    );

    expect(html).toContain("ui-notice-local");
    expect(html).toContain("Ключевые данные остаются в браузере");
    expect(html).toContain("ui-notice-error");
    expect(html).toContain('role="alert"');
    expect(html).toContain("ui-empty-state");
    expect(html).toContain("ui-empty-state-primary");
    expect(html).toContain("ui-empty-state-secondary");
  });

  it("governs editor-owned ephemeral feedback through the shared token layer", () => {
    const controller = readFileSync(new URL("./project-app.tsx", import.meta.url), "utf8");
    const styles = readFileSync(new URL("../../app/design-system-migrations.css", import.meta.url), "utf8");

    expect(controller).toContain('className="global-error"');
    expect(controller).toContain('className="toast"');
    expect(controller).toContain("setError(null)");
    expect(controller).toContain("showToast");
    expect(styles).toContain(".global-error");
    expect(styles).toContain(".toast");
    expect(styles).toContain("font-size: var(--font-helper)");
  });

  it("focuses the delete trigger then requests confirmation", () => {
    const project = createProject({ id: "project-1", name: "Квартира", now: "2026-07-22T00:00:00.000Z" });
    const order: string[] = [];
    const requested: unknown[] = [];
    const event = {
      currentTarget: {
        focus: () => {
          order.push("focus");
        },
      },
    };

    focusTriggerThenRequestDelete(project, (value) => {
      order.push("delete");
      requested.push(value);
    })(event);

    expect(order).toEqual(["focus", "delete"]);
    expect(requested).toEqual([project]);
  });

  it("renders project cards so delete wiring stays in the live tree", () => {
    const project = createProject({ id: "project-1", name: "Квартира", now: "2026-07-22T00:00:00.000Z" });
    const html = renderToStaticMarkup(
      <ProjectDashboard projects={[project]} error={null} {...callbacks} />,
    );

    expect(html).toContain("project-delete-button");
    expect(html).toContain("Удалить");
    expect(html).toContain(project.name);
    const source = readFileSync(new URL("./project-dashboard.tsx", import.meta.url), "utf8");
    expect(source).toContain("onClick={focusTriggerThenRequestDelete(project, onRequestDelete)}");
  });
});


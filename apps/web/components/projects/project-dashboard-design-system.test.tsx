import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ProjectDashboard } from "./project-dashboard";

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

  it("wires editor errors and toasts to shared notices without changing state ownership", () => {
    const source = readFileSync(new URL("./project-app.tsx", import.meta.url), "utf8");

    expect(source).toContain('<UiNotice tone="error"');
    expect(source).toContain('<UiNotice tone="success"');
    expect(source).toContain("setError(null)");
    expect(source).toContain("showToast");
  });
});

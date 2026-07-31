import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiBadge, UiEmptyState, UiNotice } from "./ui-feedback";

describe("shared feedback primitives", () => {
  it("renders urgent errors as alerts and non-urgent live feedback as statuses", () => {
    const error = renderToStaticMarkup(<UiNotice tone="error" title="Не удалось сохранить">Повторите действие.</UiNotice>);
    const saved = renderToStaticMarkup(<UiNotice tone="success" title="Сохранено" live>Проект сохранён локально.</UiNotice>);
    const quiet = renderToStaticMarkup(<UiNotice tone="info" title="Подсказка">Выберите предмет.</UiNotice>);

    expect(error).toContain('role="alert"');
    expect(error).toContain('data-tone="error"');
    expect(saved).toContain('role="status"');
    expect(saved).toContain('aria-live="polite"');
    expect(quiet).not.toContain('role="status"');
  });

  it("keeps badge meaning textual instead of colour-only", () => {
    const html = renderToStaticMarkup(<UiBadge tone="warning">Влезает, но тесно</UiBadge>);
    expect(html).toContain('data-tone="warning"');
    expect(html).toContain("Влезает, но тесно");
    expect(html).toContain('aria-hidden="true"');
  });

  it("renders a primary empty-state action separately from secondary actions", () => {
    const html = renderToStaticMarkup(
      <UiEmptyState
        title="Создайте первую квартиру"
        primaryAction={<button type="button">Загрузить план</button>}
        secondaryAction={<button type="button">Начать с нуля</button>}
      >
        Проект хранится только в этом браузере.
      </UiEmptyState>,
    );

    expect(html).toContain("ui-empty-state-primary");
    expect(html).toContain("ui-empty-state-secondary");
    expect(html).toContain("Загрузить план");
  });

  it("remains independent from stores and domain authorities", () => {
    const source = readFileSync(new URL("./ui-feedback.tsx", import.meta.url), "utf8");
    for (const forbidden of ["zustand", "editorStore", "@vlezet/geometry", "@vlezet/projects", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

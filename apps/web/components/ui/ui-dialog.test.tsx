import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { UiDialog } from "./ui-dialog";

describe("UiDialog", () => {
  it("renders one accessible modal anatomy with title, description and footer", () => {
    const html = renderToStaticMarkup(
      <UiDialog
        open
        title="Удалить проект?"
        description="Проект и локальная подложка будут удалены."
        onClose={() => undefined}
        footer={<button type="button">Удалить</button>}
      >
        <p>Действие нельзя отменить.</p>
      </UiDialog>,
    );

    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("aria-labelledby");
    expect(html).toContain("aria-describedby");
    expect(html).toContain("ui-dialog-header");
    expect(html).toContain("ui-dialog-body");
    expect(html).toContain("ui-dialog-footer");
    expect(html).toContain('aria-label="Закрыть"');
  });

  it("does not render closed dialogs and exposes busy state when open", () => {
    expect(renderToStaticMarkup(<UiDialog open={false} title="Скрыт" onClose={() => undefined} />)).toBe("");
    const busy = renderToStaticMarkup(<UiDialog open title="Анализ" busy onClose={() => undefined} />);
    expect(busy).toContain('aria-busy="true"');
    expect(busy).toContain("disabled");
  });

  it("contains Escape handling, focus trapping and no domain authority imports", () => {
    const source = readFileSync(new URL("./ui-dialog.tsx", import.meta.url), "utf8");
    expect(source).toContain('event.key === "Escape"');
    expect(source).toContain('event.key !== "Tab"');
    expect(source).toContain("querySelectorAll");
    for (const forbidden of ["zustand", "editorStore", "@vlezet/geometry", "@vlezet/projects", "indexedDB"]) {
      expect(source).not.toContain(forbidden);
    }
  });
});

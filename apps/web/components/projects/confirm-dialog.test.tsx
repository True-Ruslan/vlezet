import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

describe("ConfirmDialog shared foundation", () => {
  it("adapts project confirmation to UiDialog and shared actions", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open
        title="Удалить проект?"
        description="Действие нельзя отменить."
        confirmLabel="Удалить проект"
        danger
        onConfirm={() => undefined}
        onCancel={() => undefined}
      />,
    );

    expect(html).toContain('class="ui-dialog confirm-dialog"');
    expect(html).toContain('role="dialog"');
    expect(html).toContain('class="ui-button ui-button-secondary"');
    expect(html).toContain('class="ui-button ui-button-danger"');
    expect(html).toContain("Удалить проект");
  });
});

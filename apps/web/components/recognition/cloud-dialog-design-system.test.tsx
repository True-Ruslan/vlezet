import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { CloudDialog } from "./cloud-dialog";

describe("CloudDialog design-system migration", () => {
  it("uses shared dialog, fields, notices and actions while preserving the request form", () => {
    const html = renderToStaticMarkup(
      <CloudDialog open busy={false} onClose={() => undefined} onRun={async () => undefined} />,
    );

    expect(html).toContain('class="ui-dialog recognition-modal"');
    expect(html).toContain('id="openrouter-api-key"');
    expect(html).toContain('class="ui-field"');
    expect(html).toContain("ui-notice-local");
    expect(html).toContain("Ключ не сохраняется");
    expect(html).toContain('class="ui-button ui-button-secondary"');
    expect(html).toContain('class="ui-button ui-button-primary"');
    expect(html).toContain("Анализировать");
  });
});

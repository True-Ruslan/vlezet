import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorToolBarView } from "./editor-toolbar";

const noop = () => {};

function render(input: Readonly<{
  sourceAssistEnabled: boolean;
  hasReferencePlan: boolean;
  editingDisabled?: boolean;
}>) {
  return renderToStaticMarkup(
    <EditorToolBarView
      tool="wall"
      measurementActive={false}
      dimensionsVisible
      snappingEnabled
      sourceAssistEnabled={input.sourceAssistEnabled}
      viewMode={input.editingDisabled ? "3d" : "2d"}
      placementPresetId={null}
      furnitureCatalogOpen={false}
      referencePanelOpen={false}
      recognitionPanelOpen={false}
      hasReferencePlan={input.hasReferencePlan}
      editingDisabled={input.editingDisabled ?? false}
      onChooseTool={noop}
      onActivateMeasurement={noop}
      onToggleDimensions={noop}
      onToggleSnapping={noop}
      onToggleSourceAssist={noop}
      onToggleFurniture={noop}
      onToggleReference={noop}
      onToggleRecognition={noop}
      onChooseViewMode={noop}
    />,
  );
}

function sourceAssistButton(html: string): string {
  const match = html.match(/<button[^>]*aria-label="По подложке"[^>]*>[\s\S]*?<\/button>/);
  expect(match, html).not.toBeNull();
  return match?.[0] ?? "";
}

describe("M8.4 source assist toolbar control", () => {
  it("renders a discoverable Off control for a calibrated reference", () => {
    const button = sourceAssistButton(render({ sourceAssistEnabled: false, hasReferencePlan: true }));

    expect(button).toContain('aria-pressed="false"');
    expect(button).not.toContain("disabled");
    expect(button).toContain("По подложке");
  });

  it("exposes the enabled state through aria-pressed", () => {
    const button = sourceAssistButton(render({ sourceAssistEnabled: true, hasReferencePlan: true }));
    expect(button).toContain('aria-pressed="true"');
  });

  it("keeps the control discoverable but disabled without a reference", () => {
    const button = sourceAssistButton(render({ sourceAssistEnabled: false, hasReferencePlan: false }));
    expect(button).toContain("disabled");
    expect(button).toContain('aria-pressed="false"');
  });

  it("disables source assistance when editing is unavailable in 3D", () => {
    const button = sourceAssistButton(
      render({ sourceAssistEnabled: true, hasReferencePlan: true, editingDisabled: true }),
    );
    expect(button).toContain("disabled");
    expect(button).toContain('aria-pressed="true"');
  });

  it("does not change the existing visible structural snapping control", () => {
    const html = render({ sourceAssistEnabled: false, hasReferencePlan: true });
    expect(html).toContain('aria-label="Привязки"');
    expect(html).toContain('aria-label="Привязки" aria-pressed="true"');
  });
});

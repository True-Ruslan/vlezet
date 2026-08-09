import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EditorToolBarView } from "./editor-toolbar";

const noop = () => {};

function render(snappingEnabled: boolean) {
  return renderToStaticMarkup(
    <EditorToolBarView
      tool="select"
      measurementActive={false}
      dimensionsVisible
      snappingEnabled={snappingEnabled}
      viewMode="2d"
      placementPresetId={null}
      furnitureCatalogOpen={false}
      referencePanelOpen={false}
      recognitionPanelOpen={false}
      hasReferencePlan={false}
      editingDisabled={false}
      onChooseTool={noop}
      onActivateMeasurement={noop}
      onToggleDimensions={noop}
      onToggleSnapping={noop}
      onToggleFurniture={noop}
      onToggleReference={noop}
      onToggleRecognition={noop}
      onChooseViewMode={noop}
    />,
  );
}

describe("M8.2 visible structural snapping control", () => {
  it("renders discoverable Привязки state with aria-pressed=true when enabled", () => {
    const html = render(true);
    expect(html).toContain("Привязки");
    expect(html).toContain('aria-label="Привязки"');
    expect(html).toContain('aria-pressed="true"');
  });

  it("renders the same visible control with aria-pressed=false when disabled", () => {
    const html = render(false);
    expect(html).toContain("Привязки");
    expect(html).toContain('aria-pressed="false"');
  });
});

import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { PlanningPanelView } from "./planning-panel";

describe("planning intent panel integration", () => {
  it("renders reviewed language intent before ordinary structured controls", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[]}
        pairs={[]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        activeExactPairKey={null}
        errorMessage={null}
        intentSection={<section>M6.4 reviewed intent section</section>}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onShowExactPair={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("M6.4 reviewed intent section");
    expect(html.indexOf("M6.4 reviewed intent section")).toBeLessThan(html.indexOf("Что переставить"));
  });
});

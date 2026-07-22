import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { RankedPlanningCandidate } from "@vlezet/planning";
import { PlanningPanelView, togglePlanningSelection } from "./planning-panel";

const ranked: RankedPlanningCandidate = {
  candidate: {
    id: "candidate:1",
    roomId: "room-1",
    placements: [{ objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 }],
  },
  evaluation: {
    candidateId: "candidate:1",
    valid: true,
    tightObjectCount: 0,
    recommendationCount: 0,
    rotatedObjectCount: 1,
    totalMovementMm: 1200,
    reasons: ["Все выбранные предметы помещаются без столкновений.", "Открывание дверей не перекрыто."],
    stableKey: "room-1|sofa",
  },
};

describe("planning selection", () => {
  it("allows selecting at most three objects and toggles an existing selection off", () => {
    expect(togglePlanningSelection(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });
});

describe("PlanningPanelView", () => {
  it("renders deterministic alternatives with explanations and explicit preview/apply controls", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[
          { id: "sofa", name: "Диван", selected: true },
          { id: "table", name: "Стол", selected: false },
        ]}
        canGenerate
        result={{ roomId: "room-1", evaluatedCandidateCount: 12, validCandidateCount: 4, candidates: [ranked] }}
        previewCandidateId="candidate:1"
        errorMessage={null}
        onToggleObject={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("Варианты расстановки");
    expect(html).toContain("Диван");
    expect(html).toContain("Стол");
    expect(html).toContain("Вариант 1");
    expect(html).toContain("Лучший");
    expect(html).toContain("Все выбранные предметы помещаются без столкновений.");
    expect(html).toContain("Предпросмотр");
    expect(html).toContain("Применить");
  });

  it("renders controlled no-result/error copy", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        errorMessage="Нет допустимых вариантов расстановки."
        onToggleObject={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Нет допустимых вариантов расстановки.");
  });
});

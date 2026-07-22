import type { PlanningConstraint, RankedPlanningCandidate } from "@vlezet/planning";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildPlanningConstraints,
  planningPairKey,
  PlanningPanelView,
  togglePlanningSelection,
} from "./planning-panel";

const ranked: RankedPlanningCandidate = {
  candidate: {
    id: "candidate:1",
    roomId: "room-1",
    placements: [{ objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 }],
    constraints: [{ kind: "prefer-room-boundary", objectId: "sofa", target: "wall" }],
  },
  evaluation: {
    candidateId: "candidate:1",
    valid: true,
    tightObjectCount: 0,
    recommendationCount: 0,
    preferencePenalty: 0.05,
    rotatedObjectCount: 1,
    totalMovementMm: 1200,
    reasons: [
      "Все выбранные предметы помещаются без столкновений.",
      "Открывание дверей не перекрыто.",
      "Диван: до ближайшей стены 25 мм.",
    ],
    stableKey: "room-1|sofa",
  },
};

describe("planning selection", () => {
  it("allows selecting at most three objects and toggles an existing selection off", () => {
    expect(togglePlanningSelection(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("builds deterministic structured constraints from UI state", () => {
    const constraints = buildPlanningConstraints(
      ["sofa", "table", "chair"],
      ["table"],
      { sofa: "wall", chair: "corner" },
      {
        [planningPairKey("sofa", "table")]: "near",
        [planningPairKey("chair", "sofa")]: "far",
      },
    );
    expect(constraints).toEqual<PlanningConstraint[]>([
      { kind: "lock-object", objectId: "table" },
      { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
      { kind: "prefer-room-boundary", objectId: "chair", target: "corner" },
      { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
      { kind: "pair-distance", objectIds: ["chair", "sofa"], preference: "far" },
    ]);
  });
});

describe("PlanningPanelView", () => {
  it("renders constraint controls, deterministic evidence and explicit preview/apply controls", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[
          { id: "sofa", name: "Диван", selected: true, locked: false, boundaryPreference: "wall" },
          { id: "table", name: "Стол", selected: true, locked: true, boundaryPreference: "none" },
        ]}
        pairs={[{
          key: planningPairKey("sofa", "table"), firstName: "Диван", secondName: "Стол", preference: "near",
        }]}
        canGenerate
        result={{ roomId: "room-1", evaluatedCandidateCount: 12, validCandidateCount: 4, candidates: [ranked] }}
        previewCandidateId="candidate:1"
        errorMessage={null}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("M6.2");
    expect(html).toContain("Не двигать");
    expect(html).toContain("Ближе к стене");
    expect(html).toContain("Ближе к углу");
    expect(html).toContain("Ближе друг к другу");
    expect(html).toContain("по центрам предметов");
    expect(html).toContain("Диван: до ближайшей стены 25 мм.");
    expect(html).toContain("Предпросмотр");
    expect(html).toContain("Применить");
  });

  it("renders controlled no-result/error copy", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[]}
        pairs={[]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        errorMessage="Нет допустимых вариантов расстановки."
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Нет допустимых вариантов расстановки.");
  });
});

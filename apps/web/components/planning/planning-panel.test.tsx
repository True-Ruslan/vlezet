import type { PlanningConstraint, RankedPlanningCandidate } from "@vlezet/planning";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import {
  buildPlanningConstraints,
  parsePairMinimumGapInput,
  planningPairKey,
  PlanningPanelView,
  togglePlanningSelection,
} from "./planning-panel";

const ranked: RankedPlanningCandidate = {
  candidate: {
    id: "candidate:1",
    roomId: "room-1",
    placements: [
      { objectId: "sofa", position: { x: 1000, y: 2000 }, rotationDeg: 90 },
      { objectId: "table", position: { x: 2800, y: 2000 }, rotationDeg: 0 },
    ],
    constraints: [
      { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
    ],
  },
  evaluation: {
    candidateId: "candidate:1",
    valid: true,
    tightObjectCount: 0,
    recommendationCount: 0,
    preferencePenalty: 0,
    rotatedObjectCount: 1,
    totalMovementMm: 1200,
    reasons: [
      "Все выбранные предметы помещаются без столкновений.",
      "Открывание дверей не перекрыто.",
      "Диван ↔ Стол: требуется минимум 800 мм, фактически 842 мм.",
    ],
    stableKey: "room-1|sofa|table",
  },
};

describe("planning selection", () => {
  it("allows selecting at most three objects and toggles an existing selection off", () => {
    expect(togglePlanningSelection(["a", "b"], "c")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "d")).toEqual(["a", "b", "c"]);
    expect(togglePlanningSelection(["a", "b", "c"], "b")).toEqual(["a", "c"]);
  });

  it("distinguishes empty exact spacing from a real zero and parses decimal comma explicitly", () => {
    expect(parsePairMinimumGapInput("")).toBeNull();
    expect(parsePairMinimumGapInput("   ")).toBeNull();
    expect(parsePairMinimumGapInput("0")).toBe(0);
    expect(parsePairMinimumGapInput("800")).toBe(800);
    expect(parsePairMinimumGapInput("800,5")).toBe(800.5);
    expect(() => parsePairMinimumGapInput("-1")).toThrow();
    expect(() => parsePairMinimumGapInput("abc")).toThrow();
    expect(() => parsePairMinimumGapInput("Infinity")).toThrow();
  });

  it("builds qualitative and exact structured constraints from the same pair UI state", () => {
    const sofaTable = planningPairKey("sofa", "table");
    const constraints = buildPlanningConstraints(
      ["sofa", "table", "chair"],
      ["table"],
      { sofa: "wall", chair: "corner" },
      {
        [sofaTable]: "near",
        [planningPairKey("chair", "sofa")]: "far",
      },
      { [sofaTable]: "800" },
    );
    expect(constraints).toEqual<PlanningConstraint[]>([
      { kind: "lock-object", objectId: "table" },
      { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
      { kind: "prefer-room-boundary", objectId: "chair", target: "corner" },
      { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
      { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
      { kind: "pair-distance", objectIds: ["chair", "sofa"], preference: "far" },
    ]);
  });
});

describe("PlanningPanelView", () => {
  it("renders exact spacing controls, honest hard-constraint summary, measured evidence and preview/apply controls", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[
          { id: "sofa", name: "Диван", selected: true, locked: false, boundaryPreference: "none" },
          { id: "table", name: "Стол", selected: true, locked: false, boundaryPreference: "none" },
        ]}
        pairs={[{
          key: planningPairKey("sofa", "table"),
          firstName: "Диван",
          secondName: "Стол",
          preference: "none",
          minimumGapInput: "800",
          minimumGapError: null,
        }]}
        canGenerate
        result={{ roomId: "room-1", evaluatedCandidateCount: 12, validCandidateCount: 4, candidates: [ranked] }}
        previewCandidateId="candidate:1"
        errorMessage={null}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain("M6.3");
    expect(html).toContain("Не двигать");
    expect(html).toContain("Ближе друг к другу");
    expect(html).toContain("Минимальный проход между предметами");
    expect(html).toContain("по ближайшим краям мебели");
    expect(html).toContain("Обязательные ограничения соблюдены");
    expect(html).not.toContain("Без обязательных коллизий и ограничений");
    expect(html).toContain("требуется минимум 800 мм");
    expect(html).toContain("фактически 842 мм");
    expect(html).toContain("Предпросмотр");
    expect(html).toContain("Применить");
  });

  it("does not hide later exact-spacing evidence behind a reason-count cutoff", () => {
    const lastExactReason = "Кресло ↔ Стол: требуется минимум 600 мм, фактически 625 мм.";
    const manyReasons: RankedPlanningCandidate = {
      ...ranked,
      candidate: {
        ...ranked.candidate,
        placements: [
          ...ranked.candidate.placements,
          { objectId: "chair", position: { x: 3900, y: 2400 }, rotationDeg: 0 },
        ],
        constraints: [
          { kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 },
          { kind: "pair-min-gap", objectIds: ["chair", "sofa"], minimumMm: 700 },
          { kind: "pair-min-gap", objectIds: ["chair", "table"], minimumMm: 600 },
        ],
      },
      evaluation: {
        ...ranked.evaluation,
        reasons: [
          "Все выбранные предметы помещаются без столкновений.",
          "Открывание дверей не перекрыто.",
          "Диван: до ближайшей стены 20 мм.",
          "Стол: до ближайшей стены 30 мм.",
          "Кресло: до ближайшего угла 40 мм.",
          "Диван ↔ Стол: 1800 мм между центрами; предпочтение «дальше».",
          "Диван ↔ Стол: требуется минимум 800 мм, фактически 842 мм.",
          "Кресло ↔ Диван: требуется минимум 700 мм, фактически 710 мм.",
          lastExactReason,
        ],
      },
    };

    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[]}
        pairs={[]}
        canGenerate
        result={{ roomId: "room-1", evaluatedCandidateCount: 12, validCandidateCount: 1, candidates: [manyReasons] }}
        previewCandidateId={null}
        errorMessage={null}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );

    expect(html).toContain(lastExactReason);
  });

  it("renders local exact-input validation and disables generation", () => {
    const html = renderToStaticMarkup(
      <PlanningPanelView
        roomName="Комната 1"
        objects={[
          { id: "sofa", name: "Диван", selected: true, locked: false, boundaryPreference: "none" },
          { id: "table", name: "Стол", selected: true, locked: false, boundaryPreference: "none" },
        ]}
        pairs={[{
          key: planningPairKey("sofa", "table"),
          firstName: "Диван",
          secondName: "Стол",
          preference: "none",
          minimumGapInput: "-5",
          minimumGapError: "Введите минимальный проход как неотрицательное число в миллиметрах.",
        }]}
        canGenerate={false}
        result={null}
        previewCandidateId={null}
        errorMessage={null}
        onToggleObject={() => {}}
        onToggleLock={() => {}}
        onBoundaryPreferenceChange={() => {}}
        onPairPreferenceChange={() => {}}
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Введите минимальный проход как неотрицательное число в миллиметрах.");
    expect(html).toContain("disabled");
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
        onPairMinimumGapChange={() => {}}
        onGenerate={() => {}}
        onPreview={() => {}}
        onApply={() => {}}
        onClose={() => {}}
      />,
    );
    expect(html).toContain("Нет допустимых вариантов расстановки.");
  });
});

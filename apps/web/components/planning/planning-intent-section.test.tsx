import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PlanningIntentReviewDraft } from "./planning-intent-review";
import { PlanningIntentSectionView } from "./planning-intent-section";

const roomObjects = [
  { id: "sofa", name: "Диван" },
  { id: "chair", name: "Кресло" },
  { id: "work-table", name: "Рабочий стол" },
  { id: "dining-table", name: "Обеденный стол" },
] as const;

const draft: PlanningIntentReviewDraft = {
  clauses: [
    {
      id: "clause-0",
      clause: { kind: "lock-object", objectRef: "Диван", sourceText: "Диван не двигать" },
      references: [{
        key: "clause-0:0",
        objectRef: "Диван",
        resolution: { status: "resolved", objectId: "sofa" },
        selectedObjectId: "sofa",
      }],
    },
    {
      id: "clause-1",
      clause: {
        kind: "pair-min-gap",
        objectRefs: ["Кресло", "стол"],
        minimumMm: 800,
        sourceText: "Между креслом и столом минимум 800 мм",
      },
      references: [
        {
          key: "clause-1:0",
          objectRef: "Кресло",
          resolution: { status: "resolved", objectId: "chair" },
          selectedObjectId: "chair",
        },
        {
          key: "clause-1:1",
          objectRef: "стол",
          resolution: { status: "ambiguous", candidateObjectIds: ["dining-table", "work-table"] },
          selectedObjectId: null,
        },
      ],
    },
  ],
  unsupportedFragments: [{ text: "Стол ближе к окну", acknowledged: false }],
  warnings: ["Окно пока не поддерживается"],
};

const callbacks = {
  onRequestTextChange: () => {},
  onApiKeyChange: () => {},
  onModelChange: () => {},
  onAnalyze: () => {},
  onResolveReference: () => {},
  onToggleUnsupported: () => {},
  onRemoveClause: () => {},
  onTransfer: () => {},
} as const;

describe("PlanningIntentSectionView", () => {
  it("renders review-only language input, ambiguity and unsupported gates", () => {
    const html = renderToStaticMarkup(
      <PlanningIntentSectionView
        requestText="Диван не двигать"
        apiKey=""
        models={[]}
        modelId=""
        loading={false}
        draft={draft}
        roomObjects={roomObjects}
        canTransfer={false}
        errorMessage={null}
        {...callbacks}
      />,
    );

    expect(html).toContain("Опишите пожелания");
    expect(html).toContain("Разобрать пожелания");
    expect(html).toContain("API key хранится только до закрытия панели");
    expect(html).toContain("Диван — не двигать");
    expect(html).toContain("минимальный зазор 800 мм");
    expect(html).toContain("Нужно выбрать предмет");
    expect(html).toContain("Рабочий стол");
    expect(html).toContain("Обеденный стол");
    expect(html).toContain("Не поддержано");
    expect(html).toContain("Стол ближе к окну");
    expect(html).toContain("Перенести в ограничения");
    expect(html).toContain("disabled");
  });

  it("keeps manual planning explicitly available after provider failure", () => {
    const html = renderToStaticMarkup(
      <PlanningIntentSectionView
        requestText="Диван не двигать"
        apiKey="key"
        models={[]}
        modelId=""
        loading={false}
        draft={null}
        roomObjects={roomObjects}
        canTransfer={false}
        errorMessage="OpenRouter временно недоступен."
        {...callbacks}
      />,
    );

    expect(html).toContain("OpenRouter временно недоступен");
    expect(html).toContain("Ручные ограничения ниже остаются доступны");
  });
});

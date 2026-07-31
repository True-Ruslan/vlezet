import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const referenceSource = readFileSync(new URL("../reference/reference-panel.tsx", import.meta.url), "utf8");
const recognitionSource = readFileSync(new URL("../recognition/recognition-panel.tsx", import.meta.url), "utf8");
const planningSource = readFileSync(new URL("../planning/planning-panel.tsx", import.meta.url), "utf8");
const planningIntentSource = readFileSync(new URL("../planning/planning-intent-section.tsx", import.meta.url), "utf8");
const wallInspectorSource = readFileSync(new URL("./wall-inspector.tsx", import.meta.url), "utf8");
const apartmentSource = readFileSync(new URL("./apartment-editor.tsx", import.meta.url), "utf8");

describe("M7.2 bounded workflow panels", () => {
  it("uses one shared context frame and explicit navigation in every workflow", () => {
    for (const source of [referenceSource, recognitionSource, planningSource]) {
      expect(source).toContain("ContextPanelFrame");
      expect(source).toContain("navigation=");
    }
    expect(referenceSource).toContain("describeReferenceContext");
    expect(recognitionSource).toContain("describeRecognitionContext");
    expect(planningSource).toContain("describePlanningContext");
  });

  it("removes ambiguous inner close controls and internal milestone copy", () => {
    expect(referenceSource).not.toContain("aria-label=\"Закрыть панель\"");
    expect(recognitionSource).not.toContain("aria-label=\"Закрыть распознавание\"");
    expect(planningSource).not.toContain(">Закрыть<");
    expect(planningSource).not.toContain("M6.4");
    expect(planningIntentSource).not.toContain("M6.4");
  });

  it("derives a visible phase from the existing workflow state", () => {
    expect(referenceSource).toContain("referenceWorkflowPhase");
    expect(recognitionSource).toContain("recognitionWorkflowPhase");
    expect(planningSource).toContain("planningWorkflowPhase");
  });

  it("describes immediate reference edits without promising editor-history Undo", () => {
    expect(referenceSource).toContain("применяются сразу и сохраняются локально вместе с проектом");
    expect(referenceSource).not.toContain("отменяемы через историю проекта");
  });

  it("keeps reference removal inline-confirmed and explicitly preserves apartment geometry", () => {
    expect(referenceSource).toContain("ContextDangerZone");
    expect(referenceSource).toContain("Стены, проёмы и мебель останутся");
    expect(referenceSource).toContain("Удалить только исходный план?");
    expect(referenceSource).toContain("removePending");
  });

  it("threads one semantic navigation action from ApartmentEditor through WallInspector to PlanningPanel", () => {
    expect(apartmentSource).toContain("workflowNavigation");
    expect(apartmentSource).toContain("workflowReturnActionLabel");
    expect(wallInspectorSource).toContain("planningNavigation");
    expect(wallInspectorSource).toContain("<PlanningPanel roomId={planningRoomId} navigation={planningNavigation}");
    expect(planningSource).toContain("navigation: ContextPanelNavigation");
  });
});

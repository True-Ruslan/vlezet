import { beforeEach, describe, expect, it } from "vitest";
import { canvasTransientFeedbackStore } from "./canvas-transient-feedback-store";

describe("M7.4 ephemeral Canvas pointer feedback", () => {
  beforeEach(() => canvasTransientFeedbackStore.getState().reset());

  it("starts with no hover, preview or pan state", () => {
    expect(canvasTransientFeedbackStore.getState()).toMatchObject({
      hoveredSelectable: false,
      previewState: "none",
      panState: "idle",
    });
  });

  it("publishes only semantic transient state", () => {
    const state = canvasTransientFeedbackStore.getState();
    state.setHoveredSelectable(true);
    state.setPreviewState("invalid");
    state.setPanState("active");

    expect(canvasTransientFeedbackStore.getState()).toMatchObject({
      hoveredSelectable: true,
      previewState: "invalid",
      panState: "active",
    });
  });

  it("resets all transient feedback atomically", () => {
    const state = canvasTransientFeedbackStore.getState();
    state.setHoveredSelectable(true);
    state.setPreviewState("valid");
    state.setPanState("ready");
    canvasTransientFeedbackStore.getState().reset();

    expect(canvasTransientFeedbackStore.getState()).toMatchObject({
      hoveredSelectable: false,
      previewState: "none",
      panState: "idle",
    });
  });
});

import { describe, expect, it } from "vitest";
import { deriveFirstProjectProgress } from "./first-project-progress";

describe("M7.5 first-project progress", () => {
  it("guides an empty project to the wall tool", () => {
    expect(deriveFirstProjectProgress({ wallCount: 0, roomCount: 0 })).toMatchObject({
      phase: "empty",
      completedSteps: ["project-created"],
      currentStep: "first-wall",
      primaryAction: "activate-wall-tool",
      title: "Первый план",
    });
  });

  it("keeps room completion pending while walls are open", () => {
    expect(deriveFirstProjectProgress({ wallCount: 3, roomCount: 0 })).toMatchObject({
      phase: "drawing",
      completedSteps: ["project-created", "first-wall"],
      currentStep: "closed-room",
      primaryAction: "activate-wall-tool",
      title: "Контур ещё не замкнут",
    });
  });

  it("uses authoritative room count for success", () => {
    expect(deriveFirstProjectProgress({ wallCount: 4, roomCount: 1 })).toMatchObject({
      phase: "room-created",
      completedSteps: ["project-created", "first-wall", "closed-room"],
      currentStep: "review-room",
      primaryAction: "select-first-room",
      title: "Первая комната готова",
    });
  });

  it.each([
    { wallCount: Number.NaN, roomCount: 0 },
    { wallCount: -1, roomCount: 0 },
    { wallCount: 1.5, roomCount: 0 },
    { wallCount: 0, roomCount: Number.POSITIVE_INFINITY },
  ])("fails closed for invalid counts: %o", (input) => {
    expect(deriveFirstProjectProgress(input)).toMatchObject({
      phase: "empty",
      completedSteps: [],
      currentStep: "first-wall",
      primaryAction: null,
    });
  });
});

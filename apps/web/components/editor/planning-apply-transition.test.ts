import { describe, expect, it } from "vitest";
import { observePlanningApplyTransition, type PlanningApplyObservation } from "./planning-apply-transition";

function observation(projectId: string, planningOpen: boolean, pastLength: number, lastLabel: string | null): PlanningApplyObservation {
  return { projectId, planningOpen, pastLength, lastLabel };
}

describe("M7.5 planning Apply transition", () => {
  it("publishes as soon as the authoritative semantic command is appended", () => {
    expect(observePlanningApplyTransition(
      observation("p1", true, 4, "object/update"),
      observation("p1", true, 5, "planning/apply-candidate"),
    ).applied).toBe(true);
  });

  it("also remains correct when Apply and workflow close are batched", () => {
    expect(observePlanningApplyTransition(
      observation("p1", true, 4, "object/update"),
      observation("p1", false, 5, "planning/apply-candidate"),
    ).applied).toBe(true);
  });

  it("does not treat ordinary close, unrelated history or project switch as Apply", () => {
    expect(observePlanningApplyTransition(
      observation("p1", true, 4, "object/update"),
      observation("p1", false, 4, "object/update"),
    ).applied).toBe(false);
    expect(observePlanningApplyTransition(
      observation("p1", true, 4, "object/update"),
      observation("p1", false, 5, "wall/add"),
    ).applied).toBe(false);
    expect(observePlanningApplyTransition(
      observation("p1", true, 4, "object/update"),
      observation("p2", false, 5, "planning/apply-candidate"),
    ).applied).toBe(false);
  });
});

import { describe, expect, it } from "vitest";
import { observeFirstRoomTransition, type FirstRoomObservation } from "./first-room-transition";

function observation(projectId: string, roomIds: readonly string[]): FirstRoomObservation {
  return { projectId, roomIds };
}

describe("M7.5 first-room transition", () => {
  it("does not manufacture success when an existing project first loads", () => {
    expect(observeFirstRoomTransition(null, observation("p1", ["room-1"]))).toEqual({
      next: observation("p1", ["room-1"]),
      createdRoomId: null,
    });
  });

  it("reports the first authoritative room on a same-project zero-to-one transition", () => {
    expect(observeFirstRoomTransition(observation("p1", []), observation("p1", ["room-1"]))).toEqual({
      next: observation("p1", ["room-1"]),
      createdRoomId: "room-1",
    });
  });

  it("does not report additional rooms or room deletion as first-room success", () => {
    expect(observeFirstRoomTransition(observation("p1", ["room-1"]), observation("p1", ["room-1", "room-2"])).createdRoomId).toBeNull();
    expect(observeFirstRoomTransition(observation("p1", ["room-1"]), observation("p1", [])).createdRoomId).toBeNull();
  });

  it("resets the baseline across project switches", () => {
    expect(observeFirstRoomTransition(observation("p1", []), observation("p2", ["room-2"]))).toEqual({
      next: observation("p2", ["room-2"]),
      createdRoomId: null,
    });
  });
});

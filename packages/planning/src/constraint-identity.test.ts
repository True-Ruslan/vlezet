import { describe, expect, it } from "vitest";
import type { PlanningCandidate } from "./contracts";
import { stableCandidateKey } from "./evaluation";

const base: Omit<PlanningCandidate, "constraints"> = {
  id: "candidate:test",
  roomId: "room-1",
  placements: [
    { objectId: "sofa", position: { x: 1000, y: 1200 }, rotationDeg: 0 },
    { objectId: "table", position: { x: 2500, y: 1800 }, rotationDeg: 90 },
  ],
};

describe("constraint-aware candidate identity", () => {
  it("is invariant to constraint input order but changes when intent changes", () => {
    const first: PlanningCandidate = {
      ...base,
      constraints: [
        { kind: "prefer-room-boundary", objectId: "sofa", target: "wall" },
        { kind: "pair-distance", objectIds: ["table", "sofa"], preference: "near" },
      ],
    };
    const reordered: PlanningCandidate = {
      ...base,
      constraints: [...first.constraints!].reverse(),
    };
    const changedIntent: PlanningCandidate = {
      ...base,
      constraints: [
        { kind: "prefer-room-boundary", objectId: "sofa", target: "corner" },
        { kind: "pair-distance", objectIds: ["sofa", "table"], preference: "near" },
      ],
    };

    expect(stableCandidateKey(reordered)).toBe(stableCandidateKey(first));
    expect(stableCandidateKey(changedIntent)).not.toBe(stableCandidateKey(first));
  });

  it("normalizes unordered exact pairs but changes identity when minimumMm changes", () => {
    const first: PlanningCandidate = {
      ...base,
      constraints: [{ kind: "pair-min-gap", objectIds: ["table", "sofa"], minimumMm: 800 }],
    };
    const reorderedPair: PlanningCandidate = {
      ...base,
      constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 800 }],
    };
    const changedMinimum: PlanningCandidate = {
      ...base,
      constraints: [{ kind: "pair-min-gap", objectIds: ["sofa", "table"], minimumMm: 801 }],
    };

    expect(stableCandidateKey(reorderedPair)).toBe(stableCandidateKey(first));
    expect(stableCandidateKey(changedMinimum)).not.toBe(stableCandidateKey(first));
  });
});

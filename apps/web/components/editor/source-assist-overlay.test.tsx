import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";
import { describe, expect, it } from "vitest";
import { deriveSourceAssistOverlayModel } from "./source-assist-overlay";

const viewport = { pixelsPerMillimeter: 0.1, offsetX: 20, offsetY: 30 } as const;

function acquired(kind: ReferenceSourceAssistResult["kind"] = "line-center"): ReferenceSourceAssistResult {
  return {
    acquired: true,
    candidateId: "source-line-1",
    kind,
    sourcePoint: { x: 120, y: 240 },
    worldPoint: { x: 1000, y: 1500 },
    reason: "acquired",
  };
}

describe("M8.4 source assist overlay", () => {
  it("projects explicit ephemeral feedback for the source candidate that owns the preview", () => {
    expect(deriveSourceAssistOverlayModel(acquired(), viewport)).toEqual({
      label: "По подложке",
      marker: { x: 120, y: 180 },
      kind: "line-center",
    });
  });

  it.each([
    ["ambiguous", { acquired: false, candidateId: null, kind: "none", reason: "ambiguous" }],
    ["none", { acquired: false, candidateId: null, kind: "none", reason: "none" }],
    ["disabled", { acquired: false, candidateId: null, kind: "none", reason: "disabled" }],
    ["suppressed", { acquired: false, candidateId: null, kind: "none", reason: "suppressed" }],
  ] as const)("renders no source evidence for %s", (_name, state) => {
    const assist: ReferenceSourceAssistResult = {
      ...state,
      sourcePoint: { x: 120, y: 240 },
      worldPoint: { x: 1000, y: 1500 },
    };
    expect(deriveSourceAssistOverlayModel(assist, viewport)).toBeNull();
  });

  it("fails closed when acquired evidence has no candidate identity", () => {
    expect(deriveSourceAssistOverlayModel({
      ...acquired("edge"),
      candidateId: null,
    }, viewport)).toBeNull();
  });
});

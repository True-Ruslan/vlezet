import { Children, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import type { ReferenceSourceAssistResult } from "../reference/reference-source-assist";
import {
  SourceAssistOverlay,
  deriveSourceAssistOverlayModel,
} from "./source-assist-overlay";

const viewport = { pixelsPerMillimeter: 0.2, offsetX: 40, offsetY: -20 } as const;

function assist(
  patch: Partial<ReferenceSourceAssistResult> = {},
): ReferenceSourceAssistResult {
  return {
    acquired: true,
    candidateId: "line-center:h:250.000",
    kind: "line-center",
    sourcePoint: { x: 250, y: 120 },
    worldPoint: { x: 1000, y: 600 },
    reason: "acquired",
    ...patch,
  };
}

describe("M8.4 visible source-assist marker", () => {
  it("projects the authoritative acquired world point into a local cursor marker", () => {
    expect(deriveSourceAssistOverlayModel(assist(), viewport)).toEqual({
      marker: { x: 240, y: 100 },
      label: "По подложке",
      kind: "line-center",
    });
  });

  it("uses explicit corner vocabulary for an acquired source intersection", () => {
    expect(deriveSourceAssistOverlayModel(assist({
      candidateId: "intersection:250.000:120.000",
      kind: "intersection",
    }), viewport)?.label).toBe("По подложке · угол");
  });

  it.each([
    assist({ acquired: false, candidateId: null, kind: "none", reason: "none" }),
    null,
  ])("renders no marker model without acquired source authority", (value) => {
    expect(deriveSourceAssistOverlayModel(value, viewport)).toBeNull();
  });

  it("renders no canvas overlay without acquired source evidence", () => {
    expect(SourceAssistOverlay({ assist: null, viewport })).toBeNull();
  });

  it("renders the marker as a non-interactive canvas overlay", () => {
    const tree = SourceAssistOverlay({ assist: assist(), viewport }) as ReactElement<{
      listening: boolean;
      name: string;
    }>;
    expect(tree.props.listening).toBe(false);
    expect(tree.props.name).toBe("source-assist-overlay");
  });

  it("renders an intersection crosshair around the acquired source point", () => {
    const tree = SourceAssistOverlay({
      assist: assist({
        candidateId: "intersection:250.000:120.000",
        kind: "intersection",
      }),
      viewport,
    }) as ReactElement<{ children: ReactNode }>;
    const markerChildren = Children.toArray(tree.props.children);
    const crosshair = markerChildren[2] as ReactElement<{ children: ReactNode }>;
    const crosshairLines = Children.toArray(crosshair.props.children) as Array<ReactElement<{ points: number[] }>>;

    expect(crosshairLines.map((line) => line.props.points)).toEqual([
      [234, 100, 246, 100],
      [240, 94, 240, 106],
    ]);
  });
});

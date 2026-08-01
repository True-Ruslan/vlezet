import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DoorSwingSelector } from "./door-swing-selector";
import { GeometrySpanCue } from "./geometry-span-cue";
import {
  deriveDoorSwingChoices,
  deriveWallVisualModel,
  physicalFaceChoices,
} from "./geometry-inspector-presentation";
import { OpeningPositionCue } from "./opening-position-cue";
import { WallAxisCue } from "./wall-axis-cue";
import { WallThicknessCue } from "./wall-thickness-cue";

describe("geometry inspector visual controls", () => {
  const wallModel = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });

  it("renders horizontal and vertical room spans as presentation-only cues", () => {
    const horizontal = renderToStaticMarkup(<GeometrySpanCue axis="horizontal" activeAnchor="min" />);
    const vertical = renderToStaticMarkup(<GeometrySpanCue axis="vertical" activeAnchor="center" />);

    expect(horizontal).toContain('class="geometry-cue geometry-span-cue"');
    expect(horizontal).toContain('data-axis="horizontal"');
    expect(horizontal).toContain('data-anchor="min"');
    expect(vertical).toContain('data-axis="vertical"');
    expect(vertical).toContain('data-anchor="center"');
    expect(horizontal).not.toContain("<input");
  });

  it("renders wall axis, thickness and opening position from supplied models", () => {
    const axis = renderToStaticMarkup(<WallAxisCue model={wallModel} fixedRole="visual-start" />);
    const faces = physicalFaceChoices(wallModel);
    const thickness = renderToStaticMarkup(
      <WallThicknessCue choices={faces} selectedId="axis" interiorChoice={false} />,
    );
    const opening = renderToStaticMarkup(
      <OpeningPositionCue
        model={wallModel}
        reference="visual-end"
        offsetRatio={0.2}
        widthRatio={0.25}
      />,
    );

    expect(axis).toContain("Левый конец");
    expect(axis).toContain("Правый конец");
    expect(axis).toContain('data-fixed-role="visual-start"');
    expect(thickness).toContain("Верхняя поверхность");
    expect(thickness).toContain("Ось стены");
    expect(thickness).toContain('data-selected-face="axis"');
    expect(opening).toContain("От правого конца");
    expect(opening).toContain('data-reference="visual-end"');
  });

  it("renders the door selector as four labelled radio choices", () => {
    const choices = deriveDoorSwingChoices(wallModel);
    const html = renderToStaticMarkup(
      <DoorSwingSelector choices={choices} value={choices[0].value} onChange={vi.fn()} />,
    );

    expect(html).toContain('role="radiogroup"');
    expect(html.match(/role="radio"/g)).toHaveLength(4);
    expect(html).toContain('aria-checked="true"');
    expect(html).toContain("Петли слева, открывание вниз");
    expect(html).toContain("Петли справа, открывание вверх");
    expect(html).not.toMatch(/>start<|>end<|>left<|>right</);
  });
});

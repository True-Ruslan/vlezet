import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { WallDynamicInput } from "./wall-dynamic-input";

const noop = () => {};

describe("M8.2 wall dynamic input surface", () => {
  it("renders length before angle with explicit physical units and discoverable labels", () => {
    const html = renderToStaticMarkup(
      <WallDynamicInput
        position={{ x: 320, y: 180 }}
        lengthValue="4000"
        angleValue="90"
        lengthError={null}
        angleError={null}
        onLengthChange={noop}
        onAngleChange={noop}
        onCommit={noop}
        onCancelNumericEditing={noop}
      />,
    );

    expect(html).toContain('class="wall-dynamic-input"');
    expect(html.indexOf("Длина")).toBeLessThan(html.indexOf("Угол"));
    expect(html).toContain("мм");
    expect(html).toContain("°");
    expect(html).toContain('inputMode="decimal"');
    expect(html).toContain('aria-label="Длина стены, мм"');
    expect(html).toContain('aria-label="Угол стены, градусы"');
    expect(html).toContain('style="left:320px;top:180px"');
  });

  it("associates invalid numeric input with concise local error text", () => {
    const html = renderToStaticMarkup(
      <WallDynamicInput
        position={{ x: 100, y: 120 }}
        lengthValue="0"
        angleValue="abc"
        lengthError="Длина стены должна быть больше 0 мм"
        angleError="Введите угол числом"
        onLengthChange={noop}
        onAngleChange={noop}
        onCommit={noop}
        onCancelNumericEditing={noop}
      />,
    );

    expect(html).toContain('aria-invalid="true"');
    expect(html).toContain('aria-describedby="wall-dynamic-length-error"');
    expect(html).toContain('aria-describedby="wall-dynamic-angle-error"');
    expect(html).toContain('id="wall-dynamic-length-error"');
    expect(html).toContain('id="wall-dynamic-angle-error"');
    expect(html).toContain("Длина стены должна быть больше 0 мм");
    expect(html).toContain("Введите угол числом");
  });

  it("does not invent error associations when both values are valid", () => {
    const html = renderToStaticMarkup(
      <WallDynamicInput
        position={{ x: 100, y: 120 }}
        lengthValue="2500"
        angleValue="0"
        lengthError={null}
        angleError={null}
        onLengthChange={noop}
        onAngleChange={noop}
        onCommit={noop}
        onCancelNumericEditing={noop}
      />,
    );

    expect(html).not.toContain('aria-invalid="true"');
    expect(html).not.toContain("wall-dynamic-length-error");
    expect(html).not.toContain("wall-dynamic-angle-error");
  });
});

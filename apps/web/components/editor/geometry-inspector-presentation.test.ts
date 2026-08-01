import { describe, expect, it } from "vitest";
import {
  deriveWallVisualModel,
  physicalFaceChoices,
  wallLengthAnchorForVisualRole,
} from "./geometry-inspector-presentation";

describe("geometry inspector wall presentation", () => {
  it("keeps left and right labels stable when horizontal internal endpoints reverse", () => {
    const forward = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });
    const reverse = deriveWallVisualModel({ x: 4000, y: 0 }, { x: 0, y: 0 });

    expect(forward.axis).toBe("horizontal");
    expect(reverse.axis).toBe("horizontal");
    expect(forward.visualStartLabel).toBe("Левый конец");
    expect(forward.visualEndLabel).toBe("Правый конец");
    expect(reverse.visualStartLabel).toBe("Левый конец");
    expect(reverse.visualEndLabel).toBe("Правый конец");
    expect(wallLengthAnchorForVisualRole(forward, "visual-start")).toBe("start");
    expect(wallLengthAnchorForVisualRole(reverse, "visual-start")).toBe("end");
    expect(wallLengthAnchorForVisualRole(reverse, "visual-end")).toBe("start");
    expect(wallLengthAnchorForVisualRole(reverse, "center")).toBe("center");
  });

  it("keeps top and bottom labels stable when vertical internal endpoints reverse", () => {
    const forward = deriveWallVisualModel({ x: 10, y: 0 }, { x: 10, y: 3000 });
    const reverse = deriveWallVisualModel({ x: 10, y: 3000 }, { x: 10, y: 0 });

    expect(forward.axis).toBe("vertical");
    expect(reverse.axis).toBe("vertical");
    expect(forward.visualStartLabel).toBe("Верхний конец");
    expect(forward.visualEndLabel).toBe("Нижний конец");
    expect(reverse.visualStartLabel).toBe("Верхний конец");
    expect(reverse.visualEndLabel).toBe("Нижний конец");
    expect(wallLengthAnchorForVisualRole(reverse, "visual-start")).toBe("end");
  });

  it("uses explicit diagonal endpoint names and stable visual ordering", () => {
    const forward = deriveWallVisualModel({ x: 0, y: 0 }, { x: 3000, y: 2000 });
    const reverse = deriveWallVisualModel({ x: 3000, y: 2000 }, { x: 0, y: 0 });

    expect(forward.axis).toBe("diagonal");
    expect(forward.visualStartLabel).toBe("Верхний левый конец");
    expect(forward.visualEndLabel).toBe("Нижний правый конец");
    expect(reverse.visualStartLabel).toBe("Верхний левый конец");
    expect(reverse.visualEndLabel).toBe("Нижний правый конец");
    expect(reverse.internalStartIsVisualStart).toBe(false);
  });

  it("keeps physical face labels stable while canonical alignment follows wall direction", () => {
    const horizontalForward = physicalFaceChoices(deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 }));
    const horizontalReverse = physicalFaceChoices(deriveWallVisualModel({ x: 4000, y: 0 }, { x: 0, y: 0 }));
    const verticalForward = physicalFaceChoices(deriveWallVisualModel({ x: 0, y: 0 }, { x: 0, y: 4000 }));
    const verticalReverse = physicalFaceChoices(deriveWallVisualModel({ x: 0, y: 4000 }, { x: 0, y: 0 }));

    expect(horizontalForward.map((choice) => choice.label)).toEqual([
      "Верхняя поверхность",
      "Ось стены",
      "Нижняя поверхность",
    ]);
    expect(horizontalReverse.map((choice) => choice.label)).toEqual([
      "Верхняя поверхность",
      "Ось стены",
      "Нижняя поверхность",
    ]);
    expect(horizontalForward.map((choice) => choice.alignment)).toEqual(["right-face", "center", "left-face"]);
    expect(horizontalReverse.map((choice) => choice.alignment)).toEqual(["left-face", "center", "right-face"]);

    expect(verticalForward.map((choice) => choice.label)).toEqual([
      "Левая поверхность",
      "Ось стены",
      "Правая поверхность",
    ]);
    expect(verticalReverse.map((choice) => choice.label)).toEqual([
      "Левая поверхность",
      "Ось стены",
      "Правая поверхность",
    ]);
    expect(verticalForward.map((choice) => choice.alignment)).toEqual(["left-face", "center", "right-face"]);
    expect(verticalReverse.map((choice) => choice.alignment)).toEqual(["right-face", "center", "left-face"]);
  });

  it("rejects a zero-length wall", () => {
    expect(() => deriveWallVisualModel({ x: 10, y: 20 }, { x: 10, y: 20 })).toThrow(
      "Стена должна иметь ненулевую длину.",
    );
  });
});

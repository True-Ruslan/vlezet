import { describe, expect, it } from "vitest";
import {
  canonicalOpeningOffsetMm,
  deriveDoorSwingChoices,
  deriveOpeningCueDraft,
  deriveWallVisualModel,
  displayedOpeningOffsetMm,
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

describe("geometry inspector opening presentation", () => {
  it("converts an opening from either visible end on a reverse-directed wall", () => {
    const model = deriveWallVisualModel({ x: 4000, y: 0 }, { x: 0, y: 0 });

    expect(displayedOpeningOffsetMm({
      model,
      wallLengthMm: 4000,
      openingWidthMm: 900,
      canonicalOffsetMm: 600,
      reference: "visual-start",
    })).toBe(2500);
    expect(displayedOpeningOffsetMm({
      model,
      wallLengthMm: 4000,
      openingWidthMm: 900,
      canonicalOffsetMm: 600,
      reference: "visual-end",
    })).toBe(600);
    expect(canonicalOpeningOffsetMm({
      model,
      wallLengthMm: 4000,
      openingWidthMm: 900,
      displayedOffsetMm: 2500,
      reference: "visual-start",
    })).toBe(600);
  });

  it("round-trips both references without moving the opening", () => {
    const model = deriveWallVisualModel({ x: 0, y: 0 }, { x: 0, y: 5000 });
    for (const reference of ["visual-start", "visual-end"] as const) {
      const displayed = displayedOpeningOffsetMm({
        model,
        wallLengthMm: 5000,
        openingWidthMm: 1200,
        canonicalOffsetMm: 750,
        reference,
      });
      expect(canonicalOpeningOffsetMm({
        model,
        wallLengthMm: 5000,
        openingWidthMm: 1200,
        displayedOffsetMm: displayed,
        reference,
      })).toBe(750);
    }
  });

  it("fails closed for non-finite or outside-wall offsets", () => {
    const model = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });
    expect(() => displayedOpeningOffsetMm({
      model,
      wallLengthMm: 4000,
      openingWidthMm: 900,
      canonicalOffsetMm: Number.NaN,
      reference: "visual-start",
    })).toThrow("Положение проёма должно быть конечным и находиться в пределах стены.");
    expect(() => canonicalOpeningOffsetMm({
      model,
      wallLengthMm: 4000,
      openingWidthMm: 900,
      displayedOffsetMm: 3200,
      reference: "visual-start",
    })).toThrow("Положение проёма должно быть конечным и находиться в пределах стены.");
  });

  it("keeps the cue on authoritative geometry for invalid draft width or offset", () => {
    const model = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });
    const authoritative = {
      model,
      wallLengthMm: 4000,
      authoritativeWidthMm: 900,
      authoritativeOffsetMm: 600,
      reference: "visual-start" as const,
    };

    expect(deriveOpeningCueDraft({
      ...authoritative,
      draftWidthMm: 5000,
      displayedOffsetMm: 600,
    })).toEqual({ visualOffsetMm: 600, widthMm: 900, usingAuthoritativeFallback: true });
    expect(deriveOpeningCueDraft({
      ...authoritative,
      draftWidthMm: Number.NaN,
      displayedOffsetMm: 600,
    })).toEqual({ visualOffsetMm: 600, widthMm: 900, usingAuthoritativeFallback: true });
    expect(deriveOpeningCueDraft({
      ...authoritative,
      draftWidthMm: 900,
      displayedOffsetMm: 3500,
    })).toEqual({ visualOffsetMm: 600, widthMm: 900, usingAuthoritativeFallback: true });
  });

  it("uses valid draft geometry for the cue without applying it", () => {
    const model = deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 });
    expect(deriveOpeningCueDraft({
      model,
      wallLengthMm: 4000,
      authoritativeWidthMm: 900,
      authoritativeOffsetMm: 600,
      draftWidthMm: 1000,
      displayedOffsetMm: 750,
      reference: "visual-start",
    })).toEqual({ visualOffsetMm: 750, widthMm: 1000, usingAuthoritativeFallback: false });
  });

  it("describes four distinct visible door swings without internal enum copy", () => {
    const choices = deriveDoorSwingChoices(deriveWallVisualModel({ x: 0, y: 0 }, { x: 4000, y: 0 }));

    expect(choices).toHaveLength(4);
    expect(new Set(choices.map((choice) => choice.accessibleLabel)).size).toBe(4);
    expect(choices.map((choice) => choice.accessibleLabel)).toEqual([
      "Петли слева, открывание вниз",
      "Петли слева, открывание вверх",
      "Петли справа, открывание вниз",
      "Петли справа, открывание вверх",
    ]);
    expect(choices.map((choice) => choice.accessibleLabel).join(" ")).not.toMatch(/start|end|left|right/);
  });

  it("keeps visible door descriptions stable when wall direction reverses", () => {
    const forward = deriveDoorSwingChoices(deriveWallVisualModel({ x: 0, y: 0 }, { x: 0, y: 4000 }));
    const reverse = deriveDoorSwingChoices(deriveWallVisualModel({ x: 0, y: 4000 }, { x: 0, y: 0 }));

    expect(forward.map((choice) => choice.accessibleLabel).sort()).toEqual(
      reverse.map((choice) => choice.accessibleLabel).sort(),
    );
    expect(new Set(forward.map((choice) => choice.accessibleLabel))).toEqual(new Set([
      "Петли сверху, открывание влево",
      "Петли сверху, открывание вправо",
      "Петли снизу, открывание влево",
      "Петли снизу, открывание вправо",
    ]));
  });
});

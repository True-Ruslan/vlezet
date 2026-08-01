import type { WallLengthAnchor, WallThicknessAlignment } from "@vlezet/editor-core";
import type { Point2 } from "@vlezet/geometry";

const EPSILON = 1e-6;

export type WallVisualAxis = "horizontal" | "vertical" | "diagonal";
export type VisualEndpointRole = "visual-start" | "center" | "visual-end";

export type WallVisualModel = Readonly<{
  axis: WallVisualAxis;
  internalStartIsVisualStart: boolean;
  visualStartLabel: string;
  visualEndLabel: string;
  visualStartShort: string;
  visualEndShort: string;
  tangent: Point2;
  leftNormal: Point2;
}>;

export type PhysicalFaceChoice = Readonly<{
  id: "first-face" | "axis" | "second-face";
  label: string;
  alignment: WallThicknessAlignment;
}>;

type EndpointCopy = Readonly<{
  startLabel: string;
  endLabel: string;
  startShort: string;
  endShort: string;
}>;

type CanonicalFace = Readonly<{
  vector: Point2;
  alignment: Exclude<WallThicknessAlignment, "center">;
}>;

function assertFinitePoint(point: Point2): void {
  if (!Number.isFinite(point.x) || !Number.isFinite(point.y)) {
    throw new Error("Стена должна иметь ненулевую длину.");
  }
}

function visualPointComesFirst(first: Point2, second: Point2, axis: WallVisualAxis): boolean {
  if (axis === "horizontal") return first.x < second.x;
  if (axis === "vertical") return first.y < second.y;
  if (Math.abs(first.y - second.y) > EPSILON) return first.y < second.y;
  return first.x < second.x;
}

function diagonalEndpointCopy(visualStart: Point2, visualEnd: Point2): EndpointCopy {
  const startHorizontal = visualStart.x < visualEnd.x ? "левый" : "правый";
  const endHorizontal = startHorizontal === "левый" ? "правый" : "левый";
  return {
    startLabel: `Верхний ${startHorizontal} конец`,
    endLabel: `Нижний ${endHorizontal} конец`,
    startShort: `сверху ${startHorizontal === "левый" ? "слева" : "справа"}`,
    endShort: `снизу ${endHorizontal === "левый" ? "слева" : "справа"}`,
  };
}

function endpointCopy(axis: WallVisualAxis, visualStart: Point2, visualEnd: Point2): EndpointCopy {
  if (axis === "horizontal") {
    return {
      startLabel: "Левый конец",
      endLabel: "Правый конец",
      startShort: "слева",
      endShort: "справа",
    };
  }
  if (axis === "vertical") {
    return {
      startLabel: "Верхний конец",
      endLabel: "Нижний конец",
      startShort: "сверху",
      endShort: "снизу",
    };
  }
  return diagonalEndpointCopy(visualStart, visualEnd);
}

function vectorComesFirst(first: Point2, second: Point2): boolean {
  if (Math.abs(first.y - second.y) > EPSILON) return first.y < second.y;
  return first.x < second.x;
}

function faceLabel(vector: Point2): string {
  const horizontal = vector.x < -EPSILON
    ? "левая"
    : vector.x > EPSILON
      ? "правая"
      : null;
  const vertical = vector.y < -EPSILON
    ? "верхняя"
    : vector.y > EPSILON
      ? "нижняя"
      : null;

  if (horizontal && vertical) {
    return `${vertical[0].toUpperCase()}${vertical.slice(1)} ${horizontal} поверхность`;
  }
  if (vertical) return `${vertical[0].toUpperCase()}${vertical.slice(1)} поверхность`;
  if (horizontal) return `${horizontal[0].toUpperCase()}${horizontal.slice(1)} поверхность`;
  throw new Error("Невозможно определить физическую поверхность стены.");
}

export function deriveWallVisualModel(start: Point2, end: Point2): WallVisualModel {
  assertFinitePoint(start);
  assertFinitePoint(end);

  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const length = Math.hypot(dx, dy);
  if (!Number.isFinite(length) || length <= EPSILON) {
    throw new Error("Стена должна иметь ненулевую длину.");
  }

  const axis: WallVisualAxis = Math.abs(dy) <= EPSILON
    ? "horizontal"
    : Math.abs(dx) <= EPSILON
      ? "vertical"
      : "diagonal";
  const internalStartIsVisualStart = visualPointComesFirst(start, end, axis);
  const visualStart = internalStartIsVisualStart ? start : end;
  const visualEnd = internalStartIsVisualStart ? end : start;
  const copy = endpointCopy(axis, visualStart, visualEnd);
  const tangent = { x: dx / length, y: dy / length };

  return {
    axis,
    internalStartIsVisualStart,
    visualStartLabel: copy.startLabel,
    visualEndLabel: copy.endLabel,
    visualStartShort: copy.startShort,
    visualEndShort: copy.endShort,
    tangent,
    leftNormal: { x: -tangent.y, y: tangent.x },
  };
}

export function wallLengthAnchorForVisualRole(
  model: WallVisualModel,
  role: VisualEndpointRole,
): WallLengthAnchor {
  if (role === "center") return "center";
  if (role === "visual-start") return model.internalStartIsVisualStart ? "start" : "end";
  return model.internalStartIsVisualStart ? "end" : "start";
}

export function physicalFaceChoices(model: WallVisualModel): readonly PhysicalFaceChoice[] {
  const leftFace: CanonicalFace = {
    vector: model.leftNormal,
    alignment: "left-face",
  };
  const rightFace: CanonicalFace = {
    vector: { x: -model.leftNormal.x, y: -model.leftNormal.y },
    alignment: "right-face",
  };
  const first = vectorComesFirst(leftFace.vector, rightFace.vector) ? leftFace : rightFace;
  const second = first === leftFace ? rightFace : leftFace;

  return [
    {
      id: "first-face",
      label: faceLabel(first.vector),
      alignment: first.alignment,
    },
    {
      id: "axis",
      label: "Ось стены",
      alignment: "center",
    },
    {
      id: "second-face",
      label: faceLabel(second.vector),
      alignment: second.alignment,
    },
  ];
}

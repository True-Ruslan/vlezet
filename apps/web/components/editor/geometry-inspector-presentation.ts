import type { WallLengthAnchor, WallThicknessAlignment } from "@vlezet/editor-core";
import type { Point2 } from "@vlezet/geometry";

const EPSILON = 1e-6;
const OPENING_POSITION_ERROR = "Положение проёма должно быть конечным и находиться в пределах стены.";

export type WallVisualAxis = "horizontal" | "vertical" | "diagonal";
export type VisualEndpointRole = "visual-start" | "center" | "visual-end";
export type OpeningOffsetReference = "visual-start" | "visual-end";
export type DoorSwingValue = Readonly<{ hinge: "start" | "end"; side: "left" | "right" }>;

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

export type DoorSwingChoice = Readonly<{
  id: "start-left" | "start-right" | "end-left" | "end-right";
  value: DoorSwingValue;
  hingeLabel: string;
  directionLabel: string;
  accessibleLabel: string;
  openDirection: Point2;
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

type OpeningOffsetInput = Readonly<{
  model: WallVisualModel;
  wallLengthMm: number;
  openingWidthMm: number;
  reference: OpeningOffsetReference;
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

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
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

  if (horizontal && vertical) return `${capitalize(vertical)} ${horizontal} поверхность`;
  if (vertical) return `${capitalize(vertical)} поверхность`;
  if (horizontal) return `${capitalize(horizontal)} поверхность`;
  throw new Error("Невозможно определить физическую поверхность стены.");
}

function assertOpeningDimensions(wallLengthMm: number, openingWidthMm: number): number {
  if (
    !Number.isFinite(wallLengthMm) ||
    !Number.isFinite(openingWidthMm) ||
    wallLengthMm <= 0 ||
    openingWidthMm < 0 ||
    openingWidthMm > wallLengthMm + EPSILON
  ) {
    throw new Error(OPENING_POSITION_ERROR);
  }
  return Math.max(0, wallLengthMm - openingWidthMm);
}

function normalizeOpeningOffset(value: number, maximum: number): number {
  if (!Number.isFinite(value) || value < -EPSILON || value > maximum + EPSILON) {
    throw new Error(OPENING_POSITION_ERROR);
  }
  if (Math.abs(value) <= EPSILON) return 0;
  if (Math.abs(value - maximum) <= EPSILON) return maximum;
  return value;
}

function referenceUsesInternalStart(model: WallVisualModel, reference: OpeningOffsetReference): boolean {
  return reference === "visual-start"
    ? model.internalStartIsVisualStart
    : !model.internalStartIsVisualStart;
}

function openDirectionLabel(direction: Point2): string {
  if (Math.abs(direction.x) > Math.abs(direction.y)) return direction.x < 0 ? "влево" : "вправо";
  return direction.y < 0 ? "вверх" : "вниз";
}

function hingeLocation(model: WallVisualModel, hinge: DoorSwingValue["hinge"]): string {
  const hingeIsVisualStart = hinge === "start"
    ? model.internalStartIsVisualStart
    : !model.internalStartIsVisualStart;
  return hingeIsVisualStart ? model.visualStartShort : model.visualEndShort;
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

export function displayedOpeningOffsetMm(
  input: OpeningOffsetInput & Readonly<{ canonicalOffsetMm: number }>,
): number {
  const maximum = assertOpeningDimensions(input.wallLengthMm, input.openingWidthMm);
  const canonical = normalizeOpeningOffset(input.canonicalOffsetMm, maximum);
  return referenceUsesInternalStart(input.model, input.reference)
    ? canonical
    : normalizeOpeningOffset(input.wallLengthMm - canonical - input.openingWidthMm, maximum);
}

export function canonicalOpeningOffsetMm(
  input: OpeningOffsetInput & Readonly<{ displayedOffsetMm: number }>,
): number {
  const maximum = assertOpeningDimensions(input.wallLengthMm, input.openingWidthMm);
  const displayed = normalizeOpeningOffset(input.displayedOffsetMm, maximum);
  return referenceUsesInternalStart(input.model, input.reference)
    ? displayed
    : normalizeOpeningOffset(input.wallLengthMm - displayed - input.openingWidthMm, maximum);
}

export function deriveDoorSwingChoices(model: WallVisualModel): readonly DoorSwingChoice[] {
  const values: readonly DoorSwingValue[] = [
    { hinge: "start", side: "left" },
    { hinge: "start", side: "right" },
    { hinge: "end", side: "left" },
    { hinge: "end", side: "right" },
  ];

  return values.map((value) => {
    const sign = value.side === "right" ? -1 : 1;
    const openDirection = {
      x: model.leftNormal.x * sign,
      y: model.leftNormal.y * sign,
    };
    const hingeLabel = `Петли ${hingeLocation(model, value.hinge)}`;
    const directionLabel = `Открывание ${openDirectionLabel(openDirection)}`;
    return {
      id: `${value.hinge}-${value.side}` as DoorSwingChoice["id"],
      value,
      hingeLabel,
      directionLabel,
      accessibleLabel: `${hingeLabel}, ${directionLabel.toLowerCase()}`,
      openDirection,
    };
  });
}

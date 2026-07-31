import type { OpeningKind, VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";

export type ContextKind =
  | "empty"
  | "wall"
  | "room"
  | "opening-door"
  | "opening-window"
  | "object"
  | "reference"
  | "recognition"
  | "planning";

export type ContextDescriptor = Readonly<{
  kind: ContextKind;
  category: "selection" | "workflow" | "empty";
  eyebrow: string;
  title: string;
  subtitle?: string;
  phase?: string;
  returnLabel?: string;
}>;

export type OrdinaryContextSnapshot =
  | Readonly<{ kind: "empty"; label: string }>
  | Readonly<{ kind: "wall"; wallId: string; label: string }>
  | Readonly<{ kind: "room"; roomId: string; label: string }>
  | Readonly<{ kind: "opening-door" | "opening-window"; openingId: string; label: string }>
  | Readonly<{ kind: "object"; objectId: string; label: string }>;

export type WorkflowReturnTarget = OrdinaryContextSnapshot;

const EMPTY_RETURN_TARGET: WorkflowReturnTarget = Object.freeze({
  kind: "empty",
  label: "Ничего не выбрано",
});

export function describeEmptyContext(): ContextDescriptor {
  return {
    kind: "empty",
    category: "empty",
    eyebrow: "Свойства",
    title: "Ничего не выбрано",
  };
}

export function describeWallContext(input: Readonly<{ lengthMm: number; thicknessMm: number }>): ContextDescriptor {
  return {
    kind: "wall",
    category: "selection",
    eyebrow: "Стена",
    title: "Стена",
    subtitle: `${Math.round(input.lengthMm)} мм по оси · толщина ${Math.round(input.thicknessMm)} мм`,
  };
}

export function describeRoomContext(input: Readonly<{
  name: string;
  areaLabel: string;
  clearSizeLabel?: string;
}>): ContextDescriptor {
  return {
    kind: "room",
    category: "selection",
    eyebrow: "Комната",
    title: input.name,
    subtitle: input.clearSizeLabel ? `${input.areaLabel} · ${input.clearSizeLabel}` : input.areaLabel,
  };
}

export function describeOpeningContext(input: Readonly<{ kind: OpeningKind; widthMm: number }>): ContextDescriptor {
  const label = input.kind === "door" ? "Дверь" : "Окно";
  return {
    kind: input.kind === "door" ? "opening-door" : "opening-window",
    category: "selection",
    eyebrow: label,
    title: label,
    subtitle: `Ширина ${Math.round(input.widthMm)} мм`,
  };
}

export function describeObjectContext(input: Readonly<{ name: string; statusLabel: string }>): ContextDescriptor {
  return {
    kind: "object",
    category: "selection",
    eyebrow: "Предмет",
    title: input.name,
    subtitle: input.statusLabel,
  };
}

export function describeReferenceContext(input: Readonly<{ phase: string; returnLabel?: string }>): ContextDescriptor {
  return {
    kind: "reference",
    category: "workflow",
    eyebrow: "Подложка",
    title: input.phase,
    ...(input.returnLabel ? { returnLabel: input.returnLabel } : {}),
  };
}

export function describeRecognitionContext(input: Readonly<{ phase: string; returnLabel?: string }>): ContextDescriptor {
  return {
    kind: "recognition",
    category: "workflow",
    eyebrow: "Распознавание",
    title: input.phase,
    ...(input.returnLabel ? { returnLabel: input.returnLabel } : {}),
  };
}

export function describePlanningContext(input: Readonly<{
  roomName: string;
  phase: string;
  returnLabel?: string;
}>): ContextDescriptor {
  return {
    kind: "planning",
    category: "workflow",
    eyebrow: "Варианты расстановки",
    title: input.roomName,
    phase: input.phase,
    ...(input.returnLabel ? { returnLabel: input.returnLabel } : {}),
  };
}

export function validateWorkflowReturnTarget(
  target: WorkflowReturnTarget,
  document: VlezetDocument,
): WorkflowReturnTarget {
  switch (target.kind) {
    case "empty":
      return target;
    case "wall":
      return document.walls.some((wall) => wall.id === target.wallId) ? target : EMPTY_RETURN_TARGET;
    case "room":
      return deriveRooms(document).rooms.some((room) => room.id === target.roomId) ? target : EMPTY_RETURN_TARGET;
    case "opening-door":
    case "opening-window": {
      const expectedKind = target.kind === "opening-door" ? "door" : "window";
      return document.openings.some((opening) => opening.id === target.openingId && opening.kind === expectedKind)
        ? target
        : EMPTY_RETURN_TARGET;
    }
    case "object":
      return document.placedObjects.some((object) => object.id === target.objectId) ? target : EMPTY_RETURN_TARGET;
  }
}

export function captureWorkflowReturnTarget(
  snapshot: OrdinaryContextSnapshot,
  document: VlezetDocument,
): WorkflowReturnTarget {
  return validateWorkflowReturnTarget(snapshot, document);
}

export function preserveWorkflowReturnTarget(
  current: WorkflowReturnTarget | null,
  next: WorkflowReturnTarget,
): WorkflowReturnTarget {
  return current ?? next;
}

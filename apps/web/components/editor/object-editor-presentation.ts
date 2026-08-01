import type { PlacedObject } from "@vlezet/domain";
import type { PlacedObjectPatch } from "@vlezet/editor-core";
import type { FitDiagnostic, FitDiagnosticCode } from "@vlezet/geometry";

export type ObjectDraftField =
  | "name"
  | "width"
  | "depth"
  | "height"
  | "rotation"
  | "x"
  | "y"
  | "front"
  | "right"
  | "back"
  | "left";

export type ObjectEditorDraft = Readonly<Record<ObjectDraftField, string>>;
export type ObjectDraftErrors = Partial<Record<ObjectDraftField, string>>;

export function createObjectEditorDraft(object: PlacedObject): ObjectEditorDraft {
  return {
    name: object.name,
    width: String(object.width),
    depth: String(object.depth),
    height: object.height === undefined ? "" : String(object.height),
    rotation: String(object.rotationDeg),
    x: String(object.position.x),
    y: String(object.position.y),
    front: String(object.clearance.front),
    right: String(object.clearance.right),
    back: String(object.clearance.back),
    left: String(object.clearance.left),
  };
}

export function objectAuthorityFingerprint(object: PlacedObject): string {
  return JSON.stringify([
    object.id,
    object.name,
    object.position.x,
    object.position.y,
    object.width,
    object.depth,
    object.height ?? null,
    object.rotationDeg,
    object.clearance.front,
    object.clearance.right,
    object.clearance.back,
    object.clearance.left,
  ]);
}

function parseNumber(value: string): number | null {
  const normalized = value.trim();
  if (!normalized) return null;
  const parsed = Number(normalized.replace(",", "."));
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseObjectEditorDraft(
  draft: ObjectEditorDraft,
  authoritative: PlacedObject,
): Readonly<{ ok: true; patch: PlacedObjectPatch }> | Readonly<{ ok: false; errors: ObjectDraftErrors }> {
  const errors: ObjectDraftErrors = {};
  const name = draft.name.trim();
  if (!name) errors.name = "Введите название предмета";

  const width = parseNumber(draft.width);
  if (width === null) errors.width = "Введите число";
  else if (width <= 0) errors.width = "Введите ширину больше 0 мм";

  const depth = parseNumber(draft.depth);
  if (depth === null) errors.depth = "Введите число";
  else if (depth <= 0) errors.depth = "Введите глубину больше 0 мм";

  const heightText = draft.height.trim();
  const height = heightText ? parseNumber(heightText) : null;
  if (heightText && height === null) errors.height = "Введите число";
  else if (heightText && height !== null && height <= 0) errors.height = "Введите высоту больше 0 мм";

  const rotation = parseNumber(draft.rotation);
  if (rotation === null) errors.rotation = "Введите число";

  const x = parseNumber(draft.x);
  if (x === null) errors.x = "Введите число";
  const y = parseNumber(draft.y);
  if (y === null) errors.y = "Введите число";

  const clearanceValues = {} as Record<"front" | "right" | "back" | "left", number>;
  for (const field of ["front", "right", "back", "left"] as const) {
    const value = parseNumber(draft[field]);
    if (value === null) errors[field] = "Введите число";
    else if (value < 0) errors[field] = "Введите неотрицательный зазор";
    else clearanceValues[field] = value;
  }

  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const patch: PlacedObjectPatch = {
    name,
    width: width!,
    depth: depth!,
    rotationDeg: rotation!,
    position: { x: x!, y: y! },
    clearance: clearanceValues,
    ...(heightText && height !== null ? { height } : {}),
  };

  void authoritative;
  return { ok: true, patch };
}

export type FitDiagnosticGroupId = "containment" | "collision" | "opening" | "clearance";
export type FitDiagnosticGroup = Readonly<{
  id: FitDiagnosticGroupId;
  title: string;
  nextAction: string;
  diagnostics: readonly FitDiagnostic[];
}>;

const GROUP_PRESENTATION: Readonly<Record<FitDiagnosticGroupId, Readonly<{ title: string; nextAction: string }>>> = {
  containment: {
    title: "Границы комнаты",
    nextAction: "Переместите предмет внутрь комнаты или проверьте планировку.",
  },
  collision: {
    title: "Пересечение предметов",
    nextAction: "Переместите, поверните или измените размер предмета.",
  },
  opening: {
    title: "Двери и проёмы",
    nextAction: "Освободите траекторию открывания двери.",
  },
  clearance: {
    title: "Зоны использования",
    nextAction: "Проверьте рекомендуемый зазор или измените размещение.",
  },
};

function diagnosticGroupId(code: FitDiagnosticCode): FitDiagnosticGroupId {
  if (code === "plan-invalid" || code === "outside-room") return "containment";
  if (code === "object-collision") return "collision";
  if (code === "door-obstructed") return "opening";
  if (code === "clearance-wall" || code === "clearance-object" || code === "clearance-door") return "clearance";
  return "containment";
}

export function groupFitDiagnostics(diagnostics: readonly FitDiagnostic[]): readonly FitDiagnosticGroup[] {
  const grouped = new Map<FitDiagnosticGroupId, FitDiagnostic[]>();
  for (const diagnostic of diagnostics) {
    const id = diagnosticGroupId(diagnostic.code);
    const current = grouped.get(id) ?? [];
    current.push(diagnostic);
    grouped.set(id, current);
  }

  return (["containment", "collision", "opening", "clearance"] as const).flatMap((id) => {
    const items = grouped.get(id);
    if (!items?.length) return [];
    return [{ id, ...GROUP_PRESENTATION[id], diagnostics: items }];
  });
}

import type { ClearanceMargins, ObjectCategory } from "@vlezet/domain";

export type FurniturePreset = Readonly<{
  id: string;
  name: string;
  category: ObjectCategory;
  width: number;
  depth: number;
  height?: number;
  clearance: ClearanceMargins;
}>;

const NONE: ClearanceMargins = { front: 0, right: 0, back: 0, left: 0 };

export const FURNITURE_PRESETS: readonly FurniturePreset[] = [
  {
    id: "single-bed",
    name: "Односпальная кровать",
    category: "sleep",
    width: 900,
    depth: 2000,
    height: 450,
    clearance: { front: 600, right: 500, back: 0, left: 500 },
  },
  {
    id: "double-bed",
    name: "Двуспальная кровать",
    category: "sleep",
    width: 1600,
    depth: 2000,
    height: 450,
    clearance: { front: 700, right: 600, back: 0, left: 600 },
  },
  {
    id: "sofa",
    name: "Диван",
    category: "seating",
    width: 2200,
    depth: 900,
    height: 850,
    clearance: { front: 700, right: 0, back: 0, left: 0 },
  },
  {
    id: "wardrobe",
    name: "Шкаф",
    category: "storage",
    width: 1600,
    depth: 600,
    height: 2200,
    clearance: { front: 800, right: 0, back: 0, left: 0 },
  },
  {
    id: "dresser",
    name: "Комод",
    category: "storage",
    width: 1000,
    depth: 500,
    height: 900,
    clearance: { front: 700, right: 0, back: 0, left: 0 },
  },
  {
    id: "bedside-table",
    name: "Прикроватная тумба",
    category: "storage",
    width: 450,
    depth: 400,
    height: 550,
    clearance: NONE,
  },
  {
    id: "desk",
    name: "Рабочий стол",
    category: "table",
    width: 1400,
    depth: 700,
    height: 750,
    clearance: { front: 800, right: 0, back: 0, left: 0 },
  },
  {
    id: "dining-table",
    name: "Обеденный стол",
    category: "table",
    width: 1400,
    depth: 800,
    height: 750,
    clearance: { front: 700, right: 700, back: 700, left: 700 },
  },
  {
    id: "chair",
    name: "Стул",
    category: "chair",
    width: 500,
    depth: 500,
    height: 850,
    clearance: { front: 0, right: 0, back: 600, left: 0 },
  },
  {
    id: "kitchen-module",
    name: "Кухонный модуль",
    category: "kitchen",
    width: 600,
    depth: 600,
    height: 900,
    clearance: { front: 900, right: 0, back: 0, left: 0 },
  },
  {
    id: "fridge",
    name: "Холодильник",
    category: "appliance",
    width: 600,
    depth: 650,
    height: 2000,
    clearance: { front: 900, right: 0, back: 0, left: 0 },
  },
  {
    id: "washing-machine",
    name: "Стиральная машина",
    category: "appliance",
    width: 600,
    depth: 600,
    height: 850,
    clearance: { front: 700, right: 0, back: 0, left: 0 },
  },
  {
    id: "tv-stand",
    name: "ТВ-тумба",
    category: "storage",
    width: 1600,
    depth: 450,
    height: 550,
    clearance: { front: 600, right: 0, back: 0, left: 0 },
  },
  {
    id: "custom-object",
    name: "Свой предмет",
    category: "custom",
    width: 1000,
    depth: 600,
    clearance: NONE,
  },
] as const;

export function getFurniturePreset(presetId: string): FurniturePreset {
  const preset = FURNITURE_PRESETS.find((candidate) => candidate.id === presetId);
  if (!preset) throw new Error(`Furniture preset does not exist: ${presetId}`);
  return preset;
}

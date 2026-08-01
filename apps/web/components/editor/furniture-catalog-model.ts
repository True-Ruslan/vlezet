import type { FurniturePreset } from "./furniture-presets";

export type FurnitureCategoryFilter = "all" | FurniturePreset["category"];

export type FurnitureCatalogFilter = Readonly<{
  query: string;
  category: FurnitureCategoryFilter;
}>;

const SEPARATOR_PATTERN = /[\p{P}\p{S}]+/gu;

export function normalizeFurnitureSearch(value: string): string {
  return value
    .normalize("NFKC")
    .toLocaleLowerCase("ru-RU")
    .replaceAll("ё", "е")
    .replace(SEPARATOR_PATTERN, " ")
    .trim()
    .replace(/\s+/gu, " ");
}

export function furnitureSearchTokens(value: string): readonly string[] {
  const normalized = normalizeFurnitureSearch(value);
  return normalized ? normalized.split(" ") : [];
}

export function filterFurniturePresets(
  presets: readonly FurniturePreset[],
  filter: FurnitureCatalogFilter,
): readonly FurniturePreset[] {
  const tokens = furnitureSearchTokens(filter.query);

  return presets.filter((preset) => {
    if (filter.category !== "all" && preset.category !== filter.category) return false;
    const normalizedName = normalizeFurnitureSearch(preset.name);
    return tokens.every((token) => normalizedName.includes(token));
  });
}

export function furnitureCategoryCount(
  presets: readonly FurniturePreset[],
  query: string,
  category: FurnitureCategoryFilter,
): number {
  return filterFurniturePresets(presets, { query, category }).length;
}

"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import { UiCard } from "../ui/ui-card";
import { formatMillimeters } from "../ui/presentation-format";
import {
  filterFurniturePresets,
  furnitureCategoryCount,
  type FurnitureCategoryFilter,
} from "./furniture-catalog-model";
import { furnitureCatalogUiStore } from "./furniture-catalog-ui-store";
import { FURNITURE_PRESETS, type FurniturePreset } from "./furniture-presets";
import { editorStore } from "./use-editor-store";

const CATEGORY_LABELS: Readonly<Record<FurniturePreset["category"], string>> = {
  sleep: "Сон",
  seating: "Мягкая мебель",
  storage: "Хранение",
  table: "Столы",
  chair: "Стулья",
  kitchen: "Кухня",
  appliance: "Техника",
  custom: "Свой размер",
};

const CATEGORY_ORDER: readonly FurniturePreset["category"][] = [
  "sleep",
  "seating",
  "storage",
  "table",
  "chair",
  "kitchen",
  "appliance",
  "custom",
];

const CATEGORY_OPTIONS: readonly Readonly<{ id: FurnitureCategoryFilter; label: string }>[] = [
  { id: "all", label: "Все" },
  ...CATEGORY_ORDER.map((id) => ({ id, label: CATEGORY_LABELS[id] })),
];

function PresetGlyph({ preset }: Readonly<{ preset: FurniturePreset }>) {
  const glyph = {
    sleep: "▰",
    seating: "▱",
    storage: "▥",
    table: "▤",
    chair: "□",
    kitchen: "▦",
    appliance: "▣",
    custom: "+",
  }[preset.category];
  return <span className={`preset-glyph preset-${preset.category}`} aria-hidden="true">{glyph}</span>;
}

export function FurnitureCatalog() {
  const activePresetId = useStore(editorStore, (state) => state.placementPresetId);
  const query = useStore(furnitureCatalogUiStore, (state) => state.query);
  const category = useStore(furnitureCatalogUiStore, (state) => state.category);
  const setQuery = useStore(furnitureCatalogUiStore, (state) => state.setQuery);
  const setCategory = useStore(furnitureCatalogUiStore, (state) => state.setCategory);
  const resetFilters = useStore(furnitureCatalogUiStore, (state) => state.resetFilters);

  const filtered = useMemo(
    () => filterFurniturePresets(FURNITURE_PRESETS, { query, category }),
    [category, query],
  );
  const grouped = useMemo(() => CATEGORY_ORDER.map((groupCategory) => ({
    category: groupCategory,
    presets: filtered.filter((preset) => preset.category === groupCategory),
  })).filter((group) => group.presets.length > 0), [filtered]);
  const selectedCategoryLabel = category === "all" ? "Все категории" : CATEGORY_LABELS[category];

  return (
    <aside className="furniture-catalog" aria-label="Каталог мебели и техники">
      <div className="catalog-heading">
        <div>
          <strong>Мебель и техника</strong>
          <span>Выберите предмет, затем место на плане</span>
        </div>
        {activePresetId ? (
          <button className="catalog-cancel" type="button" onClick={() => editorStore.getState().setPlacementPreset(null)}>
            Отменить размещение
          </button>
        ) : null}
      </div>

      <div className="catalog-scroll">
        <div className="catalog-filter-controls">
          <input
            className="catalog-search"
            type="search"
            aria-label="Поиск мебели и техники"
            value={query}
            placeholder="Например, стол или шкаф"
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className="catalog-category-list" aria-label="Категории мебели">
            {CATEGORY_OPTIONS.map((option) => {
              const count = furnitureCategoryCount(FURNITURE_PRESETS, query, option.id);
              const selected = category === option.id;
              return (
                <button
                  key={option.id}
                  type="button"
                  className="catalog-category-chip"
                  aria-pressed={selected}
                  data-empty={count === 0 ? "true" : undefined}
                  onClick={() => setCategory(option.id)}
                >
                  <span>{option.label}</span>
                  <span aria-hidden="true">{count}</span>
                </button>
              );
            })}
          </div>
          <p className="catalog-result-summary">
            Найдено: <strong>{filtered.length}</strong>
            {query.trim() || category !== "all" ? <span> · {selectedCategoryLabel}{query.trim() ? ` · «${query.trim()}»` : ""}</span> : null}
          </p>
        </div>

        {filtered.length === 0 ? (
          <div className="catalog-empty-state">
            <strong>Ничего не найдено</strong>
            <span>Измените запрос или категорию.</span>
            <button type="button" className="secondary-action" onClick={resetFilters}>Сбросить фильтры</button>
          </div>
        ) : grouped.map((group) => (
          <section className="catalog-group" key={group.category}>
            <h2>{CATEGORY_LABELS[group.category]}</h2>
            <div className="catalog-grid">
              {group.presets.map((preset) => {
                const active = preset.id === activePresetId;
                const dimensions = `${formatMillimeters(preset.width)} × ${formatMillimeters(preset.depth)}`;
                return (
                  <UiCard
                    key={preset.id}
                    variant="selectable"
                    selected={active}
                    className="furniture-preset-card"
                  >
                    <button
                      type="button"
                      className="preset-card ui-card-host"
                      aria-pressed={active}
                      aria-label={`${preset.name}, ${dimensions}`}
                      title={`${preset.name} — ${dimensions}`}
                      onClick={() => editorStore.getState().setPlacementPreset(active ? null : preset.id)}
                    >
                      <PresetGlyph preset={preset} />
                      <span className="preset-copy">
                        <strong>{preset.name}</strong>
                        <small className="ui-card-supporting">{dimensions}</small>
                      </span>
                    </button>
                  </UiCard>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </aside>
  );
}

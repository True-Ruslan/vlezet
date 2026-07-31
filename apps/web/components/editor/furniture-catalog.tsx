"use client";

import { useMemo } from "react";
import { useStore } from "zustand";
import { UiCard } from "../ui/ui-card";
import { formatMillimeters } from "../ui/presentation-format";
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
  const grouped = useMemo(() => CATEGORY_ORDER.map((category) => ({
    category,
    presets: FURNITURE_PRESETS.filter((preset) => preset.category === category),
  })).filter((group) => group.presets.length > 0), []);

  return (
    <aside className="furniture-catalog" aria-label="Каталог мебели и техники">
      <div className="catalog-heading">
        <div>
          <strong>Мебель и техника</strong>
          <span>Нажмите предмет, затем место на плане</span>
        </div>
        {activePresetId ? (
          <button className="catalog-cancel" type="button" onClick={() => editorStore.getState().setPlacementPreset(null)}>
            Отмена
          </button>
        ) : null}
      </div>

      <div className="catalog-scroll">
        {grouped.map((group) => (
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

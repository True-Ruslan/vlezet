"use client";

import { wallLength } from "@vlezet/editor-core";
import { useEffect, useMemo, useState } from "react";
import { useStore } from "zustand";
import { editorStore } from "./use-editor-store";

export function WallInspector() {
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const walls = useStore(editorStore, (state) => state.history.document.walls);
  const wall = useMemo(() => walls.find((item) => item.id === selectedWallId) ?? null, [selectedWallId, walls]);
  const [lengthInput, setLengthInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setLengthInput(wall ? String(Math.round(wallLength(wall))) : "");
    setError(null);
  }, [wall]);

  if (!wall) {
    return <aside className="inspector-panel"><div className="inspector-empty"><strong>Ничего не выбрано</strong><span>Выберите стену, чтобы увидеть её точные параметры.</span></div></aside>;
  }

  const currentLength = wallLength(wall);
  const applyLength = () => {
    const value = Number(lengthInput.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) {
      setError("Введите положительную длину в миллиметрах.");
      return;
    }
    try {
      editorStore.getState().setSelectedWallLength(value);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить длину.");
    }
  };

  return (
    <aside className="inspector-panel">
      <div className="inspector-heading"><span>Стена</span><code>{wall.id.slice(0, 8)}</code></div>
      <label className="field-label" htmlFor="wall-length">Точная длина</label>
      <div className="length-field-row">
        <input id="wall-length" inputMode="decimal" value={lengthInput} onChange={(event) => setLengthInput(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") applyLength(); }} aria-invalid={Boolean(error)} />
        <span>мм</span>
      </div>
      <button className="primary-action" type="button" onClick={applyLength}>Применить</button>
      {error ? <p className="field-error">{error}</p> : null}
      <dl className="wall-facts">
        <div><dt>Длина</dt><dd>{(currentLength / 1000).toFixed(3)} м</dd></div>
        <div><dt>Толщина</dt><dd>{wall.thickness} мм</dd></div>
      </dl>
      <p className="inspector-hint">Начальная точка стены остаётся на месте, направление сохраняется.</p>
    </aside>
  );
}

"use client";

import type { VlezetDocumentV2, Wall } from "@vlezet/domain";
import { MAX_WALL_THICKNESS_MM, MIN_WALL_THICKNESS_MM, topologicalWallLength } from "@vlezet/editor-core";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { editorStore } from "./use-editor-store";

function wallVersionKey(document: VlezetDocumentV2, wall: Wall): string {
  const start = document.vertices.find((vertex) => vertex.id === wall.startVertexId)?.position;
  const end = document.vertices.find((vertex) => vertex.id === wall.endVertexId)?.position;
  return [
    wall.id,
    start?.x,
    start?.y,
    end?.x,
    end?.y,
    wall.thickness,
    ...wall.junctionVertexIds,
  ].join(":");
}

function connectionCount(document: VlezetDocumentV2, wall: Wall): number {
  const connected = new Set(wall.junctionVertexIds);
  for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
    const shared = document.walls.some((candidate) =>
      candidate.id !== wall.id &&
      (candidate.startVertexId === vertexId || candidate.endVertexId === vertexId || candidate.junctionVertexIds.includes(vertexId)),
    );
    if (shared) connected.add(vertexId);
  }
  return connected.size;
}

function SelectedWallInspector({ document, wall }: Readonly<{ document: VlezetDocumentV2; wall: Wall }>) {
  const currentLength = topologicalWallLength(document, wall.id);
  const [lengthInput, setLengthInput] = useState(() => String(Math.round(currentLength)));
  const [thicknessInput, setThicknessInput] = useState(() => String(Math.round(wall.thickness)));
  const [error, setError] = useState<string | null>(null);

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

  const applyThickness = () => {
    const value = Number(thicknessInput.replace(",", "."));
    if (!Number.isFinite(value)) {
      setError("Введите толщину стены в миллиметрах.");
      return;
    }
    try {
      editorStore.getState().setSelectedWallThickness(value);
      setError(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Не удалось изменить толщину.");
    }
  };

  const connections = connectionCount(document, wall);

  return (
    <aside className="inspector-panel">
      <div className="inspector-heading"><span>Стена</span><code>{wall.id.slice(0, 8)}</code></div>

      <label className="field-label" htmlFor="wall-length">Точная длина</label>
      <div className="length-field-row">
        <input
          id="wall-length"
          inputMode="decimal"
          value={lengthInput}
          onChange={(event) => setLengthInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") applyLength(); }}
          aria-invalid={Boolean(error)}
        />
        <span>мм</span>
      </div>
      <button className="primary-action" type="button" onClick={applyLength}>Применить длину</button>

      <label className="field-label" htmlFor="wall-thickness">Толщина стены</label>
      <div className="length-field-row">
        <input
          id="wall-thickness"
          inputMode="decimal"
          min={MIN_WALL_THICKNESS_MM}
          max={MAX_WALL_THICKNESS_MM}
          value={thicknessInput}
          onChange={(event) => setThicknessInput(event.target.value)}
          onKeyDown={(event) => { if (event.key === "Enter") applyThickness(); }}
          aria-invalid={Boolean(error)}
        />
        <span>мм</span>
      </div>
      <button className="secondary-action" type="button" onClick={applyThickness}>Применить толщину</button>

      {error ? <p className="field-error">{error}</p> : null}
      <dl className="wall-facts">
        <div><dt>Длина</dt><dd>{(currentLength / 1000).toFixed(3)} м</dd></div>
        <div><dt>Толщина</dt><dd>{wall.thickness} мм</dd></div>
        <div><dt>Соединений</dt><dd>{connections}</dd></div>
      </dl>
      <p className="inspector-hint">Стены соединены настоящими узлами. Изменение общей вершины не разрывает соседние стены.</p>
    </aside>
  );
}

export function WallInspector() {
  const selectedWallId = useStore(editorStore, (state) => state.selectedWallId);
  const document = useStore(editorStore, (state) => state.history.document);
  const wall = useMemo(() => document.walls.find((item) => item.id === selectedWallId) ?? null, [selectedWallId, document.walls]);

  if (!wall) {
    return <aside className="inspector-panel"><div className="inspector-empty"><strong>Ничего не выбрано</strong><span>Выберите стену, чтобы увидеть её точные параметры.</span></div></aside>;
  }

  return <SelectedWallInspector key={wallVersionKey(document, wall)} document={document} wall={wall} />;
}

"use client";

import type { Opening, VlezetDocument, Wall } from "@vlezet/domain";
import { MAX_WALL_THICKNESS_MM, MIN_WALL_THICKNESS_MM, topologicalWallLength } from "@vlezet/editor-core";
import { deriveRooms, type DerivedRoom } from "@vlezet/geometry";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { ObjectInspector } from "./object-inspector";
import { editorStore } from "./use-editor-store";

function wallVersionKey(document: VlezetDocument, wall: Wall): string {
  const start = document.vertices.find((vertex) => vertex.id === wall.startVertexId)?.position;
  const end = document.vertices.find((vertex) => vertex.id === wall.endVertexId)?.position;
  return [wall.id, start?.x, start?.y, end?.x, end?.y, wall.thickness, ...wall.junctionVertexIds].join(":");
}

function connectionCount(document: VlezetDocument, wall: Wall): number {
  const connected = new Set(wall.junctionVertexIds);
  for (const vertexId of [wall.startVertexId, wall.endVertexId]) {
    const shared = document.walls.some((candidate) => candidate.id !== wall.id && (candidate.startVertexId === vertexId || candidate.endVertexId === vertexId || candidate.junctionVertexIds.includes(vertexId)));
    if (shared) connected.add(vertexId);
  }
  return connected.size;
}

function SelectedWallInspector({ document, wall }: Readonly<{ document: VlezetDocument; wall: Wall }>) {
  const currentLength = topologicalWallLength(document, wall.id);
  const [lengthInput, setLengthInput] = useState(() => String(Math.round(currentLength)));
  const [thicknessInput, setThicknessInput] = useState(() => String(Math.round(wall.thickness)));
  const [error, setError] = useState<string | null>(null);
  const applyLength = () => {
    const value = Number(lengthInput.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { setError("Введите положительную длину в миллиметрах."); return; }
    try { editorStore.getState().setSelectedWallLength(value); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить длину."); }
  };
  const applyThickness = () => {
    const value = Number(thicknessInput.replace(",", "."));
    if (!Number.isFinite(value)) { setError("Введите толщину стены в миллиметрах."); return; }
    try { editorStore.getState().setSelectedWallThickness(value); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить толщину."); }
  };
  return <aside className="inspector-panel">
    <div className="inspector-heading"><span>Стена</span><code>{wall.id.slice(0,8)}</code></div>
    <label className="field-label" htmlFor="wall-length">Точная длина</label><div className="length-field-row"><input id="wall-length" inputMode="decimal" value={lengthInput} onChange={(e)=>setLengthInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyLength();}}/><span>мм</span></div><button className="primary-action" type="button" onClick={applyLength}>Применить длину</button>
    <label className="field-label" htmlFor="wall-thickness">Толщина стены</label><div className="length-field-row"><input id="wall-thickness" inputMode="decimal" min={MIN_WALL_THICKNESS_MM} max={MAX_WALL_THICKNESS_MM} value={thicknessInput} onChange={(e)=>setThicknessInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyThickness();}}/><span>мм</span></div><button className="secondary-action" type="button" onClick={applyThickness}>Применить толщину</button>
    {error?<p className="field-error">{error}</p>:null}<dl className="wall-facts"><div><dt>Длина</dt><dd>{(currentLength/1000).toFixed(3)} м</dd></div><div><dt>Толщина</dt><dd>{wall.thickness} мм</dd></div><div><dt>Соединений</dt><dd>{connectionCount(document,wall)}</dd></div></dl><p className="inspector-hint">Стены соединены настоящими узлами. Изменение общей вершины не разрывает соседние стены.</p>
  </aside>;
}

function SelectedRoomInspector({ room }: Readonly<{ room: DerivedRoom }>) {
  const [name,setName]=useState(room.name); const [error,setError]=useState<string|null>(null);
  const applyName=()=>{try{editorStore.getState().setSelectedRoomName(name);setError(null);}catch(cause){setError(cause instanceof Error?cause.message:"Не удалось переименовать комнату.");}};
  return <aside className="inspector-panel"><div className="inspector-heading"><span>Комната</span><code>{room.id.slice(-10)}</code></div><label className="field-label" htmlFor="room-name">Название</label><div className="room-name-field"><input id="room-name" value={name} maxLength={80} onChange={(e)=>setName(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyName();}}/></div><button className="primary-action" type="button" onClick={applyName}>Сохранить название</button>{error?<p className="field-error">{error}</p>:null}<dl className="wall-facts"><div><dt>Полезная площадь</dt><dd>{room.areaM2.toFixed(2)} м²</dd></div></dl><p className="inspector-hint">Площадь считается автоматически по внутренним поверхностям стен и обновляется при изменении планировки.</p></aside>;
}

function SelectedOpeningInspector({ opening }: Readonly<{ opening: Opening }>) {
  const [width,setWidth]=useState(String(Math.round(opening.width)));
  const [offset,setOffset]=useState(String(Math.round(opening.offset)));
  const [hinge,setHinge]=useState<"start"|"end">(opening.doorSwing?.hinge??"start");
  const [side,setSide]=useState<"left"|"right">(opening.doorSwing?.side??"left");
  const [error,setError]=useState<string|null>(null);
  const apply=()=>{
    const widthValue=Number(width.replace(",",".")); const offsetValue=Number(offset.replace(",","."));
    if(!Number.isFinite(widthValue)||!Number.isFinite(offsetValue)){setError("Введите корректные размеры в миллиметрах.");return;}
    try{editorStore.getState().updateSelectedOpening({width:widthValue,offset:offsetValue,...(opening.kind==="door"?{doorSwing:{hinge,side}}:{})});setError(null);}catch(cause){setError(cause instanceof Error?cause.message:"Не удалось изменить проём.");}
  };
  return <aside className="inspector-panel">
    <div className="inspector-heading"><span>{opening.kind==="door"?"Дверь":"Окно"}</span><code>{opening.id.slice(0,8)}</code></div>
    <label className="field-label" htmlFor="opening-width">Ширина</label><div className="length-field-row"><input id="opening-width" inputMode="decimal" value={width} onChange={(e)=>setWidth(e.target.value)}/><span>мм</span></div>
    <label className="field-label" htmlFor="opening-offset">От начала стены</label><div className="length-field-row"><input id="opening-offset" inputMode="decimal" value={offset} onChange={(e)=>setOffset(e.target.value)}/><span>мм</span></div>
    {opening.kind==="door"?<><label className="field-label" htmlFor="door-hinge">Петля</label><select id="door-hinge" className="inspector-select" value={hinge} onChange={(e)=>setHinge(e.target.value as "start"|"end")}><option value="start">Со стороны начала проёма</option><option value="end">Со стороны конца проёма</option></select><label className="field-label" htmlFor="door-side">Открывание</label><select id="door-side" className="inspector-select" value={side} onChange={(e)=>setSide(e.target.value as "left"|"right")}><option value="left">Влево от направления стены</option><option value="right">Вправо от направления стены</option></select></>:null}
    <button className="primary-action" type="button" onClick={apply}>Применить</button>{error?<p className="field-error">{error}</p>:null}
    <button className="danger-action" type="button" onClick={()=>editorStore.getState().deleteSelectedOpening()}>Удалить {opening.kind==="door"?"дверь":"окно"}</button>
    <p className="inspector-hint">Проём привязан к этой стене по реальному расстоянию от её начала и не «плавает» при добавлении перегородок.</p>
  </aside>;
}

export function WallInspector(){
  const selectedWallId=useStore(editorStore,(s)=>s.selectedWallId);
  const selectedRoomId=useStore(editorStore,(s)=>s.selectedRoomId);
  const selectedOpeningId=useStore(editorStore,(s)=>s.selectedOpeningId);
  const selectedObjectId=useStore(editorStore,(s)=>s.selectedObjectId);
  const document=useStore(editorStore,(s)=>s.history.document);
  const wall=useMemo(()=>document.walls.find((x)=>x.id===selectedWallId)??null,[selectedWallId,document.walls]);
  const room=useMemo(()=>deriveRooms(document).rooms.find((x)=>x.id===selectedRoomId)??null,[document,selectedRoomId]);
  const opening=useMemo(()=>document.openings.find((x)=>x.id===selectedOpeningId)??null,[document.openings,selectedOpeningId]);
  const object=useMemo(()=>document.placedObjects.find((x)=>x.id===selectedObjectId)??null,[document.placedObjects,selectedObjectId]);
  if(object)return <ObjectInspector key={`${object.id}:${object.position.x}:${object.position.y}:${object.width}:${object.depth}:${object.rotationDeg}`} document={document} object={object}/>;
  if(opening)return <SelectedOpeningInspector key={`${opening.id}:${opening.offset}:${opening.width}:${opening.doorSwing?.hinge}:${opening.doorSwing?.side}`} opening={opening}/>;
  if(room)return <SelectedRoomInspector key={`${room.id}:${room.name}:${room.areaMm2}`} room={room}/>;
  if(wall)return <SelectedWallInspector key={wallVersionKey(document,wall)} document={document} wall={wall}/>;
  return <aside className="inspector-panel"><div className="inspector-empty"><strong>Ничего не выбрано</strong><span>Выберите предмет, стену, комнату, дверь или окно.</span></div></aside>;
}

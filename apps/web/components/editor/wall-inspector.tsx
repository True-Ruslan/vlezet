"use client";

import type { Opening, VlezetDocument, Wall } from "@vlezet/domain";
import {
  MAX_WALL_THICKNESS_MM,
  MIN_WALL_THICKNESS_MM,
  topologicalWallLength,
  type ClearRoomDimensionAnchor,
  type WallLengthAnchor,
  type WallThicknessAlignment,
} from "@vlezet/editor-core";
import {
  deriveRectangularRoomDimensions,
  deriveRooms,
  deriveSingleAdjacentRoomSide,
  type DerivedRoom,
} from "@vlezet/geometry";
import { useMemo, useState } from "react";
import { useStore } from "zustand";
import { PlanningPanel } from "../planning/planning-panel";
import { planningUiStore } from "../planning/planning-ui-store";
import { formatAreaM2FromSquareMillimeters } from "./dimension-annotations";
import { ObjectInspector } from "./object-inspector";
import { editorStore } from "./use-editor-store";
import { resolveWallThicknessAlignment, type WallThicknessGrowthIntent } from "./wall-thickness-intent";

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

export function SelectedWallInspector({ document, wall }: Readonly<{ document: VlezetDocument; wall: Wall }>) {
  const currentLength = topologicalWallLength(document, wall.id);
  const interiorSide = deriveSingleAdjacentRoomSide(document, wall.id);
  const [lengthInput, setLengthInput] = useState(() => String(Math.round(currentLength)));
  const [lengthAnchor, setLengthAnchor] = useState<WallLengthAnchor>("start");
  const [thicknessInput, setThicknessInput] = useState(() => String(Math.round(wall.thickness)));
  const [thicknessGrowthIntent, setThicknessGrowthIntent] = useState<WallThicknessGrowthIntent>("center");
  const [explicitThicknessAlignment, setExplicitThicknessAlignment] = useState<WallThicknessAlignment>("center");
  const [error, setError] = useState<string | null>(null);
  const applyLength = () => {
    const value = Number(lengthInput.replace(",", "."));
    if (!Number.isFinite(value) || value <= 0) { setError("Введите положительную длину в миллиметрах."); return; }
    try { editorStore.getState().setSelectedWallLength(value, lengthAnchor); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить длину."); }
  };
  const applyThickness = () => {
    const value = Number(thicknessInput.replace(",", "."));
    if (!Number.isFinite(value)) { setError("Введите толщину стены в миллиметрах."); return; }
    const alignment = interiorSide
      ? resolveWallThicknessAlignment(interiorSide, thicknessGrowthIntent)
      : explicitThicknessAlignment;
    try { editorStore.getState().setSelectedWallThickness(value, alignment); setError(null); } catch (cause) { setError(cause instanceof Error ? cause.message : "Не удалось изменить толщину."); }
  };
  return <aside className="inspector-panel">
    <div className="inspector-heading"><span>Стена</span><code>{wall.id.slice(0,8)}</code></div>
    <label className="field-label" htmlFor="wall-length">Длина по оси стены</label><div className="length-field-row"><input id="wall-length" inputMode="decimal" value={lengthInput} onChange={(e)=>setLengthInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyLength();}}/><span>мм</span></div>
    <label className="field-label" htmlFor="wall-length-anchor">Что остаётся на месте</label><select id="wall-length-anchor" className="inspector-select" value={lengthAnchor} onChange={(e)=>setLengthAnchor(e.target.value as WallLengthAnchor)}><option value="start">Начало</option><option value="center">Центр</option><option value="end">Конец</option></select>
    <p className="inspector-hint">Длина по оси — расстояние между узлами стены. Это не всегда равно чистому внутреннему размеру комнаты.</p>
    <button className="primary-action" type="button" onClick={applyLength}>Применить длину</button>
    <label className="field-label" htmlFor="wall-thickness">Толщина стены</label><div className="length-field-row"><input id="wall-thickness" inputMode="decimal" min={MIN_WALL_THICKNESS_MM} max={MAX_WALL_THICKNESS_MM} value={thicknessInput} onChange={(e)=>setThicknessInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyThickness();}}/><span>мм</span></div>
    {interiorSide?<>
      <label className="field-label" htmlFor="wall-thickness-growth">Куда меняется толщина</label><select id="wall-thickness-growth" className="inspector-select" value={thicknessGrowthIntent} onChange={(e)=>setThicknessGrowthIntent(e.target.value as WallThicknessGrowthIntent)}><option value="inside">Внутрь помещения</option><option value="center">По центру</option><option value="outside">Наружу</option></select>
      <p className="inspector-hint">Направление определено относительно единственного соседнего помещения. Vlezet сдвинет ось так, чтобы противоположная физическая грань осталась на месте.</p>
    </>:<>
      <label className="field-label" htmlFor="wall-thickness-face">Сохранить грань</label><select id="wall-thickness-face" className="inspector-select" value={explicitThicknessAlignment} onChange={(e)=>setExplicitThicknessAlignment(e.target.value as WallThicknessAlignment)}><option value="left-face">Левая грань</option><option value="center">По центру</option><option value="right-face">Правая грань</option></select>
      <p className="inspector-hint">У стены нет одной однозначной стороны помещения, поэтому Vlezet не угадывает «внутрь» и «наружу». Выберите физическую грань явно.</p>
    </>}
    <button className="secondary-action" type="button" onClick={applyThickness}>Применить толщину</button>
    {error?<p className="field-error">{error}</p>:null}<dl className="wall-facts"><div><dt>По оси</dt><dd>{(currentLength/1000).toFixed(3)} м</dd></div><div><dt>Толщина</dt><dd>{wall.thickness} мм</dd></div><div><dt>Соединений</dt><dd>{connectionCount(document,wall)}</dd></div></dl><p className="inspector-hint">Стены соединены настоящими узлами. Изменение общей вершины не разрывает соседние стены.</p>
  </aside>;
}

export function SelectedRoomInspector({ room }: Readonly<{ room: DerivedRoom }>) {
  const dimensions = deriveRectangularRoomDimensions(room);
  const [name,setName]=useState(room.name);
  const [widthInput,setWidthInput]=useState(()=>dimensions?String(Math.round(dimensions.widthMm)):"");
  const [heightInput,setHeightInput]=useState(()=>dimensions?String(Math.round(dimensions.heightMm)):"");
  const [widthAnchor,setWidthAnchor]=useState<ClearRoomDimensionAnchor>("min");
  const [heightAnchor,setHeightAnchor]=useState<ClearRoomDimensionAnchor>("min");
  const [error,setError]=useState<string|null>(null);
  const applyName=()=>{try{editorStore.getState().setSelectedRoomName(name);setError(null);}catch(cause){setError(cause instanceof Error?cause.message:"Не удалось переименовать комнату.");}};
  const applyDimension=(axis:"width"|"height", raw:string, anchor:ClearRoomDimensionAnchor)=>{
    const value=Number(raw.replace(",","."));
    if(!Number.isFinite(value)||value<=0){setError("Введите положительный чистый размер в миллиметрах.");return;}
    try{editorStore.getState().setSelectedRoomClearDimension(axis,value,anchor);setError(null);}catch(cause){setError(cause instanceof Error?cause.message:"Не удалось изменить чистый размер комнаты.");}
  };
  return <aside className="inspector-panel">
    <div className="inspector-heading"><span>Комната</span><code>{room.id.slice(-10)}</code></div>
    <label className="field-label" htmlFor="room-name">Название</label><div className="room-name-field"><input id="room-name" value={name} maxLength={80} onChange={(e)=>setName(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyName();}}/></div><button className="primary-action" type="button" onClick={applyName}>Сохранить название</button>
    {dimensions?<div className="room-clear-dimensions">
      <strong>Чистые внутренние размеры</strong>
      <label className="field-label" htmlFor="room-clear-width">Ширина</label><div className="length-field-row"><input id="room-clear-width" inputMode="decimal" value={widthInput} onChange={(e)=>setWidthInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyDimension("width",widthInput,widthAnchor);}}/><span>мм</span></div>
      <label className="field-label" htmlFor="room-clear-width-anchor">Что остаётся на месте</label><select id="room-clear-width-anchor" className="inspector-select" value={widthAnchor} onChange={(e)=>setWidthAnchor(e.target.value as ClearRoomDimensionAnchor)}><option value="min">Левая сторона</option><option value="center">Центр</option><option value="max">Правая сторона</option></select><button className="secondary-action" type="button" onClick={()=>applyDimension("width",widthInput,widthAnchor)}>Применить ширину</button>
      <label className="field-label" htmlFor="room-clear-height">Длина</label><div className="length-field-row"><input id="room-clear-height" inputMode="decimal" value={heightInput} onChange={(e)=>setHeightInput(e.target.value)} onKeyDown={(e)=>{if(e.key==="Enter")applyDimension("height",heightInput,heightAnchor);}}/><span>мм</span></div>
      <label className="field-label" htmlFor="room-clear-height-anchor">Что остаётся на месте</label><select id="room-clear-height-anchor" className="inspector-select" value={heightAnchor} onChange={(e)=>setHeightAnchor(e.target.value as ClearRoomDimensionAnchor)}><option value="min">Верхняя сторона</option><option value="center">Центр</option><option value="max">Нижняя сторона</option></select><button className="secondary-action" type="button" onClick={()=>applyDimension("height",heightInput,heightAnchor)}>Применить длину</button>
      <p className="inspector-hint">Это расстояния между внутренними поверхностями стен. Для прямоугольной комнаты площадь считается из той же чистой геометрии.</p>
      <button className="secondary-action" type="button" onClick={()=>planningUiStore.getState().openForRoom(room.id)}>Варианты расстановки</button>
      <p className="inspector-hint">Планировщик предложит до трёх проверенных вариантов для 1–3 существующих предметов. Предпросмотр не меняет проект.</p>
    </div>:<p className="inspector-hint">Чистые размеры можно редактировать, когда комната является простой прямоугольной геометрией. Для сложных контуров Vlezet не угадывает неоднозначные размеры.</p>}
    {error?<p className="field-error">{error}</p>:null}<dl className="wall-facts"><div><dt>Полезная площадь</dt><dd>{formatAreaM2FromSquareMillimeters(room.areaMm2)} м²</dd></div></dl><p className="inspector-hint">Площадь считается автоматически по внутренним поверхностям стен и обновляется при изменении планировки.</p>
  </aside>;
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
  const planningRoomId=useStore(planningUiStore,(s)=>s.roomId);
  const document=useStore(editorStore,(s)=>s.history.document);
  const wall=useMemo(()=>document.walls.find((x)=>x.id===selectedWallId)??null,[selectedWallId,document.walls]);
  const room=useMemo(()=>deriveRooms(document).rooms.find((x)=>x.id===selectedRoomId)??null,[document,selectedRoomId]);
  const opening=useMemo(()=>document.openings.find((x)=>x.id===selectedOpeningId)??null,[document.openings,selectedOpeningId]);
  const object=useMemo(()=>document.placedObjects.find((x)=>x.id===selectedObjectId)??null,[document.placedObjects,selectedObjectId]);
  if(planningRoomId)return <PlanningPanel roomId={planningRoomId}/>;
  if(object)return <ObjectInspector key={`${object.id}:${object.position.x}:${object.position.y}:${object.width}:${object.depth}:${object.rotationDeg}`} document={document} object={object}/>;
  if(opening)return <SelectedOpeningInspector key={`${opening.id}:${opening.offset}:${opening.width}:${opening.doorSwing?.hinge}:${opening.doorSwing?.side}`} opening={opening}/>;
  if(room)return <SelectedRoomInspector key={`${room.id}:${room.name}:${room.areaMm2}`} room={room}/>;
  if(wall)return <SelectedWallInspector key={wallVersionKey(document,wall)} document={document} wall={wall}/>;
  return <aside className="inspector-panel"><div className="inspector-empty"><strong>Ничего не выбрано</strong><span>Выберите предмет, стену, комнату, дверь или окно.</span></div></aside>;
}

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M7.4 live Canvas feedback integration", () => {
  it("keeps hovered identity local while publishing only derived semantic feedback", () => {
    expect(source).toContain('from "./canvas-transient-feedback-store"');
    expect(source).toContain('from "./canvas-entity-identity"');
    expect(source).toContain('from "./canvas-entity-visual"');
    expect(source).toContain("const [hoveredEntity, setHoveredEntity]");
    expect(source).toContain("const visibleHoveredEntity = hoverEnabled ? hoveredEntity : null");
    expect(source).toContain("canvasEntityFromKonvaNode");
    expect(source).toContain("parseCanvasEntityName(current.name())");
    expect(source).toContain("const stage = event.target.getStage()");
    expect(source).toContain("const hitNode = stage?.getIntersection(pointer) ?? event.target");
    expect(source).not.toContain("canvasEntityFromKonvaNode(event.target)");
    expect(source).toContain("canvasTransientFeedbackStore.getState().setHoveredSelectable(visibleHoveredEntity !== null)");
    expect(source).toContain("canvasTransientFeedbackStore.getState().reset()");
  });

  it("exposes rooms, walls, openings and furniture through the existing Konva hit graph", () => {
    expect(source).toContain('name={canvasEntityName("room", room.id)}');
    expect(source).toContain('name={canvasEntityName("wall", wall.id)}');
    expect(source).toContain('name={!preview ? canvasEntityName("opening", opening.id) : undefined}');
    expect(source).toContain("deriveCanvasEntityVisual");
    expect(source).toContain("hovered={visibleHoveredEntity?.kind === \"object\" && visibleHoveredEntity.id === object.id}");
    expect(source).not.toContain("onHoverChange={(hovered) => setHoveredCanvasEntity");
  });

  it("publishes valid and invalid preview state and labels opening previews", () => {
    expect(source).toContain("setPreviewState");
    expect(source).toContain('text={visibleOpeningPreview.valid ? "Предпросмотр" : "Недопустимо"}');
    expect(source).toContain('data-preview-state={livePreviewState}');
    expect(source).toContain('openingPreview?.opening.kind === tool');
  });

  it("publishes ready and active pan state without changing viewport authority", () => {
    expect(source).toContain('setPanState(spacePressed ? "ready" : "idle")');
    expect(source).toContain('setPanState("active")');
    expect(source).toContain("commitViewport(next)");
  });

  it("hides stale object guides when no placement or transform is active", () => {
    expect(source).toContain("const visibleObjectGuides = placementPresetId || objectGesture ? objectGuides : []");
    expect(source).toContain("{visibleObjectGuides.map");
  });

  it("moves a compatible furniture multi-selection without collapsing it", () => {
    expect(source).toContain('objectGesture.kind === "move"');
    expect(source).toContain("for (const object of objectGesture.preview) previewById.set(object.id, object)");
    expect(source).toContain('gesture?.kind === "move" && gesture.anchorObjectId === objectId');
    expect(source).toContain("new Set(gesture.objectIds)");
    expect(source).toContain("displayedObjects.filter((object) => !excludedIds.has(object.id))");
    expect(source).toContain("selectedObjectIds.has(object.id)");
  });
});

describe("M7.6 geometry inspector Canvas preview integration", () => {
  it("subscribes to runtime-only preview state without replacing document geometry", () => {
    expect(source).toContain('from "./geometry-inspector-preview-store"');
    expect(source).toContain("const roomSpanPreview = useStore(geometryInspectorPreviewStore");
    expect(source).toContain("const doorSwingPreview = useStore(geometryInspectorPreviewStore");
    expect(source).not.toContain("placedObjects: doorSwingPreview");
    expect(source).not.toContain("openings: document.openings.map");
  });

  it("emphasizes only the existing selected-room annotation", () => {
    expect(source).toContain("const emphasizedRoomAxis = roomSpanPreview && roomSpanPreview.roomId === selectedRoom?.id");
    expect(source).toContain("? roomSpanPreview.axis");
    expect(source).toContain("deriveRectangularRoomDimensionAnnotations(selectedRoom, emphasizedRoomAxis)");
  });

  it("overrides only the matching door renderer with the draft swing", () => {
    expect(source).toContain("const effectiveDoorSwing = doorSwingPreview?.openingId === opening.id");
    expect(source).toContain("? doorSwingPreview.value");
    expect(source).toContain(": opening.doorSwing;");
    expect(source).toContain('effectiveDoorSwing?.hinge !== "end"');
    expect(source).toContain('effectiveDoorSwing?.side === "right"');
    expect(source).toContain("openingSegment(document, opening)");
  });
});

describe("M7.7 furniture fit Canvas explanation", () => {
  it("derives placement copy from the existing M2 preview result", () => {
    expect(source).toContain("fitStatusPresentation(placementPreviewFitStatus)");
    expect(source).toContain('className="placement-fit-label"');
    expect(source).not.toContain("evaluatePlacementFit");
  });

  it("distinguishes object dimensions, recommended use zone and actual free distance", () => {
    expect(source).toContain('className="object-canvas-legend"');
    expect(source).toContain("Размер предмета");
    expect(source).toContain("Рекомендуемая зона использования");
    expect(source).toContain("Свободно сейчас");
  });
});

describe("M8.1 Canvas viewport navigation", () => {
  it("routes ordinary wheel/trackpad pan and modifier zoom through the pure controller", () => {
    expect(source).toContain('from "./editor-viewport-controller"');
    const start = source.indexOf("const onWheel");
    const end = source.indexOf("const onMouseDown", start);
    const wheelBody = source.slice(start, end);

    expect(wheelBody).toContain("wheelGestureToViewportAction(event.evt)");
    expect(wheelBody).toContain('action.kind === "pan"');
    expect(wheelBody).toContain("panViewportBy(current, action.delta)");
    expect(wheelBody).toContain("const pointer = pointerPosition(event)");
    expect(wheelBody).toContain("zoomViewportAt(");
    expect(wheelBody).toContain("pointer,");
    expect(wheelBody).toContain("Math.exp(-action.deltaY * 0.0015)");
    expect(wheelBody).toContain("{ min: MIN_SCALE, max: MAX_SCALE }");
    expect(wheelBody).toContain("event.evt.preventDefault()");
    expect(wheelBody).not.toContain("Math.exp(-event.evt.deltaY * 0.0015)");
  });

  it("executes semantic view requests without writing editor history", () => {
    expect(source).toContain("viewCommandRequest: EditorViewportCommandRequest | null");
    expect(source).toContain("handledViewCommandSerialRef");
    expect(source).toContain("fitDocumentViewport(");
    expect(source).toContain("fitSelectionViewport(");
    expect(source).toContain("actualSizeViewport(");
    expect(source).toContain("zoomViewportByCommand(");
    expect(source).toContain("DEFAULT_PROJECT_VIEWPORT.pixelsPerMillimeter");
    expect(source).toContain("deriveSelectionWorldBounds(document, selection)");
    expect(source).not.toContain("executeCommand(");
  });
});

describe("M8.1 Canvas semantic multi-selection", () => {
  it("routes entity clicks through semantic priority and modifier-aware selection", () => {
    expect(source).toContain('from "./editor-selection-geometry"');
    expect(source).toContain("entitiesIntersectingMarquee");
    expect(source).toContain("selectEntityFromPointer");
    expect(source).toContain("store.toggleSelection(ref)");
    expect(source).toContain("store.replaceSelection(ref)");
    expect(source).toContain("event.evt.shiftKey || event.evt.metaKey || event.evt.ctrlKey");
    expect(source).toContain('isEntitySelected("wall", wall.id)');
    expect(source).toContain('isEntitySelected("opening", opening.id)');
    expect(source).toContain('isEntitySelected("room", room.id)');
    expect(source).toContain('isEntitySelected("placed-object", object.id)');
  });

  it("keeps marquee Canvas-local and commits only after the screen-pixel drag threshold", () => {
    expect(source).toContain("type MarqueeGesture");
    expect(source).toContain("const MARQUEE_THRESHOLD_PX = 4");
    expect(source).toContain("const [marqueeGesture, setMarqueeGesture]");
    expect(source).toContain("finalizeMarquee");
    expect(source).toContain("entitiesIntersectingMarquee(document, worldRect)");
    expect(source).toContain("store.addSelection(hits)");
    expect(source).toContain("store.clearSelection()");
    expect(source).toContain("distance < MARQUEE_THRESHOLD_PX");
    expect(source).toContain("additive: event.evt.shiftKey");
  });

  it("lets Space/middle pan win and renders non-interactive group bounds without transform handles", () => {
    const start = source.indexOf("const onMouseDown");
    const end = source.indexOf("const onMouseMove", start);
    const mouseDownBody = source.slice(start, end);
    expect(mouseDownBody.indexOf("shouldPan")).toBeLessThan(mouseDownBody.indexOf("setMarqueeGesture"));
    expect(source).toContain("deriveSelectionWorldBounds(document, selection)");
    expect(source).toContain('deriveCanvasEntityVisual("group-selection")');
    expect(source).toContain('name="selection-group-bounds"');
    expect(source).toContain("listening={false}");
    expect(source).toContain("transformEnabled={selectedObjectId === object.id}");
  });
});

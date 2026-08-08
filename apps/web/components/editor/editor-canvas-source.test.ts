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
    expect(source).toContain("setHoveredCanvasEntity(hoverEnabled ? canvasEntityFromKonvaNode(hitNode) : null)");
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
    expect(source).toContain("objectGesture.preview.map((object) => [object.id, object])");
    expect(source).toContain("new Set(objectGesture.objectIds)");
    expect(source).toContain("selectedObjectIds.has(object.id)");
    expect(source).toContain("if (!objectSelected) editorStore.getState().selectObject(object.id)");
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

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./editor-canvas.tsx", import.meta.url), "utf8");

describe("M7.4 MEP perimeter-edge canvas controls", () => {
  it("renders perimeter-edge handles for selected equipment in select mode", () => {
    expect(source).toContain("const selectedMepEdge = selectedMepEquipment");
    expect(source).toContain("mepPerimeterEdges");
    expect(source).toContain("mepPerimeterEdgeAnchor");
    expect(source).toContain("mep-perimeter-edge-handle");
    expect(source).toContain("getState().setSelectedMepPerimeterEdge(edge.edge)");
  });

  it("suppresses perimeter-edge click updates while object manipulation is locked", () => {
    expect(source).toContain("if (objectManipulationLocked) return;");
    expect(source).toContain("objectManipulationLocked={objectManipulationLocked}");
  });
});

describe("M7.6 opening interactions", () => {
  it("updates a selected opening with a live wall-hosted drag preview", () => {
    expect(source).toContain('startsWith("opening:")');
    expect(source).toContain("setOpeningOffsetByWorldPoint");
    expect(source).toContain("onPointerMove={onOpeningPointerMove}");
    expect(source).toContain("onPointerUp={onOpeningPointerUp}");
  });

  it("toggles a selected door swing from an explicit Canvas control", () => {
    expect(source).toContain("aria-label={`Изменить открывание двери ${opening.label}`}");
    expect(source).toContain("cycleDoorSwing");
    expect(source).toContain("onClick={() => onDoorSwingToggle(opening.id)}");
  });

  it("supports direct drag translation for selected MEP, furniture and equipment without exposing rotate-in-frame", () => {
    expect(source).toContain("beginDirectPlacedObjectMove");
    expect(source).toContain("canDirectTranslate");
    expect(source).toContain("canTranslatePlacedObjectSelection");
    expect(source).toContain("data-testid=\"mep-direct-drag-handle\"");
    expect(source).toContain("data-testid=\"furniture-direct-drag-handle\"");
    expect(source).toContain("data-testid=\"equipment-direct-drag-handle\"");
    expect(source).toContain("Повернуть на 90 градусов");
    expect(source).not.toContain("rotate-control");
  });

  it("keeps the placed-object canvas path on the shared move gesture instead of legacy duplicate handlers", () => {
    expect(source).toContain("beginPlacedObjectMoveGesture");
    expect(source).toContain("updatePlacedObjectMoveGesture");
    expect(source).toContain("commitPlacedObjectGesture");
    expect(source).not.toContain("setMepPositionByWorldPoint");
    expect(source).not.toContain("setFurniturePositionByWorldPoint");
    expect(source).not.toContain("setEquipmentPositionByWorldPoint");
  });

  it("keeps door-swing preview transient until one semantic commit", () => {
    expect(source).toContain("setDoorSwingPreview");
    expect(source).toContain("clearDoorSwingPreview");
    expect(source).toContain("commitDoorSwingPreview");
    expect(source).toContain("onDoorSwingGesturePointerUp");
  });

  it("overrides only the matching door renderer with the draft swing", () => {
    expect(source).toContain("const effectiveDoorSwing = doorSwingPreview?.openingId === opening.id");
    expect(source).toContain("? doorSwingPreview.value");
    expect(source).toContain(": opening.doorSwing;");
    expect(source).toContain('effectiveDoorSwing?.hinge !== "end"');
    expect(source).toContain('effectiveDoorSwing?.side === "right"');
    expect(source).toContain("const sourceDocument = preview ? document : structuralDisplayDocument;");
    expect(source).toContain("openingSegment(sourceDocument, opening)");
  });
});

describe("M7.7 story controls", () => {
  it("forwards explicit story buttons from the floor manager into the editor actions", () => {
    expect(source).toContain("onCreateNewFloor={handleCreateNewFloor}");
    expect(source).toContain("onDuplicateFloor={handleDuplicateFloor}");
    expect(source).toContain("onDeleteFloor={handleDeleteFloor}");
    expect(source).toContain("onRenameFloor={handleRenameFloor}");
  });
});

describe("M8.1 pointer interaction foundation", () => {
  it("suppresses select/drag object manipulation while drawing walls", () => {
    expect(source).toContain('const objectManipulationLocked = tool === "wall"');
    expect(source).toContain("objectManipulationLocked={objectManipulationLocked}");
    expect(source).toContain("if (objectManipulationLocked) return;");
  });

  it("routes background marquee gestures through the canonical editor store", () => {
    expect(source).toContain("beginMarqueeGesture");
    expect(source).toContain("updateMarqueeGesture");
    expect(source).toContain("commitMarqueeGesture");
    expect(source).toContain("cancelMarqueeGesture");
  });

  it("renders multi-object selection and live move previews from runtime interaction state", () => {
    expect(source).toContain("selectedObjectIds");
    expect(source).toContain("objectGesture");
    expect(source).toContain("previewObjects");
    expect(source).toContain("selectedPlacedObjectKind");
  });
});

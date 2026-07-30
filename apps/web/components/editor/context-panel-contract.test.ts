import { createEmptyDocument, createPlacedObject, type VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import { describe, expect, it } from "vitest";
import {
  captureWorkflowReturnTarget,
  describeEmptyContext,
  describeObjectContext,
  describeOpeningContext,
  describePlanningContext,
  describeRecognitionContext,
  describeReferenceContext,
  describeRoomContext,
  describeWallContext,
  preserveWorkflowReturnTarget,
  validateWorkflowReturnTarget,
  type OrdinaryContextSnapshot,
} from "./context-panel-contract";

function representativeDocument(): VlezetDocument {
  const empty = createEmptyDocument();
  return {
    ...empty,
    vertices: [
      { id: "v1", position: { x: 0, y: 0 } },
      { id: "v2", position: { x: 4000, y: 0 } },
      { id: "v3", position: { x: 4000, y: 3000 } },
      { id: "v4", position: { x: 0, y: 3000 } },
    ],
    walls: [
      { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
      { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
      { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
      { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
    ],
    openings: [
      { id: "door-1", wallId: "w1", kind: "door", offset: 500, width: 900, doorSwing: { hinge: "start", side: "left" } },
      { id: "window-1", wallId: "w2", kind: "window", offset: 600, width: 1200 },
    ],
    roomAnnotations: [{ id: "room-label", name: "Гостиная", anchor: { x: 2000, y: 1500 } }],
    placedObjects: [createPlacedObject({
      id: "object-1",
      presetId: "sofa",
      name: "Диван",
      category: "seating",
      position: { x: 1200, y: 1200 },
      width: 1800,
      depth: 900,
      height: 850,
      rotationDeg: 0,
      clearance: { front: 600, right: 100, back: 100, left: 100 },
    })],
  };
}

describe("M7.2 context descriptors", () => {
  it("uses user-facing identity instead of raw IDs", () => {
    expect(describeEmptyContext()).toEqual({
      kind: "empty",
      category: "empty",
      eyebrow: "Свойства",
      title: "Ничего не выбрано",
    });
    expect(describeWallContext({ lengthMm: 4000, thicknessMm: 100 })).toEqual({
      kind: "wall",
      category: "selection",
      eyebrow: "Стена",
      title: "Стена",
      subtitle: "4000 мм по оси · толщина 100 мм",
    });
    expect(describeRoomContext({ name: "Гостиная", areaLabel: "11,72 м²", clearSizeLabel: "3550 × 3300 мм внутри" })).toEqual({
      kind: "room",
      category: "selection",
      eyebrow: "Комната",
      title: "Гостиная",
      subtitle: "11,72 м² · 3550 × 3300 мм внутри",
    });
    expect(describeOpeningContext({ kind: "door", widthMm: 900 })).toMatchObject({ eyebrow: "Дверь", title: "Дверь", subtitle: "Ширина 900 мм" });
    expect(describeOpeningContext({ kind: "window", widthMm: 1200 })).toMatchObject({ eyebrow: "Окно", title: "Окно", subtitle: "Ширина 1200 мм" });
    expect(describeObjectContext({ name: "Диван", statusLabel: "Влезает" })).toEqual({
      kind: "object",
      category: "selection",
      eyebrow: "Предмет",
      title: "Диван",
      subtitle: "Влезает",
    });
  });

  it("describes workflows with explicit phases and return labels", () => {
    expect(describeReferenceContext({ phase: "Подложка настроена", returnLabel: "К предмету «Диван»" })).toMatchObject({
      kind: "reference",
      category: "workflow",
      eyebrow: "Подложка",
      title: "Подложка настроена",
      returnLabel: "К предмету «Диван»",
    });
    expect(describeRecognitionContext({ phase: "Проверка черновика", returnLabel: "К предмету «Диван»" })).toMatchObject({
      kind: "recognition",
      category: "workflow",
      eyebrow: "Распознавание",
      title: "Проверка черновика",
    });
    expect(describePlanningContext({ roomName: "Гостиная", phase: "Найденные варианты", returnLabel: "К комнате «Гостиная»" })).toMatchObject({
      kind: "planning",
      category: "workflow",
      eyebrow: "Варианты расстановки",
      title: "Гостиная",
      phase: "Найденные варианты",
    });
  });
});

describe("M7.2 workflow return targets", () => {
  it("captures each ordinary context without mutating the snapshot or document", () => {
    const document = representativeDocument();
    const roomId = deriveRooms(document).rooms[0]?.id;
    expect(roomId).toBeTruthy();
    const snapshots: OrdinaryContextSnapshot[] = [
      { kind: "wall", wallId: "w1", label: "Стена" },
      { kind: "room", roomId: roomId!, label: "Комната «Гостиная»" },
      { kind: "opening-door", openingId: "door-1", label: "Дверь" },
      { kind: "opening-window", openingId: "window-1", label: "Окно" },
      { kind: "object", objectId: "object-1", label: "Предмет «Диван»" },
    ];
    const before = JSON.stringify({ document, snapshots });

    for (const snapshot of snapshots) {
      expect(captureWorkflowReturnTarget(snapshot, document)).toEqual(snapshot);
    }
    expect(JSON.stringify({ document, snapshots })).toBe(before);
  });

  it("preserves the original ordinary target across workflow-to-workflow transitions", () => {
    const original = { kind: "object", objectId: "object-1", label: "Предмет «Диван»" } as const;
    const later = { kind: "room", roomId: "room-later", label: "Комната «Спальня»" } as const;
    expect(preserveWorkflowReturnTarget(original, later)).toBe(original);
    expect(preserveWorkflowReturnTarget(null, later)).toBe(later);
  });

  it("fails closed when the captured entity no longer exists", () => {
    const document = representativeDocument();
    const valid = { kind: "object", objectId: "object-1", label: "Предмет «Диван»" } as const;
    const stale = { kind: "object", objectId: "deleted-object", label: "Предмет «Удалённый»" } as const;
    expect(validateWorkflowReturnTarget(valid, document)).toEqual(valid);
    expect(validateWorkflowReturnTarget(stale, document)).toEqual({ kind: "empty", label: "Ничего не выбрано" });
  });
});

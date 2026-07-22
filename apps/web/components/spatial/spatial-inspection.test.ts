import { describe, expect, it } from "vitest";
import type { VlezetDocument } from "@vlezet/domain";
import { deriveRooms } from "@vlezet/geometry";
import type { SpatialScene } from "@vlezet/spatial";
import {
  buildSpatialInspectionDetails,
  firstSpatialInspectionTarget,
  spatialInspectionTargetFromUserData,
} from "./spatial-inspection";

const document: VlezetDocument = {
  schemaVersion: 3,
  vertices: [
    { id: "v1", position: { x: 0, y: 0 } },
    { id: "v2", position: { x: 3650, y: 0 } },
    { id: "v3", position: { x: 3650, y: 3400 } },
    { id: "v4", position: { x: 0, y: 3400 } },
  ],
  walls: [
    { id: "w1", startVertexId: "v1", endVertexId: "v2", junctionVertexIds: [], thickness: 100 },
    { id: "w2", startVertexId: "v2", endVertexId: "v3", junctionVertexIds: [], thickness: 100 },
    { id: "w3", startVertexId: "v3", endVertexId: "v4", junctionVertexIds: [], thickness: 100 },
    { id: "w4", startVertexId: "v4", endVertexId: "v1", junctionVertexIds: [], thickness: 100 },
  ],
  openings: [],
  roomAnnotations: [],
  placedObjects: [{
    id: "sofa",
    presetId: null,
    name: "Диван",
    category: "seating",
    position: { x: 1825, y: 1700 },
    width: 500,
    depth: 500,
    height: 850,
    rotationDeg: 0,
    clearance: { front: 0, right: 0, back: 0, left: 0 },
  }],
};

const roomId = deriveRooms(document).rooms[0]!.id;

const scene: SpatialScene = {
  wallSegments: [
    {
      id: "wall:w1:0",
      wallId: "w1",
      startOffsetMm: 0,
      endOffsetMm: 3650,
      center: { x: 1825, y: 1350, z: 0 },
      lengthMm: 3650,
      thicknessMm: 100,
      heightMm: 2700,
      rotationYRad: 0,
    },
  ],
  openingMarkers: [],
  floors: [{
    id: `floor:${roomId}`,
    roomId,
    polygon: [
      { x: 50, y: 0, z: 50 },
      { x: 3600, y: 0, z: 50 },
      { x: 3600, y: 0, z: 3350 },
      { x: 50, y: 0, z: 3350 },
    ],
  }],
  objects: [{
    id: "object:sofa",
    objectId: "sofa",
    name: "Диван",
    category: "seating",
    center: { x: 1825, y: 425, z: 1700 },
    widthMm: 500,
    depthMm: 500,
    heightMm: 850,
    rotationYRad: 0,
    heightWasDefaulted: false,
  }],
};

describe("spatialInspectionTargetFromUserData", () => {
  it("maps inspectable renderer semantics to stable domain targets", () => {
    expect(spatialInspectionTargetFromUserData({ kind: "floor", roomId: "room-1" }))
      .toEqual({ kind: "room", id: "room-1" });
    expect(spatialInspectionTargetFromUserData({ kind: "wall", wallId: "wall-1" }))
      .toEqual({ kind: "wall", id: "wall-1" });
    expect(spatialInspectionTargetFromUserData({ kind: "placed-object", objectId: "sofa" }))
      .toEqual({ kind: "placed-object", id: "sofa" });
  });

  it("ignores opening placeholders and malformed renderer metadata", () => {
    expect(spatialInspectionTargetFromUserData({ kind: "opening-placeholder", openingId: "door" })).toBeNull();
    expect(spatialInspectionTargetFromUserData({ kind: "wall" })).toBeNull();
    expect(spatialInspectionTargetFromUserData({})).toBeNull();
  });

  it("returns the nearest inspectable semantic target while skipping non-inspectable hits", () => {
    expect(firstSpatialInspectionTarget([
      { userData: { kind: "opening-placeholder", openingId: "door" } },
      { userData: { kind: "wall", wallId: "wall-behind-door" } },
      { userData: { kind: "floor", roomId: "room-behind-wall" } },
    ])).toEqual({ kind: "wall", id: "wall-behind-door" });

    expect(firstSpatialInspectionTarget([
      { userData: { kind: "opening-placeholder", openingId: "door" } },
      { userData: {} },
    ])).toBeNull();
  });
});

describe("buildSpatialInspectionDetails", () => {
  it("derives room area and clear dimensions from authoritative geometry", () => {
    const details = buildSpatialInspectionDetails(document, scene, { kind: "room", id: roomId });

    expect(details).toMatchObject({ kind: "room", id: roomId, areaMm2: 11_715_000, areaM2: 11.715 });
    if (!details || details.kind !== "room") throw new Error("Expected room details");
    expect(details.clearWidthMm).toBe(3550);
    expect(details.clearLengthMm).toBe(3300);
  });

  it("derives wall centreline length, thickness and visible segment count", () => {
    const details = buildSpatialInspectionDetails(document, scene, { kind: "wall", id: "w1" });

    expect(details).toEqual(expect.objectContaining({
      kind: "wall",
      id: "w1",
      lengthMm: 3650,
      thicknessMm: 100,
      visibleSegmentCount: 1,
    }));
  });

  it("reuses deterministic fit evaluation for placed objects", () => {
    const details = buildSpatialInspectionDetails(document, scene, { kind: "placed-object", id: "sofa" });

    expect(details).toEqual(expect.objectContaining({
      kind: "placed-object",
      id: "sofa",
      name: "Диван",
      widthMm: 500,
      depthMm: 500,
      heightMm: 850,
      heightWasDefaulted: false,
      fitStatus: "fits",
      diagnostics: [],
    }));
  });

  it("fails closed when semantic ids are stale", () => {
    expect(buildSpatialInspectionDetails(document, scene, { kind: "wall", id: "missing" })).toBeNull();
    expect(buildSpatialInspectionDetails(document, scene, { kind: "room", id: "missing" })).toBeNull();
    expect(buildSpatialInspectionDetails(document, scene, { kind: "placed-object", id: "missing" })).toBeNull();
  });
});

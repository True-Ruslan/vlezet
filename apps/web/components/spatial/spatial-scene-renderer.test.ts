import { describe, expect, it } from "vitest";
import type { SpatialScene } from "@vlezet/spatial";
import * as THREE from "three";
import { buildSpatialSceneGroup, disposeObject3DResources } from "./spatial-scene-renderer";

const scene: SpatialScene = {
  wallSegments: [{
    id: "wall:0",
    wallId: "wall",
    startOffsetMm: 0,
    endOffsetMm: 3550,
    center: { x: 1775, y: 1350, z: 0 },
    lengthMm: 3550,
    thicknessMm: 100,
    heightMm: 2700,
    rotationYRad: 0,
  }],
  openingMarkers: [{
    id: "opening:door",
    openingId: "door",
    wallId: "wall",
    kind: "door",
    center: { x: 950, y: 1350, z: 0 },
    widthMm: 900,
    wallHeightMm: 2700,
    rotationYRad: 0,
  }],
  floors: [{
    id: "floor:room",
    roomId: "room",
    polygon: [
      { x: 50, y: 0, z: 50 },
      { x: 3600, y: 0, z: 50 },
      { x: 3600, y: 0, z: 3350 },
      { x: 50, y: 0, z: 3350 },
    ],
  }],
};

describe("buildSpatialSceneGroup", () => {
  it("maps neutral wall dimensions exactly into a Three.js box", () => {
    const resources = buildSpatialSceneGroup(scene);
    const wall = resources.group.children.find((child) => child.userData.kind === "wall") as THREE.Mesh<THREE.BoxGeometry>;

    expect(wall).toBeDefined();
    expect(wall.position.toArray()).toEqual([1775, 1350, 0]);
    expect(wall.geometry.parameters.width).toBe(3550);
    expect(wall.geometry.parameters.height).toBe(2700);
    expect(wall.geometry.parameters.depth).toBe(100);
    expect(wall.userData.wallId).toBe("wall");

    resources.dispose();
  });

  it("keeps opening placeholders explicitly schematic and semantically identifiable", () => {
    const resources = buildSpatialSceneGroup(scene);
    const marker = resources.group.children.find((child) => child.userData.kind === "opening-placeholder") as THREE.Mesh<THREE.BoxGeometry>;

    expect(marker.geometry.parameters.width).toBe(900);
    expect(marker.userData.openingId).toBe("door");
    expect(marker.userData.openingKind).toBe("door");

    resources.dispose();
  });

  it("creates floors from neutral room polygons without persisted geometry", () => {
    const resources = buildSpatialSceneGroup(scene);
    const floor = resources.group.children.find((child) => child.userData.kind === "floor") as THREE.Mesh;

    expect(floor).toBeDefined();
    expect(floor.userData.roomId).toBe("room");

    resources.dispose();
  });

  it("disposes geometry and materials owned by renderer helper objects", () => {
    const helper = new THREE.GridHelper(1000, 10);
    let geometryDisposed = false;
    let materialDisposeCount = 0;
    const materials = Array.isArray(helper.material) ? helper.material : [helper.material];

    helper.geometry.addEventListener("dispose", () => { geometryDisposed = true; });
    for (const material of materials) {
      material.addEventListener("dispose", () => { materialDisposeCount += 1; });
    }

    disposeObject3DResources(helper);

    expect(geometryDisposed).toBe(true);
    expect(materialDisposeCount).toBe(materials.length);
  });
});

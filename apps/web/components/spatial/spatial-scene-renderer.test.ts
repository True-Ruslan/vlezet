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
  }, {
    id: "wall:1",
    wallId: "wall",
    startOffsetMm: 3550,
    endOffsetMm: 4050,
    center: { x: 3800, y: 1350, z: 0 },
    lengthMm: 500,
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
  objects: [{
    id: "object:sofa-1",
    objectId: "sofa-1",
    name: "Диван",
    category: "seating",
    center: { x: 1800, y: 425, z: 1200 },
    widthMm: 2200,
    depthMm: 900,
    heightMm: 850,
    rotationYRad: -Math.PI / 2,
    heightWasDefaulted: false,
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

  it("renders spatial objects as exact generic box primitives with semantic identity", () => {
    const resources = buildSpatialSceneGroup(scene);
    const object = resources.group.children.find(
      (child) => child.userData.kind === "placed-object",
    ) as THREE.Mesh<THREE.BoxGeometry>;

    expect(object).toBeDefined();
    expect(object.geometry.parameters.width).toBe(2200);
    expect(object.geometry.parameters.height).toBe(850);
    expect(object.geometry.parameters.depth).toBe(900);
    expect(object.position.toArray()).toEqual([1800, 425, 1200]);
    expect(object.rotation.y).toBeCloseTo(-Math.PI / 2, 12);
    expect(object.userData).toEqual(expect.objectContaining({
      kind: "placed-object",
      objectId: "sofa-1",
      name: "Диван",
      category: "seating",
      heightWasDefaulted: false,
    }));

    resources.dispose();
  });

  it("temporarily emphasizes every mesh for one semantic target and restores shared base materials", () => {
    const resources = buildSpatialSceneGroup(scene);
    const walls = resources.group.children.filter((child) => child.userData.kind === "wall") as THREE.Mesh[];
    const object = resources.group.children.find((child) => child.userData.kind === "placed-object") as THREE.Mesh;
    const originalWallMaterials = walls.map((wall) => wall.material);
    const originalObjectMaterial = object.material;

    resources.emphasize({ kind: "wall", id: "wall" }, "selected");

    expect(walls).toHaveLength(2);
    expect(walls[0]!.material).not.toBe(originalWallMaterials[0]);
    expect(walls[1]!.material).not.toBe(originalWallMaterials[1]);
    expect(object.material).toBe(originalObjectMaterial);

    let temporaryMaterialDisposals = 0;
    for (const wall of walls) {
      const materials = Array.isArray(wall.material) ? wall.material : [wall.material];
      for (const material of materials) {
        material.addEventListener("dispose", () => { temporaryMaterialDisposals += 1; });
      }
    }

    resources.emphasize(null, "hover");

    expect(walls[0]!.material).toBe(originalWallMaterials[0]);
    expect(walls[1]!.material).toBe(originalWallMaterials[1]);
    expect(temporaryMaterialDisposals).toBe(2);

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

import type { SpatialScene } from "@vlezet/spatial";
import * as THREE from "three";

export type SpatialRenderResources = Readonly<{
  group: THREE.Group;
  dispose: () => void;
}>;

type ResourceOwningObject3D = THREE.Object3D & Readonly<{
  geometry?: THREE.BufferGeometry;
  material?: THREE.Material | THREE.Material[];
}>;

export function disposeObject3DResources(root: THREE.Object3D): void {
  const geometries = new Set<THREE.BufferGeometry>();
  const materials = new Set<THREE.Material>();

  root.traverse((object) => {
    const resourceOwner = object as ResourceOwningObject3D;
    if (resourceOwner.geometry) geometries.add(resourceOwner.geometry);
    if (resourceOwner.material) {
      const ownedMaterials = Array.isArray(resourceOwner.material) ? resourceOwner.material : [resourceOwner.material];
      for (const material of ownedMaterials) materials.add(material);
    }
  });

  root.removeFromParent();
  for (const geometry of geometries) geometry.dispose();
  for (const material of materials) material.dispose();
  root.clear();
}

function wallMesh(segment: SpatialScene["wallSegments"][number], material: THREE.Material): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(segment.lengthMm, segment.heightMm, segment.thicknessMm);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(segment.center.x, segment.center.y, segment.center.z);
  mesh.rotation.y = segment.rotationYRad;
  mesh.userData = { kind: "wall", wallId: segment.wallId, segmentId: segment.id };
  return mesh;
}

function openingMarkerMesh(
  marker: SpatialScene["openingMarkers"][number],
  material: THREE.Material,
): THREE.Mesh {
  const depthMm = Math.max(16, marker.wallHeightMm * 0.008);
  const geometry = new THREE.BoxGeometry(marker.widthMm, marker.wallHeightMm, depthMm);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(marker.center.x, marker.center.y, marker.center.z);
  mesh.rotation.y = marker.rotationYRad;
  mesh.userData = {
    kind: "opening-placeholder",
    openingId: marker.openingId,
    wallId: marker.wallId,
    openingKind: marker.kind,
  };
  return mesh;
}

function floorMesh(floor: SpatialScene["floors"][number], material: THREE.Material): THREE.Mesh | null {
  const first = floor.polygon[0];
  if (!first || floor.polygon.length < 3) return null;
  const shape = new THREE.Shape();
  shape.moveTo(first.x, first.z);
  for (const point of floor.polygon.slice(1)) shape.lineTo(point.x, point.z);
  shape.closePath();
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = 0;
  mesh.userData = { kind: "floor", roomId: floor.roomId, floorId: floor.id };
  return mesh;
}

function objectMesh(
  object: SpatialScene["objects"][number],
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BoxGeometry(object.widthMm, object.heightMm, object.depthMm);
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(object.center.x, object.center.y, object.center.z);
  mesh.rotation.y = object.rotationYRad;
  mesh.userData = {
    kind: "placed-object",
    objectId: object.objectId,
    spatialObjectId: object.id,
    name: object.name,
    category: object.category,
    heightWasDefaulted: object.heightWasDefaulted,
  };
  return mesh;
}

export function buildSpatialSceneGroup(scene: SpatialScene): SpatialRenderResources {
  const group = new THREE.Group();
  group.name = "vlezet-spatial-scene";

  const wallMaterial = new THREE.MeshStandardMaterial({ color: 0xd8dde5, roughness: 0.86, metalness: 0 });
  const floorMaterial = new THREE.MeshStandardMaterial({
    color: 0xf1f4f8,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const objectMaterial = new THREE.MeshStandardMaterial({
    color: 0xb9a58f,
    roughness: 0.9,
    metalness: 0,
  });
  const doorMaterial = new THREE.MeshBasicMaterial({
    color: 0x1769ff,
    wireframe: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const windowMaterial = new THREE.MeshBasicMaterial({
    color: 0x0ea5a8,
    wireframe: true,
    transparent: true,
    opacity: 0.38,
    depthWrite: false,
  });
  const materials = [wallMaterial, floorMaterial, objectMaterial, doorMaterial, windowMaterial];
  const geometries: THREE.BufferGeometry[] = [];

  for (const floor of scene.floors) {
    const mesh = floorMesh(floor, floorMaterial);
    if (!mesh) continue;
    geometries.push(mesh.geometry);
    group.add(mesh);
  }

  for (const object of scene.objects) {
    const mesh = objectMesh(object, objectMaterial);
    geometries.push(mesh.geometry);
    group.add(mesh);
  }

  for (const segment of scene.wallSegments) {
    const mesh = wallMesh(segment, wallMaterial);
    geometries.push(mesh.geometry);
    group.add(mesh);
  }

  for (const marker of scene.openingMarkers) {
    const mesh = openingMarkerMesh(marker, marker.kind === "door" ? doorMaterial : windowMaterial);
    geometries.push(mesh.geometry);
    group.add(mesh);
  }

  return {
    group,
    dispose: () => {
      group.removeFromParent();
      for (const geometry of geometries) geometry.dispose();
      for (const material of materials) material.dispose();
      group.clear();
    },
  };
}

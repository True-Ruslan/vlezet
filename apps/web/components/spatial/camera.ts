export type SpatialCameraPreset = "perspective" | "isometric" | "top";

export type Bounds3 = Readonly<{
  min: Readonly<{ x: number; y: number; z: number }>;
  max: Readonly<{ x: number; y: number; z: number }>;
}>;

export type CameraPlacement = Readonly<{
  target: Readonly<{ x: number; y: number; z: number }>;
  position: Readonly<{ x: number; y: number; z: number }>;
  near: number;
  far: number;
}>;

function normalize(x: number, y: number, z: number) {
  const length = Math.hypot(x, y, z) || 1;
  return { x: x / length, y: y / length, z: z / length };
}

function directionForPreset(preset: SpatialCameraPreset) {
  if (preset === "top") return normalize(0, 1, 0.0001);
  if (preset === "isometric") return normalize(1, 1, 1);
  return normalize(1.25, 0.82, 1.25);
}

export function deriveCameraPlacement(
  bounds: Bounds3,
  preset: SpatialCameraPreset,
  aspect: number,
  verticalFovDeg = 45,
): CameraPlacement {
  const size = {
    x: Math.max(0, bounds.max.x - bounds.min.x),
    y: Math.max(0, bounds.max.y - bounds.min.y),
    z: Math.max(0, bounds.max.z - bounds.min.z),
  };
  const target = {
    x: (bounds.min.x + bounds.max.x) / 2,
    y: (bounds.min.y + bounds.max.y) / 2,
    z: (bounds.min.z + bounds.max.z) / 2,
  };
  const safeAspect = Number.isFinite(aspect) && aspect > 0 ? aspect : 1;
  const verticalFovRad = (verticalFovDeg * Math.PI) / 180;
  const horizontalFovRad = 2 * Math.atan(Math.tan(verticalFovRad / 2) * safeAspect);
  const horizontalSpan = Math.max(size.x, size.z);
  const distanceForWidth = horizontalSpan / Math.max(2 * Math.tan(horizontalFovRad / 2), 0.01);
  const distanceForHeight = Math.max(size.y, horizontalSpan * 0.35) / Math.max(2 * Math.tan(verticalFovRad / 2), 0.01);
  const radius = Math.hypot(size.x, size.y, size.z) / 2;
  const distance = Math.max(1000, distanceForWidth, distanceForHeight, radius * 1.8) * 1.18;
  const direction = directionForPreset(preset);

  return {
    target,
    position: {
      x: target.x + direction.x * distance,
      y: target.y + direction.y * distance,
      z: target.z + direction.z * distance,
    },
    near: Math.max(1, distance / 2000),
    far: Math.max(20_000, distance * 12, radius * 24),
  };
}

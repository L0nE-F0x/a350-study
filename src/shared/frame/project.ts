import type { BBox, CameraState, Vec3 } from "../types/index.ts";

export type OrthoPreset = "plan" | "side" | "front" | "three-quarter";

/**
 * Authority for orthographic NDC. x is right, y is up, range [-1, 1].
 * Side, plan, and front use the algebraic screen mapping. Three-quarter uses the
 * specified camera offset and a right-handed view basis (up +Z).
 */
export function projectOrtho(
  point: Vec3,
  preset: OrthoPreset,
  target: Vec3,
  halfHeight: number,
  aspect: number,
): { x: number; y: number } {
  const dx = point.x - target.x;
  const dy = point.y - target.y;
  const dz = point.z - target.z;
  const denomX = halfHeight * aspect;
  switch (preset) {
    case "side":
      return { x: dx / denomX, y: dz / halfHeight };
    case "plan":
      return { x: dy / denomX, y: -dx / halfHeight };
    case "front":
      return { x: -dy / denomX, y: dz / halfHeight };
    case "three-quarter":
      return projectAlongBasis(dx, dy, dz, threeQuarterBasis(), halfHeight, aspect);
    default: {
      const _never: never = preset;
      return _never;
    }
  }
}

export function fitOrtho(
  bbox: BBox,
  aspect: number,
  margin = 1.15,
  preset: OrthoPreset = "side",
): { halfHeight: number; target: Vec3 } {
  const target: Vec3 = {
    x: (bbox.min.x + bbox.max.x) / 2,
    y: (bbox.min.y + bbox.max.y) / 2,
    z: (bbox.min.z + bbox.max.z) / 2,
  };
  const xs = [bbox.min.x, bbox.max.x];
  const ys = [bbox.min.y, bbox.max.y];
  const zs = [bbox.min.z, bbox.max.z];
  let maxAbs = 1e-8;
  for (const x of xs) {
    for (const y of ys) {
      for (const z of zs) {
        const p = projectOrtho({ x, y, z }, preset, target, 1, aspect);
        maxAbs = Math.max(maxAbs, Math.abs(p.x), Math.abs(p.y));
      }
    }
  }
  return { halfHeight: maxAbs * margin, target };
}

/** paneWidth and paneHeight are the canvas element's client size in CSS pixels. Origin is the pane's top left. */
export function ndcToPanePixel(
  ndcX: number,
  ndcY: number,
  paneWidth: number,
  paneHeight: number,
): { x: number; y: number } {
  return {
    x: ((ndcX + 1) / 2) * paneWidth,
    y: ((1 - ndcY) / 2) * paneHeight,
  };
}

/** Projection used by DOM labels, including orbit. Inspect uses the same directions with a 35° vertical FOV. */
export function projectView(
  point: Vec3,
  camera: CameraState,
  aspect: number,
): { x: number; y: number } {
  const target = camera.orbit.target;
  const halfHeight = camera.orbit.orthoHalfHeight;
  if (camera.preset !== "orbit") {
    if (camera.mode === "inspect") {
      return projectPerspective(point, presetBasis(camera.preset), target, camera.orbit, aspect);
    }
    return projectOrtho(point, camera.preset, target, halfHeight, aspect);
  }
  const basis = orbitBasis(camera.orbit.azimuthRad, camera.orbit.elevationRad);
  if (camera.mode === "inspect") {
    return projectPerspective(point, basis, target, camera.orbit, aspect);
  }
  const dx = point.x - target.x;
  const dy = point.y - target.y;
  const dz = point.z - target.z;
  return projectAlongBasis(dx, dy, dz, basis, halfHeight, aspect);
}

export interface ViewBasis {
  right: Vec3;
  up: Vec3;
  /** Unit vector from target toward the camera. */
  backward: Vec3;
}

export function presetBasis(preset: OrthoPreset): ViewBasis {
  if (preset === "three-quarter") return threeQuarterBasis();
  if (preset === "side") {
    return {
      right: { x: 1, y: 0, z: 0 },
      up: { x: 0, y: 0, z: 1 },
      backward: { x: 0, y: -1, z: 0 },
    };
  }
  if (preset === "plan") {
    return {
      right: { x: 0, y: 1, z: 0 },
      up: { x: -1, y: 0, z: 0 },
      backward: { x: 0, y: 0, z: 1 },
    };
  }
  return {
    right: { x: 0, y: -1, z: 0 },
    up: { x: 0, y: 0, z: 1 },
    backward: { x: -1, y: 0, z: 0 },
  };
}

/** Azimuth 0, elevation 0 matches the side preset (camera on −Y). */
export function orbitBasis(azimuthRad: number, elevationRad: number): ViewBasis {
  const ce = Math.cos(elevationRad);
  const se = Math.sin(elevationRad);
  const backward = normalize({
    x: ce * Math.sin(azimuthRad),
    y: -ce * Math.cos(azimuthRad),
    z: se,
  });
  return basisFromBackward(backward);
}

export function anglesForPreset(preset: OrthoPreset): { azimuthRad: number; elevationRad: number } {
  if (preset === "side") return { azimuthRad: 0, elevationRad: 0 };
  if (preset === "front") return { azimuthRad: -Math.PI / 2, elevationRad: 0 };
  if (preset === "plan") return { azimuthRad: 0, elevationRad: Math.PI / 2 - 1e-3 };
  const b = normalize({ x: -1, y: 1, z: 0.6 });
  const elevationRad = Math.asin(clamp(b.z, -1, 1));
  const azimuthRad = Math.atan2(b.x, -b.y);
  return { azimuthRad, elevationRad };
}

function projectPerspective(
  point: Vec3,
  basis: ViewBasis,
  target: Vec3,
  orbit: CameraState["orbit"],
  aspect: number,
): { x: number; y: number } {
  const fov = (35 * Math.PI) / 180;
  const distance = orbit.orthoHalfHeight / Math.tan(fov / 2);
  const eye = {
    x: target.x + basis.backward.x * distance,
    y: target.y + basis.backward.y * distance,
    z: target.z + basis.backward.z * distance,
  };
  const rx = point.x - eye.x;
  const ry = point.y - eye.y;
  const rz = point.z - eye.z;
  const camX = rx * basis.right.x + ry * basis.right.y + rz * basis.right.z;
  const camY = rx * basis.up.x + ry * basis.up.y + rz * basis.up.z;
  const ahead = -(rx * basis.backward.x + ry * basis.backward.y + rz * basis.backward.z);
  const safe = Math.max(ahead, 1e-4);
  const tan = Math.tan(fov / 2);
  return { x: camX / (safe * tan * aspect), y: camY / (safe * tan) };
}

function threeQuarterBasis(): ViewBasis {
  return basisFromBackward(normalize({ x: -1, y: 1, z: 0.6 }));
}

function basisFromBackward(backward: Vec3): ViewBasis {
  const upHint: Vec3 = { x: 0, y: 0, z: 1 };
  let right = cross(upHint, backward);
  if (Math.hypot(right.x, right.y, right.z) < 1e-6) {
    right = cross({ x: 0, y: 1, z: 0 }, backward);
  }
  right = normalize(right);
  const up = cross(backward, right);
  return { right, up, backward };
}

function projectAlongBasis(
  dx: number,
  dy: number,
  dz: number,
  basis: ViewBasis,
  halfHeight: number,
  aspect: number,
): { x: number; y: number } {
  const camX = dx * basis.right.x + dy * basis.right.y + dz * basis.right.z;
  const camY = dx * basis.up.x + dy * basis.up.y + dz * basis.up.z;
  return { x: camX / (halfHeight * aspect), y: camY / halfHeight };
}

function cross(a: Vec3, b: Vec3): Vec3 {
  return {
    x: a.y * b.z - a.z * b.y,
    y: a.z * b.x - a.x * b.z,
    z: a.x * b.y - a.y * b.x,
  };
}

function normalize(v: Vec3): Vec3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}

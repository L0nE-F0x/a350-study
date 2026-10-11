import * as THREE from "three";
import { orbitBasis, presetBasis, type OrthoPreset, type ViewBasis } from "../shared/frame/index.ts";
import type { CameraState, Vec3 } from "../shared/types/index.ts";

const ORTHO_DISTANCE = 400;

export function applyBasis(camera: THREE.Camera, basis: ViewBasis, target: Vec3, distance: number): void {
  camera.up.set(basis.up.x, basis.up.y, basis.up.z);
  camera.position.set(
    target.x + basis.backward.x * distance,
    target.y + basis.backward.y * distance,
    target.z + basis.backward.z * distance,
  );
  camera.lookAt(target.x, target.y, target.z);
  camera.updateMatrixWorld(true);
}

export function syncOrthoCamera(
  camera: THREE.OrthographicCamera,
  preset: OrthoPreset | "orbit",
  target: Vec3,
  halfHeight: number,
  aspect: number,
  azimuthRad = 0,
  elevationRad = 0,
): void {
  const basis = preset === "orbit" ? orbitBasis(azimuthRad, elevationRad) : presetBasis(preset);
  const hh = Math.max(halfHeight, 1e-4);
  const halfWidth = hh * Math.max(aspect, 1e-4);
  camera.left = -halfWidth;
  camera.right = halfWidth;
  camera.top = hh;
  camera.bottom = -hh;
  camera.near = 0.01;
  camera.far = 20000;
  camera.updateProjectionMatrix();
  applyBasis(camera, basis, target, ORTHO_DISTANCE);
}

export function syncInspectCamera(
  camera: THREE.PerspectiveCamera,
  state: CameraState,
  aspect: number,
): void {
  const basis =
    state.preset === "orbit"
      ? orbitBasis(state.orbit.azimuthRad, state.orbit.elevationRad)
      : presetBasis(state.preset);
  const fov = 35;
  camera.fov = fov;
  camera.aspect = Math.max(aspect, 1e-4);
  camera.near = 0.01;
  camera.far = 20000;
  camera.updateProjectionMatrix();
  const distance = state.orbit.orthoHalfHeight / Math.tan(((fov * Math.PI) / 180) / 2);
  applyBasis(camera, basis, state.orbit.target, Math.max(distance, 1));
}

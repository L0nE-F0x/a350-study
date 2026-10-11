import * as THREE from "three";
import type { BBox, ClipAxis, Vec3 } from "../shared/types/index.ts";

export function unionBBox(a: BBox, b: BBox): BBox {
  return {
    min: {
      x: Math.min(a.min.x, b.min.x),
      y: Math.min(a.min.y, b.min.y),
      z: Math.min(a.min.z, b.min.z),
    },
    max: {
      x: Math.max(a.max.x, b.max.x),
      y: Math.max(a.max.y, b.max.y),
      z: Math.max(a.max.z, b.max.z),
    },
  };
}

export function clipStation(bbox: BBox, axis: Exclude<ClipAxis, "none">, t: number): number {
  const min = bbox.min[axis];
  const max = bbox.max[axis];
  return min + t * (max - min);
}

/**
 * Keep the half-space whose coordinate is <= the station.
 * Three r170 discards a fragment when dot(-viewPosition, plane) is positive.
 * A world normal of +axis kept the greater coordinate in that test, so the
 * normal points toward -axis and the greater coordinate is the one removed.
 */
export function clipPlane(bbox: BBox, axis: Exclude<ClipAxis, "none">, t: number): THREE.Plane {
  const station = clipStation(bbox, axis, t);
  const normal = new THREE.Vector3(axis === "x" ? -1 : 0, axis === "y" ? -1 : 0, axis === "z" ? -1 : 0);
  const point = new THREE.Vector3(axis === "x" ? station : 0, axis === "y" ? station : 0, axis === "z" ? station : 0);
  return new THREE.Plane().setFromNormalAndCoplanarPoint(normal, point);
}

export function writeClipPlane(plane: THREE.Plane, bbox: BBox, axis: Exclude<ClipAxis, "none">, t: number): void {
  const next = clipPlane(bbox, axis, t);
  plane.normal.copy(next.normal);
  plane.constant = next.constant;
}

export function hatchCorners(bbox: BBox, axis: Exclude<ClipAxis, "none">, t: number): [Vec3, Vec3, Vec3, Vec3] {
  const s = clipStation(bbox, axis, t);
  const { min, max } = bbox;
  if (axis === "x") {
    return [
      { x: s, y: min.y, z: min.z },
      { x: s, y: max.y, z: min.z },
      { x: s, y: max.y, z: max.z },
      { x: s, y: min.y, z: max.z },
    ];
  }
  if (axis === "y") {
    return [
      { x: min.x, y: s, z: min.z },
      { x: max.x, y: s, z: min.z },
      { x: max.x, y: s, z: max.z },
      { x: min.x, y: s, z: max.z },
    ];
  }
  return [
    { x: min.x, y: min.y, z: s },
    { x: max.x, y: min.y, z: s },
    { x: max.x, y: max.y, z: s },
    { x: min.x, y: max.y, z: s },
  ];
}

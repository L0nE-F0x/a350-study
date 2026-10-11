import * as THREE from "three";

export interface PartIntersection extends THREE.Intersection {
  partId?: string;
}

interface PickData {
  partIds?: string[];
  partIdByTriangle?: ArrayLike<number>;
  partIdByStartVertex?: ArrayLike<number>;
  partPickable?: ArrayLike<number>;
}

export const UNKNOWN_PART = 65535;

function geometryOf(object: THREE.Object3D): THREE.BufferGeometry | null {
  if (object instanceof THREE.Mesh || object instanceof THREE.Line) return object.geometry;
  return null;
}

function readAt(list: ArrayLike<number> | undefined, index: number): number | undefined {
  if (!list || index < 0 || index >= list.length) return undefined;
  const value = list[index];
  return value === undefined ? undefined : value;
}

function resolvePartId(object: THREE.Object3D, hit: THREE.Intersection): string | null {
  const data = geometryOf(object)?.userData as PickData | undefined;
  const explicit = object.userData.partId;
  const fallback = typeof explicit === "string" ? explicit : null;
  if (!data?.partIds) return fallback;

  let partIndex: number | undefined;
  if (typeof hit.instanceId === "number") partIndex = hit.instanceId;
  else if (typeof hit.faceIndex === "number") partIndex = readAt(data.partIdByTriangle, hit.faceIndex);
  else if (typeof hit.index === "number") partIndex = readAt(data.partIdByStartVertex, hit.index);

  if (partIndex === undefined || partIndex === UNKNOWN_PART) return fallback;
  const pickable = readAt(data.partPickable, partIndex);
  if (pickable === 0) return null;
  const id = data.partIds[partIndex];
  return id ?? fallback;
}

function tagHits(object: THREE.Object3D, intersects: THREE.Intersection[], start: number): void {
  for (let i = start; i < intersects.length; i += 1) {
    const hit = intersects[i];
    if (!hit) continue;
    const partId = resolvePartId(object, hit);
    if (partId) (hit as PartIntersection).partId = partId;
  }
}

function armLineThreshold(raycaster: THREE.Raycaster): void {
  const line = raycaster.params.Line;
  if (line) line.threshold = 0.18;
  else raycaster.params.Line = { threshold: 0.18 };
}

/** Replace raycast so each hit carries the logical part id. Line picking uses a 0.18 world threshold. */
export function applyPartRaycast(object: THREE.Object3D): void {
  if (object instanceof THREE.InstancedMesh) {
    object.raycast = function (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
      armLineThreshold(raycaster);
      const start = intersects.length;
      THREE.InstancedMesh.prototype.raycast.call(this, raycaster, intersects);
      tagHits(this, intersects, start);
    };
    return;
  }
  if (object instanceof THREE.LineSegments) {
    object.raycast = function (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
      armLineThreshold(raycaster);
      const start = intersects.length;
      THREE.LineSegments.prototype.raycast.call(this, raycaster, intersects);
      tagHits(this, intersects, start);
    };
    return;
  }
  if (object instanceof THREE.Mesh) {
    object.raycast = function (raycaster: THREE.Raycaster, intersects: THREE.Intersection[]) {
      const start = intersects.length;
      THREE.Mesh.prototype.raycast.call(this, raycaster, intersects);
      tagHits(this, intersects, start);
    };
  }
}

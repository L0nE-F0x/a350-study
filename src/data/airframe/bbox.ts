import type { Assembly, BBox, ClipAxis, Part } from "../../shared/types/index.ts";

export function worldBBox(part: Part): BBox {
  const p = part.assembled.position;
  return {
    min: {
      x: part.bboxLocal.min.x + p.x,
      y: part.bboxLocal.min.y + p.y,
      z: part.bboxLocal.min.z + p.z,
    },
    max: {
      x: part.bboxLocal.max.x + p.x,
      y: part.bboxLocal.max.y + p.y,
      z: part.bboxLocal.max.z + p.z,
    },
  };
}

export function unionParts(parts: Part[]): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  for (const part of parts) {
    const box = worldBBox(part);
    minX = Math.min(minX, box.min.x);
    minY = Math.min(minY, box.min.y);
    minZ = Math.min(minZ, box.min.z);
    maxX = Math.max(maxX, box.max.x);
    maxY = Math.max(maxY, box.max.y);
    maxZ = Math.max(maxZ, box.max.z);
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

export function wheelContactZ(parts: Part[]): number {
  let z = Infinity;
  for (const part of parts) {
    if (!part.id.startsWith("gear.") || !part.name.toLowerCase().includes("wheel")) continue;
    z = Math.min(z, worldBBox(part).min.z);
  }
  if (!Number.isFinite(z)) throw new Error("No gear wheel");
  return z;
}

export function measure(parts: Part[]): Assembly["measures"] {
  const box = unionParts(parts);
  const left = parts.find((part) => part.id === "gear.main.left");
  const right = parts.find((part) => part.id === "gear.main.right");
  const nose = parts.find((part) => part.id === "gear.axle.nose");
  const mains = parts.filter((part) => part.id.startsWith("gear.axle.main."));
  if (!left || !right || !nose || mains.length === 0) throw new Error("Gear centroids missing");
  const meanMainX = mains.reduce((sum, part) => sum + part.assembled.position.x, 0) / mains.length;
  return {
    lengthM: box.max.x - box.min.x,
    spanM: box.max.y - box.min.y,
    heightM: box.max.z - wheelContactZ(parts),
    trackM: Math.abs(left.assembled.position.y - right.assembled.position.y),
    wheelbaseM: Math.abs(nose.assembled.position.x - meanMainX),
  };
}

export function seal(variantId: Assembly["variantId"], parts: Part[]): Assembly {
  return {
    variantId,
    parts,
    bbox: unionParts(parts),
    wheelContactZ: wheelContactZ(parts),
    measures: measure(parts),
  };
}

export function constantSectionWidth(assembly: Assembly): number {
  const part = assembly.parts.find((item) => item.id === "fuse.body.fwd");
  const positions = part?.mesh?.positions;
  if (!part || !positions) throw new Error("Forward fuselage missing");
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.length; i += 3) {
    const y = (positions[i + 1] ?? 0) + part.assembled.position.y;
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  return maxY - minY;
}

export function tipX(assembly: Assembly, id: "fuse.nose" | "fuse.tail"): number {
  const part = assembly.parts.find((item) => item.id === id);
  if (!part) throw new Error(id);
  const box = worldBBox(part);
  return id === "fuse.nose" ? box.min.x : box.max.x;
}

export function estimateTriangles(assembly: Assembly): number {
  let count = 0;
  for (const part of assembly.parts) {
    if (part.mesh) count += part.mesh.indices.length / 3;
    if (part.instances) count += part.instances.count * (part.instances.mesh.indices.length / 3);
  }
  return count;
}

export function estimateDrawCalls(assemblies: Assembly[], clipAxis: ClipAxis): number {
  return assemblies.length * 24 + (clipAxis === "none" ? 0 : 1);
}

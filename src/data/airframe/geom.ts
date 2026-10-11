import type { BBox, DiffTag, LayerId, LineData, MeshData, Part, Vec3 } from "../../shared/types/index.ts";

export type VariantId = "a350-900" | "a350-1000";

interface Raw {
  positions: number[];
  indices: number[];
  glow: number[];
}

export function rawMesh(): Raw {
  return { positions: [], indices: [], glow: [] };
}

function num(arr: number[], index: number): number {
  const value = arr[index];
  if (value === undefined) throw new Error(`Missing component ${index}`);
  return value;
}

export function addVertex(raw: Raw, x: number, y: number, z: number): number {
  const index = raw.positions.length / 3;
  raw.positions.push(x, y, z);
  raw.glow.push(0);
  return index;
}

export function paintGlow(raw: Raw, index: number, value: number): void {
  if (index >= 0 && index < raw.glow.length) raw.glow[index] = value;
}

export function paintLast(raw: Raw, count: number, value: number): void {
  const start = Math.max(0, raw.glow.length - count);
  for (let i = start; i < raw.glow.length; i += 1) raw.glow[i] = value;
}

export function addTri(raw: Raw, a: number, b: number, c: number): void {
  raw.indices.push(a, b, c);
}

export function finalize(raw: Raw): MeshData {
  const normals = new Float32Array(raw.positions.length);
  for (let i = 0; i < raw.indices.length; i += 3) {
    const ia = num(raw.indices, i) * 3;
    const ib = num(raw.indices, i + 1) * 3;
    const ic = num(raw.indices, i + 2) * 3;
    const ax = num(raw.positions, ia);
    const ay = num(raw.positions, ia + 1);
    const az = num(raw.positions, ia + 2);
    const bx = num(raw.positions, ib) - ax;
    const by = num(raw.positions, ib + 1) - ay;
    const bz = num(raw.positions, ib + 2) - az;
    const cx = num(raw.positions, ic) - ax;
    const cy = num(raw.positions, ic + 1) - ay;
    const cz = num(raw.positions, ic + 2) - az;
    const nx = by * cz - bz * cy;
    const ny = bz * cx - bx * cz;
    const nz = bx * cy - by * cx;
    for (const base of [ia, ib, ic]) {
      normals[base] = (normals[base] ?? 0) + nx;
      normals[base + 1] = (normals[base + 1] ?? 0) + ny;
      normals[base + 2] = (normals[base + 2] ?? 0) + nz;
    }
  }
  for (let i = 0; i < normals.length; i += 3) {
    const x = normals[i] ?? 0;
    const y = normals[i + 1] ?? 0;
    const z = normals[i + 2] ?? 0;
    const len = Math.hypot(x, y, z) || 1;
    normals[i] = x / len;
    normals[i + 1] = y / len;
    normals[i + 2] = z / len;
  }
  let glow: Float32Array | undefined;
  for (const value of raw.glow) {
    if (value > 0) {
      glow = Float32Array.from(raw.glow);
      break;
    }
  }
  return {
    positions: Float32Array.from(raw.positions),
    indices: Uint32Array.from(raw.indices),
    normals,
    glow,
  };
}

export function finalizeLines(positions: number[]): LineData {
  return { positions: Float32Array.from(positions) };
}

export function bboxOf(mesh?: MeshData, lines?: LineData): BBox {
  let minX = Infinity;
  let minY = Infinity;
  let minZ = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;
  let maxZ = -Infinity;
  const scan = (src: Float32Array | undefined) => {
    if (!src) return;
    for (let i = 0; i < src.length; i += 3) {
      const x = src[i] ?? 0;
      const y = src[i + 1] ?? 0;
      const z = src[i + 2] ?? 0;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      minZ = Math.min(minZ, z);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
      maxZ = Math.max(maxZ, z);
    }
  };
  scan(mesh?.positions);
  scan(lines?.positions);
  if (!Number.isFinite(minX)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }
  return {
    min: { x: minX, y: minY, z: minZ },
    max: { x: maxX, y: maxY, z: maxZ },
  };
}

export function makePart(
  variantId: VariantId,
  fields: {
    id: string;
    layerId: LayerId;
    explodeGroup: string;
    name: string;
    position: Vec3;
    mesh?: MeshData;
    lines?: LineData;
    quantityIds: string[];
    diffTag: DiffTag;
    hinge?: Part["hinge"];
  },
): Part {
  return {
    id: fields.id,
    variantId,
    layerId: fields.layerId,
    explodeGroup: fields.explodeGroup,
    name: fields.name,
    lateralSign: fields.position.y >= 0 ? 1 : -1,
    assembled: { position: fields.position },
    bboxLocal: bboxOf(fields.mesh, fields.lines),
    mesh: fields.mesh,
    lines: fields.lines,
    quantityIds: fields.quantityIds,
    diffTag: fields.diffTag,
    pickable: true,
    hinge: fields.hinge,
  };
}

export function addBox(raw: Raw, cx: number, cy: number, cz: number, sx: number, sy: number, sz: number): void {
  const hx = sx / 2;
  const hy = sy / 2;
  const hz = sz / 2;
  const corners: Array<[number, number, number]> = [
    [cx - hx, cy - hy, cz - hz],
    [cx + hx, cy - hy, cz - hz],
    [cx + hx, cy + hy, cz - hz],
    [cx - hx, cy + hy, cz - hz],
    [cx - hx, cy - hy, cz + hz],
    [cx + hx, cy - hy, cz + hz],
    [cx + hx, cy + hy, cz + hz],
    [cx - hx, cy + hy, cz + hz],
  ];
  const base = raw.positions.length / 3;
  for (const [x, y, z] of corners) addVertex(raw, x, y, z);
  const faces: Array<[number, number, number, number]> = [
    [0, 1, 2, 3],
    [4, 7, 6, 5],
    [0, 4, 5, 1],
    [3, 2, 6, 7],
    [0, 3, 7, 4],
    [1, 5, 6, 2],
  ];
  for (const [a, b, c, d] of faces) {
    addTri(raw, base + a, base + b, base + c);
    addTri(raw, base + a, base + c, base + d);
  }
}

export function boxPart(
  variantId: VariantId,
  fields: Omit<Parameters<typeof makePart>[1], "mesh" | "position"> & { position: Vec3; size: Vec3 },
): Part {
  const raw = rawMesh();
  addBox(raw, 0, 0, 0, fields.size.x, fields.size.y, fields.size.z);
  return makePart(variantId, { ...fields, mesh: finalize(raw) });
}

export function superellipseYZ(theta: number, scale: number, a: number, b: number, n: number, zc: number): { y: number; z: number } {
  if (scale <= 1e-8) return { y: 0, z: zc };
  const c = Math.cos(theta);
  const s = Math.sin(theta);
  const e = 2 / n;
  return {
    y: scale * a * Math.sign(c) * Math.abs(c) ** e,
    z: zc + scale * b * Math.sign(s) * Math.abs(s) ** e,
  };
}

export function appendSection(raw: Raw, xs: number[], scaleAt: (x: number) => number, a: number, b: number, n: number, zc: number, radial: number): void {
  const rings: number[][] = [];
  for (const x of xs) {
    const scale = scaleAt(x);
    const ids: number[] = [];
    if (scale <= 1e-8) {
      ids.push(addVertex(raw, x, 0, zc));
    } else {
      for (let i = 0; i < radial; i += 1) {
        const p = superellipseYZ((i / radial) * Math.PI * 2, scale, a, b, n, zc);
        ids.push(addVertex(raw, x, p.y, p.z));
      }
    }
    rings.push(ids);
  }
  for (let s = 0; s < rings.length - 1; s += 1) {
    const aRing = rings[s];
    const bRing = rings[s + 1];
    if (!aRing || !bRing) continue;
    if (aRing.length === 1 && bRing.length > 1) {
      const tip = aRing[0];
      if (tip === undefined) continue;
      for (let i = 0; i < bRing.length; i += 1) {
        const v0 = bRing[i];
        const v1 = bRing[(i + 1) % bRing.length];
        if (v0 === undefined || v1 === undefined) continue;
        addTri(raw, tip, v1, v0);
      }
      continue;
    }
    if (bRing.length === 1 && aRing.length > 1) {
      const tip = bRing[0];
      if (tip === undefined) continue;
      for (let i = 0; i < aRing.length; i += 1) {
        const v0 = aRing[i];
        const v1 = aRing[(i + 1) % aRing.length];
        if (v0 === undefined || v1 === undefined) continue;
        addTri(raw, tip, v0, v1);
      }
      continue;
    }
    const count = Math.min(aRing.length, bRing.length);
    for (let i = 0; i < count; i += 1) {
      const a0 = aRing[i];
      const a1 = aRing[(i + 1) % count];
      const b0 = bRing[i];
      const b1 = bRing[(i + 1) % count];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      addTri(raw, a0, b0, a1);
      addTri(raw, a1, b0, b1);
    }
  }
}

function stitchRings(raw: Raw, rings: number[][], radial: number): void {
  for (let s = 0; s < rings.length - 1; s += 1) {
    const aRing = rings[s];
    const bRing = rings[s + 1];
    if (!aRing || !bRing) continue;
    for (let i = 0; i < radial; i += 1) {
      const a0 = aRing[i];
      const a1 = aRing[(i + 1) % radial];
      const b0 = bRing[i];
      const b1 = bRing[(i + 1) % radial];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      addTri(raw, a0, b0, a1);
      addTri(raw, a1, b0, b1);
    }
  }
}

/** Revolve (x, radius) stations around +X. Open ends. Winding matches addCylinderX. */
export function addLathe(raw: Raw, stations: ReadonlyArray<readonly [number, number]>, radial = 28): void {
  if (stations.length < 2) return;
  const rings: number[][] = [];
  for (const [x, r] of stations) {
    const ring: number[] = [];
    for (let i = 0; i < radial; i += 1) {
      const t = (i / radial) * Math.PI * 2;
      ring.push(addVertex(raw, x, Math.cos(t) * r, Math.sin(t) * r));
    }
    rings.push(ring);
  }
  stitchRings(raw, rings, radial);
}

function rodFrame(a: Vec3, b: Vec3): { tx: number; ty: number; tz: number; rx: number; ry: number; rz: number; ux: number; uy: number; uz: number } {
  let tx = b.x - a.x;
  let ty = b.y - a.y;
  let tz = b.z - a.z;
  const len = Math.hypot(tx, ty, tz) || 1;
  tx /= len;
  ty /= len;
  tz /= len;
  let hx = 0;
  let hy = 0;
  let hz = 1;
  if (Math.abs(tz) > 0.9) {
    hx = 1;
    hy = 0;
    hz = 0;
  }
  let rx = hy * tz - hz * ty;
  let ry = hz * tx - hx * tz;
  let rz = hx * ty - hy * tx;
  const rl = Math.hypot(rx, ry, rz) || 1;
  rx /= rl;
  ry /= rl;
  rz /= rl;
  return {
    tx,
    ty,
    tz,
    rx,
    ry,
    rz,
    ux: ty * rz - tz * ry,
    uy: tz * rx - tx * rz,
    uz: tx * ry - ty * rx,
  };
}

/** Tapered rod from a to b. glow paints the new vertices (chrome slider). */
export function addTaper(raw: Raw, a: Vec3, b: Vec3, r0: number, r1: number, radial = 10, glow = 0): void {
  const before = raw.glow.length;
  const frame = rodFrame(a, b);
  const ringAt = (p: Vec3, radius: number): number[] => {
    const ring: number[] = [];
    for (let k = 0; k < radial; k += 1) {
      const t = (k / radial) * Math.PI * 2;
      const c = Math.cos(t);
      const s = Math.sin(t);
      ring.push(
        addVertex(
          raw,
          p.x + (c * frame.rx + s * frame.ux) * radius,
          p.y + (c * frame.ry + s * frame.uy) * radius,
          p.z + (c * frame.rz + s * frame.uz) * radius,
        ),
      );
    }
    return ring;
  };
  const aRing = ringAt(a, r0);
  const bRing = ringAt(b, r1);
  stitchRings(raw, [aRing, bRing], radial);
  const cap = (center: Vec3, ring: number[], atEnd: boolean) => {
    const c = addVertex(raw, center.x, center.y, center.z);
    for (let i = 0; i < radial; i += 1) {
      const v0 = ring[i];
      const v1 = ring[(i + 1) % radial];
      if (v0 === undefined || v1 === undefined) continue;
      if (atEnd) addTri(raw, c, v0, v1);
      else addTri(raw, c, v1, v0);
    }
  };
  cap(a, aRing, false);
  cap(b, bRing, true);
  if (glow > 0) paintLast(raw, raw.glow.length - before, glow);
}

export function addCylinderX(raw: Raw, length: number, radius: number, radial = 20): void {
  const half = length / 2;
  const rings: number[][] = [[], []];
  for (const [end, x] of [
    [0, -half],
    [1, half],
  ] as const) {
    const ring = rings[end];
    if (!ring) continue;
    for (let i = 0; i < radial; i += 1) {
      const t = (i / radial) * Math.PI * 2;
      ring.push(addVertex(raw, x, Math.cos(t) * radius, Math.sin(t) * radius));
    }
  }
  const aRing = rings[0];
  const bRing = rings[1];
  if (!aRing || !bRing) return;
  for (let i = 0; i < radial; i += 1) {
    const a0 = aRing[i];
    const a1 = aRing[(i + 1) % radial];
    const b0 = bRing[i];
    const b1 = bRing[(i + 1) % radial];
    if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
    addTri(raw, a0, b0, a1);
    addTri(raw, a1, b0, b1);
  }
  const cap = (ring: number[], inward: boolean) => {
    const c = addVertex(raw, inward ? half : -half, 0, 0);
    for (let i = 0; i < radial; i += 1) {
      const v0 = ring[i];
      const v1 = ring[(i + 1) % radial];
      if (v0 === undefined || v1 === undefined) continue;
      if (inward) addTri(raw, c, v0, v1);
      else addTri(raw, c, v1, v0);
    }
  };
  cap(aRing, false);
  cap(bRing, true);
}

export function addWheel(raw: Raw, radius: number, halfWidth: number, radial = 24): void {
  // Tread crown stays at exactly `radius`, and i = 0 is the bottom vertex, so contact Z does not move.
  const stations: Array<readonly [number, number]> = [
    [-halfWidth, 0.84],
    [-halfWidth * 0.7, 0.95],
    [-halfWidth * 0.32, 1],
    [halfWidth * 0.32, 1],
    [halfWidth * 0.7, 0.95],
    [halfWidth, 0.84],
  ];
  const rings: number[][] = [];
  for (const [y, scale] of stations) {
    const ring: number[] = [];
    const r = radius * scale;
    for (let i = 0; i < radial; i += 1) {
      const theta = -Math.PI / 2 + (i * 2 * Math.PI) / radial;
      ring.push(addVertex(raw, Math.cos(theta) * r, y, Math.sin(theta) * r));
    }
    rings.push(ring);
  }
  stitchRings(raw, rings, radial);
  const hubR = radius * 0.42;
  const closeSide = (bead: number[] | undefined, ySign: -1 | 1) => {
    if (!bead) return;
    const yFace = ySign * halfWidth;
    const yHub = ySign * (halfWidth - 0.085);
    const opening: number[] = [];
    const recessed: number[] = [];
    for (let i = 0; i < radial; i += 1) {
      const theta = -Math.PI / 2 + (i * 2 * Math.PI) / radial;
      const c = Math.cos(theta);
      const s = Math.sin(theta);
      opening.push(addVertex(raw, c * hubR, yFace, s * hubR));
      recessed.push(addVertex(raw, c * hubR * 0.7, yHub, s * hubR * 0.7));
    }
    for (let i = 0; i < radial; i += 1) {
      const j = (i + 1) % radial;
      const a0 = bead[i];
      const a1 = bead[j];
      const b0 = opening[i];
      const b1 = opening[j];
      const c0 = recessed[i];
      const c1 = recessed[j];
      if (
        a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined ||
        c0 === undefined || c1 === undefined
      ) {
        continue;
      }
      if (ySign < 0) {
        addTri(raw, a0, b0, a1);
        addTri(raw, a1, b0, b1);
        addTri(raw, b0, c0, b1);
        addTri(raw, b1, c0, c1);
      } else {
        addTri(raw, a0, a1, b0);
        addTri(raw, a1, b1, b0);
        addTri(raw, b0, b1, c0);
        addTri(raw, b1, c1, c0);
      }
    }
    const cap = addVertex(raw, 0, yHub, 0);
    for (let i = 0; i < radial; i += 1) {
      const v0 = recessed[i];
      const v1 = recessed[(i + 1) % radial];
      if (v0 === undefined || v1 === undefined) continue;
      if (ySign < 0) addTri(raw, cap, v0, v1);
      else addTri(raw, cap, v1, v0);
    }
  };
  closeSide(rings[0], -1);
  closeSide(rings[rings.length - 1], 1);
}

export function addTube(raw: Raw, points: Vec3[], radius: number, radial = 6): void {
  if (points.length < 2) return;
  const rings: number[][] = [];
  for (let i = 0; i < points.length; i += 1) {
    const p = points[i];
    const prev = points[Math.max(0, i - 1)];
    const next = points[Math.min(points.length - 1, i + 1)];
    if (!p || !prev || !next) continue;
    let tx = next.x - prev.x;
    let ty = next.y - prev.y;
    let tz = next.z - prev.z;
    const len = Math.hypot(tx, ty, tz) || 1;
    tx /= len;
    ty /= len;
    tz /= len;
    let hx = 0;
    let hy = 0;
    let hz = 1;
    if (Math.abs(tz) > 0.9) {
      hx = 1;
      hy = 0;
      hz = 0;
    }
    let rx = hy * tz - hz * ty;
    let ry = hz * tx - hx * tz;
    let rz = hx * ty - hy * tx;
    const rl = Math.hypot(rx, ry, rz) || 1;
    rx /= rl;
    ry /= rl;
    rz /= rl;
    const ux = ty * rz - tz * ry;
    const uy = tz * rx - tx * rz;
    const uz = tx * ry - ty * rx;
    const ring: number[] = [];
    for (let k = 0; k < radial; k += 1) {
      const a = (k / radial) * Math.PI * 2;
      ring.push(
        addVertex(
          raw,
          p.x + (Math.cos(a) * rx + Math.sin(a) * ux) * radius,
          p.y + (Math.cos(a) * ry + Math.sin(a) * uy) * radius,
          p.z + (Math.cos(a) * rz + Math.sin(a) * uz) * radius,
        ),
      );
    }
    rings.push(ring);
  }
  for (let i = 0; i < rings.length - 1; i += 1) {
    const aRing = rings[i];
    const bRing = rings[i + 1];
    if (!aRing || !bRing) continue;
    for (let k = 0; k < radial; k += 1) {
      const a0 = aRing[k];
      const a1 = aRing[(k + 1) % radial];
      const b0 = bRing[k];
      const b1 = bRing[(k + 1) % radial];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      addTri(raw, a0, b0, a1);
      addTri(raw, a1, b0, b1);
    }
  }
}

export function pushLine(positions: number[], a: Vec3, b: Vec3): void {
  positions.push(a.x, a.y, a.z, b.x, b.y, b.z);
}

export function stations(x0: number, x1: number, step: number): number[] {
  const out = [x0];
  if (Math.abs(x1 - x0) < 1e-9) return out;
  const dir = x1 > x0 ? 1 : -1;
  let x = x0 + dir * step;
  let guard = 0;
  while ((dir > 0 ? x < x1 - 1e-8 : x > x1 + 1e-8) && guard < 400) {
    out.push(x);
    x += dir * step;
    guard += 1;
  }
  const last = out[out.length - 1];
  if (last === undefined || Math.abs(last - x1) > 1e-8) out.push(x1);
  return out;
}

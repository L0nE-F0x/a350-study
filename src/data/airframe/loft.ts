import { LEN1000, LEN900, PLUG, SPAN, quantityById } from "../provenance/index.ts";
import { NACELLE, SCHEMATIC, WING_BOX } from "./constants.ts";
import {
  addBox,
  addCylinderX,
  addLathe,
  addTaper,
  addTri,
  addTube,
  addVertex,
  addWheel,
  appendSection,
  boxPart,
  finalize,
  finalizeLines,
  makePart,
  paintGlow,
  paintLast,
  pushLine,
  rawMesh,
  stations,
  superellipseYZ,
  type VariantId,
} from "./geom.ts";
import type { Hinge, Part, Vec3 } from "../../shared/types/index.ts";

const A = 5.96 / 2;
const B = SCHEMATIC.fuselageHeightM / 2;
const ZC = SCHEMATIC.fuselageCenterZ;
const N = SCHEMATIC.superellipseN;
const RADIAL = SCHEMATIC.radialSegments;
const SEMI = SPAN / 2;
const DIHEDRAL = Math.tan((5.4 * Math.PI) / 180);

function wingLift(y: number): number {
  return Math.abs(y) * DIHEDRAL;
}

export function chordAtY(yAbs: number): number {
  return (
    SCHEMATIC.wingRootChordM +
    (SCHEMATIC.wingTipChordM - SCHEMATIC.wingRootChordM) * (yAbs / SEMI)
  );
}

export function analyticWingAreaM2(): number {
  return ((SCHEMATIC.wingRootChordM + SCHEMATIC.wingTipChordM) / 2) * SPAN;
}

export function teExtensionAreaM2(): number {
  return (SCHEMATIC.teExtensionRootM * SPAN) / 2;
}

export function teExtraAt(yAbs: number): number {
  return SCHEMATIC.teExtensionRootM * (1 - yAbs / SEMI);
}

function sweepX(yAbs: number): number {
  return yAbs * Math.tan((SCHEMATIC.wingQuarterChordSweepDeg * Math.PI) / 180);
}

function suffix(variant: VariantId): "900" | "1000" {
  return variant === "a350-900" ? "900" : "1000";
}

export function bodyScale(x: number, nose: number, c0: number, c1: number, tail: number): number {
  if (x <= c0) {
    const t = Math.min(1, Math.max(0, (x - nose) / (c0 - nose)));
    // Blunt radome into the constant section. Endpoints stay 0 and 1.
    return 1 - (1 - t) ** 1.65;
  }
  if (x >= c1) {
    const t = Math.min(1, Math.max(0, (x - c1) / (tail - c1)));
    const eased = t * t * (3 - 2 * t);
    // Spec closure is 0.15 of the section at the tail tip, not a point.
    return 1 + (0.15 - 1) * eased;
  }
  return 1;
}

function sectionEnds(length: number): { nose: number; c0: number; c1: number; tail: number } {
  const half = length / 2;
  return {
    nose: -half,
    c0: -half + SCHEMATIC.noseConeM,
    c1: half - SCHEMATIC.tailConeM,
    tail: half,
  };
}

function skinPoint(x: number, theta: number, scale: number): { x: number; y: number; z: number } {
  const p = superellipseYZ(theta, scale, A, B, N, ZC);
  return { x, y: p.y, z: p.z };
}

function addPocket(
  raw: ReturnType<typeof rawMesh>,
  corners: Array<{ x: number; y: number; z: number }>,
  depth: number,
  glow = 0,
): void {
  const pull = (point: { x: number; y: number; z: number }) => {
    const dy = point.y;
    const dz = point.z - ZC;
    const len = Math.hypot(dy, dz) || 1;
    return {
      x: point.x,
      y: point.y - (dy / len) * depth,
      z: point.z - (dz / len) * depth,
    };
  };
  const outer = corners.map((corner) => addVertex(raw, corner.x, corner.y, corner.z));
  const inner = corners.map((corner) => {
    const next = pull(corner);
    return addVertex(raw, next.x, next.y, next.z);
  });
  const i0 = inner[0];
  const i1 = inner[1];
  const i2 = inner[2];
  const i3 = inner[3];
  if (i0 === undefined || i1 === undefined || i2 === undefined || i3 === undefined) return;
  if (glow > 0) {
    for (const index of outer) paintGlow(raw, index, glow);
    for (const index of inner) paintGlow(raw, index, glow);
  }
  addTri(raw, i0, i1, i2);
  addTri(raw, i0, i2, i3);
  for (let i = 0; i < 4; i += 1) {
    const j = (i + 1) % 4;
    const o0 = outer[i];
    const o1 = outer[j];
    const n0 = inner[i];
    const n1 = inner[j];
    if (o0 === undefined || o1 === undefined || n0 === undefined || n1 === undefined) continue;
    addTri(raw, o0, n0, o1);
    addTri(raw, o1, n0, n1);
  }
}

function appendOpenings(
  raw: ReturnType<typeof rawMesh>,
  id: string,
  xs: number[],
  ends: ReturnType<typeof sectionEnds>,
): void {
  const scaleAt = (x: number) => bodyScale(x, ends.nose, ends.c0, ends.c1, ends.tail);
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  if (x0 === undefined || x1 === undefined) return;
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  if (id.startsWith("fuse.body") || id.startsWith("fuse.plug")) {
    const pitch = 0.54;
    const halfWindow = 0.13;
    for (let x = Math.ceil((lo + halfWindow) / pitch) * pitch; x <= hi - halfWindow; x += pitch) {
      if (scaleAt(x) < 0.995) continue;
      for (const side of [1, -1] as const) {
        const theta = side > 0 ? 0.78 : Math.PI - 0.78;
        addPocket(
          raw,
          [
            skinPoint(x - 0.13, theta - 0.1, 1),
            skinPoint(x + 0.13, theta - 0.1, 1),
            skinPoint(x + 0.13, theta + 0.1, 1),
            skinPoint(x - 0.13, theta + 0.1, 1),
          ],
          0.05,
          1,
        );
      }
    }
    const cabin = ends.c1 - ends.c0;
    for (const fraction of [0.09, 0.45, 0.73, 0.96] as const) {
      const x = ends.c0 + fraction * cabin;
      if (x - 0.42 < lo || x + 0.42 > hi) continue;
      for (const side of [1, -1] as const) {
        const theta = side > 0 ? 0.35 : Math.PI - 0.35;
        addPocket(
          raw,
          [
            skinPoint(x - 0.42, theta - 0.42, 1),
            skinPoint(x + 0.42, theta - 0.42, 1),
            skinPoint(x + 0.42, theta + 0.55, 1),
            skinPoint(x - 0.42, theta + 0.55, 1),
          ],
          0.07,
          2,
        );
      }
    }
  }
  if (id === "fuse.nose") {
    for (const side of [1, -1] as const) {
      const x = ends.nose + 3.4;
      const scale = scaleAt(x);
      const theta = side > 0 ? 0.55 : Math.PI - 0.55;
      addPocket(
        raw,
        [
          skinPoint(x - 0.35, theta - 0.25, scale),
          skinPoint(x + 0.55, theta - 0.2, scaleAt(x + 0.55)),
          skinPoint(x + 0.45, theta + 0.28, scaleAt(x + 0.45)),
          skinPoint(x - 0.4, theta + 0.22, scale),
        ],
        0.04,
        1,
      );
    }
  }
}

function addRingGroove(
  raw: ReturnType<typeof rawMesh>,
  x: number,
  halfWidth: number,
  depth: number,
  scale: number,
): void {
  if (scale < 0.35) return;
  const count = 18;
  for (let i = 0; i < count; i += 1) {
    const t0 = (i / count) * Math.PI * 2;
    const t1 = ((i + 1) / count) * Math.PI * 2;
    addPocket(
      raw,
      [
        skinPoint(x - halfWidth, t0, scale),
        skinPoint(x + halfWidth, t0, scale),
        skinPoint(x + halfWidth, t1, scale),
        skinPoint(x - halfWidth, t1, scale),
      ],
      depth,
    );
  }
}

function addStringerGroove(
  raw: ReturnType<typeof rawMesh>,
  theta: number,
  x0: number,
  x1: number,
  depth: number,
): void {
  const dTheta = 0.018;
  addPocket(
    raw,
    [
      skinPoint(x0, theta - dTheta, 1),
      skinPoint(x1, theta - dTheta, 1),
      skinPoint(x1, theta + dTheta, 1),
      skinPoint(x0, theta + dTheta, 1),
    ],
    depth,
  );
}

/** Schematic skin creases. Every pocket is clamped inside this part's stations. */
function appendSkinStructure(
  raw: ReturnType<typeof rawMesh>,
  id: string,
  xs: number[],
  ends: ReturnType<typeof sectionEnds>,
): void {
  const scaleAt = (x: number) => bodyScale(x, ends.nose, ends.c0, ends.c1, ends.tail);
  const x0 = xs[0];
  const x1 = xs[xs.length - 1];
  if (x0 === undefined || x1 === undefined) return;
  const lo = Math.min(x0, x1);
  const hi = Math.max(x0, x1);
  const halfFrame = 0.016;
  const pitch = 4.5;
  for (let x = Math.ceil((lo + halfFrame) / pitch) * pitch; x <= hi - halfFrame + 1e-9; x += pitch) {
    addRingGroove(raw, x, halfFrame, 0.03, scaleAt(x));
  }
  if (id.startsWith("fuse.body") || id.startsWith("fuse.plug")) {
    const thetas = [0.55, 1.02, Math.PI / 2, -0.95];
    const mirrored = [0.55, 1.02].map((theta) => Math.PI - theta);
    const seg = 12;
    for (const theta of [...thetas, ...mirrored]) {
      for (let x = lo + 0.08; x < hi - 0.3; x += seg) {
        const end = Math.min(hi - 0.08, x + seg - 0.12);
        if (end - x < 0.45) continue;
        if (scaleAt(x) < 0.995 || scaleAt(end) < 0.995) continue;
        addStringerGroove(raw, theta, x, end, 0.02);
      }
    }
    const cabin = ends.c1 - ends.c0;
    for (const [fraction, halfX] of [
      [0.27, 0.9],
      [0.64, 0.75],
    ] as const) {
      const x = ends.c0 + fraction * cabin;
      if (x - halfX < lo || x + halfX > hi) continue;
      const theta = -0.72;
      addPocket(
        raw,
        [
          skinPoint(x - halfX, theta - 0.28, 1),
          skinPoint(x + halfX, theta - 0.28, 1),
          skinPoint(x + halfX, theta + 0.42, 1),
          skinPoint(x - halfX, theta + 0.42, 1),
        ],
        0.06,
        2,
      );
    }
  }
  if (id === "fuse.body.fwd") {
    addBox(raw, -1.2, 0, ZC + B * 0.98 + 0.14, 0.42, 0.34, 0.3);
    paintLast(raw, 8, 5);
  }
  if (id === "fuse.tail") {
    addBox(raw, ends.tail - 0.35, 0, ZC + 0.15, 0.16, 0.16, 0.16);
    paintLast(raw, 8, 6);
  }
  if (id === "fuse.nose") {
    const radome = ends.nose + 1.2;
    if (radome - 0.02 >= lo && radome + 0.02 <= hi) addRingGroove(raw, radome, 0.018, 0.028, scaleAt(radome));
    const x = ends.nose + 2.7;
    if (x - 0.4 >= lo && x + 0.55 <= hi) {
      const theta = Math.PI / 2;
      addPocket(
        raw,
        [
          skinPoint(x - 0.4, theta - 0.42, scaleAt(x - 0.4)),
          skinPoint(x + 0.55, theta - 0.38, scaleAt(x + 0.55)),
          skinPoint(x + 0.4, theta + 0.42, scaleAt(x + 0.4)),
          skinPoint(x - 0.45, theta + 0.38, scaleAt(x - 0.45)),
        ],
        0.04,
        1,
      );
    }
    const lampX = ends.nose + 4.4;
    if (lampX - 0.16 >= lo && lampX + 0.16 <= hi) {
      for (const theta of [-1.25, Math.PI + 1.25] as const) {
        const at = skinPoint(lampX, theta, scaleAt(lampX));
        addBox(raw, at.x, at.y, at.z - 0.05, 0.55, 0.24, 0.12);
        paintLast(raw, 8, 7);
      }
    }
  }
}

function fuselagePart(
  variant: VariantId,
  id: string,
  name: string,
  xs: number[],
  ends: ReturnType<typeof sectionEnds>,
  group: string,
  tag: Part["diffTag"],
  quantityIds: string[],
): Part {
  const raw = rawMesh();
  appendSection(raw, xs, (x) => bodyScale(x, ends.nose, ends.c0, ends.c1, ends.tail), A, B, N, ZC, RADIAL);
  appendOpenings(raw, id, xs, ends);
  appendSkinStructure(raw, id, xs, ends);
  return makePart(variant, {
    id,
    name,
    layerId: "skin",
    explodeGroup: group,
    position: { x: 0, y: 0, z: 0 },
    mesh: finalize(raw),
    quantityIds,
    diffTag: tag,
  });
}

export function buildFuselage(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const step = SCHEMATIC.bodyStationSpacingM;
  const key = suffix(variant);
  const lenIds = [`q.len.${key}`, "q.fuseWidth"];
  return [
    fuselagePart(variant, "fuse.nose", "Nose cone", stations(ends.nose, ends.c0, step), ends, "structure", "shifted", lenIds),
    fuselagePart(variant, "fuse.body.fwd", "Forward fuselage", stations(ends.c0, 0, step), ends, "skin", "common", lenIds),
    fuselagePart(variant, "fuse.body.aft", "Aft fuselage", stations(0, ends.c1, step), ends, "skin", "common", lenIds),
    fuselagePart(variant, "fuse.tail", "Tail cone", stations(ends.c1, ends.tail, step), ends, "structure", "shifted", lenIds),
  ];
}

export function buildPlugs(variant: VariantId): Part[] {
  const ends = sectionEnds(LEN1000);
  const plug = PLUG;
  const ids = ["q.schematic.plug", "q.derived.stretch"];
  return [
    fuselagePart(variant, "fuse.plug.fwd", "Forward plug", stations(-plug, 0, SCHEMATIC.bodyStationSpacingM), ends, "skin", "added", ids),
    fuselagePart(variant, "fuse.plug.aft", "Aft plug", stations(0, plug, SCHEMATIC.bodyStationSpacingM), ends, "skin", "added", ids),
  ];
}

/** NACA thickness shape, 0 at the leading and trailing edges and 1 at the peak. */
function airfoilShape(fraction: number): number {
  const x = Math.min(1, Math.max(0, fraction));
  const s = Math.sqrt(x);
  const yt = 5 * (0.2969 * s - 0.126 * x - 0.3516 * x * x + 0.2843 * x * x * x - 0.1015 * x * x * x * x);
  return yt / 0.5005;
}

function chordFraction(index: number, count: number): number {
  const t = index / count;
  return (1 - Math.cos(t * Math.PI)) / 2;
}

function appendWingSurface(
  raw: ReturnType<typeof rawMesh>,
  y0: number,
  y1: number,
  teExtra: (yAbs: number) => number,
  caps: { root: boolean; tip: boolean } = { root: true, tip: true },
): void {
  const spanQuads = 28;
  const chordQuads = 16;
  const grids: number[][][] = [];
  for (const zSign of [1, -1] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= spanQuads; i += 1) {
      const y = y0 + ((y1 - y0) * i) / spanQuads;
      const yAbs = Math.abs(y);
      const chord = chordAtY(yAbs);
      const le = sweepX(yAbs) - 0.25 * chord;
      const te = sweepX(yAbs) + 0.75 * chord + teExtra(yAbs);
      const tc = 0.125 + (0.09 - 0.125) * (yAbs / SEMI);
      const row: number[] = [];
      for (let j = 0; j <= chordQuads; j += 1) {
        const f = chordFraction(j, chordQuads);
        const x = le + (te - le) * f;
        row.push(addVertex(raw, x, y, wingLift(y) + zSign * (tc * chord * 0.5) * airfoilShape(f)));
      }
      grid.push(row);
    }
    for (let i = 0; i < spanQuads; i += 1) {
      for (let j = 0; j < chordQuads; j += 1) {
        const row = grid[i];
        const next = grid[i + 1];
        if (!row || !next) continue;
        const a = row[j];
        const b = row[j + 1];
        const c = next[j];
        const d = next[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (zSign > 0) {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        } else {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    }
    grids.push(grid);
  }
  const upper = grids[0];
  const lower = grids[1];
  if (!upper || !lower) return;
  const stitch = (rowA: number[] | undefined, rowB: number[] | undefined, reverse: boolean) => {
    if (!rowA || !rowB) return;
    for (let j = 0; j < chordQuads; j += 1) {
      const a = rowA[j];
      const b = rowA[j + 1];
      const c = rowB[j];
      const d = rowB[j + 1];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      if (reverse) {
        addTri(raw, a, b, c);
        addTri(raw, b, d, c);
      } else {
        addTri(raw, a, c, b);
        addTri(raw, b, c, d);
      }
    }
  };
  if (caps.root) stitch(upper[0], lower[0], false);
  if (caps.tip) stitch(upper[spanQuads], lower[spanQuads], true);
  if (caps.tip && Math.abs(Math.abs(y1) - SEMI) < 1e-6) appendWinglet(raw, y1, teExtra);
  if (Math.abs(y1 - y0) > 10) appendWingDetail(raw, y0, y1, teExtra);
}

function appendWinglet(
  raw: ReturnType<typeof rawMesh>,
  yTip: number,
  teExtra: (yAbs: number) => number,
): void {
  const sign = Math.sign(yTip) || 1;
  const yAbs = Math.abs(yTip);
  const chord = chordAtY(yAbs);
  const le = sweepX(yAbs) - 0.25 * chord;
  const te = sweepX(yAbs) + 0.75 * chord + teExtra(yAbs);
  const rise = 3.2;
  const rows = 8;
  const cols = 6;
  for (const y of [yTip, sign * (yAbs - 0.06)] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= rows; i += 1) {
      const f = i / rows;
      const z = wingLift(y) + rise * f * f;
      const rowChord = chord * (1 - 0.62 * f);
      const rowLe = le + (te - le) * 0.22 * f;
      const row: number[] = [];
      for (let j = 0; j <= cols; j += 1) {
        row.push(addVertex(raw, rowLe + (rowChord * j) / cols, y, z));
      }
      grid.push(row);
    }
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const row = grid[i];
        const next = grid[i + 1];
        if (!row || !next) continue;
        const a = row[j];
        const b = row[j + 1];
        const c = next[j];
        const d = next[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (y === yTip) {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        } else {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        }
      }
    }
  }
  addBox(
    raw,
    le + (te - le) * 0.35,
    yTip - sign * 0.28,
    wingLift(yAbs) + rise * 0.9,
    0.5,
    0.24,
    0.36,
  );
  paintLast(raw, 8, sign > 0 ? 4 : 3);
}

function wingPoint(
  y: number,
  fraction: number,
  zSign: 1 | -1,
  teExtra: number,
): { x: number; y: number; z: number } {
  const yAbs = Math.abs(y);
  const chord = chordAtY(yAbs);
  const le = sweepX(yAbs) - 0.25 * chord;
  const te = sweepX(yAbs) + 0.75 * chord + teExtra;
  const f = Math.min(1, Math.max(0, fraction));
  const tc = 0.125 + (0.09 - 0.125) * (yAbs / SEMI);
  return {
    x: le + (te - le) * f,
    y,
    z: wingLift(y) + zSign * (tc * chord * 0.5) * airfoilShape(f),
  };
}

function appendSpanGroove(
  raw: ReturnType<typeof rawMesh>,
  y0: number,
  y1: number,
  fraction: number,
  teExtra: (yAbs: number) => number,
): void {
  const steps = 16;
  const half = 0.007;
  for (const zSign of [1, -1] as const) {
    for (let i = 0; i < steps; i += 1) {
      const ya = y0 + ((y1 - y0) * i) / steps;
      const yb = y0 + ((y1 - y0) * (i + 1)) / steps;
      const depth = 0.022;
      const at = (y: number, f: number) => wingPoint(y, f, zSign, teExtra(Math.abs(y)));
      const corners = [at(ya, fraction - half), at(yb, fraction - half), at(yb, fraction + half), at(ya, fraction + half)];
      const outer = corners.map((point) => addVertex(raw, point.x, point.y, point.z));
      const inner = corners.map((point) => addVertex(raw, point.x, point.y, point.z - zSign * depth));
      const i0 = inner[0];
      const i1 = inner[1];
      const i2 = inner[2];
      const i3 = inner[3];
      if (i0 === undefined || i1 === undefined || i2 === undefined || i3 === undefined) continue;
      addTri(raw, i0, i1, i2);
      addTri(raw, i0, i2, i3);
      for (let k = 0; k < 4; k += 1) {
        const j = (k + 1) % 4;
        const o0 = outer[k];
        const o1 = outer[j];
        const n0 = inner[k];
        const n1 = inner[j];
        if (o0 === undefined || o1 === undefined || n0 === undefined || n1 === undefined) continue;
        addTri(raw, o0, n0, o1);
        addTri(raw, o1, n0, n1);
      }
    }
  }
}

function appendTrackFairing(raw: ReturnType<typeof rawMesh>, y: number): void {
  const yAbs = Math.abs(y);
  if (yAbs < 5 || yAbs > SEMI - 1.5) return;
  const chord = chordAtY(yAbs);
  const le = sweepX(yAbs) - 0.25 * chord;
  const steps = 7;
  const radial = 7;
  const rings: number[][] = [];
  for (let s = 0; s <= steps; s += 1) {
    const f = s / steps;
    const fraction = 0.48 + 0.5 * f;
    const skin = wingPoint(y, fraction, -1, 0);
    const x = le + chord * fraction;
    const radius = 0.55 * Math.sin(f * Math.PI);
    const ring: number[] = [];
    for (let i = 0; i < radial; i += 1) {
      const t = (i / radial) * Math.PI * 2;
      const oy = Math.cos(t) * radius * 0.72;
      const oz = Math.sin(t) * radius;
      const py = y + oy;
      if (Math.abs(py) > SEMI - 0.05) return;
      ring.push(addVertex(raw, x, py, skin.z - 0.04 + Math.min(0, oz) + Math.max(0, oz) * 0.35));
    }
    rings.push(ring);
  }
  for (let s = 0; s < steps; s += 1) {
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

function appendWingDetail(
  raw: ReturnType<typeof rawMesh>,
  y0: number,
  y1: number,
  teExtra: (yAbs: number) => number,
): void {
  for (const fraction of [0.16, 0.62, 0.78] as const) appendSpanGroove(raw, y0, y1, fraction, teExtra);
  const sign = Math.sign(y1) || 1;
  for (const station of [7, 12, 18, 24] as const) appendTrackFairing(raw, sign * station);
}

function addLandingLamp(raw: ReturnType<typeof rawMesh>, y: number): void {
  const skin = wingPoint(y, 0.07, -1, 0);
  addBox(raw, skin.x, y, skin.z - 0.1, 0.9, 0.34, 0.12);
  paintLast(raw, 8, 7);
}

export function buildWings(variant: VariantId): Part[] {
  const key = suffix(variant);
  const ids = ["q.span", `q.wingArea.${key}`];
  const parts: Part[] = [];
  for (const [id, y0, y1] of [
    ["wing.right", 2.98, SEMI],
    ["wing.left", -2.98, -SEMI],
  ] as const) {
    const raw = rawMesh();
    appendWingSurface(raw, y0, y1, () => 0);
    // Schematic glove. The planform loft still starts at ±2.98; this only tucks the root into the tube.
    appendWingSurface(raw, y0, Math.sign(y1) * 2.42, () => 0, { root: false, tip: true });
    const lampSign = Math.sign(y1) || 1;
    addLandingLamp(raw, lampSign * 4.6);
    addLandingLamp(raw, lampSign * 7.1);
    parts.push(
      makePart(variant, {
        id,
        name: id === "wing.right" ? "Starboard wing" : "Port wing",
        layerId: "skin",
        explodeGroup: "skin",
        position: { x: 0, y: 0, z: 0 },
        mesh: finalize(raw),
        quantityIds: ids,
        diffTag: "common",
      }),
    );
  }
  return parts;
}

export function buildTeExtensions(variant: VariantId): Part[] {
  const parts: Part[] = [];
  for (const [id, y0, y1, name] of [
    ["wing.teExtension.right", 2.98, SEMI, "Starboard trailing edge"],
    ["wing.teExtension.left", -2.98, -SEMI, "Port trailing edge"],
  ] as const) {
    const raw = rawMesh();
    const spanQuads = 24;
    for (let i = 0; i < spanQuads; i += 1) {
      const ya = y0 + ((y1 - y0) * i) / spanQuads;
      const yb = y0 + ((y1 - y0) * (i + 1)) / spanQuads;
      const edge = (y: number) => {
        const yAbs = Math.abs(y);
        const chord = chordAtY(yAbs);
        const te = sweepX(yAbs) + 0.75 * chord;
        return { te, extra: teExtraAt(yAbs) };
      };
      const ea = edge(ya);
      const eb = edge(yb);
      const za = wingLift(ya);
      const zb = wingLift(yb);
      const v = [
        addVertex(raw, ea.te, ya, za + 0.02),
        addVertex(raw, ea.te + ea.extra, ya, za + 0.02),
        addVertex(raw, eb.te + eb.extra, yb, zb + 0.02),
        addVertex(raw, eb.te, yb, zb + 0.02),
        addVertex(raw, ea.te, ya, za - 0.02),
        addVertex(raw, ea.te + ea.extra, ya, za - 0.02),
        addVertex(raw, eb.te + eb.extra, yb, zb - 0.02),
        addVertex(raw, eb.te, yb, zb - 0.02),
      ];
      const quads: Array<[number, number, number, number]> = [
        [0, 1, 2, 3],
        [4, 7, 6, 5],
        [0, 3, 7, 4],
        [1, 5, 6, 2],
      ];
      for (const [a, b, c, d] of quads) {
        const ia = v[a];
        const ib = v[b];
        const ic = v[c];
        const idv = v[d];
        if (ia === undefined || ib === undefined || ic === undefined || idv === undefined) continue;
        addTri(raw, ia, ib, ic);
        addTri(raw, ia, ic, idv);
      }
    }
    parts.push(
      makePart(variant, {
        id,
        name,
        layerId: "skin",
        explodeGroup: "skin",
        position: { x: 0, y: 0, z: 0 },
        mesh: finalize(raw),
        quantityIds: ["q.schematic.teExtension", "q.wingArea.1000"],
        diffTag: "added",
      }),
    );
  }
  return parts;
}

function appendPlanform(
  raw: ReturnType<typeof rawMesh>,
  y0: number,
  y1: number,
  qcX: number,
  rootChord: number,
  tipChord: number,
  z: number,
  thick: number,
): void {
  const spanQuads = 8;
  const chordQuads = 6;
  const span = Math.abs(y1 - y0) || 1;
  const grids: number[][][] = [];
  for (const zSign of [1, -1] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= spanQuads; i += 1) {
      const y = y0 + ((y1 - y0) * i) / spanQuads;
      const chord = rootChord + (tipChord - rootChord) * (Math.abs(y - y0) / span);
      const le = qcX - 0.25 * chord;
      const row: number[] = [];
      for (let j = 0; j <= chordQuads; j += 1) {
        const f = j / chordQuads;
        row.push(addVertex(raw, le + chord * f, y, z + zSign * thick * airfoilShape(f)));
      }
      grid.push(row);
    }
    for (let i = 0; i < spanQuads; i += 1) {
      for (let j = 0; j < chordQuads; j += 1) {
        const row = grid[i];
        const next = grid[i + 1];
        if (!row || !next) continue;
        const a = row[j];
        const b = row[j + 1];
        const c = next[j];
        const d = next[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (zSign > 0) {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        } else {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    }
    grids.push(grid);
  }
  const upper = grids[0];
  const lower = grids[1];
  if (!upper || !lower) return;
  const stitchRow = (rowA: number[] | undefined, rowB: number[] | undefined) => {
    if (!rowA || !rowB) return;
    for (let j = 0; j < chordQuads; j += 1) {
      const a = rowA[j];
      const b = rowA[j + 1];
      const c = rowB[j];
      const d = rowB[j + 1];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      addTri(raw, a, c, b);
      addTri(raw, b, c, d);
    }
  };
  stitchRow(upper[0], lower[0]);
  stitchRow(upper[spanQuads], lower[spanQuads]);
  for (const j of [0, chordQuads]) {
    for (let i = 0; i < spanQuads; i += 1) {
      const a = upper[i]?.[j];
      const b = upper[i + 1]?.[j];
      const c = lower[i]?.[j];
      const d = lower[i + 1]?.[j];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      addTri(raw, a, b, c);
      addTri(raw, b, d, c);
    }
  }
}

export function buildEmpennage(variant: VariantId): Part[] {
  const key = suffix(variant);
  const h = rawMesh();
  appendPlanform(h, 0, 10, 28, 4, 1.5, 4.8, 0.12);
  appendPlanform(h, 0, -10, 28, 4, 1.5, 4.8, 0.12);
  const fin = rawMesh();
  const z0 = 2.2;
  const z1 = SCHEMATIC.finTipZ;
  const nz = 10;
  const nc = 6;
  const finGrids: number[][][] = [];
  for (const ySign of [1, -1] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= nz; i += 1) {
      const f = i / nz;
      const z = z0 + (z1 - z0) * f;
      const chord = 3 + (1.4 - 3) * f;
      const le = 30 + 1.2 * f;
      const thick = 0.18 * (1 - f) + 0.03 * f;
      const row: number[] = [];
      for (let j = 0; j <= nc; j += 1) {
        const c = j / nc;
        row.push(addVertex(fin, le + chord * c, ySign * thick * airfoilShape(c), z));
      }
      grid.push(row);
    }
    for (let i = 0; i < nz; i += 1) {
      for (let j = 0; j < nc; j += 1) {
        const row = grid[i];
        const next = grid[i + 1];
        if (!row || !next) continue;
        const a = row[j];
        const b = row[j + 1];
        const c = next[j];
        const d = next[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (ySign > 0) {
          addTri(fin, a, c, b);
          addTri(fin, b, c, d);
        } else {
          addTri(fin, a, b, c);
          addTri(fin, b, d, c);
        }
      }
    }
    finGrids.push(grid);
  }
  const finStar = finGrids[0];
  const finPort = finGrids[1];
  if (finStar && finPort) {
    for (const j of [0, nc]) {
      for (let i = 0; i < nz; i += 1) {
        const a = finStar[i]?.[j];
        const b = finStar[i + 1]?.[j];
        const c = finPort[i]?.[j];
        const d = finPort[i + 1]?.[j];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        addTri(fin, a, b, c);
        addTri(fin, b, d, c);
      }
    }
  }
  return [
    makePart(variant, {
      id: "htail",
      name: "Horizontal tail",
      layerId: "skin",
      explodeGroup: "structure.empennage",
      position: { x: 0, y: 0, z: 0 },
      mesh: finalize(h),
      quantityIds: [`q.len.${key}`],
      diffTag: "shifted",
    }),
    makePart(variant, {
      id: "vtail",
      name: "Vertical fin",
      layerId: "skin",
      explodeGroup: "structure.empennage",
      position: { x: 0, y: 0, z: 0 },
      mesh: finalize(fin),
      quantityIds: [`q.height.${key}`],
      diffTag: "shifted",
    }),
  ];
}

let wheelMeshCache: ReturnType<typeof finalize> | null = null;
function wheelMeshData(): ReturnType<typeof finalize> {
  if (!wheelMeshCache) {
    const raw = rawMesh();
    addWheel(raw, SCHEMATIC.wheelRadiusM, 0.18);
    wheelMeshCache = finalize(raw);
  }
  return wheelMeshCache;
}

function addDiscY(
  raw: ReturnType<typeof rawMesh>,
  cx: number,
  cy: number,
  cz: number,
  radius: number,
  half: number,
  radial = 14,
): void {
  const rings: number[][] = [];
  for (const y of [cy - half, cy + half]) {
    const ring: number[] = [];
    for (let i = 0; i < radial; i += 1) {
      const t = (i / radial) * Math.PI * 2;
      ring.push(addVertex(raw, cx + Math.cos(t) * radius, y, cz + Math.sin(t) * radius));
    }
    rings.push(ring);
  }
  const inner = rings[0];
  const outer = rings[1];
  if (!inner || !outer) return;
  for (let i = 0; i < radial; i += 1) {
    const a0 = inner[i];
    const a1 = inner[(i + 1) % radial];
    const b0 = outer[i];
    const b1 = outer[(i + 1) % radial];
    if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
    addTri(raw, a0, b0, a1);
    addTri(raw, a1, b0, b1);
  }
  const cap = (ring: number[], y: number, atPositive: boolean) => {
    const c = addVertex(raw, cx, y, cz);
    for (let i = 0; i < radial; i += 1) {
      const v0 = ring[i];
      const v1 = ring[(i + 1) % radial];
      if (v0 === undefined || v1 === undefined) continue;
      if (atPositive) addTri(raw, c, v0, v1);
      else addTri(raw, c, v1, v0);
    }
  };
  cap(inner, cy - half, false);
  cap(outer, cy + half, true);
}

function addNoseGear(raw: ReturnType<typeof rawMesh>): void {
  // Origin is contactZ+2.4. Wheel centres sit at local z = −1.8. Stay above the tyre.
  addTaper(raw, { x: 0, y: 0, z: 1.35 }, { x: 0, y: 0, z: -0.02 }, 0.24, 0.18, 12);
  addTaper(raw, { x: 0, y: 0, z: 0.12 }, { x: 0, y: 0, z: -1.62 }, 0.12, 0.1, 12, 1);
  addTaper(raw, { x: 0, y: 0, z: 0.04 }, { x: 0, y: 0, z: -0.24 }, 0.23, 0.23, 12);
  addBox(raw, 0, 0, -1.66, 0.32, 0.7, 0.26);
  addTaper(raw, { x: 0.32, y: 0.06, z: -0.22 }, { x: 0.46, y: 0.06, z: -0.95 }, 0.04, 0.034, 6);
  addTaper(raw, { x: 0.46, y: 0.06, z: -0.95 }, { x: 0.28, y: 0.05, z: -1.55 }, 0.034, 0.04, 6);
  addTaper(raw, { x: 0.32, y: -0.06, z: -0.22 }, { x: 0.46, y: -0.06, z: -0.95 }, 0.04, 0.034, 6);
  addTaper(raw, { x: 0.46, y: -0.06, z: -0.95 }, { x: 0.28, y: -0.05, z: -1.55 }, 0.034, 0.04, 6);
  addTaper(raw, { x: 0.44, y: -0.1, z: -0.95 }, { x: 0.44, y: 0.1, z: -0.95 }, 0.045, 0.045, 8);
  addTaper(raw, { x: 0.08, y: 0, z: 0.42 }, { x: 1.7, y: 0, z: 1.22 }, 0.07, 0.05, 8);
  addBox(raw, 0.12, 0, 0.48, 0.16, 0.16, 0.16);
  addBox(raw, 1.62, 0, 1.16, 0.22, 0.16, 0.18);
  addBox(raw, -0.16, 0, -1.58, 0.18, 0.16, 0.12);
}

function addMainGear(raw: ReturnType<typeof rawMesh>, inb: number, beam: number, axleLocal: number[]): void {
  // Wheel centres are local z = −1.9. Truck structure stays above the contact patch
  // and stands proud of the tyre silhouette so the bogie reads in side view.
  const truck = beam > 3 ? 4.7 : 3.05;
  addBox(raw, 0, 0, -1.76, truck, 0.22, 0.34);
  addBox(raw, 0, 0, -1.32, 1.15, 0.2, 0.72);
  addBox(raw, -truck * 0.46, 0, -1.74, 0.28, 0.28, 0.4);
  addBox(raw, truck * 0.46, 0, -1.74, 0.28, 0.28, 0.4);
  for (const x of axleLocal) {
    for (const side of [-1, 1] as const) {
      addDiscY(raw, x, side * 0.22, -1.9, 0.42, 0.05, 16);
    }
  }
  const sliderTop = { x: -0.04, y: inb * 0.16, z: 0.02 };
  addTaper(raw, { x: 0, y: 0, z: -1.48 }, sliderTop, 0.14, 0.16, 12, 1);
  addTaper(raw, { x: -0.03, y: inb * 0.12, z: -0.08 }, { x: -0.14, y: inb * 0.62, z: 2.72 }, 0.28, 0.2, 12);
  addTaper(raw, { x: -0.02, y: inb * 0.14, z: -0.2 }, { x: -0.06, y: inb * 0.22, z: 0.2 }, 0.34, 0.34, 12);
  addBox(raw, -0.14, inb * 0.62, 2.52, 0.78, 0.38, 0.32);
  addTaper(
    raw,
    { x: -0.08, y: inb * 0.32, z: 0.85 },
    { x: -0.4, y: inb * 1.45, z: 2.5 },
    0.09,
    0.06,
    8,
  );
  addTaper(
    raw,
    { x: -0.42, y: inb * 0.18, z: 0.35 },
    { x: -1.45, y: inb * 0.38, z: 2.4 },
    0.09,
    0.06,
    8,
  );
  addTaper(raw, { x: 0.42, y: 0.07, z: -0.05 }, { x: 0.55, y: 0.07, z: -0.72 }, 0.042, 0.036, 6);
  addTaper(raw, { x: 0.55, y: 0.07, z: -0.72 }, { x: 0.36, y: 0.05, z: -1.38 }, 0.036, 0.042, 6);
  addTaper(raw, { x: 0.5, y: -0.1, z: -0.72 }, { x: 0.5, y: 0.1, z: -0.72 }, 0.046, 0.046, 6);
}

export function buildGear(variant: VariantId, track: number, wheelbase: number, contactZ: number): Part[] {
  const key = suffix(variant);
  const axles = variant === "a350-900" ? 2 : 3;
  const mainX = SCHEMATIC.mainGearXM;
  const radius = SCHEMATIC.wheelRadiusM;
  const gap = SCHEMATIC.wheelLateralGapM / 2;
  const axleXs =
    axles === 2
      ? [mainX - SCHEMATIC.axlePitchM / 2, mainX + SCHEMATIC.axlePitchM / 2]
      : [mainX - SCHEMATIC.axlePitchM, mainX, mainX + SCHEMATIC.axlePitchM];
  const parts: Part[] = [];
  const noseX = mainX - wheelbase;
  const gearIds = [`q.track.${key}`, `q.wheelbase.${key}`, `q.gear.${key}`];
  const noseLeg = rawMesh();
  addNoseGear(noseLeg);
  parts.push(
    makePart(variant, {
      id: "gear.nose",
      name: "Nose gear",
      layerId: "landingGear",
      explodeGroup: "landingGear",
      position: { x: noseX, y: 0, z: contactZ + 2.4 },
      mesh: finalize(noseLeg),
      quantityIds: gearIds,
      diffTag: "shifted",
    }),
  );
  const axle = rawMesh();
  addCylinderX(axle, 1.42, 0.065, 12);
  const axleMesh = finalize(axle);
  const spinAxle = (mesh: typeof axleMesh): typeof axleMesh => {
    const positions = new Float32Array(mesh.positions.length);
    const normals = new Float32Array(mesh.normals.length);
    for (let i = 0; i < mesh.positions.length; i += 3) {
      const x = mesh.positions[i] ?? 0;
      const y = mesh.positions[i + 1] ?? 0;
      const z = mesh.positions[i + 2] ?? 0;
      positions[i] = y;
      positions[i + 1] = x;
      positions[i + 2] = z;
      const nx = mesh.normals[i] ?? 0;
      const ny = mesh.normals[i + 1] ?? 0;
      const nz = mesh.normals[i + 2] ?? 0;
      normals[i] = ny;
      normals[i + 1] = nx;
      normals[i + 2] = nz;
    }
    return { positions, indices: mesh.indices, normals };
  };
  const axleAlongY = spinAxle(axleMesh);
  parts.push(
    makePart(variant, {
      id: "gear.axle.nose",
      name: "Nose axle",
      layerId: "landingGear",
      explodeGroup: "landingGear",
      position: { x: noseX, y: 0, z: contactZ + radius },
      mesh: axleAlongY,
      quantityIds: gearIds,
      diffTag: "shifted",
    }),
  );
  for (const side of [-1, 1] as const) {
    const sideName = side < 0 ? "left" : "right";
    const y = side * (track / 2);
    const leg = rawMesh();
    const inb = -side;
    const beam = axles === 2 ? 2.4 : 3.7;
    addMainGear(
      leg,
      inb,
      beam,
      axleXs.map((x) => x - mainX),
    );
    parts.push(
      makePart(variant, {
        id: `gear.main.${sideName}`,
        name: side < 0 ? "Main gear port" : "Main gear starboard",
        layerId: "landingGear",
        explodeGroup: "landingGear",
        position: { x: mainX, y, z: contactZ + 2.5 },
        mesh: finalize(leg),
        quantityIds: gearIds,
        diffTag: "common",
      }),
    );
    axleXs.forEach((x, index) => {
      const extra = axles === 3 && index === axles - 1;
      parts.push(
        makePart(variant, {
          id: `gear.axle.main.${sideName}.${index}`,
          name: "Main axle",
          layerId: "landingGear",
          explodeGroup: "landingGear",
          position: { x, y, z: contactZ + radius },
          mesh: axleAlongY,
          quantityIds: gearIds,
          diffTag: extra ? "added" : "common",
        }),
      );
      for (const wheel of [-1, 1] as const) {
        parts.push(
          makePart(variant, {
            id: `gear.wheel.main.${sideName}.${index}.${wheel < 0 ? 0 : 1}`,
            name: "Main wheel",
            layerId: "landingGear",
            explodeGroup: "landingGear",
            position: { x, y: y + wheel * gap, z: contactZ + radius },
            mesh: wheelMeshData(),
            quantityIds: gearIds,
            diffTag: extra ? "added" : "common",
          }),
        );
      }
    });
  }
  for (const wheel of [-1, 1] as const) {
    parts.push(
      makePart(variant, {
        id: `gear.wheel.nose.${wheel < 0 ? "left" : "right"}`,
        name: "Nose wheel",
        layerId: "landingGear",
        explodeGroup: "landingGear",
        position: { x: noseX, y: wheel * gap, z: contactZ + radius },
        mesh: wheelMeshData(),
        quantityIds: gearIds,
        diffTag: "shifted",
      }),
    );
  }
  const noseHinge: Hinge = {
    pivot: { x: noseX, y: 0, z: contactZ + 3.65 },
    axis: "y",
    sign: 1,
    channel: "gear",
    travel: 1.75,
  };
  for (const part of parts) {
    if (part.id === "gear.nose" || part.id === "gear.axle.nose" || part.id.startsWith("gear.wheel.nose.")) {
      part.hinge = noseHinge;
    }
  }
  for (const side of [-1, 1] as const) {
    const sideName = side < 0 ? "left" : "right";
    const y = side * (track / 2);
    const inb = -side;
    const mainHinge: Hinge = {
      pivot: { x: mainX - 0.14, y: y + inb * 0.62, z: contactZ + 5.05 },
      axis: "x",
      sign: side > 0 ? -1 : 1,
      channel: "gear",
      travel: 1.9,
    };
    for (const part of parts) {
      if (
        part.id === `gear.main.${sideName}` ||
        part.id.startsWith(`gear.axle.main.${sideName}.`) ||
        part.id.startsWith(`gear.wheel.main.${sideName}.`)
      ) {
        part.hinge = mainHinge;
      }
    }
  }
  return parts;
}

function addClosedSection(
  raw: ReturnType<typeof rawMesh>,
  rings: number[][],
  around: number,
): void {
  for (let s = 0; s < rings.length - 1; s += 1) {
    const a = rings[s];
    const b = rings[s + 1];
    if (!a || !b) continue;
    for (let i = 0; i < around; i += 1) {
      const a0 = a[i];
      const a1 = a[(i + 1) % around];
      const b0 = b[i];
      const b1 = b[(i + 1) % around];
      if (a0 === undefined || a1 === undefined || b0 === undefined || b1 === undefined) continue;
      addTri(raw, a0, b0, a1);
      addTri(raw, a1, b0, b1);
    }
  }
  const cap = (ring: number[] | undefined, sign: number) => {
    if (!ring || ring.length === 0) return;
    let cx = 0;
    let cy = 0;
    let cz = 0;
    for (const index of ring) {
      cx += raw.positions[index * 3] ?? 0;
      cy += raw.positions[index * 3 + 1] ?? 0;
      cz += raw.positions[index * 3 + 2] ?? 0;
    }
    const c = addVertex(raw, cx / ring.length, cy / ring.length, cz / ring.length);
    for (let i = 0; i < around; i += 1) {
      const v0 = ring[i];
      const v1 = ring[(i + 1) % around];
      if (v0 === undefined || v1 === undefined) continue;
      if (sign < 0) addTri(raw, c, v1, v0);
      else addTri(raw, c, v0, v1);
    }
  };
  cap(rings[0], -1);
  cap(rings[rings.length - 1], 1);
}

function addPylon(raw: ReturnType<typeof rawMesh>): void {
  const stations = 8;
  const around = 14;
  const rings: number[][] = [];
  for (let i = 0; i <= stations; i += 1) {
    const f = i / stations;
    const z = 1.18 + (2.08 - 1.18) * f;
    const chord = 2.4 * (1 - 0.34 * f);
    const thick = 0.42 * (1 - 0.55 * f);
    const cx = 0.15 + 0.45 * f;
    const ring: number[] = [];
    for (let k = 0; k < around; k += 1) {
      const t = (k / around) * Math.PI * 2;
      const ct = Math.cos(t);
      const pinch = Math.max(0.12, 1 - 0.72 * Math.max(0, -ct) ** 2 - 0.85 * Math.max(0, ct) ** 2);
      ring.push(addVertex(raw, cx + ct * chord * 0.5, Math.sin(t) * thick * 0.5 * pinch, z));
    }
    rings.push(ring);
  }
  addClosedSection(raw, rings, around);
}

function addFanFace(raw: ReturnType<typeof rawMesh>, xDisc: number, tip: number): void {
  const radial = 32;
  const hub = addVertex(raw, xDisc, 0, 0);
  const ring: number[] = [];
  for (let i = 0; i < radial; i += 1) {
    const t = (i / radial) * Math.PI * 2;
    ring.push(addVertex(raw, xDisc, Math.cos(t) * tip, Math.sin(t) * tip));
  }
  for (let i = 0; i < radial; i += 1) {
    const v0 = ring[i];
    const v1 = ring[(i + 1) % radial];
    if (v0 === undefined || v1 === undefined) continue;
    addTri(raw, hub, v1, v0);
  }
  addLathe(
    raw,
    [
      [xDisc - 0.72, 0],
      [xDisc - 0.48, tip * 0.12],
      [xDisc - 0.22, tip * 0.2],
      [xDisc - 0.02, tip * 0.16],
    ],
    16,
  );
  const blades = 18;
  const root = tip * 0.18;
  const chord = 0.2;
  for (let i = 0; i < blades; i += 1) {
    const t = (i / blades) * Math.PI * 2;
    const ct = Math.cos(t);
    const st = Math.sin(t);
    const at = (rad: number, side: number, xBias: number) =>
      addVertex(raw, xDisc + xBias, ct * rad - st * side, st * rad + ct * side);
    const corners: Array<[number, number, number]> = [
      [root, -chord * 0.42, -0.07],
      [root, chord * 0.28, 0.02],
      [tip * 0.98, chord * 0.1, 0.045],
      [tip * 0.98, -chord * 0.16, -0.03],
    ];
    const front = corners.map(([rad, side, xBias]) => at(rad, side, xBias));
    const back = corners.map(([rad, side, xBias]) => at(rad, side, xBias - 0.018));
    const [a, b, c, d] = front;
    const [a2, b2, c2, d2] = back;
    if (
      a === undefined || b === undefined || c === undefined || d === undefined ||
      a2 === undefined || b2 === undefined || c2 === undefined || d2 === undefined
    ) {
      continue;
    }
    addTri(raw, a, b, c);
    addTri(raw, a, c, d);
    addTri(raw, a2, c2, b2);
    addTri(raw, a2, d2, c2);
    const quads: Array<[number, number, number, number]> = [
      [a, a2, b2, b],
      [b, b2, c2, c],
      [c, c2, d2, d],
      [d, d2, a2, a],
    ];
    for (const [i0, i1, i2, i3] of quads) {
      addTri(raw, i0, i1, i2);
      addTri(raw, i0, i2, i3);
    }
  }
}

function addNacelleBody(raw: ReturnType<typeof rawMesh>): void {
  const nose = -NACELLE.lengthM / 2;
  const radius = NACELLE.radiusM;
  const radial = 36;
  // One ribbon: fan case, throat, around the intake lip, then the outer cowl to the nozzle.
  addLathe(
    raw,
    [
      [nose + 1.35, radius * 0.78],
      [nose + 1.0, radius * 0.7],
      [nose + 0.62, radius * 0.64],
      [nose + 0.28, radius * 0.74],
      [nose + 0.16, radius * 0.9],
      [nose + 0.02, radius * 1.04],
      [nose + 0.12, radius * 1.12],
      [nose + 0.28, radius * 1.08],
      [nose + 0.55, radius * 0.9],
      [nose + 0.85, radius * 0.875],
      [nose + 0.95, radius * 0.9],
      [nose + 1.5, radius * 0.88],
      [nose + 2.4, radius * 0.86],
      [nose + 2.55, radius * 0.9],
      [nose + 2.7, radius * 0.86],
      [nose + 3.5, radius * 0.84],
      [nose + 4.35, radius * 0.74],
      [nose + 4.9, radius * 0.58],
      [nose + 5.2, radius * 0.66],
      [nose + 5.42, radius * 0.5],
    ],
    radial,
  );
  addLathe(
    raw,
    [
      [nose + 5.38, radius * 0.49],
      [nose + 4.85, radius * 0.55],
      [nose + 4.3, radius * 0.59],
    ],
    radial,
  );
  addLathe(
    raw,
    [
      [nose + 4.45, 0.02],
      [nose + 4.9, radius * 0.19],
      [nose + 5.2, radius * 0.14],
      [nose + 5.32, 0.03],
    ],
    16,
  );
  addFanFace(raw, nose + 1.38, radius * 0.74);
  addPylon(raw);
}

export function buildEngines(variant: VariantId): Part[] {
  const key = suffix(variant);
  const nacelle = rawMesh();
  addNacelleBody(nacelle);
  const mesh = finalize(nacelle);
  const rating = rawMesh();
  addBox(rating, 0, 0, 0, 0.62, 0.02, 0.28);
  const ratingMesh = finalize(rating);
  const thrust = key === "900"
    ? ["q.engine.900", "q.thrust.900", "q.thrust.cont.900", "q.note.xwb84ep"]
    : ["q.engine.1000", "q.thrust.1000", "q.thrust.cont.1000"];
  const parts: Part[] = [];
  for (const side of [-1, 1] as const) {
    const y = side * SCHEMATIC.engineYM;
    const label = side < 0 ? "left" : "right";
    parts.push(
      makePart(variant, {
        id: `engine.nacelle.${label}`,
        name: side < 0 ? "Port nacelle" : "Starboard nacelle",
        layerId: "engines",
        explodeGroup: "engines",
        position: { x: SCHEMATIC.engineXM, y, z: SCHEMATIC.engineZM },
        mesh,
        quantityIds: [`q.engine.${key}`, "q.schematic.nacelle"],
        diffTag: "common",
      }),
    );
    parts.push(
      makePart(variant, {
        id: `engine.rating.${label}`,
        name: side < 0 ? "Port engine rating" : "Starboard engine rating",
        layerId: "engines",
        explodeGroup: "engines",
        position: { x: SCHEMATIC.engineXM + 0.45, y: y + side * 1.48, z: SCHEMATIC.engineZM + 0.4 },
        mesh: ratingMesh,
        quantityIds: thrust,
        diffTag: "common",
      }),
    );
  }
  return parts;
}

const ZONES: Array<[string, number, number, string, boolean]> = [
  ["flight-deck", 0, 0.06, "Flight deck", false],
  ["door-1", 0.06, 0.12, "Door 1 monument", true],
  ["premium", 0.12, 0.42, "Premium cabin", false],
  ["door-2", 0.42, 0.48, "Door 2 monument", true],
  ["economy-fwd", 0.48, 0.7, "Forward economy", false],
  ["door-3", 0.7, 0.76, "Door 3 monument", true],
  ["economy-aft", 0.76, 0.92, "Aft economy", false],
  ["door-4", 0.92, 1, "Door 4 monument", true],
];

export function buildCabin(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const constLen = ends.c1 - ends.c0;
  const key = suffix(variant);
  return ZONES.map(([id, start, end, name, door]) => {
    const x0 = ends.c0 + start * constLen;
    const x1 = ends.c0 + end * constLen;
    return boxPart(variant, {
      id: `cabin.${id}`,
      name,
      layerId: "cabin",
      explodeGroup: "cabin",
      position: { x: (x0 + x1) / 2, y: 0, z: door ? 1.15 : 0.58 },
      size: { x: Math.max(0.4, x1 - x0), y: door ? 1.55 : 3.15, z: door ? 1.85 : 0.22 },
      quantityIds: [`q.cabinLen.${key}`, "q.cabinWidthMax", "q.seats.typical." + key],
      diffTag: "shifted",
    });
  });
}

export function buildCargo(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const constLen = ends.c1 - ends.c0;
  const key = suffix(variant);
  const ids = [`q.cargo.ld3.${key}`, `q.cargo.m3.${key}`];
  const hold = (id: string, name: string, start: number, end: number, xOverride?: number): Part => {
    const x0 = xOverride ?? ends.c0 + start * constLen;
    const x1 = xOverride !== undefined ? xOverride + 4 : ends.c0 + end * constLen;
    return boxPart(variant, {
      id,
      name,
      layerId: "cargo",
      explodeGroup: "cargo",
      position: { x: (x0 + x1) / 2, y: 0, z: -0.95 },
      size: { x: Math.max(0.8, x1 - x0), y: 2.35, z: 0.4 },
      quantityIds: ids,
      diffTag: "common",
    });
  };
  return [
    hold("cargo.fwd", "Forward hold", 0.12, 0.42),
    hold("cargo.aft", "Aft hold", 0.48, 0.92),
    hold("cargo.bulk", "Bulk hold", 0, 0, ends.c1),
  ];
}

function ringLines(x: number, scale: number): number[] {
  const positions: number[] = [];
  const count = 16;
  for (let i = 0; i < count; i += 1) {
    const p0 = superellipseYZ((i / count) * Math.PI * 2, scale, A, B, N, ZC);
    const p1 = superellipseYZ((((i + 1) % count) / count) * Math.PI * 2, scale, A, B, N, ZC);
    pushLine(positions, { x, y: p0.y, z: p0.z }, { x, y: p1.y, z: p1.z });
  }
  return positions;
}

export function buildStructure(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const parts: Part[] = [];
  let index = 0;
  for (let x = ends.c0; x <= ends.c1 + 1e-6; x += SCHEMATIC.visualFrameSpacingM) {
    parts.push(
      makePart(variant, {
        id: `structure.frame.${index}`,
        name: "Visual frame",
        layerId: "structure",
        explodeGroup: "structure",
        position: { x: 0, y: 0, z: 0 },
        lines: finalizeLines(ringLines(x, 0.96)),
        quantityIds: ["q.schematic.visualFrame"],
        diffTag: "common",
      }),
    );
    index += 1;
  }
  const stringers: number[] = [];
  const xs = stations(ends.nose, ends.tail, 3);
  for (let s = 0; s < SCHEMATIC.stringerCount; s += 1) {
    const theta = (s / SCHEMATIC.stringerCount) * Math.PI * 2;
    for (let i = 0; i < xs.length - 1; i += 1) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      if (x0 === undefined || x1 === undefined) continue;
      const p0 = superellipseYZ(theta, bodyScale(x0, ends.nose, ends.c0, ends.c1, ends.tail) * 0.98, A, B, N, ZC);
      const p1 = superellipseYZ(theta, bodyScale(x1, ends.nose, ends.c0, ends.c1, ends.tail) * 0.98, A, B, N, ZC);
      pushLine(stringers, { x: x0, y: p0.y, z: p0.z }, { x: x1, y: p1.y, z: p1.z });
    }
  }
  parts.push(
    makePart(variant, {
      id: "structure.stringers",
      name: "Visual stringers",
      layerId: "structure",
      explodeGroup: "structure",
      position: { x: 0, y: 0, z: 0 },
      lines: finalizeLines(stringers),
      quantityIds: ["q.schematic.visualFrame"],
      diffTag: "common",
    }),
  );
  const beam = (id: string, group: string, z: number, y: number): Part => {
    const positions: number[] = [];
    pushLine(positions, { x: ends.c0, y, z }, { x: ends.c1, y, z });
    return makePart(variant, {
      id,
      name: id,
      layerId: "structure",
      explodeGroup: group,
      position: { x: 0, y: 0, z: 0 },
      lines: finalizeLines(positions),
      quantityIds: ["q.schematic.visualFrame"],
      diffTag: "common",
    });
  };
  parts.push(beam("structure.floor.port", "structure.floor", 0.15, -1.4));
  parts.push(beam("structure.floor.starboard", "structure.floor", 0.15, 1.4));
  parts.push(beam("structure.keel", "structure.keel", -0.6, 0));
  parts.push(beam("structure.crown", "structure.crown", 3.4, 0));
  const box: number[] = [];
  const c = [
    [WING_BOX.minX, WING_BOX.minY, WING_BOX.minZ],
    [WING_BOX.maxX, WING_BOX.minY, WING_BOX.minZ],
    [WING_BOX.maxX, WING_BOX.maxY, WING_BOX.minZ],
    [WING_BOX.minX, WING_BOX.maxY, WING_BOX.minZ],
    [WING_BOX.minX, WING_BOX.minY, WING_BOX.maxZ],
    [WING_BOX.maxX, WING_BOX.minY, WING_BOX.maxZ],
    [WING_BOX.maxX, WING_BOX.maxY, WING_BOX.maxZ],
    [WING_BOX.minX, WING_BOX.maxY, WING_BOX.maxZ],
  ] as const;
  const edges: Array<[number, number]> = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];
  for (const [i, j] of edges) {
    const a = c[i];
    const b = c[j];
    if (!a || !b) continue;
    pushLine(box, { x: a[0], y: a[1], z: a[2] }, { x: b[0], y: b[1], z: b[2] });
  }
  parts.push(
    makePart(variant, {
      id: "wing.box",
      name: "Wing box",
      layerId: "structure",
      explodeGroup: "structure.wingBox",
      position: { x: 0, y: 0, z: 0 },
      lines: finalizeLines(box),
      quantityIds: ["q.span"],
      diffTag: "common",
    }),
  );
  return parts;
}

export function buildComposites(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const positions: number[] = [];
  const xs = stations(ends.c0, ends.c1, 3);
  for (const theta of [0.6, 2.2, Math.PI + 0.6, Math.PI + 2.2]) {
    for (let i = 0; i < xs.length - 1; i += 1) {
      const x0 = xs[i];
      const x1 = xs[i + 1];
      if (x0 === undefined || x1 === undefined) continue;
      const p0 = superellipseYZ(theta, 1.01, A, B, N, ZC);
      const p1 = superellipseYZ(theta, 1.01, A, B, N, ZC);
      pushLine(positions, { x: x0, y: p0.y, z: p0.z }, { x: x1, y: p1.y, z: p1.z });
    }
  }
  for (const ySign of [-1, 1] as const) {
    for (let i = 0; i <= 12; i += 1) {
      const y0 = ySign * (2.98 + ((SEMI - 2.98) * i) / 12);
      const y1 = ySign * (2.98 + ((SEMI - 2.98) * (i + 1)) / 12);
      if (Math.abs(y1) > SEMI + 1e-6) break;
      const edge = (y: number, le: boolean) => {
        const chord = chordAtY(Math.abs(y));
        const x = sweepX(Math.abs(y)) + (le ? -0.25 * chord : 0.75 * chord);
        return { x, y, z: 0.05 };
      };
      pushLine(positions, edge(y0, true), edge(y1, true));
      pushLine(positions, edge(y0, false), edge(y1, false));
    }
  }
  return [
    makePart(variant, {
      id: "composites.shell",
      name: "Composite panel boundaries",
      layerId: "composites",
      explodeGroup: "composites",
      position: { x: 0, y: 0, z: 0 },
      lines: finalizeLines(positions),
      quantityIds: ["q.materials.composite", "q.materials.advanced"],
      diffTag: "common",
    }),
  ];
}

function localTube(points: Vec3[], origin: Vec3, radius: number): ReturnType<typeof finalize> {
  const raw = rawMesh();
  addTube(
    raw,
    points.map((p) => ({ x: p.x - origin.x, y: p.y - origin.y, z: p.z - origin.z })),
    radius,
    6,
  );
  return finalize(raw);
}

export function buildSystems(variant: VariantId, length: number): Part[] {
  const ends = sectionEnds(length);
  const parts: Part[] = [];
  const run = (
    id: string,
    name: string,
    layer: Part["layerId"],
    group: string,
    quantity: string,
    y: number,
    z: number,
    radius: number,
  ): Part => {
    const origin = { x: 0, y, z: 0 };
    const points: Vec3[] = [
      { x: ends.c0 + 2, y, z },
      { x: -4, y, z },
      { x: 6, y, z },
      { x: ends.c1 - 2, y, z },
    ];
    return makePart(variant, {
      id,
      name,
      layerId: layer,
      explodeGroup: group,
      position: origin,
      mesh: localTube(points, origin, radius),
      quantityIds: [quantity],
      diffTag: "common",
    });
  };
  parts.push(run("hydraulics.port", "Schematic hydraulic run", "hydraulics", "hydraulics", "q.schematic.hydraulic", -3, 0.4, 0.05));
  parts.push(run("hydraulics.starboard", "Schematic hydraulic run", "hydraulics", "hydraulics", "q.schematic.hydraulic", 3, 0.4, 0.05));
  parts.push(run("electrics.port", "Schematic electrical run", "electrics", "electrics", "q.schematic.electric", -4, 1.2, 0.04));
  parts.push(run("electrics.starboard", "Schematic electrical run", "electrics", "electrics", "q.schematic.electric", 4, 1.2, 0.04));
  parts.push(run("bleed.port", "Schematic bleed run", "bleedEcs", "bleedEcs", "q.schematic.bleed", -0.8, 2.6, 0.06));
  parts.push(run("bleed.starboard", "Schematic bleed run", "bleedEcs", "bleedEcs", "q.schematic.bleed", 0.8, 2.6, 0.06));
  return parts;
}

export function buildFuel(variant: VariantId): Part[] {
  const key = suffix(variant);
  const wingIds =
    key === "900"
      ? [
          "q.fuel.900.basic.wingOne",
          "q.fuel.900.basic.wingOneKg",
          "q.fuel.900.hgw.wingOne",
          "q.fuel.900.hgw.wingOneKg",
          "q.schematic.tank",
        ]
      : ["q.fuel.1000.basic.wingOne", "q.fuel.1000.basic.wingOneKg", "q.schematic.tank"];
  const centreIds =
    key === "900"
      ? [
          "q.fuel.900.basic.centre",
          "q.fuel.900.basic.centreKg",
          "q.fuel.900.basic.totalL",
          "q.fuel.900.basic.totalKg",
          "q.fuel.900.hgw.centre",
          "q.fuel.900.hgw.centreKg",
          "q.fuel.900.hgw.totalL",
          "q.fuel.900.hgw.totalKg",
          "q.derived.fuel.900.hgw.wings",
          "q.schematic.tank",
        ]
      : [
          "q.fuel.1000.basic.centre",
          "q.fuel.1000.basic.centreKg",
          "q.fuel.1000.basic.totalL",
          "q.fuel.1000.basic.totalKg",
          "q.fuel.1000.hgw.totalL",
          "q.derived.fuel.1000.hgw.kg",
          "q.schematic.fuelSplit",
          "q.schematic.tank",
        ];
  return [
    boxPart(variant, {
      id: "fuel.left",
      name: "Port wing tank",
      layerId: "fuel",
      explodeGroup: "fuel",
      position: { x: 4, y: -13, z: -0.05 },
      size: { x: 6.5, y: 9, z: 0.16 },
      quantityIds: wingIds,
      diffTag: "common",
    }),
    boxPart(variant, {
      id: "fuel.right",
      name: "Starboard wing tank",
      layerId: "fuel",
      explodeGroup: "fuel",
      position: { x: 4, y: 13, z: -0.05 },
      size: { x: 6.5, y: 9, z: 0.16 },
      quantityIds: wingIds,
      diffTag: "common",
    }),
    boxPart(variant, {
      id: "fuel.centre",
      name: "Centre tank",
      layerId: "fuel",
      explodeGroup: "fuel",
      position: { x: 1, y: 0, z: -0.12 },
      size: { x: 5.5, y: 3.6, z: 0.2 },
      quantityIds: centreIds,
      diffTag: "common",
    }),
  ];
}

function wingStation(y: number, fractionFromLe: number): Vec3 {
  const yAbs = Math.abs(y);
  const chord = chordAtY(yAbs);
  const le = sweepX(yAbs) - 0.25 * chord;
  return { x: le + chord * fractionFromLe, y, z: 0.2 };
}

function sweptPlate(origin: Vec3, y0: number, y1: number, f0: number, f1: number): ReturnType<typeof finalize> {
  const raw = rawMesh();
  const rows = 3;
  const cols = 2;
  const grids: number[][][] = [];
  for (const zSign of [1, -1] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= rows; i += 1) {
      const y = y0 + ((y1 - y0) * i) / rows;
      const row: number[] = [];
      for (let j = 0; j <= cols; j += 1) {
        const f = f0 + ((f1 - f0) * j) / cols;
        const skin = wingPoint(y, f, 1, 0);
        row.push(addVertex(raw, skin.x - origin.x, y - origin.y, skin.z - origin.z + 0.045 + zSign * 0.028));
      }
      grid.push(row);
    }
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const row = grid[i];
        const next = grid[i + 1];
        if (!row || !next) continue;
        const a = row[j];
        const b = row[j + 1];
        const c = next[j];
        const d = next[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (zSign > 0) {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        } else {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    }
    grids.push(grid);
  }
  const upper = grids[0];
  const lower = grids[1];
  if (upper && lower) {
    const edge = (ia: number, ib: number, ja: number, jb: number) => {
      for (let i = ia; i < ib; i += 1) {
        for (let j = ja; j < jb; j += 1) {
          const a = upper[i]?.[j];
          const b = upper[i + (ib - ia > 1 ? 1 : 0)]?.[j + (jb - ja > 1 ? 0 : 1)];
          const c = lower[i]?.[j];
          const d = lower[Math.min(lower.length - 1, i + 1)]?.[j];
          if (a === undefined || c === undefined || d === undefined || b === undefined) continue;
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    };
    edge(0, rows, 0, 1);
    edge(0, rows, cols, cols + 1);
  }
  return finalize(raw);
}

function skinControlPlate(origin: Vec3, y0: number, y1: number, f0: number, f1: number): ReturnType<typeof finalize> {
  const raw = rawMesh();
  const rows = 3;
  const cols = 2;
  const layers: number[][][] = [];
  for (const zOff of [-0.02, -0.09] as const) {
    const grid: number[][] = [];
    for (let i = 0; i <= rows; i += 1) {
      const y = y0 + ((y1 - y0) * i) / rows;
      const row: number[] = [];
      for (let j = 0; j <= cols; j += 1) {
        const f = f0 + ((f1 - f0) * j) / cols;
        const skin = wingPoint(y, f, -1, 0);
        row.push(addVertex(raw, skin.x - origin.x, y - origin.y, skin.z - origin.z + zOff));
      }
      grid.push(row);
    }
    for (let i = 0; i < rows; i += 1) {
      for (let j = 0; j < cols; j += 1) {
        const a = grid[i]?.[j];
        const b = grid[i]?.[j + 1];
        const c = grid[i + 1]?.[j];
        const d = grid[i + 1]?.[j + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (zOff > -0.05) {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        } else {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    }
    layers.push(grid);
  }
  const top = layers[0];
  const bottom = layers[1];
  if (top && bottom) {
    const stitch = (ia: number, ja: number, ib: number, jb: number) => {
      const a = top[ia]?.[ja];
      const b = top[ib]?.[jb];
      const c = bottom[ia]?.[ja];
      const d = bottom[ib]?.[jb];
      if (a === undefined || b === undefined || c === undefined || d === undefined) return;
      addTri(raw, a, b, c);
      addTri(raw, b, d, c);
    };
    for (let i = 0; i < rows; i += 1) {
      stitch(i, 0, i + 1, 0);
      stitch(i, cols, i + 1, cols);
    }
    for (let j = 0; j < cols; j += 1) {
      stitch(0, j, 0, j + 1);
      stitch(rows, j, rows, j + 1);
    }
  }
  return finalize(raw);
}

function addSkinControl(
  parts: Part[],
  variant: VariantId,
  id: string,
  name: string,
  y: number,
  yHalf: number,
  f0: number,
  f1: number,
  channel: "flap" | "slat",
  sign: 1 | -1,
  travel: number,
): void {
  const hingeF = channel === "flap" ? f0 : f1;
  const skin = wingPoint(y, hingeF, -1, 0);
  const pivot = { x: skin.x, y, z: skin.z };
  const dir = Math.sign(y || 1);
  const y0 = y - dir * yHalf;
  const y1 = y + dir * yHalf;
  parts.push(
    makePart(variant, {
      id,
      name,
      layerId: "skin",
      explodeGroup: "skin",
      position: pivot,
      mesh: skinControlPlate(pivot, Math.min(y0, y1), Math.max(y0, y1), f0, f1),
      quantityIds: ["q.schematic.control"],
      diffTag: "common",
      hinge: { pivot, axis: "y", sign, channel, travel },
    }),
  );
}

function rudderMesh(): ReturnType<typeof finalize> {
  const origin = { x: 32.2, y: 0, z: 7.2 };
  const raw = rawMesh();
  const steps = 6;
  const zStart = 3.8;
  const zEnd = 11.05;
  for (const ySign of [1, -1] as const) {
    const rowA: number[] = [];
    const rowB: number[] = [];
    for (let i = 0; i <= steps; i += 1) {
      const f = i / steps;
      const z = zStart + (zEnd - zStart) * f;
      const spanF = Math.min(1, Math.max(0, (z - 2.2) / (SCHEMATIC.finTipZ - 2.2)));
      const chord = 3 + (1.4 - 3) * spanF;
      const le = 30 + 1.2 * spanF;
      const thick = (0.055 * (1 - spanF) + 0.02) * ySign;
      rowA.push(addVertex(raw, le + chord * 0.7 - origin.x, thick, z - origin.z));
      rowB.push(addVertex(raw, le + chord * 0.98 - origin.x, thick * 0.35, z - origin.z));
    }
    for (let i = 0; i < steps; i += 1) {
      const a = rowA[i];
      const b = rowB[i];
      const c = rowA[i + 1];
      const d = rowB[i + 1];
      if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
      if (ySign > 0) {
        addTri(raw, a, c, b);
        addTri(raw, b, c, d);
      } else {
        addTri(raw, a, b, c);
        addTri(raw, b, d, c);
      }
    }
  }
  return finalize(raw);
}

function elevatorMesh(): ReturnType<typeof finalize> {
  const origin = { x: 30.2, y: 0, z: 4.8 };
  const raw = rawMesh();
  const bands: Array<[number, number]> = [
    [-8.6, -1.35],
    [1.35, 8.6],
  ];
  for (const [y0, y1] of bands) {
    const steps = 4;
    for (const zSign of [1, -1] as const) {
      const rowA: number[] = [];
      const rowB: number[] = [];
      for (let i = 0; i <= steps; i += 1) {
        const y = y0 + ((y1 - y0) * i) / steps;
        const spanF = Math.min(1, Math.abs(y) / 10);
        const chord = 4 + (1.5 - 4) * spanF;
        const le = 28 - 0.25 * chord;
        rowA.push(addVertex(raw, le + chord * 0.66 - origin.x, y - origin.y, zSign * 0.04));
        rowB.push(addVertex(raw, le + chord * 0.98 - origin.x, y - origin.y, zSign * 0.015));
      }
      for (let i = 0; i < steps; i += 1) {
        const a = rowA[i];
        const b = rowB[i];
        const c = rowA[i + 1];
        const d = rowB[i + 1];
        if (a === undefined || b === undefined || c === undefined || d === undefined) continue;
        if (zSign > 0) {
          addTri(raw, a, c, b);
          addTri(raw, b, c, d);
        } else {
          addTri(raw, a, b, c);
          addTri(raw, b, d, c);
        }
      }
    }
  }
  return finalize(raw);
}

export function buildControls(variant: VariantId): Part[] {
  const parts: Part[] = [];
  const plate = (id: string, name: string, y: number, yHalf: number, f0: number, f1: number): void => {
    const at = wingStation(y, (f0 + f1) / 2);
    const y0 = y - Math.sign(y || 1) * yHalf;
    const y1 = y + Math.sign(y || 1) * yHalf;
    parts.push(
      makePart(variant, {
        id,
        name,
        layerId: "flightControls",
        explodeGroup: "flightControls",
        position: at,
        mesh: sweptPlate(at, Math.min(y0, y1), Math.max(y0, y1), f0, f1),
        quantityIds: ["q.schematic.control"],
        diffTag: "common",
      }),
    );
  };
  for (const side of [-1, 1] as const) {
    const label = side < 0 ? "left" : "right";
    for (let i = 0; i < 3; i += 1) {
      const y = side * (6 + i * 5);
      plate(`flight.flap.${label}.${i}`, "Schematic flap", y, 1.45, 0.74, 0.97);
      plate(`flight.slat.${label}.${i}`, "Schematic slat", y, 1.45, 0.02, 0.14);
      addSkinControl(parts, variant, `skin.flap.${label}.${i}`, "Flap", y, 1.55, 0.62, 0.98, "flap", 1, 0.78);
      addSkinControl(parts, variant, `skin.slat.${label}.${i}`, "Slat", y, 1.55, 0.0, 0.18, "slat", -1, 0.72);
    }
    for (let i = 0; i < 4; i += 1) {
      plate(`flight.spoiler.${label}.${i}`, "Schematic spoiler", side * (8 + i * 4), 1.05, 0.52, 0.68);
    }
    plate(`flight.aileron.${label}`, "Schematic aileron", side * 27.2, 1.35, 0.7, 0.96);
  }
  parts.push(
    makePart(variant, {
      id: "flight.rudder",
      name: "Schematic rudder",
      layerId: "flightControls",
      explodeGroup: "structure.empennage",
      position: { x: 32.2, y: 0, z: 7.2 },
      mesh: rudderMesh(),
      quantityIds: ["q.schematic.control"],
      diffTag: "common",
    }),
  );
  parts.push(
    makePart(variant, {
      id: "flight.elevator",
      name: "Schematic elevator",
      layerId: "flightControls",
      explodeGroup: "structure.empennage",
      position: { x: 30.2, y: 0, z: 4.8 },
      mesh: elevatorMesh(),
      quantityIds: ["q.schematic.control"],
      diffTag: "common",
    }),
  );
  return parts;
}

export function publishedGear(variant: VariantId): { track: number; wheelbase: number; contactZ: number; length: number } {
  const key = suffix(variant);
  const track = quantityById(`q.track.${key}`).si?.value;
  const wheelbase = quantityById(`q.wheelbase.${key}`).si?.value;
  const height = quantityById(`q.height.${key}`).si?.value;
  if (track === undefined || wheelbase === undefined || height === undefined) {
    throw new Error(`Missing gear quantity for ${variant}`);
  }
  const contactZ = variant === "a350-900" ? SCHEMATIC.gearContactZ900 : SCHEMATIC.finTipZ - height;
  return {
    track,
    wheelbase,
    contactZ,
    length: variant === "a350-900" ? LEN900 : LEN1000,
  };
}

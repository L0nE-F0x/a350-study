import { sampleTranslation } from "../interaction/explode/index.ts";
import { ndcToPanePixel, projectView } from "../shared/frame/index.ts";
import { LAYER_IDS, type Assembly, type CameraState, type LayerId, type Part, type Vec3 } from "../shared/types/index.ts";

export interface PlacedLabel {
  x: number;
  y: number;
  text: string;
  selected: boolean;
  anchorX: number;
  anchorY: number;
}

export interface LabelCandidate {
  id: string;
  text: string;
  x: number;
  y: number;
  selected: boolean;
  hovered: boolean;
  layerIndex: number;
}

const OFFSETS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [0, -16],
  [0, -32],
  [16, 0],
  [-16, 0],
  [0, 16],
  [24, -24],
  [-24, -24],
  [0, -56],
  [0, -80],
  [72, -12],
  [-72, -12],
  [72, 12],
  [-72, 12],
  [0, 40],
];

const BOX_W = 148;
const BOX_H = 16;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

function overlaps(a: Box, b: Box): boolean {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function inside(box: Box, width: number, height: number): boolean {
  return box.x >= 0 && box.y >= 0 && box.x + box.w <= width && box.y + box.h <= height;
}

/** Greedy screen placement. The selected label may overlap. Others are dropped. */
export function placeLabels(items: LabelCandidate[], width: number, height: number): PlacedLabel[] {
  const ordered = [...items].sort((a, b) => {
    if (a.selected !== b.selected) return a.selected ? -1 : 1;
    if (a.hovered !== b.hovered) return a.hovered ? -1 : 1;
    if (a.layerIndex !== b.layerIndex) return a.layerIndex - b.layerIndex;
    return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
  });
  const placed: Box[] = [];
  const labels: PlacedLabel[] = [];
  let extras = 0;
  for (const item of ordered) {
    if (!item.selected && extras >= 24) continue;
    let chosen: Box | null = null;
    for (const [ox, oy] of OFFSETS) {
      const box = { x: item.x + ox, y: item.y + oy, w: BOX_W, h: BOX_H };
      if (!inside(box, width, height)) continue;
      if (placed.some((other) => overlaps(box, other))) continue;
      chosen = box;
      break;
    }
    if (!chosen && item.selected) {
      chosen = { x: item.x, y: item.y, w: BOX_W, h: BOX_H };
    }
    if (!chosen) continue;
    placed.push(chosen);
    labels.push({
      x: chosen.x,
      y: chosen.y,
      text: item.text,
      selected: item.selected,
      anchorX: item.x,
      anchorY: item.y,
    });
    if (!item.selected) extras += 1;
  }
  return labels;
}

function worldPoint(part: Part, u: number): Vec3 {
  const sampled = sampleTranslation(part, u);
  return {
    x: (part.bboxLocal.min.x + part.bboxLocal.max.x) / 2 + sampled.x,
    y: (part.bboxLocal.min.y + part.bboxLocal.max.y) / 2 + sampled.y,
    z: (part.bboxLocal.min.z + part.bboxLocal.max.z) / 2 + sampled.z,
  };
}

function layerIndex(id: LayerId): number {
  const index = LAYER_IDS.indexOf(id);
  return index < 0 ? LAYER_IDS.length : index;
}

export function partLabelsFor(
  assembly: Assembly,
  peer: Assembly | null,
  camera: CameraState,
  explode: number,
  visible: ReadonlySet<string>,
  selectedId: string | null,
  hoverId: string | null,
  width: number,
  height: number,
): PlacedLabel[] {
  if (width < 8 || height < 8) return [];
  const aspect = width / height;
  const items: LabelCandidate[] = [];
  const pushAssembly = (source: Assembly) => {
    for (const part of source.parts) {
      const selected =
        selectedId === part.id || selectedId === `${source.variantId}|${part.id}`;
      const hovered = hoverId === part.id || hoverId === `${source.variantId}|${part.id}`;
      if (!selected && !hovered) continue;
      if (!visible.has(`${source.variantId}:${part.id}`) && !selected) continue;
      const projected = projectView(worldPoint(part, explode), camera, aspect);
      const pixel = ndcToPanePixel(projected.x, projected.y, width, height);
      items.push({
        id: `${source.variantId}:${part.id}`,
        text: part.name,
        x: pixel.x,
        y: pixel.y,
        selected,
        hovered,
        layerIndex: layerIndex(part.layerId),
      });
    }
  };
  pushAssembly(assembly);
  if (peer) pushAssembly(peer);
  return placeLabels(items, width, height);
}

const TICK_W = 136;
const TICK_H = 14;
const TICK_ROWS = [0, 16, 32] as const;

export function stationTickLabels(
  minX: number,
  maxX: number,
  anchor: (x: number) => Vec3,
  camera: CameraState,
  width: number,
  height: number,
): Array<{ x: number; y: number; text: string }> {
  if (width < 8 || height < 8) return [];
  if (camera.mode !== "ortho") return [];
  if (camera.preset !== "side" && camera.preset !== "plan") return [];
  const aspect = width / height;
  const ticks: Array<{ x: number; y: number; text: string }> = [];
  const occupied: Box[] = [];
  const start = Math.ceil((minX - 1e-6) / 5) * 5;
  for (let x = start; x <= maxX + 1e-6; x += 5) {
    const station = Math.round(x);
    const projected = projectView(anchor(station), camera, aspect);
    const pixel = ndcToPanePixel(projected.x, projected.y, width, height);
    if (pixel.x < 0 || pixel.y < 0 || pixel.x > width || pixel.y > height) continue;
    let chosen: Box | null = null;
    for (const dy of TICK_ROWS) {
      let left = pixel.x;
      if (left + TICK_W > width) left = Math.max(0, width - TICK_W);
      const box = { x: left, y: pixel.y + dy, w: TICK_W, h: TICK_H };
      if (!inside(box, width, height)) continue;
      if (occupied.some((other) => overlaps(box, other))) continue;
      chosen = box;
      break;
    }
    if (!chosen) continue;
    occupied.push(chosen);
    ticks.push({ x: chosen.x, y: chosen.y, text: `x = ${station} m (study)` });
  }
  return ticks;
}

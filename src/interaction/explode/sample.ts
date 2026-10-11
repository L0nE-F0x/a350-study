import type { Part, Vec3 } from "../../shared/types/index.ts";
import { EXPLODE_OFFSETS, OUTWARD_Y } from "./offsets.ts";

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function sampleTranslation(part: Part, u: number, offsets: Record<string, Vec3> = EXPLODE_OFFSETS): Vec3 {
  const o = offsets[part.explodeGroup];
  if (!o) throw new Error(`Unknown explode group ${part.explodeGroup}`);
  const ySign = OUTWARD_Y.has(part.explodeGroup) ? part.lateralSign : 1;
  return {
    x: part.assembled.position.x + u * o.x,
    y: part.assembled.position.y + u * o.y * ySign,
    z: part.assembled.position.z + u * o.z,
  };
}

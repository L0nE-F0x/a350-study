export const FRAME = {
  unit: "m" as const,
  handedness: "right" as const,
  /** Positive X is aft, toward the tail. Nose is negative X. */
  axisX: "aft",
  /** Positive Y is starboard (right when looking forward). */
  axisY: "starboard",
  /** Positive Z is up. z = 0 is the wing reference plane, not the ground. */
  axisZ: "up",
  /**
   * Origin is the schematic wing reference point:
   * fuselage centreline, wing reference plane, x = 0 at half the A350-900 overall length.
   * This is not an OEM fuselage station.
   */
  origin: "schematic-wrp-a350-900-midlength",
} as const;

export {
  anglesForPreset,
  fitOrtho,
  ndcToPanePixel,
  orbitBasis,
  presetBasis,
  projectOrtho,
  projectView,
  type OrthoPreset,
  type ViewBasis,
} from "./project.ts";

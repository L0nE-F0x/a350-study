import type { Vec3 } from "../../shared/types/index.ts";

export const EXPLODE_OFFSETS: Record<string, Vec3> = {
  skin: { x: 0, y: 0, z: 4 },
  structure: { x: 0, y: 0, z: 0 },
  "structure.floor": { x: 0, y: 0, z: -1.2 },
  "structure.keel": { x: 0, y: 0, z: -2.4 },
  "structure.crown": { x: 0, y: 0, z: 2.2 },
  "structure.wingBox": { x: 0, y: 0, z: -0.6 },
  "structure.empennage": { x: 8, y: 0, z: 1 },
  composites: { x: 0, y: 0, z: 5.2 },
  cabin: { x: 0, y: 0, z: 1.5 },
  cargo: { x: 0, y: 0, z: -3.2 },
  flightControls: { x: 0, y: 6, z: 1.5 },
  fuel: { x: 0, y: 3, z: -1.5 },
  hydraulics: { x: 0, y: 6, z: 0 },
  electrics: { x: 0, y: -6, z: 0 },
  bleedEcs: { x: 0, y: 0, z: 6.5 },
  landingGear: { x: 0, y: 0, z: -5 },
  engines: { x: 0, y: 8, z: -2 },
  dimensions: { x: 0, y: 0, z: 0 },
};

export const OUTWARD_Y = new Set(["flightControls", "fuel", "hydraulics", "engines"]);

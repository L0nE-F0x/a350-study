export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

export const LAYER_IDS = [
  "skin",
  "structure",
  "composites",
  "cabin",
  "cargo",
  "flightControls",
  "fuel",
  "hydraulics",
  "electrics",
  "bleedEcs",
  "landingGear",
  "engines",
  "dimensions",
  "differences",
] as const;

export type LayerId = (typeof LAYER_IDS)[number];

export type DiffTag = "common" | "shifted" | "added";

export interface Pose {
  position: Vec3;
}

export interface BBox {
  min: Vec3;
  max: Vec3;
}

export interface MeshData {
  positions: Float32Array;
  indices: Uint32Array;
  normals: Float32Array;
  /** Per vertex. 0 paint, 1 window, 2 door, 3 port nav, 4 starboard nav, 5 beacon, 6 tail light, 7 landing light. */
  glow?: Float32Array;
}

export interface LineData {
  positions: Float32Array;
}

export type HingeChannel = "gear" | "flap" | "slat";

/** Rotation about a shared assembly pivot. Angle is sign * travel * channel, in the study frame. */
export interface Hinge {
  pivot: Vec3;
  axis: "x" | "y";
  sign: 1 | -1;
  channel: HingeChannel;
  travel: number;
}

export interface Part {
  id: string;
  variantId: "a350-900" | "a350-1000";
  layerId: LayerId;
  explodeGroup: string;
  name: string;
  lateralSign: 1 | -1;
  assembled: Pose;
  bboxLocal: BBox;
  mesh?: MeshData;
  lines?: LineData;
  instances?: { mesh: MeshData; count: number; matrices: Float32Array };
  quantityIds: string[];
  diffTag: DiffTag;
  pickable: boolean;
  hinge?: Hinge;
}

export interface Assembly {
  variantId: "a350-900" | "a350-1000";
  parts: Part[];
  /** Union of part bboxes at u = 0, study frame. */
  bbox: BBox;
  wheelContactZ: number;
  measures: {
    lengthM: number;
    spanM: number;
    heightM: number;
    trackM: number;
    wheelbaseM: number;
  };
}

export type ClipAxis = "none" | "x" | "y" | "z";

export interface ClipState {
  axis: ClipAxis;
  /**
   * 0 at the reference bbox min on that axis, 1 at the max.
   * The reference bbox is always the assembled (u = 0) bbox, never the exploded one.
   */
  t: number;
}

export interface CameraState {
  mode: "ortho" | "inspect";
  /**
   * `orbit` is the sentinel written when a drag leaves a named preset.
   * Azimuth and elevation are unused while a named preset is active.
   */
  preset: "plan" | "side" | "front" | "three-quarter" | "orbit";
  orbit: { azimuthRad: number; elevationRad: number; target: Vec3; orthoHalfHeight: number };
}

export interface PaneState {
  variantId: "a350-900" | "a350-1000";
  weightColumn: "regional" | "basic" | "highGross";
  camera: CameraState;
  explode: number;
  /** 0 is Gate, 6 is 10,000 ft. Fractional while a phase play is running. */
  phase: number;
  overlays: Record<LayerId, boolean>;
  soloLayerId: LayerId | null;
  clip: ClipState;
  hiddenLines: boolean;
}

export type ViewMode = "single" | "split-vertical" | "split-horizontal" | "overlay";

export interface LinkState {
  camera: boolean;
  explode: boolean;
  overlays: boolean;
  clip: boolean;
}

export interface AppState {
  mode: ViewMode;
  link: LinkState;
  panes: [PaneState, PaneState];
  selection: { pane: 0 | 1; partId: string } | null;
  hover: { pane: 0 | 1; partId: string } | null;
  unit: "m" | "ft";
}

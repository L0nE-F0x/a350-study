import type { DiffTag, LayerId, Part } from "../shared/types/index.ts";

export type SlotId =
  | "skinBody"
  | "skinEmpennage"
  | "cabin"
  | "cargo"
  | "flight"
  | "fuel"
  | "gearWheels"
  | "gearBeams"
  | "engines"
  | "structure"
  | "composites"
  | "hydraulics"
  | "electrics"
  | "bleed"
  | "skip";

export type DrawnSlot = Exclude<SlotId, "skip">;

export const DRAW_SLOTS: readonly DrawnSlot[] = [
  "skinBody",
  "skinEmpennage",
  "cabin",
  "cargo",
  "flight",
  "fuel",
  "gearWheels",
  "gearBeams",
  "engines",
  "structure",
  "composites",
  "hydraulics",
  "electrics",
  "bleed",
];

const LAYER_SLOT: Partial<Record<LayerId, DrawnSlot>> = {
  cabin: "cabin",
  cargo: "cargo",
  flightControls: "flight",
  fuel: "fuel",
  engines: "engines",
  structure: "structure",
  composites: "composites",
  hydraulics: "hydraulics",
  electrics: "electrics",
  bleedEcs: "bleed",
};

export function slotFor(part: Part): SlotId {
  if (part.layerId === "dimensions" || part.layerId === "differences") return "skip";
  if (part.id.startsWith("gear.") && part.name.toLowerCase().includes("wheel")) return "gearWheels";
  if (part.layerId === "landingGear") return "gearBeams";
  if (part.layerId === "skin") {
    return part.explodeGroup === "structure.empennage" ? "skinEmpennage" : "skinBody";
  }
  return LAYER_SLOT[part.layerId] ?? "skip";
}

export function slotLayer(slot: DrawnSlot): LayerId {
  switch (slot) {
    case "skinBody":
    case "skinEmpennage":
      return "skin";
    case "cabin":
      return "cabin";
    case "cargo":
      return "cargo";
    case "flight":
      return "flightControls";
    case "fuel":
      return "fuel";
    case "gearWheels":
    case "gearBeams":
      return "landingGear";
    case "engines":
      return "engines";
    case "structure":
      return "structure";
    case "composites":
      return "composites";
    case "hydraulics":
      return "hydraulics";
    case "electrics":
      return "electrics";
    case "bleed":
      return "bleedEcs";
    default: {
      const neverSlot: never = slot;
      return neverSlot;
    }
  }
}

export function slotKind(slot: DrawnSlot): "surface" | "lines" | "wheels" {
  if (slot === "gearWheels") return "wheels";
  if (slot === "structure" || slot === "composites") return "lines";
  return "surface";
}

/** Surface meshes that receive one EdgesGeometry pass. Tubes and line layers do not. */
export function slotDrawsEdges(slot: DrawnSlot): boolean {
  switch (slot) {
    case "skinBody":
    case "skinEmpennage":
    case "cabin":
    case "cargo":
    case "flight":
    case "fuel":
    case "gearWheels":
    case "gearBeams":
    case "engines":
      return true;
    default:
      return false;
  }
}

/** Per-vertex factor multiplied by the material opacity. Common parts dim to about 0.15. */
export function diffPartOpacity(tag: DiffTag, enabled: boolean, layerOpacity: number): number {
  if (!enabled || tag !== "common") return 1;
  if (layerOpacity <= 1e-6) return 1;
  return 0.15 / layerOpacity;
}

/** Yellow edge opacity, or null when the part is not in the differences line set. */
export function diffEdgeOpacity(tag: DiffTag): number | null {
  if (tag === "shifted") return 0.7;
  if (tag === "added") return 1;
  return null;
}

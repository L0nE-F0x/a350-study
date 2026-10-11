import { LAYER_IDS, type Assembly, type LayerId, type PaneState } from "../../shared/types/index.ts";

export function defaultOverlays(): Record<LayerId, boolean> {
  const overlays = {} as Record<LayerId, boolean>;
  for (const id of LAYER_IDS) {
    overlays[id] = id === "skin" || id === "dimensions" || id === "engines" || id === "landingGear";
  }
  return overlays;
}

export function hiddenLinesActive(pane: PaneState): boolean {
  return pane.hiddenLines && (pane.soloLayerId === "skin" || pane.soloLayerId === "structure");
}

export function partitionVisibility(assembly: Assembly, pane: PaneState): { solid: string[]; ghost: string[] } {
  const solid: string[] = [];
  const ghost: string[] = [];
  const solo = pane.soloLayerId;
  for (const part of assembly.parts) {
    if (part.layerId === "dimensions" || part.layerId === "differences") continue;
    if (!pane.overlays[part.layerId]) continue;
    if (solo && part.layerId !== solo) ghost.push(part.id);
    else solid.push(part.id);
  }
  return { solid, ghost };
}

export function visiblePartIds(assembly: Assembly, pane: PaneState): string[] {
  const { solid, ghost } = partitionVisibility(assembly, pane);
  return solid.concat(ghost);
}

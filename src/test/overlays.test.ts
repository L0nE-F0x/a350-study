import { beforeEach, describe, expect, it } from "vitest";
import { initStore, getStore, resetStore } from "../app/store.ts";
import { buildVariant } from "../data/airframe/index.ts";
import { defaultOverlays, partitionVisibility } from "../interaction/overlays/index.ts";
import { LAYER_IDS, type Assembly, type LayerId, type ViewMode } from "../shared/types/index.ts";

const a900 = buildVariant("a350-900");
const a1000 = buildVariant("a350-1000");

function state() {
  return getStore().getState();
}

beforeEach(() => {
  initStore(a900, a1000);
  resetStore();
});

describe("defaults", () => {
  it("opens a single linked study with skin and dimensions", () => {
    const store = getStore();
    expect(typeof store.getState).toBe("function");
    expect(typeof store.setState).toBe("function");
    expect(typeof store.subscribe).toBe("function");
    const current = state();
    expect(current.mode).toBe("single");
    expect(current.link).toEqual({ camera: true, explode: true, overlays: true, clip: true });
    expect(current.panes[0].variantId).toBe("a350-900");
    expect(current.panes[1].variantId).toBe("a350-1000");
    expect(current.panes[0].variantId).not.toBe(current.panes[1].variantId);
    expect(current.panes[0].weightColumn).toBe("highGross");
    expect(current.panes[1].weightColumn).toBe("highGross");
    expect(current.panes[0].camera.preset).toBe("three-quarter");
    expect(current.panes[1].camera.preset).toBe("three-quarter");
    expect(current.panes[0].camera.mode).toBe("inspect");
    expect(current.panes[0].explode).toBe(0);
    expect(current.panes[1].explode).toBe(0);
    expect(current.unit).toBe("m");
    expect(current.panes[0].overlays).toEqual(defaultOverlays());
    expect(current.panes[1].overlays).toEqual(defaultOverlays());
    expect(current.panes[0].overlays.skin).toBe(true);
    expect(current.panes[0].overlays.dimensions).toBe(true);
    expect(current.panes[0].overlays.engines).toBe(true);
    expect(current.panes[0].overlays.landingGear).toBe(true);
    for (const layer of LAYER_IDS) {
      if (layer === "skin" || layer === "dimensions" || layer === "engines" || layer === "landingGear") continue;
      expect(current.panes[0].overlays[layer]).toBe(false);
    }
  });

  it("resetStore restores that default", () => {
    state().setMode("split-vertical");
    state().setUnit("ft");
    resetStore();
    expect(state().mode).toBe("single");
    expect(state().unit).toBe("m");
    expect(state().panes[0].variantId).toBe("a350-900");
    expect(state().panes[1].variantId).toBe("a350-1000");
  });
});

describe("variants and columns", () => {
  it("never lets the two panes share a variant", () => {
    state().setVariant(0, "a350-1000");
    expect(state().panes[0].variantId).toBe("a350-1000");
    expect(state().panes[1].variantId).toBe("a350-900");
    expect(state().panes[0].variantId).not.toBe(state().panes[1].variantId);
    state().setVariant(1, "a350-1000");
    expect(state().panes[1].variantId).toBe("a350-1000");
    expect(state().panes[0].variantId).toBe("a350-900");
  });

  it("refuses a regional column on the -1000", () => {
    state().setWeightColumn(1, "basic");
    expect(state().panes[1].weightColumn).toBe("basic");
    state().setWeightColumn(1, "regional");
    expect(state().panes[1].weightColumn).not.toBe("regional");
    expect(state().panes[1].weightColumn === "basic" || state().panes[1].weightColumn === "highGross").toBe(true);
    expect(state().panes[1].weightColumn).toBe("basic");
    state().setWeightColumn(1, "highGross");
    state().setWeightColumn(1, "regional");
    expect(state().panes[1].weightColumn).toBe("highGross");
  });
});

describe("overlay links", () => {
  const modes = ["single", "split-vertical", "split-horizontal", "overlay"] as const satisfies readonly ViewMode[];

  it("does not copy an unlinked overlay write, including in overlay mode", () => {
    for (const mode of modes) {
      resetStore();
      state().setMode(mode);
      state().setLink("overlays", false);
      expect(state().link.overlays).toBe(false);
      const before = { ...state().panes[1].overlays };
      state().setOverlays(0, "fuel", true);
      expect(state().panes[0].overlays.fuel).toBe(true);
      expect(state().panes[1].overlays).toEqual(before);
      expect(state().panes[1].overlays.fuel).toBe(false);
    }
  });

  it("writes a linked overlay to both panes", () => {
    state().setLink("overlays", true);
    state().setOverlays(0, "fuel", true);
    expect(state().panes[0].overlays.fuel).toBe(true);
    expect(state().panes[1].overlays.fuel).toBe(true);
    state().setMode("overlay");
    state().setOverlays(0, "hydraulics", true);
    expect(state().panes[0].overlays.hydraulics).toBe(true);
    expect(state().panes[1].overlays.hydraulics).toBe(true);
  });

  it("forces camera, explode, and clip while overlay is active", () => {
    state().setLink("camera", false);
    state().setLink("explode", false);
    state().setLink("clip", false);
    state().setMode("overlay");
    expect(state().link.camera).toBe(true);
    expect(state().link.explode).toBe(true);
    expect(state().link.clip).toBe(true);
    state().setLink("camera", false);
    expect(state().link.camera).toBe(true);
    state().setLink("overlays", false);
    expect(state().link.overlays).toBe(false);
    expect(state().mode).toBe("overlay");
  });

  it("writes explode, clip, and preset to pane 0 only while overlay is active", () => {
    state().setLink("explode", false);
    state().setExplode(1, 0.2);
    expect(state().panes[1].explode).toBe(0.2);
    state().setLink("clip", false);
    state().setClip(1, { axis: "y", t: 0.3 });
    const clipBefore = { ...state().panes[1].clip };
    state().setLink("camera", false);
    state().setPreset(1, "front");
    expect(state().panes[1].camera.preset).toBe("front");
    state().setMode("overlay");
    const explodeBefore = state().panes[1].explode;
    const presetBefore = state().panes[1].camera.preset;
    state().setExplode(1, 0.4);
    expect(state().panes[0].explode).toBe(0.4);
    expect(state().panes[1].explode).toBe(explodeBefore);
    state().setClip(1, { axis: "z", t: 0.2 });
    expect(state().panes[0].clip).toEqual({ axis: "z", t: 0.2 });
    expect(state().panes[1].clip).toEqual(clipBefore);
    state().setPreset(1, "plan");
    expect(state().panes[0].camera.preset).toBe("plan");
    expect(state().panes[1].camera.preset).toBe(presetBefore);
  });

  it("copies pane 0 camera on unlink and then stops following", () => {
    expect(state().mode).not.toBe("overlay");
    state().setLink("camera", false);
    state().setPreset(1, "front");
    expect(state().panes[0].camera.preset).toBe("three-quarter");
    expect(state().panes[1].camera.preset).toBe("front");
    state().setLink("camera", false);
    expect(state().panes[1].camera.preset).toBe(state().panes[0].camera.preset);
    expect(state().panes[1].camera.preset).toBe("three-quarter");
    state().setPreset(0, "plan");
    expect(state().panes[0].camera.preset).toBe("plan");
    expect(state().panes[1].camera.preset).toBe("three-quarter");
  });

  it("linkAll turns every channel on, including overlays in overlay mode", () => {
    state().setLink("camera", false);
    state().setLink("explode", false);
    state().setLink("overlays", false);
    state().setLink("clip", false);
    state().linkAll();
    expect(state().link).toEqual({ camera: true, explode: true, overlays: true, clip: true });
    state().setMode("overlay");
    state().setLink("overlays", false);
    expect(state().link.overlays).toBe(false);
    state().linkAll();
    expect(state().link.camera).toBe(true);
    expect(state().link.explode).toBe(true);
    expect(state().link.clip).toBe(true);
    expect(state().link.overlays).toBe(true);
  });
});

describe("partitionVisibility", () => {
  function skinIds(assembly: Assembly): string[] {
    return assembly.parts.filter((part) => part.layerId === "skin").map((part) => part.id);
  }

  it("puts skin, engines, and gear in the default solid set", () => {
    const pane = state().panes[0];
    const { solid, ghost } = partitionVisibility(a900, pane);
    const shown = a900.parts
      .filter((part) => part.layerId === "skin" || part.layerId === "engines" || part.layerId === "landingGear")
      .map((part) => part.id);
    expect(ghost).toEqual([]);
    expect(solid).toEqual(shown);
    expect(solid).toEqual(expect.arrayContaining(skinIds(a900)));
    const structureIds = a900.parts.filter((part) => part.layerId === "structure").map((part) => part.id);
    expect(structureIds.length).toBeGreaterThan(0);
    for (const id of structureIds) {
      expect(solid).not.toContain(id);
      expect(ghost).not.toContain(id);
    }
  });

  it("ghosts other layers that are on when skin is solo", () => {
    const before = a900.parts.length;
    state().setLink("overlays", false);
    state().setOverlays(0, "fuel", true);
    state().setOverlays(0, "structure", true);
    state().setSolo(0, "skin");
    const pane = state().panes[0];
    const { solid, ghost } = partitionVisibility(a900, pane);
    expect(solid).toEqual(skinIds(a900));
    const ghostIds = a900.parts
      .filter(
        (part) =>
          part.layerId === "fuel" ||
          part.layerId === "structure" ||
          part.layerId === "engines" ||
          part.layerId === "landingGear",
      )
      .map((part) => part.id);
    expect(ghostIds.length).toBeGreaterThan(0);
    expect(ghost).toEqual(ghostIds);
    expect(a900.parts.length).toBe(before);
    state().setOverlays(0, "fuel", false);
    const hidden = partitionVisibility(a900, state().panes[0]);
    const fuelIds = a900.parts.filter((part) => part.layerId === "fuel").map((part) => part.id);
    expect(fuelIds.length).toBeGreaterThan(0);
    for (const id of fuelIds) {
      expect(hidden.solid).not.toContain(id);
      expect(hidden.ghost).not.toContain(id);
    }
  });

  it("does not change the assembly when differences is on", () => {
    const before = a900.parts.length;
    state().setLink("overlays", false);
    state().setOverlays(0, "differences", true);
    expect(a900.parts.length).toBe(before);
    expect(state().assemblies["a350-900"].parts.length).toBe(before);
    const off: LayerId = "cargo";
    expect(state().panes[0].overlays[off]).toBe(false);
    const { solid, ghost } = partitionVisibility(a900, state().panes[0]);
    const cargoIds = a900.parts.filter((part) => part.layerId === off).map((part) => part.id);
    expect(cargoIds.length).toBeGreaterThan(0);
    for (const id of cargoIds) {
      expect(solid).not.toContain(id);
      expect(ghost).not.toContain(id);
    }
  });
});

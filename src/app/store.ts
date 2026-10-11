import { createStore, type StoreApi } from "zustand/vanilla";
import { anglesForPreset, fitOrtho, type OrthoPreset } from "../shared/frame/index.ts";
import type {
  AppState,
  Assembly,
  CameraState,
  ClipState,
  LayerId,
  LinkState,
  PaneState,
  Vec3,
  ViewMode,
} from "../shared/types/index.ts";
import { defaultOverlays } from "../interaction/overlays/index.ts";

export interface OrbitInput {
  azimuthRad: number;
  elevationRad: number;
  target: Vec3;
  orthoHalfHeight: number;
  mode: CameraState["mode"];
}

export interface StudyState extends AppState {
  assemblies: { "a350-900": Assembly; "a350-1000": Assembly };
  aspects: [number, number];
  setMode: (mode: ViewMode) => void;
  setVariant: (pane: 0 | 1, id: "a350-900" | "a350-1000") => void;
  setWeightColumn: (pane: 0 | 1, column: PaneState["weightColumn"]) => void;
  setPreset: (pane: 0 | 1, preset: OrthoPreset) => void;
  setInspect: (pane: 0 | 1, mode?: CameraState["mode"]) => void;
  setExplode: (pane: 0 | 1, u: number) => void;
  setPhase: (pane: 0 | 1, phase: number) => void;
  setClip: (pane: 0 | 1, clip: ClipState) => void;
  setOverlays: (pane: 0 | 1, layer: LayerId, on: boolean) => void;
  setSolo: (pane: 0 | 1, layer: LayerId) => void;
  setHiddenLines: (pane: 0 | 1, on: boolean) => void;
  setLink: (channel: keyof LinkState, on: boolean) => void;
  linkAll: () => void;
  setUnit: (unit: "m" | "ft") => void;
  setSelection: (selection: AppState["selection"]) => void;
  setHover: (hover: AppState["hover"]) => void;
  setAspect: (pane: 0 | 1, aspect: number) => void;
  setOrbit: (pane: 0 | 1, next: OrbitInput) => void;
}

let api: StoreApi<StudyState> | null = null;
let pair: { "a350-900": Assembly; "a350-1000": Assembly } | null = null;

function opposite(id: "a350-900" | "a350-1000"): "a350-900" | "a350-1000" {
  return id === "a350-900" ? "a350-1000" : "a350-900";
}

function cameraFor(variant: "a350-900" | "a350-1000", preset: OrthoPreset, aspect: number, mode: CameraState["mode"]): CameraState {
  const assembly = pair?.[variant];
  if (!assembly) throw new Error("Assemblies are not loaded");
  // The three-quarter fit projects bbox corners, which overshoot a swept, cross-shaped airframe.
  const margin = preset === "three-quarter" ? (aspect < 1 ? 1 : 0.84) : 1.15;
  const fit = fitOrtho(assembly.bbox, aspect, margin, preset);
  const angles = anglesForPreset(preset);
  return {
    mode,
    preset,
    orbit: {
      azimuthRad: angles.azimuthRad,
      elevationRad: angles.elevationRad,
      target: fit.target,
      orthoHalfHeight: fit.halfHeight,
    },
  };
}

function blankPane(variant: "a350-900" | "a350-1000", aspect: number): PaneState {
  return {
    variantId: variant,
    weightColumn: "highGross",
    camera: cameraFor(variant, "three-quarter", aspect, "inspect"),
    explode: 0,
    phase: 0,
    overlays: defaultOverlays(),
    soloLayerId: null,
    clip: { axis: "none", t: 0.55 },
    hiddenLines: false,
  };
}

function clonePane(pane: PaneState): PaneState {
  return {
    ...pane,
    overlays: { ...pane.overlays },
    clip: { ...pane.clip },
    camera: {
      ...pane.camera,
      orbit: { ...pane.camera.orbit, target: { ...pane.camera.orbit.target } },
    },
  };
}

function copyChannel(from: PaneState, to: PaneState, channel: keyof LinkState): void {
  if (channel === "camera") to.camera = clonePane(from).camera;
  if (channel === "explode") {
    to.explode = from.explode;
    to.phase = from.phase;
  }
  if (channel === "clip") to.clip = { ...from.clip };
  if (channel === "overlays") to.overlays = { ...from.overlays };
}

export function initStore(a900: Assembly, a1000: Assembly): StoreApi<StudyState> {
  pair = { "a350-900": a900, "a350-1000": a1000 };
  if (!api) {
    api = createStore<StudyState>()((set, get) => makeState(set, get));
  } else {
    api.setState(makeState(api.setState, api.getState), true);
  }
  return api;
}

export function resetStore(): void {
  if (!api || !pair) throw new Error("Store is not initialised");
  api.setState(makeState(api.setState, api.getState), true);
}

export function getStore(): StoreApi<StudyState> {
  if (!api) throw new Error("Store is not initialised");
  return api;
}

function makeState(
  set: StoreApi<StudyState>["setState"],
  get: StoreApi<StudyState>["getState"],
): StudyState {
  const assemblies = pair;
  if (!assemblies) throw new Error("Assemblies are not loaded");

  const writePanes = (index: 0 | 1, channel: "camera" | "explode" | "clip", apply: (pane: PaneState) => void): void => {
    const state = get();
    const overlay = state.mode === "overlay";
    const linked = state.link[channel];
    const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
    if (overlay || linked) {
      apply(panes[0]);
      if (!overlay && linked) copyChannel(panes[0], panes[1], channel);
    } else {
      apply(panes[index]);
    }
    set({ panes });
  };

  const refit = (panes: [PaneState, PaneState], aspects: [number, number], linked: boolean): void => {
    const fitOne = (index: 0 | 1) => {
      const pane = panes[index];
      if (pane.camera.preset === "orbit") return;
      pane.camera = cameraFor(pane.variantId, pane.camera.preset, aspects[index], pane.camera.mode);
    };
    if (linked) {
      fitOne(0);
      panes[1].camera = clonePane(panes[0]).camera;
    } else {
      fitOne(0);
      fitOne(1);
    }
  };

  return {
    mode: "single",
    link: { camera: true, explode: true, overlays: true, clip: true },
    panes: (() => {
      const pane0 = blankPane("a350-900", 1.6);
      const pane1 = blankPane("a350-1000", 1.6);
      pane1.camera = clonePane(pane0).camera;
      pane1.explode = pane0.explode;
      pane1.phase = pane0.phase;
      pane1.clip = { ...pane0.clip };
      pane1.overlays = { ...pane0.overlays };
      return [pane0, pane1] as [PaneState, PaneState];
    })(),
    selection: null,
    hover: null,
    unit: "m",
    assemblies,
    aspects: [1.6, 1.6],
    setMode(mode) {
      const state = get();
      const link = { ...state.link };
      if (mode === "overlay") {
        link.camera = true;
        link.explode = true;
        link.clip = true;
      }
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      refit(panes, state.aspects, link.camera);
      set({ mode, link, panes });
    },
    setVariant(index, id) {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      const other: 0 | 1 = index === 0 ? 1 : 0;
      panes[index].variantId = id;
      panes[other].variantId = opposite(id);
      for (const pane of panes) {
        if (pane.variantId === "a350-1000" && pane.weightColumn === "regional") pane.weightColumn = "highGross";
      }
      refit(panes, state.aspects, state.link.camera);
      set({ panes, selection: null, hover: null });
    },
    setWeightColumn(index, column) {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      const pane = panes[index];
      if (pane.variantId === "a350-1000" && column === "regional") return;
      pane.weightColumn = column;
      set({ panes });
    },
    setPreset(index, preset) {
      const state = get();
      const fitted: 0 | 1 = state.mode === "overlay" || state.link.camera ? 0 : index;
      writePanes(index, "camera", (pane) => {
        pane.camera = cameraFor(pane.variantId, preset, get().aspects[fitted], pane.camera.mode);
      });
    },
    setInspect(index, mode) {
      writePanes(index, "camera", (pane) => {
        pane.camera = {
          ...pane.camera,
          mode: mode ?? (pane.camera.mode === "inspect" ? "ortho" : "inspect"),
        };
      });
    },
    setExplode(index, u) {
      const value = Math.min(1, Math.max(0, u));
      writePanes(index, "explode", (pane) => {
        pane.explode = value;
      });
    },
    setPhase(index, phase) {
      const value = Math.min(6, Math.max(0, phase));
      writePanes(index, "explode", (pane) => {
        pane.phase = value;
      });
    },
    setClip(index, clip) {
      writePanes(index, "clip", (pane) => {
        pane.clip = { axis: clip.axis, t: Math.min(1, Math.max(0, clip.t)) };
      });
    },
    setOverlays(index, layer, on) {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      const targets: Array<0 | 1> = state.link.overlays ? [0, 1] : [index];
      for (const target of targets) panes[target].overlays[layer] = on;
      set({ panes });
    },
    setSolo(index, layer) {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      const pane = panes[index];
      pane.soloLayerId = pane.soloLayerId === layer ? null : layer;
      set({ panes });
    },
    setHiddenLines(index, on) {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      panes[index].hiddenLines = on;
      set({ panes });
    },
    setLink(channel, on) {
      const state = get();
      if (state.mode === "overlay" && (channel === "camera" || channel === "explode" || channel === "clip")) {
        set({ link: { ...state.link, [channel]: true } });
        return;
      }
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      copyChannel(panes[0], panes[1], channel);
      set({ panes, link: { ...state.link, [channel]: on } });
    },
    linkAll() {
      const state = get();
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      copyChannel(panes[0], panes[1], "camera");
      copyChannel(panes[0], panes[1], "explode");
      copyChannel(panes[0], panes[1], "clip");
      copyChannel(panes[0], panes[1], "overlays");
      set({
        panes,
        link: { camera: true, explode: true, overlays: true, clip: true },
      });
    },
    setUnit(unit) {
      set({ unit });
    },
    setSelection(selection) {
      set({ selection });
    },
    setHover(hover) {
      set({ hover });
    },
    setAspect(index, aspect) {
      const state = get();
      const aspects: [number, number] = [state.aspects[0], state.aspects[1]];
      aspects[index] = aspect;
      const panes: [PaneState, PaneState] = [clonePane(state.panes[0]), clonePane(state.panes[1])];
      refit(panes, aspects, state.link.camera || state.mode === "overlay");
      set({ aspects, panes });
    },
    setOrbit(index, next) {
      writePanes(index, "camera", (pane) => {
        pane.camera = {
          mode: next.mode,
          preset: "orbit",
          orbit: {
            azimuthRad: next.azimuthRad,
            elevationRad: next.elevationRad,
            target: { ...next.target },
            orthoHalfHeight: next.orthoHalfHeight,
          },
        };
      });
    },
  };
}

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { easeInOutCubic, sampleTranslation } from "../interaction/explode/index.ts";
import { partitionVisibility } from "../interaction/overlays/index.ts";
import { mountScene, type SceneHandle } from "../scene/index.ts";
import type { ClipAxis, LayerId, LinkState, ViewMode } from "../shared/types/index.ts";
import { AppShell, Gate, type PartLabel, type TickLabel } from "../ui/index.ts";
import { partLabelsFor, stationTickLabels } from "./labels.ts";
import { annotationsFor, dimensionFor, gapEntries, gateFigures, readoutFor, specsFor } from "./readout.ts";
import { getStore, type StudyState } from "./store.ts";

interface Size {
  w: number;
  h: number;
}

interface HudSnap {
  fps: number;
  triangles: number;
  calls: number;
  slow: boolean;
}

function useStudy(): StudyState {
  const store = getStore();
  return useSyncExternalStore(store.subscribe, store.getState, store.getState);
}

const PHONE_QUERY = "(max-width: 767px), (max-height: 520px)";
const TABLET_QUERY = "(min-width: 768px) and (max-width: 1099px)";
const DIRECT_KEY = "a350-study-direct";
const HINT_KEY = "a350-study-hint-seen";

function typingTarget(target: EventTarget | null): boolean {
  return target instanceof HTMLInputElement || target instanceof HTMLSelectElement || target instanceof HTMLTextAreaElement;
}

function readDirect(): boolean {
  try {
    return localStorage.getItem(DIRECT_KEY) === "1";
  } catch {
    return false;
  }
}

function readHintSeen(): boolean {
  try {
    return localStorage.getItem(HINT_KEY) === "1";
  } catch {
    return false;
  }
}

function writeHintSeen(): void {
  try {
    localStorage.setItem(HINT_KEY, "1");
  } catch {
    /* private mode */
  }
}

function writeDirect(on: boolean): void {
  try {
    localStorage.setItem(DIRECT_KEY, on ? "1" : "0");
  } catch {
    /* private mode */
  }
}

function hashIsStudy(): boolean {
  return window.location.hash === "#study";
}

function visibleKeys(state: StudyState, index: 0 | 1, overlayPeer: boolean): Set<string> {
  const keys = new Set<string>();
  const pane = state.panes[index];
  const assembly = state.assemblies[pane.variantId];
  const vis = partitionVisibility(assembly, pane);
  for (const id of vis.solid) keys.add(`${pane.variantId}:${id}`);
  if (!overlayPeer) return keys;
  const peerPane = state.panes[1];
  const peer = state.assemblies[peerPane.variantId];
  const peerVis = partitionVisibility(peer, peerPane);
  for (const id of peerVis.solid) keys.add(`${peerPane.variantId}:${id}`);
  return keys;
}

export function App() {
  const study = useStudy();
  const handles = useRef<[SceneHandle | null, SceneHandle | null]>([null, null]);
  const observers = useRef<[ResizeObserver | null, ResizeObserver | null]>([null, null]);
  const tween = useRef(0);
  const phaseTween = useRef(0);
  const [sizes, setSizes] = useState<[Size, Size]>([
    { w: 0, h: 0 },
    { w: 0, h: 0 },
  ]);
  const [hud, setHud] = useState<{ fps: string; triangles: string; calls: string; warn: string | null } | null>(null);
  const [limitsOpen, setLimitsOpen] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [showHint, setShowHint] = useState(() => !readHintSeen());
  const [layout, setLayout] = useState({ phone: false, tablet: false });
  const [direct, setDirect] = useState(readDirect);
  const [open, setOpen] = useState(() => {
    if (hashIsStudy()) return true;
    if (window.location.hash === "" && readDirect()) {
      history.replaceState(null, "", `${window.location.pathname}${window.location.search}#study`);
      return true;
    }
    return false;
  });
  const openRef = useRef(open);
  openRef.current = open;

  const stopTween = useCallback(() => {
    cancelAnimationFrame(tween.current);
  }, []);

  const runTween = useCallback(
    (pane: 0 | 1, target: 0 | 1) => {
      stopTween();
      const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const from = getStore().getState().panes[pane].explode;
      if (reduce || from === target) {
        getStore().getState().setExplode(pane, target);
        return;
      }
      const started = performance.now();
      const step = (now: number) => {
        const t = Math.min(1, (now - started) / 600);
        getStore().getState().setExplode(pane, from + (target - from) * easeInOutCubic(t));
        if (t < 1) tween.current = requestAnimationFrame(step);
      };
      tween.current = requestAnimationFrame(step);
    },
    [stopTween],
  );

  const stopPhase = useCallback(() => {
    cancelAnimationFrame(phaseTween.current);
    setPlaying(false);
  }, []);

  const runPhase = useCallback((pane: 0 | 1) => {
    cancelAnimationFrame(phaseTween.current);
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const current = getStore().getState().panes[pane].phase;
    const from = current > 5.5 ? 0 : current;
    const target = 6;
    if (reduce || from === target) {
      getStore().getState().setPhase(pane, target);
      setPlaying(false);
      return;
    }
    setPlaying(true);
    const started = performance.now();
    const duration = Math.max(400, (target - from) * 3200);
    const step = (now: number) => {
      const t = Math.min(1, (now - started) / duration);
      getStore().getState().setPhase(pane, from + (target - from) * t);
      if (t < 1) phaseTween.current = requestAnimationFrame(step);
      else setPlaying(false);
    };
    phaseTween.current = requestAnimationFrame(step);
  }, []);

  const dismissHint = useCallback(() => {
    writeHintSeen();
    setShowHint(false);
  }, []);

  const onCanvas = useCallback((pane: 0 | 1, canvas: HTMLCanvasElement | null) => {
    handles.current[pane]?.dispose();
    handles.current[pane] = null;
    observers.current[pane]?.disconnect();
    observers.current[pane] = null;
    if (!canvas) return;
    const measure = () => {
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      if (h > 0) {
        const aspect = w / h;
        const current = getStore().getState().aspects[pane];
        if (Math.abs(current - aspect) > 0.01) getStore().getState().setAspect(pane, aspect);
      }
      setSizes((prev) => {
        const next: [Size, Size] = [
          { w: prev[0].w, h: prev[0].h },
          { w: prev[1].w, h: prev[1].h },
        ];
        next[pane] = { w, h };
        return next;
      });
    };
    const observer = new ResizeObserver(measure);
    observer.observe(canvas);
    observers.current[pane] = observer;
    handles.current[pane] = mountScene(canvas, {
      getPane: () => getStore().getState().panes[pane],
      getAssembly: () => {
        const state = getStore().getState();
        return state.assemblies[state.panes[pane].variantId];
      },
      getPeer: () => {
        const state = getStore().getState();
        if (state.mode !== "overlay" || pane !== 0) return null;
        const other = state.panes[1];
        return { assembly: state.assemblies[other.variantId], pane: other };
      },
      getVisibility: (assembly, mask) => partitionVisibility(assembly, mask),
      samplePart: (part, u) => sampleTranslation(part, u),
      subscribe: (listener) => getStore().subscribe(listener),
      onPick: (partId) => getStore().getState().setSelection(partId ? { pane, partId } : null),
      onHover: (partId) => getStore().getState().setHover(partId ? { pane, partId } : null),
      onOrbit: (next) =>
        getStore().getState().setOrbit(pane, {
          azimuthRad: next.azimuthRad,
          elevationRad: next.elevationRad,
          target: next.target,
          orthoHalfHeight: next.orthoHalfHeight,
          mode: next.mode,
        }),
    });
    measure();
  }, []);

  useEffect(() => {
    const phoneQ = window.matchMedia(PHONE_QUERY);
    const tabletQ = window.matchMedia(TABLET_QUERY);
    const apply = () => setLayout({ phone: phoneQ.matches, tablet: !phoneQ.matches && tabletQ.matches });
    apply();
    phoneQ.addEventListener("change", apply);
    tabletQ.addEventListener("change", apply);
    return () => {
      phoneQ.removeEventListener("change", apply);
      tabletQ.removeEventListener("change", apply);
    };
  }, []);

  useEffect(() => {
    const onHash = () => setOpen(hashIsStudy());
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  const enter = useCallback(() => {
    if (hashIsStudy()) {
      setOpen(true);
      return;
    }
    window.location.hash = "study";
  }, []);

  const leave = useCallback(() => {
    history.pushState(null, "", `${window.location.pathname}${window.location.search}`);
    setOpen(false);
  }, []);

  const onDirect = useCallback((on: boolean) => {
    writeDirect(on);
    setDirect(on);
  }, []);

  const playingRef = useRef(playing);
  playingRef.current = playing;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!openRef.current) return;
      if (typingTarget(event.target)) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (document.querySelector('[aria-modal="true"]')) return;
      const phone = window.matchMedia(PHONE_QUERY).matches;
      const state = getStore().getState();
      if (event.key === "Escape") {
        state.setSelection(null);
        return;
      }
      if (event.key === "?") {
        setHelpOpen((value) => !value);
        return;
      }
      if (event.key === " " && !(event.target instanceof HTMLButtonElement)) {
        event.preventDefault();
        if (playingRef.current) stopPhase();
        else runPhase(0);
        return;
      }
      if (event.key === "u" || event.key === "U") {
        state.setUnit(state.unit === "m" ? "ft" : "m");
        return;
      }
      if (!phone && (event.key === "e" || event.key === "E")) {
        runTween(0, state.panes[0].explode > 0.5 ? 0 : 1);
        return;
      }
      if (event.key === "1") state.setPreset(0, "plan");
      else if (event.key === "2") state.setPreset(0, "side");
      else if (event.key === "3") state.setPreset(0, "front");
      else if (event.key === "4") state.setPreset(0, "three-quarter");
      else if (event.key === "f" || event.key === "F") state.setInspect(0);
      else if (!phone && (event.key === "[" || event.key === "]")) {
        event.preventDefault();
        stopTween();
        const step = event.key === "]" ? 0.05 : -0.05;
        state.setExplode(0, state.panes[0].explode + step);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [stopTween, runTween, runPhase, stopPhase]);

  useEffect(() => {
    if (!import.meta.env.DEV) return;
    let raf = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 400) {
        last = now;
        const primary = handles.current[0]?.getHud() ?? null;
        const secondary = handles.current[1]?.getHud() ?? null;
        const snaps = [primary, secondary].filter((item): item is HudSnap => item !== null);
        if (snaps.length > 0) {
          const fps = Math.min(...snaps.map((item) => item.fps));
          const shown = snaps[0];
          setHud({
            fps: String(Math.round(fps)),
            triangles: String(Math.round(shown?.triangles ?? 0)),
            calls: String(Math.round(shown?.calls ?? 0)),
            warn: snaps.some((item) => item.slow) ? "Below 50 fps. Turn an overlay off." : null,
          });
        }
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(
    () => () => {
      stopTween();
      cancelAnimationFrame(phaseTween.current);
      handles.current[0]?.dispose();
      handles.current[1]?.dispose();
      observers.current[0]?.disconnect();
      observers.current[1]?.disconnect();
    },
    [stopTween],
  );

  const onClipAxis = useCallback((pane: 0 | 1, axis: ClipAxis) => {
    const clip = getStore().getState().panes[pane].clip;
    if (axis === "none") {
      getStore().getState().setClip(pane, { axis: "none", t: clip.t });
      return;
    }
    getStore().getState().setClip(pane, { axis, t: clip.axis === "none" ? 0.55 : clip.t });
  }, []);

  if (!open) {
    return (
      <Gate
        unit={study.unit}
        direct={direct}
        figures={gateFigures(study.unit)}
        onUnit={(unit) => getStore().getState().setUnit(unit)}
        onDirect={onDirect}
        onEnter={enter}
      />
    );
  }

  const focus = study.selection ?? study.hover;
  const partLabels: [PartLabel[], PartLabel[]] = [0, 1].map((index) => {
    const pane = index as 0 | 1;
    const size = sizes[pane];
    const assembly = study.assemblies[study.panes[pane].variantId];
    const overlay = study.mode === "overlay" && pane === 0;
    const peer = overlay ? study.assemblies[study.panes[1].variantId] : null;
    const selectedHere =
      focus && (focus.pane === pane || (overlay && focus.pane === 0)) ? focus.partId : null;
    return partLabelsFor(
      assembly,
      peer,
      study.panes[pane].camera,
      study.mode === "overlay" ? study.panes[0].explode : study.panes[pane].explode,
      visibleKeys(study, pane, overlay),
      selectedHere,
      study.hover && (study.hover.pane === pane || overlay) ? study.hover.partId : null,
      size.w,
      size.h,
    );
  }) as [PartLabel[], PartLabel[]];

  const stationTicks: [TickLabel[], TickLabel[]] = [0, 1].map((index) => {
    const pane = index as 0 | 1;
    const view = study.panes[pane];
    if (!view.overlays.dimensions) return [];
    const size = sizes[pane];
    const assembly = study.assemblies[view.variantId];
    const peer = study.mode === "overlay" && pane === 0 ? study.assemblies[study.panes[1].variantId] : null;
    const minX = peer ? Math.min(assembly.bbox.min.x, peer.bbox.min.x) : assembly.bbox.min.x;
    const maxX = peer ? Math.max(assembly.bbox.max.x, peer.bbox.max.x) : assembly.bbox.max.x;
    const bbox = peer && peer.bbox.max.y > assembly.bbox.max.y ? peer.bbox : assembly.bbox;
    return stationTickLabels(
      minX,
      maxX,
      (x) =>
        view.camera.preset === "plan"
          ? { x, y: bbox.max.y + 2, z: 0 }
          : { x, y: 0, z: bbox.min.z },
      view.camera,
      size.w,
      size.h,
    );
  }) as [TickLabel[], TickLabel[]];

  return (
    <AppShell
      mode={study.mode}
      link={study.link}
      panes={study.panes}
      unit={study.unit}
      phone={layout.phone}
      tablet={layout.tablet}
      hud={import.meta.env.DEV ? hud : null}
      amberHint={study.mode === "overlay"}
      inspectNote={study.panes[0].camera.mode === "inspect"}
      annotations={annotationsFor(study)}
      specs={specsFor(study)}
      readout={readoutFor(study)}
      gaps={gapEntries()}
      limitsOpen={limitsOpen}
      helpOpen={helpOpen}
      playing={playing}
      showHint={showHint}
      dimensionLabels={[dimensionFor(study, 0), dimensionFor(study, 1)]}
      stationTicks={stationTicks}
      partLabels={partLabels}
      onCanvas={onCanvas}
      onMode={(mode: ViewMode) => getStore().getState().setMode(mode)}
      onVariant={(pane, id) => getStore().getState().setVariant(pane, id)}
      onColumn={(pane, column) => getStore().getState().setWeightColumn(pane, column)}
      onPreset={(pane, preset) => getStore().getState().setPreset(pane, preset)}
      onInspect={(pane) => getStore().getState().setInspect(pane)}
      onExplode={(pane, u) => {
        stopTween();
        getStore().getState().setExplode(pane, u);
      }}
      onExplodeTo={runTween}
      onPhase={(pane, phase) => {
        stopPhase();
        getStore().getState().setPhase(pane, phase);
      }}
      onPlayPhase={runPhase}
      onPausePhase={stopPhase}
      onClipAxis={onClipAxis}
      onClipT={(pane, t) => {
        const clip = getStore().getState().panes[pane].clip;
        getStore().getState().setClip(pane, { axis: clip.axis, t });
      }}
      onOverlay={(pane, layer: LayerId, on) => getStore().getState().setOverlays(pane, layer, on)}
      onSolo={(pane, layer) => getStore().getState().setSolo(pane, layer)}
      onHiddenLines={(pane, on) => getStore().getState().setHiddenLines(pane, on)}
      onLink={(channel: keyof LinkState, on) => getStore().getState().setLink(channel, on)}
      onLinkAll={() => getStore().getState().linkAll()}
      onUnit={(unit) => getStore().getState().setUnit(unit)}
      onClearSelection={() => getStore().getState().setSelection(null)}
      onOpenLimits={() => setLimitsOpen(true)}
      onCloseLimits={() => setLimitsOpen(false)}
      onOpenHelp={() => setHelpOpen(true)}
      onCloseHelp={() => setHelpOpen(false)}
      onDismissHint={dismissHint}
      onLeave={leave}
    />
  );
}

import type { CSSProperties } from "react";
import { PHASE_LABELS, PHASE_LAST, flightPose } from "../shared/phase/index.ts";
import type { PaneState, ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { cx } from "./cx.ts";
import { Icon } from "./Icon.tsx";
import { VARIANT_LABEL, variantColor } from "./model.ts";

interface PhaseBarProps {
  mode: ViewMode;
  linkExplode: boolean;
  panes: [PaneState, PaneState];
  playing: boolean;
  onPhase: (pane: 0 | 1, phase: number) => void;
  onPlay: (pane: 0 | 1) => void;
  onPause: () => void;
}

function gearText(gear: number): string {
  if (gear <= 0.01) return "Down";
  if (gear >= 0.99) return "Up";
  return "In transit";
}

function flapText(flap: number): string {
  if (flap <= 0.01) return "Up";
  if (flap >= 0.99) return "Take-off";
  return "Extending";
}

function Status({ pane }: { pane: PaneState }) {
  const pose = flightPose(pane.phase, pane.explode);
  const lights = [
    { id: "nav", label: "Nav", on: pose.nav > 0.5 },
    { id: "beacon", label: "Beacon", on: pose.beacon > 0.5 },
    { id: "strobe", label: "Strobe", on: pose.strobe > 0.5 },
    { id: "land", label: "Landing", on: pose.land > 0.5 },
  ];
  return (
    <div className={styles.flightStatus} aria-live="polite">
      <span className={styles.statusItem}>
        <span className={styles.statusKey}>Gear</span>
        <span>{gearText(pose.gear)}</span>
      </span>
      <span className={styles.statusItem}>
        <span className={styles.statusKey}>Flaps</span>
        <span>{flapText(pose.flap)}</span>
      </span>
      <span className={styles.statusItem}>
        <span className={styles.statusKey}>Lights</span>
        <span className={styles.lights}>
          {lights.map((light) => (
            <span key={light.id} className={styles.light} data-on={light.on} data-kind={light.id}>
              {light.label}
            </span>
          ))}
        </span>
      </span>
    </div>
  );
}

export function PhaseBar({ mode, linkExplode, panes, playing, onPhase, onPlay, onPause }: PhaseBarProps) {
  const indices: (0 | 1)[] = mode === "single" || mode === "overlay" || linkExplode ? [0] : [0, 1];
  return (
    <div className={styles.toolBody}>
      {indices.map((index) => {
        const pane = panes[index];
        const active = Math.round(pane.phase);
        const dual = indices.length > 1;
        const fill = (pane.phase / PHASE_LAST) * 100;
        return (
          <div key={index} className={styles.flightRow}>
            {dual ? (
              <span className={styles.paneTag}>
                <span className={styles.dot} style={{ background: variantColor(pane.variantId) }} aria-hidden="true" />
                {VARIANT_LABEL[pane.variantId]}
              </span>
            ) : null}
            <button
              type="button"
              className={cx([styles.playBtn, playing ? styles.playBtnOn : undefined])}
              aria-label={playing ? "Pause" : "Play"}
              data-tip={playing ? "Pause  ·  Space" : "Play the departure  ·  Space"}
              data-tip-side="top"
              onClick={() => (playing ? onPause() : onPlay(index))}
            >
              <Icon name={playing ? "pause" : "play"} size={16} />
            </button>
            <div className={styles.timeline} style={{ "--fill": `${fill}%` } as CSSProperties}>
              <div className={styles.timelineTrack} aria-hidden="true">
                {PHASE_LABELS.map((label, phase) => (
                  <span
                    key={label}
                    className={styles.timelineStop}
                    data-passed={pane.phase >= phase - 0.001}
                    style={{ "--at": phase / PHASE_LAST } as CSSProperties}
                  />
                ))}
              </div>
              <input
                className={styles.timelineRange}
                type="range"
                min={0}
                max={PHASE_LAST}
                step={0.01}
                value={pane.phase}
                aria-label={dual ? `Flight phase ${VARIANT_LABEL[pane.variantId]}` : "Flight phase"}
                aria-valuetext={PHASE_LABELS[active]}
                onChange={(event) => {
                  const next = Number(event.target.value);
                  if (Number.isFinite(next)) onPhase(index, next);
                }}
              />
              <div className={styles.timelineLabels} role="group" aria-label={dual ? `Phases ${VARIANT_LABEL[pane.variantId]}` : "Phases"}>
                {PHASE_LABELS.map((label, phase) => (
                  <button
                    key={label}
                    type="button"
                    className={styles.timelineLabel}
                    aria-pressed={active === phase}
                    style={{ "--at": phase / PHASE_LAST } as CSSProperties}
                    onClick={() => onPhase(index, phase)}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        );
      })}
      <Status pane={panes[0]} />
    </div>
  );
}

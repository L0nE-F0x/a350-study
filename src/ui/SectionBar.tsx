import type { ClipAxis, PaneState, ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { Segmented, Slider, percent } from "./Controls.tsx";
import { VARIANT_LABEL, variantColor } from "./model.ts";

const CLIP_AXES = [
  { id: "none", label: "Off" },
  { id: "x", label: "X", title: "Fuselage station: cut across the body" },
  { id: "y", label: "Y", title: "Buttock line: cut along the centreline" },
  { id: "z", label: "Z", title: "Waterline: cut through the decks" },
] as const satisfies readonly { id: ClipAxis; label: string; title?: string }[];

const AXIS_NOTE: Record<ClipAxis, string> = {
  none: "Pick an axis to cut the airframe open.",
  x: "Fuselage station. Slides from nose to tail.",
  y: "Buttock line. Slides from wingtip to wingtip.",
  z: "Waterline. Slides from the gear to the fin tip.",
};

interface SectionBarProps {
  mode: ViewMode;
  linkClip: boolean;
  panes: [PaneState, PaneState];
  onClipAxis: (pane: 0 | 1, axis: ClipAxis) => void;
  onClipT: (pane: 0 | 1, t: number) => void;
}

export function SectionBar({ mode, linkClip, panes, onClipAxis, onClipT }: SectionBarProps) {
  const indices: (0 | 1)[] = mode === "single" || mode === "overlay" || linkClip ? [0] : [0, 1];
  return (
    <div className={styles.toolBody}>
      {indices.map((index) => {
        const pane = panes[index];
        const dual = indices.length > 1;
        const parked = pane.clip.axis === "none";
        return (
          <div key={index} className={styles.sliderTool}>
            {dual ? (
              <span className={styles.paneTag}>
                <span className={styles.dot} style={{ background: variantColor(pane.variantId) }} aria-hidden="true" />
                {VARIANT_LABEL[pane.variantId]}
              </span>
            ) : null}
            <Segmented
              label={dual ? `Section axis ${VARIANT_LABEL[pane.variantId]}` : "Section axis"}
              value={pane.clip.axis}
              options={CLIP_AXES}
              onChange={(axis) => onClipAxis(index, axis)}
            />
            <div className={styles.sliderWrap}>
              <Slider
                label={dual ? `Section ${VARIANT_LABEL[pane.variantId]}` : "Section"}
                min={0}
                max={1}
                step={0.01}
                value={pane.clip.t}
                disabled={parked}
                onChange={(t) => onClipT(index, t)}
              />
              <span className={styles.sliderValue}>{parked ? "–" : percent(pane.clip.t)}</span>
            </div>
          </div>
        );
      })}
      <p className={styles.toolHint}>{AXIS_NOTE[panes[0].clip.axis]}</p>
    </div>
  );
}

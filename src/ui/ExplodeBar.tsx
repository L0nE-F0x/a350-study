import type { PaneState, ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { Icon } from "./Icon.tsx";
import { Slider, percent } from "./Controls.tsx";
import { VARIANT_LABEL, variantColor } from "./model.ts";

interface ExplodeBarProps {
  mode: ViewMode;
  linkExplode: boolean;
  panes: [PaneState, PaneState];
  onExplode: (pane: 0 | 1, u: number) => void;
  onExplodeTo: (pane: 0 | 1, target: 0 | 1) => void;
}

export function ExplodeBar({ mode, linkExplode, panes, onExplode, onExplodeTo }: ExplodeBarProps) {
  const indices: (0 | 1)[] = mode === "single" || mode === "overlay" || linkExplode ? [0] : [0, 1];

  return (
    <div className={styles.toolBody}>
      {indices.map((index) => {
        const pane = panes[index];
        const dual = indices.length > 1;
        return (
          <div key={index} className={styles.sliderTool}>
            {dual ? (
              <span className={styles.paneTag}>
                <span className={styles.dot} style={{ background: variantColor(pane.variantId) }} aria-hidden="true" />
                {VARIANT_LABEL[pane.variantId]}
              </span>
            ) : null}
            <button
              type="button"
              className={styles.pillBtn}
              aria-pressed={pane.explode <= 0.001}
              data-tip="Reassemble  ·  E"
              data-tip-side="top"
              onClick={() => onExplodeTo(index, 0)}
            >
              <Icon name="collapse" size={14} />
              Reassemble
            </button>
            <div className={styles.sliderWrap}>
              <Slider
                label={dual ? `Explode ${VARIANT_LABEL[pane.variantId]}` : "Explode"}
                min={0}
                max={1}
                step={0.01}
                value={pane.explode}
                onChange={(u) => onExplode(index, u)}
              />
              <span className={styles.sliderValue}>{percent(pane.explode)}</span>
            </div>
            <button
              type="button"
              className={styles.pillBtn}
              aria-pressed={pane.explode >= 0.999}
              data-tip="Explode  ·  E   ·   nudge with [ and ]"
              data-tip-side="top"
              onClick={() => onExplodeTo(index, 1)}
            >
              <Icon name="expand" size={14} />
              Explode
            </button>
          </div>
        );
      })}
      <p className={styles.toolHint}>
        {"Separates the skin, engines, and landing gear. While exploded, the departure parks on the pad."}
      </p>
    </div>
  );
}

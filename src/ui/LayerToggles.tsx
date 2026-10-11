import { useState, type CSSProperties } from "react";
import { LAYER_IDS, type LayerId, type PaneState, type ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { cx } from "./cx.ts";
import { Icon } from "./Icon.tsx";
import { Segmented, Switch } from "./Controls.tsx";
import { VARIANT_LABEL, variantColor } from "./model.ts";
import { LAYER_SWATCH } from "./swatch.ts";

export const LAYER_LABEL: Record<LayerId, string> = {
  skin: "Skin",
  structure: "Structure",
  composites: "Composites",
  cabin: "Cabin",
  cargo: "Cargo",
  flightControls: "Flight controls",
  fuel: "Fuel",
  hydraulics: "Hydraulics",
  electrics: "Electrics",
  bleedEcs: "Bleed / ECS",
  landingGear: "Landing gear",
  engines: "Engines",
  dimensions: "Dimensions",
  differences: "Differences",
};

const GROUPS: { id: string; label: string; layers: LayerId[] }[] = [
  { id: "airframe", label: "Airframe", layers: ["skin", "structure", "composites"] },
  { id: "interior", label: "Interior", layers: ["cabin", "cargo"] },
  { id: "systems", label: "Systems", layers: ["flightControls", "fuel", "hydraulics", "electrics", "bleedEcs"] },
  { id: "running", label: "Propulsion & gear", layers: ["engines", "landingGear"] },
  { id: "notes", label: "Annotations", layers: ["dimensions", "differences"] },
];

const PRESETS: { id: string; label: string; on: readonly LayerId[] }[] = [
  { id: "exterior", label: "Exterior", on: ["skin", "landingGear", "engines", "dimensions"] },
  {
    id: "systems",
    label: "Systems",
    on: ["structure", "flightControls", "fuel", "hydraulics", "electrics", "bleedEcs", "landingGear", "engines"],
  },
  { id: "interior", label: "Interior", on: ["structure", "cabin", "cargo", "landingGear", "engines"] },
  { id: "compare", label: "Changes", on: ["skin", "landingGear", "engines", "dimensions", "differences"] },
];

interface LayerTogglesProps {
  mode: ViewMode;
  phone: boolean;
  linkOverlays: boolean;
  panes: [PaneState, PaneState];
  onOverlay: (pane: 0 | 1, layer: LayerId, on: boolean) => void;
  onSolo: (pane: 0 | 1, layer: LayerId) => void;
  onHiddenLines: (pane: 0 | 1, on: boolean) => void;
}

function soloable(id: LayerId): boolean {
  return id !== "dimensions" && id !== "differences";
}

export function LayerToggles({
  mode,
  phone,
  linkOverlays,
  panes,
  onOverlay,
  onSolo,
  onHiddenLines,
}: LayerTogglesProps) {
  const perPane = !phone && mode !== "single" && !linkOverlays;
  const [chosen, setChosen] = useState<0 | 1>(0);
  const index: 0 | 1 = perPane ? chosen : 0;
  const pane = panes[index];
  const onCount = LAYER_IDS.filter((id) => pane.overlays[id]).length;
  const suppressed = pane.hiddenLines && pane.soloLayerId !== "skin" && pane.soloLayerId !== "structure";

  const applyPreset = (on: readonly LayerId[]) => {
    for (const id of LAYER_IDS) {
      const want = on.includes(id);
      if (pane.overlays[id] !== want) onOverlay(index, id, want);
    }
    if (pane.soloLayerId) onSolo(index, pane.soloLayerId);
  };

  const activePreset = PRESETS.find((preset) =>
    LAYER_IDS.every((id) => pane.overlays[id] === preset.on.includes(id)),
  );

  return (
    <div className={styles.layerPanel}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>
          <Icon name="layers" size={15} />
          <h2>Layers</h2>
          <span className={styles.count}>{`${onCount} on`}</span>
        </div>
      </div>

      {perPane ? (
        <Segmented
          label="Layers for pane"
          size="s"
          stretch
          value={chosen === 0 ? "a" : "b"}
          options={[
            { id: "a", label: VARIANT_LABEL[panes[0].variantId], dot: variantColor(panes[0].variantId) },
            { id: "b", label: VARIANT_LABEL[panes[1].variantId], dot: variantColor(panes[1].variantId) },
          ]}
          onChange={(id) => setChosen(id === "a" ? 0 : 1)}
        />
      ) : null}

      <div className={styles.presetRow} role="group" aria-label="Layer presets">
        {PRESETS.map((preset) => (
          <button
            key={preset.id}
            type="button"
            className={styles.chip}
            aria-pressed={activePreset?.id === preset.id}
            onClick={() => applyPreset(preset.on)}
          >
            {preset.label}
          </button>
        ))}
      </div>

      {pane.soloLayerId ? (
        <div className={styles.soloBanner} role="status">
          <span className={styles.dot} style={{ background: LAYER_SWATCH[pane.soloLayerId] }} aria-hidden="true" />
          <span>
            {"Solo "}
            <strong>{LAYER_LABEL[pane.soloLayerId]}</strong>
            {". Other layers are ghosted."}
          </span>
          <button
            type="button"
            className={styles.linkBtn}
            onClick={() => {
              if (pane.soloLayerId) onSolo(index, pane.soloLayerId);
            }}
          >
            Clear
          </button>
        </div>
      ) : null}

      <div className={styles.layerGroups}>
        {GROUPS.map((group) => (
          <section key={group.id} className={styles.layerGroup} aria-label={group.label}>
            <p className={styles.eyebrow}>{group.label}</p>
            <div className={styles.layerList}>
              {group.layers.map((id) => {
                const on = pane.overlays[id];
                const solo = pane.soloLayerId === id;
                return (
                  <div
                    key={id}
                    className={cx([styles.layerRow, solo ? styles.layerRowSolo : undefined])}
                    data-on={on}
                    style={{ "--swatch": LAYER_SWATCH[id] } as CSSProperties}
                  >
                    <button
                      type="button"
                      className={styles.layerBtn}
                      aria-pressed={on}
                      onClick={() => onOverlay(index, id, !on)}
                    >
                      <span className={styles.swatch} aria-hidden="true" />
                      <span className={styles.layerName}>{LAYER_LABEL[id]}</span>
                      <span className={styles.switch} data-on={on} aria-hidden="true" />
                    </button>
                    {soloable(id) ? (
                      <button
                        type="button"
                        className={styles.soloBtn}
                        aria-pressed={solo}
                        aria-label={`Solo ${LAYER_LABEL[id]}`}
                        data-tip={solo ? "Clear solo" : "Solo: ghost the other layers"}
                        data-tip-side="left"
                        onClick={() => onSolo(index, id)}
                      >
                        <Icon name="target" size={14} />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      <div className={styles.panelFoot}>
        <Switch
          on={pane.hiddenLines}
          label="Hidden lines"
          hint={suppressed ? "Suppressed while several layers are on" : "Draws the study edges"}
          onChange={(on) => onHiddenLines(index, on)}
        />
      </div>
    </div>
  );
}

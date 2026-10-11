import type { PaneState } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { cx } from "./cx.ts";
import { Icon, type IconName } from "./Icon.tsx";
import type { OrthoPresetId } from "./model.ts";

const PRESETS: { id: OrthoPresetId; label: string; icon: IconName; key: string }[] = [
  { id: "plan", label: "Plan", icon: "viewPlan", key: "1" },
  { id: "side", label: "Side", icon: "viewSide", key: "2" },
  { id: "front", label: "Front", icon: "viewFront", key: "3" },
  { id: "three-quarter", label: "Three-quarter", icon: "cube", key: "4" },
];

interface ViewToolsProps {
  pane: PaneState;
  index: 0 | 1;
  compact?: boolean;
  onPreset: (pane: 0 | 1, preset: OrthoPresetId) => void;
  onInspect: (pane: 0 | 1) => void;
}

export function ViewTools({ pane, index, compact, onPreset, onInspect }: ViewToolsProps) {
  const inspect = pane.camera.mode === "inspect";
  return (
    <div className={cx([styles.viewTools, compact ? styles.viewToolsCompact : undefined])} role="toolbar" aria-label="View">
      {PRESETS.map((preset) => (
        <button
          key={preset.id}
          type="button"
          className={styles.viewBtn}
          aria-pressed={pane.camera.preset === preset.id}
          aria-label={preset.label}
          data-tip={`${preset.label}  ·  ${preset.key}`}
          data-tip-side={compact ? "bottom" : "left"}
          onClick={() => onPreset(index, preset.id)}
        >
          <Icon name={preset.icon} size={17} />
        </button>
      ))}
      <span className={styles.viewSep} aria-hidden="true" />
      <button
        type="button"
        className={styles.viewBtn}
        aria-pressed={inspect}
        aria-label="Inspect"
        data-tip={inspect ? "Perspective inspect is on  ·  F" : "Perspective inspect  ·  F"}
        data-tip-side={compact ? "bottom" : "left"}
        onClick={() => onInspect(index)}
      >
        <Icon name="perspective" size={17} />
      </button>
    </div>
  );
}

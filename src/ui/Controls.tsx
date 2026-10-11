import type { CSSProperties, ReactNode } from "react";
import styles from "./styles/shell.module.css";
import { cx } from "./cx.ts";
import { Icon, type IconName } from "./Icon.tsx";

export interface SegmentOption<T extends string> {
  id: T;
  label: string;
  icon?: IconName;
  /** Accessible name when the label is hidden. */
  title?: string;
  dot?: string;
  disabled?: boolean;
}

interface SegmentedProps<T extends string> {
  label: string;
  value: T | null;
  options: readonly SegmentOption<T>[];
  onChange: (id: T) => void;
  size?: "s" | "m";
  iconOnly?: boolean;
  stretch?: boolean;
  className?: string;
}

export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  size = "m",
  iconOnly = false,
  stretch = false,
  className,
}: SegmentedProps<T>) {
  return (
    <div
      className={cx([
        styles.segmented,
        size === "s" ? styles.segmentedS : undefined,
        stretch ? styles.stretch : undefined,
        className,
      ])}
      role="group"
      aria-label={label}
    >
      {options.map((option) => (
        <button
          key={option.id}
          type="button"
          className={styles.segment}
          aria-pressed={value === option.id}
          aria-label={iconOnly ? option.title ?? option.label : undefined}
          data-tip={iconOnly ? option.title ?? option.label : option.title}
          disabled={option.disabled}
          onClick={() => onChange(option.id)}
        >
          {option.dot ? <span className={styles.dot} style={{ background: option.dot }} aria-hidden="true" /> : null}
          {option.icon ? <Icon name={option.icon} size={15} /> : null}
          {iconOnly ? null : <span className={styles.segmentLabel}>{option.label}</span>}
        </button>
      ))}
    </div>
  );
}

interface SwitchProps {
  on: boolean;
  label: string;
  hint?: string;
  disabled?: boolean;
  onChange: (on: boolean) => void;
}

export function Switch({ on, label, hint, disabled, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      className={styles.switchRow}
      onClick={() => onChange(!on)}
    >
      <span className={styles.switchText}>
        <span>{label}</span>
        {hint ? <span className={styles.switchHint}>{hint}</span> : null}
      </span>
      <span className={styles.switch} data-on={on} aria-hidden="true" />
    </button>
  );
}

interface IconButtonProps {
  icon: IconName;
  label: string;
  onClick: () => void;
  pressed?: boolean;
  kbd?: string;
  variant?: "ghost" | "solid" | "accent";
  size?: "s" | "m" | "l";
  tipSide?: "bottom" | "top" | "left";
  children?: ReactNode;
}

export function IconButton({
  icon,
  label,
  onClick,
  pressed,
  kbd,
  variant = "ghost",
  size = "m",
  tipSide = "bottom",
  children,
}: IconButtonProps) {
  const tip = kbd ? `${label}  ·  ${kbd}` : label;
  return (
    <button
      type="button"
      className={cx([
        styles.iconBtn,
        variant === "solid" ? styles.iconBtnSolid : undefined,
        variant === "accent" ? styles.iconBtnAccent : undefined,
        size === "s" ? styles.iconBtnS : undefined,
        size === "l" ? styles.iconBtnL : undefined,
        children ? styles.iconBtnWide : undefined,
      ])}
      aria-label={children ? undefined : label}
      aria-pressed={pressed}
      data-tip={tip}
      data-tip-side={tipSide}
      onClick={onClick}
    >
      <Icon name={icon} size={size === "l" ? 20 : size === "s" ? 14 : 16} />
      {children}
    </button>
  );
}

interface SliderProps {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  className?: string;
}

export function Slider({ label, value, min, max, step, disabled, onChange, className }: SliderProps) {
  const pct = max > min ? ((value - min) / (max - min)) * 100 : 0;
  return (
    <input
      className={cx([styles.slider, className])}
      type="range"
      min={min}
      max={max}
      step={step}
      value={value}
      disabled={disabled}
      aria-disabled={disabled}
      aria-label={label}
      style={{ "--fill": `${pct}%` } as CSSProperties}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
    />
  );
}

export function Kbd({ children }: { children: ReactNode }) {
  return <kbd className={styles.kbd}>{children}</kbd>;
}

export function percent(u: number): string {
  return `${Math.round(Math.min(1, Math.max(0, u)) * 100)}%`;
}

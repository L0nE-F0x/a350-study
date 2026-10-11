import { useEffect, useRef, useState } from "react";
import type { LinkState, ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { Icon } from "./Icon.tsx";
import { Switch } from "./Controls.tsx";

const CHANNELS: { id: keyof LinkState; label: string; hint: string }[] = [
  { id: "camera", label: "Camera", hint: "Orbit one pane, the other follows" },
  { id: "explode", label: "Explode and flight", hint: "Shared explode and phase" },
  { id: "overlays", label: "Layers", hint: "Same layers in both panes" },
  { id: "clip", label: "Section", hint: "Same cut in both panes" },
];

interface SyncMenuProps {
  mode: ViewMode;
  link: LinkState;
  onLink: (channel: keyof LinkState, on: boolean) => void;
  onLinkAll: () => void;
}

export function SyncMenu({ mode, link, onLink, onLinkAll }: SyncMenuProps) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement | null>(null);
  const linked = CHANNELS.filter((channel) => link[channel.id]).length;
  const overlay = mode === "overlay";

  useEffect(() => {
    if (!open) return;
    const onDown = (event: PointerEvent) => {
      if (root.current && event.target instanceof Node && !root.current.contains(event.target)) setOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("pointerdown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className={styles.menuRoot} ref={root}>
      <button
        type="button"
        className={styles.topBtn}
        aria-expanded={open}
        aria-haspopup="true"
        data-tip="What the two panes share"
        onClick={() => setOpen((value) => !value)}
      >
        <Icon name="link" size={15} />
        <span>Sync</span>
        <span className={styles.count}>{`${linked}/${CHANNELS.length}`}</span>
        <Icon name="chevronDown" size={13} />
      </button>
      {open ? (
        <div className={styles.menu} role="group" aria-label="Link">
          <p className={styles.eyebrow}>Shared between panes</p>
          {CHANNELS.map((channel) => {
            const locked = overlay && channel.id !== "overlays";
            return (
              <Switch
                key={channel.id}
                on={link[channel.id]}
                label={channel.label}
                hint={locked ? "Always on in overlay" : channel.hint}
                disabled={locked}
                onChange={(on) => onLink(channel.id, on)}
              />
            );
          })}
          <button type="button" className={styles.menuAction} onClick={onLinkAll} disabled={linked === CHANNELS.length}>
            <Icon name="link" size={14} />
            Link all
          </button>
        </div>
      ) : null}
    </div>
  );
}

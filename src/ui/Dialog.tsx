import { useEffect, useId, useRef, type ReactNode } from "react";
import styles from "./styles/shell.module.css";
import { Icon, type IconName } from "./Icon.tsx";

interface DialogProps {
  open: boolean;
  title: string;
  icon: IconName;
  subtitle?: string;
  wide?: boolean;
  onClose: () => void;
  children: ReactNode;
}

export function Dialog({ open, title, icon, subtitle, wide, onClose, children }: DialogProps) {
  const id = useId();
  const panel = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopImmediatePropagation();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => {
      window.removeEventListener("keydown", onKey, true);
      previous?.focus();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <section
        ref={panel}
        className={styles.dialog}
        data-wide={wide ? true : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
      >
        <header className={styles.dialogHead}>
          <span className={styles.dialogIcon}>
            <Icon name={icon} size={18} />
          </span>
          <div>
            <h2 id={id} className={styles.dialogTitle}>
              {title}
            </h2>
            {subtitle ? <p className={styles.dialogSub}>{subtitle}</p> : null}
          </div>
          <button type="button" className={styles.closeBtn} aria-label="Close" onClick={onClose}>
            <Icon name="close" size={16} />
          </button>
        </header>
        <div className={styles.dialogBody}>{children}</div>
      </section>
    </div>
  );
}

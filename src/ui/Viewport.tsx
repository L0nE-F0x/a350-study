import { useEffect, useRef, type ReactNode } from "react";
import styles from "./styles/shell.module.css";

interface ViewportProps {
  pane: 0 | 1;
  label: string;
  onCanvas: (pane: 0 | 1, canvas: HTMLCanvasElement | null) => void;
  onPointerDown?: () => void;
  children?: ReactNode;
}

export function Viewport({ pane, label, onCanvas, onPointerDown, children }: ViewportProps) {
  const nodeRef = useRef<HTMLCanvasElement | null>(null);
  const onCanvasRef = useRef(onCanvas);

  useEffect(() => {
    onCanvasRef.current = onCanvas;
  }, [onCanvas]);

  useEffect(() => {
    const node = nodeRef.current;
    if (!node) return;
    // Pair detach with the callback that attached so a new identity does not rebuild the buffer.
    const publish = onCanvasRef.current;
    publish(pane, node);
    return () => publish(pane, null);
  }, [pane]);

  return (
    <div className={styles.viewport}>
      <canvas ref={nodeRef} className={styles.canvas} aria-label={label} onPointerDown={onPointerDown} />
      <div className={styles.vignette} aria-hidden="true" />
      <div className={styles.overlay}>{children}</div>
    </div>
  );
}

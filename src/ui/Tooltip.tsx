import { useEffect, useRef, useState } from "react";
import styles from "./styles/shell.module.css";

interface Tip {
  text: string;
  x: number;
  y: number;
  side: "bottom" | "top" | "left";
}

const DELAY_MS = 380;

/** One tooltip for every element with a `data-tip` attribute. Fixed, so scrolling panels cannot clip it. */
export function TooltipLayer() {
  const [tip, setTip] = useState<Tip | null>(null);
  const timer = useRef(0);
  const current = useRef<Element | null>(null);

  useEffect(() => {
    const show = (el: Element, immediate: boolean) => {
      const text = el.getAttribute("data-tip");
      if (!text) return;
      current.current = el;
      window.clearTimeout(timer.current);
      const place = () => {
        if (current.current !== el || !el.isConnected) return;
        const rect = el.getBoundingClientRect();
        const raw = el.getAttribute("data-tip-side");
        let side: Tip["side"] = raw === "top" || raw === "left" ? raw : "bottom";
        if (side === "bottom" && rect.bottom + 40 > window.innerHeight) side = "top";
        if (side === "left" && rect.left < 220) side = "bottom";
        const x = side === "left" ? rect.left - 8 : rect.left + rect.width / 2;
        const y = side === "top" ? rect.top - 8 : side === "left" ? rect.top + rect.height / 2 : rect.bottom + 8;
        setTip({ text, x, y, side });
      };
      if (immediate) place();
      else timer.current = window.setTimeout(place, DELAY_MS);
    };
    const hide = () => {
      window.clearTimeout(timer.current);
      current.current = null;
      setTip(null);
    };
    const onOver = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      const el = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
      if (el === current.current) return;
      if (!el) {
        hide();
        return;
      }
      show(el, false);
    };
    const onFocus = (event: FocusEvent) => {
      const el = event.target instanceof Element ? event.target.closest("[data-tip]") : null;
      if (el && el.matches(":focus-visible")) show(el, true);
    };
    document.addEventListener("pointerover", onOver);
    document.addEventListener("pointerdown", hide);
    document.addEventListener("focusin", onFocus);
    document.addEventListener("focusout", hide);
    window.addEventListener("scroll", hide, true);
    return () => {
      window.clearTimeout(timer.current);
      document.removeEventListener("pointerover", onOver);
      document.removeEventListener("pointerdown", hide);
      document.removeEventListener("focusin", onFocus);
      document.removeEventListener("focusout", hide);
      window.removeEventListener("scroll", hide, true);
    };
  }, []);

  if (!tip) return null;
  return (
    <div className={styles.tooltip} data-side={tip.side} style={{ left: tip.x, top: tip.y }} role="tooltip">
      {tip.text}
    </div>
  );
}

import styles from "./styles/shell.module.css";
import { Badge, BADGE_MEANING } from "./Badge.tsx";
import { Kbd } from "./Controls.tsx";
import { Dialog } from "./Dialog.tsx";

interface HelpDialogProps {
  open: boolean;
  onClose: () => void;
}

const KEYS: { keys: string[]; text: string }[] = [
  { keys: ["1"], text: "Plan view" },
  { keys: ["2"], text: "Side view" },
  { keys: ["3"], text: "Front view" },
  { keys: ["4"], text: "Three-quarter view" },
  { keys: ["F"], text: "Toggle perspective inspect" },
  { keys: ["Space"], text: "Play or pause the departure" },
  { keys: ["E"], text: "Explode or reassemble" },
  { keys: ["[", "]"], text: "Nudge the explode" },
  { keys: ["U"], text: "Switch metres and feet" },
  { keys: ["Esc"], text: "Clear the selection" },
  { keys: ["?"], text: "This sheet" },
];

const MOUSE: { action: string; text: string }[] = [
  { action: "Left drag", text: "Orbit" },
  { action: "Right drag", text: "Pan" },
  { action: "Wheel", text: "Zoom" },
  { action: "Click", text: "Pin a part in the inspector" },
];

export function HelpDialog({ open, onClose }: HelpDialogProps) {
  return (
    <Dialog open={open} title="Controls" subtitle="Everything works from the keyboard too." icon="keyboard" wide onClose={onClose}>
      <div className={styles.helpGrid}>
        <section>
          <p className={styles.eyebrow}>Keyboard</p>
          <ul className={styles.keyList}>
            {KEYS.map((item) => (
              <li key={item.text}>
                <span className={styles.keys}>
                  {item.keys.map((key) => (
                    <Kbd key={key}>{key}</Kbd>
                  ))}
                </span>
                <span>{item.text}</span>
              </li>
            ))}
          </ul>
        </section>
        <section>
          <p className={styles.eyebrow}>Mouse and touch</p>
          <ul className={styles.keyList}>
            {MOUSE.map((item) => (
              <li key={item.action}>
                <span className={styles.keys}>
                  <Kbd>{item.action}</Kbd>
                </span>
                <span>{item.text}</span>
              </li>
            ))}
            <li>
              <span className={styles.keys}>
                <Kbd>Touch</Kbd>
              </span>
              <span>One finger orbits, pinch zooms, two fingers pan</span>
            </li>
          </ul>
          <p className={styles.eyebrow}>Reading the badges</p>
          <ul className={styles.keyList}>
            {Object.entries(BADGE_MEANING).map(([badge, meaning]) => (
              <li key={badge}>
                <span className={styles.keys}>
                  <Badge text={badge} />
                </span>
                <span>{meaning}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </Dialog>
  );
}

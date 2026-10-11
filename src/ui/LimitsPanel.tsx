import styles from "./styles/shell.module.css";
import { Dialog } from "./Dialog.tsx";

interface LimitsPanelProps {
  open: boolean;
  gaps: { id: string; text: string }[];
  onClose: () => void;
}

export function LimitsPanel({ open, gaps, onClose }: LimitsPanelProps) {
  return (
    <Dialog
      open={open}
      title="Limits of this model"
      subtitle={`${gaps.length} things the public sources do not publish. The model draws these as schematic.`}
      icon="book"
      onClose={onClose}
    >
      <ol className={styles.limitsList}>
        {gaps.map((gap) => (
          <li key={gap.id}>{gap.text}</li>
        ))}
      </ol>
    </Dialog>
  );
}

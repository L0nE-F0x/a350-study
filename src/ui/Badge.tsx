import styles from "./styles/shell.module.css";

interface BadgeProps {
  text: string;
  onSchematic?: () => void;
}

export const BADGE_MEANING: Record<string, string> = {
  sourced: "Published figure from a primary source",
  derived: "Computed from published figures",
  schematic: "Belongs to this study, not an OEM dimension",
  conflict: "Sources disagree. The alternate claims are listed",
  unverified: "Waiting on a re-check against the source",
  secondary: "From a secondary source",
};

export function Badge({ text, onSchematic }: BadgeProps) {
  const meaning = BADGE_MEANING[text];
  if (text === "schematic" && onSchematic) {
    return (
      <button
        type="button"
        className={styles.badge}
        data-kind={text}
        data-tip={`${meaning}. Open the limits.`}
        onClick={onSchematic}
      >
        {text}
      </button>
    );
  }
  return (
    <span className={styles.badge} data-kind={text} title={meaning}>
      {text}
    </span>
  );
}

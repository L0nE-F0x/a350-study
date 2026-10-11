import type { CSSProperties } from "react";
import type { LayerId } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import { cx } from "./cx.ts";
import { Badge } from "./Badge.tsx";
import { Icon } from "./Icon.tsx";
import { Segmented } from "./Controls.tsx";
import {
  VARIANT_LABEL,
  variantColor,
  weightColumnsFor,
  type ReadoutModel,
  type SpecTable,
  type VariantId,
  type WeightColumn,
} from "./model.ts";
import { LAYER_SWATCH } from "./swatch.ts";

interface ReadoutProps {
  sheet: boolean;
  readout: ReadoutModel | null;
  specs: SpecTable;
  annotations: string[];
  onColumn: (pane: 0 | 1, column: WeightColumn) => void;
  onClearSelection: () => void;
  onOpenLimits: () => void;
}

function isVariant(id: string): id is VariantId {
  return id === "a350-900" || id === "a350-1000";
}

function Badges({ badges, onOpenLimits }: { badges: string[]; onOpenLimits: () => void }) {
  return (
    <span className={styles.badgeRow}>
      {badges.map((badge, index) => (
        <Badge key={`${badge}-${index}`} text={badge} onSchematic={onOpenLimits} />
      ))}
    </span>
  );
}

function Inspector({
  readout,
  onClear,
  onOpenLimits,
}: {
  readout: ReadoutModel | null;
  onClear: () => void;
  onOpenLimits: () => void;
}) {
  if (!readout) {
    return (
      <div className={styles.inspectorEmpty}>
        <Icon name="target" size={18} />
        <p>
          <strong>Inspect a part.</strong>
          {" Hover the airframe for a preview. Click to pin it here."}
        </p>
      </div>
    );
  }
  const swatch = readout.layerId ? LAYER_SWATCH[readout.layerId as LayerId] : undefined;
  return (
    <div className={styles.inspector} style={{ "--swatch": swatch ?? "var(--muted)" } as CSSProperties}>
      <div className={styles.inspectorHead}>
        <div className={styles.inspectorMeta}>
          <span className={styles.layerTag}>
            <span className={styles.swatch} aria-hidden="true" />
            {readout.layer}
          </span>
          {isVariant(readout.variantId) ? (
            <span className={styles.variantTag}>
              <span className={styles.dot} style={{ background: variantColor(readout.variantId) }} aria-hidden="true" />
              {VARIANT_LABEL[readout.variantId]}
            </span>
          ) : (
            <span className={styles.variantTag}>{readout.variantId}</span>
          )}
          {readout.pinned ? null : <span className={styles.previewTag}>Preview</span>}
        </div>
        {readout.pinned ? (
          <button type="button" className={styles.closeBtn} aria-label="Clear selection" data-tip="Clear  ·  Esc" data-tip-side="left" onClick={onClear}>
            <Icon name="close" size={14} />
          </button>
        ) : null}
      </div>
      <h2 className={styles.inspectorTitle}>{readout.title}</h2>
      <div className={styles.inspectorLines}>
        {readout.lines.map((line, index) => (
          <div key={index} className={styles.line}>
            {line.label ? <p className={styles.lineLabel}>{line.label}</p> : null}
            <div className={styles.lineMain}>
              <span className={styles.figure}>{line.text}</span>
              <Badges badges={line.badges} onOpenLimits={onOpenLimits} />
            </div>
            {line.schematicNote ? <p className={styles.lineNote}>{"Topology only. Not an OEM dimension."}</p> : null}
            {line.formula ? (
              <details className={styles.formula}>
                <summary>
                  <Icon name="chevronDown" size={12} />
                  Formula
                </summary>
                <code>{line.formula}</code>
              </details>
            ) : null}
            {line.alternates && line.alternates.length > 0 ? (
              <ul className={styles.alts}>
                {line.alternates.map((alternate, alternateIndex) => (
                  <li key={`${alternate.citationId}-${alternateIndex}`} className={styles.alt}>
                    <span className={styles.altHead}>
                      <span className={styles.figure}>{alternate.display}</span>
                      <span className={styles.cite}>{alternate.citationId}</span>
                    </span>
                    {alternate.note ? <span className={styles.altNote}>{alternate.note}</span> : null}
                  </li>
                ))}
              </ul>
            ) : null}
            {line.citation ? (
              <p className={styles.citation}>
                <Icon name="book" size={12} />
                <span>{line.citation}</span>
              </p>
            ) : null}
          </div>
        ))}
      </div>
    </div>
  );
}

function Specs({
  specs,
  onColumn,
  onOpenLimits,
}: {
  specs: SpecTable;
  onColumn: (pane: 0 | 1, column: WeightColumn) => void;
  onOpenLimits: () => void;
}) {
  const compare = specs.columns.length > 1;
  return (
    <div className={styles.specs}>
      <div className={styles.panelHead}>
        <div className={styles.panelTitle}>
          <Icon name="chart" size={15} />
          <h2>{compare ? "Compare" : "Specifications"}</h2>
        </div>
      </div>
      <div className={styles.weightPickers}>
        {specs.columns.map((column) => (
          <div key={column.pane} className={styles.weightPicker}>
            <span className={styles.weightLabel}>
              <span className={styles.dot} style={{ background: variantColor(column.variantId) }} aria-hidden="true" />
              {compare ? VARIANT_LABEL[column.variantId] : "Weight variant"}
            </span>
            <Segmented
              label={compare ? `${VARIANT_LABEL[column.variantId]} weight` : "Weight"}
              size="s"
              stretch
              value={column.weightColumn}
              options={weightColumnsFor(column.variantId)}
              onChange={(id) => onColumn(column.pane, id)}
            />
          </div>
        ))}
      </div>
      {compare ? (
        <div className={styles.specColHead} aria-hidden="true">
          <span />
          {specs.columns.map((column) => (
            <span key={column.pane} className={styles.specColName}>
              <span className={styles.dot} style={{ background: variantColor(column.variantId) }} />
              {column.variantId === "a350-900" ? "-900" : "-1000"}
            </span>
          ))}
        </div>
      ) : null}
      {specs.groups.map((group) => (
        <section key={group.id} className={styles.specGroup} aria-label={group.label}>
          <p className={styles.eyebrow}>{group.label}</p>
          <dl className={cx([styles.specList, compare ? styles.specCompare : undefined])}>
            {group.rows.map((row) => (
              <div key={row.id} className={styles.specRow}>
                <dt>{row.label}</dt>
                {row.cells.map((item, index) => (
                  <dd key={index} className={styles.specCell}>
                    {item ? (
                      <>
                        <span className={styles.figure}>{item.text}</span>
                        <Badges badges={item.badges} onOpenLimits={onOpenLimits} />
                      </>
                    ) : (
                      <span className={styles.na}>–</span>
                    )}
                  </dd>
                ))}
                {row.delta ? (
                  <dd className={styles.specDelta}>
                    <span className={styles.deltaMark}>Δ</span>
                    <span className={styles.figure}>{row.delta.text}</span>
                    <Badges badges={row.delta.badges} onOpenLimits={onOpenLimits} />
                  </dd>
                ) : null}
              </div>
            ))}
          </dl>
        </section>
      ))}
    </div>
  );
}

export function Readout({ sheet, readout, specs, annotations, onColumn, onClearSelection, onOpenLimits }: ReadoutProps) {
  return (
    <aside className={cx([styles.readout, sheet ? styles.readoutSheet : undefined])} aria-label="Readout">
      <Inspector readout={readout} onClear={onClearSelection} onOpenLimits={onOpenLimits} />
      {annotations.length > 0 ? (
        <div className={styles.annotations}>
          <p className={styles.eyebrow}>Differences</p>
          {annotations.map((note, index) => (
            <p key={index} className={styles.annotation}>
              <Badge text="secondary" />
              <span>{note}</span>
            </p>
          ))}
        </div>
      ) : null}
      <Specs specs={specs} onColumn={onColumn} onOpenLimits={onOpenLimits} />
    </aside>
  );
}

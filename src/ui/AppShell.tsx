import { useEffect, useState, type ReactNode } from "react";
import type { ClipAxis, LayerId, LinkState, PaneState, ViewMode } from "../shared/types/index.ts";
import styles from "./styles/shell.module.css";
import "./styles/tokens.css";
import { cx } from "./cx.ts";
import { Badge } from "./Badge.tsx";
import { IconButton, Segmented } from "./Controls.tsx";
import { ExplodeBar } from "./ExplodeBar.tsx";
import { HelpDialog } from "./HelpDialog.tsx";
import { Icon, type IconName } from "./Icon.tsx";
import { LayerToggles } from "./LayerToggles.tsx";
import { LimitsPanel } from "./LimitsPanel.tsx";
import {
  NOTICE,
  VARIANT_LABEL,
  variantColor,
  type DimLabel,
  type OrthoPresetId,
  type PartLabel,
  type ReadoutModel,
  type SpecTable,
  type TickLabel,
  type VariantId,
  type WeightColumn,
} from "./model.ts";
import { PhaseBar } from "./PhaseBar.tsx";
import { Readout } from "./Readout.tsx";
import { SectionBar } from "./SectionBar.tsx";
import { SyncMenu } from "./SyncMenu.tsx";
import { TooltipLayer } from "./Tooltip.tsx";
import { ViewTools } from "./ViewTools.tsx";
import { Viewport } from "./Viewport.tsx";

export type {
  DimLabel,
  GateFigure,
  HeadlineItem,
  PartLabel,
  ReadoutLine,
  ReadoutModel,
  SpecCell,
  SpecColumn,
  SpecGroup,
  SpecRow,
  SpecTable,
  TickLabel,
} from "./model.ts";

export interface AppShellProps {
  mode: ViewMode;
  link: LinkState;
  panes: [PaneState, PaneState];
  unit: "m" | "ft";
  phone: boolean;
  tablet: boolean;
  hud: { fps: string; triangles: string; calls: string; warn: string | null } | null;
  amberHint: boolean;
  inspectNote: boolean;
  annotations: string[];
  specs: SpecTable;
  readout: ReadoutModel | null;
  gaps: { id: string; text: string }[];
  limitsOpen: boolean;
  helpOpen: boolean;
  playing: boolean;
  showHint: boolean;
  dimensionLabels: [DimLabel | null, DimLabel | null];
  stationTicks: [TickLabel[], TickLabel[]];
  partLabels: [PartLabel[], PartLabel[]];
  onCanvas: (pane: 0 | 1, canvas: HTMLCanvasElement | null) => void;
  onMode: (mode: ViewMode) => void;
  onVariant: (pane: 0 | 1, id: VariantId) => void;
  onColumn: (pane: 0 | 1, column: WeightColumn) => void;
  onPreset: (pane: 0 | 1, preset: OrthoPresetId) => void;
  onInspect: (pane: 0 | 1) => void;
  onExplode: (pane: 0 | 1, u: number) => void;
  onExplodeTo: (pane: 0 | 1, target: 0 | 1) => void;
  onPhase: (pane: 0 | 1, phase: number) => void;
  onPlayPhase: (pane: 0 | 1) => void;
  onPausePhase: () => void;
  onClipAxis: (pane: 0 | 1, axis: ClipAxis) => void;
  onClipT: (pane: 0 | 1, t: number) => void;
  onOverlay: (pane: 0 | 1, layer: LayerId, on: boolean) => void;
  onSolo: (pane: 0 | 1, layer: LayerId) => void;
  onHiddenLines: (pane: 0 | 1, on: boolean) => void;
  onLink: (channel: keyof LinkState, on: boolean) => void;
  onLinkAll: () => void;
  onUnit: (unit: "m" | "ft") => void;
  onClearSelection: () => void;
  onOpenLimits: () => void;
  onCloseLimits: () => void;
  onOpenHelp: () => void;
  onCloseHelp: () => void;
  onDismissHint: () => void;
  onLeave: () => void;
}

const PHONE_TABS = [
  { id: "stage", label: "Model", icon: "plane" },
  { id: "layers", label: "Layers", icon: "layers" },
  { id: "flight", label: "Flight", icon: "flight" },
  { id: "data", label: "Data", icon: "chart" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

type PhoneSheet = (typeof PHONE_TABS)[number]["id"];

const MODES = [
  { id: "single", label: "Single", icon: "single", title: "One airframe" },
  { id: "split-vertical", label: "Side by side", icon: "splitV", title: "Split vertical: two panes side by side" },
  { id: "split-horizontal", label: "Stacked", icon: "splitH", title: "Split horizontal: one pane above the other" },
  { id: "overlay", label: "Overlay", icon: "overlay", title: "Overlay: both airframes registered on the wing" },
] as const satisfies readonly { id: ViewMode; label: string; icon: IconName; title: string }[];

const TOOLS = [
  { id: "flight", label: "Flight", icon: "flight" },
  { id: "explode", label: "Explode", icon: "expand" },
  { id: "section", label: "Section", icon: "slice" },
] as const satisfies readonly { id: string; label: string; icon: IconName }[];

type Tool = (typeof TOOLS)[number]["id"];

const COLUMN_SHORT: Record<WeightColumn, string> = {
  regional: "Regional",
  basic: "Basic",
  highGross: "High gross",
};

function Brand({ onLeave, compact }: { onLeave: () => void; compact: boolean }) {
  return (
    <button type="button" className={styles.brand} onClick={onLeave} data-tip="Back to the start page">
      <span className={styles.brandMark} aria-hidden="true">
        <Icon name="plane" size={16} />
      </span>
      <span className={styles.brandText}>
        <span className={styles.brandName}>A350 Study</span>
        {compact ? null : <span className={styles.brandSub}>Fig. 1 · -900 / -1000</span>}
      </span>
    </button>
  );
}

function PaneChip({ pane, overlayPeer }: { pane: PaneState; overlayPeer: PaneState | null }) {
  return (
    <div className={styles.paneChips}>
      <span className={styles.paneChip}>
        <span className={styles.dot} style={{ background: variantColor(pane.variantId) }} aria-hidden="true" />
        <strong>{VARIANT_LABEL[pane.variantId]}</strong>
        <span className={styles.paneChipSub}>{COLUMN_SHORT[pane.weightColumn]}</span>
      </span>
      {overlayPeer ? (
        <span className={styles.paneChip} data-amber="true">
          <span className={styles.dot} style={{ background: variantColor(overlayPeer.variantId) }} aria-hidden="true" />
          <strong>{VARIANT_LABEL[overlayPeer.variantId]}</strong>
          <span className={styles.paneChipSub}>overlay</span>
        </span>
      ) : null}
    </div>
  );
}

function StudyMarks({
  dimension,
  ticks,
  parts,
}: {
  dimension: DimLabel | null;
  ticks: TickLabel[];
  parts: PartLabel[];
}) {
  return (
    <>
      <svg className={styles.leaders} aria-hidden="true">
        {parts.map((label, index) =>
          Math.hypot(label.x - label.anchorX, label.y - label.anchorY) < 10 ? null : (
            <g key={`lead-${index}`}>
              <line x1={label.anchorX} y1={label.anchorY} x2={label.x} y2={label.y + 8} />
              <circle cx={label.anchorX} cy={label.anchorY} r={2.5} />
            </g>
          ),
        )}
      </svg>
      {ticks.map((tick, index) => (
        <span key={`tick-${index}`} className={styles.tick} style={{ left: tick.x, top: tick.y }}>
          {tick.text}
        </span>
      ))}
      {parts.map((label, index) => (
        <span
          key={`part-${index}`}
          className={cx([styles.part, label.selected ? styles.partOn : undefined])}
          style={{ left: label.x, top: label.y }}
        >
          {label.text}
        </span>
      ))}
      {dimension ? (
        <div className={dimension.edge === "bottom" ? styles.dimBottom : styles.dimRight}>
          <Icon name="ruler" size={13} />
          <span className={styles.figure}>{dimension.text}</span>
          <Badge text={dimension.badge} />
        </div>
      ) : null}
    </>
  );
}

function ToolDock({
  tool,
  onTool,
  stacked,
  children,
}: {
  tool: Tool;
  onTool: (tool: Tool) => void;
  stacked: boolean;
  children: Record<Tool, ReactNode>;
}) {
  if (stacked) {
    return (
      <div className={styles.dockStack}>
        {TOOLS.map((item) => (
          <section key={item.id} className={styles.dockSection} aria-label={item.label}>
            <p className={styles.eyebrow}>
              <Icon name={item.icon} size={13} />
              {item.label}
            </p>
            {children[item.id]}
          </section>
        ))}
      </div>
    );
  }
  return (
    <div className={styles.dock}>
      <div className={styles.dockTabs} role="tablist" aria-label="Tools">
        {TOOLS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tool === item.id}
            className={styles.dockTab}
            onClick={() => onTool(item.id)}
          >
            <Icon name={item.icon} size={15} />
            <span>{item.label}</span>
          </button>
        ))}
      </div>
      <div className={styles.dockPanel} role="tabpanel" aria-label={TOOLS.find((item) => item.id === tool)?.label}>
        {children[tool]}
      </div>
    </div>
  );
}

export function AppShell(props: AppShellProps) {
  const {
    mode,
    link,
    panes,
    unit,
    phone,
    tablet,
    hud,
    amberHint,
    inspectNote,
    annotations,
    specs,
    readout,
    gaps,
    limitsOpen,
    helpOpen,
    playing,
    showHint,
    dimensionLabels,
    stationTicks,
    partLabels,
    onCanvas,
    onMode,
    onVariant,
    onColumn,
    onPreset,
    onInspect,
    onExplode,
    onExplodeTo,
    onPhase,
    onPlayPhase,
    onPausePhase,
    onClipAxis,
    onClipT,
    onOverlay,
    onSolo,
    onHiddenLines,
    onLink,
    onLinkAll,
    onUnit,
    onClearSelection,
    onOpenLimits,
    onCloseLimits,
    onOpenHelp,
    onCloseHelp,
    onDismissHint,
    onLeave,
  } = props;

  const [sheet, setSheet] = useState<PhoneSheet>("stage");
  const [tool, setTool] = useState<Tool>("flight");
  const [leftOpen, setLeftOpen] = useState(!tablet);
  const [rightOpen, setRightOpen] = useState(!tablet);

  useEffect(() => {
    setLeftOpen(!tablet);
    setRightOpen(!tablet);
  }, [tablet]);

  // A pinned part opens the inspector where it is hidden.
  useEffect(() => {
    if (!readout?.pinned) return;
    if (phone) setSheet("data");
  }, [readout?.pinned, readout?.title, phone]);

  const sideBySide = !phone && mode === "split-vertical";
  const viewPanes: (0 | 1)[] = phone || mode === "single" || mode === "overlay" ? [0] : [0, 1];
  const perPaneView = viewPanes.length > 1 && !link.camera;
  const drawer = tablet;

  const toggleLeft = () => {
    setLeftOpen((open) => !open);
    if (drawer) setRightOpen(false);
  };
  const toggleRight = () => {
    setRightOpen((open) => !open);
    if (drawer) setLeftOpen(false);
  };

  const stage = (
    <div className={cx([styles.stage, sideBySide ? styles.stageRow : styles.stageCol])} data-hint={showHint ? true : undefined}>
      {viewPanes.map((index) => {
        const pane = panes[index];
        const overlayPeer = mode === "overlay" && index === 0 ? panes[1] : null;
        return (
          <Viewport
            key={index}
            pane={index}
            label={`${VARIANT_LABEL[pane.variantId]} view`}
            onCanvas={onCanvas}
            onPointerDown={showHint ? onDismissHint : undefined}
          >
            <StudyMarks
              dimension={dimensionLabels[index]}
              ticks={stationTicks[index]}
              parts={partLabels[index]}
            />
            <PaneChip pane={pane} overlayPeer={overlayPeer} />
            {perPaneView ? (
              <div className={styles.viewToolsSlot}>
                <ViewTools pane={pane} index={index} onPreset={onPreset} onInspect={onInspect} />
              </div>
            ) : null}
            <div className={styles.notes} data-raised={dimensionLabels[index]?.edge === "bottom" ? true : undefined}>
              {pane.camera.mode === "inspect" || (index === 0 && inspectNote) ? (
                <p className={styles.note}>
                  <Icon name="perspective" size={12} />
                  {"Perspective. Scaled dimensions stay on the orthographic views."}
                </p>
              ) : null}
              {amberHint && index === 0 ? (
                <p className={styles.noteAmber}>
                  <span className={styles.dot} style={{ background: "var(--v1000)" }} aria-hidden="true" />
                  {"Amber is the A350-1000. What does not cover the silver is the stretch and the local changes."}
                </p>
              ) : null}
            </div>
          </Viewport>
        );
      })}
      {perPaneView ? null : (
        <div className={cx([styles.viewToolsSlot, phone ? styles.viewToolsPhone : undefined])}>
          <ViewTools pane={panes[0]} index={0} compact={phone} onPreset={onPreset} onInspect={onInspect} />
        </div>
      )}
      {showHint ? (
        <div className={styles.hint} role="note">
          <Icon name="mouse" size={14} />
          <span>{phone ? "One finger orbits. Pinch zooms. Two fingers pan." : "Drag to orbit · Right-drag to pan · Scroll to zoom · Click a part"}</span>
          <button type="button" className={styles.hintClose} aria-label="Dismiss hint" onClick={onDismissHint}>
            <Icon name="close" size={12} />
          </button>
        </div>
      ) : null}
      {hud ? (
        <div className={styles.hud}>
          <span>{`${hud.fps} fps`}</span>
          <span>{`${hud.triangles} tris`}</span>
          <span>{`${hud.calls} calls`}</span>
          {hud.warn !== null ? <span className={styles.warn}>{hud.warn}</span> : null}
        </div>
      ) : null}
    </div>
  );

  const layers = (
    <LayerToggles
      mode={mode}
      phone={phone}
      linkOverlays={link.overlays}
      panes={panes}
      onOverlay={onOverlay}
      onSolo={onSolo}
      onHiddenLines={onHiddenLines}
    />
  );

  const tools: Record<Tool, ReactNode> = {
    flight: (
      <PhaseBar
        mode={mode}
        linkExplode={link.explode}
        panes={panes}
        playing={playing}
        onPhase={onPhase}
        onPlay={onPlayPhase}
        onPause={onPausePhase}
      />
    ),
    explode: (
      <ExplodeBar mode={mode} linkExplode={link.explode} panes={panes} onExplode={onExplode} onExplodeTo={onExplodeTo} />
    ),
    section: <SectionBar mode={mode} linkClip={link.clip} panes={panes} onClipAxis={onClipAxis} onClipT={onClipT} />,
  };

  const figures = (
    <Readout
      sheet={phone}
      readout={readout}
      specs={specs}
      annotations={annotations}
      onColumn={onColumn}
      onClearSelection={onClearSelection}
      onOpenLimits={onOpenLimits}
    />
  );

  const units = (
    <Segmented
      label="Units"
      size="s"
      value={unit}
      options={[
        { id: "m", label: "m", title: "Metres  ·  U" },
        { id: "ft", label: "ft", title: "Feet  ·  U" },
      ]}
      onChange={onUnit}
    />
  );

  const variantPicker = (
    <Segmented
      label="Variant"
      value={panes[0].variantId}
      options={(["a350-900", "a350-1000"] as const).map((id) => ({
        id,
        label: phone ? id.replace("a350", "") : VARIANT_LABEL[id],
        dot: variantColor(id),
        title: mode === "single" ? undefined : "Primary pane",
      }))}
      onChange={(id) => onVariant(0, id)}
    />
  );

  return (
    <div className={styles.shell} data-layout={phone ? "phone" : tablet ? "tablet" : "desk"}>
      <header className={styles.topbar}>
        <div className={styles.topLeft}>
          <Brand onLeave={onLeave} compact={phone || tablet} />
          {phone ? null : (
            <>
              <span className={styles.topSep} aria-hidden="true" />
              <IconButton icon="panelLeft" label="Layers panel" pressed={leftOpen} onClick={toggleLeft} />
            </>
          )}
        </div>
        <div className={styles.topCenter}>
          {variantPicker}
          {mode !== "single" && !phone ? (
            <IconButton
              icon="swap"
              label="Swap the panes"
              onClick={() => onVariant(0, panes[1].variantId)}
            />
          ) : null}
          {phone ? null : (
            <Segmented label="View mode" value={mode} iconOnly={tablet} options={MODES} onChange={onMode} className={styles.modeSwitch} />
          )}
          {!phone && mode !== "single" ? <SyncMenu mode={mode} link={link} onLink={onLink} onLinkAll={onLinkAll} /> : null}
        </div>
        <div className={styles.topRight}>
          {units}
          {phone ? (
            <IconButton icon="book" label="Limits" onClick={onOpenLimits} />
          ) : (
            <button type="button" className={styles.topBtn} onClick={onOpenLimits} data-tip="What this model does not know">
              <Icon name="book" size={15} />
              <span>Limits</span>
            </button>
          )}
          <IconButton icon="help" label="Controls and shortcuts" kbd="?" onClick={onOpenHelp} />
          {phone ? null : (
            <IconButton icon="panelRight" label="Readout panel" pressed={rightOpen} onClick={toggleRight} />
          )}
        </div>
      </header>

      {phone ? (
        <main className={styles.phoneMain}>
          {stage}
          {sheet === "stage" ? null : (
            <div
              className={styles.phoneSheet}
              role="region"
              aria-label={PHONE_TABS.find((tab) => tab.id === sheet)?.label}
            >
              <span className={styles.grabber} aria-hidden="true" />
              {sheet === "layers" ? layers : null}
              {sheet === "flight" ? <ToolDock tool={tool} onTool={setTool} stacked>{tools}</ToolDock> : null}
              {sheet === "data" ? (
                <>
                  <div className={styles.sheetHead}>
                    <span className={styles.eyebrow}>Units</span>
                    {units}
                  </div>
                  {figures}
                  <p className={styles.disclaimer}>{NOTICE}</p>
                </>
              ) : null}
            </div>
          )}
        </main>
      ) : (
        <main
          className={styles.body}
          data-left={leftOpen ? "open" : "closed"}
          data-right={rightOpen ? "open" : "closed"}
          data-drawer={drawer ? "true" : undefined}
        >
          <aside className={cx([styles.side, styles.sideLeft])} aria-label="Layers" hidden={!leftOpen}>
            {layers}
          </aside>
          <div className={styles.center}>
            {stage}
            <ToolDock tool={tool} onTool={setTool} stacked={false}>
              {tools}
            </ToolDock>
          </div>
          <div className={cx([styles.side, styles.sideRight])} hidden={!rightOpen}>
            {figures}
          </div>
        </main>
      )}

      {phone ? (
        <nav className={styles.tabbar} aria-label="Study">
          {PHONE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={styles.tab}
              aria-pressed={sheet === tab.id}
              onClick={() => setSheet(tab.id)}
            >
              <Icon name={tab.icon} size={18} />
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>
      ) : (
        <footer className={styles.footer}>
          <span className={styles.footerNotice}>{NOTICE}</span>
          <button type="button" className={styles.footerHelp} onClick={onOpenHelp}>
            <Icon name="keyboard" size={13} />
            <span>Shortcuts</span>
          </button>
        </footer>
      )}
      <LimitsPanel open={limitsOpen} gaps={gaps} onClose={onCloseLimits} />
      <HelpDialog open={helpOpen} onClose={onCloseHelp} />
      <TooltipLayer />
    </div>
  );
}

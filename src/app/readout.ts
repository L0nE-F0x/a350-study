import {
  formatQuantity,
  gapQuantities,
  getCitation,
  quantityBadges,
  quantityById,
  type Quantity,
} from "../data/provenance/index.ts";
import type {
  GateFigure,
  HeadlineItem,
  ReadoutLine,
  ReadoutModel,
  SpecCell,
  SpecColumn,
  SpecGroup,
  SpecTable,
} from "../ui/index.ts";
import type { LayerId, PaneState, Part } from "../shared/types/index.ts";
import type { StudyState } from "./store.ts";

const LAYER_LABEL: Record<LayerId, string> = {
  skin: "Skin",
  structure: "Structure",
  composites: "Composites",
  cabin: "Cabin",
  cargo: "Cargo",
  flightControls: "Flight controls",
  fuel: "Fuel",
  hydraulics: "Hydraulics",
  electrics: "Electrics",
  bleedEcs: "Bleed / ECS",
  landingGear: "Landing gear",
  engines: "Engines",
  dimensions: "Dimensions",
  differences: "Differences",
};

const COLUMN_MARKERS = [".regional", ".basic", ".hgw", ".highGross"] as const;

function columnMarker(column: PaneState["weightColumn"]): string {
  return column === "highGross" ? ".hgw" : `.${column}`;
}

export function quantityVisible(id: string, column: PaneState["weightColumn"], partId: string): boolean {
  const marked = COLUMN_MARKERS.some((marker) => id.includes(marker));
  if (!marked) return true;
  if (id.includes(columnMarker(column))) return true;
  if (column === "highGross" && id.includes(".highGross")) return true;
  return column === "regional" && partId.startsWith("fuel.") && id.includes(".basic");
}

function lookup(id: string): Quantity | null {
  try {
    return quantityById(id);
  } catch {
    return null;
  }
}

function citationLine(ids: readonly string[]): string | undefined {
  const id = ids[0];
  if (!id) return undefined;
  try {
    const cite = getCitation(id);
    return `${cite.publisher}, ${cite.documentId ?? cite.title}, ${cite.date}`;
  } catch {
    return undefined;
  }
}

/** Longest prefix wins. */
const QUANTITY_LABEL: [string, string][] = [
  ["q.len.", "Length"],
  ["q.span", "Wingspan"],
  ["q.height.", "Height"],
  ["q.fuseWidth", "Fuselage width"],
  ["q.cabinWidthMax", "Cabin width"],
  ["q.cabinLen.", "Cabin length"],
  ["q.cabin.altitude", "Cabin altitude"],
  ["q.cabin.ceiling", "Ceiling"],
  ["q.mtaxi.", "Max taxi weight"],
  ["q.mtow.", "Max take-off weight"],
  ["q.mlw.", "Max landing weight"],
  ["q.mzfw.", "Max zero-fuel weight"],
  ["q.fuelLitres.", "Fuel capacity"],
  ["q.fuel.", "Fuel"],
  ["q.range.", "Range"],
  ["q.ulr.range", "Ultra long range"],
  ["q.thrust.", "Take-off thrust"],
  ["q.thrust.cont.", "Max continuous thrust"],
  ["q.engine.", "Engine"],
  ["q.track.", "Main gear track"],
  ["q.wheelbase.", "Wheelbase"],
  ["q.wingArea.", "Wing area"],
  ["q.seats.typical.", "Typical seating"],
  ["q.seats.max.", "Max seating"],
  ["q.cargo.ld3.", "Underfloor LD3"],
  ["q.cargo.m3.", "Cargo volume"],
  ["q.gear.", "Main gear"],
  ["q.cert.", "Certification"],
  ["q.model.", "Model"],
  ["q.materials.", "Materials"],
  ["q.cruiseMach", "Cruise speed"],
  ["q.commonality", "Commonality"],
  ["q.derived.stretch", "Stretch over the -900"],
  ["q.derived.semiSpan", "Semi-span"],
  ["q.derived.halfLen.", "Half length"],
  ["q.derived.wheelbaseDelta", "Wheelbase difference"],
  ["q.derived.trackDelta", "Track difference"],
  ["q.derived.heightDelta", "Height difference"],
  ["q.derived.cabinDelta", "Cabin length difference"],
  ["q.derived.fuel.", "Fuel"],
  ["q.note.", "Note"],
  ["q.schematic.", "Study geometry"],
];

const FUEL_SUFFIX: [string, string][] = [
  [".wingOneKg", "One wing tank, mass"],
  [".wingOne", "One wing tank"],
  [".centreKg", "Centre tank, mass"],
  [".centre", "Centre tank"],
  [".totalKg", "Total fuel, mass"],
  [".totalL", "Total fuel"],
];

export function quantityLabel(id: string): string | undefined {
  if (id.startsWith("q.fuel.")) {
    const suffix = FUEL_SUFFIX.find(([end]) => id.endsWith(end));
    if (suffix) return suffix[1];
  }
  let best: [string, string] | undefined;
  for (const entry of QUANTITY_LABEL) {
    if (id.startsWith(entry[0]) && (!best || entry[0].length > best[0].length)) best = entry;
  }
  return best?.[1];
}

function lineFor(q: Quantity, unit: "m" | "ft"): ReadoutLine {
  let citation = citationLine(q.citationIds);
  if (q.id === "q.derived.fuel.1000.hgw.kg") {
    const note = "Density 0.785 kg/L is the TCDS figure, not a weighed mass.";
    citation = citation ? `${citation}. ${note}` : note;
  }
  return {
    label: quantityLabel(q.id),
    text: formatQuantity(q, unit),
    badges: quantityBadges(q),
    formula: q.grade === "derived" ? q.formula : undefined,
    alternates: q.alternates?.map((alt) => ({
      display: alt.display,
      citationId: alt.citationId,
      note: alt.note,
    })),
    citation,
    schematicNote: q.grade === "schematic",
  };
}

function variantKey(id: PaneState["variantId"]): "900" | "1000" {
  return id === "a350-900" ? "900" : "1000";
}

function columnKey(column: PaneState["weightColumn"]): "regional" | "basic" | "hgw" {
  return column === "highGross" ? "hgw" : column;
}

const HEADLINE_LABEL: Record<string, string> = {
  len: "Length",
  span: "Wingspan",
  height: "Height",
  mtow: "Max take-off weight",
  range: "Range",
};

function headlineLabel(id: string): string {
  const key = id.split(".")[1] ?? "";
  return HEADLINE_LABEL[key] ?? key;
}

function headline(id: string, unit: "m" | "ft"): HeadlineItem | null {
  const q = lookup(id);
  if (!q) return null;
  return { id, label: headlineLabel(id), text: formatQuantity(q, unit), badges: quantityBadges(q) };
}

export function headlinesFor(state: StudyState): HeadlineItem[] {
  const pane = state.panes[0];
  const key = variantKey(pane.variantId);
  const column = columnKey(pane.weightColumn);
  const ids = [
    `q.len.${key}`,
    "q.span",
    `q.height.${key}`,
    `q.mtow.${key}.${column}`,
    `q.range.${key}.${column}`,
  ];
  if (state.mode === "overlay") {
    const other = variantKey(state.panes[1].variantId);
    const otherColumn = columnKey(state.panes[1].weightColumn);
    ids.push(`q.len.${other}`, `q.mtow.${other}.${otherColumn}`, `q.range.${other}.${otherColumn}`);
  }
  return ids.flatMap((id) => {
    const item = headline(id, state.unit);
    return item ? [item] : [];
  });
}

function cell(id: string | null, unit: "m" | "ft"): SpecCell | null {
  if (!id) return null;
  const q = lookup(id);
  if (!q) return null;
  return { text: formatQuantity(q, unit), badges: quantityBadges(q) };
}

type RowSpec = {
  id: string;
  label: string;
  /** Quantity id for one variant and weight column. */
  pick: (key: "900" | "1000", column: "regional" | "basic" | "hgw") => string;
  /** Quantity id for the -1000 minus -900 difference, when one is published or derived. */
  delta?: string;
};

const SPEC_GROUPS: { id: string; label: string; rows: RowSpec[] }[] = [
  {
    id: "dimensions",
    label: "Dimensions",
    rows: [
      { id: "len", label: "Length", pick: (k) => `q.len.${k}`, delta: "q.derived.stretch" },
      { id: "span", label: "Wingspan", pick: () => "q.span" },
      { id: "height", label: "Height", pick: (k) => `q.height.${k}`, delta: "q.derived.heightDelta" },
      { id: "cabinWidth", label: "Cabin width", pick: () => "q.cabinWidthMax" },
      { id: "wingArea", label: "Wing area", pick: (k) => `q.wingArea.${k}` },
    ],
  },
  {
    id: "capacity",
    label: "Capacity",
    rows: [
      { id: "seatsTypical", label: "Typical seating", pick: (k) => `q.seats.typical.${k}` },
      { id: "seatsMax", label: "Max seating", pick: (k) => `q.seats.max.${k}` },
      { id: "ld3", label: "Underfloor LD3", pick: (k) => `q.cargo.ld3.${k}` },
    ],
  },
  {
    id: "weights",
    label: "Weights",
    rows: [
      { id: "mtow", label: "Max take-off", pick: (k, c) => `q.mtow.${k}.${c}` },
      { id: "mlw", label: "Max landing", pick: (k, c) => `q.mlw.${k}.${c}` },
      { id: "mzfw", label: "Max zero fuel", pick: (k, c) => `q.mzfw.${k}.${c}` },
      { id: "fuel", label: "Fuel capacity", pick: (k, c) => `q.fuelLitres.${k}.${c}` },
    ],
  },
  {
    id: "performance",
    label: "Performance",
    rows: [
      { id: "range", label: "Range", pick: (k, c) => `q.range.${k}.${c}` },
      { id: "engine", label: "Engine", pick: (k) => `q.engine.${k}` },
      { id: "thrust", label: "Take-off thrust", pick: (k) => `q.thrust.${k}` },
    ],
  },
];

/** Labelled spec sheet. One column in single view, the -900 then the -1000 when two airframes are on screen. */
export function specsFor(state: StudyState): SpecTable {
  const panes: SpecColumn[] = (state.mode === "single" ? [0] : [0, 1]).map((index) => {
    const pane = state.panes[index as 0 | 1];
    return { pane: index as 0 | 1, variantId: pane.variantId, weightColumn: pane.weightColumn };
  });
  const columns = [...panes].sort((a, b) => (a.variantId === "a350-900" ? -1 : 1) - (b.variantId === "a350-900" ? -1 : 1));
  const compare = columns.length > 1;
  const groups: SpecGroup[] = SPEC_GROUPS.map((group) => ({
    id: group.id,
    label: group.label,
    rows: group.rows.flatMap((row) => {
      const cells = columns.map((column) =>
        cell(row.pick(variantKey(column.variantId), columnKey(column.weightColumn)), state.unit),
      );
      if (cells.every((item) => item === null)) return [];
      return [{ id: row.id, label: row.label, cells, delta: compare ? cell(row.delta ?? null, state.unit) : null }];
    }),
  })).filter((group) => group.rows.length > 0);
  return { columns, groups };
}

/** Landing-page figures. High-gross columns, both variants. */
export function gateFigures(unit: "m" | "ft"): GateFigure[] {
  const rows: { label: string; pick: (k: "900" | "1000") => string }[] = [
    { label: "Length", pick: (k) => `q.len.${k}` },
    { label: "Wingspan", pick: () => "q.span" },
    { label: "Typical seating", pick: (k) => `q.seats.typical.${k}` },
    { label: "Range", pick: (k) => `q.range.${k}.hgw` },
  ];
  return rows.map((row) => ({
    label: row.label,
    cells: (["a350-900", "a350-1000"] as const).flatMap((variantId) => {
      const item = cell(row.pick(variantKey(variantId)), unit);
      return item ? [{ variantId, ...item }] : [];
    }),
  }));
}

function paneForVariant(state: StudyState, variantId: Part["variantId"]): PaneState {
  return state.panes[0].variantId === variantId ? state.panes[0] : state.panes[1];
}

function splitPick(raw: string): { variant: Part["variantId"] | null; id: string } {
  if (raw.startsWith("a350-900|")) return { variant: "a350-900", id: raw.slice("a350-900|".length) };
  if (raw.startsWith("a350-1000|")) return { variant: "a350-1000", id: raw.slice("a350-1000|".length) };
  return { variant: null, id: raw };
}

function findPart(state: StudyState, paneIndex: 0 | 1, rawId: string): Part | null {
  const picked = splitPick(rawId);
  if (picked.variant) {
    const matched = state.assemblies[picked.variant].parts.find((part) => part.id === picked.id);
    if (matched) return matched;
  }
  const primary = state.assemblies[state.panes[paneIndex].variantId];
  const direct = primary.parts.find((part) => part.id === picked.id);
  if (direct) return direct;
  if (state.mode !== "overlay") return null;
  const peer = state.assemblies[state.panes[1].variantId];
  return peer.parts.find((part) => part.id === picked.id) ?? null;
}

export function readoutFor(state: StudyState): ReadoutModel | null {
  const focus = state.selection ?? state.hover;
  if (!focus) return null;
  const pinned = state.selection !== null;
  if (focus.partId === "schematic-section-hatch") {
    return {
      title: "schematic section hatch",
      variantId: "study",
      layer: "Section",
      layerId: null,
      pinned,
      lines: [
        {
          text: "schematic section hatch",
          badges: ["schematic"],
          schematicNote: true,
        },
      ],
    };
  }
  const part = findPart(state, focus.pane, focus.partId);
  if (!part) return null;
  const column = paneForVariant(state, part.variantId).weightColumn;
  const lines = part.quantityIds.flatMap((id) => {
    if (!quantityVisible(id, column, part.id)) return [];
    const q = lookup(id);
    return q ? [lineFor(q, state.unit)] : [];
  });
  if (lines.length === 0) {
    lines.push({
      text: "No published value",
      badges: ["schematic"],
      schematicNote: true,
    });
  }
  return {
    title: part.name,
    variantId: part.variantId,
    layer: LAYER_LABEL[part.layerId] ?? part.layerId,
    layerId: part.layerId,
    pinned,
    lines,
  };
}

export function annotationsFor(state: StudyState): string[] {
  const panes = state.mode === "single" ? [state.panes[0]] : state.panes;
  if (!panes.some((pane) => pane.overlays.differences)) return [];
  return ["q.note.door3", "q.note.typeC"].flatMap((id) => {
    const q = lookup(id);
    return q ? [formatQuantity(q, state.unit)] : [];
  });
}

export function gapEntries(): { id: string; text: string }[] {
  return gapQuantities().map((q) => ({ id: q.id, text: q.displayText ?? q.displaySI ?? q.id }));
}

export function dimensionFor(state: StudyState, index: 0 | 1): { text: string; badge: string; edge: "bottom" | "right" } | null {
  const pane = state.panes[index];
  if (!pane.overlays.dimensions || pane.camera.mode !== "ortho") return null;
  const key = variantKey(pane.variantId);
  const id =
    pane.camera.preset === "side"
      ? `q.len.${key}`
      : pane.camera.preset === "plan"
        ? "q.span"
        : pane.camera.preset === "front"
          ? `q.height.${key}`
          : null;
  if (!id) return null;
  const q = lookup(id);
  if (!q) return null;
  const badges = quantityBadges(q);
  return {
    text: formatQuantity(q, state.unit),
    badge: badges[0] ?? "sourced",
    edge: pane.camera.preset === "front" ? "right" : "bottom",
  };
}


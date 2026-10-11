export type VariantId = "a350-900" | "a350-1000";
export type WeightColumn = "regional" | "basic" | "highGross";
export type OrthoPresetId = "plan" | "side" | "front" | "three-quarter";

export interface HeadlineItem {
  id: string;
  label: string;
  text: string;
  badges: string[];
}

export interface ReadoutLine {
  label?: string;
  text: string;
  badges: string[];
  formula?: string;
  alternates?: { display: string; citationId: string; note: string }[];
  citation?: string;
  schematicNote: boolean;
}

export interface ReadoutModel {
  title: string;
  variantId: string;
  layer: string;
  layerId: string | null;
  pinned: boolean;
  lines: ReadoutLine[];
}

export interface SpecCell {
  text: string;
  badges: string[];
}

export interface SpecRow {
  id: string;
  label: string;
  /** One cell per column, in column order. */
  cells: (SpecCell | null)[];
  /** Published or derived difference between the two columns, when one exists. */
  delta: SpecCell | null;
}

export interface SpecGroup {
  id: string;
  label: string;
  rows: SpecRow[];
}

export interface SpecColumn {
  pane: 0 | 1;
  variantId: VariantId;
  weightColumn: WeightColumn;
}

export interface SpecTable {
  columns: SpecColumn[];
  groups: SpecGroup[];
}

export interface GateFigure {
  label: string;
  cells: { variantId: VariantId; text: string; badges: string[] }[];
}

export interface DimLabel {
  text: string;
  badge: string;
  edge: "bottom" | "right";
}

export interface TickLabel {
  x: number;
  y: number;
  text: string;
}

export interface PartLabel {
  x: number;
  y: number;
  text: string;
  selected: boolean;
  anchorX: number;
  anchorY: number;
}

export const VARIANT_LABEL: Record<VariantId, string> = {
  "a350-900": "A350-900",
  "a350-1000": "A350-1000",
};

export function variantColor(variantId: VariantId): string {
  return variantId === "a350-1000" ? "var(--v1000)" : "var(--v900)";
}

export function weightColumnsFor(variantId: VariantId): { id: WeightColumn; label: string }[] {
  if (variantId === "a350-1000") {
    return [
      { id: "basic", label: "Basic" },
      { id: "highGross", label: "High gross" },
    ];
  }
  return [
    { id: "regional", label: "Regional" },
    { id: "basic", label: "Basic" },
    { id: "highGross", label: "High gross" },
  ];
}

export const NOTICE =
  "Independent study tool. Not affiliated with Airbus. Not for maintenance, training, or flight operations. Sourced figures are labelled. Everything else is schematic.";

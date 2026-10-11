export type Grade = "sourced" | "derived" | "schematic";
export type Authority = "primary" | "secondary";
export type Confidence = "high" | "conflict" | "low" | "needs-reconfirm";

export interface Citation {
  id: string;
  title: string;
  publisher: string;
  documentId?: string;
  revision?: string;
  date: string;
  url?: string;
  /** Short quote that contains the figure, or the qualitative claim. */
  quote: string;
  authority: Authority;
}

export interface AlternateClaim {
  display: string;
  citationId: string;
  note: string;
}

export interface Quantity {
  id: string;
  grade: Grade;
  /** Required when grade is "sourced". Ignored for schematic. */
  authority?: Authority;
  confidence: Confidence;
  citationIds: string[];
  /** Required when grade is "derived". */
  formula?: string;
  /** Quantity ids the formula reads. */
  inputs?: string[];
  si?: { value: number; unit: string };
  /** Published rendering. Format this, do not re-round the float. */
  displaySI?: string;
  /** Published imperial rendering, if the source printed one. Never a conversion. */
  displayImperial?: string;
  displayText?: string;
  alternates?: AlternateClaim[];
  /** Included in the in-app gap list when true. */
  gap?: boolean;
}

export type BadgeName = "sourced" | "secondary" | "derived" | "schematic" | "unverified";

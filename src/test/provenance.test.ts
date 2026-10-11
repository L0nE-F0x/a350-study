import { describe, expect, it } from "vitest";
import {
  CITATIONS,
  QUANTITIES,
  assertDataPack,
  formatQuantity,
  getCitation,
  quantityBadges,
  quantityById,
  type Quantity,
} from "../data/provenance/index.ts";

function norm(value: string): string {
  return value.replace(/[ ,]/g, "");
}

function canonicalDisplay(q: Quantity): string {
  return q.displaySI ?? q.displayText ?? "";
}

describe("data pack", () => {
  it("accepts the shipped pack", () => {
    expect(() => assertDataPack()).not.toThrow();
  });

  it("rejects a raw number", () => {
    expect(() => formatQuantity(1 as never, "m")).toThrow();
  });
});

describe("sourced citations", () => {
  it("quotes the canonical display after spaces and commas are removed", () => {
    const sourced = QUANTITIES.filter((q) => q.grade === "sourced" && q.confidence !== "needs-reconfirm");
    expect(sourced.length).toBeGreaterThan(0);
    for (const q of sourced) {
      const display = canonicalDisplay(q);
      expect(display.length).toBeGreaterThan(0);
      const needle = norm(display);
      const quoted = q.citationIds.some((id) => norm(getCitation(id).quote).includes(needle));
      expect(quoted).toBe(true);
    }
  });

  it("treats the stored -900 key figures as high and sourced", () => {
    for (const id of ["q.cabinLen.900", "q.track.900", "q.wheelbase.900"] as const) {
      const q = quantityById(id);
      expect(q.confidence).toBe("high");
      const badges = quantityBadges(q);
      expect(badges).toContain("sourced");
      expect(badges).not.toContain("unverified");
      expect(formatQuantity(q, "m").startsWith("Unverified until the product page is re-checked: ")).toBe(false);
    }
  });

  it("marks any remaining needs-reconfirm quantity unverified", () => {
    const pending = QUANTITIES.filter((q) => q.confidence === "needs-reconfirm");
    for (const q of pending) {
      const badges = quantityBadges(q);
      expect(badges).toContain("unverified");
      expect(badges).not.toContain("sourced");
      expect(formatQuantity(q, "m").startsWith("Unverified until the product page is re-checked: ")).toBe(true);
    }
  });

  it("keeps the product-page key figures on the -900 citation", () => {
    const quote = getCitation("cite.airbus.product.a350-900").quote;
    expect(quote.startsWith("Key figures:") || quote.includes("Key figures:")).toBe(true);
    expect(quote).toContain("51.04 m");
    expect(quote).toContain("10.60 m");
    expect(quote).toContain("28.67 m");
    expect(quote).toContain("15,750 km");
    expect(quote).toContain("8,600 NM");
    const stored = CITATIONS["cite.airbus.product.a350-900"];
    expect(stored?.quote).toBe(quote);
  });
});

describe("grades and conflicts", () => {
  it("does not give a schematic quantity primary authority", () => {
    for (const q of QUANTITIES) {
      if (q.grade === "schematic") expect(q.authority).not.toBe("primary");
    }
  });

  it("keeps fuselage width, thrust, MTOW, fuel, and range conflicts", () => {
    const width = quantityById("q.fuseWidth");
    expect(canonicalDisplay(width)).toContain("5.96 m");
    expect(width.alternates?.some((alt) => alt.display.includes("5.94 m"))).toBe(true);
    const widthBadges = quantityBadges(width);
    expect(widthBadges).toContain("conflict");
    expect(widthBadges).toContain("sourced");

    const thrust = quantityById("q.thrust.900");
    expect(canonicalDisplay(thrust)).toBe("374.5 kN (84,200 lbf)");
    expect(thrust.alternates?.some((alt) => alt.display.includes("84,000 lbf"))).toBe(true);
    expect(quantityBadges(thrust)).toContain("conflict");

    const mtow = quantityById("q.mtow.1000.hgw");
    expect(canonicalDisplay(mtow)).toContain("322 000 kg");
    expect(mtow.alternates?.some((alt) => alt.display.includes("324.00 t"))).toBe(true);

    const fuel = quantityById("q.fuel.1000.basic.totalL");
    expect(canonicalDisplay(fuel)).toContain("158 791 L");
    expect(fuel.alternates?.some((alt) => alt.display.includes("158 790 L"))).toBe(true);

    const range = quantityById("q.range.900.hgw");
    const rangeText = canonicalDisplay(range);
    expect(rangeText).toContain("8,500 NM");
    expect(rangeText).toContain("15,750 km");
    expect(rangeText).toContain("15,750");
    expect(rangeText).not.toContain("15,742");
    expect(8500 * 1.852).not.toBe(15750);
    expect(range.alternates?.some((alt) => alt.display === "8,600 NM" || alt.display.includes("8,600 NM"))).toBe(true);

    const range1000 = canonicalDisplay(quantityById("q.range.1000.hgw"));
    expect(range1000).toContain("9,000 NM*");
    expect(range1000).toContain("16,700 km");
    expect(range1000).toContain("EIS 2030");

    const xwb75 = quantityById("q.mtow.900.xwb75");
    expect(xwb75.id.includes(".regional")).toBe(false);
    expect(canonicalDisplay(xwb75)).toContain("255 t");
  });
});

describe("gaps", () => {
  it("lists the unpublished topics without a primary number", () => {
    const gaps = QUANTITIES.filter((q) => q.gap === true);
    expect(gaps.length).toBeGreaterThanOrEqual(19);
    const texts = gaps.map((q) => q.displayText ?? "");
    expect(texts.some((text) => text.includes("frame stations"))).toBe(true);
    expect(texts.some((text) => text.includes("ply books"))).toBe(true);
    expect(texts.some((text) => text.toLowerCase().includes("hydraulic routes"))).toBe(true);
    for (const gap of gaps) {
      expect(gap.authority).not.toBe("primary");
      expect(gap.si).toBeUndefined();
    }
  });
});

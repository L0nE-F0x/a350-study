import { describe, expect, it } from "vitest";
import { derivedSI, quantityBadges, quantityById } from "../data/provenance/index.ts";

const DERIVED_IDS = [
  "q.derived.stretch",
  "q.derived.semiSpan",
  "q.derived.halfLen.900",
  "q.derived.halfLen.1000",
  "q.derived.wheelbaseDelta",
  "q.derived.trackDelta",
  "q.derived.heightDelta",
  "q.derived.cabinDelta",
  "q.derived.fuel.900.hgw.wings",
  "q.derived.fuel.1000.hgw.kg",
] as const;

function si(id: string): number {
  const value = quantityById(id).si?.value;
  if (value === undefined) throw new Error(`${id} has no si value`);
  return value;
}

describe("derived quantities", () => {
  it("declares a formula and the inputs it reads", () => {
    for (const id of DERIVED_IDS) {
      const q = quantityById(id);
      expect(q.grade).toBe("derived");
      expect(typeof q.formula).toBe("string");
      expect((q.formula ?? "").length).toBeGreaterThan(0);
      expect((q.inputs ?? []).length).toBeGreaterThan(0);
    }
  });

  it("recomputes length deltas from the input si values", () => {
    const stretch = derivedSI(quantityById("q.derived.stretch"));
    const len1000 = si("q.len.1000");
    const len900 = si("q.len.900");
    expect(Math.abs(stretch - (len1000 - len900))).toBeLessThan(1e-9);
    expect(Math.abs(stretch - 6.98)).toBeLessThan(1e-6);

    const semi = derivedSI(quantityById("q.derived.semiSpan"));
    expect(Math.abs(semi - si("q.span") / 2)).toBeLessThan(1e-9);
    expect(Math.abs(semi - 32.375)).toBeLessThan(1e-9);

    expect(Math.abs(derivedSI(quantityById("q.derived.halfLen.900")) - 33.4)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.halfLen.900")) - si("q.len.900") / 2)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.halfLen.1000")) - 36.89)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.halfLen.1000")) - si("q.len.1000") / 2)).toBeLessThan(1e-9);

    expect(Math.abs(derivedSI(quantityById("q.derived.wheelbaseDelta")) - (si("q.wheelbase.1000") - si("q.wheelbase.900")))).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.wheelbaseDelta")) - 3.81)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.trackDelta")) - (si("q.track.1000") - si("q.track.900")))).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.trackDelta")) - 0.13)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.heightDelta")) - (si("q.height.1000") - si("q.height.900")))).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.heightDelta")) - 0.03)).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.cabinDelta")) - (si("q.cabinLen.1000") - si("q.cabinLen.900")))).toBeLessThan(1e-9);
    expect(Math.abs(derivedSI(quantityById("q.derived.cabinDelta")) - 6.99)).toBeLessThan(1e-9);
  });

  it("badges the -900 deltas derived once those inputs are high", () => {
    for (const id of ["q.cabinLen.900", "q.track.900", "q.wheelbase.900"] as const) {
      expect(quantityById(id).confidence).toBe("high");
    }
    for (const id of ["q.derived.wheelbaseDelta", "q.derived.trackDelta", "q.derived.cabinDelta"] as const) {
      const badges = quantityBadges(quantityById(id));
      expect(badges).toContain("derived");
      expect(badges).not.toContain("unverified");
    }
  });

  it("doubles the high-gross -900 wing exactly", () => {
    expect(derivedSI(quantityById("q.derived.fuel.900.hgw.wings"))).toBe(2 * 29726);
    expect(derivedSI(quantityById("q.derived.fuel.900.hgw.wings"))).toBe(59452);
  });

  it("balances the three TCDS fuel rows", () => {
    const rows = [
      {
        wingL: "q.fuel.900.basic.wingOne",
        wingKg: "q.fuel.900.basic.wingOneKg",
        centreL: "q.fuel.900.basic.centre",
        centreKg: "q.fuel.900.basic.centreKg",
        totalL: "q.fuel.900.basic.totalL",
        totalKg: "q.fuel.900.basic.totalKg",
        litres: [29924, 80947, 140795],
        kg: [23490, 63543, 110523],
      },
      {
        wingL: "q.fuel.900.hgw.wingOne",
        wingKg: "q.fuel.900.hgw.wingOneKg",
        centreL: "q.fuel.900.hgw.centre",
        centreKg: "q.fuel.900.hgw.centreKg",
        totalL: "q.fuel.900.hgw.totalL",
        totalKg: "q.fuel.900.hgw.totalKg",
        litres: [29726, 107036, 166488],
        kg: [23335, 84023, 130693],
      },
      {
        wingL: "q.fuel.1000.basic.wingOne",
        wingKg: "q.fuel.1000.basic.wingOneKg",
        centreL: "q.fuel.1000.basic.centre",
        centreKg: "q.fuel.1000.basic.centreKg",
        totalL: "q.fuel.1000.basic.totalL",
        totalKg: "q.fuel.1000.basic.totalKg",
        litres: [29437, 99917, 158791],
        kg: [23108, 78435, 124651],
      },
    ] as const;

    for (const row of rows) {
      const wingL = si(row.wingL);
      const wingKg = si(row.wingKg);
      const centreL = si(row.centreL);
      const centreKg = si(row.centreKg);
      const totalL = si(row.totalL);
      const totalKg = si(row.totalKg);
      expect(wingL).toBe(row.litres[0]);
      expect(centreL).toBe(row.litres[1]);
      expect(totalL).toBe(row.litres[2]);
      expect(wingKg).toBe(row.kg[0]);
      expect(centreKg).toBe(row.kg[1]);
      expect(totalKg).toBe(row.kg[2]);
      expect(2 * wingL + centreL).toBe(totalL);
      expect(Math.abs(2 * wingKg + centreKg - totalKg)).toBeLessThanOrEqual(2);
      expect(Math.abs(wingL * 0.785 - wingKg)).toBeLessThanOrEqual(2);
      expect(Math.abs(centreL * 0.785 - centreKg)).toBeLessThanOrEqual(2);
      expect(Math.abs(totalL * 0.785 - totalKg)).toBeLessThanOrEqual(2);
    }
  });

  it("keeps each schematic plug free of a printed millimetre", () => {
    const plug = quantityById("q.schematic.plug");
    const plugSi = plug.si?.value;
    expect(plug.grade).toBe("schematic");
    expect(typeof plug.displayText).toBe("string");
    expect(plug.displayText ?? "").not.toMatch(/\d/);
    if (plugSi === undefined) throw new Error("q.schematic.plug has no si value");
    expect(Math.abs(2 * plugSi - derivedSI(quantityById("q.derived.stretch")))).toBeLessThan(1e-9);
  });
});

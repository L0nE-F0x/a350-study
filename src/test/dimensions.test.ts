import { describe, expect, it } from "vitest";
import {
  analyticWingAreaM2,
  buildVariant,
  chordAtY,
  constantSectionWidth,
  measure,
  teExtensionAreaM2,
} from "../data/airframe/index.ts";

const a900 = buildVariant("a350-900");
const a1000 = buildVariant("a350-1000");

function within(actual: number, expected: number, tolerance: number): void {
  expect(Math.abs(actual - expected)).toBeLessThanOrEqual(tolerance);
}

describe("published measures", () => {
  it("matches length, span, and height within 0.05 m", () => {
    within(a900.measures.lengthM, 66.8, 0.05);
    within(a900.measures.spanM, 64.75, 0.05);
    within(a900.measures.heightM, 17.05, 0.05);
    within(a1000.measures.lengthM, 73.78, 0.05);
    within(a1000.measures.spanM, 64.75, 0.05);
    within(a1000.measures.heightM, 17.08, 0.05);
    expect(measure(a900.parts)).toEqual(a900.measures);
    expect(measure(a1000.parts)).toEqual(a1000.measures);
  });

  it("matches track and wheelbase within 0.05 m", () => {
    within(a900.measures.trackM, 10.6, 0.05);
    within(a900.measures.wheelbaseM, 28.67, 0.05);
    within(a1000.measures.trackM, 10.73, 0.05);
    within(a1000.measures.wheelbaseM, 32.48, 0.05);
  });
});

describe("analytic wing", () => {
  it("uses the centreline trapezoid, not the exposed mesh", () => {
    within(analyticWingAreaM2(), 441.92, 0.05);
    within(teExtensionAreaM2(), 22.34, 0.05);
    expect(Math.abs(analyticWingAreaM2() - 442) / 442).toBeLessThan(0.05);
    expect(Math.abs(analyticWingAreaM2() + teExtensionAreaM2() - 464.3) / 464.3).toBeLessThan(0.05);
    expect(Math.abs(chordAtY(2.98) - 9.82346)).toBeLessThan(0.01);
  });
});

describe("constant section", () => {
  it("uses 5.96 m and not the 5.94 m alternate", () => {
    const width = constantSectionWidth(a900);
    expect(Math.abs(width - 5.96)).toBeLessThan(0.05);
    expect(Math.abs(width - 5.94)).toBeGreaterThan(0.01);
  });
});

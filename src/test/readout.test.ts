import { beforeEach, describe, expect, it } from "vitest";
import { headlinesFor, quantityVisible } from "../app/readout.ts";
import { getStore, initStore, resetStore } from "../app/store.ts";
import { buildVariant } from "../data/airframe/index.ts";
import { placeLabels, stationTickLabels } from "../app/labels.ts";

const a900 = buildVariant("a350-900");
const a1000 = buildVariant("a350-1000");

beforeEach(() => {
  initStore(a900, a1000);
  resetStore();
});

describe("readout headlines", () => {
  it("shows the canonical -900 length with a sourced badge", () => {
    const items = headlinesFor(getStore().getState());
    const length = items.find((item) => item.id === "q.len.900");
    expect(length?.text).toBe("66.80 m");
    expect(length?.badges).toContain("sourced");
  });
});

describe("quantity column filter", () => {
  it("keeps the high-gross figure and the regional fuel basic split", () => {
    expect(quantityVisible("q.mtow.900.hgw", "highGross", "engine.rating.left")).toBe(true);
    expect(quantityVisible("q.mtow.900.basic", "highGross", "engine.rating.left")).toBe(false);
    expect(quantityVisible("q.fuel.900.basic.wingOne", "regional", "fuel.wing.left")).toBe(true);
    expect(quantityVisible("q.fuel.900.basic.wingOne", "highGross", "fuel.wing.left")).toBe(false);
    expect(quantityVisible("q.span", "basic", "wing.left")).toBe(true);
  });
});

describe("label placement", () => {
  it("keeps the selected label and caps the rest", () => {
    const items = Array.from({ length: 30 }, (_, index) => ({
      id: `p${index}`,
      text: `Part ${index}`,
      x: 10 + (index % 5) * 4,
      y: 10,
      selected: index === 29,
      hovered: false,
      layerIndex: index,
    }));
    const placed = placeLabels(items, 400, 300);
    expect(placed.some((label) => label.selected)).toBe(true);
    expect(placed.filter((label) => !label.selected).length).toBeLessThanOrEqual(24);
  });

  it("staggers station ticks so neighbouring labels do not cover each other", () => {
    const store = getStore();
    store.getState().setInspect(0, "ortho");
    store.getState().setPreset(0, "side");
    const state = store.getState();
    const bbox = state.assemblies["a350-900"].bbox;
    const ticks = stationTickLabels(
      bbox.min.x,
      bbox.max.x,
      (x) => ({ x, y: 0, z: bbox.min.z }),
      state.panes[0].camera,
      886,
      336,
    );
    expect(ticks.length).toBeGreaterThan(4);
    for (const tick of ticks) expect(tick.text).toMatch(/^x = -?\d+ m \(study\)$/);
    for (let i = 0; i < ticks.length; i += 1) {
      for (let j = i + 1; j < ticks.length; j += 1) {
        const a = ticks[i];
        const b = ticks[j];
        if (!a || !b) continue;
        const hit = a.x < b.x + 136 && a.x + 136 > b.x && a.y < b.y + 14 && a.y + 14 > b.y;
        expect(hit).toBe(false);
      }
    }
  });
});

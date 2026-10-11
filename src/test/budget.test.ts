import { describe, expect, it } from "vitest";
import { buildVariant, estimateDrawCalls, estimateTriangles } from "../data/airframe/index.ts";
import type { Assembly, Part } from "../shared/types/index.ts";

const a900 = buildVariant("a350-900");
const a1000 = buildVariant("a350-1000");

describe("triangle budget", () => {
  it("stays within one aircraft and the pair", () => {
    const triangles900 = estimateTriangles(a900);
    const triangles1000 = estimateTriangles(a1000);
    expect(triangles900).toBeLessThanOrEqual(450_000);
    expect(triangles1000).toBeLessThanOrEqual(450_000);
    expect(triangles900 + triangles1000).toBeLessThanOrEqual(800_000);
  });
});

describe("draw calls", () => {
  it("counts the closed tally, the hatch, and not a logical flap", () => {
    expect(estimateDrawCalls([a900, a1000], "x")).toBe(49);
    expect(estimateDrawCalls([a900, a1000], "none")).toBe(48);
    expect(estimateDrawCalls([a900], "none")).toBe(24);
    expect(estimateDrawCalls([a900], "none")).not.toBe(25);
    expect(estimateDrawCalls([a900], "none")).toBe(estimateDrawCalls([a900], "none"));

    const donor = a900.parts[0];
    if (!donor) throw new Error("assembly has no parts");
    const flap: Part = { ...donor, id: "flight.flap.conceptual", name: "Schematic flap" };
    const withFlap: Assembly = { ...a900, parts: [...a900.parts, flap] };
    expect(withFlap.parts.length).toBe(a900.parts.length + 1);
    expect(estimateDrawCalls([withFlap], "none")).toBe(estimateDrawCalls([a900], "none"));
    expect(estimateDrawCalls([withFlap, a1000], "none")).toBe(estimateDrawCalls([a900, a1000], "none"));
  });
});

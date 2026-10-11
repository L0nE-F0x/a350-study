import { describe, expect, it } from "vitest";
import { buildVariant, tipX } from "../data/airframe/index.ts";
import type { Part } from "../shared/types/index.ts";

function xExtent(part: Part): number {
  return part.bboxLocal.max.x - part.bboxLocal.min.x;
}

describe("registration", () => {
  const a900 = buildVariant("a350-900");
  const a1000 = buildVariant("a350-1000");

  it("plants both wing boxes on the origin", () => {
    const box900 = a900.parts.find((part) => part.id === "wing.box");
    const box1000 = a1000.parts.find((part) => part.id === "wing.box");
    expect(box900).toBeDefined();
    expect(box1000).toBeDefined();
    expect(box900?.assembled.position).toEqual({ x: 0, y: 0, z: 0 });
    expect(box1000?.assembled.position).toEqual({ x: 0, y: 0, z: 0 });
    const left = box900?.assembled.position;
    const right = box1000?.assembled.position;
    if (!left || !right) throw new Error("wing.box missing");
    expect(Math.abs(left.x - right.x)).toBeLessThan(1e-6);
    expect(Math.abs(left.y - right.y)).toBeLessThan(1e-6);
    expect(Math.abs(left.z - right.z)).toBeLessThan(1e-6);
  });

  it("moves nose and tail tips by 3.49 m", () => {
    const noseDiff = Math.abs(tipX(a1000, "fuse.nose") - tipX(a900, "fuse.nose"));
    const tailDiff = Math.abs(tipX(a1000, "fuse.tail") - tipX(a900, "fuse.tail"));
    expect(Math.abs(noseDiff - 3.49)).toBeLessThan(1e-6);
    expect(Math.abs(tailDiff - 3.49)).toBeLessThan(1e-6);
  });

  it("adds the two plugs only on the -1000 and sums them to the stretch", () => {
    expect(a900.parts.some((part) => part.id === "fuse.plug.fwd" || part.id === "fuse.plug.aft")).toBe(false);
    const fwd = a1000.parts.find((part) => part.id === "fuse.plug.fwd");
    const aft = a1000.parts.find((part) => part.id === "fuse.plug.aft");
    expect(fwd).toBeDefined();
    expect(aft).toBeDefined();
    if (!fwd || !aft) throw new Error("plugs missing");
    expect(fwd.layerId).toBe("skin");
    expect(aft.layerId).toBe("skin");
    expect(fwd.explodeGroup).toBe("skin");
    expect(aft.explodeGroup).toBe("skin");
    expect(fwd.diffTag).toBe("added");
    expect(aft.diffTag).toBe("added");
    expect(Math.abs(xExtent(fwd) + xExtent(aft) - 6.98)).toBeLessThan(1e-6);
  });

  it("does not mutate the -900 when the -1000 is built", () => {
    const a = buildVariant("a350-900");
    const before = a.measures.lengthM;
    buildVariant("a350-1000");
    expect(a.measures.lengthM).toBe(before);
  });

  it("counts main wheels per side and wheels overall", () => {
    const leftWheels = (assembly: typeof a900) =>
      assembly.parts.filter((part) => part.id.includes("gear.wheel.main.left")).length;
    expect(leftWheels(a900)).toBe(4);
    expect(leftWheels(a1000)).toBe(6);
    const wheels = (assembly: typeof a900) =>
      assembly.parts.filter((part) => part.id.startsWith("gear.") && part.name.toLowerCase().includes("wheel")).length;
    expect(wheels(a900)).toBe(10);
    expect(wheels(a1000)).toBe(14);
  });

  it("keeps both engine rating plates common", () => {
    for (const assembly of [a900, a1000]) {
      for (const id of ["engine.rating.left", "engine.rating.right"] as const) {
        const plate = assembly.parts.find((part) => part.id === id);
        expect(plate).toBeDefined();
        expect(plate?.diffTag).toBe("common");
      }
    }
  });

  it("tags the -900 shift without marking the common wing, cargo, or tail surfaces added", () => {
    expect(a900.parts.filter((part) => part.diffTag === "added")).toHaveLength(0);
    const shifted = a900.parts.filter((part) => part.diffTag === "shifted").map((part) => part.id);
    for (const id of ["fuse.nose", "fuse.tail", "vtail", "htail", "gear.nose"]) {
      expect(shifted).toContain(id);
    }
    expect(shifted.some((id) => id.startsWith("cabin."))).toBe(true);
    const forbidden = ["flight.flap", "flight.slat", "cargo.", "gear.main", "gear.wheel.main", "flight.rudder", "flight.elevator"];
    for (const id of shifted) {
      for (const prefix of forbidden) expect(id.startsWith(prefix)).toBe(false);
    }
    expect(a900.parts.find((part) => part.id === "flight.rudder")?.diffTag).toBe("common");
    expect(a900.parts.find((part) => part.id === "flight.elevator")?.diffTag).toBe("common");
  });

  it("adds the -1000 trailing-edge strips and the extra axles", () => {
    for (const id of ["wing.teExtension.left", "wing.teExtension.right"] as const) {
      const part = a1000.parts.find((item) => item.id === id);
      expect(part).toBeDefined();
      expect(part?.diffTag).toBe("added");
      expect(part?.layerId).toBe("skin");
      expect(part?.explodeGroup).toBe("skin");
    }
    const addedAxles = a1000.parts.filter((part) => part.id.startsWith("gear.axle.") && part.diffTag === "added");
    expect(addedAxles.length).toBeGreaterThan(0);
  });

  it("builds both variant ids", () => {
    expect(buildVariant("a350-900").variantId).toBe("a350-900");
    expect(buildVariant("a350-1000").variantId).toBe("a350-1000");
  });

  it("builds both variants in under a second", () => {
    const t = performance.now();
    buildVariant("a350-900");
    buildVariant("a350-1000");
    expect(performance.now() - t).toBeLessThan(1000);
  });
});

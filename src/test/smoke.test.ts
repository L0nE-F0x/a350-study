import { describe, expect, it } from "vitest";
import { QUANTITIES, assertDataPack } from "../data/provenance/index.ts";
import { FRAME } from "../shared/frame/index.ts";

describe("smoke", () => {
  it("frames the study in metres, aft, on the -900 mid-length origin", () => {
    expect(FRAME.unit).toBe("m");
    expect(FRAME.axisX).toBe("aft");
    expect(FRAME.origin).toBe("schematic-wrp-a350-900-midlength");
  });

  it("accepts a data pack of more than forty quantities", () => {
    expect(() => assertDataPack()).not.toThrow();
    expect(QUANTITIES.length).toBeGreaterThan(40);
  });
});

import { describe, expect, it } from "vitest";
import { buildVariant } from "../data/airframe/index.ts";
import { EXPLODE_OFFSETS, easeInOutCubic, sampleTranslation } from "../interaction/explode/index.ts";
import type { Part, Vec3 } from "../shared/types/index.ts";

function makePart(id: string, explodeGroup: string, lateralSign: 1 | -1, position: Vec3, layerId: Part["layerId"] = "engines"): Part {
  return {
    id,
    variantId: "a350-900",
    layerId,
    explodeGroup,
    name: id,
    lateralSign,
    assembled: { position: { x: position.x, y: position.y, z: position.z } },
    bboxLocal: {
      min: { x: 0, y: 0, z: 0 },
      max: { x: 0, y: 0, z: 0 },
    },
    quantityIds: [],
    diffTag: "common",
    pickable: true,
  };
}

function expectVec(actual: Vec3, expected: Vec3, eps = 1e-9): void {
  expect(Math.abs(actual.x - expected.x)).toBeLessThan(eps);
  expect(Math.abs(actual.y - expected.y)).toBeLessThan(eps);
  expect(Math.abs(actual.z - expected.z)).toBeLessThan(eps);
}

describe("sampleTranslation", () => {
  it("returns the assembled position at u = 0", () => {
    const engine = makePart("engine.port", "engines", -1, { x: 1, y: -12, z: -1.5 });
    const htail = makePart("htail", "structure.empennage", 1, { x: 4, y: 0, z: 2 }, "skin");
    expectVec(sampleTranslation(engine, 0), engine.assembled.position);
    expectVec(sampleTranslation(htail, 0), htail.assembled.position);
  });

  it("spreads the engines outward and keeps the midpoint", () => {
    const port = makePart("engine.port", "engines", -1, { x: 1, y: -12, z: -1.5 });
    const starboard = makePart("engine.starboard", "engines", 1, { x: 1, y: 12, z: -1.5 });
    expectVec(sampleTranslation(port, 1), { x: 1, y: -20, z: -3.5 });
    expectVec(sampleTranslation(port, 0.5), { x: 1, y: -16, z: -2.5 });
    expectVec(sampleTranslation(starboard, 1), { x: 1, y: 20, z: -3.5 });
  });

  it("translates both electrics runs by the same port vector", () => {
    const port = makePart("electrics.port", "electrics", -1, { x: 0, y: -4, z: 0 }, "electrics");
    const starboard = makePart("electrics.starboard", "electrics", 1, { x: 0, y: 4, z: 0 }, "electrics");
    const portAt = sampleTranslation(port, 1);
    const starboardAt = sampleTranslation(starboard, 1);
    expectVec(portAt, { x: 0, y: -10, z: 0 });
    expectVec(starboardAt, { x: 0, y: -2, z: 0 });
    expectVec(
      { x: portAt.x - port.assembled.position.x, y: portAt.y - port.assembled.position.y, z: portAt.z - port.assembled.position.z },
      { x: 0, y: -6, z: 0 },
    );
    expectVec(
      {
        x: starboardAt.x - starboard.assembled.position.x,
        y: starboardAt.y - starboard.assembled.position.y,
        z: starboardAt.z - starboard.assembled.position.z,
      },
      { x: 0, y: -6, z: 0 },
    );
    expect(portAt.x).toBe(port.assembled.position.x);
    expect(starboardAt.x).toBe(starboard.assembled.position.x);
  });

  it("adds the empennage offset without mirroring X", () => {
    const assembled = { x: 4, y: 0, z: 2 };
    const htail = makePart("htail", "structure.empennage", 1, assembled, "skin");
    expectVec(sampleTranslation(htail, 1), { x: assembled.x + 8, y: assembled.y, z: assembled.z + 1 });
  });

  it("adds offset X with no lateral sign", () => {
    for (const [group, offset] of Object.entries(EXPLODE_OFFSETS)) {
      const part = makePart(group, group, -1, { x: 3, y: -4, z: 1 });
      for (const u of [0, 0.5, 1]) {
        const got = sampleTranslation(part, u, EXPLODE_OFFSETS);
        expect(Math.abs(got.x - (part.assembled.position.x + u * offset.x))).toBeLessThan(1e-9);
      }
    }
  });

  it("lifts the -1000 plugs with the skin offset", () => {
    const plugs = buildVariant("a350-1000").parts.filter((part) => part.id === "fuse.plug.fwd" || part.id === "fuse.plug.aft");
    expect(plugs).toHaveLength(2);
    for (const part of plugs) {
      expect(part.explodeGroup).toBe("skin");
      expect(part.layerId).toBe("skin");
      const at = sampleTranslation(part, 1);
      expectVec(
        { x: at.x - part.assembled.position.x, y: at.y - part.assembled.position.y, z: at.z - part.assembled.position.z },
        { x: 0, y: 0, z: 4 },
      );
    }
  });

  it("does not mutate the assembled position", () => {
    const part = makePart("engine.port", "engines", -1, { x: 1, y: -12, z: -1.5 });
    const before = { ...part.assembled.position };
    sampleTranslation(part, 1);
    expect(part.assembled.position).toEqual(before);
  });
});

describe("easeInOutCubic", () => {
  it("is pinned at the ends and the midpoint", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });
});

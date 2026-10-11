import { describe, expect, it } from "vitest";
import { buildVariant } from "../data/airframe/index.ts";
import { flightBody, flightPose, hingePlacement, rotateAbout } from "../shared/phase/index.ts";

describe("flight phase", () => {
  const a900 = buildVariant("a350-900");
  const a1000 = buildVariant("a350-1000");

  it("keeps the gate dark and the takeoff configured", () => {
    const gate = flightPose(0, 0);
    expect(gate.gear).toBe(0);
    expect(gate.flap).toBe(0);
    expect(gate.nav).toBe(0);
    expect(gate.beacon).toBe(0);
    expect(gate.strobe).toBe(0);
    expect(gate.land).toBe(0);
    expect(gate.cabin).toBe(1);
    const push = flightPose(1, 0);
    expect(push.beacon).toBe(1);
    expect(push.nav).toBe(1);
    expect(push.strobe).toBe(0);
    const lineup = flightPose(3, 0);
    expect(lineup.flap).toBe(1);
    expect(lineup.strobe).toBe(1);
    expect(lineup.land).toBe(1);
    expect(lineup.gear).toBe(0);
    const high = flightPose(6, 0);
    expect(high.gear).toBe(1);
    expect(high.flap).toBe(0);
    expect(high.land).toBe(0);
    expect(flightPose(6, 1).gear).toBe(0);
    expect(flightPose(6, 1).flap).toBe(0);
    expect(flightPose(6, 1).nav).toBe(1);
  });

  it("folds the nose forward and the main gear inboard", () => {
    const dropped = rotateAbout("y", 0.4, { x: 0, y: 0, z: -1 });
    expect(dropped.x).toBeLessThan(0);
    const starboard = rotateAbout("x", -0.5, { x: 0, y: 0.2, z: -1 });
    expect(starboard.y).toBeLessThan(0);
    const port = rotateAbout("x", 0.5, { x: 0, y: -0.2, z: -1 });
    expect(port.y).toBeGreaterThan(0);

    const nose = a900.parts.find((part) => part.id === "gear.nose");
    const noseWheel = a900.parts.find((part) => part.id === "gear.wheel.nose.left");
    expect(nose?.hinge?.axis).toBe("y");
    expect(nose?.hinge?.sign).toBe(1);
    expect(noseWheel?.hinge?.pivot).toEqual(nose?.hinge?.pivot);
    expect(a900.parts.find((part) => part.id === "gear.main.right")?.hinge?.sign).toBe(-1);
    expect(a900.parts.find((part) => part.id === "gear.main.left")?.hinge?.sign).toBe(1);
    const leg = a900.parts.find((part) => part.id === "gear.main.right");
    const wheel = a900.parts.find((part) => part.id === "gear.wheel.main.right.0.0");
    expect(wheel?.hinge?.pivot).toEqual(leg?.hinge?.pivot);
    if (!leg?.hinge || !wheel) throw new Error("main gear hinge missing");
    const up = hingePlacement(leg.hinge, wheel.assembled.position, flightPose(6, 0));
    expect(up.offset.y).toBeLessThan(wheel.assembled.position.y);
    expect(up.offset.z).toBeGreaterThan(wheel.assembled.position.z);
  });

  it("pushes back, rotates, and climbs instead of staying parked", () => {
    const gate = flightBody(0, 0);
    expect(gate.x).toBe(0);
    expect(gate.z).toBe(0);
    expect(gate.pitch).toBe(0);
    expect(gate.wheel).toBe(0);

    const push = flightBody(1, 0);
    expect(push.x).toBeGreaterThan(8);
    expect(push.z).toBe(0);
    expect(push.pitch).toBe(0);
    expect(push.wheel).toBeGreaterThan(0);

    const lineup = flightBody(3, 0);
    expect(lineup.x).toBeLessThan(-30);
    expect(Math.abs(lineup.y)).toBeLessThan(1);
    expect(lineup.pitch).toBe(0);
    expect(lineup.z).toBe(0);

    const rolling = flightBody(3.3, 0);
    expect(rolling.pitch).toBe(0);
    expect(rolling.x).toBeLessThan(lineup.x);

    const rotate = flightBody(4, 0);
    expect(rotate.pitch).toBeGreaterThan(0.1);
    expect(rotate.z).toBeGreaterThan(0.5);
    expect(rotate.x).toBeLessThan(lineup.x);
    expect(rotate.wheel).toBeLessThan(0);

    const high = flightBody(6, 0);
    expect(high.z).toBeGreaterThan(50);
    expect(high.pitch).toBeLessThan(flightBody(5, 0).pitch);
    expect(high.x).toBeLessThan(rotate.x);

    const parked = flightBody(6, 1);
    expect(parked.x).toBeCloseTo(0);
    expect(parked.z).toBeCloseTo(0);
    expect(parked.pitch).toBeCloseTo(0);
    expect(parked.wheel).toBeCloseTo(0);
  });

  it("adds charcoal flap and slat plates on the skin of both variants", () => {
    for (const assembly of [a900, a1000]) {
      const flaps = assembly.parts.filter((part) => part.id.startsWith("skin.flap."));
      const slats = assembly.parts.filter((part) => part.id.startsWith("skin.slat."));
      expect(flaps).toHaveLength(6);
      expect(slats).toHaveLength(6);
      for (const part of [...flaps, ...slats]) {
        expect(part.layerId).toBe("skin");
        expect(part.diffTag).toBe("common");
        expect(part.hinge?.axis).toBe("y");
        expect(part.hinge?.pivot).toEqual(part.assembled.position);
      }
      expect(flaps[0]?.hinge?.sign).toBe(1);
      expect(slats[0]?.hinge?.sign).toBe(-1);
    }
  });
});

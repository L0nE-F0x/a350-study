import { describe, expect, it } from "vitest";
import * as THREE from "three";
import { fitOrtho, ndcToPanePixel, projectOrtho } from "../shared/frame/index.ts";
import { syncOrthoCamera } from "../scene/camera.ts";
import { clipPlane, clipStation } from "../scene/clip.ts";
import type { OrthoPreset } from "../shared/frame/index.ts";
import type { Vec3 } from "../shared/types/index.ts";

const target: Vec3 = { x: 0, y: 0, z: 0 };
const halfHeight = 10;
const aspect = 1.6;
const point: Vec3 = { x: 5, y: 3, z: 2 };

function absDelta(actual: number, expected: number): number {
  return Math.abs(actual - expected);
}

function screenDot(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const na = Math.hypot(a.x, a.y);
  const nb = Math.hypot(b.x, b.y);
  return Math.abs((a.x * b.x + a.y * b.y) / (na * nb));
}

describe("ndcToPanePixel", () => {
  it("maps NDC onto the pane with Y down", () => {
    expect(ndcToPanePixel(0, 0, 200, 100)).toEqual({ x: 100, y: 50 });
    expect(ndcToPanePixel(0, 1, 200, 100)).toEqual({ x: 100, y: 0 });
    expect(ndcToPanePixel(0, -1, 200, 100)).toEqual({ x: 100, y: 100 });
  });
});

describe("projectOrtho", () => {
  it("matches the side, plan, and front formulas", () => {
    const side = projectOrtho(point, "side", target, halfHeight, aspect);
    expect(absDelta(side.x, (point.x - target.x) / (halfHeight * aspect))).toBeLessThan(1e-12);
    expect(absDelta(side.y, (point.z - target.z) / halfHeight)).toBeLessThan(1e-12);
    const nearer = projectOrtho({ x: -4, y: 0, z: 0 }, "side", target, halfHeight, aspect);
    const farther = projectOrtho({ x: 4, y: 0, z: 0 }, "side", target, halfHeight, aspect);
    expect(nearer.x).toBeLessThan(farther.x);

    const plan = projectOrtho(point, "plan", target, halfHeight, aspect);
    expect(absDelta(plan.x, (point.y - target.y) / (halfHeight * aspect))).toBeLessThan(1e-12);
    expect(absDelta(plan.y, -(point.x - target.x) / halfHeight)).toBeLessThan(1e-12);
    const nose = projectOrtho({ x: -10, y: 0, z: 0 }, "plan", target, halfHeight, aspect);
    expect(nose.y).toBeGreaterThan(0);

    const front = projectOrtho(point, "front", target, halfHeight, aspect);
    expect(absDelta(front.x, -(point.y - target.y) / (halfHeight * aspect))).toBeLessThan(1e-12);
    expect(absDelta(front.y, (point.z - target.z) / halfHeight)).toBeLessThan(1e-12);
  });

  it("keeps the three-quarter axes from lining up", () => {
    const origin = { x: 0, y: 0, z: 0 };
    const x = projectOrtho({ x: 1, y: 0, z: 0 }, "three-quarter", origin, 1, 1);
    const y = projectOrtho({ x: 0, y: 1, z: 0 }, "three-quarter", origin, 1, 1);
    const z = projectOrtho({ x: 0, y: 0, z: 1 }, "three-quarter", origin, 1, 1);
    expect(screenDot(x, y)).toBeLessThan(0.95);
    expect(screenDot(x, z)).toBeLessThan(0.95);
    expect(screenDot(y, z)).toBeLessThan(0.95);
  });
});

describe("fitOrtho", () => {
  it("fits the side view of the -1000 length with the default margin", () => {
    const fit = fitOrtho(
      {
        min: { x: -36.89, y: -32.375, z: -5.03 },
        max: { x: 36.89, y: 32.375, z: 12.05 },
      },
      1.6,
    );
    expect(2 * fit.halfHeight * 1.6).toBeGreaterThanOrEqual(73.78 * 1.15);
  });
});

describe("syncOrthoCamera", () => {
  it("projects the same point as projectOrtho for side, plan, and front", () => {
    const presets = ["side", "plan", "front"] as const satisfies readonly OrthoPreset[];
    for (const preset of presets) {
      const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20000);
      syncOrthoCamera(cam, preset, target, halfHeight, aspect);
      const projected = new THREE.Vector3(point.x, point.y, point.z);
      projected.project(cam);
      const expected = projectOrtho(point, preset, target, halfHeight, aspect);
      expect(absDelta(projected.x, expected.x)).toBeLessThan(1e-4);
      expect(absDelta(projected.y, expected.y)).toBeLessThan(1e-4);
    }
  });
});

describe("clip plane", () => {
  it("puts the greater coordinate on the negative side of the plane", () => {
    const bbox = {
      min: { x: -33.4, y: -32.375, z: -5 },
      max: { x: 33.4, y: 32.375, z: 12.05 },
    };
    const plane = clipPlane(bbox, "x", 0.55);
    const station = clipStation(bbox, "x", 0.55);
    expect(plane.normal.x).toBeLessThan(0);
    expect(plane.distanceToPoint(new THREE.Vector3(station - 1, 0, 0))).toBeGreaterThan(0);
    expect(plane.distanceToPoint(new THREE.Vector3(station + 1, 0, 0))).toBeLessThan(0);
  });
});

import type { Hinge, Vec3 } from "../types/index.ts";

export const PHASE_LABELS = [
  "Gate",
  "Push & start",
  "Taxi",
  "Line-up",
  "Take-off",
  "Climb",
  "10,000 ft",
] as const;

export const PHASE_LAST = PHASE_LABELS.length - 1;

export interface ChannelPose {
  gear: number;
  flap: number;
  slat: number;
  nav: number;
  beacon: number;
  strobe: number;
  land: number;
  cabin: number;
}

const GEAR = [0, 0, 0, 0, 0, 0.65, 1];
const FLAP = [0, 0, 0.25, 1, 1, 0.2, 0];
const SLAT = [0, 0, 0.55, 1, 1, 0.15, 0];
const NAV = [0, 1, 1, 1, 1, 1, 1];
const BEACON = [0, 1, 1, 1, 1, 1, 1];
const STROBE = [0, 0, 0, 1, 1, 1, 1];
const LAND = [0, 0, 0.35, 1, 1, 0, 0];
const CABIN = [1, 1, 1, 1, 1, 1, 1];

function sampleStops(stops: readonly number[], phase: number): number {
  const x = Math.min(PHASE_LAST, Math.max(0, phase));
  const i = Math.min(PHASE_LAST - 1, Math.floor(x));
  const span = x - i;
  const a = stops[i] ?? 0;
  const b = stops[i + 1] ?? a;
  return a + (b - a) * span;
}

/**
 * Main-gear contact used as the rotation pivot. Matches the study gear:
 * main gear x = 2, wheel contact z = -5.
 */
export const FLIGHT_PIVOT = { x: 2, y: 0, z: -5 } as const;

export interface FlightBody {
  /** Study frame. Forward is −X. */
  x: number;
  y: number;
  z: number;
  /** About +Z. Positive swings the nose toward −Y. */
  yaw: number;
  /** Nose-up about +Y, through the main-gear pivot. */
  pitch: number;
  /** Wheel axle angle, radians. Positive is pushback. */
  wheel: number;
}

const TRACK: ReadonlyArray<{ x: number; y: number; yaw: number }> = [
  { x: 0, y: 0, yaw: 0 },
  { x: 22, y: 8, yaw: 0.75 },
  { x: -55, y: 40, yaw: 0.18 },
  { x: -125, y: 0, yaw: 0 },
  { x: -260, y: 0, yaw: 0 },
  { x: -360, y: 0, yaw: 0 },
  { x: -450, y: 0, yaw: 0 },
];

const WHEEL_RADIUS_M = 0.6;

function clamp01(value: number): number {
  return Math.min(1, Math.max(0, value));
}

function smooth(t: number): number {
  const u = clamp01(t);
  return u * u * (3 - 2 * u);
}

function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Take-off accelerates. The climb carries that speed, then eases. */
function trackFade(segment: number, t: number): number {
  if (segment === 3) return t * t;
  if (segment === 4) return 1 - (1 - t) * (1 - t);
  return smooth(t);
}

const TRACK_REST = { x: 0, y: 0, yaw: 0 };

function sampleTrack(phase: number): { x: number; y: number; yaw: number } {
  const x = Math.min(PHASE_LAST, Math.max(0, phase));
  const i = Math.min(TRACK.length - 2, Math.floor(x));
  const t = x - i;
  const a = TRACK[i] ?? TRACK_REST;
  const b = TRACK[i + 1] ?? a;
  const f = trackFade(i, t);
  return { x: lerp(a.x, b.x, f), y: lerp(a.y, b.y, f), yaw: lerp(a.yaw, b.yaw, f) };
}

function climbPose(phase: number): { pitch: number; z: number } {
  if (phase <= 3) return { pitch: 0, z: 0 };
  if (phase < 4) {
    const u = phase - 3;
    // Pitch stays under ~0.13 while the mains are planted. More than that
    // drops the tail cone through the runway before the aircraft unsticks.
    const rotate = smooth(clamp01((u - 0.48) / 0.26));
    const unstick = smooth(clamp01((u - 0.74) / 0.26));
    return { pitch: 0.12 * rotate + 0.1 * unstick, z: 10 * unstick };
  }
  if (phase < 5) {
    const u = smooth(phase - 4);
    return { pitch: lerp(0.22, 0.17, u), z: lerp(10, 42, u) };
  }
  const u = smooth(Math.min(1, phase - 5));
  return { pitch: lerp(0.17, 0.04, u), z: lerp(42, 78, u) };
}

function wheelAngle(phase: number): number {
  const end = Math.min(Math.max(phase, 0), 4);
  const steps = Math.max(1, Math.ceil(end * 16));
  let prev = sampleTrack(0);
  let forward = 0;
  for (let step = 1; step <= steps; step += 1) {
    const cur = sampleTrack((end * step) / steps);
    const dx = cur.x - prev.x;
    const dy = cur.y - prev.y;
    const distance = Math.hypot(dx, dy);
    if (distance > 0) forward += dx <= 0 ? distance : -distance;
    prev = cur;
  }
  if (forward === 0) return 0;
  return -forward / WHEEL_RADIUS_M;
}

/** Pushback, taxi, rotate, and climb. Explode parks the body back on the pad. */
export function flightBody(phase: number, explode: number): FlightBody {
  const track = sampleTrack(phase);
  const climb = climbPose(phase);
  const park = 1 - clamp01(explode);
  return {
    x: track.x * park,
    y: track.y * park,
    z: climb.z * park,
    yaw: track.yaw * park,
    pitch: climb.pitch * park,
    wheel: wheelAngle(phase) * park,
  };
}

/** Gear, flap, and slat return to the built pose as explode rises. Lights do not. */
export function flightPose(phase: number, explode: number): ChannelPose {
  const stowed = 1 - Math.min(1, Math.max(0, explode));
  return {
    gear: sampleStops(GEAR, phase) * stowed,
    flap: sampleStops(FLAP, phase) * stowed,
    slat: sampleStops(SLAT, phase) * stowed,
    nav: sampleStops(NAV, phase),
    beacon: sampleStops(BEACON, phase),
    strobe: sampleStops(STROBE, phase),
    land: sampleStops(LAND, phase),
    cabin: sampleStops(CABIN, phase),
  };
}

/** Right-handed rotation in the study frame. +Y pitches +X toward −Z. +X swings −Z toward +Y. */
export function rotateAbout(axis: "x" | "y", angle: number, point: Vec3): Vec3 {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  if (axis === "y") {
    return { x: point.x * c + point.z * s, y: point.y, z: -point.x * s + point.z * c };
  }
  return { x: point.x, y: point.y * c - point.z * s, z: point.y * s + point.z * c };
}

export function hingePlacement(
  hinge: Hinge,
  sample: Vec3,
  pose: Pick<ChannelPose, Hinge["channel"]>,
): { offset: Vec3; angle: number } {
  const amount = pose[hinge.channel];
  const angle = hinge.sign * hinge.travel * amount;
  if (Math.abs(angle) < 1e-5) return { offset: sample, angle: 0 };
  const rel = rotateAbout(hinge.axis, angle, {
    x: sample.x - hinge.pivot.x,
    y: sample.y - hinge.pivot.y,
    z: sample.z - hinge.pivot.z,
  });
  return {
    angle,
    offset: { x: hinge.pivot.x + rel.x, y: hinge.pivot.y + rel.y, z: hinge.pivot.z + rel.z },
  };
}

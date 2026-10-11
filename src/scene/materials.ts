import * as THREE from "three";
import type { LayerId } from "../shared/types/index.ts";
import type { DrawnSlot } from "./layers.ts";

export const LAYER_COLOR_HEX: Record<LayerId, string> = {
  skin: "#9aa3ad",
  structure: "#d0d8e8",
  composites: "#7dcea0",
  cabin: "#f0d78c",
  cargo: "#c4a574",
  flightControls: "#e07a5f",
  fuel: "#f2c14e",
  hydraulics: "#c77dff",
  electrics: "#ff8c42",
  bleedEcs: "#6ec8c8",
  landingGear: "#8e959c",
  engines: "#9aa3ad",
  dimensions: "#9aa7b4",
  differences: "#e6c27a",
};

export const OVERLAY_EDGE = {
  "a350-900": "#c5ccd4",
  "a350-1000": "#d7b56a",
} as const;

export const SKIN_OPACITY = 1;
export const SKIN_OPACITY_OVERLAY = 0.28;
export const HATCH_HEX = "#d5dbe3";
export const GRID_HEX = "#1c2838";
export const REVEAL_OPACITY = 0.2;

export const LAYER_OPACITY: Record<LayerId, number> = {
  skin: SKIN_OPACITY,
  structure: 1,
  composites: 1,
  cabin: 0.55,
  cargo: 0.5,
  flightControls: 0.9,
  fuel: 0.42,
  hydraulics: 1,
  electrics: 1,
  bleedEcs: 1,
  landingGear: 1,
  engines: 1,
  dimensions: 1,
  differences: 1,
};

export type AircraftFinish = "livery" | "engine" | "metal" | "rubber" | "study";

const PAINT_900 = "#42494f";
const PAINT_1000 = "#504539";

const lightLevels = {
  uNav: { value: 0 },
  uBeacon: { value: 0 },
  uStrobe: { value: 0 },
  uCabin: { value: 1 },
  uLand: { value: 0 },
};

export function setLightLevels(levels: {
  nav: number;
  beacon: number;
  strobe: number;
  cabin: number;
  land: number;
}): void {
  lightLevels.uNav.value = levels.nav;
  lightLevels.uBeacon.value = levels.beacon;
  lightLevels.uStrobe.value = levels.strobe;
  lightLevels.uCabin.value = levels.cabin;
  lightLevels.uLand.value = levels.land;
}

export function finishFor(slot: DrawnSlot): AircraftFinish {
  if (slot === "skinBody" || slot === "skinEmpennage") return "livery";
  if (slot === "engines") return "engine";
  if (slot === "gearBeams") return "metal";
  if (slot === "gearWheels") return "rubber";
  return "study";
}

export function paintHex(variantId: "a350-900" | "a350-1000"): string {
  return variantId === "a350-1000" ? PAINT_1000 : PAINT_900;
}

function bindClip(material: THREE.Material, plane: THREE.Plane | null): void {
  material.clippingPlanes = plane ? [plane] : [];
  material.clipIntersection = false;
}

const LIVERY_COLOR = `
vec3 p = vStudy;
float bloomWeight = 0.0;
vec3 base = diffuseColor.rgb;
float belly = smoothstep(1.05, -0.8, p.z);
base = mix(base, base * vec3(0.66, 0.68, 0.72), belly * 0.8);
float crown = smoothstep(2.4, 4.6, p.z);
base = mix(base, min(base * 1.1, vec3(0.28, 0.3, 0.32)), crown * 0.5);
// The black cockpit mask that wraps the windshield and ends in a swept point aft.
float dn = p.x - uNoseX;
float maskHalf = 0.62 * (1.0 - smoothstep(3.85, 5.15, dn));
float maskMid = 2.95 + 0.12 * (dn - 3.4) + (0.62 - maskHalf) * 0.8;
float cockpit = smoothstep(1.7, 2.05, dn) * step(0.02, maskHalf);
cockpit *= 1.0 - smoothstep(maskHalf - 0.04, maskHalf + 0.04, abs(p.z - maskMid));
cockpit *= step(abs(p.y), 3.2);
float dihedral = abs(p.y) * 0.0945;
if (abs(p.y) > 3.8) {
  float lower = smoothstep(dihedral + 0.08, dihedral - 0.35, p.z);
  base = mix(base, base * 0.58, lower);
}
if (vGlow < 0.5) {
  float body = smoothstep(3.55, 2.7, abs(p.y)) * smoothstep(5.1, 3.4, abs(p.z - 1.6));
  float frameDist = min(fract(p.x / 3.4), 1.0 - fract(p.x / 3.4));
  float frameLine = 1.0 - smoothstep(0.0, 0.028, frameDist);
  float ang = atan(p.z - 1.6, p.y);
  float seamDist = min(fract(ang * 0.95), 1.0 - fract(ang * 0.95));
  float seamLine = 1.0 - smoothstep(0.0, 0.03, seamDist);
  base *= mix(1.0, 0.86, body * max(frameLine, seamLine * 0.7));
  float span = abs(p.y);
  float wing = smoothstep(3.05, 3.9, span) * (1.0 - smoothstep(31.5, 32.45, span));
  wing *= smoothstep(2.6, 1.15, p.z) * smoothstep(-1.35, -0.05, p.z);
  float swept = p.x - span * 0.622;
  float chordDist = min(fract(swept / 1.65), 1.0 - fract(swept / 1.65));
  float chordLine = 1.0 - smoothstep(0.0, 0.055, chordDist);
  float spanDist = min(fract(span / 3.8), 1.0 - fract(span / 3.8));
  float spanLine = 1.0 - smoothstep(0.0, 0.04, spanDist);
  base *= mix(1.0, 0.88, wing * max(chordLine, spanLine));
}
base = mix(base, vec3(0.012, 0.013, 0.015), cockpit);
if (vGlow > 0.75 && vGlow < 1.5) base = mix(vec3(0.55, 0.4, 0.24), vec3(0.02, 0.025, 0.03), step(0.5, cockpit));
else if (vGlow > 1.5 && vGlow < 2.5) base = vec3(0.46, 0.48, 0.51);
else if (vGlow > 6.5 && vGlow < 7.5) base = mix(base * 0.7, vec3(0.94, 0.95, 0.92), uLand);
diffuseColor.rgb = base;
`;

// bloomWeight tags lamp and window pixels. It rides out in alpha, and the bloom pass reads it.
const LIVERY_EMIT = `
if (vGlow > 0.75 && vGlow < 1.5) {
  float lit = uCabin * (1.0 - step(0.5, cockpit));
  totalEmissiveRadiance += vec3(1.9, 1.05, 0.45) * lit;
  bloomWeight = 0.3 * lit;
}
else if (vGlow > 1.5 && vGlow < 2.5) totalEmissiveRadiance += vec3(0.1, 0.11, 0.12);
else if (vGlow > 2.5 && vGlow < 3.5) { totalEmissiveRadiance += vec3(4.2, 0.08, 0.05) * uNav; bloomWeight = uNav; }
else if (vGlow > 3.5 && vGlow < 4.5) { totalEmissiveRadiance += vec3(0.08, 3.6, 0.45) * uNav; bloomWeight = uNav; }
else if (vGlow > 4.5 && vGlow < 5.5) { totalEmissiveRadiance += vec3(4.4, 0.1, 0.06) * uBeacon; bloomWeight = uBeacon; }
else if (vGlow > 5.5 && vGlow < 6.5) {
  float level = max(uNav * 0.35, uStrobe);
  totalEmissiveRadiance += vec3(3.2, 3.05, 2.8) * level;
  bloomWeight = level;
}
else if (vGlow > 6.5 && vGlow < 7.5) { totalEmissiveRadiance += vec3(4.6, 4.3, 3.6) * uLand; bloomWeight = uLand; }
`;

const LIVERY_UNIFORMS = `
uniform float uNav;
uniform float uBeacon;
uniform float uStrobe;
uniform float uCabin;
uniform float uLand;
uniform float uNoseX;
`;

// World offsets match SCHEMATIC.engineXM / engineYM / engineZM. Nacelle mesh is centred on that point.
const ENGINE_COLOR = `
vec3 p = vStudy;
float side = p.y >= 0.0 ? 1.0 : -1.0;
vec3 q = vec3(p.x - 7.0, p.y - side * 12.0, p.z + 1.16);
float radial = length(q.yz);
float along = q.x;
vec3 paint = vec3(0.16, 0.17, 0.18);
float seam = smoothstep(0.012, 0.0, abs(fract(along * 1.15 + 0.5) - 0.5) - 0.485);
if (radial > 1.22 && along > -2.15 && along < 2.15) paint *= mix(1.0, 0.72, seam);
if (along < -2.25 && radial > 1.2 && radial < 1.95) paint = vec3(0.64, 0.66, 0.7);
else if (radial < 0.34 && along < -1.15 && along > -2.2) paint = vec3(0.58, 0.6, 0.63);
else if (along < -1.05 && along > -1.75 && radial < 1.22) paint = vec3(0.09, 0.095, 0.1);
else if (along > 2.15 && radial < 0.55) paint = vec3(0.045, 0.04, 0.038);
else if (along > 2.2 && radial < 1.12) paint = vec3(0.16, 0.15, 0.14);
else if (abs(q.y) < 0.24 && q.z > 1.32 && along > -1.15 && along < 1.75) paint = vec3(0.14, 0.145, 0.15);
diffuseColor.rgb = paint;
`;

const ENGINE_EMIT = `
if (along < -1.05 && along > -1.75 && radial > 0.22 && radial < 1.15) {
  float blade = abs(fract(atan(q.z, q.y) * 2.865) - 0.5);
  totalEmissiveRadiance += vec3(0.05, 0.055, 0.06) * smoothstep(0.16, 0.02, blade);
}
`;

const METAL_COLOR = `
float polish = smoothstep(0.25, 0.85, vGlow);
diffuseColor.rgb = mix(vec3(0.17, 0.18, 0.19), vec3(0.78, 0.8, 0.83), polish);
`;

const RUBBER_COLOR = `
float hub = length(vec2(vStudy.x, vStudy.z));
float metal = smoothstep(0.48, 0.32, hub);
diffuseColor.rgb = mix(vec3(0.015, 0.015, 0.016), vec3(0.55, 0.57, 0.6), metal);
if (metal < 0.2 && abs(vStudy.y) > 0.1) {
  float groove = abs(fract(vStudy.y * 22.0) - 0.5);
  diffuseColor.rgb *= mix(1.0, 0.55, smoothstep(0.22, 0.05, groove));
}
`;

function varyBlock(finish: AircraftFinish): string {
  if (finish === "livery" || finish === "metal") return "attribute float aGlow;\nvarying float vGlow;\nvarying vec3 vStudy;";
  if (finish === "engine" || finish === "rubber") return "varying vec3 vStudy;";
  return "";
}

function assignBlock(finish: AircraftFinish): string {
  if (finish === "livery" || finish === "metal") return "vGlow = aGlow;\nvStudy = position;";
  if (finish === "engine" || finish === "rubber") return "vStudy = position;";
  return "";
}

function fragVary(finish: AircraftFinish): string {
  if (finish === "livery" || finish === "metal") return "varying float vGlow;\nvarying vec3 vStudy;";
  if (finish === "engine" || finish === "rubber") return "varying vec3 vStudy;";
  return "";
}

function colorBlock(finish: AircraftFinish): string {
  if (finish === "livery") return LIVERY_COLOR;
  if (finish === "engine") return ENGINE_COLOR;
  if (finish === "metal") return METAL_COLOR;
  if (finish === "rubber") return RUBBER_COLOR;
  return "";
}

function emitBlock(finish: AircraftFinish): string {
  if (finish === "livery") return LIVERY_EMIT;
  if (finish === "engine") return ENGINE_EMIT;
  return "";
}

function bindAircraftShader(material: THREE.Material, finish: AircraftFinish, noseX: number): void {
  material.customProgramCacheKey = () => `aircraft-${finish}-v6`;
  material.onBeforeCompile = (shader) => {
    const extra = varyBlock(finish);
    const assign = assignBlock(finish);
    if (finish === "livery") {
      shader.uniforms.uNav = lightLevels.uNav;
      shader.uniforms.uBeacon = lightLevels.uBeacon;
      shader.uniforms.uStrobe = lightLevels.uStrobe;
      shader.uniforms.uCabin = lightLevels.uCabin;
      shader.uniforms.uLand = lightLevels.uLand;
      shader.uniforms.uNoseX = { value: noseX };
    }
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>\nattribute float partOpacity;\nvarying float vPartOpacity;\n${extra}`,
      )
      .replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>\nvPartOpacity = partOpacity;\n${assign}`,
      );
    const lightHeader = finish === "livery" ? LIVERY_UNIFORMS : "";
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>\nvarying float vPartOpacity;\n${fragVary(finish)}\n${lightHeader}`,
      )
      .replace("#include <color_fragment>", `#include <color_fragment>\n${colorBlock(finish)}`)
      .replace("#include <emissivemap_fragment>", `#include <emissivemap_fragment>\n${emitBlock(finish)}`)
      .replace(
        "#include <roughnessmap_fragment>",
        finish === "metal"
          ? "#include <roughnessmap_fragment>\nroughnessFactor = mix(0.5, 0.16, smoothstep(0.25, 0.85, vGlow));"
          : "#include <roughnessmap_fragment>",
      )
      .replace(
        "#include <opaque_fragment>",
        finish === "livery"
          ? "#include <opaque_fragment>\ngl_FragColor.a *= vPartOpacity;\nif (gl_FragColor.a > 0.99) gl_FragColor.a = 1.0 + bloomWeight;"
          : "#include <opaque_fragment>\ngl_FragColor.a *= vPartOpacity;",
      );
  };
}

function physicalBase(color: string, opacity: number): THREE.MeshPhysicalMaterial {
  const material = new THREE.MeshPhysicalMaterial({
    color,
    metalness: 0.18,
    roughness: 0.42,
    clearcoat: 0.34,
    clearcoatRoughness: 0.4,
    envMapIntensity: 0.7,
    side: THREE.DoubleSide,
    transparent: opacity < 1,
    opacity,
    depthWrite: opacity >= 0.9,
  });
  return material;
}

export function aircraftMaterial(
  finish: AircraftFinish,
  hex: string,
  opacity: number,
  plane: THREE.Plane | null,
  opts?: { polygonOffset?: boolean; noseX?: number },
): THREE.Material {
  let material: THREE.Material;
  if (finish === "livery") {
    // Charcoal metallic under a clear coat, so the hangar strips run down the crown.
    const paint = physicalBase(hex, opacity);
    paint.metalness = 0.24;
    paint.roughness = 0.42;
    paint.clearcoat = 0.85;
    paint.clearcoatRoughness = 0.1;
    paint.envMapIntensity = 1;
    material = paint;
  } else if (finish === "engine") {
    const paint = physicalBase("#4a5158", opacity);
    paint.metalness = 0.4;
    paint.roughness = 0.36;
    paint.clearcoat = 0.6;
    paint.clearcoatRoughness = 0.14;
    paint.envMapIntensity = 0.95;
    material = paint;
  } else if (finish === "metal") {
    const paint = physicalBase("#8b939b", opacity);
    paint.metalness = 0.64;
    paint.roughness = 0.42;
    paint.clearcoat = 0.12;
    material = paint;
  } else if (finish === "rubber") {
    const paint = physicalBase("#141516", opacity);
    paint.metalness = 0.04;
    paint.roughness = 0.86;
    paint.clearcoat = 0.04;
    material = paint;
  } else {
    const study = new THREE.MeshStandardMaterial({
      color: hex,
      roughness: 0.48,
      metalness: 0.06,
      emissive: hex,
      emissiveIntensity: 0.16,
      side: THREE.DoubleSide,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 0.9,
    });
    material = study;
  }
  if (opts?.polygonOffset) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
  }
  bindClip(material, plane);
  bindAircraftShader(material, finish, opts?.noseX ?? -33.4);
  return material;
}

export function surfaceMaterial(
  hex: string,
  opacity: number,
  plane: THREE.Plane | null,
  opts?: { polygonOffset?: boolean },
): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({
    color: hex,
    transparent: opacity < 1,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: opacity >= 1,
    toneMapped: false,
  });
  if (opts?.polygonOffset) {
    material.polygonOffset = true;
    material.polygonOffsetFactor = -1;
    material.polygonOffsetUnits = -1;
  }
  bindClip(material, plane);
  material.customProgramCacheKey = () => "partOpacity-v1";
  material.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        "#include <common>\nattribute float partOpacity;\nvarying float vPartOpacity;",
      )
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvPartOpacity = partOpacity;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nvarying float vPartOpacity;")
      .replace(
        "#include <opaque_fragment>",
        "#include <opaque_fragment>\ngl_FragColor.a *= vPartOpacity;",
      );
  };
  return material;
}

export function lineMaterial(
  hex: string,
  opacity: number,
  plane: THREE.Plane | null,
): THREE.LineBasicMaterial {
  const material = new THREE.LineBasicMaterial({
    color: hex,
    transparent: opacity < 1,
    opacity,
    toneMapped: false,
  });
  bindClip(material, plane);
  return material;
}

export function dashedLineMaterial(
  hex: string,
  opacity: number,
  plane: THREE.Plane | null,
): THREE.LineDashedMaterial {
  const material = new THREE.LineDashedMaterial({
    color: hex,
    transparent: true,
    opacity,
    dashSize: 0.15,
    gapSize: 0.1,
    toneMapped: false,
  });
  bindClip(material, plane);
  return material;
}

export function vertexOpacityAttribute(count: number, value: number): THREE.BufferAttribute {
  const data = new Float32Array(count);
  data.fill(value);
  return new THREE.BufferAttribute(data, 1);
}

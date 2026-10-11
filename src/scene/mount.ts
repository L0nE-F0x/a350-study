import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { FLIGHT_PIVOT, flightBody, flightPose, hingePlacement } from "../shared/phase/index.ts";
import { LAYER_IDS, type Assembly, type BBox, type MeshData, type PaneState, type Part, type Vec3 } from "../shared/types/index.ts";
import { syncInspectCamera, syncOrthoCamera } from "./camera.ts";
import { hatchCorners, unionBBox, writeClipPlane } from "./clip.ts";
import {
  DRAW_SLOTS,
  diffEdgeOpacity,
  diffPartOpacity,
  slotDrawsEdges,
  slotFor,
  slotKind,
  slotLayer,
  type DrawnSlot,
} from "./layers.ts";
import {
  HATCH_HEX,
  LAYER_COLOR_HEX,
  LAYER_OPACITY,
  OVERLAY_EDGE,
  REVEAL_OPACITY,
  SKIN_OPACITY_OVERLAY,
  aircraftMaterial,
  dashedLineMaterial,
  finishFor,
  lineMaterial,
  paintHex,
  setLightLevels,
  surfaceMaterial,
  vertexOpacityAttribute,
} from "./materials.ts";
import { UNKNOWN_PART, applyPartRaycast, type PartIntersection } from "./pick.ts";

export interface SceneHandle {
  dispose: () => void;
  getHud: () => { triangles: number; calls: number; fps: number; slow: boolean };
}

export interface SceneBindings {
  getPane: () => PaneState;
  getAssembly: () => Assembly;
  getPeer: () => { assembly: Assembly; pane: PaneState } | null;
  getVisibility: (assembly: Assembly, pane: PaneState) => { solid: string[]; ghost: string[] };
  samplePart: (part: Part, u: number) => Vec3;
  subscribe: (listener: () => void) => () => void;
  onPick: (partId: string | null) => void;
  onHover: (partId: string | null) => void;
  onOrbit: (next: {
    preset: "orbit";
    azimuthRad: number;
    elevationRad: number;
    target: Vec3;
    orthoHalfHeight: number;
    mode: "ortho" | "inspect";
  }) => void;
}

const EDGE_THRESHOLD_DEG = 20;
const HATCH_ID = "schematic-section-hatch";
const ORBIT_SPEED = 0.005;
const FRAME_RING = 120;

interface OrbitDraft {
  azimuth: number;
  elevation: number;
  target: Vec3;
  halfHeight: number;
  mode: "ortho" | "inspect";
}

interface SurfaceAcc {
  positions: number[];
  indices: number[];
  opacity: number[];
  glow: number[];
  partIds: string[];
  pickable: number[];
  triParts: number[];
  posPart: Map<string, number>;
}

interface OpacityShader {
  vertexShader: string;
  fragmentShader: string;
}

function posKey(x: number, y: number, z: number): string {
  return `${Math.round(x * 1e4)},${Math.round(y * 1e4)},${Math.round(z * 1e4)}`;
}

function clampHalf(value: number): number {
  if (value < 0.5) return 0.5;
  if (value > 500) return 500;
  return value;
}

function clampElevation(value: number): number {
  const limit = Math.PI / 2 - 0.02;
  if (value < -limit) return -limit;
  if (value > limit) return limit;
  return value;
}

function authoredOpacity(slot: DrawnSlot, overlay: boolean): number {
  if (overlay && (slot === "skinBody" || slot === "skinEmpennage")) return SKIN_OPACITY_OVERLAY;
  return LAYER_OPACITY[slotLayer(slot)];
}

function overlayKey(pane: PaneState): string {
  let bits = "";
  for (const id of LAYER_IDS) bits += pane.overlays[id] ? "1" : "0";
  return bits;
}

function stamp(assembly: Assembly): string {
  let hash = 2166136261;
  for (const part of assembly.parts) {
    hash ^= part.id.length + (part.mesh?.positions.length ?? 0) + (part.lines?.positions.length ?? 0);
    hash = Math.imul(hash, 16777619);
    for (let i = 0; i < part.id.length; i += 1) {
      hash ^= part.id.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
  }
  return `${assembly.variantId}:${assembly.parts.length}:${hash >>> 0}`;
}

function blockPick(object: THREE.Object3D): void {
  object.raycast = () => undefined;
}

function disposeTree(root: THREE.Object3D): void {
  const geos = new Set<THREE.BufferGeometry>();
  const mats = new Set<THREE.Material>();
  root.traverse((obj: THREE.Object3D) => {
    const mesh = obj as THREE.Mesh;
    if (mesh.geometry) geos.add(mesh.geometry);
    const material = mesh.material;
    if (Array.isArray(material)) {
      for (const item of material) mats.add(item);
    } else if (material) mats.add(material);
  });
  for (const geo of geos) geo.dispose();
  for (const mat of mats) mat.dispose();
}

function clearGroup(group: THREE.Group): void {
  disposeTree(group);
  group.clear();
}

function injectLineOpacity(material: THREE.Material): void {
  material.customProgramCacheKey = () => "linePartOpacity-v1";
  material.onBeforeCompile = (shader: OpacityShader) => {
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
}

function copyEdgePositions(geometry: THREE.BufferGeometry): Float32Array | null {
  const edges = new THREE.EdgesGeometry(geometry, EDGE_THRESHOLD_DEG);
  const attr = edges.getAttribute("position");
  let copy: Float32Array | null = null;
  if (attr && attr.count >= 2) {
    copy = new Float32Array(attr.count * 3);
    for (let i = 0; i < attr.count; i += 1) {
      copy[i * 3] = attr.getX(i);
      copy[i * 3 + 1] = attr.getY(i);
      copy[i * 3 + 2] = attr.getZ(i);
    }
  }
  edges.dispose();
  return copy;
}

function edgesFromMesh(mesh: MeshData, offset: Vec3, matrix: THREE.Matrix4 | null): Float32Array | null {
  if (mesh.positions.length < 9 || mesh.indices.length < 3) return null;
  const geom = new THREE.BufferGeometry();
  const positions = new Float32Array(mesh.positions.length);
  const point = new THREE.Vector3();
  for (let i = 0; i < mesh.positions.length; i += 3) {
    point.set(mesh.positions[i] ?? 0, mesh.positions[i + 1] ?? 0, mesh.positions[i + 2] ?? 0);
    if (matrix) point.applyMatrix4(matrix);
    positions[i] = point.x + offset.x;
    positions[i + 1] = point.y + offset.y;
    positions[i + 2] = point.z + offset.z;
  }
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.setIndex(new THREE.BufferAttribute(new Uint32Array(mesh.indices), 1));
  const edges = copyEdgePositions(geom);
  geom.dispose();
  return edges;
}

function appendMesh(
  acc: SurfaceAcc,
  mesh: MeshData,
  offset: Vec3,
  matrix: THREE.Matrix4 | null,
  partIndex: number,
  opacity: number,
): void {
  if (mesh.positions.length < 9 || mesh.indices.length < 3) return;
  const base = acc.positions.length / 3;
  const point = new THREE.Vector3();
  const glowSrc = mesh.glow;
  for (let i = 0; i < mesh.positions.length; i += 3) {
    point.set(mesh.positions[i] ?? 0, mesh.positions[i + 1] ?? 0, mesh.positions[i + 2] ?? 0);
    if (matrix) point.applyMatrix4(matrix);
    const x = point.x + offset.x;
    const y = point.y + offset.y;
    const z = point.z + offset.z;
    acc.positions.push(x, y, z);
    acc.opacity.push(opacity);
    acc.glow.push(glowSrc ? (glowSrc[i / 3] ?? 0) : 0);
    acc.posPart.set(posKey(x, y, z), partIndex);
  }
  for (let i = 0; i < mesh.indices.length; i += 3) {
    const a = mesh.indices[i];
    const b = mesh.indices[i + 1];
    const c = mesh.indices[i + 2];
    if (a === undefined || b === undefined || c === undefined) continue;
    acc.indices.push(base + a, base + b, base + c);
    acc.triParts.push(partIndex);
  }
}

function surfaceGeometry(acc: SurfaceAcc): THREE.BufferGeometry | null {
  if (acc.indices.length < 3 || acc.positions.length < 9) return null;
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.Float32BufferAttribute(acc.positions, 3));
  geom.setAttribute("partOpacity", new THREE.Float32BufferAttribute(acc.opacity, 1));
  geom.setAttribute("aGlow", new THREE.Float32BufferAttribute(acc.glow, 1));
  geom.setIndex(acc.indices);
  geom.computeVertexNormals();
  geom.userData = {
    partIds: acc.partIds,
    partIdByTriangle: Uint16Array.from(acc.triParts),
    partPickable: Uint8Array.from(acc.pickable),
  };
  return geom;
}

function makeLine(
  positions: Float32Array,
  partIds: string[],
  vertParts: Uint16Array,
  pickable: Uint8Array,
  material: THREE.LineBasicMaterial,
  dashed: boolean,
): THREE.LineSegments {
  const geom = new THREE.BufferGeometry();
  geom.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geom.userData = {
    partIds,
    partIdByStartVertex: vertParts,
    partPickable: pickable,
  };
  const line = new THREE.LineSegments(geom, material);
  if (dashed) line.computeLineDistances();
  applyPartRaycast(line);
  return line;
}

function partsForEdges(positions: Float32Array, lookup: Map<string, number>): Uint16Array {
  const count = positions.length / 3;
  const parts = new Uint16Array(count);
  parts.fill(UNKNOWN_PART);
  for (let i = 0; i < count; i += 1) {
    const found = lookup.get(posKey(positions[i * 3] ?? 0, positions[i * 3 + 1] ?? 0, positions[i * 3 + 2] ?? 0));
    if (found !== undefined && found < UNKNOWN_PART) parts[i] = found;
  }
  return parts;
}

function turntableTexture(): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#1a1f26";
    ctx.fillRect(0, 0, size, size);
    const c = size / 2;
    ctx.translate(c, c);
    ctx.strokeStyle = "#5d6874";
    ctx.lineWidth = 2;
    for (const radius of [150, 280, 400, 490]) {
      ctx.beginPath();
      ctx.arc(0, 0, radius, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.strokeStyle = "#6a6248";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(-460, 0);
    ctx.lineTo(460, 0);
    ctx.moveTo(0, -400);
    ctx.lineTo(0, 400);
    ctx.stroke();
    ctx.strokeStyle = "#46515c";
    ctx.lineWidth = 2;
    for (let i = 0; i < 72; i += 1) {
      const angle = (i / 72) * Math.PI * 2;
      const inner = i % 6 === 0 ? 430 : 468;
      ctx.beginPath();
      ctx.moveTo(Math.cos(angle) * inner, Math.sin(angle) * inner);
      ctx.lineTo(Math.cos(angle) * 504, Math.sin(angle) * 504);
      ctx.stroke();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

function runwayTexture(): THREE.CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 1024;
  canvas.height = 128;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.fillStyle = "#14181e";
    ctx.fillRect(0, 0, 1024, 128);
    ctx.strokeStyle = "#8b939c";
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 10);
    ctx.lineTo(1024, 10);
    ctx.moveTo(0, 118);
    ctx.lineTo(1024, 118);
    ctx.stroke();
    ctx.strokeStyle = "#d5dbe2";
    ctx.lineWidth = 3;
    ctx.setLineDash([16, 18]);
    ctx.beginPath();
    ctx.moveTo(0, 64);
    ctx.lineTo(1024, 64);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.lineWidth = 2;
    for (let i = 0; i < 8; i += 1) {
      const x = 600 + i * 7;
      ctx.beginPath();
      ctx.moveTo(x, 28);
      ctx.lineTo(x, 100);
      ctx.stroke();
    }
    ctx.lineWidth = 2;
    for (let block = 0; block < 2; block += 1) {
      const x = 420 - block * 28;
      ctx.strokeRect(x, 40, 8, 16);
      ctx.strokeRect(x, 72, 8, 16);
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

export function mountScene(canvas: HTMLCanvasElement, bindings: SceneBindings): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.localClippingEnabled = true;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.setClearColor(0x06080b, 1);
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x06080b);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const envMap = pmrem.fromScene(room, 0.04).texture;
  scene.environment = envMap;
  scene.environmentIntensity = 0.18;
  scene.environmentRotation.set(Math.PI / 2, 0, 0);
  pmrem.dispose();

  const hemi = new THREE.HemisphereLight(0xb7c3d1, 0x14161a, 0.52);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff3e6, 2.2);
  key.position.set(-24, 18, 30);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 2;
  key.shadow.camera.far = 160;
  key.shadow.camera.left = -52;
  key.shadow.camera.right = 52;
  key.shadow.camera.top = 52;
  key.shadow.camera.bottom = -52;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.045;
  scene.add(key);
  scene.add(key.target);
  const fill = new THREE.DirectionalLight(0xc5d0dc, 1.05);
  fill.position.set(16, -28, 12);
  scene.add(fill);
  const rim = new THREE.DirectionalLight(0xe4ebf4, 1.45);
  rim.position.set(36, -4, 20);
  scene.add(rim);
  const rake = new THREE.DirectionalLight(0xf7f1e8, 0.7);
  rake.position.set(6, 42, 8);
  scene.add(rake);

  const padMap = turntableTexture();
  const pad = new THREE.Mesh(
    new THREE.CircleGeometry(46, 96),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: padMap,
      roughness: 0.9,
      metalness: 0.12,
    }),
  );
  pad.position.z = -5.08;
  pad.receiveShadow = true;
  blockPick(pad);
  scene.add(pad);
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(1400, 1400),
    new THREE.MeshStandardMaterial({ color: 0x0b0d10, roughness: 1, metalness: 0 }),
  );
  ground.position.z = -5.22;
  ground.receiveShadow = true;
  blockPick(ground);
  scene.add(ground);
  const apron = new THREE.MeshStandardMaterial({ color: 0x14181e, roughness: 0.96, metalness: 0.02 });
  const taxiway = new THREE.Mesh(new THREE.PlaneGeometry(210, 16), apron);
  taxiway.position.set(-30, 40, -5.18);
  taxiway.receiveShadow = true;
  blockPick(taxiway);
  scene.add(taxiway);
  const connector = new THREE.Mesh(new THREE.PlaneGeometry(130, 58), apron);
  connector.position.set(-95, 20, -5.17);
  connector.receiveShadow = true;
  blockPick(connector);
  scene.add(connector);
  const runwayMap = runwayTexture();
  const runway = new THREE.Mesh(
    new THREE.PlaneGeometry(620, 48),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: runwayMap,
      roughness: 0.94,
      metalness: 0.04,
    }),
  );
  runway.position.set(-200, 0, -5.14);
  runway.receiveShadow = true;
  blockPick(runway);
  scene.add(runway);
  const pickRoot = new THREE.Group();
  const content = new THREE.Group();
  const hatchGroup = new THREE.Group();
  pickRoot.add(content);
  pickRoot.add(hatchGroup);
  scene.add(pickRoot);

  const ortho = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.01, 20000);
  const persp = new THREE.PerspectiveCamera(35, 1, 0.01, 20000);
  const sharedPlane = new THREE.Plane();
  const clipPlanes: THREE.Plane[] = [sharedPlane];
  const raycaster = new THREE.Raycaster();
  const pointerNdc = new THREE.Vector2();
  const panRight = new THREE.Vector3();
  const panUp = new THREE.Vector3();

  pickRoot.name = "aircraft";

  canvas.style.touchAction = "none";

  let disposed = false;
  let motion = flightPose(0, 0);
  const flightShift = new THREE.Vector3();
  const flightMatrix = new THREE.Matrix4();
  const flightPivot = new THREE.Matrix4().makeTranslation(FLIGHT_PIVOT.x, FLIGHT_PIVOT.y, FLIGHT_PIVOT.z);
  const flightUnpivot = new THREE.Matrix4().makeTranslation(-FLIGHT_PIVOT.x, -FLIGHT_PIVOT.y, -FLIGHT_PIVOT.z);
  const flightYaw = new THREE.Matrix4();
  const flightPitch = new THREE.Matrix4();
  const flightMove = new THREE.Matrix4();
  const wheelRoll = new THREE.Matrix4();
  const wheelOut = new THREE.Matrix4();
  const keyHome = key.position.clone();
  const fillHome = fill.position.clone();
  const rimHome = rim.position.clone();
  const rakeHome = rake.position.clone();
  const wheelSets: { mesh: THREE.InstancedMesh; base: THREE.Matrix4[] }[] = [];
  let geomKey = "";
  let hatchKey = "";
  let hatchTexture: THREE.CanvasTexture | null = null;
  let hoverId: string | null = null;
  let downX = 0;
  let downY = 0;
  let downArmed = false;
  let suppressClick = false;
  let raf = 0;

  const hud = { triangles: 0, calls: 0, fps: 0, slow: false };
  const frameTimes = new Float64Array(FRAME_RING);
  let frameCount = 0;
  let frameWrite = 0;
  let lastNow = performance.now();
  let slowStreak = 0;

  interface PointerGesture {
    pointerId: number;
    lastX: number;
    lastY: number;
    draft: OrbitDraft;
  }
  let pointerGesture: PointerGesture | null = null;

  interface TouchGesture extends OrbitDraft {
    fingers: "one" | "two";
    lastX: number;
    lastY: number;
    lastDist: number;
    downX: number;
    downY: number;
    moved: boolean;
  }
  let touchGesture: TouchGesture | null = null;

  function viewAspect(): number {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return 1;
    return w / h;
  }

  function referenceBBox(): BBox {
    const assembly = bindings.getAssembly();
    const peer = bindings.getPeer();
    if (!peer) return assembly.bbox;
    return unionBBox(assembly.bbox, peer.assembly.bbox);
  }

  function readDraft(): OrbitDraft {
    const camera = bindings.getPane().camera;
    return {
      azimuth: camera.orbit.azimuthRad,
      elevation: camera.orbit.elevationRad,
      target: { x: camera.orbit.target.x, y: camera.orbit.target.y, z: camera.orbit.target.z },
      halfHeight: camera.orbit.orthoHalfHeight,
      mode: camera.mode,
    };
  }

  function publish(draft: OrbitDraft): void {
    bindings.onOrbit({
      preset: "orbit",
      azimuthRad: draft.azimuth,
      elevationRad: draft.elevation,
      target: { x: draft.target.x, y: draft.target.y, z: draft.target.z },
      orthoHalfHeight: draft.halfHeight,
      mode: draft.mode,
    });
  }

  function syncCamera(): THREE.Camera {
    const camera = bindings.getPane().camera;
    const aspect = viewAspect();
    const target = {
      x: camera.orbit.target.x + flightShift.x,
      y: camera.orbit.target.y + flightShift.y,
      z: camera.orbit.target.z + flightShift.z,
    };
    if (camera.mode === "inspect") {
      syncInspectCamera(persp, { ...camera, orbit: { ...camera.orbit, target } }, aspect);
      return persp;
    }
    syncOrthoCamera(
      ortho,
      camera.preset,
      target,
      camera.orbit.orthoHalfHeight,
      aspect,
      camera.orbit.azimuthRad,
      camera.orbit.elevationRad,
    );
    return ortho;
  }

  function panBasis(draft: OrbitDraft): void {
    const aspect = viewAspect();
    const orbit = {
      azimuthRad: draft.azimuth,
      elevationRad: draft.elevation,
      target: draft.target,
      orthoHalfHeight: draft.halfHeight,
    };
    if (draft.mode === "inspect") {
      syncInspectCamera(persp, { mode: "inspect", preset: "orbit", orbit }, aspect);
      panRight.setFromMatrixColumn(persp.matrixWorld, 0);
      panUp.setFromMatrixColumn(persp.matrixWorld, 1);
      return;
    }
    syncOrthoCamera(ortho, "orbit", draft.target, draft.halfHeight, aspect, draft.azimuth, draft.elevation);
    panRight.setFromMatrixColumn(ortho.matrixWorld, 0);
    panUp.setFromMatrixColumn(ortho.matrixWorld, 1);
  }

  function panBy(draft: OrbitDraft, dx: number, dy: number): void {
    panBasis(draft);
    const scale = draft.halfHeight / Math.max(canvas.clientHeight, 1);
    draft.target.x -= (panRight.x * dx + panUp.x * dy) * scale;
    draft.target.y -= (panRight.y * dx + panUp.y * dy) * scale;
    draft.target.z -= (panRight.z * dx + panUp.z * dy) * scale;
  }

  function activePlane(): THREE.Plane | null {
    return bindings.getPane().clip.axis === "none" ? null : sharedPlane;
  }

  function surfaceMaterialFor(
    slot: DrawnSlot,
    variantId: Part["variantId"],
    overlay: boolean,
    ghost: boolean,
    differences: boolean,
    reveal: boolean,
  ): THREE.Material {
    const finish = finishFor(slot);
    const authored = authoredOpacity(slot, overlay);
    const skinSlot = slot === "skinBody" || slot === "skinEmpennage";
    let opacity = ghost ? 0.12 : authored;
    if (!ghost && reveal && skinSlot) opacity = Math.min(opacity, REVEAL_OPACITY);
    const hex = finish === "livery" ? paintHex(variantId) : LAYER_COLOR_HEX[slotLayer(slot)];
    const offsetSkin = variantId === "a350-1000" && skinSlot;
    const material = aircraftMaterial(
      finish,
      hex,
      opacity,
      activePlane(),
      offsetSkin ? { polygonOffset: true } : undefined,
    );
    material.depthWrite = !ghost && opacity >= 0.9 && !differences;
    if (differences || opacity < 1) material.transparent = true;
    return material;
  }

  function edgeMaterialFor(
    slot: DrawnSlot,
    variantId: Part["variantId"],
    ghost: boolean,
    dashed: boolean,
  ): THREE.LineBasicMaterial {
    const layer = slotLayer(slot);
    const hex = layer === "skin" ? OVERLAY_EDGE[variantId] : LAYER_COLOR_HEX[layer];
    if (dashed) {
      const material = dashedLineMaterial(hex, 0.35, activePlane());
      material.depthWrite = !ghost;
      return material;
    }
    const material = lineMaterial(hex, ghost ? 0.12 : 1, activePlane());
    material.depthWrite = !ghost;
    return material;
  }

  function wireMaterialFor(slot: DrawnSlot, ghost: boolean, dashed: boolean): THREE.LineBasicMaterial {
    const hex = LAYER_COLOR_HEX[slotLayer(slot)];
    if (dashed) {
      const material = dashedLineMaterial(hex, 0.35, activePlane());
      material.depthWrite = !ghost;
      return material;
    }
    const material = lineMaterial(hex, ghost ? 0.12 : 1, activePlane());
    material.depthWrite = !ghost;
    return material;
  }

  function addEdges(
    parent: THREE.Object3D,
    positions: Float32Array,
    partIds: string[],
    vertParts: Uint16Array,
    pickable: Uint8Array,
    material: THREE.LineBasicMaterial,
    dashed: boolean,
    ghost: boolean,
  ): void {
    if (positions.length < 6) return;
    const line = makeLine(positions, partIds, vertParts, pickable, material, dashed);
    if (ghost) blockPick(line);
    parent.add(line);
  }

  function partSpin(part: Part, u: number, target: THREE.Matrix4): { offset: Vec3; spin: THREE.Matrix4 | null } {
    const sample = bindings.samplePart(part, u);
    if (!part.hinge) return { offset: sample, spin: null };
    const placed = hingePlacement(part.hinge, sample, motion);
    if (Math.abs(placed.angle) < 1e-5) return { offset: placed.offset, spin: null };
    if (part.hinge.axis === "x") target.makeRotationX(placed.angle);
    else target.makeRotationY(placed.angle);
    return { offset: placed.offset, spin: target };
  }

  function buildSurface(
    parent: THREE.Object3D,
    slot: DrawnSlot,
    parts: Part[],
    ghost: boolean,
    overlay: boolean,
    differences: boolean,
    dashed: boolean,
    u: number,
    reveal: boolean,
  ): void {
    const variantId = parts[0]?.variantId ?? "a350-900";
    const acc: SurfaceAcc = {
      positions: [],
      indices: [],
      opacity: [],
      glow: [],
      partIds: [],
      pickable: [],
      triParts: [],
      posPart: new Map(),
    };
    const layerOpacity = authoredOpacity(slot, overlay);
    const matrix = new THREE.Matrix4();
    const spin = new THREE.Matrix4();
    const composed = new THREE.Matrix4();
    for (const part of parts) {
      const partIndex = acc.partIds.length;
      acc.partIds.push(part.id);
      acc.pickable.push(part.pickable ? 1 : 0);
      const placed = partSpin(part, u, spin);
      const opacity = diffPartOpacity(part.diffTag, differences && !ghost, layerOpacity);
      if (part.mesh) appendMesh(acc, part.mesh, placed.offset, placed.spin, partIndex, opacity);
      const inst = part.instances;
      if (!inst || inst.count <= 0) continue;
      for (let i = 0; i < inst.count; i += 1) {
        if ((i + 1) * 16 > inst.matrices.length) break;
        matrix.fromArray(inst.matrices, i * 16);
        const local = placed.spin ? composed.copy(placed.spin).multiply(matrix) : matrix;
        appendMesh(acc, inst.mesh, placed.offset, local, partIndex, opacity);
      }
    }
    const geom = surfaceGeometry(acc);
    if (!geom) return;
    const mesh = new THREE.Mesh(geom, surfaceMaterialFor(slot, variantId, overlay, ghost, differences, reveal));
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    if (ghost) blockPick(mesh);
    else applyPartRaycast(mesh);
    parent.add(mesh);
    if (!slotDrawsEdges(slot)) return;
    if (finishFor(slot) !== "study" && !dashed) return;
    const edgePos = copyEdgePositions(geom);
    if (!edgePos) return;
    addEdges(
      parent,
      edgePos,
      acc.partIds,
      partsForEdges(edgePos, acc.posPart),
      Uint8Array.from(acc.pickable),
      edgeMaterialFor(slot, variantId, ghost, dashed),
      dashed,
      ghost,
    );
  }

  function buildWheels(
    parent: THREE.Object3D,
    parts: Part[],
    ghost: boolean,
    overlay: boolean,
    differences: boolean,
    u: number,
    reveal: boolean,
  ): void {
    const unitPart = parts.find((part) => part.mesh && part.mesh.positions.length >= 9);
    const unit = unitPart?.mesh;
    if (!unit) return;
    const variantId = parts[0]?.variantId ?? "a350-900";
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(new Float32Array(unit.positions), 3));
    if (unit.normals.length === unit.positions.length) {
      geom.setAttribute("normal", new THREE.Float32BufferAttribute(new Float32Array(unit.normals), 3));
    }
    geom.setIndex(new THREE.BufferAttribute(new Uint32Array(unit.indices), 1));
    const authored = authoredOpacity("gearWheels", overlay);
    const opacities = new Float32Array(parts.length);
    const partIds: string[] = [];
    const pickable = new Uint8Array(parts.length);
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!part) continue;
      partIds.push(part.id);
      pickable[i] = part.pickable ? 1 : 0;
      opacities[i] = diffPartOpacity(part.diffTag, differences && !ghost, authored);
    }
    geom.setAttribute("partOpacity", new THREE.InstancedBufferAttribute(opacities, 1));
    geom.userData = {
      partIds,
      partIdByTriangle: new Uint16Array(Math.floor(unit.indices.length / 3)),
      partPickable: pickable,
    };
    const mesh = new THREE.InstancedMesh(
      geom,
      surfaceMaterialFor("gearWheels", variantId, overlay, ghost, differences, reveal),
      parts.length,
    );
    mesh.castShadow = !ghost;
    mesh.receiveShadow = !ghost;
    const matrix = new THREE.Matrix4();
    const spin = new THREE.Matrix4();
    const shift = new THREE.Matrix4();
    const bases: THREE.Matrix4[] = [];
    for (let i = 0; i < parts.length; i += 1) {
      const part = parts[i];
      if (!part) continue;
      const sample = bindings.samplePart(part, u);
      const hinge = part.hinge;
      const placed = hinge ? hingePlacement(hinge, sample, motion) : { offset: sample, angle: 0 };
      if (hinge && Math.abs(placed.angle) > 1e-5) {
        if (hinge.axis === "x") spin.makeRotationX(placed.angle);
        else spin.makeRotationY(placed.angle);
        shift.makeTranslation(sample.x - hinge.pivot.x, sample.y - hinge.pivot.y, sample.z - hinge.pivot.z);
        matrix.makeTranslation(hinge.pivot.x, hinge.pivot.y, hinge.pivot.z).multiply(spin).multiply(shift);
      } else {
        matrix.makeTranslation(sample.x, sample.y, sample.z);
      }
      mesh.setMatrixAt(i, matrix);
      bases[i] = matrix.clone();
    }
    wheelSets.push({ mesh, base: bases });
    mesh.instanceMatrix.needsUpdate = true;
    mesh.computeBoundingSphere();
    if (ghost) blockPick(mesh);
    else applyPartRaycast(mesh);
    parent.add(mesh);
  }

  function buildLines(
    parent: THREE.Object3D,
    slot: DrawnSlot,
    parts: Part[],
    ghost: boolean,
    dashed: boolean,
    u: number,
  ): void {
    const positions: number[] = [];
    const partIds: string[] = [];
    const pickable: number[] = [];
    const vertParts: number[] = [];
    const spin = new THREE.Matrix4();
    const point = new THREE.Vector3();
    for (const part of parts) {
      const lines = part.lines;
      if (!lines || lines.positions.length < 6) continue;
      const partIndex = partIds.length;
      partIds.push(part.id);
      pickable.push(part.pickable ? 1 : 0);
      const placed = partSpin(part, u, spin);
      const src = lines.positions;
      const count = src.length - (src.length % 6);
      for (let i = 0; i < count; i += 3) {
        point.set(src[i] ?? 0, src[i + 1] ?? 0, src[i + 2] ?? 0);
        if (placed.spin) point.applyMatrix4(placed.spin);
        positions.push(point.x + placed.offset.x, point.y + placed.offset.y, point.z + placed.offset.z);
        vertParts.push(partIndex);
      }
    }
    if (positions.length < 6) return;
    const line = makeLine(
      Float32Array.from(positions),
      partIds,
      Uint16Array.from(vertParts),
      Uint8Array.from(pickable),
      wireMaterialFor(slot, ghost, dashed),
      dashed,
    );
    if (ghost) blockPick(line);
    parent.add(line);
  }

  function buildDifferences(parent: THREE.Object3D, assembly: Assembly, u: number, visible: Set<string>): void {
    const positions: number[] = [];
    const opacity: number[] = [];
    const partIds: string[] = [];
    const pickable: number[] = [];
    const vertParts: number[] = [];
    const matrix = new THREE.Matrix4();
    const spin = new THREE.Matrix4();
    const composed = new THREE.Matrix4();
    const point = new THREE.Vector3();
    for (const part of assembly.parts) {
      const edgeOpacity = diffEdgeOpacity(part.diffTag);
      if (edgeOpacity === null || !visible.has(part.id)) continue;
      const placed = partSpin(part, u, spin);
      const chunks: Float32Array[] = [];
      if (part.mesh) {
        const edges = edgesFromMesh(part.mesh, placed.offset, placed.spin);
        if (edges) chunks.push(edges);
      }
      const inst = part.instances;
      if (inst && inst.count > 0) {
        for (let i = 0; i < inst.count; i += 1) {
          if ((i + 1) * 16 > inst.matrices.length) break;
          matrix.fromArray(inst.matrices, i * 16);
          const local = placed.spin ? composed.copy(placed.spin).multiply(matrix) : matrix;
          const edges = edgesFromMesh(inst.mesh, placed.offset, local);
          if (edges) chunks.push(edges);
        }
      }
      if (chunks.length === 0 && part.lines && part.lines.positions.length >= 6) {
        const src = part.lines.positions;
        const count = src.length - (src.length % 6);
        const raw = new Float32Array(count);
        for (let i = 0; i < count; i += 3) {
          point.set(src[i] ?? 0, src[i + 1] ?? 0, src[i + 2] ?? 0);
          if (placed.spin) point.applyMatrix4(placed.spin);
          raw[i] = point.x + placed.offset.x;
          raw[i + 1] = point.y + placed.offset.y;
          raw[i + 2] = point.z + placed.offset.z;
        }
        chunks.push(raw);
      }
      if (chunks.length === 0) continue;
      const partIndex = partIds.length;
      partIds.push(part.id);
      pickable.push(part.pickable ? 1 : 0);
      for (const chunk of chunks) {
        for (let i = 0; i < chunk.length; i += 1) positions.push(chunk[i] ?? 0);
        const verts = chunk.length / 3;
        for (let v = 0; v < verts; v += 1) {
          opacity.push(edgeOpacity);
          vertParts.push(partIndex);
        }
      }
    }
    if (positions.length < 6) return;
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    geom.setAttribute("partOpacity", new THREE.Float32BufferAttribute(opacity, 1));
    geom.userData = {
      partIds,
      partIdByStartVertex: Uint16Array.from(vertParts),
      partPickable: Uint8Array.from(pickable),
    };
    const material = lineMaterial(LAYER_COLOR_HEX.differences, 1, activePlane());
    material.transparent = true;
    material.depthWrite = true;
    injectLineOpacity(material);
    const line = new THREE.LineSegments(geom, material);
    applyPartRaycast(line);
    parent.add(line);
  }

  function buildAircraft(assembly: Assembly, maskPane: PaneState, u: number, overlay: boolean): void {
    const vis = bindings.getVisibility(assembly, maskPane);
    const solidIds = new Set(vis.solid);
    const ghostIds = new Set(vis.ghost);
    const buckets = new Map<DrawnSlot, { solid: Part[]; ghost: Part[] }>();
    for (const part of assembly.parts) {
      const slot = slotFor(part);
      if (slot === "skip") continue;
      const isSolid = solidIds.has(part.id);
      const isGhost = ghostIds.has(part.id);
      if (!isSolid && !isGhost) continue;
      let bucket = buckets.get(slot);
      if (!bucket) {
        bucket = { solid: [], ghost: [] };
        buckets.set(slot, bucket);
      }
      if (isSolid) bucket.solid.push(part);
      else bucket.ghost.push(part);
    }
    const hiddenSkin = maskPane.hiddenLines && maskPane.soloLayerId === "skin";
    const hiddenStructure = maskPane.hiddenLines && maskPane.soloLayerId === "structure";
    const differences = maskPane.overlays.differences;
    const reveal =
      maskPane.overlays.skin &&
      maskPane.soloLayerId !== "skin" &&
      (maskPane.overlays.structure ||
        maskPane.overlays.composites ||
        maskPane.overlays.cabin ||
        maskPane.overlays.cargo ||
        maskPane.overlays.flightControls ||
        maskPane.overlays.fuel ||
        maskPane.overlays.hydraulics ||
        maskPane.overlays.electrics ||
        maskPane.overlays.bleedEcs);
    for (const slot of DRAW_SLOTS) {
      const bucket = buckets.get(slot);
      if (!bucket) continue;
      const parts = bucket.solid.concat(bucket.ghost);
      if (parts.length === 0) continue;
      const ghost = bucket.solid.length === 0;
      const kind = slotKind(slot);
      if (kind === "wheels") buildWheels(content, parts, ghost, overlay, differences, u, reveal);
      else if (kind === "lines") buildLines(content, slot, parts, ghost, hiddenStructure && slot === "structure", u);
      else {
        const dashed = hiddenSkin && (slot === "skinBody" || slot === "skinEmpennage");
        buildSurface(content, slot, parts, ghost, overlay, differences, dashed, u, reveal);
      }
    }
    const visible = new Set<string>([...solidIds, ...ghostIds]);
    if (differences) buildDifferences(content, assembly, u, visible);
    content.traverse((obj) => {
      if (typeof obj.userData.variantId !== "string") obj.userData.variantId = assembly.variantId;
    });
  }

  function aircraftKey(): string {
    const pane = bindings.getPane();
    const assembly = bindings.getAssembly();
    const peer = bindings.getPeer();
    const vis = bindings.getVisibility(assembly, pane);
    const peerVis = peer ? bindings.getVisibility(peer.assembly, peer.pane) : null;
    const poseStamp = [motion.gear, motion.flap, motion.slat].map((value) => Math.round(value * 40)).join(".");
    return [
      pane.explode,
      poseStamp,
      pane.hiddenLines ? "h" : "",
      pane.soloLayerId ?? "",
      overlayKey(pane),
      stamp(assembly),
      vis.solid.join(","),
      vis.ghost.join(","),
      peer ? "peer" : "",
      peer ? stamp(peer.assembly) : "",
      peer ? (peer.pane.hiddenLines ? "h" : "") : "",
      peer ? (peer.pane.soloLayerId ?? "") : "",
      peer ? overlayKey(peer.pane) : "",
      peerVis ? peerVis.solid.join(",") : "",
      peerVis ? peerVis.ghost.join(",") : "",
    ].join("|");
  }

  function syncAircraft(): void {
    const pane = bindings.getPane();
    motion = flightPose(pane.phase, pane.explode);
    const key = aircraftKey();
    if (key === geomKey) return;
    geomKey = key;
    wheelSets.length = 0;
    clearGroup(content);
    // Overlay sampling uses pane 0 explode for both aircraft. The peer pane is only the mask.
    const u = pane.explode;
    const peer = bindings.getPeer();
    buildAircraft(bindings.getAssembly(), pane, u, peer !== null);
    if (peer) buildAircraft(peer.assembly, peer.pane, u, true);
  }

  function hatchMap(): THREE.CanvasTexture {
    if (hatchTexture) return hatchTexture;
    const size = 64;
    const canvasEl = document.createElement("canvas");
    canvasEl.width = size;
    canvasEl.height = size;
    const ctx = canvasEl.getContext("2d");
    if (ctx) {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = "rgba(255, 255, 255, 0.4)";
      ctx.fillRect(0, 0, size, size);
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(0, size);
      ctx.lineTo(size, 0);
      ctx.stroke();
    }
    const texture = new THREE.CanvasTexture(canvasEl);
    texture.wrapS = THREE.RepeatWrapping;
    texture.wrapT = THREE.RepeatWrapping;
    hatchTexture = texture;
    return texture;
  }

  function syncHatch(): void {
    const clip = bindings.getPane().clip;
    if (clip.axis === "none") {
      if (hatchGroup.children.length > 0) clearGroup(hatchGroup);
      hatchKey = "";
      return;
    }
    const bbox = referenceBBox();
    const key = [clip.axis, clip.t, bbox.min.x, bbox.min.y, bbox.min.z, bbox.max.x, bbox.max.y, bbox.max.z].join(",");
    if (key === hatchKey) return;
    hatchKey = key;
    clearGroup(hatchGroup);
    const corners = hatchCorners(bbox, clip.axis, clip.t).map((corner) => ({
      x: corner.x + (clip.axis === "x" ? -0.01 : 0),
      y: corner.y + (clip.axis === "y" ? -0.01 : 0),
      z: corner.z + (clip.axis === "z" ? -0.01 : 0),
    }));
    const c0 = corners[0];
    const c1 = corners[1];
    const c2 = corners[2];
    const c3 = corners[3];
    if (!c0 || !c1 || !c2 || !c3) return;
    const quad = new THREE.BufferGeometry();
    quad.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(
        [c0.x, c0.y, c0.z, c1.x, c1.y, c1.z, c2.x, c2.y, c2.z, c3.x, c3.y, c3.z],
        3,
      ),
    );
    quad.setIndex([0, 1, 2, 0, 2, 3]);
    const pitch = 1.6;
    const spanU =
      clip.axis === "x" ? (bbox.max.y - bbox.min.y) / pitch : (bbox.max.x - bbox.min.x) / pitch;
    const spanV =
      clip.axis === "z" ? (bbox.max.y - bbox.min.y) / pitch : (bbox.max.z - bbox.min.z) / pitch;
    quad.setAttribute("uv", new THREE.Float32BufferAttribute([0, 0, spanU, 0, spanU, spanV, 0, spanV], 2));
    quad.setAttribute("partOpacity", vertexOpacityAttribute(4, 1));
    quad.userData = {
      partIds: [HATCH_ID],
      partIdByTriangle: new Uint16Array([0, 0]),
      partPickable: new Uint8Array([1]),
    };
    const quadMat = surfaceMaterial(HATCH_HEX, 0.35, null);
    quadMat.map = hatchMap();
    quadMat.transparent = true;
    quadMat.depthWrite = false;
    quadMat.userData.skipClip = true;
    const quadMesh = new THREE.Mesh(quad, quadMat);
    quadMesh.userData.partId = HATCH_ID;
    applyPartRaycast(quadMesh);
    hatchGroup.add(quadMesh);
  }

  function applyFlight(): void {
    const pane = bindings.getPane();
    const body = flightBody(pane.phase, pane.explode);
    flightMove.makeTranslation(body.x, body.y, body.z);
    flightYaw.makeRotationZ(body.yaw);
    flightPitch.makeRotationY(body.pitch);
    flightMatrix
      .copy(flightMove)
      .multiply(flightPivot)
      .multiply(flightYaw)
      .multiply(flightPitch)
      .multiply(flightUnpivot);
    pickRoot.matrix.copy(flightMatrix);
    pickRoot.matrixAutoUpdate = false;
    pickRoot.updateMatrixWorld(true);
    flightShift.set(0, 0, 0).applyMatrix4(pickRoot.matrix);
    key.position.set(keyHome.x + flightShift.x, keyHome.y + flightShift.y, keyHome.z + flightShift.z);
    fill.position.set(fillHome.x + flightShift.x, fillHome.y + flightShift.y, fillHome.z + flightShift.z);
    rim.position.set(rimHome.x + flightShift.x, rimHome.y + flightShift.y, rimHome.z + flightShift.z);
    rake.position.set(rakeHome.x + flightShift.x, rakeHome.y + flightShift.y, rakeHome.z + flightShift.z);
    key.target.position.copy(flightShift);
    key.target.updateMatrixWorld();
    wheelRoll.makeRotationY(body.wheel);
    for (const set of wheelSets) {
      for (let i = 0; i < set.base.length; i += 1) {
        const base = set.base[i];
        if (!base) continue;
        wheelOut.multiplyMatrices(base, wheelRoll);
        set.mesh.setMatrixAt(i, wheelOut);
      }
      set.mesh.instanceMatrix.needsUpdate = true;
    }
  }

  function syncClip(): void {
    const clip = bindings.getPane().clip;
    if (clip.axis !== "none") {
      writeClipPlane(sharedPlane, referenceBBox(), clip.axis, clip.t);
      sharedPlane.applyMatrix4(pickRoot.matrixWorld);
    }
    scene.traverse((obj: THREE.Object3D) => {
      const material = (obj as THREE.Mesh).material;
      if (!material || Array.isArray(material)) return;
      if (material.userData.skipClip === true) return;
      if (clip.axis === "none") {
        if (material.clippingPlanes && material.clippingPlanes.length > 0) material.clippingPlanes = [];
      } else if (material.clippingPlanes !== clipPlanes) material.clippingPlanes = clipPlanes;
    });
  }

  function resize(): void {
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w <= 0 || h <= 0) return;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(w, h, false);
  }

  function pickAt(clientX: number, clientY: number): string | null {
    const rect = canvas.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return null;
    pointerNdc.set(((clientX - rect.left) / rect.width) * 2 - 1, -((clientY - rect.top) / rect.height) * 2 + 1);
    applyFlight();
    const camera = syncCamera();
    raycaster.setFromCamera(pointerNdc, camera);
    raycaster.params.Line = { threshold: 0.18 };
    const hits = raycaster.intersectObject(pickRoot, true);
    for (const hit of hits) {
      const id = (hit as PartIntersection).partId;
      if (!id) continue;
      const variant = hit.object.userData.variantId;
      if (id !== HATCH_ID && typeof variant === "string") return `${variant}|${id}`;
      return id;
    }
    return null;
  }

  function noteHover(id: string | null): void {
    if (id === hoverId) return;
    hoverId = id;
    bindings.onHover(id);
  }

  function onPointerDown(ev: PointerEvent): void {
    if (ev.pointerType === "touch") return;
    if (ev.button !== 0 && ev.button !== 2) return;
    downX = ev.clientX;
    downY = ev.clientY;
    downArmed = true;
    pointerGesture = {
      pointerId: ev.pointerId,
      lastX: ev.clientX,
      lastY: ev.clientY,
      draft: readDraft(),
    };
    canvas.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev: PointerEvent): void {
    if (ev.pointerType === "touch") return;
    if (pointerGesture && ev.pointerId === pointerGesture.pointerId && (ev.buttons & 3) !== 0) {
      const dx = ev.clientX - pointerGesture.lastX;
      const dy = ev.clientY - pointerGesture.lastY;
      pointerGesture.lastX = ev.clientX;
      pointerGesture.lastY = ev.clientY;
      const pan = (ev.buttons & 2) !== 0 || ((ev.buttons & 1) !== 0 && ev.shiftKey);
      if (pan) panBy(pointerGesture.draft, dx, dy);
      else {
        pointerGesture.draft.azimuth -= dx * ORBIT_SPEED;
        pointerGesture.draft.elevation = clampElevation(pointerGesture.draft.elevation - dy * ORBIT_SPEED);
      }
      publish(pointerGesture.draft);
      return;
    }
    noteHover(pickAt(ev.clientX, ev.clientY));
  }

  function onPointerUp(ev: PointerEvent): void {
    if (ev.pointerType === "touch") return;
    if (pointerGesture && ev.pointerId === pointerGesture.pointerId) {
      pointerGesture = null;
      if (canvas.hasPointerCapture(ev.pointerId)) canvas.releasePointerCapture(ev.pointerId);
    }
    noteHover(pickAt(ev.clientX, ev.clientY));
  }

  function onPointerLeave(): void {
    noteHover(null);
  }

  function onClick(ev: MouseEvent): void {
    if (suppressClick) {
      suppressClick = false;
      return;
    }
    if (!downArmed) return;
    if (Math.hypot(ev.clientX - downX, ev.clientY - downY) > 4) return;
    bindings.onPick(pickAt(ev.clientX, ev.clientY));
  }

  function onContextMenu(ev: Event): void {
    ev.preventDefault();
  }

  function onWheel(ev: WheelEvent): void {
    ev.preventDefault();
    const draft = pointerGesture?.draft ?? touchGesture ?? readDraft();
    draft.halfHeight = clampHalf(draft.halfHeight * Math.exp(ev.deltaY * 0.001));
    publish(draft);
  }

  function touchPoint(list: TouchList): { x: number; y: number; dist: number } {
    const a = list[0];
    if (!a) return { x: 0, y: 0, dist: 0 };
    const b = list[1];
    if (!b) return { x: a.clientX, y: a.clientY, dist: 0 };
    return {
      x: (a.clientX + b.clientX) / 2,
      y: (a.clientY + b.clientY) / 2,
      dist: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY),
    };
  }

  function onTouchStart(ev: TouchEvent): void {
    ev.preventDefault();
    suppressClick = true;
    const point = touchPoint(ev.touches);
    const draft = readDraft();
    touchGesture = {
      ...draft,
      target: { x: draft.target.x, y: draft.target.y, z: draft.target.z },
      fingers: ev.touches.length >= 2 ? "two" : "one",
      lastX: point.x,
      lastY: point.y,
      lastDist: point.dist,
      downX: point.x,
      downY: point.y,
      moved: false,
    };
  }

  function onTouchMove(ev: TouchEvent): void {
    ev.preventDefault();
    if (!touchGesture) return;
    const point = touchPoint(ev.touches);
    const dx = point.x - touchGesture.lastX;
    const dy = point.y - touchGesture.lastY;
    if (Math.hypot(point.x - touchGesture.downX, point.y - touchGesture.downY) > 4) touchGesture.moved = true;
    if (ev.touches.length >= 2) {
      if (touchGesture.fingers !== "two") {
        touchGesture.fingers = "two";
        touchGesture.lastX = point.x;
        touchGesture.lastY = point.y;
        touchGesture.lastDist = point.dist;
        return;
      }
      panBy(touchGesture, dx, dy);
      if (touchGesture.lastDist > 0 && point.dist > 0) {
        touchGesture.halfHeight = clampHalf(touchGesture.halfHeight * (touchGesture.lastDist / point.dist));
      }
      touchGesture.lastDist = point.dist;
    } else {
      if (touchGesture.fingers !== "one") {
        touchGesture.fingers = "one";
        touchGesture.lastX = point.x;
        touchGesture.lastY = point.y;
        return;
      }
      touchGesture.azimuth -= dx * ORBIT_SPEED;
      touchGesture.elevation = clampElevation(touchGesture.elevation - dy * ORBIT_SPEED);
    }
    touchGesture.lastX = point.x;
    touchGesture.lastY = point.y;
    publish(touchGesture);
  }

  function onTouchEnd(ev: TouchEvent): void {
    ev.preventDefault();
    if (!touchGesture) return;
    if (ev.touches.length === 0) {
      const ended = touchGesture;
      touchGesture = null;
      if (!ended.moved) bindings.onPick(pickAt(ended.downX, ended.downY));
      return;
    }
    const point = touchPoint(ev.touches);
    touchGesture.fingers = ev.touches.length >= 2 ? "two" : "one";
    touchGesture.lastX = point.x;
    touchGesture.lastY = point.y;
    touchGesture.lastDist = point.dist;
  }

  function noteFrame(now: number): void {
    const dt = Math.max(0, now - lastNow);
    lastNow = now;
    frameTimes[frameWrite] = dt;
    frameWrite = (frameWrite + 1) % FRAME_RING;
    if (frameCount < FRAME_RING) frameCount += 1;
    let sum = 0;
    for (let i = 0; i < frameCount; i += 1) sum += frameTimes[i] ?? 0;
    const avg = frameCount > 0 ? sum / frameCount : 0;
    if (avg > 20) {
      slowStreak += 1;
      if (slowStreak >= 60) hud.slow = true;
    } else {
      slowStreak = 0;
      hud.slow = false;
    }
    hud.fps = avg > 0 ? 1000 / avg : 0;
  }

  function syncLights(now: number): void {
    const pane = bindings.getPane();
    const pose = flightPose(pane.phase, pane.explode);
    const beaconOn = pose.beacon > 0.5 && now % 1400 < 980;
    const strobeOn = pose.strobe > 0.45 && now % 900 < 110;
    setLightLevels({
      nav: pose.nav,
      beacon: pose.beacon > 0.5 ? (beaconOn ? 1 : 0.08) : 0,
      strobe: strobeOn ? 1 : 0,
      cabin: pose.cabin,
      land: pose.land,
    });
  }

  function frame(now: number): void {
    if (disposed) return;
    noteFrame(now);
    const w = canvas.clientWidth;
    const h = canvas.clientHeight;
    if (w > 0 && h > 0) {
      syncLights(now);
      syncAircraft();
      applyFlight();
      syncHatch();
      syncClip();
      const camera = syncCamera();
      renderer.render(scene, camera);
      hud.triangles = renderer.info.render.triangles;
      hud.calls = renderer.info.render.calls;
      renderer.info.reset();
    }
    if (!disposed) raf = requestAnimationFrame(frame);
  }

  const unsubscribe = bindings.subscribe(() => {
    if (!disposed) syncCamera();
  });
  const observer = new ResizeObserver(() => {
    resize();
  });
  observer.observe(canvas);
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  canvas.addEventListener("pointerup", onPointerUp);
  canvas.addEventListener("pointercancel", onPointerUp);
  canvas.addEventListener("pointerleave", onPointerLeave);
  canvas.addEventListener("click", onClick);
  canvas.addEventListener("contextmenu", onContextMenu);
  canvas.addEventListener("wheel", onWheel, { passive: false });
  canvas.addEventListener("touchstart", onTouchStart, { passive: false });
  canvas.addEventListener("touchmove", onTouchMove, { passive: false });
  canvas.addEventListener("touchend", onTouchEnd, { passive: false });
  resize();
  raf = requestAnimationFrame(frame);

  return {
    getHud: () => ({ triangles: hud.triangles, calls: hud.calls, fps: hud.fps, slow: hud.slow }),
    dispose: () => {
      if (disposed) return;
      disposed = true;
      unsubscribe();
      cancelAnimationFrame(raf);
      observer.disconnect();
      canvas.removeEventListener("pointerdown", onPointerDown);
      canvas.removeEventListener("pointermove", onPointerMove);
      canvas.removeEventListener("pointerup", onPointerUp);
      canvas.removeEventListener("pointercancel", onPointerUp);
      canvas.removeEventListener("pointerleave", onPointerLeave);
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("contextmenu", onContextMenu);
      canvas.removeEventListener("wheel", onWheel);
      canvas.removeEventListener("touchstart", onTouchStart);
      canvas.removeEventListener("touchmove", onTouchMove);
      canvas.removeEventListener("touchend", onTouchEnd);
      disposeTree(scene);
      hatchTexture?.dispose();
      hatchTexture = null;
      envMap.dispose();
      padMap.dispose();
      runwayMap.dispose();
      room.traverse((obj) => {
        const mesh = obj as THREE.Mesh;
        mesh.geometry?.dispose();
        const material = mesh.material;
        if (Array.isArray(material)) {
          for (const item of material) item.dispose();
        } else material?.dispose();
      });
      renderer.dispose();
    },
  };
}

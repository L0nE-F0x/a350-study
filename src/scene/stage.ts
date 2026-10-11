import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { GTAOPass } from "three/examples/jsm/postprocessing/GTAOPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";

/** Scene clear colour. Fog and the ground fade resolve to this so there is no horizon line. */
export const STAGE_BG = 0x06080b;

function glowMaterial(hex: number, intensity: number): THREE.MeshBasicMaterial {
  const material = new THREE.MeshBasicMaterial({ color: hex, side: THREE.DoubleSide });
  material.color.multiplyScalar(intensity);
  return material;
}

/**
 * A dark hangar lit by long ceiling strips, one side softbox, and a cool rim panel.
 * Built in the study frame (Z up, nose toward −X) so the strips run fore and aft and
 * paint long highlights down the crown, the way a real hangar does.
 */
export function studioEnvironment(renderer: THREE.WebGLRenderer): THREE.Texture {
  const env = new THREE.Scene();
  const shell = new THREE.Mesh(
    new THREE.BoxGeometry(220, 220, 90),
    new THREE.MeshBasicMaterial({ color: 0x1b1f24, side: THREE.BackSide }),
  );
  shell.position.z = 30;
  env.add(shell);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshBasicMaterial({ color: 0x07080a }));
  floor.position.z = -14;
  env.add(floor);

  const strip = new THREE.PlaneGeometry(120, 2.2);
  for (const [y, power] of [
    [-26, 5],
    [-9, 7],
    [8, 7],
    [25, 5],
  ] as const) {
    const light = new THREE.Mesh(strip, glowMaterial(0xf2f4f8, power));
    light.position.set(0, y, 74);
    env.add(light);
  }
  // Tall softboxes either side, so a level view of the flank still finds a reflection.
  for (const [y, power] of [
    [-108, 3],
    [108, 2],
  ] as const) {
    const softbox = new THREE.Mesh(new THREE.PlaneGeometry(130, 46), glowMaterial(0xfff1e2, power));
    softbox.position.set(-10, y, 8);
    softbox.rotation.x = Math.PI / 2;
    env.add(softbox);
  }
  const rim = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), glowMaterial(0xcfe0ff, 1.2));
  rim.position.set(108, 30, 16);
  rim.rotation.y = -Math.PI / 2;
  env.add(rim);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const texture = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  env.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    mesh.geometry?.dispose();
    const material = mesh.material;
    if (material && !Array.isArray(material)) material.dispose();
  });
  return texture;
}

/**
 * Soft ambient shadow under the airframe, drawn once in normalised plan coordinates:
 * u runs nose to tail, v runs wingtip to wingtip. The mesh is scaled to the bbox.
 */
export function contactShadowTexture(): THREE.CanvasTexture {
  const w = 512;
  const h = 512;
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (ctx) {
    ctx.clearRect(0, 0, w, h);
    ctx.filter = "blur(14px)";
    ctx.fillStyle = "rgba(0, 0, 0, 0.95)";
    ctx.beginPath();
    ctx.ellipse(w * 0.5, h * 0.5, w * 0.47, h * 0.055, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.43, h * 0.5);
      ctx.lineTo(w * 0.79, h * (0.5 + side * 0.46));
      ctx.lineTo(w * 0.84, h * (0.5 + side * 0.46));
      ctx.lineTo(w * 0.61, h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
    ctx.fillStyle = "rgba(0, 0, 0, 0.6)";
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(w * 0.86, h * 0.5);
      ctx.lineTo(w * 0.95, h * (0.5 + side * 0.15));
      ctx.lineTo(w * 0.98, h * (0.5 + side * 0.15));
      ctx.lineTo(w * 0.96, h * 0.5);
      ctx.closePath();
      ctx.fill();
    }
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

export interface PostChain {
  setSize: (width: number, height: number, pixelRatio: number) => void;
  render: (camera: THREE.OrthographicCamera | THREE.PerspectiveCamera, occlusion: boolean) => void;
  dispose: () => void;
}

/**
 * Multisampled HDR render, ground-truth ambient occlusion, a selective bloom that only
 * catches the lit windows and the lamps, then tone mapping in the output pass.
 * AO has one pass per camera type because the shader bakes the projection in as a define.
 */
export function createPostChain(
  renderer: THREE.WebGLRenderer,
  scene: THREE.Scene,
  ortho: THREE.OrthographicCamera,
  persp: THREE.PerspectiveCamera,
): PostChain {
  const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: 4 });
  const composer = new EffectComposer(renderer, target);
  const base = new RenderPass(scene, persp);
  composer.addPass(base);
  const aoPasses = [new GTAOPass(scene, persp, 1, 1), new GTAOPass(scene, ortho, 1, 1)] as const;
  for (const pass of aoPasses) {
    pass.updateGtaoMaterial({ radius: 2.4, distanceExponent: 1.4, thickness: 2.5, scale: 1.1, samples: 16 });
    pass.updatePdMaterial({ lumaPhi: 10, depthPhi: 2, normalPhi: 3, radius: 6, rings: 2, samples: 16 });
    pass.blendIntensity = 0.9;
    pass.enabled = false;
    composer.addPass(pass);
  }
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.35, 0);
  // Selective bloom. The livery shader writes 1 + weight into alpha for lamps and lit windows.
  // A brightness threshold cannot tell a red lamp from a clear-coat glint, so it is not used.
  bloom.materialHighPassFilter.fragmentShader = `
    uniform sampler2D tDiffuse;
    varying vec2 vUv;
    void main() {
      vec4 texel = texture2D(tDiffuse, vUv);
      float weight = clamp(texel.a - 1.0, 0.0, 1.0);
      gl_FragColor = vec4(texel.rgb * weight, 1.0);
    }
  `;
  bloom.materialHighPassFilter.needsUpdate = true;
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  return {
    setSize(width, height, pixelRatio) {
      composer.setPixelRatio(pixelRatio);
      composer.setSize(width, height);
    },
    render(camera, occlusion) {
      base.camera = camera;
      aoPasses[0].enabled = occlusion && camera === persp;
      aoPasses[1].enabled = occlusion && camera === ortho;
      composer.render();
    },
    dispose() {
      for (const pass of aoPasses) pass.dispose();
      bloom.dispose();
      composer.dispose();
      target.dispose();
    },
  };
}

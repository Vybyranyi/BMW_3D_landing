import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const BG = new THREE.Color(0x07080a);

/** Dark studio with long soft-box strips — gives the white paint those clean reflection lines. */
function studioEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(40, 16, 40),
    new THREE.MeshBasicMaterial({ color: 0x0c0d10, side: THREE.BackSide }),
  );
  room.position.y = 6;
  env.add(room);
  const panel = (w, h, intensity, pos, rot, tint = 0xffffff) => {
    const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
    const p = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
    p.position.copy(pos);
    p.rotation.set(...rot);
    env.add(p);
  };
  panel(10, 3.2, 3.2, new THREE.Vector3(0, 7, 0), [Math.PI / 2, 0, 0]);
  panel(14, 0.6, 4.5, new THREE.Vector3(0, 3.4, 7), [0, 0, 0]);
  panel(14, 0.6, 4.5, new THREE.Vector3(0, 3.4, -7), [0, 0, 0]);
  panel(14, 0.35, 3, new THREE.Vector3(0, 1.4, 8), [0, 0, 0]);
  panel(14, 0.35, 3, new THREE.Vector3(0, 1.4, -8), [0, 0, 0]);
  panel(0.6, 6, 1.6, new THREE.Vector3(9, 3, 0), [0, Math.PI / 2, 0]);
  panel(0.6, 6, 1.6, new THREE.Vector3(-9, 3, 0), [0, Math.PI / 2, 0]);
  panel(6, 2, 1.6, new THREE.Vector3(8, 4, 5), [0, -Math.PI / 3, 0], 0xcfe3ff);
  panel(6, 2, 1.2, new THREE.Vector3(-8, 4, -5), [0, Math.PI / 1.5, 0], 0xffe6cc);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.035).texture;
  pmrem.dispose();
  return tex;
}

/** Studio floor: radial pool of light, moving grid, analytic contact shadow, headlight pool. */
function createFloor() {
  const uniforms = {
    uBg: { value: BG.clone() },
    uBase: { value: new THREE.Color(0x15171b) },
    uOffset: { value: 0 },
    uGrid: { value: 0.35 },
    uHead: { value: 0 },
    uTail: { value: 0 },
  };
  const mat = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: /* glsl */ `
      varying vec3 vPos;
      void main() {
        vec4 wp = modelMatrix * vec4(position, 1.0);
        vPos = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uBg; uniform vec3 uBase; uniform float uOffset; uniform float uGrid;
      uniform float uHead; uniform float uTail;
      varying vec3 vPos;
      float sdRound(vec2 p, vec2 b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
      float gridLine(float v, float w) { float f = abs(fract(v) - 0.5); float d = fwidth(v); return 1.0 - smoothstep(w - d, w + d, 0.5 - f); }
      void main() {
        vec2 p = vPos.xz;
        float r = length(p * vec2(0.55, 0.8));
        float pool = exp(-r * r * 0.09);
        vec3 col = mix(uBg, uBase, pool);
        // grid (scrolls along x when the car "drives")
        vec2 g = vec2(p.x + uOffset, p.y);
        float lines = max(gridLine(g.x, 0.012), gridLine(g.y, 0.012));
        float fine = max(gridLine(g.x * 4.0, 0.02), gridLine(g.y * 4.0, 0.02)) * 0.25;
        col += vec3(0.11, 0.13, 0.17) * (lines + fine) * uGrid * exp(-r * 0.16);
        // headlight pool in front of the car
        vec2 hp = (p - vec2(4.2, 0.0)) * vec2(0.42, 0.75);
        col += vec3(0.85, 0.92, 1.0) * uHead * 0.26 * exp(-dot(hp, hp) * 1.5);
        vec2 tp = (p - vec2(-3.0, 0.0)) * vec2(1.1, 0.9);
        col += vec3(1.0, 0.05, 0.03) * uTail * 0.12 * exp(-dot(tp, tp) * 2.0);
        // contact shadow
        float d = sdRound(p - vec2(-0.1, 0.0), vec2(2.25, 0.86), 0.55);
        float sh = 1.0 - smoothstep(-0.35, 0.55, d);
        col *= 1.0 - 0.75 * sh;
        float wheels = 0.0;
        for (int i = 0; i < 4; i++) {
          vec2 c = vec2(i < 2 ? 1.405 : -1.405, (i == 0 || i == 2) ? 0.78 : -0.78);
          float dw = sdRound(p - c, vec2(0.25, 0.1), 0.08);
          wheels = max(wheels, 1.0 - smoothstep(-0.05, 0.18, dw));
        }
        col *= 1.0 - 0.7 * wheels;
        gl_FragColor = vec4(col, 1.0);
      }`,
  });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), mat);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0;
  return { floor, uniforms };
}

export function createStage(canvas) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, coarse ? 1.5 : 1.75));
  renderer.toneMapping = THREE.NeutralToneMapping;
  renderer.toneMappingExposure = 1.0;

  const scene = new THREE.Scene();
  scene.background = BG.clone();
  scene.fog = new THREE.Fog(BG, 12, 30);
  scene.environment = studioEnvironment(renderer);
  scene.environmentIntensity = 1.35;

  // No direct lights: their specular peaks on the clearcoat blow out the bloom. The studio env does the lighting.
  scene.add(new THREE.HemisphereLight(0xdde6ff, 0x101012, 0.5));

  const { floor, uniforms: floorUniforms } = createFloor();
  scene.add(floor);

  const camera = new THREE.PerspectiveCamera(32, 1, 0.05, 80);
  camera.position.set(6, 1.6, 4);

  const target = new THREE.WebGLRenderTarget(1, 1, { samples: coarse ? 2 : 4, type: THREE.HalfFloatType });
  const composer = new EffectComposer(renderer, target);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.4, 4.0);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  function resize() {
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  resize();

  return {
    renderer, scene, camera, composer, bloom, floorUniforms, resize,
    render: () => composer.render(),
  };
}

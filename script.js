import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { Pane } from "tweakpane";

// --- Tweakpane params ---
const params = {
  pivotX: Math.PI,
  pivotY: -Math.PI,
  pivotZ: -Math.PI,
  scale: 1.5,
  speed: 1,
  outlineThickness: 0.03,
  // Orb
  orbVisible: true,
  orbScale: 0.6,
  orbOpacity: 1.0,
  orbEmissive: 2.0,
  orbRing: false,
  orbGlow: true,
  // Colors
  bgColor: "#000000",
  figureColor: "#e8e4e0",
  outlineColor: "#000000",
  orbColor: "#ffffff",
  logoNoCircle: true,
  // Post-processing
  bloomStrength: 0.4,
  bloomRadius: 0.8,
  bloomThreshold: 0.6,
  grainIntensity: 0.03,
  vignetteIntensity: 0.4,
  spotRadius: 8,
  spotIntensity: 1.5,
};

const pane = new Pane({ title: "Settings" });
const rotFolder = pane.addFolder({ title: "Pivot Rotation" });
rotFolder.addBinding(params, "pivotX", { min: -Math.PI, max: Math.PI, step: 0.01, label: "X" });
rotFolder.addBinding(params, "pivotY", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Y" });
rotFolder.addBinding(params, "pivotZ", { min: -Math.PI, max: Math.PI, step: 0.01, label: "Z" });
pane.addBinding(params, "scale", { min: 0.2, max: 5, step: 0.1, label: "Scale" });
pane.addBinding(params, "speed", { min: 0, max: 3, step: 0.1, label: "Speed" });
pane.addBinding(params, "outlineThickness", { min: 0, max: 0.1, step: 0.005, label: "Outline" });

const orbFolder = pane.addFolder({ title: "Orb" });
orbFolder.addBinding(params, "orbVisible", { label: "Visible" });
orbFolder.addBinding(params, "orbScale", { min: 0.1, max: 5, step: 0.1, label: "Size" });
orbFolder.addBinding(params, "orbOpacity", { min: 0, max: 1, step: 0.05, label: "Opacity" });
orbFolder.addBinding(params, "orbEmissive", { min: 0, max: 2, step: 0.05, label: "Emissive" });
orbFolder.addBinding(params, "orbRing", { label: "Ring" });
orbFolder.addBinding(params, "orbGlow", { label: "Glow" });

const colorFolder = pane.addFolder({ title: "Colors" });
colorFolder.addBinding(params, "bgColor", { label: "Background" });
colorFolder.addBinding(params, "figureColor", { label: "Figures" });
colorFolder.addBinding(params, "outlineColor", { label: "Outline" });
colorFolder.addBinding(params, "orbColor", { label: "Orb" });
colorFolder.addBinding(params, "logoNoCircle", { label: "Logo no O" });

const fxFolder = pane.addFolder({ title: "Post-Processing" });
fxFolder.addBinding(params, "bloomStrength", { min: 0, max: 2, step: 0.05, label: "Bloom" });
fxFolder.addBinding(params, "bloomRadius", { min: 0, max: 2, step: 0.05, label: "Bloom Rad" });
fxFolder.addBinding(params, "bloomThreshold", { min: 0, max: 1, step: 0.05, label: "Bloom Thr" });
fxFolder.addBinding(params, "grainIntensity", { min: 0, max: 0.3, step: 0.01, label: "Grain" });
fxFolder.addBinding(params, "vignetteIntensity", { min: 0, max: 1, step: 0.05, label: "Vignette" });
fxFolder.addBinding(params, "spotRadius", { min: 2, max: 20, step: 0.5, label: "Spot Size" });
fxFolder.addBinding(params, "spotIntensity", { min: 0, max: 3, step: 0.1, label: "Spot Int" });

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x000000);

const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("orb-canvas"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;

// --- Post-processing ---
const composer = new EffectComposer(renderer);
const renderPass = new RenderPass(scene, camera);
composer.addPass(renderPass);

const bloomPass = new UnrealBloomPass(
  new THREE.Vector2(window.innerWidth, window.innerHeight),
  params.bloomStrength,
  params.bloomRadius,
  params.bloomThreshold
);
composer.addPass(bloomPass);

// Film grain + vignette + spotlight shader
const grainVignetteShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uGrainIntensity: { value: params.grainIntensity },
    uVignetteIntensity: { value: params.vignetteIntensity },
    uSpotRadius: { value: params.spotRadius },
    uSpotIntensity: { value: params.spotIntensity },
    uResolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) },
  },
  vertexShader: `
    varying vec2 vUv;
    void main() {
      vUv = uv;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    uniform sampler2D tDiffuse;
    uniform float uTime;
    uniform float uGrainIntensity;
    uniform float uVignetteIntensity;
    uniform float uSpotRadius;
    uniform float uSpotIntensity;
    uniform vec2 uResolution;
    varying vec2 vUv;

    // Film grain noise
    float random(vec2 co) {
      return fract(sin(dot(co, vec2(12.9898, 78.233))) * 43758.5453);
    }

    void main() {
      vec4 color = texture2D(tDiffuse, vUv);

      // Spotlight from center — soft circular light pool
      vec2 center = vec2(0.5);
      float aspect = uResolution.x / uResolution.y;
      vec2 uv = vUv - center;
      uv.x *= aspect;
      float dist = length(uv);
      float spotNorm = uSpotRadius / 14.0; // normalize to view
      float spot = smoothstep(spotNorm, spotNorm * 0.2, dist) * uSpotIntensity;
      color.rgb *= (0.15 + spot); // dark outside spotlight

      // Vignette
      float vDist = distance(vUv, center);
      float vignette = 1.0 - smoothstep(0.3, 0.9, vDist) * uVignetteIntensity;
      color.rgb *= vignette;

      // Film grain
      float grain = random(vUv * uTime) * 2.0 - 1.0;
      color.rgb += grain * uGrainIntensity;

      gl_FragColor = color;
    }
  `,
};

const grainPass = new ShaderPass(grainVignetteShader);
composer.addPass(grainPass);

const outputPass = new OutputPass();
composer.addPass(outputPass);

function resize() {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const aspect = w / h;
  const viewSize = 14;

  camera.left = (-viewSize * aspect) / 2;
  camera.right = (viewSize * aspect) / 2;
  camera.top = viewSize / 2;
  camera.bottom = -viewSize / 2;
  camera.near = 0.1;
  camera.far = 100;
  camera.updateProjectionMatrix();

  renderer.setSize(w, h);
  composer.setSize(w, h);
  bloomPass.resolution.set(w, h);
  grainPass.uniforms.uResolution.value.set(w, h);
}

// Top-down camera
camera.position.set(0, 30, 0);
camera.lookAt(0, 0, 0);
resize();
window.addEventListener("resize", resize);

// --- Orbit center tracking (align with the O in the logo) ---
// The O in ORBIT is at ~38.7% x, ~69.5% y in the SVG viewBox (2733x1025)
const orbitCenter = { x: 0, z: 0 };

function updateOrbitCenter() {
  const logo = document.querySelector(".logo");
  if (!logo) return;

  const rect = logo.getBoundingClientRect();
  // O center in pixel coords relative to viewport
  const oScreenX = rect.left + rect.width * 0.387;
  const oScreenY = rect.top + rect.height * 0.695;

  // Convert screen coords to NDC (-1 to 1)
  const ndcX = (oScreenX / window.innerWidth) * 2 - 1;
  const ndcY = -((oScreenY / window.innerHeight) * 2 - 1);

  // Convert NDC to world coords (orthographic)
  orbitCenter.x = ndcX * (camera.right - camera.left) / 2;
  orbitCenter.z = -ndcY * (camera.top - camera.bottom) / 2;
}

// --- Lighting ---
// Dim ambient — the spotlight shader will add the main light
const ambientLight = new THREE.AmbientLight(0xffffff, 2);
scene.add(ambientLight);

const topLight = new THREE.DirectionalLight(0xffffff, 4);
topLight.position.set(0, 30, 0);
scene.add(topLight);

const fillLight = new THREE.DirectionalLight(0xffffff, 1);
fillLight.position.set(5, 20, 5);
scene.add(fillLight);

// Accent point lights
const rimLight1 = new THREE.PointLight(0x888888, 2, 25);
rimLight1.position.set(5, 4, 5);
scene.add(rimLight1);

const rimLight2 = new THREE.PointLight(0x888888, 1.5, 25);
rimLight2.position.set(-5, 4, -5);
scene.add(rimLight2);

// --- Central orb ---
function createOrb() {
  const group = new THREE.Group();

  const orbGeo = new THREE.SphereGeometry(1.5, 64, 64);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0x111111,
    emissive: 0x888888,
    emissiveIntensity: 0.6,
    roughness: 0.5,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.y = -0.3;
  group.add(orb);

  const ringGeo = new THREE.RingGeometry(1.6, 1.7, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0x888888,
    transparent: true,
    opacity: 0.35,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  // Glow disc
  const glowGeo = new THREE.CircleGeometry(5, 64);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0x888888) },
    },
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying vec2 vUv;
      void main() {
        float d = distance(vUv, vec2(0.5));
        float alpha = smoothstep(0.5, 0.1, d) * 0.15;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.02;
  group.add(glow);

  return { group, orb, ring, glow };
}

const orbObj = createOrb();
scene.add(orbObj.group);

// --- Cel-shaded outline material ---
const outlineMat = new THREE.ShaderMaterial({
  side: THREE.BackSide,
  uniforms: {
    uThickness: { value: params.outlineThickness },
    uColor: { value: new THREE.Color(0x000000) },
  },
  vertexShader: `
    uniform float uThickness;
    void main() {
      vec3 pos = position + normal * uThickness;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `,
  fragmentShader: `
    uniform vec3 uColor;
    void main() {
      gl_FragColor = vec4(uColor, 1.0);
    }
  `,
});

// --- Figure config ---
const NUM_FIGURES = 7;
const GLB_PATH = "assets/swimmer-inplace.glb";

const figureConfigs = [];
for (let i = 0; i < NUM_FIGURES; i++) {
  figureConfigs.push({
    angle: (Math.PI * 2 * i) / NUM_FIGURES + Math.random() * 0.5,
    radius: 3.0 + Math.random() * 3.0,
    speed: (0.12 + Math.random() * 0.1) * (Math.random() > 0.5 ? 1 : -1),
    wobbleAmp: 0.15 + Math.random() * 0.3,
    wobbleFreq: 0.3 + Math.random() * 0.5,
    wobblePhase: Math.random() * Math.PI * 2,
    opacity: 0.6 + Math.random() * 0.4,
    animOffset: Math.random() * 5,
  });
}

// --- Load GLB or create fallback figures ---
const mixers = [];
const figures = [];
const pivots = [];

function createFallbackFigure(config) {
  const group = new THREE.Group();
  const mat = new THREE.MeshToonMaterial({
    color: 0xe8e4e0,
    transparent: true,
    opacity: config.opacity,
  });

  const bodyGeo = new THREE.CapsuleGeometry(0.12, 0.7, 4, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.z = -0.55;
  group.add(head);

  const armGeo = new THREE.CapsuleGeometry(0.06, 0.5, 4, 8);
  const leftArm = new THREE.Mesh(armGeo, mat);
  leftArm.position.set(-0.3, 0, -0.2);
  leftArm.rotation.z = 0.5;
  leftArm.rotation.x = Math.PI / 2;
  group.add(leftArm);

  const rightArm = new THREE.Mesh(armGeo, mat);
  rightArm.position.set(0.3, 0, 0.05);
  rightArm.rotation.z = -0.5;
  rightArm.rotation.x = Math.PI / 2;
  group.add(rightArm);

  const legGeo = new THREE.CapsuleGeometry(0.07, 0.5, 4, 8);
  const leftLeg = new THREE.Mesh(legGeo, mat);
  leftLeg.position.set(-0.1, 0, 0.55);
  leftLeg.rotation.x = Math.PI / 2 + 0.2;
  group.add(leftLeg);

  const rightLeg = new THREE.Mesh(legGeo, mat);
  rightLeg.position.set(0.1, 0, 0.5);
  rightLeg.rotation.x = Math.PI / 2 - 0.15;
  group.add(rightLeg);

  group.userData = { leftArm, rightArm, leftLeg, rightLeg, config };
  return group;
}

function animateFallbackFigure(fig, time) {
  const d = fig.userData;
  const t = time * 2 + d.config.animOffset;
  d.leftArm.rotation.z = 0.5 + Math.sin(t) * 0.6;
  d.leftArm.position.z = -0.2 + Math.sin(t) * 0.15;
  d.rightArm.rotation.z = -0.5 + Math.sin(t + Math.PI) * 0.6;
  d.rightArm.position.z = 0.05 + Math.sin(t + Math.PI) * 0.15;
  d.leftLeg.rotation.x = Math.PI / 2 + Math.sin(t * 1.5) * 0.3;
  d.rightLeg.rotation.x = Math.PI / 2 + Math.sin(t * 1.5 + Math.PI) * 0.3;
}

// Try loading GLB
const loader = new GLTFLoader();

loader.load(
  GLB_PATH,
  (gltf) => {
    const model = gltf.scene;
    const animations = gltf.animations;

    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const modelHeight = size.y;
    const targetHeight = params.scale;
    const baseScale = targetHeight / modelHeight;

    console.log(
      `Model: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}, scale: ${baseScale.toFixed(4)}`
    );

    figureConfigs.forEach((config) => {
      const clone = SkeletonUtils.clone(model);
      const s = baseScale * (0.8 + Math.random() * 0.4);
      clone.scale.setScalar(s);

      // Cel-shaded toon material + outline
      clone.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshToonMaterial({
            color: 0xe8e4e0,
            emissive: 0x444444,
            emissiveIntensity: 0.1,
            transparent: true,
            opacity: config.opacity,
          });
          child.castShadow = false;
          child.receiveShadow = false;

          // Add outline
          if (child.isSkinnedMesh) {
            const outlineClone = outlineMat.clone();
            const skinnedOutline = new THREE.SkinnedMesh(child.geometry, outlineClone);
            skinnedOutline.skeleton = child.skeleton;
            skinnedOutline.bindMatrix = child.bindMatrix;
            skinnedOutline.bindMatrixInverse = child.bindMatrixInverse;
            skinnedOutline.name = "outline";
            child.parent.add(skinnedOutline);
          } else {
            const outlineClone = outlineMat.clone();
            const outlineMesh = new THREE.Mesh(child.geometry, outlineClone);
            outlineMesh.name = "outline";
            child.parent.add(outlineMesh);
          }
        }
      });

      // pivot → clone (orientation), wrapper → pivot (orbit position + heading)
      const pivot = new THREE.Group();
      pivot.rotation.set(params.pivotX, params.pivotY, params.pivotZ);
      pivot.add(clone);
      pivots.push(pivot);

      const wrapper = new THREE.Group();
      wrapper.add(pivot);

      scene.add(wrapper);
      figures.push({ mesh: wrapper, inner: clone, pivot, config, isFallback: false });

      if (animations.length > 0) {
        const mixer = new THREE.AnimationMixer(clone);
        const action = mixer.clipAction(animations[0]);
        action.play();
        action.time = config.animOffset;
        mixers.push(mixer);
      }
    });
  },
  (progress) => {
    if (progress.total > 0) {
      console.log(`Loading: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`);
    }
  },
  (err) => {
    console.log("No GLB found, using fallback figures.", err);
    figureConfigs.forEach((config) => {
      const fig = createFallbackFigure(config);
      scene.add(fig);
      figures.push({ mesh: fig, config, isFallback: true });
    });
  }
);

// --- Animation loop ---
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);

  const delta = clock.getDelta();
  const time = clock.getElapsedTime();

  mixers.forEach((m) => m.update(delta));

  // Track orbit center to the O in the logo
  updateOrbitCenter();
  orbObj.group.position.set(orbitCenter.x, 0, orbitCenter.z);

  // Orb controls
  orbObj.group.visible = params.orbVisible;
  const pulse = 1 + Math.sin(time * 0.5) * 0.04;
  orbObj.orb.scale.setScalar(params.orbScale * pulse);
  orbObj.orb.material.opacity = params.orbOpacity;
  orbObj.orb.material.emissiveIntensity = params.orbEmissive;
  orbObj.ring.visible = params.orbRing;
  orbObj.ring.material.opacity = 0.25 + Math.sin(time * 0.8) * 0.1;
  orbObj.glow.visible = params.orbGlow;

  // Color controls
  scene.background.set(params.bgColor);
  orbObj.orb.material.emissive.set(params.orbColor);
  orbObj.ring.material.color.set(params.orbColor);
  orbObj.glow.material.uniforms.uColor.value.set(params.orbColor);
  outlineMat.uniforms.uColor.value.set(params.outlineColor);

  // Update figure materials
  figures.forEach(({ inner, isFallback }) => {
    if (!inner) return;
    const target = isFallback ? inner : inner;
    target.traverse((child) => {
      if (child.isMesh && child.name !== "outline") {
        child.material.color.set(params.figureColor);
      }
    });
  });

  // Logo toggle
  const logoEl = document.querySelector(".logo");
  if (logoEl) {
    logoEl.src = params.logoNoCircle
      ? "assets/logo-no-circle.svg"
      : "assets/logo.svg";
  }

  // Update tweakpane-driven values
  pivots.forEach((p) => {
    p.rotation.set(params.pivotX, params.pivotY, params.pivotZ);
  });
  outlineMat.uniforms.uThickness.value = params.outlineThickness;

  // Post-processing params
  bloomPass.strength = params.bloomStrength;
  bloomPass.radius = params.bloomRadius;
  bloomPass.threshold = params.bloomThreshold;
  grainPass.uniforms.uTime.value = time;
  grainPass.uniforms.uGrainIntensity.value = params.grainIntensity;
  grainPass.uniforms.uVignetteIntensity.value = params.vignetteIntensity;
  grainPass.uniforms.uSpotRadius.value = params.spotRadius;
  grainPass.uniforms.uSpotIntensity.value = params.spotIntensity;

  // Move figures in orbits — heading derived from movement
  figures.forEach(({ mesh, config, isFallback }) => {
    config.angle += config.speed * params.speed * delta;

    const wobble =
      Math.sin(time * config.wobbleFreq + config.wobblePhase) * config.wobbleAmp;
    const r = config.radius + wobble;

    const x = orbitCenter.x + Math.cos(config.angle) * r;
    const z = orbitCenter.z + Math.sin(config.angle) * r;

    const prevX = config.prevX ?? x;
    const prevZ = config.prevZ ?? z;
    const dx = x - prevX;
    const dz = z - prevZ;

    if (dx !== 0 || dz !== 0) {
      mesh.rotation.y = Math.atan2(dx, dz);
    }

    config.prevX = x;
    config.prevZ = z;
    mesh.position.set(x, 0, z);

    if (isFallback) {
      animateFallbackFigure(mesh, time);
    }
  });

  composer.render();
}

animate();

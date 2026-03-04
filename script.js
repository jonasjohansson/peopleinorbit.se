import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import * as SkeletonUtils from "three/addons/utils/SkeletonUtils.js";

// --- Scene setup ---
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050505);

const camera = new THREE.OrthographicCamera();
const renderer = new THREE.WebGLRenderer({
  canvas: document.getElementById("orb-canvas"),
  antialias: true,
});
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;

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
}

// Top-down camera
camera.position.set(0, 30, 0);
camera.lookAt(0, 0, 0);
resize();
window.addEventListener("resize", resize);

// --- Lighting ---
// Strong ambient so everything is visible from above
const ambientLight = new THREE.AmbientLight(0xffffff, 3);
scene.add(ambientLight);

// Directional from above
const topLight = new THREE.DirectionalLight(0xffffff, 4);
topLight.position.set(0, 30, 0);
scene.add(topLight);

// Fill light from slight angle
const fillLight = new THREE.DirectionalLight(0xc8a0a0, 2);
fillLight.position.set(5, 20, 5);
scene.add(fillLight);

// Colored accent lights
const rimLight1 = new THREE.PointLight(0xc85050, 3, 30);
rimLight1.position.set(6, 5, 6);
scene.add(rimLight1);

const rimLight2 = new THREE.PointLight(0xc85050, 2, 30);
rimLight2.position.set(-6, 5, -6);
scene.add(rimLight2);

// --- Central orb ---
function createOrb() {
  const group = new THREE.Group();

  // Main orb sphere — brighter
  const orbGeo = new THREE.SphereGeometry(1.5, 64, 64);
  const orbMat = new THREE.MeshStandardMaterial({
    color: 0x2a0a0a,
    emissive: 0xc85050,
    emissiveIntensity: 0.5,
    roughness: 0.6,
    metalness: 0.3,
    transparent: true,
    opacity: 0.8,
  });
  const orb = new THREE.Mesh(orbGeo, orbMat);
  orb.position.y = -0.3;
  group.add(orb);

  // Glow ring — brighter
  const ringGeo = new THREE.RingGeometry(1.6, 1.7, 128);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xc85050,
    transparent: true,
    opacity: 0.4,
    side: THREE.DoubleSide,
  });
  const ring = new THREE.Mesh(ringGeo, ringMat);
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.01;
  group.add(ring);

  // Outer glow disc — much more visible
  const glowGeo = new THREE.CircleGeometry(5, 64);
  const glowMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: {
      uColor: { value: new THREE.Color(0xc85050) },
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
        float alpha = smoothstep(0.5, 0.1, d) * 0.2;
        gl_FragColor = vec4(uColor, alpha);
      }
    `,
  });
  const glow = new THREE.Mesh(glowGeo, glowMat);
  glow.rotation.x = -Math.PI / 2;
  glow.position.y = -0.02;
  group.add(glow);

  return { group, orb, ring };
}

const orbObj = createOrb();
scene.add(orbObj.group);

// --- Figure config ---
const NUM_FIGURES = 7;
const GLB_PATH = "assets/swimmer-opt.glb";

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

function createFallbackFigure(config) {
  const group = new THREE.Group();

  const mat = new THREE.MeshStandardMaterial({
    color: 0xe8e4e0,
    emissive: 0xe8e4e0,
    emissiveIntensity: 0.3,
    roughness: 0.7,
    transparent: true,
    opacity: config.opacity,
  });

  // Body
  const bodyGeo = new THREE.CapsuleGeometry(0.12, 0.7, 4, 8);
  const body = new THREE.Mesh(bodyGeo, mat);
  body.rotation.x = Math.PI / 2;
  group.add(body);

  // Head
  const headGeo = new THREE.SphereGeometry(0.15, 8, 8);
  const head = new THREE.Mesh(headGeo, mat);
  head.position.z = -0.55;
  group.add(head);

  // Arms
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

  // Legs
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

    // Measure the model to determine correct scale
    const box = new THREE.Box3().setFromObject(model);
    const size = new THREE.Vector3();
    box.getSize(size);
    const modelHeight = size.y;
    // We want each figure to be about 1.5 units tall in our scene
    const targetHeight = 1.5;
    const baseScale = targetHeight / modelHeight;

    console.log(
      `Model loaded: ${size.x.toFixed(1)} x ${size.y.toFixed(1)} x ${size.z.toFixed(1)}, scale factor: ${baseScale.toFixed(4)}`
    );

    figureConfigs.forEach((config) => {
      const clone = SkeletonUtils.clone(model);
      const s = baseScale * (0.8 + Math.random() * 0.4);
      clone.scale.setScalar(s);

      // Override materials for visibility
      clone.traverse((child) => {
        if (child.isMesh) {
          child.material = new THREE.MeshStandardMaterial({
            color: 0xe8e4e0,
            emissive: 0xc8a0a0,
            emissiveIntensity: 0.2,
            roughness: 0.7,
            transparent: true,
            opacity: config.opacity,
          });
          child.castShadow = false;
          child.receiveShadow = false;
        }
      });

      // Wrapper group for orbit positioning/rotation
      // pivot flips the model face-down, clone stays unrotated so animation works
      const pivot = new THREE.Group();
      pivot.rotation.x = -Math.PI / 2; // lay flat
      pivot.rotation.z = Math.PI;       // flip face-down (stomach toward camera)
      pivot.add(clone);

      const wrapper = new THREE.Group();
      wrapper.add(pivot);

      scene.add(wrapper);
      figures.push({ mesh: wrapper, inner: clone, config, isFallback: false });

      // Animation mixer — must reference the clone, not wrapper
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
      console.log(
        `Loading model: ${((progress.loaded / progress.total) * 100).toFixed(0)}%`
      );
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

  // Update animation mixers
  mixers.forEach((m) => m.update(delta));

  // Orb pulse
  const pulse = 1 + Math.sin(time * 0.5) * 0.04;
  orbObj.orb.scale.setScalar(pulse);
  orbObj.ring.material.opacity = 0.3 + Math.sin(time * 0.8) * 0.1;

  // Move figures in orbits
  figures.forEach(({ mesh, config, isFallback }) => {
    config.angle += config.speed * delta;

    const wobble =
      Math.sin(time * config.wobbleFreq + config.wobblePhase) *
      config.wobbleAmp;
    const r = config.radius + wobble;

    const x = Math.cos(config.angle) * r;
    const z = Math.sin(config.angle) * r;

    mesh.position.set(x, 0, z);

    // Rotate to face movement direction (around Y axis for top-down)
    const tangentAngle =
      config.angle + (config.speed > 0 ? Math.PI / 2 : -Math.PI / 2);

    if (isFallback) {
      mesh.rotation.y = tangentAngle;
      animateFallbackFigure(mesh, time);
    } else {
      // Wrapper group rotates around Y for heading direction
      mesh.rotation.y = tangentAngle;
    }
  });

  renderer.render(scene, camera);
}

animate();

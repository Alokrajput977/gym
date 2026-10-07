import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';

/*
 * Sky, sun, hemisphere light, fog, stars + day/night switch.
 *
 * LIGHTWEIGHT VERSION (dikhne mein same):
 *  - Sky ka atmospheric shader pehle HAR FRAME screen ke bade hisse par chalta tha.
 *    Ab sky sirf EK BAAR ek cube texture mein bake hoti hai (HDR, half-float),
 *    aur wahi texture background banta hai – per frame sirf ek texture lookup.
 *  - Reflections ka environment map usi baked cube se banta hai.
 *  - PMREM generator aur sky shader kaam ke baad turant free (GPU memory bachti hai).
 *  - Stars ek hi draw call (Points) – sirf raat mein visible.
 */

const SKY_SIZE = 512; // har cube face ka size – smooth gradient ke liye kaafi

export function createEnvironment(scene, renderer) {
  // ---- 1. Sky ek baar bake ----
  const sky = new Sky();
  sky.scale.setScalar(4500);
  const u = sky.material.uniforms;
  u.turbidity.value = 5.5;
  u.rayleigh.value = 1.4;
  u.mieCoefficient.value = 0.005;
  u.mieDirectionalG.value = 0.8;

  // Sun south-east se – main (south) gate par seedhi dhoop
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - 38),
    THREE.MathUtils.degToRad(35),
  );
  u.sunPosition.value.copy(sunDir);

  const skyScene = new THREE.Scene();
  skyScene.add(sky);
  const cubeRT = new THREE.WebGLCubeRenderTarget(SKY_SIZE, {
    type: THREE.HalfFloatType, // HDR – bright sky clip nahi hoti
    generateMipmaps: true,
    minFilter: THREE.LinearMipmapLinearFilter,
  });
  const cubeCam = new THREE.CubeCamera(1, 10000, cubeRT);
  cubeCam.update(renderer, skyScene);

  // Reflections (metal / glass) ke liye environment map – baked cube se
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envRT = pmrem.fromCubemap(cubeRT.texture);
  pmrem.dispose(); // generator ka kaam khatam – memory free

  // Sky shader ab kabhi render nahi hoga – free
  skyScene.remove(sky);
  sky.geometry.dispose();
  sky.material.dispose();

  const dayBg = cubeRT.texture;
  scene.background = dayBg;
  scene.environment = envRT.texture;

  // ---- 2. Lights ----
  const hemi = new THREE.HemisphereLight('#d8e9ff', '#5b4a33', 0.55);
  scene.add(hemi);

  const sun = new THREE.DirectionalLight('#fff0d8', 3.1);
  sun.position.copy(sunDir).multiplyScalar(170);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); // chhoti building – 2048 mein bhi pehle se zyada sharp
  const sc = sun.shadow.camera;
  sc.left = -34;
  sc.right = 34;
  sc.top = 34;
  sc.bottom = -34;
  sc.near = 10;
  sc.far = 360;
  sun.shadow.bias = -0.0003;
  sun.shadow.normalBias = 0.02;
  scene.add(sun, sun.target);

  scene.fog = new THREE.Fog('#c9d7e3', 200, 900);

  // ---- 3. Stars (raat) ----
  const N = 1800;
  const pos = new Float32Array(N * 3);
  const v = new THREE.Vector3();
  for (let i = 0; i < N; i++) {
    v.setFromSphericalCoords(1200, Math.acos(Math.random() * 0.95), Math.random() * Math.PI * 2);
    pos[i * 3] = v.x;
    pos[i * 3 + 1] = v.y;
    pos[i * 3 + 2] = v.z;
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const stars = new THREE.Points(
    starGeo,
    new THREE.PointsMaterial({ color: '#dfe8ff', size: 1.6, sizeAttenuation: false, fog: false }),
  );
  stars.visible = false;
  stars.frustumCulled = false;
  scene.add(stars);

  const nightBg = new THREE.Color('#081120');

  function setNight(night) {
    stars.visible = night;
    scene.background = night ? nightBg : dayBg;
    scene.environmentIntensity = night ? 0.06 : 1.0;
    hemi.intensity = night ? 0.12 : 0.55;
    hemi.color.set(night ? '#5a6f9e' : '#d8e9ff');
    sun.intensity = night ? 0.35 : 3.1;
    sun.color.set(night ? '#9db6ff' : '#fff0d8');
    scene.fog.color.set(night ? '#081120' : '#c9d7e3');
    scene.fog.near = night ? 60 : 200;
    scene.fog.far = night ? 480 : 900;
    renderer.toneMappingExposure = night ? 1.15 : 0.9;
  }

  function dispose() {
    cubeRT.dispose();
    envRT.dispose();
    starGeo.dispose();
    stars.material.dispose();
  }

  setNight(false);
  return { sun, hemi, setNight, dispose };
}

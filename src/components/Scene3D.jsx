import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { CSS2DRenderer, CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';
import { getTextures, disposeTextures } from '../three/textures.js';
import { createEnvironment } from '../three/environment.js';
import { buildWarehouse } from '../three/buildWarehouse.js';
import { getView } from '../three/cameraViews.js';
import { CORNERS, PODIUM_H, EAVE_H, rightXAt, frontZAt } from '../three/plan.js';
import './Scene3D.css';

/*
 * LIGHTWEIGHT RENDERING
 *  - On-demand render: kuch na hile to frame render nahi hota.
 *  - Shadow cache: shadow sirf scene badalne par dobara banti hai.
 *  - Building picking: ek bounding box se (hazaron meshes nahi).
 *  - Camera hilte waqt thoda kam pixel ratio, rukte hi full quality.
 */

const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

export default function Scene3D({ view, night, wallStyle, labels, interior, onBuildingClick, onReady }) {
  const mountRef = useRef(null);
  const apiRef = useRef(null);
  const interiorRef = useRef(false);
  const callbacks = useRef({ onBuildingClick, onReady });
  callbacks.current = { onBuildingClick, onReady };

  useEffect(() => {
    const mount = mountRef.current;
    const width = mount.clientWidth;
    const height = mount.clientHeight;

    const fullDPR = Math.min(window.devicePixelRatio, 1.75);
    const moveDPR = Math.min(fullDPR, 1.25);
    let curDPR = fullDPR;

    const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    renderer.setPixelRatio(curDPR);
    renderer.setSize(width, height);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.shadowMap.autoUpdate = false;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 0.9;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    mount.appendChild(renderer.domElement);

    // Pillar labels (A01..B06) – HTML overlay
    const labelRenderer = new CSS2DRenderer();
    labelRenderer.setSize(width, height);
    labelRenderer.domElement.className = 'scene3d__labels';
    mount.appendChild(labelRenderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.3, 2000);
    const start = getView('aerial');
    camera.position.copy(start.pos).multiplyScalar(1.7);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.maxPolarAngle = Math.PI / 2 - 0.04;
    controls.minDistance = 4;
    controls.maxDistance = 160;
    controls.target.copy(start.target);

    const env = createEnvironment(scene, renderer);
    const textures = getTextures(renderer.capabilities.getMaxAnisotropy());
    const world = buildWarehouse(textures);
    scene.add(world.group);

    const labelGroup = new THREE.Group();
    const tags = [];
    world.anchors.forEach((a) => {
      const el = document.createElement('div');
      el.className = `pillar-tag ${a.id.startsWith('A') ? 'pillar-tag--a' : 'pillar-tag--b'}`;
      el.textContent = a.id;
      const obj = new CSS2DObject(el);
      obj.position.copy(a.position);
      labelGroup.add(obj);
      tags.push({ el, pos: a.position, n: a.normal });
    });
    // Building ke peeche wale labels chhupao (upar se dekhne par sab dikhte hain)
    const toCam = new THREE.Vector3();
    const updateTags = () => {
      const high = camera.position.y > 30;
      tags.forEach((t) => {
        toCam.subVectors(camera.position, t.pos);
        const facing = toCam.x * t.n.x + toCam.z * t.n.z > -1;
        t.el.style.opacity = high || facing ? '1' : '0';
      });
    };
    scene.add(labelGroup);

    // ---- Render scheduling ----
    let needRender = true;
    let busyUntil = 0;
    let shadowDirty = true;
    const invalidate = (ms = 0) => {
      needRender = true;
      if (ms) busyUntil = Math.max(busyUntil, performance.now() + ms);
    };
    const dirtyShadows = () => {
      shadowDirty = true;
      invalidate();
    };

    // ---- Walk mode (andar): scroll / W A S D / Q E ----
    const walk = { vel: new THREE.Vector3(), keys: new Set() };
    const fwd = new THREE.Vector3();
    const right = new THREE.Vector3();
    const onWheel = (e) => {
      if (!interiorRef.current) return;
      e.preventDefault();
      camera.getWorldDirection(fwd);
      walk.vel.addScaledVector(fwd, -e.deltaY * 0.03);
      if (walk.vel.length() > 12) walk.vel.setLength(12);
      fly.active = false;
      invalidate();
    };
    const WALK_KEYS = ['w', 'a', 's', 'd', 'q', 'e', 'arrowup', 'arrowdown', 'arrowleft', 'arrowright'];
    const onKey = (e) => {
      if (e.target && /input|textarea/i.test(e.target.tagName)) return;
      const k = e.key.toLowerCase();
      if (!WALK_KEYS.includes(k)) return;
      if (e.type === 'keydown') walk.keys.add(k);
      else walk.keys.delete(k);
      invalidate();
    };
    const clearKeys = () => walk.keys.clear();
    renderer.domElement.addEventListener('wheel', onWheel, { passive: false });
    window.addEventListener('keydown', onKey);
    window.addEventListener('keyup', onKey);
    window.addEventListener('blur', clearKeys);

    // ---- Camera fly-to ----
    const fly = { active: false, t: 0, dur: 1.6, fromPos: new THREE.Vector3(), toPos: new THREE.Vector3(), fromTgt: new THREE.Vector3(), toTgt: new THREE.Vector3() };
    const startFly = (id, dur) => {
      const v = getView(id);
      fly.fromPos.copy(camera.position);
      fly.fromTgt.copy(controls.target);
      fly.toPos.copy(v.pos);
      fly.toTgt.copy(v.target);
      fly.t = 0;
      fly.dur = dur;
      fly.active = true;
      walk.vel.set(0, 0, 0);
      invalidate();
    };

    // ---- Gate sequence: ruk -> gate khule -> andar/bahar -> gate band ----
    // step: { fly: viewId, dur, door } ya { wait: true, door } (door = 1 khula, null = auto)
    let seq = [];
    let doorForce = null;
    const isInside = (p) =>
      p.y < PODIUM_H + EAVE_H &&
      p.z > CORNERS.A01.z && p.z < frontZAt(p.x) &&
      p.x > CORNERS.A01.x && p.x < rightXAt(p.z);
    const nextStep = () => {
      const st = seq.shift();
      if (!st) {
        doorForce = null;
        return;
      }
      doorForce = st.door ?? null;
      if (st.fly) startFly(st.fly, st.dur);
      else seq.unshift({ ...st, waiting: true });
    };
    const flyTo = (id, dur = 1.6) => {
      const camIn = isInside(camera.position);
      const goIn = id.startsWith('in:');
      if (goIn && !camIn) {
        // ANDAR JAANA: darwaze ke saamne ruko, gate khule, phir andar
        seq = [
          { fly: 'door:out', dur: 1.9, door: null },
          { wait: true, door: 1 },
          { fly: 'door:in', dur: 1.7, door: 1 },
          { fly: id, dur: 1.2, door: null }, // andar pahunch kar gate peeche band
        ];
      } else if (!goIn && camIn) {
        // BAHAR JAANA: gate ki taraf mudo, khule, bahar niklo, mud kar band hota dekho
        seq = [
          { fly: 'door:look-out', dur: 1.4, door: 1 },
          { wait: true, door: 1 },
          { fly: 'door:exit', dur: 1.6, door: 1 },
          { fly: 'door:turn', dur: 1.6, door: null },
          { fly: id, dur: 1.6, door: null },
        ];
      } else {
        seq = [{ fly: id, dur, door: null }];
      }
      nextStep();
    };
    controls.addEventListener('start', () => {
      fly.active = false;
      seq = [];
      doorForce = null;
    });
    controls.addEventListener('change', () => invalidate());
    flyTo('aerial', 2.4);

    // ---- Building click = andar jao ----
    const raycaster = new THREE.Raycaster();
    const pointer = new THREE.Vector2();
    const box = new THREE.Box3().setFromObject(world.building);
    const hit = new THREE.Vector3();
    const overBuilding = (e) => {
      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      raycaster.setFromCamera(pointer, camera);
      return !!raycaster.ray.intersectBox(box, hit);
    };
    let downAt = null;
    const onDown = (e) => {
      downAt = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e) => {
      if (!downAt) return;
      const moved = Math.hypot(e.clientX - downAt.x, e.clientY - downAt.y);
      downAt = null;
      if (moved > 5 || interiorRef.current) return;
      if (overBuilding(e)) callbacks.current.onBuildingClick?.();
    };
    let lastHover = 0;
    const onMove = (e) => {
      if (e.buttons) return;
      if (interiorRef.current) {
        renderer.domElement.style.cursor = '';
        return;
      }
      const now = performance.now();
      if (now - lastHover < 60) return;
      lastHover = now;
      renderer.domElement.style.cursor = overBuilding(e) ? 'pointer' : '';
    };
    renderer.domElement.addEventListener('pointerdown', onDown);
    renderer.domElement.addEventListener('pointerup', onUp);
    renderer.domElement.addEventListener('pointermove', onMove);

    // ---- Resize ----
    const ro = new ResizeObserver(() => {
      const w = mount.clientWidth;
      const h = mount.clientHeight;
      if (!w || !h) return;
      renderer.setSize(w, h);
      labelRenderer.setSize(w, h);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      invalidate();
    });
    ro.observe(mount);

    // ---- Andar camera ki seema (trapezoid ke andar) ----
    const M = 0.9;
    const clampInside = (p, yMax) => {
      p.z = THREE.MathUtils.clamp(p.z, CORNERS.A01.z + M, frontZAt(p.x) - M);
      p.x = THREE.MathUtils.clamp(p.x, CORNERS.A01.x + M, rightXAt(p.z) - M);
      p.y = THREE.MathUtils.clamp(p.y, PODIUM_H + 0.8, PODIUM_H + yMax);
    };

    // ---- Loop ----
    const clock = new THREE.Clock();
    let firstFrame = true;
    let lastMoveTime = 0;
    renderer.setAnimationLoop(() => {
      const dt = Math.min(clock.getDelta(), 0.1);
      const now = performance.now();

      // Sequence ka "wait" step – gate poora khulne tak ruko
      if (!fly.active && seq.length && seq[0].waiting) {
        needRender = true;
        if (world.doorOpen() > 0.985) {
          seq.shift();
          nextStep();
        }
      }

      if (fly.active) {
        fly.t = Math.min(1, fly.t + dt / fly.dur);
        const k = easeInOut(fly.t);
        camera.position.lerpVectors(fly.fromPos, fly.toPos, k);
        controls.target.lerpVectors(fly.fromTgt, fly.toTgt, k);
        if (fly.t >= 1) {
          fly.active = false;
          if (seq.length) nextStep();
          else if (interiorRef.current && isInside(camera.position)) {
            // target paas – drag = jagah par 360° ghoomna
            fwd.subVectors(fly.toTgt, fly.toPos).normalize();
            controls.target.copy(camera.position).addScaledVector(fwd, 1.2);
          }
        }
        needRender = true;
      }

      let walking = false;
      if (interiorRef.current) {
        const k = walk.keys;
        const f = (k.has('w') || k.has('arrowup') ? 1 : 0) - (k.has('s') || k.has('arrowdown') ? 1 : 0);
        const r = (k.has('d') || k.has('arrowright') ? 1 : 0) - (k.has('a') || k.has('arrowleft') ? 1 : 0);
        const u = (k.has('e') ? 1 : 0) - (k.has('q') ? 1 : 0);
        if (f || r || u) {
          fly.active = false;
          camera.getWorldDirection(fwd);
          fwd.y = 0;
          fwd.normalize();
          right.crossVectors(fwd, camera.up).normalize();
          const acc = 24 * dt;
          walk.vel.addScaledVector(fwd, f * acc).addScaledVector(right, r * acc);
          walk.vel.y += u * acc;
          if (walk.vel.length() > 5) walk.vel.setLength(5);
        }
        if (walk.vel.lengthSq() > 1e-5) {
          const step = walk.vel.clone().multiplyScalar(dt);
          camera.position.add(step);
          controls.target.add(step);
          walk.vel.multiplyScalar(Math.exp(-dt * 4.5));
          walking = true;
        } else walk.vel.set(0, 0, 0);
      } else walk.vel.set(0, 0, 0);

      const moved = controls.update();

      if (interiorRef.current && !fly.active && !seq.length) {
        clampInside(camera.position, EAVE_H + 2);
        clampInside(controls.target, EAVE_H + 3);
      }

      const interacting = moved || fly.active || walking;
      if (interacting) {
        lastMoveTime = now;
        if (curDPR !== moveDPR) {
          curDPR = moveDPR;
          renderer.setPixelRatio(curDPR);
        }
      } else if (curDPR !== fullDPR && now - lastMoveTime > 220) {
        curDPR = fullDPR;
        renderer.setPixelRatio(curDPR);
        needRender = true;
      }

      // Entrance ke automatic darwaze (camera paas = khule)
      const doorsMoving = world.updateDoors(dt, camera.position, doorForce);
      if (doorsMoving) shadowDirty = true;

      if (!(needRender || interacting || doorsMoving || now < busyUntil)) return;
      needRender = false;

      if (shadowDirty) {
        renderer.shadowMap.needsUpdate = true;
        shadowDirty = false;
      }
      renderer.render(scene, camera);
      if (labelGroup.visible) {
        updateTags();
        labelRenderer.render(scene, camera);
      }
      if (firstFrame) {
        firstFrame = false;
        callbacks.current.onReady?.();
      }
    });

    apiRef.current = { world, env, flyTo, controls, scene, invalidate, dirtyShadows, labelGroup, labelRenderer };

    return () => {
      renderer.setAnimationLoop(null);
      ro.disconnect();
      renderer.domElement.removeEventListener('pointerdown', onDown);
      renderer.domElement.removeEventListener('pointerup', onUp);
      renderer.domElement.removeEventListener('pointermove', onMove);
      renderer.domElement.removeEventListener('wheel', onWheel);
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('keyup', onKey);
      window.removeEventListener('blur', clearKeys);
      controls.dispose();
      world.dispose();
      env.dispose();
      disposeTextures();
      renderer.dispose();
      mount.removeChild(renderer.domElement);
      mount.removeChild(labelRenderer.domElement);
      apiRef.current = null;
    };
  }, []);

  // ---------- Props -> scene ----------
  useEffect(() => {
    if (view && view.nonce > 0) apiRef.current?.flyTo(view.id);
  }, [view]);

  const applyLighting = () => {
    const api = apiRef.current;
    if (!api) return;
    api.env.setNight(night);
    if (interior) {
      api.scene.environmentIntensity *= 0.4;
      api.env.hemi.intensity *= 0.45;
    }
    api.invalidate();
  };

  useEffect(() => {
    applyLighting();
    apiRef.current?.world.setNight(night);
  }, [night]);

  useEffect(() => {
    apiRef.current?.world.setWallStyle(wallStyle);
    apiRef.current?.invalidate();
  }, [wallStyle]);

  useEffect(() => {
    const api = apiRef.current;
    if (!api) return;
    api.labelGroup.visible = labels && !interior;
    api.labelRenderer.domElement.style.display = labels && !interior ? '' : 'none';
    api.invalidate();
  }, [labels, interior]);

  useEffect(() => {
    interiorRef.current = interior;
    const api = apiRef.current;
    if (!api) return;
    api.world.setInterior(interior);
    applyLighting();
    api.dirtyShadows();
    const c = api.controls;
    if (interior) {
      c.enableZoom = false;
      c.minDistance = 0.3;
      c.maxDistance = 30;
      c.minPolarAngle = 0.05;
      c.maxPolarAngle = Math.PI - 0.05;
      c.rotateSpeed = 0.55;
    } else {
      c.enableZoom = true;
      c.minDistance = 4;
      c.maxDistance = 160;
      c.minPolarAngle = 0;
      c.maxPolarAngle = Math.PI / 2 - 0.04;
      c.rotateSpeed = 1;
    }
  }, [interior]);

  return <div className="scene3d" ref={mountRef} aria-label="3D model of the Gymnastics Academy warehouse" role="img" />;
}
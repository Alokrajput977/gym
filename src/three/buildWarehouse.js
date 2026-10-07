import * as THREE from 'three';
import { createMaterials } from './materials.js';
import { mergeStatic, offsetPolygon, polygonPlane } from './helpers.js';
import { PIT, FOOTPRINT, SIDES, PODIUM_H as PH, WALL_T, FLOOR_H as F, STAIR } from './plan.js';
import { buildShell } from './builders/shell.js';
import { buildStructure } from './builders/structure.js';
import { buildStairs } from './builders/stairs.js';
import { buildSite } from './builders/site.js';
import { buildMurals } from './builders/murals.js';
import { buildGym } from './builders/gym.js';
import { buildMezzanine, MEZZ } from './builders/mezzanine.js';

/**
 * Poori scene: site + warehouse building. Andar: spring floor, 5 ft pit, reception, equipment, murals.
 * Lights: sirf zaroorat par visible (andar 2, raat ko 2) – halka rehta hai.
 */
export function buildWarehouse(textures) {
  const mats = createMaterials(textures);
  const own = [];

  const root = new THREE.Group();
  root.name = 'world';
  const site = buildSite(mats);
  mergeStatic(site, own); // sadak, kerb, hedge, seedhiyan – kam draw calls (look same)
  root.add(site);

  // Building – y = 0 = podium ka top (floor level)
  const building = new THREE.Group();
  building.name = 'warehouse';
  building.position.y = PH;
  root.add(building);

  const shell = buildShell(mats, own);
  const structure = buildStructure(mats);
  const stairs = buildStairs(mats);
  const mezz = buildMezzanine(mats, own); // 12 ft mezzanine: 2 rooms + balcony (upar bahar wali seedhi se)
  building.add(shell, structure, stairs, mezz);

  // Andar ka floor (khaali – redesign ke liye)
  const inner = offsetPolygon(FOOTPRINT, -WALL_T);
  const floor = new THREE.Mesh(polygonPlane(inner, 2, [PIT]), mats.floor);
  floor.position.y = 0.012;
  floor.receiveShadow = true;
  floor.userData.noMerge = true;
  building.add(floor);

  // Draw calls kam karo (look same)
  [shell, structure, stairs, mezz].forEach((grp) => mergeStatic(grp, own));

  /* ---------- Lights (on-demand visible) ---------- */
  const inside = new THREE.Group();
  // Hall ki ek badi light (pehle 2 thi) – halka
  const hallLight = new THREE.PointLight('#fff3e0', 210, 48, 2);
  hallLight.position.set(-1, 8, -3);
  inside.add(hallLight);
  // Mezzanine rooms + balcony
  {
    const mp = SIDES.front.at((MEZZ.s0 + 21.5) / 2, -MEZZ.roomDepth);
    const l = new THREE.PointLight('#fff1dc', 45, 16, 2);
    l.position.set(mp.x, F + 2.6, mp.z);
    inside.add(l);
  }
  inside.visible = false;
  building.add(inside);

  const night = new THREE.Group();
  const fp = SIDES.front.at(SIDES.front.len / 2, 2.2);
  const entry = new THREE.PointLight('#ffd9a0', 60, 22, 2);
  entry.position.set(fp.x, 3.0, fp.z);
  const sp = SIDES[STAIR.side].at(STAIR.doorS, 1.4);
  const stairLight = new THREE.PointLight('#ffd9a0', 35, 16, 2);
  stairLight.position.set(sp.x, F + 2.5, sp.z);
  night.add(entry, stairLight);
  night.visible = false;
  building.add(night);

  /* ---------- API ---------- */
  const glowMats = [shell.userData.bannerMat, shell.userData.letterMat];

  function setNight(on) {
    mats.lamp.emissiveIntensity = on ? 4 : 0.05;
    glowMats.forEach((m) => {
      m.emissiveIntensity = on ? 0.55 : 0;
    });
    night.visible = on;
  }

  let murals = null;
  /** Andar ka hissa (murals + gym) – ek hi baar banta hai, chhupa hua. */
  function prepareInterior() {
    if (!murals) {
      // Gymnastics murals – pehli baar andar jaane par hi bante hain
      murals = buildMurals(mats, own);
      const gym = buildGym(mats, own); // spring floor, pit, reception, equipment
      murals.add(gym);
      mergeStatic(murals, own);
      building.add(murals);
      murals.visible = false;
    }
  }

  function setInterior(on) {
    if (on) prepareInterior();
    if (murals) murals.visible = on;
    inside.visible = on;
  }

  function setWallStyle(style) {
    mats.setWallStyle(style);
  }

  function dispose() {
    root.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
    });
    own.forEach((m) => {
      if (m.map) m.map.dispose();
      m.dispose();
    });
    mats.dispose();
  }

  const anchors = structure.userData.anchors.map((a) => ({
    id: a.id,
    position: a.position.clone().add(new THREE.Vector3(0, PH, 0)),
    normal: a.normal,
  }));

  /* ---------- Automatic entrance doors ---------- */
  const doors = shell.userData.doors;
  const doorWorld = new THREE.Vector3(doors.center.x, PH + 1.2, doors.center.z);
  const fn = SIDES.front.n;
  /**
   * Darwaze ka control. force = 1 (khula rakho) / 0 / null (automatic sensor).
   * Automatic: camera BAHAR ho aur paas ho to khule, warna band.
   * Return: abhi hil raha hai?
   */
  function updateDoors(dt, camPos, force = null) {
    const dx = camPos.x - doorWorld.x;
    const dz = camPos.z - doorWorld.z;
    const outside = dx * fn.x + dz * fn.z > 0.3;
    const near = outside && Math.hypot(dx, dz) < 7.5 && camPos.y < PH + 6;
    doors.target = force ?? (near ? 1 : 0);
    const diff = doors.target - doors.t;
    if (Math.abs(diff) < 0.001) return false;
    // ~1.2 s mein poora khulta/band hota hai (smoothstep easing shell.js mein)
    const step = Math.sign(diff) * Math.min(Math.abs(diff), dt / 1.2);
    doors.set(doors.t + step);
    return true;
  }
  const doorOpen = () => doors.t;

  /** Shader compile ke liye: andar ki cheezein + lights thodi der visible (screen par kuch nahi dikhta). */
  function withInteriorVisible(fn) {
    prepareInterior();
    const a = murals.visible;
    const b = inside.visible;
    murals.visible = true;
    inside.visible = true;
    try {
      return fn(murals);
    } finally {
      murals.visible = a;
      inside.visible = b;
    }
  }

  return { group: root, building, anchors, setNight, setInterior, setWallStyle, updateDoors, doorOpen, prepareInterior, withInteriorVisible, dispose };
}
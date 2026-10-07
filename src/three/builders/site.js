import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { FOOTPRINT, SIDES, PODIUM_H as PH, PODIUM_MARGIN, ENTRANCE, PIT } from '../plan.js';
import { offsetPolygon, polygonPlane, sideBox } from '../helpers.js';

/*
 * Site: sirf zameen (grass), building ka plinth (podium), entrance ki seedhiyan
 * aur saamne paved forecourt. Koi boundary wall / parking nahi.
 * World coordinates (y = 0 zameen).
 */
export function buildSite(mats) {
  const g = new THREE.Group();
  g.name = 'site';

  // Grass
  // Grass – pit ki jagah chhed (pit zameen se neeche jaata hai)
  const sq = [{ x: -200, z: -200 }, { x: -200, z: 200 }, { x: 200, z: 200 }, { x: 200, z: -200 }];
  const grass = polygonPlane(sq, 4, [PIT]);
  const ground = new THREE.Mesh(grass, mats.grass);
  ground.receiveShadow = true;
  ground.userData.noMerge = true;
  g.add(ground);

  // Podium (plinth) – footprint ke chaaron taraf PODIUM_MARGIN
  const ring = offsetPolygon(FOOTPRINT, PODIUM_MARGIN);
  const shape = new THREE.Shape(ring.map((p) => new THREE.Vector2(p.x, -p.z)));
  shape.holes.push(new THREE.Path(PIT.map((p) => new THREE.Vector2(p.x, -p.z)))); // pit ka chhed
  const podGeo = new THREE.ExtrudeGeometry(shape, { depth: PH, bevelEnabled: false });
  podGeo.rotateX(-Math.PI / 2);
  const podium = new THREE.Mesh(podGeo, [mats.concrete, mats.stone]);
  podium.castShadow = true;
  podium.receiveShadow = true;
  g.add(podium);

  // Forecourt (saamne paved area) + path
  const front = SIDES.front;
  const c = front.len / 2;
  const fc = [front.at(c - 10, PODIUM_MARGIN), front.at(c + 10, PODIUM_MARGIN), front.at(c + 10, PODIUM_MARGIN + 9), front.at(c - 10, PODIUM_MARGIN + 9)];
  const court = new THREE.Mesh(polygonPlane(fc, 1), mats.paver);
  court.position.y = 0.02;
  court.receiveShadow = true;
  g.add(court);
  const path = [front.at(c - 2.5, PODIUM_MARGIN + 9), front.at(c + 2.5, PODIUM_MARGIN + 9), front.at(c + 2.5, 60), front.at(c - 2.5, 60)];
  const pm = new THREE.Mesh(polygonPlane(path, 1), mats.paver);
  pm.position.y = 0.02;
  pm.receiveShadow = true;
  g.add(pm);

  /* ---------- Landscaping: sadak ke dono taraf ped, lamp posts, lawn edging ---------- */
  {
    const trees = [];
    // path ke dono taraf (offset front se bahar)
    for (let off = PODIUM_MARGIN + 11; off <= 56; off += 5.5) {
      [-1, 1].forEach((k) => trees.push(front.at(c + k * 5.2, off)));
    }
    // forecourt ke kono par + building ke side mein
    [[-12, PODIUM_MARGIN + 3], [-12, PODIUM_MARGIN + 8], [12 + 22, PODIUM_MARGIN + 3]].forEach(([ds, off]) => trees.push(front.at(c + ds, off)));
    [0.15, 0.45, 0.75].forEach((t) => {
      trees.push(SIDES.left.at(SIDES.left.len * t, PODIUM_MARGIN + 3.5));
      trees.push(SIDES.right.at(SIDES.right.len * t, PODIUM_MARGIN + 3.5));
    });

    let seed = 7;
    const rnd = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
    const trunkGeo = new THREE.CylinderGeometry(0.13, 0.22, 2.6, 7).translate(0, 1.3, 0);
    const crownGeo = new THREE.IcosahedronGeometry(1, 1);
    const trunks = new THREE.InstancedMesh(trunkGeo, mats.bark, trees.length);
    const crowns = new THREE.InstancedMesh(crownGeo, mats.leaves, trees.length * 4);
    const d = new THREE.Object3D();
    const col = new THREE.Color();
    const greens = ['#3f6b2a', '#4d7a33', '#355c24', '#5a8a3a'];
    trees.forEach((p, i) => {
      const sc = 0.9 + rnd() * 0.45;
      d.position.set(p.x, 0, p.z);
      d.rotation.set(0, rnd() * 6.28, 0);
      d.scale.setScalar(sc);
      d.updateMatrix();
      trunks.setMatrixAt(i, d.matrix);
      for (let k = 0; k < 4; k++) {
        const r = (1.0 + rnd() * 0.6) * sc;
        d.position.set(p.x + (rnd() - 0.5) * 1.6 * sc, (2.8 + rnd() * 1.4) * sc, p.z + (rnd() - 0.5) * 1.6 * sc);
        d.rotation.set(rnd() * 3, rnd() * 3, rnd() * 3);
        d.scale.set(r, r * (0.8 + rnd() * 0.3), r);
        d.updateMatrix();
        crowns.setMatrixAt(i * 4 + k, d.matrix);
        crowns.setColorAt(i * 4 + k, col.set(greens[Math.floor(rnd() * greens.length)]));
      }
    });
    crowns.instanceColor.needsUpdate = true;
    trunks.castShadow = crowns.castShadow = true;
    trunks.receiveShadow = crowns.receiveShadow = true;
    trunks.userData.noMerge = crowns.userData.noMerge = true;
    g.add(trunks, crowns);

    // Lamp posts – path ke dono taraf, ped ke beech mein
    const poles = [];
    const heads = [];
    for (let off = PODIUM_MARGIN + 13.7; off <= 56; off += 11) {
      [-1, 1].forEach((k) => {
        const p = front.at(c + k * 3.3, off);
        poles.push(new THREE.CylinderGeometry(0.05, 0.08, 4, 8).translate(p.x, 2, p.z));
        heads.push(new THREE.SphereGeometry(0.2, 12, 8).translate(p.x, 4.1, p.z));
      });
    }
    const pm2 = new THREE.Mesh(mergeGeometries(poles), mats.frame);
    pm2.castShadow = true;
    const hm = new THREE.Mesh(mergeGeometries(heads), mats.lamp);
    pm2.userData.noMerge = hm.userData.noMerge = true;
    g.add(pm2, hm);

    // Path ke kinare kerb + hedge
    [-1, 1].forEach((k) => {
      const s0 = c + k * 2.65;
      sideBox(g, front, s0 - 0.12, s0 + 0.12, 0, 0.12, 60 - PODIUM_MARGIN - 9, mats.concrete, (60 + PODIUM_MARGIN + 9) / 2);
      sideBox(g, front, c + k * 3.9 - 0.35, c + k * 3.9 + 0.35, 0, 0.55, 60 - PODIUM_MARGIN - 12, mats.hedge, (60 + PODIUM_MARGIN + 12) / 2);
    });

    // AC outdoor units – building ke peeche (podium par)
    [0.2, 0.32, 0.44].forEach((t) => {
      const s = SIDES.back.len * t;
      sideBox(g, SIDES.back, s - 0.55, s + 0.55, PH, PH + 1.1, 0.5, mats.steel, 1.0);
      sideBox(g, SIDES.back, s - 0.42, s + 0.42, PH + 0.15, PH + 0.95, 0.02, mats.frame, 1.26);
    });
  }

  // Entrance steps (podium se zameen tak)
  const sw = ENTRANCE.doorW + 4.5;
  for (let k = 0; k < 2; k++) {
    const top = PH - (k + 1) * 0.15;
    sideBox(g, front, c - sw / 2, c + sw / 2, 0, top, 0.36, mats.concrete, PODIUM_MARGIN + 0.18 + k * 0.36);
  }
  return g;
}
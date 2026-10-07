import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  SIDES, PILLARS, FLOOR_H as F, EAVE_H as H, PILLAR_OFF, roofY, leftAt, rightAt,
} from '../plan.js';
import { mesh, rodGeo } from '../helpers.js';

const RIB_LIFT = 0.28; // rib roof se kitna upar

/** Roof surface ka point: u = 0..1 (left -> right wall), v = 0..1 (back -> front). */
function roofPoint(u, v, lift = 0) {
  const L = leftAt(v);
  const R = rightAt(v);
  return new THREE.Vector3(L.x + (R.x - L.x) * u, roofY(u) + lift, L.z + (R.z - L.z) * u);
}

/** Trapezoid ke upar curved roof (har cross-section ek parabola arch). */
function roofGeometry(u0, u1, v0, v1, nu, nv, lift = 0) {
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= nv; j++) {
    const v = v0 + ((v1 - v0) * j) / nv;
    let arc = 0;
    let prev = null;
    for (let i = 0; i <= nu; i++) {
      const u = u0 + ((u1 - u0) * i) / nu;
      const p = roofPoint(u, v, lift);
      if (prev) arc += p.distanceTo(prev);
      prev = p;
      pos.push(p.x, p.y, p.z);
      const along = leftAt(v);
      uv.push(arc, Math.hypot(along.x - leftAt(0).x, along.z - leftAt(0).z));
    }
  }
  for (let j = 0; j < nv; j++) {
    for (let i = 0; i < nu; i++) {
      const a = j * (nu + 1) + i;
      const b = a + 1;
      const c = a + nu + 1;
      const d = c + 1;
      idx.push(a, c, b, b, c, d);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

export function buildStructure(mats) {
  const g = new THREE.Group();
  g.name = 'structure';
  const { left, right } = SIDES;
  const lamps = [];
  const anchors = [];

  /* ---------- Roof ---------- */
  const lenL = left.len;
  const ov = 0.6 / lenL; // aage-peeche overhang
  const widthMid = Math.hypot(rightAt(0.5).x - leftAt(0.5).x, rightAt(0.5).z - leftAt(0.5).z);
  const ue = 0.7 / widthMid; // side overhang
  const roof = mesh(roofGeometry(-ue, 1 + ue, -ov, 1 + ov, 56, 28, 0.02), mats.roof);
  roof.userData.noMerge = true;
  g.add(roof);

  // Ridge skylight
  const sky = mesh(roofGeometry(0.465, 0.535, 0.08, 0.92, 6, 20, 0.07), mats.glass, { cast: false });
  sky.userData.noMerge = true;
  g.add(sky);

  /* ---------- Pillars (I-beam) + arch ribs ---------- */
  const flangeGeos = [];
  const baseGeos = [];
  const ribGeos = [];
  const pipeGeos = [];

  const colPos = (p) => {
    const side = p.side === 'left' ? left : right;
    const q = side.at(p.s, PILLAR_OFF);
    return { side, x: q.x, z: q.z };
  };

  const pairs = [];
  for (let i = 0; i < 6; i++) pairs.push([PILLARS[i], PILLARS[i + 6]]);

  pairs.forEach(([pa, pb]) => {
    const A = colPos(pa);
    const B = colPos(pb);
    const span = Math.hypot(B.x - A.x, B.z - A.z);
    const a = PILLAR_OFF / span;
    const ribY = (t) => roofY((t - a) / (1 - 2 * a)) + RIB_LIFT;
    const topY = ribY(0);

    // Rib (arch) – A pillar se B pillar tak
    const pts = [];
    for (let k = 0; k <= 28; k++) {
      const t = k / 28;
      pts.push(new THREE.Vector3(A.x + (B.x - A.x) * t, ribY(t), A.z + (B.z - A.z) * t));
    }
    ribGeos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 56, 0.17, 6, false));

    // Columns
    [[pa, A], [pb, B]].forEach(([p, C]) => {
      const h = topY;
      const y = 0.5 + (h - 0.5) / 2;
      const rot = C.side.rotY;
      const add = (w, hh, d, lx, ly, lz, list) => {
        const b = new THREE.BoxGeometry(w, hh, d);
        b.translate(lx, ly, lz);
        b.rotateY(rot);
        b.translate(C.x, 0, C.z);
        list.push(b);
      };
      // flanges wall ke parallel, web perpendicular
      add(0.46, h - 0.5, 0.06, 0, y, -0.2, flangeGeos);
      add(0.46, h - 0.5, 0.06, 0, y, 0.2, flangeGeos);
      add(0.05, h - 0.5, 0.36, 0, y, 0, flangeGeos);
      add(0.8, 0.5, 0.8, 0, 0.25, 0, baseGeos);
      // Downpipe
      const dp = C.side.at(p.s + 0.45, 0.12);
      pipeGeos.push(rodGeo(new THREE.Vector3(dp.x, 0, dp.z), new THREE.Vector3(dp.x, H, dp.z), 0.06, 10));
      // Pillar lamp
      const lp = C.side.at(p.s, PILLAR_OFF + 0.3);
      const lamp = mesh(new THREE.BoxGeometry(0.22, 0.3, 0.22), mats.lamp, { cast: false });
      lamp.position.set(lp.x, 4.3, lp.z);
      g.add(lamp);
      lamps.push(lamp);
      // Label anchor (A01..B06)
      anchors.push({ id: p.id, position: new THREE.Vector3(C.x, h + 0.9, C.z), normal: C.side.n });
    });
  });

  g.add(mesh(mergeGeometries(flangeGeos), mats.steel));
  g.add(mesh(mergeGeometries(baseGeos), mats.concrete));
  g.add(mesh(mergeGeometries(ribGeos), mats.steel));
  g.add(mesh(mergeGeometries(pipeGeos), mats.charcoal));

  /* ---------- X-bracing (left + right, end bays) ---------- */
  {
    const geos = [];
    [[0, 1], [4, 5]].forEach(([i, j]) => {
      [[PILLARS[i], PILLARS[j]], [PILLARS[i + 6], PILLARS[j + 6]]].forEach(([p, q]) => {
        const side = p.side === 'left' ? left : right;
        const a = side.at(p.s, PILLAR_OFF - 0.05);
        const b = side.at(q.s, PILLAR_OFF - 0.05);
        geos.push(rodGeo(new THREE.Vector3(a.x, F + 0.2, a.z), new THREE.Vector3(b.x, H - 0.2, b.z), 0.03, 6));
        geos.push(rodGeo(new THREE.Vector3(b.x, F + 0.2, b.z), new THREE.Vector3(a.x, H - 0.2, a.z), 0.03, 6));
      });
    });
    g.add(mesh(mergeGeometries(geos), mats.frame));
  }

  /* ---------- Gutters (eave) + roof edge fascia ---------- */
  {
    const geos = [];
    [left, right].forEach((side) => {
      const a = side.at(-0.6, 0.62);
      const b = side.at(side.len + 0.6, 0.62);
      geos.push(rodGeo(new THREE.Vector3(a.x, H - 0.12, a.z), new THREE.Vector3(b.x, H - 0.12, b.z), 0.13, 10));
    });
    [-ov, 1 + ov].forEach((v) => {
      const pts = [];
      for (let k = 0; k <= 30; k++) pts.push(roofPoint(-ue + ((1 + 2 * ue) * k) / 30, v, -0.02));
      geos.push(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 60, 0.1, 6, false));
    });
    g.add(mesh(mergeGeometries(geos.map((x) => (x.index ? x : x))), mats.charcoal));
  }

  g.userData.lamps = lamps;
  g.userData.anchors = anchors;
  return g;
}

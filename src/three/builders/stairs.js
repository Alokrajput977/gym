import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIDES, STAIR, FLOOR_H as F } from '../plan.js';
import { sideBox, rodGeo, mesh, beamBetween } from '../helpers.js';


export function buildStairs(mats) {
  const g = new THREE.Group();
  g.name = 'exterior-stairs';
  const side = SIDES[STAIR.side];
  const { landing: Ld, flight: Fl } = STAIR;
  const V = (s, off, y) => {
    const p = side.at(s, off);
    return new THREE.Vector3(p.x, y, p.z);
  };

  /* ---------- Landing ---------- */
  sideBox(g, side, Ld.s0, Ld.s1, F - 0.18, F, Ld.off1 - Ld.off0, mats.grating, (Ld.off0 + Ld.off1) / 2);
  // edge beams
  sideBox(g, side, Ld.s0, Ld.s1, F - 0.3, F - 0.18, 0.12, mats.frame, Ld.off1 - 0.06);
  // Support columns
  const posts = [];
  [[Ld.s0 + 0.08, Ld.off1 - 0.08], [Ld.s1 - 0.08, Ld.off1 - 0.08], [Ld.s0 + 0.08, Ld.off0 + 0.1]].forEach(([s, off]) => {
    posts.push(rodGeo(V(s, off, 0), V(s, off, F - 0.18), 0.07, 10));
  });

  /* ---------- Flight ---------- */
  const n = Fl.risers;
  const rise = F / n;
  const tread = Fl.tread;
  const s0 = Ld.s1; // landing ke kinare se shuru
  const w = Fl.off1 - Fl.off0;
  const offC = (Fl.off0 + Fl.off1) / 2;
  for (let i = 0; i < n - 1; i++) {
    const top = F - (i + 1) * rise;
    const sa = s0 + i * tread;
    sideBox(g, side, sa, sa + tread, top - 0.05, top, w - 0.04, mats.grating, offC);
    sideBox(g, side, sa, sa + 0.05, top - 0.004, top + 0.004, w - 0.04, mats.hazard, offC, { cast: false });
  }
  const sEnd = s0 + (n - 1) * tread + tread; // ground par pehla kadam yahan
  // Stringers
  [Fl.off0, Fl.off1].forEach((off) => {
    beamBetween(g, V(s0, off, F - 0.12), V(sEnd, off, -0.05), 0.08, 0.32, mats.frame);
  });
  // Bottom pad
  sideBox(g, side, sEnd - 0.1, sEnd + 1.2, -0.02, 0.06, w + 0.6, mats.concrete, offC);

  /* ---------- Handrails ---------- */
  const rails = [];
  const railH = 1.0;
  [Fl.off0 + 0.02, Fl.off1 - 0.02].forEach((off) => {
    const a = V(s0, off, F + railH);
    const b = V(sEnd, off, railH);
    rails.push(rodGeo(a, b, 0.03, 8));
    rails.push(rodGeo(V(s0, off, F + railH * 0.5), V(sEnd, off, railH * 0.5), 0.015, 6));
    for (let k = 0; k <= 5; k++) {
      const t = k / 5;
      const s = s0 + (sEnd - s0) * t;
      const y = F * (1 - t);
      rails.push(rodGeo(V(s, off, y), V(s, off, y + railH), 0.022, 6));
    }
  });
  // Landing rails (bahar wali side + peeche wali side)
  rails.push(rodGeo(V(Ld.s0, Ld.off1 - 0.02, F + railH), V(s0, Ld.off1 - 0.02, F + railH), 0.03, 8));
  rails.push(rodGeo(V(Ld.s0, Ld.off0, F + railH), V(Ld.s0, Ld.off1, F + railH), 0.03, 8));
  rails.push(rodGeo(V(Ld.s0, Ld.off1 - 0.02, F + railH * 0.5), V(s0, Ld.off1 - 0.02, F + railH * 0.5), 0.015, 6));
  [Ld.s0, (Ld.s0 + s0) / 2, s0].forEach((s) => rails.push(rodGeo(V(s, Ld.off1 - 0.02, F), V(s, Ld.off1 - 0.02, F + railH), 0.022, 6)));
  rails.push(rodGeo(V(Ld.s0, Ld.off0 + 0.05, F), V(Ld.s0, Ld.off0 + 0.05, F + railH), 0.022, 6));
  // landing aur flight ke beech deewar ki taraf ka khula hissa band
  rails.push(rodGeo(V(s0, Ld.off0, F + railH), V(s0, Fl.off0, F + railH), 0.03, 8));
  rails.push(rodGeo(V(s0, Ld.off0 + 0.05, F), V(s0, Ld.off0 + 0.05, F + railH), 0.022, 6));

  g.add(mesh(mergeGeometries(rails), mats.steel));
  g.add(mesh(mergeGeometries(posts), mats.frame));

  return g;
}
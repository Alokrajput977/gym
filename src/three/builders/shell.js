import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {
  SIDES, CORNERS, FLOOR_H as F, EAVE_H as H, WALL_T as T, roofY, STAIR, ENTRANCE, SIDE_DOOR,
} from '../plan.js';

/** Plane ko side ke bahar ki taraf mod do. */
const outward = (side) => Math.atan2(side.n.x, side.n.z);
import { addBox, sideBox, mesh } from '../helpers.js';
import { ROOM2_WIN } from './mezzanine.js';

/* ---------- Canvas textures (banner, lettering, signs) ---------- */
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function drawGymnast(ctx, cx, cy, s, color) {
  // split-leap figure (banner logo)
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const L = (pts, w) => {
    ctx.lineWidth = w * s;
    ctx.beginPath();
    ctx.moveTo(cx + pts[0][0] * s, cy + pts[0][1] * s);
    pts.slice(1).forEach(([x, y]) => ctx.lineTo(cx + x * s, cy + y * s));
    ctx.stroke();
  };
  L([[-4, 22], [6, -38]], 20); // torso
  L([[-96, 40], [-48, 30], [-4, 22], [48, 10], [96, 2]], 13); // legs split
  L([[6, -34], [-30, -70], [-52, -98]], 9); // arm up
  L([[6, -34], [40, -48], [74, -58]], 9); // arm forward
  ctx.beginPath();
  ctx.arc(cx + 12 * s, cy - 58 * s, 15 * s, 0, Math.PI * 2);
  ctx.fill();
}

/** Entrance banner (flex) – academy logo + naam */
function bannerTexture() {
  return canvasTex(2048, 368, (ctx, W, Hh) => {
    const bg = ctx.createLinearGradient(0, 0, W, Hh);
    bg.addColorStop(0, '#16245f');
    bg.addColorStop(0.55, '#2b2a7a');
    bg.addColorStop(1, '#5a2483');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, Hh);
    ctx.globalAlpha = 0.07;
    ctx.fillStyle = '#fff';
    for (let x = 420; x < W; x += 260) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x + 90, 0);
      ctx.lineTo(x - 60, Hh);
      ctx.lineTo(x - 150, Hh);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.strokeStyle = '#ffd36e';
    ctx.lineWidth = 10;
    ctx.strokeRect(14, 14, W - 28, Hh - 28);
    // logo disc
    ctx.fillStyle = '#ff4f9a';
    ctx.beginPath();
    ctx.arc(220, Hh / 2, 135, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 6;
    ctx.stroke();
    drawGymnast(ctx, 220, Hh / 2 + 20, 1.05, '#ffffff');
    // text
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.shadowColor = 'rgba(0,0,0,0.45)';
    ctx.shadowBlur = 14;
    ctx.shadowOffsetY = 5;
    ctx.fillStyle = '#fff';
    ctx.font = '900 150px "Arial Black", Arial, sans-serif';
    ctx.fillText('GYMNASTICS ACADEMY', 1230, 150, 1440);
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    ctx.fillStyle = '#ffd36e';
    ctx.fillRect(1230 - 520, 236, 1040, 7);
    ctx.font = '700 58px Arial, sans-serif';
    ctx.fillText('MAIN ENTRANCE', 1230, 296, 1200);
  });
}

function letteringTexture(text) {
  return canvasTex(2048, 224, (ctx) => {
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 150px "Arial Black", Arial, sans-serif';
    ctx.fillText(text, 1024, 100, 1960);
    ctx.fillStyle = '#ffd36e';
    ctx.fillRect(424, 196, 1200, 10);
  });
}

function signTexture(title, sub, bg) {
  return canvasTex(512, 160, (ctx, W, Hh) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, Hh);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, W - 16, Hh - 16);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 54px Arial, sans-serif';
    ctx.fillText(title, W / 2, Hh * 0.4, W - 40);
    ctx.font = '600 30px Arial, sans-serif';
    ctx.fillText(sub, W / 2, Hh * 0.75, W - 40);
  });
}

/* ---------- Banded wall with openings ---------- */
const BANDS = (mats) => [
  { y0: 0, y1: F, mat: mats.wall },
  { y0: F, y1: 2 * F - 0.2, mat: mats.navy },
  { y0: 2 * F - 0.2, y1: 2 * F + 1.7, glass: true },
  { y0: 2 * F + 1.7, y1: H, mat: mats.charcoal },
];

function piece(g, side, sA, sB, y0, y1, mat, th, off, openings) {
  const cuts = new Set([sA, sB]);
  const hits = openings.filter((o) => o.s1 > sA && o.s0 < sB && o.y1 > y0 && o.y0 < y1);
  hits.forEach((o) => {
    cuts.add(Math.max(sA, o.s0));
    cuts.add(Math.min(sB, o.s1));
  });
  const xs = [...cuts].sort((a, b) => a - b);
  for (let i = 0; i < xs.length - 1; i++) {
    const a = xs[i];
    const b = xs[i + 1];
    const mid = (a + b) / 2;
    const o = hits.find((h) => h.s0 <= mid && mid <= h.s1);
    if (!o) sideBox(g, side, a, b, y0, y1, th, mat, off);
    else {
      if (o.y0 > y0) sideBox(g, side, a, b, y0, o.y0, th, mat, off);
      if (o.y1 < y1) sideBox(g, side, a, b, o.y1, y1, th, mat, off);
    }
  }
}

function bandedWall(g, mats, side, sA, sB, openings = []) {
  const off = -T / 2; // deewar footprint line ke andar
  BANDS(mats).forEach((b) => {
    if (b.glass) {
      piece(g, side, sA, sB, b.y0, b.y1, mats.glass, 0.04, off, openings);
      // mullions (merge)
      const geos = [];
      const n = Math.max(1, Math.round((sB - sA) / 1.5));
      for (let i = 1; i < n; i++) {
        const s = sA + ((sB - sA) * i) / n;
        const p = side.at(s, off);
        const box = new THREE.BoxGeometry(0.07, b.y1 - b.y0, 0.16);
        box.rotateY(side.rotY);
        box.translate(p.x, (b.y0 + b.y1) / 2, p.z);
        geos.push(box);
      }
      if (geos.length) g.add(mesh(mergeGeometries(geos), mats.frame));
      sideBox(g, side, sA, sB, b.y0 - 0.06, b.y0 + 0.06, T + 0.12, mats.trim, off);
      sideBox(g, side, sA, sB, b.y1 - 0.06, b.y1 + 0.06, T + 0.12, mats.trim, off);
    } else {
      piece(g, side, sA, sB, b.y0, b.y1, b.mat, T, off, openings);
    }
  });
  // Ground floor ke upar white trim
  sideBox(g, side, sA, sB, F - 0.07, F + 0.07, T + 0.1, mats.trim, off);
  // Stone skirting (neeche) + cornice (upar) – building ko finished look
  piece(g, side, sA, sB, 0, 0.6, mats.stone, T + 0.08, off, openings);
  sideBox(g, side, sA, sB, 0.6, 0.66, T + 0.12, mats.trim, off);
  sideBox(g, side, sA, sB, H - 0.18, H + 0.04, T + 0.28, mats.trim, off);
}

/* ---------- Gable (roof ke neeche ka arch hissa) ---------- */
function gable(g, side, mat) {
  const shape = new THREE.Shape();
  shape.moveTo(0, H);
  const N = 40;
  for (let i = 0; i <= N; i++) {
    const t = i / N;
    shape.lineTo(t * side.len, roofY(t));
  }
  shape.lineTo(side.len, H);
  shape.closePath();
  const geo = new THREE.ExtrudeGeometry(shape, { depth: T, bevelEnabled: false });
  geo.translate(0, 0, -T / 2);
  const m = mesh(geo, mat);
  const p = side.at(0, -T / 2);
  m.position.set(p.x, 0, p.z);
  m.rotation.y = side.rotY;
  g.add(m);
  return m;
}

/* ======================================================================= */
export function buildShell(mats, own) {
  const g = new THREE.Group();
  g.name = 'shell';
  const { front, back, left, right } = SIDES;
  const lamps = [];

  /* ---------- LEFT wall (fire exit) + RIGHT wall ---------- */
  const sd = SIDE_DOOR;
  const fire = { s0: sd.s - sd.w / 2, s1: sd.s + sd.w / 2, y0: 0, y1: sd.h };
  bandedWall(g, mats, left, 0, left.len, [fire]);
  bandedWall(g, mats, right, 0, right.len);
  {
    const off = -T / 2;
    sideBox(g, left, fire.s0 + 0.02, fire.s1 - 0.02, 0.02, fire.y1 - 0.02, 0.08, mats.door, off);
    sideBox(g, left, fire.s0 - 0.08, fire.s0, 0, fire.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, left, fire.s1, fire.s1 + 0.08, 0, fire.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, left, fire.s0 - 0.08, fire.s1 + 0.08, fire.y1, fire.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, left, fire.s1 - 0.3, fire.s1 - 0.1, 1.0, 1.06, 0.06, mats.steel, 0.03); // push bar
    sideBox(g, left, fire.s0 - 0.6, fire.s1 + 0.6, sd.h + 0.35, sd.h + 0.45, 1.1, mats.steel, 0.55); // canopy
    const ex = sideBox(g, left, sd.s - 0.32, sd.s + 0.32, sd.h + 0.12, sd.h + 0.3, 0.05, mats.exit, 0.02, { cast: false });
    if (ex) ex.userData.noMerge = true;
  }

  /* ---------- FRONT: first floor door (stairs wala) – gate ke right mein ---------- */
  const sSide = SIDES[STAIR.side];
  const door = { s0: STAIR.doorS - STAIR.doorW / 2, s1: STAIR.doorS + STAIR.doorW / 2, y0: F, y1: F + STAIR.doorH };
  {
    const off = -T / 2;
    // Glass darwaza – landing par khade hokar andar Room 1 dikhta hai
    sideBox(g, sSide, door.s0 + 0.02, door.s1 - 0.02, door.y0 + 0.02, door.y1 - 0.02, 0.03, mats.glass, off);
    sideBox(g, sSide, door.s0 + 0.02, door.s1 - 0.02, door.y0 + 0.02, door.y0 + 0.14, 0.06, mats.frame, off);
    sideBox(g, sSide, STAIR.doorS - 0.03, STAIR.doorS + 0.03, door.y0, door.y1, 0.06, mats.frame, off);
    sideBox(g, sSide, door.s0 - 0.08, door.s0, door.y0, door.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, sSide, door.s1, door.s1 + 0.08, door.y0, door.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, sSide, door.s0 - 0.08, door.s1 + 0.08, door.y1, door.y1 + 0.08, T + 0.06, mats.frame, off);
    sideBox(g, sSide, door.s1 - 0.25, door.s1 - 0.12, F + 1.0, F + 1.18, 0.04, mats.gold, 0.02);
    // canopy + lamp + sign
    sideBox(g, sSide, door.s0 - 0.9, door.s1 + 0.9, F + 2.78, F + 2.9, 1.4, mats.steel, 0.7);
    lamps.push(sideBox(g, sSide, STAIR.doorS - 0.3, STAIR.doorS + 0.3, F + 2.74, F + 2.77, 0.5, mats.lamp, 0.9, { cast: false }));
    const tex = signTexture('FIRST FLOOR', 'Entry by stairs', '#5a2483');
    const sm = new THREE.MeshStandardMaterial({ map: tex, emissive: '#ffffff', emissiveMap: tex, emissiveIntensity: 0.15, roughness: 0.5 });
    own.push(sm);
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(1.4, 0.44), sm);
    const p = sSide.at(door.s1 + 0.95, 0.02);
    sp.position.set(p.x, F + 1.9, p.z);
    sp.rotation.y = outward(sSide);
    sp.userData.noMerge = true;
    g.add(sp);
  }

  /* ---------- FRONT: glass entrance ---------- */
  const c = front.len / 2;
  const gh = ENTRANCE.glassHalf;
  bandedWall(g, mats, front, 0, c - gh);
  // Room 2 ki khidki (mezzanine) – bahar se rooms dikhte hain
  const win2 = { s0: ROOM2_WIN.s0, s1: ROOM2_WIN.s1, y0: F + ROOM2_WIN.y0, y1: F + ROOM2_WIN.y1 };
  bandedWall(g, mats, front, c + gh, front.len, STAIR.side === 'front' ? [door, win2] : [win2]);
  {
    const off = -T / 2;
    sideBox(g, front, win2.s0, win2.s1, win2.y0, win2.y1, 0.03, mats.glass, off);
    sideBox(g, front, win2.s0 - 0.06, win2.s1 + 0.06, win2.y0 - 0.08, win2.y0, T + 0.14, mats.trim, off);
    sideBox(g, front, win2.s0 - 0.06, win2.s1 + 0.06, win2.y1, win2.y1 + 0.06, T + 0.06, mats.frame, off);
    sideBox(g, front, win2.s0 - 0.06, win2.s0, win2.y0, win2.y1, T + 0.06, mats.frame, off);
    sideBox(g, front, win2.s1, win2.s1 + 0.06, win2.y0, win2.y1, T + 0.06, mats.frame, off);
    sideBox(g, front, (win2.s0 + win2.s1) / 2 - 0.03, (win2.s0 + win2.s1) / 2 + 0.03, win2.y0, win2.y1, T + 0.04, mats.frame, off);
  }
  {
    // curtain wall glass + spandrels + mullions
    const dw0 = ENTRANCE.doorW / 2;
    const dh0 = ENTRANCE.doorH;
    // glass – darwaze ki jagah khaali (wahan sliding darwaze)
    sideBox(g, front, c - gh, c - dw0, 0, H, 0.04, mats.glass, -0.2);
    sideBox(g, front, c + dw0, c + gh, 0, H, 0.04, mats.glass, -0.2);
    sideBox(g, front, c - dw0, c + dw0, dh0 + 0.08, H, 0.04, mats.glass, -0.2);
    [F, 2 * F].forEach((y) => sideBox(g, front, c - gh, c + gh, y - 0.22, y + 0.22, 0.22, mats.charcoal, -0.1));
    sideBox(g, front, c - gh - 0.1, c + gh + 0.1, H - 0.3, H, 0.3, mats.charcoal, -0.1);
    const geos = [];
    for (let k = 0; k <= 10; k++) {
      const sk = c - gh + (k * 2 * gh) / 10;
      const p = front.at(sk, -0.1);
      if (Math.abs(sk - c) < ENTRANCE.doorW / 2 + 0.05) {
        // darwaze ke upar hi mullion
        const b = new THREE.BoxGeometry(0.09, H - ENTRANCE.doorH, 0.22);
        b.rotateY(front.rotY);
        b.translate(p.x, (H + ENTRANCE.doorH) / 2, p.z);
        geos.push(b);
        continue;
      }
      const b = new THREE.BoxGeometry(0.09, H, 0.22);
      b.rotateY(front.rotY);
      b.translate(p.x, H / 2, p.z);
      geos.push(b);
    }
    for (let f = 0; f < 3; f++) {
      const y = f * F + F * 0.55;
      const cut = y < ENTRANCE.doorH + 0.1; // darwaze ke beech se line na jaaye
      const segs = cut ? [[c - gh, c - ENTRANCE.doorW / 2], [c + ENTRANCE.doorW / 2, c + gh]] : [[c - gh, c + gh]];
      segs.forEach(([s0, s1]) => {
        const p = front.at((s0 + s1) / 2, -0.1);
        const b = new THREE.BoxGeometry(s1 - s0, 0.07, 0.16);
        b.rotateY(front.rotY);
        b.translate(p.x, y, p.z);
        geos.push(b);
      });
    }
    g.add(mesh(mergeGeometries(geos), mats.frame));

    // Purple fins (signature)
    [-1, 1].forEach((k) => {
      const s = c + k * (gh + 0.25);
      sideBox(g, front, s - 0.22, s + 0.22, 0, H + 1.2, 1.1, mats.accent, 0.35);
      sideBox(g, front, s - 0.25, s + 0.25, H + 1.2, H + 1.32, 1.15, mats.trim, 0.35);
    });

    // Doors
    const dw = ENTRANCE.doorW / 2;
    const dh = ENTRANCE.doorH;
    sideBox(g, front, c - dw - 0.07, c - dw + 0.07, 0, dh, 0.25, mats.frame, -0.05);
    sideBox(g, front, c + dw - 0.07, c + dw + 0.07, 0, dh, 0.25, mats.frame, -0.05);
    sideBox(g, front, c - dw, c + dw, dh - 0.08, dh + 0.08, 0.25, mats.frame, -0.05);
    // Track (upar) – sliding darwaze isme chalte hain
    sideBox(g, front, c - 2 * dw, c + 2 * dw, dh, dh + 0.12, 0.3, mats.frame, -0.02);

    // AUTOMATIC SLIDING DARWAZE – 2 glass leaves (alag group, animate hote hain)
    const leaf = (sign) => {
      const lg = new THREE.Group();
      const lw = dw - 0.02;
      const glassMat = mats.glass;
      const panel = mesh(new THREE.BoxGeometry(lw, dh - 0.04, 0.03), glassMat, { cast: false });
      panel.position.set(sign * lw / 2, dh / 2, 0);
      lg.add(panel);
      const fr = (w, h, x, y) => {
        const m = mesh(new THREE.BoxGeometry(w, h, 0.06), mats.frame);
        m.position.set(x, y, 0);
        lg.add(m);
      };
      fr(lw, 0.07, sign * lw / 2, 0.035);
      fr(lw, 0.07, sign * lw / 2, dh - 0.035);
      fr(0.06, dh, sign * 0.03, dh / 2);
      fr(0.06, dh, sign * (lw - 0.03), dh / 2);
      const h = mesh(new THREE.BoxGeometry(0.04, 1.1, 0.1), mats.gold);
      h.position.set(sign * 0.16, 1.2, 0);
      lg.add(h);
      const p = front.at(c, -0.12);
      lg.position.set(p.x, 0, p.z);
      lg.rotation.y = front.rotY;
      lg.userData.noMerge = true;
      lg.traverse((o) => {
        o.userData.noMerge = true;
      });
      lg.userData.closedX = p.x;
      lg.userData.closedZ = p.z;
      g.add(lg);
      return lg;
    };
    const leafL = leaf(-1);
    const leafR = leaf(1);
    const dirX = front.dir.x;
    const dirZ = front.dir.z;
    const travel = dw - 0.12;
    g.userData.doors = {
      t: 0,
      target: 0,
      center: front.at(c, 0),
      set(t) {
        this.t = t;
        const e = t * t * (3 - 2 * t); // smoothstep – soft start/stop
        leafL.position.set(leafL.userData.closedX - dirX * travel * e, 0, leafL.userData.closedZ - dirZ * travel * e);
        leafR.position.set(leafR.userData.closedX + dirX * travel * e, 0, leafR.userData.closedZ + dirZ * travel * e);
      },
    };
    // Sensor (upar chhota dabba)
    sideBox(g, front, c - 0.2, c + 0.2, dh + 0.14, dh + 0.24, 0.12, mats.charcoal, 0.12);

    // Canopy + lamps + tension rods
    const cw = 4.9;
    sideBox(g, front, c - cw, c + cw, 3.2, 3.52, 3.6, mats.steel, 1.8);
    sideBox(g, front, c - cw - 0.05, c + cw + 0.05, 3.15, 3.6, 0.12, mats.frame, 3.6); // canopy ka bahari kinara
    [-3, -1, 1, 3].forEach((d) => {
      lamps.push(sideBox(g, front, c + d - 0.3, c + d + 0.3, 3.17, 3.2, 0.6, mats.lamp, 1.8, { cast: false }));
    });
    [-3.8, 3.8].forEach((d) => {
      const a = front.at(c + d, 0);
      const b = front.at(c + d, 3.4);
      const rod = new THREE.Vector3(b.x - a.x, 3.5 - 6.4, b.z - a.z);
      const len = rod.length();
      const r = mesh(new THREE.CylinderGeometry(0.035, 0.035, len, 8), mats.frame);
      r.position.set((a.x + b.x) / 2, (6.4 + 3.5) / 2, (a.z + b.z) / 2);
      r.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), rod.normalize());
      g.add(r);
    });

    // ENTRANCE BANNER – canopy ke upar
    const bm = new THREE.MeshStandardMaterial({ map: bannerTexture(), roughness: 0.6, emissive: '#ffffff', emissiveIntensity: 0 });
    bm.emissiveMap = bm.map;
    bm.userData.dynamic = true;
    own.push(bm);
    const bw = 7.6;
    const bh = (bw * 368) / 2048;
    const bp = front.at(c, 0.28);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(bw, bh), bm);
    banner.position.set(bp.x, 4.25 + bh / 2, bp.z);
    banner.rotation.y = front.rotY;
    banner.userData.noMerge = true;
    g.add(banner);
    sideBox(g, front, c - bw / 2 - 0.06, c + bw / 2 + 0.06, 4.25 - 0.06, 4.25, 0.1, mats.frame, 0.24);
    sideBox(g, front, c - bw / 2 - 0.06, c + bw / 2 + 0.06, 4.25 + bh, 4.25 + bh + 0.06, 0.1, mats.frame, 0.24);
    g.userData.bannerMat = bm;
  }

  /* ---------- BACK: loading shutters ---------- */
  bandedWall(g, mats, back, 0, back.len);
  {
    const sw = 4.4;
    const sh = 4.6;
    [0.3, 0.7].forEach((t) => {
      const s = back.len * t;
      sideBox(g, back, s - sw / 2, s + sw / 2, 0, sh, 0.08, mats.shutter, 0.06);
      sideBox(g, back, s - sw / 2 - 0.15, s + sw / 2 + 0.15, sh, sh + 0.55, 0.5, mats.charcoal, 0.25);
      sideBox(g, back, s - sw / 2 - 0.12, s - sw / 2, 0, sh, 0.18, mats.frame, 0.1);
      sideBox(g, back, s + sw / 2, s + sw / 2 + 0.12, 0, sh, 0.18, mats.frame, 0.1);
    });
    sideBox(g, back, back.len * 0.3 - 2.9, back.len * 0.7 + 2.9, 5.6, 5.9, 2.4, mats.steel, 1.2);
  }

  /* ---------- Flag poles – entrance ke left mein ---------- */
  {
    const flagTex = (bg, stripe) => canvasTex(512, 320, (ctx, W, Hh) => {
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, W, Hh);
      ctx.fillStyle = stripe;
      ctx.fillRect(0, Hh - 54, W, 26);
      drawGymnast(ctx, W / 2, Hh / 2 - 6, 1.05, '#ffffff');
    });
    const fm = [flagTex('#5a2483', '#ffd36e'), flagTex('#1d2b6b', '#ff4f9a'), flagTex('#5a2483', '#ffd36e')].map((t) => {
      const m = new THREE.MeshStandardMaterial({ map: t, side: THREE.DoubleSide, roughness: 0.8 });
      own.push(m);
      return m;
    });
    // halka lehrata kapda (static wave)
    const flagGeo = new THREE.PlaneGeometry(1.8, 1.1, 12, 1);
    const fp = flagGeo.attributes.position;
    for (let i = 0; i < fp.count; i++) {
      const x = fp.getX(i) + 0.9;
      fp.setZ(i, Math.sin(x * 3.2) * 0.08 * x);
    }
    flagGeo.translate(0.9, 0, 0);
    flagGeo.computeVertexNormals();
    [2.4, 3.9, 5.4].forEach((s, i) => {
      const p = front.at(s, 1.9);
      const pole = mesh(new THREE.CylinderGeometry(0.04, 0.06, 8.2, 10), mats.steel);
      pole.position.set(p.x, 4.1, p.z);
      g.add(pole);
      const knob = mesh(new THREE.SphereGeometry(0.08, 10, 8), mats.gold);
      knob.position.set(p.x, 8.25, p.z);
      g.add(knob);
      const flag = mesh(flagGeo, fm[i]);
      flag.position.set(p.x, 7.45 - (i === 1 ? 0.3 : 0), p.z);
      flag.rotation.y = front.rotY + Math.PI; // pole se left ki taraf lehrata
      flag.userData.noMerge = true;
      g.add(flag);
    });
  }

  /* ---------- Gables + corner posts ---------- */
  const frontGable = gable(g, front, mats.charcoal);
  gable(g, back, mats.charcoal);
  [CORNERS.A01, CORNERS.B01, CORNERS.B06, CORNERS.A06].forEach((p) => {
    addBox(g, 0.42, H + 0.05, 0.42, mats.charcoal, p.x, (H + 0.05) / 2, p.z);
  });

  // Facade lettering on front gable
  {
    const lm = new THREE.MeshStandardMaterial({
      map: letteringTexture('GYMNASTICS ACADEMY'), transparent: true, alphaTest: 0.3, roughness: 0.4,
      emissive: '#ffffff', emissiveIntensity: 0,
    });
    lm.emissiveMap = lm.map;
    lm.userData.dynamic = true;
    own.push(lm);
    const lp = front.at(c, 0.03);
    const letters = new THREE.Mesh(new THREE.PlaneGeometry(11, 1.2), lm);
    letters.position.set(lp.x, H + 0.95, lp.z);
    letters.rotation.y = front.rotY;
    letters.userData.noMerge = true;
    g.add(letters);
    g.userData.letterMat = lm;
  }

  g.userData.lamps = lamps;
  g.userData.frontGable = frontGable;
  return g;
}
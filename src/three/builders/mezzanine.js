import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { SIDES, rightXAt, WALL_T as T, FLOOR_H as F, STAIR } from '../plan.js';
import { addBox, sideBox, rodGeo, mesh } from '../helpers.js';

/*
 * MEZZANINE (12 ft) – drawing ke hisaab se FRONT-RIGHT kone mein
 *
 *   front deewar ───────────[glass darwaza]──[khidki]──────
 *   |  (entrance)  |  ROOM 1  (office)  |  ROOM 2        |   depth 0.3 .. 3.8
 *   |              |------door/window---|--door/window---|
 *   |              |   BALCONY (kursiyan + tables, glass railing)   3.8 .. 6.0
 *
 *  - Upar jaane ka raasta: BAHAR wali seedhi -> landing -> glass darwaza -> Room 1
 *    (landing par khade hokar hi glass se room dikhta hai)
 *  - Andar koi seedhi nahi – balcony rooms ke darwazon se
 *  - Balcony hall ki taraf khuli – log baith kar gym dekh sakte hain
 */

export const MEZZ = {
  s0: 14.0, // mezzanine ka left kinara (front deewar ke along, A06 se)
  roomDepth: 3.8, // rooms front deewar se itne andar tak
  depth: 6.0, // balcony ka hall wala kinara
  partition: 18.9, // Room 1 | Room 2
  roomH: 2.9,
};

// Room 2 ki bahar wali khidki (front deewar par) – shell.js bhi yahi use karta hai
export const ROOM2_WIN = { s0: 19.4, s1: 21.5, y0: 0.9, y1: 2.3 };

const SLAB = 0.25;
const front = SIDES.front;

/** Kisi depth par right deewar ke andar ka kinara (front side ke s mein). */
export function rightLimitS(d) {
  let a = 10;
  let b = front.len + 2;
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2;
    const p = front.at(m, -d);
    if (rightXAt(p.z) - T - 0.02 - p.x > 0) a = m;
    else b = m;
  }
  return a;
}

const V = (s, d, y) => {
  const p = front.at(s, -d);
  return new THREE.Vector3(p.x, y, p.z);
};
const inward = Math.atan2(-front.n.x, -front.n.z); // hall ki taraf dekhta hua

/* ---------- canvas helpers ---------- */
function canvasTex(w, h, draw, repeat = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  return t;
}

const oakTex = () => canvasTex(512, 512, (ctx, w, h) => {
  const rows = 8;
  const rh = h / rows;
  const tones = ['#c9a27a', '#bf976d', '#d1ab84', '#c49c72', '#b88f64'];
  for (let i = 0; i < rows; i++) {
    let x = -Math.random() * 200;
    while (x < w) {
      const len = 160 + Math.random() * 260;
      ctx.fillStyle = tones[Math.floor(Math.random() * tones.length)];
      ctx.fillRect(x, i * rh, len, rh);
      for (let k = 0; k < 10; k++) {
        ctx.strokeStyle = `rgba(110,70,35,${0.05 + Math.random() * 0.08})`;
        ctx.lineWidth = 0.6 + Math.random();
        const yy = i * rh + 3 + Math.random() * (rh - 6);
        ctx.beginPath();
        ctx.moveTo(x, yy);
        ctx.bezierCurveTo(x + len * 0.3, yy + 2, x + len * 0.7, yy - 2, x + len, yy);
        ctx.stroke();
      }
      ctx.fillStyle = 'rgba(60,35,15,0.4)';
      ctx.fillRect(x, i * rh, 2, rh);
      x += len;
    }
    ctx.fillStyle = 'rgba(60,35,15,0.35)';
    ctx.fillRect(0, i * rh, w, 2);
  }
}, true);

function signTex(text) {
  return canvasTex(512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#22325a';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#ffd36e';
    ctx.fillRect(0, h - 12, w, 12);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 58px Arial, sans-serif';
    ctx.fillText(text, w / 2, h / 2 - 4, w - 30);
  });
}

/* =================================================================== */
export function buildMezzanine(mats, own) {
  const g = new THREE.Group();
  g.name = 'mezzanine';

  const std = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    own.push(m);
    return m;
  };
  const M = {
    oak: std({ map: oakTex(), roughness: 0.45 }),
    white: std({ color: '#f4f3ef', roughness: 0.7 }),
    wall: std({ map: mats.concrete.map, color: '#ece8e1', roughness: 0.9 }),
    glass: std({ color: '#cfe6f2', transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, depthWrite: false, side: THREE.DoubleSide }),
    chrome: std({ color: '#dfe3e7', metalness: 1, roughness: 0.2 }),
    fabric: std({ color: '#2f4f8f', roughness: 0.9 }),
    fabric2: std({ color: '#6a2c93', roughness: 0.9 }),
    cushion: std({ color: '#ffd36e', roughness: 0.85 }),
    leaf: std({ color: '#2f6b2a', roughness: 0.8, flatShading: true }),
    pot: std({ color: '#e6e1d8', roughness: 0.5 }),
    panel: std({ color: '#ffffff', emissive: '#fff6e6', emissiveIntensity: 1.3 }),
    screen: std({ color: '#0b1220', emissive: '#5ab4f0', emissiveIntensity: 0.6 }),
  };

  const { s0, roomDepth: RD, depth: D, partition: PS, roomH } = MEZZ;
  const sR0 = rightLimitS(T + 0.02);
  const sRr = rightLimitS(RD);
  const sRd = rightLimitS(D);
  const Y = F; // mezzanine floor level (12 ft ~ 3.6 m)

  /* ---------- Slab (trapezoid kona) ---------- */
  {
    const pts = [V(s0, T, 0), V(sR0, T, 0), V(sRd, D, 0), V(s0, D, 0)];
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: SLAB, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    // oak UV meters mein
    const pos = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2, pos.getZ(i) / 2);
    const slab = mesh(geo, [M.oak, M.white]);
    slab.position.y = Y - SLAB;
    slab.userData.noMerge = true;
    g.add(slab);
  }
  // Slab ka hall wala fascia (white) + left kinare ka fascia
  sideBox(g, front, s0, sRd, Y - SLAB - 0.15, Y - SLAB + 0.02, 0.12, M.white, -D + 0.06);
  sideBox(g, front, s0 - 0.06, s0 + 0.06, Y - SLAB - 0.15, Y - SLAB + 0.02, D - T, M.white, -(D + T) / 2);

  /* ---------- Columns (hall wale kinare par) ---------- */
  const colGeos = [];
  [s0 + 0.15, (s0 + sRd) / 2, sRd - 0.25].forEach((s) => {
    colGeos.push(rodGeo(V(s, D - 0.15, 0), V(s, D - 0.15, Y - SLAB), 0.13, 16));
  });
  g.add(mesh(mergeGeometries(colGeos), M.white));

  /* ---------- Balcony railings (glass) ---------- */
  const glassRail = (pA, pB, h = 1.05) => {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute([
      pA.x, pA.y, pA.z, pB.x, pB.y, pB.z, pB.x, pB.y + h, pB.z, pA.x, pA.y + h, pA.z,
    ], 3));
    geo.setIndex([0, 1, 2, 0, 2, 3]);
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, M.glass);
    m.userData.noMerge = true;
    g.add(m);
    return rodGeo(pA.clone().setY(pA.y + h), pB.clone().setY(pB.y + h), 0.03, 8);
  };
  const rails = [];
  rails.push(glassRail(V(s0, D - 0.03, Y), V(sRd, D - 0.03, Y))); // hall wala kinara
  rails.push(glassRail(V(s0 + 0.03, RD, Y), V(s0 + 0.03, D - 0.03, Y))); // left kinara (entrance ke upar)
  g.add(mesh(mergeGeometries(rails), M.chrome));

  /* ---------- Rooms ---------- */
  const yB = Y;
  const wallTh = 0.12;
  // room ka hall-wala front wall (door + window), side walls, partition, ceiling
  const roomFront = (sa, sb, doorS, winA, winB) => {
    const dW = RD - wallTh / 2;
    const seg = (x0, x1, y0, y1) => sideBox(g, front, x0, x1, yB + y0, yB + y1, wallTh, M.wall, -dW);
    seg(sa, doorS - 0.5, 0, roomH);
    seg(doorS - 0.5, doorS + 0.5, 2.15, roomH);
    seg(doorS + 0.5, winA, 0, roomH);
    seg(winA, winB, 0, 0.9);
    seg(winA, winB, 2.2, roomH);
    seg(winB, sb, 0, roomH);
    // door (oak) + window glass + frames
    sideBox(g, front, doorS - 0.48, doorS + 0.48, yB + 0.01, yB + 2.13, 0.05, M.oak, -dW);
    sideBox(g, front, doorS + 0.3, doorS + 0.36, yB + 1.0, yB + 1.18, 0.12, mats.gold, -dW + 0.05);
    sideBox(g, front, winA, winB, yB + 0.9, yB + 2.2, 0.02, M.glass, -dW);
    [[winA - 0.04, winA + 0.02], [winB - 0.02, winB + 0.04], [(winA + winB) / 2 - 0.02, (winA + winB) / 2 + 0.02]].forEach(([x0, x1]) => {
      sideBox(g, front, x0, x1, yB + 0.9, yB + 2.2, wallTh + 0.03, mats.frame, -dW);
    });
    sideBox(g, front, winA - 0.04, winB + 0.04, yB + 2.2, yB + 2.25, wallTh + 0.03, mats.frame, -dW);
    sideBox(g, front, winA - 0.1, winB + 0.1, yB + 0.86, yB + 0.9, wallTh + 0.12, M.white, -dW + 0.04);
  };
  const sRoomEnd = sRr - 0.05;
  roomFront(s0, PS, s0 + 0.95, s0 + 1.8, PS - 0.6);
  roomFront(PS, sRoomEnd, PS + 0.8, PS + 1.6, sRoomEnd - 0.4);
  // left wall (landing ki taraf) + partition
  sideBox(g, front, s0, s0 + wallTh, yB, yB + roomH, RD - T, M.wall, -(T + RD) / 2);
  sideBox(g, front, PS - wallTh / 2, PS + wallTh / 2, yB, yB + roomH, RD - T, M.wall, -(T + RD) / 2);
  // ceiling (rooms ke upar)
  {
    const pts = [V(s0, T, 0), V(sR0, T, 0), V(sRr, RD, 0), V(s0, RD, 0)];
    const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.15, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const c = mesh(geo, M.white);
    c.position.y = yB + roomH;
    c.userData.noMerge = true;
    g.add(c);
  }
  // Rooms ke andar plaster lining – front deewar (bahar wale darwaze ki jagah chhod kar) + right deewar
  {
    const ld = T + 0.03;
    const dA = STAIR.doorS - STAIR.doorW / 2 - 0.1;
    const dB = STAIR.doorS + STAIR.doorW / 2 + 0.1;
    const lin = (x0, x1, y0, y1) => sideBox(g, front, x0, x1, yB + y0, yB + y1, 0.04, M.wall, -ld);
    lin(s0 + 0.1, dA, 0, roomH);
    lin(dA, dB, STAIR.doorH + 0.1, roomH);
    lin(dB, ROOM2_WIN.s0, 0, roomH);
    lin(ROOM2_WIN.s0, ROOM2_WIN.s1, 0, ROOM2_WIN.y0);
    lin(ROOM2_WIN.s0, ROOM2_WIN.s1, ROOM2_WIN.y1, roomH);
    lin(ROOM2_WIN.s1, sR0 - 0.05, 0, roomH);
    // right deewar (Room 2) – tirchhi line ke saath
    const p0 = V(sR0 - 0.03, T, 0);
    const p1 = V(sRr - 0.03, RD, 0);
    const len = Math.hypot(p1.x - p0.x, p1.z - p0.z);
    const rw = addBox(g, 0.04, roomH, len, M.wall, (p0.x + p1.x) / 2, yB + roomH / 2, (p0.z + p1.z) / 2);
    rw.rotation.y = Math.atan2(p1.x - p0.x, p1.z - p0.z);
  }

  // Room signs (balcony ki taraf)
  [[(s0 + PS) / 2 - 0.9, 'ROOM 1'], [(PS + sRoomEnd) / 2 - 0.5, 'ROOM 2']].forEach(([s, text]) => {
    const sm = std({ map: signTex(text), emissive: '#ffffff', emissiveIntensity: 0.2, roughness: 0.5 });
    sm.emissiveMap = sm.map;
    const p = V(s, RD + 0.01, yB + 2.55);
    const pl = new THREE.Mesh(new THREE.PlaneGeometry(1.1, 0.28), sm);
    pl.position.copy(p);
    pl.rotation.y = inward;
    pl.userData.noMerge = true;
    g.add(pl);
  });
  // Ceiling lights (rooms + balcony ke upar)
  [[(s0 + PS) / 2, RD / 2 + 0.2], [(PS + sRoomEnd) / 2, RD / 2 + 0.2]].forEach(([s, d]) => {
    sideBox(g, front, s - 0.6, s + 0.6, yB + roomH - 0.03, yB + roomH, 0.6, M.panel, -d, { cast: false });
  });

  /* ---------- Furniture ---------- */
  const place = (obj, s, d, y, rot = 0) => {
    const p = front.at(s, -d);
    obj.position.set(p.x, y, p.z);
    obj.rotation.y = inward + rot;
    g.add(obj);
  };
  const chair = (mat) => {
    const c = new THREE.Group();
    addBox(c, 0.46, 0.06, 0.46, mat, 0, 0.46, 0);
    addBox(c, 0.46, 0.5, 0.06, mat, 0, 0.74, -0.2);
    [[-0.19, -0.19], [0.19, -0.19], [-0.19, 0.19], [0.19, 0.19]].forEach(([x, z]) => addBox(c, 0.03, 0.46, 0.03, M.chrome, x, 0.23, z));
    return c;
  };
  const bistro = () => {
    const t = new THREE.Group();
    const top = mesh(new THREE.CylinderGeometry(0.34, 0.34, 0.04, 24), M.oak);
    top.position.y = 0.74;
    const stem = mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 10), M.chrome);
    stem.position.y = 0.37;
    const base = mesh(new THREE.CylinderGeometry(0.22, 0.24, 0.03, 20), M.chrome);
    base.position.y = 0.015;
    t.add(top, stem, base);
    return t;
  };
  const plant = (h = 1.2) => {
    const p = new THREE.Group();
    const pot = mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.42, 16), M.pot);
    pot.position.y = 0.21;
    p.add(pot);
    [[0, h * 0.75, 0, 0.32], [0.12, h * 0.95, 0.05, 0.25], [-0.1, h * 0.6, -0.08, 0.28]].forEach(([x, y, z, s]) => {
      const b = mesh(new THREE.IcosahedronGeometry(s, 1), M.leaf);
      b.position.set(x, y, z);
      p.add(b);
    });
    return p;
  };
  const sofa = (w, mat) => {
    const s = new THREE.Group();
    addBox(s, w, 0.42, 0.85, mat, 0, 0.21, 0);
    addBox(s, w, 0.48, 0.2, mat, 0, 0.6, -0.33);
    addBox(s, 0.18, 0.6, 0.85, mat, -w / 2 + 0.09, 0.3, 0);
    addBox(s, 0.18, 0.6, 0.85, mat, w / 2 - 0.09, 0.3, 0);
    addBox(s, w - 0.5, 0.1, 0.55, M.cushion, 0, 0.47, 0.05);
    return s;
  };

  // BALCONY seating – kursiyan hall ki taraf mooh karke (gym dekhne ke liye)
  const bd = (RD + D) / 2 + 0.25;
  const sEnd = sRd - 0.6;
  const spots = [];
  for (let s = s0 + 0.9; s < sEnd; s += 2.1) spots.push(s);
  spots.forEach((s) => {
    place(bistro(), s, bd + 0.35, yB);
    place(chair(M.fabric2), s - 0.5, bd - 0.05, yB, 0);
    place(chair(M.fabric2), s + 0.5, bd - 0.05, yB, 0);
  });
  place(plant(1.3), s0 + 0.25, RD + 0.45, yB);
  place(plant(1.3), sRd - 0.35, D - 0.45, yB);

  // ROOM 1 – office (bahar wali seedhi ka darwaza isi room mein)
  {
    const k = new THREE.Group();
    addBox(k, 1.8, 0.05, 0.8, M.oak, 0, 0.75, 0);
    addBox(k, 0.05, 0.73, 0.75, M.oak, -0.88, 0.365, 0);
    addBox(k, 0.05, 0.73, 0.75, M.oak, 0.88, 0.365, 0);
    addBox(k, 0.6, 0.36, 0.04, mats.frame, 0, 1.0, -0.2);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), M.screen);
    scr.position.set(0, 1.0, -0.178);
    k.add(scr);
    place(k, s0 + 1.6, 2.3, yB, 0);
    place(chair(M.fabric), s0 + 1.6, 2.95, yB, Math.PI);
    place(chair(M.fabric), s0 + 1.6, 1.6, yB, 0);
    place(sofa(1.9, M.fabric), PS - 1.2, 2.6, yB, Math.PI);
    place(plant(1.4), PS - 0.4, 0.75, yB);
  }
  // ROOM 2 – lounge / meeting
  {
    const t = new THREE.Group();
    addBox(t, 1.5, 0.05, 0.9, M.white, 0, 0.74, 0);
    addBox(t, 0.08, 0.72, 0.6, M.chrome, 0, 0.36, 0);
    place(t, (PS + sRoomEnd) / 2, 1.9, yB);
    place(chair(M.fabric2), (PS + sRoomEnd) / 2 - 0.45, 1.25, yB, 0);
    place(chair(M.fabric2), (PS + sRoomEnd) / 2 + 0.45, 1.25, yB, 0);
    place(chair(M.fabric2), (PS + sRoomEnd) / 2 - 0.45, 2.55, yB, Math.PI);
    place(chair(M.fabric2), (PS + sRoomEnd) / 2 + 0.45, 2.55, yB, Math.PI);
    place(plant(1.2), sRoomEnd - 0.5, 0.75, yB);
  }

  // Bahar wali seedhi ka darwaza Room 1 mein – andar se door mat
  sideBox(g, front, STAIR.doorS - 0.6, STAIR.doorS + 0.6, yB + 0.005, yB + 0.015, 0.8, M.fabric2, -(T + 0.5), { cast: false });

  return g;
}
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { planPt, FT, PIT, PIT_DEPTH, SPRING, SPRING_MAIN } from '../plan.js';
import { addBox, mesh, rodGeo, polygonPlane } from '../helpers.js';

/*
 * GYM HALL KA ANDAR (nayi drawing ke hisaab se)
 *  - Beech mein GYM SPRING FLOOR (37' x 36' + pit tak 7' ka hissa)
 *  - Back-right kone mein 5 FT DEEP FOAM PIT
 *  - Entrance se andar aate hi LEFT mein RECEPTION
 *  - Equipment (junior size): balance beam, uneven bars, vault runway + table,
 *    aur pit ke upar swing rings (dono taraf pole + crossbar)
 * Sab simple boxes/cylinders – baad mein mergeStatic se kuch hi draw calls.
 * Pehli baar andar jaane par hi banta hai (lazy).
 *
 * Coordinates: building ka local frame (y = 0 floor). F(x, z) = drawing ke feet.
 */

const F = (x, z) => planPt(x, z);
const V3 = (x, z, y) => {
  const p = F(x, z);
  return new THREE.Vector3(p.x, y, p.z);
};

/* ---------- textures ---------- */
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

const fabricTex = () => canvasTex(256, 256, (ctx, w, h) => {
  ctx.fillStyle = '#f2f2f2';
  ctx.fillRect(0, 0, w, h);
  for (let i = 0; i < 6000; i++) {
    ctx.fillStyle = Math.random() > 0.5 ? 'rgba(0,0,0,0.07)' : 'rgba(255,255,255,0.2)';
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }
}, true);

function emblemTex() {
  return canvasTex(512, 512, (ctx) => {
    ctx.fillStyle = '#5a2483';
    ctx.beginPath();
    ctx.arc(256, 256, 240, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#ffd36e';
    ctx.lineWidth = 16;
    ctx.beginPath();
    ctx.arc(256, 256, 222, 0, Math.PI * 2);
    ctx.stroke();
    ctx.strokeStyle = '#fff';
    ctx.fillStyle = '#fff';
    ctx.lineCap = 'round';
    const L = (pts, w) => {
      ctx.lineWidth = w;
      ctx.beginPath();
      ctx.moveTo(...pts[0]);
      pts.slice(1).forEach((p) => ctx.lineTo(...p));
      ctx.stroke();
    };
    L([[252, 300], [262, 210]], 30);
    L([[130, 330], [190, 315], [252, 300], [320, 285], [390, 275]], 18);
    L([[262, 214], [220, 170], [190, 132]], 13);
    L([[262, 214], [310, 196], [350, 184]], 13);
    ctx.beginPath();
    ctx.arc(272, 180, 22, 0, Math.PI * 2);
    ctx.fill();
  });
}

function signTex(title, sub, bg) {
  return canvasTex(512, 160, (ctx, w, h) => {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 6;
    ctx.strokeRect(8, 8, w - 16, h - 16);
    ctx.fillStyle = '#fff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = '800 56px Arial, sans-serif';
    ctx.fillText(title, w / 2, sub ? h * 0.4 : h / 2, w - 40);
    if (sub) {
      ctx.font = '600 28px Arial, sans-serif';
      ctx.fillText(sub, w / 2, h * 0.76, w - 40);
    }
  });
}

/* =================================================================== */
export function buildGym(mats, own) {
  const g = new THREE.Group();
  g.name = 'gym-interior';
  const std = (o) => {
    const m = new THREE.MeshStandardMaterial(o);
    own.push(m);
    return m;
  };
  const fab = fabricTex();
  const M = {
    blue: std({ map: fab, color: '#2457b8', roughness: 0.95 }),
    red: std({ map: fab, color: '#c62828', roughness: 0.95 }),
    matBlue: std({ map: fab, color: '#1f4fa8', roughness: 0.6 }),
    matRed: std({ map: fab, color: '#c0392b', roughness: 0.6 }),
    yellow: std({ color: '#f2c230', roughness: 0.55 }),
    line: std({ color: '#f7f7f7', roughness: 0.6, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4 }),
    emblem: std({ map: emblemTex(), transparent: true, alphaTest: 0.1, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 }),
    suede: std({ map: fab, color: '#d1ab80', roughness: 0.9 }),
    wood: std({ color: '#d8b07a', roughness: 0.5 }),
    chrome: std({ color: '#dfe3e7', metalness: 1, roughness: 0.2 }),
    dark: std({ color: '#2b3036', metalness: 0.6, roughness: 0.4 }),
    pitFloor: std({ color: '#2a2f38', roughness: 0.9 }),
    foam: std({ color: '#ffffff', roughness: 0.95 }),
    white: std({ color: '#f5f5f2', roughness: 0.4 }),
    purple: std({ color: '#5a2483', roughness: 0.45 }),
    navy: std({ color: '#22325a', roughness: 0.8 }),
    screen: std({ color: '#0b1220', emissive: '#5ab4f0', emissiveIntensity: 0.6 }),
    leaf: std({ color: '#2f6b2a', roughness: 0.8, flatShading: true }),
  };

  // Equipment helper: box ko feet position par rakho (world meters size)
  const box = (w, h, d, mat, fx, fz, y, rotY = 0) => {
    const p = F(fx, fz);
    const m = addBox(g, w, h, d, mat, p.x, y, p.z);
    m.rotation.y = rotY;
    return m;
  };

  /* ================= SPRING FLOOR ================= */
  {
    const H = 0.12; // spring floor ki oonchai
    const shape = new THREE.Shape(SPRING.map((p) => new THREE.Vector2(p.x, -p.z)));
    const geo = new THREE.ExtrudeGeometry(shape, { depth: H, bevelEnabled: false });
    geo.rotateX(-Math.PI / 2);
    const base = mesh(geo, [M.red, M.red]);
    base.position.y = 0.01;
    g.add(base);

    // Blue competition area (border red rehta hai) + pit wala hissa bhi blue
    const S = SPRING_MAIN;
    const b = 2.3; // red border feet
    const inner = [F(S.x0 + b, S.z0 + b), F(S.x1 - b, S.z0 + b), F(S.x1 - b, S.z1 - b), F(S.x0 + b, S.z1 - b)];
    const top = new THREE.Mesh(polygonPlane(inner, 1), M.blue);
    top.position.y = H + 0.015;
    top.receiveShadow = true;
    g.add(top);
    const notch = new THREE.Mesh(polygonPlane([F(46.2 + 0.8, 9.6), F(53.2 - 0.8, 9.6), F(53.2 - 0.8, S.z0 + b), F(46.2 + 0.8, S.z0 + b)], 1), M.blue);
    notch.position.y = H + 0.015;
    g.add(notch);

    // White boundary lines
    const L0 = S.x0 + b + 1.6;
    const L1 = S.x1 - b - 1.6;
    const Z0 = S.z0 + b + 1.6;
    const Z1 = S.z1 - b - 1.6;
    const lw = 0.05;
    const yl = H + 0.02;
    const lenX = (L1 - L0) * FT;
    const lenZ = (Z1 - Z0) * FT;
    const cx = (L0 + L1) / 2;
    const cz = (Z0 + Z1) / 2;
    [[cx, Z0, lenX, lw], [cx, Z1, lenX, lw], [L0, cz, lw, lenZ], [L1, cz, lw, lenZ]].forEach(([fx, fz, w, d]) => {
      const p = F(fx, fz);
      const l = new THREE.Mesh(new THREE.PlaneGeometry(w, d).rotateX(-Math.PI / 2), M.line);
      l.position.set(p.x, yl, p.z);
      g.add(l);
    });
    const ep = F(cx, cz);
    const em = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 3.4).rotateX(-Math.PI / 2), M.emblem);
    em.position.set(ep.x, yl + 0.002, ep.z);
    em.userData.noMerge = true;
    g.add(em);
  }

  /* ================= 5 FT DEEP FOAM PIT ================= */
  {
    const D = PIT_DEPTH;
    // Padded andar ki deewarein (har edge par)
    for (let i = 0; i < PIT.length; i++) {
      const a = PIT[i];
      const b = PIT[(i + 1) % PIT.length];
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const m = addBox(g, len, D, 0.12, M.matBlue, (a.x + b.x) / 2, -D / 2, (a.z + b.z) / 2);
      m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }
    const floor = new THREE.Mesh(polygonPlane(PIT, 2), M.pitFloor);
    floor.position.y = -D + 0.01;
    g.add(floor);

    // Foam cubes – 2 layer (upar ~0.8 m deewar dikhti hai, depth samajh aaye)
    const pts = [];
    const bb = new THREE.Box2().setFromPoints(PIT.map((p) => new THREE.Vector2(p.x, p.z)));
    const inside = (x, z) => {
      let c = false;
      for (let i = 0, j = PIT.length - 1; i < PIT.length; j = i++) {
        const a = PIT[i];
        const b = PIT[j];
        if (a.z > z !== b.z > z && x < ((b.x - a.x) * (z - a.z)) / (b.z - a.z) + a.x) c = !c;
      }
      return c;
    };
    for (let layer = 0; layer < 2; layer++) {
      for (let x = bb.min.x + 0.3; x < bb.max.x - 0.2; x += 0.4) {
        for (let z = bb.min.y + 0.3; z < bb.max.y - 0.2; z += 0.4) {
          if (inside(x, z) && inside(x - 0.2, z) && inside(x + 0.2, z) && inside(x, z - 0.2) && inside(x, z + 0.2)) {
            pts.push([x + (Math.random() - 0.5) * 0.1, -D + 0.2 + layer * 0.32 + Math.random() * 0.06, z + (Math.random() - 0.5) * 0.1]);
          }
        }
      }
    }
    const cols = ['#1f5fbf', '#f2c230', '#e53935', '#ffffff', '#43a047', '#ff8f00', '#8e24aa'];
    const foam = new THREE.InstancedMesh(new THREE.BoxGeometry(0.38, 0.38, 0.38), M.foam, pts.length);
    const d = new THREE.Object3D();
    const c = new THREE.Color();
    pts.forEach((p, i) => {
      d.position.set(p[0], p[1], p[2]);
      d.rotation.set(Math.random() * 0.8 - 0.4, Math.random() * 3, Math.random() * 0.8 - 0.4);
      d.updateMatrix();
      foam.setMatrixAt(i, d.matrix);
      foam.setColorAt(i, c.set(cols[Math.floor(Math.random() * cols.length)]));
    });
    foam.instanceColor.needsUpdate = true;
    foam.receiveShadow = true;
    g.add(foam);

    // Red padded coping – khule kinaaron par (left aur neeche)
    const cop = (x0, z0, x1, z1) => {
      const a = F(x0, z0);
      const b = F(x1, z1);
      const len = Math.hypot(b.x - a.x, b.z - a.z);
      const m = addBox(g, len, 0.16, 0.45, M.matRed, (a.x + b.x) / 2, 0.08, (a.z + b.z) / 2);
      m.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    };
    cop(26.25 - 0.7, 1, 26.25 - 0.7, 9.2 + 0.7);
    cop(26.25 - 0.7, 9.2 + 0.7, 46.2, 9.2 + 0.7);

    // Sign
    const sm = std({ map: signTex('5 FT DEEP PIT', 'Land feet first', '#c0392b'), roughness: 0.5 });
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.69), sm);
    const p = F(33, 1.05);
    sp.position.set(p.x, 2.3, p.z);
    sp.userData.noMerge = true;
    g.add(sp);
  }

  /* ================= RECEPTION – entrance ke LEFT mein ================= */
  {
    const cx = 13;
    const cz = 92; // feet
    const c = F(cx, cz);
    // Curved desk – entrance ki taraf (+x) khula arc
    const ring = (rIn, rOut, a0, a1, h) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, rOut, a0, a1, false);
      s.absarc(0, 0, rIn, a1, a0, true);
      s.closePath();
      const geo = new THREE.ExtrudeGeometry(s, { depth: h, bevelEnabled: false, curveSegments: 32 });
      geo.rotateX(-Math.PI / 2);
      return geo;
    };
    const a0 = -1.0;
    const a1 = 1.0; // shape coords: +x = world +x
    const body = mesh(ring(1.55, 1.95, a0, a1, 1.05), M.white);
    body.position.set(c.x - 1.6, 0, c.z);
    const top = mesh(ring(1.45, 2.05, a0 - 0.03, a1 + 0.03, 0.05), M.wood);
    top.position.set(c.x - 1.6, 1.05, c.z);
    const band = mesh(ring(1.95, 1.99, a0 + 0.03, a1 - 0.03, 0.26), M.purple);
    band.position.set(c.x - 1.6, 0.35, c.z);
    g.add(body, top, band);
    const lg = new THREE.Mesh(new THREE.PlaneGeometry(0.62, 0.62), M.emblem);
    lg.position.set(c.x + 0.4, 0.62, c.z);
    lg.rotation.y = Math.PI / 2;
    lg.userData.noMerge = true;
    g.add(lg);
    // Computer + kursi (desk ke peeche, left side)
    addBox(g, 0.05, 0.36, 0.6, M.dark, c.x - 0.15, 1.3, c.z);
    const scr = new THREE.Mesh(new THREE.PlaneGeometry(0.55, 0.3), M.screen);
    scr.position.set(c.x - 0.12, 1.3, c.z);
    scr.rotation.y = -Math.PI / 2;
    scr.userData.noMerge = true;
    g.add(scr);
    addBox(g, 0.5, 0.08, 0.5, M.navy, c.x - 0.9, 0.5, c.z);
    addBox(g, 0.08, 0.6, 0.5, M.navy, c.x - 1.15, 0.85, c.z);
    g.add(mesh(rodGeo(new THREE.Vector3(c.x - 0.9, 0, c.z), new THREE.Vector3(c.x - 0.9, 0.46, c.z), 0.03, 8), M.chrome));

    // Hanging RECEPTION sign
    const sm = std({ map: signTex('RECEPTION', 'Flip n Fly Gymnastics Academy', '#5a2483'), emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.5 });
    sm.emissiveMap = sm.map;
    const sp = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 0.69), sm);
    sp.position.set(c.x + 0.2, 3.0, c.z);
    sp.rotation.y = Math.PI / 2;
    sp.userData.noMerge = true;
    g.add(sp);
    const back = sp.clone();
    back.rotation.y = -Math.PI / 2;
    back.position.x -= 0.01;
    g.add(back);
    [-0.95, 0.95].forEach((dz) => g.add(mesh(rodGeo(new THREE.Vector3(c.x + 0.2, 3.3, c.z + dz), new THREE.Vector3(c.x + 0.2, 5.5, c.z + dz), 0.008, 4), M.dark, { cast: false })));

    // Waiting bench + gamle
    const w = F(10, 82);
    addBox(g, 2.2, 0.42, 0.6, M.navy, w.x, 0.21, w.z);
    addBox(g, 2.2, 0.45, 0.15, M.navy, w.x - 0, 0.62, w.z - 0.25);
    [[5, 99], [21, 99]].forEach(([fx, fz]) => {
      const p = F(fx, fz);
      const pot = mesh(new THREE.CylinderGeometry(0.24, 0.18, 0.45, 14), M.white);
      pot.position.set(p.x, 0.22, p.z);
      g.add(pot);
      [[0, 0.95, 0.34], [0.12, 1.25, 0.25], [-0.1, 0.75, 0.28]].forEach(([dx, y, r]) => {
        const b = mesh(new THREE.IcosahedronGeometry(r, 1), M.leaf);
        b.position.set(p.x + dx, y, p.z);
        g.add(b);
      });
    });
  }

  /* ================= EQUIPMENT ================= */
  const mat = (fx, fz, w, d, m = M.matBlue) => box(w, 0.2, d, m, fx, fz, 0.1);

  // Balance beam (junior / training) – 3 m lamba, upar 0.6 m par
  {
    const fx = 8.5;
    const fz = 22;
    mat(fx, fz, 1.4, 4.2);
    box(0.1, 0.12, 3.0, M.suede, fx, fz, 0.66);
    [-1.2, 1.2].forEach((dz) => {
      const p = F(fx, fz);
      addBox(g, 0.06, 0.42, 0.06, M.dark, p.x, 0.41, p.z + dz);
      addBox(g, 0.7, 0.05, 0.1, M.dark, p.x, 0.225, p.z + dz);
    });
  }

  // Uneven bars (junior) – low 1.3 m, high 1.9 m, 1.8 m rails
  {
    const p = F(8.5, 41);
    addBox(g, 3.0, 0.2, 3.4, M.matBlue, p.x, 0.1, p.z);
    const bars = [[-0.65, 1.3], [0.65, 1.9]];
    const geos = [];
    bars.forEach(([dx, h]) => {
      const x = p.x + dx;
      [-0.9, 0.9].forEach((dz) => geos.push(rodGeo(new THREE.Vector3(x, 0.2, p.z + dz), new THREE.Vector3(x, h, p.z + dz), 0.04, 10)));
    });
    g.add(mesh(mergeGeometries(geos), M.chrome));
    bars.forEach(([dx, h]) => {
      g.add(mesh(rodGeo(new THREE.Vector3(p.x + dx, h, p.z - 0.9), new THREE.Vector3(p.x + dx, h, p.z + 0.9), 0.02, 12), M.wood));
    });
  }

  /* ===== PIT SWING RINGS – pit ke beech, dono taraf pole, upar crossbar, 2 rings =====
     Bachcha rings pakad kar jhoolta hai aur seedha foam pit mein girta hai. */
  {
    const RX = 44; // pit ki lambai ka beech (feet)
    const back = F(RX, 1.45); // pit ke andar, back wall ke paas (pit floor par khada)
    const front = F(RX, 10.9); // pit ke front kinaare ke bahar, hall floor par
    const TOP = 4.2; // crossbar ki oonchai (m)
    const RING_Y = 1.95; // rings ki oonchai (m)
    const yellow = M.yellow;
    const geos = [
      rodGeo(new THREE.Vector3(back.x, -PIT_DEPTH, back.z), new THREE.Vector3(back.x, TOP + 0.05, back.z), 0.07, 12),
      rodGeo(new THREE.Vector3(front.x, 0, front.z), new THREE.Vector3(front.x, TOP + 0.05, front.z), 0.07, 12),
      rodGeo(new THREE.Vector3(back.x, TOP, back.z), new THREE.Vector3(front.x, TOP, front.z), 0.065, 12),
    ];
    g.add(mesh(mergeGeometries(geos), yellow));
    // base plates + back-wall bracket
    addBox(g, 0.4, 0.04, 0.4, M.dark, front.x, 0.02, front.z);
    addBox(g, 0.4, 0.04, 0.4, M.dark, back.x, -PIT_DEPTH + 0.02, back.z);
    const wb = F(RX, 0);
    g.add(mesh(rodGeo(new THREE.Vector3(wb.x, TOP - 0.35, wb.z), new THREE.Vector3(back.x, TOP - 0.35, back.z), 0.035, 8), M.dark));
    // safety pad – front pole par neeche se 1.8 m tak
    const pad = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 18), M.matBlue);
    pad.position.set(front.x, 0.9, front.z);
    g.add(pad);
    // 2 rings – crossbar ke beech, 50 cm ke gap par
    const mz = (back.z + front.z) / 2;
    const mx = (back.x + front.x) / 2;
    [-0.25, 0.25].forEach((dz) => {
      g.add(mesh(rodGeo(new THREE.Vector3(mx, TOP, mz + dz), new THREE.Vector3(mx, RING_Y + 0.1, mz + dz), 0.012, 4), M.dark, { cast: false }));
      const r = mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), M.wood);
      r.position.set(mx, RING_Y, mz + dz);
      r.rotation.y = Math.PI / 2;
      g.add(r);
    });
  }

  /* ===== RECEPTION KI SIDE: swing rings frame (pit jaisa) + parallel bars + mini trampoline ===== */
  // Rings frame – 2 pole (z ke along), upar crossbar, beech mein 2 rings, neeche mota crash mat
  {
    const fx = 8.5;
    const a = F(fx, 58.5);
    const b = F(fx, 69.5);
    const TOP = 4.2;
    const RING_Y = 1.95;
    g.add(mesh(mergeGeometries([
      rodGeo(new THREE.Vector3(a.x, 0, a.z), new THREE.Vector3(a.x, TOP + 0.05, a.z), 0.07, 12),
      rodGeo(new THREE.Vector3(b.x, 0, b.z), new THREE.Vector3(b.x, TOP + 0.05, b.z), 0.07, 12),
      rodGeo(new THREE.Vector3(a.x, TOP, a.z), new THREE.Vector3(b.x, TOP, b.z), 0.065, 12),
    ]), M.yellow));
    [a, b].forEach((p) => {
      addBox(g, 0.5, 0.04, 0.5, M.dark, p.x, 0.02, p.z);
      const pad = mesh(new THREE.CylinderGeometry(0.16, 0.16, 1.8, 18), M.matBlue);
      pad.position.set(p.x, 0.9, p.z);
      g.add(pad);
    });
    const c = F(fx, 64);
    addBox(g, 2.4, 0.35, 2.6, M.matBlue, c.x, 0.175, c.z); // crash mat
    addBox(g, 2.42, 0.05, 0.2, M.yellow, c.x, 0.36, c.z - 1.2);
    [-0.25, 0.25].forEach((dz) => {
      g.add(mesh(rodGeo(new THREE.Vector3(c.x, TOP, c.z + dz), new THREE.Vector3(c.x, RING_Y + 0.1, c.z + dz), 0.012, 4), M.dark, { cast: false }));
      const r = mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), M.wood);
      r.position.set(c.x, RING_Y, c.z + dz);
      r.rotation.y = Math.PI / 2;
      g.add(r);
    });
  }

  // Parallel bars (junior) – 2.4 m rails, 1.5 m oonchi, mat ke upar
  {
    const p = F(21, 62);
    addBox(g, 2.6, 0.2, 3.8, M.matBlue, p.x, 0.1, p.z);
    const H = 1.5;
    const geos = [];
    [-0.24, 0.24].forEach((dx) => {
      [-0.85, 0.85].forEach((dz) => geos.push(rodGeo(new THREE.Vector3(p.x + dx, 0.2, p.z + dz), new THREE.Vector3(p.x + dx, H, p.z + dz), 0.035, 10)));
    });
    g.add(mesh(mergeGeometries(geos), M.chrome));
    addBox(g, 0.9, 0.12, 0.12, M.dark, p.x, 0.26, p.z - 0.85);
    addBox(g, 0.9, 0.12, 0.12, M.dark, p.x, 0.26, p.z + 0.85);
    [-0.24, 0.24].forEach((dx) => {
      g.add(mesh(rodGeo(new THREE.Vector3(p.x + dx, H, p.z - 1.2), new THREE.Vector3(p.x + dx, H, p.z + 1.2), 0.025, 12), M.wood));
    });
  }

  // Mini trampoline – reception ke saamne, landing mat ke saath
  {
    const p = F(24, 86);
    const frame = mesh(new THREE.TorusGeometry(0.55, 0.035, 8, 32), M.dark);
    frame.rotation.x = Math.PI / 2;
    frame.position.set(p.x, 0.38, p.z);
    g.add(frame);
    const bed = mesh(new THREE.CircleGeometry(0.5, 32).rotateX(-Math.PI / 2), M.navy);
    bed.position.set(p.x, 0.37, p.z);
    g.add(bed);
    const skirt = mesh(new THREE.CylinderGeometry(0.58, 0.58, 0.08, 32, 1, true), M.matBlue);
    skirt.position.set(p.x, 0.36, p.z);
    g.add(skirt);
    const legs = [];
    for (let i = 0; i < 6; i++) {
      const t = (i / 6) * Math.PI * 2;
      legs.push(rodGeo(new THREE.Vector3(p.x + Math.cos(t) * 0.5, 0, p.z + Math.sin(t) * 0.5), new THREE.Vector3(p.x + Math.cos(t) * 0.53, 0.36, p.z + Math.sin(t) * 0.53), 0.02, 6));
    }
    g.add(mesh(mergeGeometries(legs), M.dark));
    const lm = F(24, 79.5);
    addBox(g, 2.0, 0.25, 1.6, M.matRed, lm.x, 0.125, lm.z);
  }

  // Vault runway – yahan log bhaag kar aate hain, springboard + table + landing mat (junior size)
  {
    const z = 74;
    const runway = new THREE.Mesh(polygonPlane([F(16, z - 1.5), F(46, z - 1.5), F(46, z + 1.5), F(16, z + 1.5)], 1), M.blue);
    runway.position.y = 0.02;
    g.add(runway);
    [z - 1.45, z + 1.45].forEach((fz) => {
      const l = new THREE.Mesh(polygonPlane([F(16, fz - 0.06), F(46, fz - 0.06), F(46, fz + 0.06), F(16, fz + 0.06)], 1), M.line);
      l.position.y = 0.03;
      g.add(l);
    });
    const sb = F(47, z);
    const board = addBox(g, 1.0, 0.07, 0.5, M.wood, sb.x, 0.13, sb.z);
    board.rotation.z = 0.16;
    const t = F(50, z);
    addBox(g, 0.8, 0.06, 0.6, M.dark, t.x, 0.03, t.z);
    g.add(mesh(rodGeo(new THREE.Vector3(t.x, 0.06, t.z), new THREE.Vector3(t.x, 0.84, t.z), 0.09, 14), M.dark));
    const top = mesh(new THREE.CapsuleGeometry(0.36, 0.36, 6, 14), M.suede);
    top.rotation.z = Math.PI / 2;
    top.scale.set(0.4, 1, 1.05);
    top.position.set(t.x, 0.95, t.z);
    g.add(top);
    const lm = F(55.5, z);
    addBox(g, 2.4, 0.3, 2.0, M.matBlue, lm.x, 0.15, lm.z);
    addBox(g, 2.42, 0.05, 0.2, M.yellow, lm.x, 0.31, lm.z - 0.9);
  }

  /* ================= CEILING LIGHTS (LED high-bay) ================= */
  {
    const glow = std({ color: '#ffffff', emissive: '#fff4e0', emissiveIntensity: 2.6 });
    const housing = [];
    const panels = [];
    const cables = [];
    const Y = 9.3;
    [14, 30, 46].forEach((fx) => {
      [12, 30, 48, 66, 84].forEach((fz) => {
        const p = F(fx, fz);
        const hb = new THREE.BoxGeometry(1.7, 0.09, 0.4);
        hb.translate(p.x, Y, p.z);
        housing.push(hb);
        const pb = new THREE.BoxGeometry(1.58, 0.02, 0.3);
        pb.translate(p.x, Y - 0.055, p.z);
        panels.push(pb);
        [-0.7, 0.7].forEach((dx) => cables.push(rodGeo(new THREE.Vector3(p.x + dx, Y, p.z), new THREE.Vector3(p.x + dx, Y + 1.4, p.z), 0.008, 4)));
      });
    });
    g.add(mesh(mergeGeometries(housing), M.dark, { cast: false }));
    g.add(mesh(mergeGeometries(panels), glow, { cast: false }));
    g.add(mesh(mergeGeometries(cables), M.dark, { cast: false }));
  }

  /* ================= AC – 2 bade spiral ducts + diffusers ================= */
  {
    const duct = std({ color: '#c9ced3', metalness: 0.75, roughness: 0.35 });
    const grille = std({ color: '#e9ecef', roughness: 0.5 });
    const Y = 8.3;
    const ducts = [];
    const diffs = [];
    [[12, 1.2, 72], [50, 1.2, 64]].forEach(([fx, z0, z1]) => {
      const a = V3(fx, z0, Y);
      const b = V3(fx, z1, Y);
      ducts.push(rodGeo(a, b, 0.34, 18));
      // seams (har 1.5 m par ring)
      const len = a.distanceTo(b);
      for (let t = 1.5; t < len; t += 1.5) {
        const p = a.clone().lerp(b, t / len);
        const r = new THREE.TorusGeometry(0.345, 0.018, 6, 18);
        r.translate(p.x, p.y, p.z);
        ducts.push(r);
      }
      // end cap + hangers
      const cap = new THREE.CylinderGeometry(0.34, 0.34, 0.04, 18).rotateX(Math.PI / 2);
      cap.translate(b.x, b.y, b.z);
      ducts.push(cap);
      for (let fz = z0 + 6; fz < z1; fz += 12) {
        const p = V3(fx, fz, Y);
        ducts.push(rodGeo(new THREE.Vector3(p.x, Y + 0.34, p.z), new THREE.Vector3(p.x, Y + 2.2, p.z), 0.012, 4));
        // diffuser neeche
        const d1 = new THREE.CylinderGeometry(0.16, 0.16, 0.25, 12);
        d1.translate(p.x, Y - 0.42, p.z);
        diffs.push(d1);
        const d2 = new THREE.BoxGeometry(0.6, 0.06, 0.6);
        d2.translate(p.x, Y - 0.57, p.z);
        diffs.push(d2);
      }
    });
    g.add(mesh(mergeGeometries(ducts.map((x) => (x.index ? x.toNonIndexed() : x))), duct, { cast: false }));
    g.add(mesh(mergeGeometries(diffs.map((x) => (x.index ? x.toNonIndexed() : x))), grille, { cast: false }));
    // AC unit (AHU) peeche ki deewar par, ducts ke shuru mein
    [[12], [50]].forEach(([fx]) => {
      const p = F(fx, 2.2);
      addBox(g, 1.6, 1.2, 1.4, grille, p.x, Y, p.z);
      addBox(g, 1.3, 0.9, 0.04, M.dark, p.x, Y, p.z + 0.72);
    });
  }

  // Equipment ki shadow chhat ke neeche nahi padti – cast band (fast)
  g.traverse((o) => {
    o.castShadow = false;
  });
  return g;
}
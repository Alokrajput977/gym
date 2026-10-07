import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { planPt, FT, PIT, PIT_DEPTH, SPRING, SPRING_MAIN } from '../plan.js';
import { addBox, mesh, rodGeo, polygonPlane } from '../helpers.js';

/*
 * GYM HALL KA ANDAR (nayi drawing ke hisaab se)
 *  - Beech mein GYM SPRING FLOOR (37' x 36' + pit tak 7' ka hissa)
 *  - Back-right kone mein 5 FT DEEP FOAM PIT
 *  - Entrance se andar aate hi LEFT mein RECEPTION
 *  - Equipment: balance beams, uneven bars, rings, pommel horse, parallel bars,
 *    trampoline, vault runway + table
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
    const p = F(40, 1.05);
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
    const sm = std({ map: signTex('RECEPTION', 'Gymnastics Academy', '#5a2483'), emissive: '#ffffff', emissiveIntensity: 0.15, roughness: 0.5 });
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

  // Balance beam – left strip, z ke along (sirf ek – hall khula rahe)
  [8.5].forEach((fx) => {
    mat(fx, 22, 1.8, 6.4);
    box(0.1, 0.16, 5.0, M.suede, fx, 22, 1.2);
    [-1.9, 1.9].forEach((dz) => {
      const p = F(fx, 22);
      addBox(g, 0.08, 1.0, 0.08, M.dark, p.x, 0.62, p.z + dz);
      addBox(g, 1.0, 0.06, 0.12, M.dark, p.x, 0.23, p.z + dz);
    });
  });

  // Uneven bars – left strip
  {
    const p = F(8.5, 41);
    addBox(g, 4.0, 0.2, 5.0, M.matBlue, p.x, 0.1, p.z);
    const geos = [];
    [[-0.9, 1.7], [0.9, 2.5]].forEach(([dx, h]) => {
      const x = p.x + dx;
      [-1.3, 1.3].forEach((dz) => geos.push(rodGeo(new THREE.Vector3(x, 0.2, p.z + dz), new THREE.Vector3(x, h, p.z + dz), 0.05, 10)));
    });
    g.add(mesh(mergeGeometries(geos), M.chrome));
    [[-0.9, 1.7], [0.9, 2.5]].forEach(([dx, h]) => {
      g.add(mesh(rodGeo(new THREE.Vector3(p.x + dx, h, p.z - 1.3), new THREE.Vector3(p.x + dx, h, p.z + 1.3), 0.022, 12), M.wood));
    });
  }

  // Rings
  {
    const p = F(8.5, 58);
    addBox(g, 4.0, 0.2, 3.6, M.matBlue, p.x, 0.1, p.z);
    const top = 5.6;
    const geos = [];
    [-1.6, 1.6].forEach((dz) => {
      geos.push(rodGeo(new THREE.Vector3(p.x - 1.9, 0.2, p.z + dz), new THREE.Vector3(p.x, top, p.z + dz), 0.06, 10));
      geos.push(rodGeo(new THREE.Vector3(p.x + 1.9, 0.2, p.z + dz), new THREE.Vector3(p.x, top, p.z + dz), 0.06, 10));
    });
    geos.push(rodGeo(new THREE.Vector3(p.x, top, p.z - 1.7), new THREE.Vector3(p.x, top, p.z + 1.7), 0.07, 10));
    g.add(mesh(mergeGeometries(geos), M.chrome));
    [-0.25, 0.25].forEach((dz) => {
      g.add(mesh(rodGeo(new THREE.Vector3(p.x, top, p.z + dz), new THREE.Vector3(p.x, 2.85, p.z + dz), 0.012, 4), M.dark, { cast: false }));
      const r = mesh(new THREE.TorusGeometry(0.09, 0.016, 8, 20), M.wood);
      r.position.set(p.x, 2.76, p.z + dz);
      r.rotation.y = Math.PI / 2;
      g.add(r);
    });
  }

  // Vault runway – yahan log bhaag kar aate hain, springboard + table + landing mat
  {
    const z = 74;
    const runway = new THREE.Mesh(polygonPlane([F(16, z - 2), F(46, z - 2), F(46, z + 2), F(16, z + 2)], 1), M.blue);
    runway.position.y = 0.02;
    g.add(runway);
    [z - 1.95, z + 1.95].forEach((fz) => {
      const l = new THREE.Mesh(polygonPlane([F(16, fz - 0.08), F(46, fz - 0.08), F(46, fz + 0.08), F(16, fz + 0.08)], 1), M.line);
      l.position.y = 0.03;
      g.add(l);
    });
    const sb = F(47, z);
    const board = addBox(g, 1.2, 0.08, 0.6, M.wood, sb.x, 0.16, sb.z);
    board.rotation.z = 0.18;
    const t = F(50.5, z);
    addBox(g, 1.0, 0.08, 0.8, M.dark, t.x, 0.04, t.z);
    g.add(mesh(rodGeo(new THREE.Vector3(t.x, 0.08, t.z), new THREE.Vector3(t.x, 1.08, t.z), 0.12, 14), M.dark));
    const top = mesh(new THREE.CapsuleGeometry(0.42, 0.45, 6, 14), M.suede);
    top.rotation.z = Math.PI / 2;
    top.scale.set(0.42, 1, 1.1);
    top.position.set(t.x, 1.2, t.z);
    g.add(top);
    const lm = F(57, z);
    addBox(g, 3.4, 0.4, 3.0, M.matBlue, lm.x, 0.2, lm.z);
    addBox(g, 3.42, 0.06, 0.25, M.yellow, lm.x, 0.41, lm.z - 1.38);
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
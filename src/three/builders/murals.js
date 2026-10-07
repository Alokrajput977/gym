import * as THREE from 'three';
import { SIDES, PILLARS, WALL_T as T } from '../plan.js';
import { sideBox } from '../helpers.js';

/*
 * ANDAR KI DEEWARON PAR GYMNASTICS MURALS
 *  - Left wall: Leap, Balance, Strength, Grace
 *  - Right wall: Power, Flight, Flexibility, Courage
 * Har mural do pillars ke beech (ek bay), ground floor par, frame + picture lights ke saath.
 * Pehli baar andar jaane par hi banta hai (lazy) – page load par koi kharcha nahi.
 */

const D2R = Math.PI / 180;

function canvasTex(w, h, draw, { srgb = true, repeat = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

const POSES = {
  leap: { t: -85, la1: -130, la2: -140, ra1: -50, ra2: -40, ll1: 178, ll2: 182, rl1: -8, rl2: -4 },
  handstand: { t: 90, la1: 96, la2: 92, ra1: 84, ra2: 88, ll1: -100, ll2: -112, rl1: -80, rl2: -62 },
  arabesque: { t: -62, la1: -20, la2: -12, ra1: -165, ra2: -170, rl1: 92, rl2: 90, ll1: -165, ll2: -150 },
  ribbon: { t: -98, la1: -112, la2: -118, ra1: -35, ra2: -20, rl1: 95, rl2: 93, ll1: 72, ll2: 110 },
  cross: { t: -90, la1: 180, la2: 180, ra1: 0, ra2: 0, ll1: 90, ll2: 90, rl1: 88, rl2: 90 },
  vault: { t: -15, la1: -20, la2: -18, ra1: -10, ra2: -8, ll1: 168, ll2: 170, rl1: 163, rl2: 166 },
  bridge: { t: 150, la1: 100, la2: 95, ra1: 110, ra2: 100, ll1: 70, ll2: 100, rl1: -60, rl2: -65 },
  cartwheel: { t: 85, la1: 125, la2: 125, ra1: 55, ra2: 55, ll1: -130, ll2: -132, rl1: -50, rl2: -48 },
};

function joints(pose, x, y, s) {
  const v = (a, l) => [Math.cos(a * D2R) * l * s, Math.sin(a * D2R) * l * s];
  const add = (p, q) => [p[0] + q[0], p[1] + q[1]];
  const hip = [x, y];
  const neck = add(hip, v(pose.t, 170));
  const head = add(neck, v(pose.t, 62));
  const lE = add(neck, v(pose.la1, 105));
  const lH = add(lE, v(pose.la2, 95));
  const rE = add(neck, v(pose.ra1, 105));
  const rH = add(rE, v(pose.ra2, 95));
  const lK = add(hip, v(pose.ll1, 140));
  const lF = add(lK, v(pose.ll2, 130));
  const lT = add(lF, v(pose.ll2, 26));
  const rK = add(hip, v(pose.rl1, 140));
  const rF = add(rK, v(pose.rl2, 130));
  const rT = add(rF, v(pose.rl2, 26));
  const bun = add(head, v(pose.t + 90, 30));
  return { hip, neck, head, lE, lH, rE, rH, lK, lF, lT, rK, rF, rT, bun };
}

function drawFigure(ctx, J, s, color) {
  ctx.strokeStyle = color;
  ctx.fillStyle = color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  const line = (pts, w) => {
    ctx.lineWidth = w * s;
    ctx.beginPath();
    ctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i][0], pts[i][1]);
    ctx.stroke();
  };
  line([J.hip, J.lK, J.lF], 32);
  line([J.lF, J.lT], 16);
  line([J.neck, J.lE, J.lH], 24);
  line([J.hip, J.neck], 50);
  line([J.hip, J.rK, J.rF], 32);
  line([J.rF, J.rT], 16);
  line([J.neck, J.rE, J.rH], 24);
  ctx.beginPath();
  ctx.arc(J.head[0], J.head[1], 31 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(J.bun[0], J.bun[1], 14 * s, 0, Math.PI * 2);
  ctx.fill();
}

const MURALS = {
  west: [
    { pose: 'leap', word: 'LEAP', colors: ['#2a1457', '#8e2a8f', '#ff6fa8'], hip: [1230, 640], trail: true },
    { pose: 'arabesque', word: 'BALANCE', colors: ['#0b3346', '#13798a', '#5fd3c4'], hip: [1250, 600], prop: 'beam' },
    { pose: 'handstand', word: 'STRENGTH', colors: ['#4a1010', '#c2410c', '#fbbf24'], hip: [1250, 520], prop: 'floor' },
    { pose: 'ribbon', word: 'GRACE', colors: ['#17154f', '#4338ca', '#c4b5fd'], hip: [1230, 590], prop: 'ribbon' },
  ],
  east: [
    { pose: 'cross', word: 'POWER', colors: ['#0a1f44', '#1d4ed8', '#38bdf8'], hip: [1250, 620], prop: 'rings' },
    { pose: 'vault', word: 'FLIGHT', colors: ['#3b0a0a', '#dc2626', '#fb923c'], hip: [1150, 470], prop: 'vault', trail: true },
    { pose: 'bridge', word: 'FLEXIBILITY', colors: ['#06302b', '#0f766e', '#86efac'], hip: [1180, 560], prop: 'floor' },
    { pose: 'cartwheel', word: 'COURAGE', colors: ['#4a044e', '#c026d3', '#fde047'], hip: [1220, 560], prop: 'floor', trail: true },
  ],
};

function muralTexture(def) {
  const W = 2048;
  const H = 1120;
  const S = 0.75; // 1536 x 840 canvas
  return canvasTex(W * S, H * S, (ctx) => {
    ctx.scale(S, S);
    const [c0, c1, c2] = def.colors;
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0, c0);
    bg.addColorStop(0.55, c1);
    bg.addColorStop(1, c2);
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const s = 1.25;
    const J = joints(POSES[def.pose], def.hip[0], def.hip[1], s);

    // Glow + rings
    const glow = ctx.createRadialGradient(def.hip[0], def.hip[1] - 100, 20, def.hip[0], def.hip[1] - 100, 560);
    glow.addColorStop(0, 'rgba(255,255,255,0.32)');
    glow.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(255,255,255,0.12)';
    ctx.lineWidth = 6;
    [300, 420, 540].forEach((rad) => {
      ctx.beginPath();
      ctx.arc(def.hip[0], def.hip[1] - 100, rad, 0, Math.PI * 2);
      ctx.stroke();
    });

    // Speed stripes
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    for (let i = 0; i < 7; i++) {
      const x = -300 + i * 170;
      ctx.beginPath();
      ctx.moveTo(x, H);
      ctx.lineTo(x + 70, H);
      ctx.lineTo(x + 620, 0);
      ctx.lineTo(x + 550, 0);
      ctx.closePath();
      ctx.fill();
    }

    // Halftone dots (top-left)
    for (let gx = 0; gx < 14; gx++) {
      for (let gy = 0; gy < 8; gy++) {
        const rad = Math.max(0, 11 - (gx + gy) * 0.75);
        if (rad <= 0.5) continue;
        ctx.fillStyle = 'rgba(255,255,255,0.22)';
        ctx.beginPath();
        ctx.arc(80 + gx * 38, 80 + gy * 38, rad, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // Big background word
    ctx.font = '900 300px "Arial Black", Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = 'rgba(255,255,255,0.13)';
    ctx.fillText(def.word, 60, H - 70, 1500);

    // Props
    const maxY = Math.max(J.lH[1], J.rH[1], J.lT[1], J.rT[1], J.head[1]) + 40 * s;
    if (def.prop === 'beam') {
      const top = Math.max(J.lT[1], J.rT[1]) + 6;
      ctx.fillStyle = '#e8c9a0';
      ctx.fillRect(def.hip[0] - 560, top, 1120, 34);
      ctx.fillStyle = 'rgba(0,0,0,0.35)';
      [-420, 420].forEach((dx) => {
        ctx.beginPath();
        ctx.moveTo(def.hip[0] + dx - 10, top + 34);
        ctx.lineTo(def.hip[0] + dx + 10, top + 34);
        ctx.lineTo(def.hip[0] + dx + 40, H);
        ctx.lineTo(def.hip[0] + dx - 40, H);
        ctx.fill();
      });
    }
    if (def.prop === 'floor') {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      ctx.fillRect(140, Math.min(H - 40, maxY), W - 280, 10);
    }
    if (def.prop === 'rings') {
      ctx.strokeStyle = 'rgba(255,255,255,0.85)';
      [J.lH, J.rH].forEach((h) => {
        ctx.lineWidth = 8;
        ctx.beginPath();
        ctx.moveTo(h[0], 0);
        ctx.lineTo(h[0], h[1] - 34);
        ctx.stroke();
        ctx.lineWidth = 10;
        ctx.beginPath();
        ctx.arc(h[0], h[1], 32, 0, Math.PI * 2);
        ctx.stroke();
      });
    }
    if (def.prop === 'vault') {
      ctx.fillStyle = 'rgba(255,255,255,0.9)';
      ctx.beginPath();
      ctx.ellipse(820, 830, 170, 42, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(0,0,0,0.3)';
      ctx.fillRect(805, 860, 30, 220);
      ctx.fillRect(700, 1060, 240, 24);
    }
    if (def.prop === 'ribbon') {
      ctx.strokeStyle = '#ffd84a';
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(J.rH[0], J.rH[1]);
      ctx.bezierCurveTo(J.rH[0] + 420, J.rH[1] - 120, J.rH[0] + 380, J.rH[1] + 260, J.rH[0] + 180, J.rH[1] + 300);
      ctx.bezierCurveTo(J.rH[0] - 20, J.rH[1] + 340, J.rH[0] + 120, J.rH[1] + 600, J.rH[0] + 460, J.rH[1] + 640);
      ctx.stroke();
    }

    // Motion trail
    if (def.trail) {
      [3, 2, 1].forEach((k) => {
        ctx.globalAlpha = 0.07 * (4 - k);
        const G = joints(POSES[def.pose], def.hip[0] - 120 * k, def.hip[1] + 18 * k, s);
        drawFigure(ctx, G, s, '#ffffff');
      });
      ctx.globalAlpha = 1;
    }

    // Main figure
    ctx.shadowColor = 'rgba(0,0,0,0.35)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 12;
    drawFigure(ctx, J, s, '#ffffff');
    ctx.shadowColor = 'transparent';

    // Label
    ctx.textAlign = 'right';
    ctx.fillStyle = '#ffffff';
    ctx.font = '900 92px "Arial Black", Arial, sans-serif';
    ctx.fillText(def.word, W - 90, 150, 760);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(W - 90 - 360, 176, 360, 9);
    ctx.font = '700 40px Arial, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText('Gymnastics Academy', W - 90, 238);

    ctx.strokeStyle = 'rgba(255,255,255,0.55)';
    ctx.lineWidth = 8;
    ctx.strokeRect(30, 30, W - 60, H - 60);
  }, { repeat: false });
}


const MURAL_W = 4.6;
const MURAL_H = (MURAL_W * 1120) / 2048;
const MURAL_Y = 0.75 + MURAL_H / 2;

// kis bay mein (pillar i aur i+1 ke beech) – left bay 2 mein fire exit hai
const BAYS = { left: [0, 1, 3, 4], right: [0, 1, 2, 3] };

export function buildMurals(mats, own) {
  const g = new THREE.Group();
  g.name = 'murals';

  [['left', 'west'], ['right', 'east']].forEach(([sideName, setName]) => {
    const side = SIDES[sideName];
    const ps = PILLARS.filter((p) => p.side === sideName).map((p) => p.s);
    const inward = Math.atan2(-side.n.x, -side.n.z);
    BAYS[sideName].forEach((bay, k) => {
      const def = MURALS[setName][k];
      const s = (ps[bay] + ps[bay + 1]) / 2;
      const w = Math.min(MURAL_W, ps[bay + 1] - ps[bay] - 1.2);
      const h = (w * 1120) / 2048;
      const mat = new THREE.MeshStandardMaterial({ map: muralTexture(def), roughness: 0.75 });
      own.push(mat);
      const p = side.at(s, -T - 0.025);
      const m = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
      m.position.set(p.x, MURAL_Y, p.z);
      m.rotation.y = inward;
      m.userData.noMerge = true;
      g.add(m);
      // Frame
      const off = -T - 0.03;
      sideBox(g, side, s - w / 2 - 0.08, s + w / 2 + 0.08, MURAL_Y + h / 2, MURAL_Y + h / 2 + 0.1, 0.06, mats.frame, off);
      sideBox(g, side, s - w / 2 - 0.08, s + w / 2 + 0.08, MURAL_Y - h / 2 - 0.1, MURAL_Y - h / 2, 0.06, mats.frame, off);
      sideBox(g, side, s - w / 2 - 0.08, s - w / 2, MURAL_Y - h / 2, MURAL_Y + h / 2, 0.06, mats.frame, off);
      sideBox(g, side, s + w / 2, s + w / 2 + 0.08, MURAL_Y - h / 2, MURAL_Y + h / 2, 0.06, mats.frame, off);
      // Picture lights
      [-1.4, 0, 1.4].forEach((d) => {
        sideBox(g, side, s + d - 0.22, s + d + 0.22, MURAL_Y + h / 2 + 0.3, MURAL_Y + h / 2 + 0.36, 0.3, mats.frame, -T - 0.15);
        sideBox(g, side, s + d - 0.18, s + d + 0.18, MURAL_Y + h / 2 + 0.29, MURAL_Y + h / 2 + 0.3, 0.2, mats.lamp, -T - 0.2, { cast: false });
      });
    });
  });
  return g;
}
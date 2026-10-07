import * as THREE from 'three';

/*
 * Saare textures canvas par procedurally bante hain (koi image file nahi).
 * Ek tile = 1 meter (grass/paver alag). Sirf wahi textures jo is building mein lagte hain.
 */

const rand = (a, b) => a + Math.random() * (b - a);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

function makeCanvas(w, h = w) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')];
}

function toTexture(canvas, aniso, srgb = true) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = aniso;
  return t;
}

function speckle(ctx, w, h, count, colors, alpha = [0.04, 0.14], size = [1, 3]) {
  for (let i = 0; i < count; i++) {
    ctx.globalAlpha = rand(alpha[0], alpha[1]);
    ctx.fillStyle = pick(colors);
    const s = rand(size[0], size[1]);
    ctx.fillRect(Math.random() * w, Math.random() * h, s, s);
  }
  ctx.globalAlpha = 1;
}

function brick(aniso) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  const [b, bctx] = makeCanvas(S);
  ctx.fillStyle = '#b5a893';
  ctx.fillRect(0, 0, S, S);
  bctx.fillStyle = '#000';
  bctx.fillRect(0, 0, S, S);
  const rows = 12;
  const cols = 4;
  const rh = S / rows;
  const cw = S / cols;
  const m = 5;
  const palette = ['#8f3b28', '#9c4430', '#a34d36', '#87382a', '#964a33', '#7d3424', '#a8573d', '#93422c'];
  for (let r = 0; r < rows; r++) {
    const offset = (r % 2) * (cw / 2);
    for (let k = 0; k < cols; k++) {
      const x = k * cw + offset;
      const color = pick(palette);
      const shade = rand(-0.08, 0.06);
      const draw = (xx) => {
        ctx.fillStyle = color;
        ctx.fillRect(xx + m / 2, r * rh + m / 2, cw - m, rh - m);
        ctx.globalAlpha = Math.abs(shade);
        ctx.fillStyle = shade < 0 ? '#000' : '#fff';
        ctx.fillRect(xx + m / 2, r * rh + m / 2, cw - m, rh - m);
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = '#2a120b';
        ctx.fillRect(xx + m / 2, r * rh + rh - m / 2 - 3, cw - m, 3);
        ctx.globalAlpha = 1;
        bctx.fillStyle = '#fff';
        bctx.fillRect(xx + m / 2 + 1, r * rh + m / 2 + 1, cw - m - 2, rh - m - 2);
      };
      draw(x);
      if (x + cw > S) draw(x - S);
    }
  }
  speckle(ctx, S, S, 7000, ['#000', '#3b1a10', '#d9b08c', '#fff'], [0.04, 0.16], [1, 2.5]);
  return { map: toTexture(c, aniso), bump: toTexture(b, aniso, false) };
}

function plaster(aniso) {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#f3f0ea';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 5000, ['#000', '#7a6c58', '#fff'], [0.02, 0.07], [1, 3]);
  return toTexture(c, aniso);
}

function stone(aniso) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#5d5850';
  ctx.fillRect(0, 0, S, S);
  const palette = ['#8d867a', '#9a9284', '#7f786c', '#a39b8b', '#8a7f6e', '#968b78'];
  const rows = 4;
  const rh = S / rows;
  for (let r = 0; r < rows; r++) {
    let x = 0;
    while (x < S) {
      let w = rand(120, 230);
      if (S - (x + w) < 90) w = S - x;
      ctx.fillStyle = pick(palette);
      ctx.fillRect(x + 4, r * rh + 4, w - 8, rh - 8);
      ctx.globalAlpha = 0.18;
      ctx.fillStyle = '#000';
      ctx.fillRect(x + 4, r * rh + rh - 10, w - 8, 6);
      ctx.globalAlpha = 1;
      x += w;
    }
  }
  speckle(ctx, S, S, 9000, ['#000', '#fff', '#4a4038'], [0.04, 0.14], [1, 3]);
  return toTexture(c, aniso);
}

function concrete(aniso) {
  const S = 256;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#b3b0a8';
  ctx.fillRect(0, 0, S, S);
  speckle(ctx, S, S, 6000, ['#000', '#fff', '#6b675f'], [0.03, 0.12], [1, 2.5]);
  return toTexture(c, aniso);
}

function paver(aniso) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#5b5852';
  ctx.fillRect(0, 0, S, S);
  const cols = 5;
  const rows = 10;
  const cw = S / cols;
  const rh = S / rows;
  const palette = ['#9d9a93', '#a7a39b', '#918d85', '#a29d93'];
  for (let r = 0; r < rows; r++) {
    for (let k = 0; k < cols; k++) {
      ctx.fillStyle = (r + k) % 7 === 0 ? '#8f5e4c' : pick(palette);
      ctx.fillRect(k * cw + 3, r * rh + 3, cw - 6, rh - 6);
    }
  }
  speckle(ctx, S, S, 7000, ['#000', '#fff'], [0.03, 0.1], [1, 2]);
  return toTexture(c, aniso);
}

function grass(aniso) {
  const S = 512;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#5c7a37';
  ctx.fillRect(0, 0, S, S);
  const greens = ['#4b6a2b', '#6d8c40', '#7f9b4b', '#3e5a24', '#8aa356', '#5f7f35'];
  for (let i = 0; i < 12000; i++) {
    const x = Math.random() * S;
    const y = Math.random() * S;
    ctx.strokeStyle = pick(greens);
    ctx.globalAlpha = rand(0.25, 0.7);
    ctx.lineWidth = rand(0.6, 1.6);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + rand(-2, 2), y - rand(2, 6));
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
  return toTexture(c, aniso);
}

function hazard(aniso) {
  const S = 128;
  const [c, ctx] = makeCanvas(S);
  ctx.fillStyle = '#f2c230';
  ctx.fillRect(0, 0, S, S);
  ctx.fillStyle = '#1b1b1b';
  for (let k = -S; k < S * 2; k += S / 2) {
    ctx.beginPath();
    ctx.moveTo(k, 0);
    ctx.lineTo(k + S / 4, 0);
    ctx.lineTo(k + S / 4 + S, S);
    ctx.lineTo(k + S, S);
    ctx.closePath();
    ctx.fill();
  }
  return toTexture(c, aniso);
}

// Trapezoidal metal cladding – vertical ribs
function cladding(aniso) {
  const [c, ctx] = makeCanvas(256, 64);
  ctx.fillStyle = '#d6d6d6';
  ctx.fillRect(0, 0, 256, 64);
  const ribs = 5;
  const rw = 256 / ribs;
  for (let i = 0; i < ribs; i++) {
    const x = i * rw;
    const gr = ctx.createLinearGradient(x, 0, x + rw * 0.3, 0);
    gr.addColorStop(0, '#9a9a9a');
    gr.addColorStop(0.5, '#ffffff');
    gr.addColorStop(1, '#b4b4b4');
    ctx.fillStyle = gr;
    ctx.fillRect(x, 0, rw * 0.3, 64);
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(x + rw * 0.3, 0, 3, 64);
  }
  return toTexture(c, aniso);
}

// Standing-seam roof – seams har 0.5 m
function roof(aniso) {
  const [c, ctx] = makeCanvas(64, 256);
  ctx.fillStyle = '#c4c9cc';
  ctx.fillRect(0, 0, 64, 256);
  [0.25, 0.75].forEach((t) => {
    const y = t * 256;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, y + 3, 64, 3);
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillRect(0, y, 64, 3);
  });
  return toTexture(c, aniso);
}

function shutter(aniso) {
  const [c, ctx] = makeCanvas(64, 128);
  ctx.fillStyle = '#c9cdd1';
  ctx.fillRect(0, 0, 64, 128);
  for (let y = 0; y < 128; y += 16) {
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.fillRect(0, y, 64, 2);
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.fillRect(0, y + 2, 64, 2);
  }
  return toTexture(c, aniso);
}

// Steel grating (stair treads, landing)
function grating(aniso) {
  const [c, ctx] = makeCanvas(128, 128);
  ctx.fillStyle = '#2b3036';
  ctx.fillRect(0, 0, 128, 128);
  ctx.fillStyle = '#6b737c';
  for (let x = 0; x < 128; x += 8) ctx.fillRect(x, 0, 3, 128);
  for (let y = 0; y < 128; y += 32) ctx.fillRect(0, y, 128, 2);
  return toTexture(c, aniso);
}

let cache = null;
export function getTextures(maxAniso = 8) {
  if (cache) return cache;
  const a = Math.min(maxAniso, 16);
  const b = brick(a);
  cache = {
    brick: b.map,
    brickBump: b.bump,
    plaster: plaster(a),
    stone: stone(a),
    concrete: concrete(a),
    paver: paver(a),
    grass: grass(a),
    hazard: hazard(a),
    cladding: cladding(a),
    roof: roof(a),
    shutter: shutter(a),
    grating: grating(a),
  };
  return cache;
}

export function disposeTextures() {
  if (!cache) return;
  Object.values(cache).forEach((t) => t.dispose());
  cache = null;
}

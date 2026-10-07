/*
 * DRAWING SE PLAN (feet -> meters)
 *
 *            BACK SIDE  60'
 *   A01 ─────────────────────── B01
 *    │                            ╲
 *    │ LEFT SIDE 101'-6"           ╲  RIGHT SIDE 106'-11.8"
 *    │ (seedhi)                     ╲ (tirchhi)
 *   A06 ───────────────────────────── B06
 *            FRONT SIDE 76'  (entrance)
 *
 * Pillars 1' x 1':
 *   Left  A01..A06: 20' clear gap  -> 21' centre-to-centre, aakhri 15'-6" -> 16'-6"
 *   Right B01..B06: 20'-2.7" gap   -> 21'-2.7" c/c,          aakhri 20'-0.1" -> 21'-0.1"
 *
 * Three.js axes: x = right (B side), z = front (entrance), y = upar.
 */

export const FT = 0.3048;

// Corners (feet) – B06 dono naapon (front 76', right 106'-11.8") se nikala gaya
const RAW = {
  A01: [0, 0],
  B01: [60, 0],
  B06: [75.878, 105.798],
  A06: [0, 101.5],
};

// Building ko origin ke beech mein laao
const cx = ((RAW.A01[0] + RAW.B01[0] + RAW.B06[0] + RAW.A06[0]) / 4) * FT;
const cz = ((RAW.A01[1] + RAW.B01[1] + RAW.B06[1] + RAW.A06[1]) / 4) * FT;
const P = ([x, z]) => ({ x: x * FT - cx, z: z * FT - cz });

export const CORNERS = {
  A01: P(RAW.A01), // back-left
  B01: P(RAW.B01), // back-right
  B06: P(RAW.B06), // front-right
  A06: P(RAW.A06), // front-left
};

// Footprint polygon (counter-clockwise jab upar se dekho: x right, z neeche)
export const FOOTPRINT = [CORNERS.A01, CORNERS.A06, CORNERS.B06, CORNERS.B01];

/** Ek side ka frame: p0 -> p1, length, direction, outward normal, rotY. */
export function sideFrame(p0, p1, outward) {
  const dx = p1.x - p0.x;
  const dz = p1.z - p0.z;
  const len = Math.hypot(dx, dz);
  const dir = { x: dx / len, z: dz / len };
  // dono normals mein se jo "outward" point ki taraf ho
  let n = { x: dz / len, z: -dx / len };
  const mid = { x: (p0.x + p1.x) / 2, z: (p0.z + p1.z) / 2 };
  if ((outward.x - mid.x) * n.x + (outward.z - mid.z) * n.z < 0) n = { x: -n.x, z: -n.z };
  return {
    p0,
    p1,
    len,
    dir,
    n,
    rotY: Math.atan2(-dz, dx),
    /** s = side ke along distance (p0 se), off = bahar ki taraf offset */
    at(s, off = 0) {
      return { x: p0.x + dir.x * s + n.x * off, z: p0.z + dir.z * s + n.z * off };
    },
  };
}

const far = (x, z) => ({ x, z });
export const SIDES = {
  back: sideFrame(CORNERS.A01, CORNERS.B01, far(0, -100)),
  front: sideFrame(CORNERS.A06, CORNERS.B06, far(0, 100)),
  left: sideFrame(CORNERS.A01, CORNERS.A06, far(-100, 0)),
  right: sideFrame(CORNERS.B01, CORNERS.B06, far(100, 0)),
};

// Pillars – side ke along distance (meters), drawing ke hisaab se
const leftS = [0.5, 21.5, 42.5, 63.5, 84.5, 101.0].map((f) => f * FT);
const g = 20 + 2.7 / 12 + 1; // 21'-2.7" c/c
const rightS = [0.5, 0.5 + g, 0.5 + 2 * g, 0.5 + 3 * g, 0.5 + 4 * g, 0.5 + 4 * g + (20 + 0.1 / 12 + 1)].map((f) => f * FT);

export const PILLARS = [
  ...leftS.map((s, i) => ({ id: `A0${i + 1}`, side: 'left', s })),
  ...rightS.map((s, i) => ({ id: `B0${i + 1}`, side: 'right', s })),
];

// Heights (meters)
export const FLOOR_H = 3.6; // har floor
export const FLOORS = 3;
export const EAVE_H = FLOOR_H * FLOORS; // 10.8 m
export const ROOF_RISE = 2.6; // curved roof ki oonchai beech mein
export const PODIUM_H = 0.45;
export const PODIUM_MARGIN = 2.6; // building ke chaaron taraf plinth
export const WALL_T = 0.3;
export const PILLAR_OFF = 0.5; // steel pillars wall ke bahar

/** Roof height: u = 0 (left wall) .. 1 (right wall) */
export const roofY = (u) => EAVE_H + ROOF_RISE * 4 * u * (1 - u);

/** Left aur right wall line par point, v = 0 (back) .. 1 (front) */
export function leftAt(v) {
  return { x: CORNERS.A01.x + (CORNERS.A06.x - CORNERS.A01.x) * v, z: CORNERS.A01.z + (CORNERS.A06.z - CORNERS.A01.z) * v };
}
export function rightAt(v) {
  return { x: CORNERS.B01.x + (CORNERS.B06.x - CORNERS.B01.x) * v, z: CORNERS.B01.z + (CORNERS.B06.z - CORNERS.B01.z) * v };
}

/** Kisi z par right wall ka x (andar camera clamp ke liye). */
export function rightXAt(z) {
  const t = (z - CORNERS.B01.z) / (CORNERS.B06.z - CORNERS.B01.z);
  return CORNERS.B01.x + (CORNERS.B06.x - CORNERS.B01.x) * t;
}
/** Kisi x par front wall ka z. */
export function frontZAt(x) {
  const t = (x - CORNERS.A06.x) / (CORNERS.B06.x - CORNERS.A06.x);
  return CORNERS.A06.z + (CORNERS.B06.z - CORNERS.A06.z) * t;
}

// Exterior stairs – FRONT side, main gate ke RIGHT mein (bahar se dekhne par)
// first floor ka darwaza front deewar par; seedhi right ki taraf neeche utarti hai
export const STAIR = {
  side: 'front',
  doorS: 18.0, // front side par (A06 se) – entrance ke right fin (16.65) ke baad
  doorW: 1.2,
  doorH: 2.4,
  landing: { s0: 16.9, s1: 19.1, off0: 0.35, off1: 2.3 },
  flight: { off0: 0.85, off1: 2.3, risers: 20, tread: 0.28 },
};

// Left side ka fire-exit darwaza (ground floor, A03 aur A04 ke beech)
export const SIDE_DOOR = { side: 'left', s: 16.1, w: 1.2, h: 2.3 };

// Front entrance
export const ENTRANCE = { glassHalf: 4.6, doorW: 3.8, doorH: 2.9 };

/* ================= Andar ka layout (nayi drawing se, feet mein, A01 = 0,0) ================= */
/** Drawing ke feet (x = A01 se right, z = A01 se front) -> world. */
export const planPt = (x, z) => P([x, z]);
const rightFt = (z) => 60 + ((75.878 - 60) * z) / 105.798; // right deewar ki x (feet)
const IN = 1.0; // deewar ki motai ~1 ft

// 5 ft deep pit – back-right kona: 33'-9" x 9', aur right taraf 8'-4" chauda hissa 12'-3" tak
export const PIT_DEPTH = 5 * FT;
export const PIT = [
  [26.25, IN], [rightFt(IN) - IN, IN], [rightFt(12.3) - IN, 12.3], [53.2, 12.3], [53.2, 9.2], [26.25, 9.2],
].map(([x, z]) => planPt(x, z));

// Gym spring floor – 37' x 36', beech mein; upar 7' ka hissa pit tak
export const SPRING = [
  [16.2, 12.3], [46.2, 12.3], [46.2, 9.2], [53.2, 9.2], [53.2, 48.3], [16.2, 48.3],
].map(([x, z]) => planPt(x, z));
export const SPRING_MAIN = { x0: 16.2, x1: 53.2, z0: 12.3, z1: 48.3 }; // feet
import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Box jiske UV meters mein hon – texture 1 tile = 1 meter. */
export function worldUVBox(w, h, d) {
  const geo = new THREE.BoxGeometry(w, h, d);
  const uv = geo.attributes.uv;
  const dims = [[d, h], [d, h], [w, d], [w, d], [w, h], [w, h]];
  for (let f = 0; f < 6; f++) {
    for (let v = 0; v < 4; v++) {
      const i = f * 4 + v;
      uv.setXY(i, uv.getX(i) * dims[f][0], uv.getY(i) * dims[f][1]);
    }
  }
  uv.needsUpdate = true;
  return geo;
}

export function scaleUV(geo, sx, sy) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * sx, uv.getY(i) * sy);
  uv.needsUpdate = true;
  return geo;
}

export function mesh(geo, mat, { cast = true, receive = true } = {}) {
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = cast;
  m.receiveShadow = receive;
  return m;
}

export function addBox(parent, w, h, d, mat, x, y, z, opts) {
  const m = mesh(worldUVBox(w, h, d), mat, opts);
  m.position.set(x, y, z);
  parent.add(m);
  return m;
}

/**
 * Side ke along box: s0..s1 (length), y0..y1 (height), thickness th, offset off (bahar ki taraf).
 * side = plan.js ka sideFrame.
 */
export function sideBox(parent, side, s0, s1, y0, y1, th, mat, off = 0, opts) {
  if (s1 - s0 < 0.003 || y1 - y0 < 0.003) return null;
  const p = side.at((s0 + s1) / 2, off);
  const m = addBox(parent, s1 - s0, y1 - y0, th, mat, p.x, (y0 + y1) / 2, p.z, opts);
  m.rotation.y = side.rotY;
  return m;
}

/** Do points ke beech cylinder (rods, railings) – geometry return karta hai (merge ke liye). */
const UP = new THREE.Vector3(0, 1, 0);
export function rodGeo(a, b, r = 0.03, seg = 8) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r, r, len, seg);
  geo.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(UP, dir.normalize()));
  const mid = a.clone().add(b).multiplyScalar(0.5);
  geo.translate(mid.x, mid.y, mid.z);
  return geo;
}

/** Box jo point a se b tak ho (stringers, braces). */
export function beamBetween(parent, a, b, w, h, mat, opts) {
  const len = a.distanceTo(b);
  const m = mesh(worldUVBox(w, h, len), mat, opts);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.lookAt(b);
  parent.add(m);
  return m;
}

/** Polygon ko bahar ki taraf offset karo (miter) – plinth ke liye. */
export function offsetPolygon(pts, d) {
  const n = pts.length;
  // signed area se winding nikaalo
  let area = 0;
  for (let i = 0; i < n; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % n];
    area += a.x * b.z - b.x * a.z;
  }
  const sign = area > 0 ? 1 : -1; // d > 0 = bahar, d < 0 = andar
  return pts.map((p, i) => {
    const prev = pts[(i - 1 + n) % n];
    const next = pts[(i + 1) % n];
    const e1 = norm({ x: p.x - prev.x, z: p.z - prev.z });
    const e2 = norm({ x: next.x - p.x, z: next.z - p.z });
    const n1 = { x: e1.z * sign, z: -e1.x * sign };
    const n2 = { x: e2.z * sign, z: -e2.x * sign };
    const m = norm({ x: n1.x + n2.x, z: n1.z + n2.z });
    const k = d / Math.max(0.2, m.x * n1.x + m.z * n1.z);
    return { x: p.x + m.x * k, z: p.z + m.z * k };
  });
}
function norm(v) {
  const l = Math.hypot(v.x, v.z) || 1;
  return { x: v.x / l, z: v.z / l };
}

/** Plan polygon (x,z) se zameen par flat shape geometry (UV meters / tile). */
export function polygonPlane(pts, tile = 1, holes = []) {
  const shape = new THREE.Shape(pts.map((p) => new THREE.Vector2(p.x, -p.z)));
  holes.forEach((h) => shape.holes.push(new THREE.Path(h.map((p) => new THREE.Vector2(p.x, -p.z)))));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateX(-Math.PI / 2);
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / tile, pos.getZ(i) / tile);
  return geo;
}

/* ================= Static mesh merge (draw calls kam, dikhne mein same) ================= */
const KEEP = ['position', 'normal', 'uv'];
function materialKey(m) {
  return [
    m.transparent ? `t${m.opacity}` : 'o', m.type, m.map?.uuid, m.emissiveMap?.uuid, m.bumpMap?.uuid,
    m.roughness, m.metalness, m.emissive?.getHex(), m.emissiveIntensity, m.side, m.alphaTest,
    m.flatShading, m.polygonOffset, m.polygonOffsetFactor, m.depthWrite,
  ].join('|');
}

/**
 * Group ke andar same tarah ke material wale static meshes ko jod deta hai.
 * Rang alag hon to vertex colors. userData.noMerge / instanced / renderOrder != 0 chhod diye.
 * Dynamic materials (night glow) ko key se alag rakhne ke liye material.userData.dynamic = true.
 */
export function mergeStatic(root, ownMaterials = []) {
  root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(root.matrixWorld).invert();
  const rel = new THREE.Matrix4();
  const buckets = new Map();
  const ok = (m) => m && !m.vertexColors && (m.isMeshStandardMaterial || m.isMeshBasicMaterial);

  root.traverse((o) => {
    if (!o.isMesh || o.isInstancedMesh || o.userData.noMerge || o.renderOrder !== 0) return;
    const m = o.material;
    if (Array.isArray(m) || !ok(m)) return;
    const a = o.geometry.attributes;
    if (!a.position || !a.normal || !a.uv) return;
    const key = materialKey(m) + (m.userData.dynamic ? m.uuid : '') + (o.castShadow ? 'c' : '');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(o);
  });

  buckets.forEach((list) => {
    if (list.length < 2) return;
    const useColors = new Set(list.map((o) => o.material.color.getHex())).size > 1;
    const geos = list.map((o) => {
      const geo = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone();
      Object.keys(geo.attributes).forEach((n) => {
        if (!KEEP.includes(n)) geo.deleteAttribute(n);
      });
      geo.morphAttributes = {};
      geo.clearGroups();
      rel.multiplyMatrices(inv, o.matrixWorld);
      geo.applyMatrix4(rel);
      if (useColors) {
        const c = o.material.color;
        const n = geo.attributes.position.count;
        const arr = new Float32Array(n * 3);
        for (let i = 0; i < n; i++) arr.set([c.r, c.g, c.b], i * 3);
        geo.setAttribute('color', new THREE.BufferAttribute(arr, 3));
      }
      return geo;
    });
    const geo = mergeGeometries(geos, false);
    geos.forEach((x) => x.dispose());
    if (!geo) return;
    let material = list[0].material;
    if (useColors) {
      material = material.clone();
      material.vertexColors = true;
      material.color.set('#ffffff');
      ownMaterials.push(material);
    }
    const out = new THREE.Mesh(geo, material);
    out.castShadow = list[0].castShadow;
    out.receiveShadow = true;
    if (material.transparent) out.renderOrder = 2;
    root.add(out);
    list.forEach((o) => o.parent && o.parent.remove(o));
  });
}
import * as THREE from 'three';
import { SIDES, STAIR, PODIUM_H as PH, FLOOR_H as F, EAVE_H as H, CORNERS } from './plan.js';
import { MEZZ } from './builders/mezzanine.js';
import { planPt } from './plan.js';
const fv = (x, z, y) => { const p = planPt(x, z); return new THREE.Vector3(p.x, y, p.z); };

const v = (p, y) => new THREE.Vector3(p.x, y, p.z);

/** Camera presets { pos, target } – world coordinates. */
export function getView(id) {
  const { front, back, left, right } = SIDES;
  switch (id) {
    case 'aerial':
      return { pos: new THREE.Vector3(38, 28, 52), target: new THREE.Vector3(0, 4, 2) };
    case 'top':
      return { pos: new THREE.Vector3(0, 70, 0.1), target: new THREE.Vector3(0, 0, 0) };
    case 'front':
      return { pos: v(front.at(front.len / 2, 27), 4.2), target: v(front.at(front.len / 2, 0), 4.6) };
    case 'landing': {
      // Bahar ki seedhi ke upar – glass darwaze se andar Room 1 dikhta hai
      const p = front.at(STAIR.doorS + 0.25, 1.75);
      return { pos: v(p, PH + F + 1.65), target: v(front.at(STAIR.doorS - 0.6, -3.2), PH + F + 1.0) };
    }
    case 'stairs':
      return { pos: v(front.at(STAIR.doorS + 5, 19), 6), target: v(front.at(STAIR.doorS + 0.5, 0), 3.4) };
    case 'right':
      return { pos: v(right.at(right.len / 2 + 4, 22), 6), target: v(right.at(right.len / 2, 0), 5) };
    case 'back':
      return { pos: v(back.at(back.len / 2 - 3, 22), 6), target: v(back.at(back.len / 2, 0), 5) };
    case 'left':
      return { pos: v(left.at(left.len / 2 + 4, 22), 6), target: v(left.at(left.len / 2, 0), 5) };

    // ---- Andar ----
    case 'in:ground': {
      // gate se andar aate hi – poora hall, right mein upar mezzanine balcony
      const c = front.len / 2;
      return { pos: v(front.at(c - 1.0, -2.2), PH + 1.7), target: v(front.at(c + 1.5, -14), PH + 2.6) };
    }
    case 'in:roof':
      return { pos: new THREE.Vector3(-3, PH + 1.6, 9), target: new THREE.Vector3(2, PH + H + 1.5, -6) };
    case 'in:door': {
      const d = front.at(STAIR.doorS, -0.5);
      return { pos: new THREE.Vector3(d.x - 4, PH + 2.6, d.z - 9), target: v(d, PH + F + 1.2) };
    }
    // Mezzanine (andar ki seedhi, balcony, rooms)
    // ---- Gate se andar/bahar jaane ka sequence ----
    case 'door:out': // bahar, darwaze ke saamne, andar dekhte hue
      return { pos: v(front.at(front.len / 2, 7), PH + 1.7), target: v(front.at(front.len / 2, -6), PH + 1.6) };
    case 'door:in': // darwaze ke just andar
      return { pos: v(front.at(front.len / 2 - 0.6, -2.6), PH + 1.7), target: v(front.at(front.len / 2 + 0.6, -15), PH + 2.0) };
    case 'door:look-out': // andar se khule darwaze ki taraf
      return { pos: v(front.at(front.len / 2, -5), PH + 1.7), target: v(front.at(front.len / 2, 8), PH + 1.5) };
    case 'door:exit': // bahar nikal kar
      return { pos: v(front.at(front.len / 2, 6), PH + 1.7), target: v(front.at(front.len / 2, 20), PH + 1.4) };
    case 'door:turn': // side se mud kar building dekho (gate band hota dikhe)
      return { pos: v(front.at(front.len / 2 + 9, 13), PH + 3.2), target: v(front.at(front.len / 2, 0), PH + 2.2) };
    case 'in:reception':
      return { pos: fv(30, 96, PH + 1.7), target: fv(12, 90, PH + 1.1) };
    case 'in:spring':
      return { pos: fv(50, 62, PH + 4.2), target: fv(34, 28, PH) };
    case 'in:pit':
      return { pos: fv(30, 22, PH + 3.0), target: fv(42, 5, PH - 1.0) };
    case 'in:equipment':
      return { pos: fv(40, 84, PH + 3.6), target: fv(14, 52, PH + 0.6) };
    case 'in:balcony':
      return { pos: v(front.at(MEZZ.s0 + 0.5, -(MEZZ.depth - 0.5)), PH + F + 1.65), target: v(front.at(20.5, -(MEZZ.roomDepth + 0.9)), PH + F + 0.6) };
    case 'in:room1':
      return { pos: v(front.at(MEZZ.s0 + 0.35, -(MEZZ.roomDepth - 0.35)), PH + F + 1.75), target: v(front.at(MEZZ.partition - 0.3, -0.5), PH + F + 0.7) };
    case 'in:room2':
      return { pos: v(front.at(MEZZ.partition + 0.3, -(MEZZ.roomDepth - 0.35)), PH + F + 1.75), target: v(front.at(MEZZ.partition + 3.0, -0.5), PH + F + 0.7) };
    case 'in:left': {
      const p = left.at(left.len * 0.45, -8);
      return { pos: v(p, PH + 1.8), target: v(left.at(left.len * 0.3, 0), PH + 2.2) };
    }
    case 'in:right': {
      const p = right.at(right.len * 0.45, -8);
      return { pos: v(p, PH + 1.8), target: v(right.at(right.len * 0.3, 0), PH + 2.2) };
    }
    default:
      return getView('aerial');
  }
}
import * as THREE from 'three';

export function createMaterials(tx) {
  const std = (o) => new THREE.MeshStandardMaterial(o);
  const mats = {
    // Ground floor band – brick ya plaster (setWallStyle)
    wall: std({ map: tx.brick, bumpMap: tx.brickBump, bumpScale: 2.2, roughness: 0.92 }),
    navy: std({ map: tx.cladding, color: '#25365a', metalness: 0.45, roughness: 0.5 }),
    charcoal: std({ map: tx.cladding, color: '#3c4248', metalness: 0.45, roughness: 0.5 }),
    accent: std({ map: tx.cladding, color: '#6a2c93', metalness: 0.35, roughness: 0.5 }),
    trim: std({ color: '#e9ebee', metalness: 0.3, roughness: 0.45 }),
    steel: std({ color: '#f1f3f5', metalness: 0.55, roughness: 0.32 }),
    frame: std({ color: '#2a2f35', metalness: 0.6, roughness: 0.35 }),
    roof: std({ map: tx.roof, color: '#b9c0c4', metalness: 0.65, roughness: 0.38, side: THREE.DoubleSide }),
    glass: std({ color: '#86aec6', metalness: 0.6, roughness: 0.05, transparent: true, opacity: 0.5 }),
    shutter: std({ map: tx.shutter, color: '#cfd4d8', metalness: 0.5, roughness: 0.45 }),
    door: std({ color: '#6f7780', metalness: 0.5, roughness: 0.4 }),
    grating: std({ map: tx.grating, metalness: 0.6, roughness: 0.5 }),
    stone: std({ map: tx.stone, roughness: 0.95 }),
    concrete: std({ map: tx.concrete, roughness: 0.9 }),
    floor: std({ map: tx.concrete, color: '#d9d6cf', roughness: 0.35, metalness: 0.05 }),
    paver: std({ map: tx.paver, roughness: 0.88 }),
    grass: std({ map: tx.grass, roughness: 1 }),
    hazard: std({ map: tx.hazard, roughness: 0.6 }),
    gold: std({ color: '#c9a03a', metalness: 0.9, roughness: 0.28 }),
    rubber: std({ color: '#151515', roughness: 0.9 }),
    bark: std({ color: '#5a4330', roughness: 0.95 }),
    leaves: std({ color: '#ffffff', roughness: 0.9, flatShading: true }),
    hedge: std({ color: '#3d6b2c', roughness: 0.95 }),
    exit: std({ color: '#0f8a3c', emissive: '#22ff77', emissiveIntensity: 0.6 }),
    lamp: std({ color: '#fff4dc', emissive: '#ffcf7a', emissiveIntensity: 0.05, roughness: 0.3 }),
  };
  mats.lamp.userData.dynamic = true;

  mats.setWallStyle = (style) => {
    const m = mats.wall;
    if (style === 'plaster') {
      m.map = tx.plaster;
      m.bumpMap = null;
      m.color.set('#e4d1a9');
    } else {
      m.map = tx.brick;
      m.bumpMap = tx.brickBump;
      m.color.set('#ffffff');
    }
    m.needsUpdate = true;
  };

  mats.dispose = () => {
    Object.values(mats).forEach((m) => {
      if (m && m.isMaterial) m.dispose();
    });
  };
  return mats;
}
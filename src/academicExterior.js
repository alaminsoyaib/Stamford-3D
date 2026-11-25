import * as THREE from 'three';
import { addLocalCollider, sign, standard } from './buildingFactory.js';
import { box, canvasTexture, cylinder, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

let cachedMaterials = null;

function createMuralMaterial() {
  if (typeof document === 'undefined') {
    return standard('#ece8df', { roughness: 0.9 });
  }
  const map = canvasTexture(512, 288, (ctx, w, h) => {
    ctx.fillStyle = '#eeeae1';
    ctx.fillRect(0, 0, w, h);
    const rng = seededRandom(40116);
    for (let i = 0; i < 650; i++) {
      ctx.fillStyle = rng() > 0.5 ? 'rgba(255,255,255,0.22)' : 'rgba(130,120,108,0.08)';
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 1 + rng() * 3);
    }
    ctx.fillStyle = '#22211f';
    ctx.beginPath();
    ctx.arc(w * 0.14, h * 0.55, h * 0.17, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(w * 0.08, h * 0.67, w * 0.12, h * 0.16);
    ctx.fillStyle = '#efe9de';
    ctx.beginPath();
    ctx.arc(w * 0.14, h * 0.54, h * 0.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#1e1d1c';
    ctx.fillRect(w * 0.11, h * 0.5, w * 0.06, h * 0.035);
    ctx.fillStyle = '#be2f2a';
    ctx.fillRect(w * 0.05, h * 0.16, w * 0.2, h * 0.12);
    ctx.fillRect(w * 0.62, h * 0.15, w * 0.29, h * 0.13);
    ctx.fillStyle = '#242322';
    ctx.fillRect(w * 0.1, h * 0.8, w * 0.16, h * 0.07);
    ctx.fillStyle = '#9b9a95';
    ctx.fillRect(w * 0.64, h * 0.42, w * 0.24, h * 0.34);
    ctx.fillStyle = '#262523';
    for (let bar = 0; bar < 5; bar++) {
      ctx.fillRect(w * 0.66 + bar * w * 0.044, h * 0.45, w * 0.014, h * 0.28);
    }
  });
  return standard('#ffffff', { map, roughness: 0.88 });
}

function createCorrugatedRoofMaterial() {
  if (typeof document === 'undefined') {
    return standard('#8f9498', { side: THREE.DoubleSide, roughness: 0.64, metalness: 0.22 });
  }
  const rng = seededRandom(4022);
  const map = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#9aa0a5';
    ctx.fillRect(0, 0, w, h);
    for (let x = 0; x < w; x++) {
      const wave = Math.sin((x / w) * Math.PI * 20);
      ctx.fillStyle = wave > 0
        ? `rgba(255, 255, 250, ${(wave * 0.22).toFixed(3)})`
        : `rgba(54, 58, 62, ${(-wave * 0.18).toFixed(3)})`;
      ctx.fillRect(x, 0, 1, h);
    }
    for (let i = 0; i < 240; i++) {
      ctx.fillStyle = `rgba(118, 86, 74, ${(0.03 + rng() * 0.07).toFixed(3)})`;
      ctx.fillRect(rng() * w, rng() * h, 1 + rng() * 3, 6 + rng() * 20);
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(3, 1.5);
  return standard('#ffffff', { map, side: THREE.DoubleSide, roughness: 0.64, metalness: 0.22 });
}

function createWireMeshMaterial() {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({
      color: '#6b7073', transparent: true, opacity: 0.36, side: THREE.DoubleSide, roughness: 0.65, metalness: 0.35
    });
  }
  const map = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(72, 76, 80, 0.72)';
    ctx.lineWidth = 3;
    const step = 16;
    for (let offset = -h; offset < w + h; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset, h);
      ctx.lineTo(offset + h, 0);
      ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.repeat.set(6, 4);
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    transparent: true,
    alphaTest: 0.08,
    side: THREE.DoubleSide,
    roughness: 0.65,
    metalness: 0.32
  });
}

function getAcademicMaterials(kit) {
  if (cachedMaterials) return cachedMaterials;
  const m = kit.materials;
  cachedMaterials = {
    pink: m.academic,
    deepPink: standard('#cf7474', { roughness: 0.84 }),
    whitePlaster: standard('#ece7dd', { roughness: 0.88 }),
    interiorCream: standard('#d9d4c8', { roughness: 0.86 }),
    columnWhite: standard('#ece6da', { roughness: 0.86 }),
    concreteSlab: standard('#c2bab0', { roughness: 0.88 }),
    terrazzo: standard('#d7cfc0', { roughness: 0.65 }),
    marbleTrim: standard('#c8beb2', { roughness: 0.62 }),
    darkDoor: standard('#272322', { roughness: 0.56 }),
    woodDoor: standard('#483831', { roughness: 0.68 }),
    steelDark: standard('#2b3035', { metalness: 0.42, roughness: 0.58 }),
    grilleCream: standard('#d8d0bc', { metalness: 0.34, roughness: 0.55 }),
    wireMesh: createWireMeshMaterial(),
    aluminum: standard('#b8b8ae', { metalness: 0.36, roughness: 0.44 }),
    acBody: standard('#e8e4da', { roughness: 0.52, metalness: 0.14 }),
    acGrille: standard('#34393e', { roughness: 0.7, metalness: 0.3 }),
    fireRed: standard('#bf2b2b', { roughness: 0.4, metalness: 0.2 }),
    bucketBlue: standard('#2d6da3', { roughness: 0.5 }),
    crimsonLight: new THREE.MeshStandardMaterial({
      color: '#d93232',
      emissive: '#ff4b3a',
      emissiveIntensity: 0.85,
      roughness: 0.3
    }),
    warmBulb: new THREE.MeshStandardMaterial({
      color: '#fff4d4',
      emissive: '#ffd58f',
      emissiveIntensity: 0.9,
      roughness: 0.25
    }),
    deskWood: standard('#a8754a', { roughness: 0.76 }),
    plumbingPorcelain: standard('#efede8', { roughness: 0.28 }),
    muralWall: createMuralMaterial(),
    corrugatedMetal: createCorrugatedRoofMaterial(),
    glass: m.glass,
    shadeGlass: m.shadeGlass,
    black: m.black
  };
  return cachedMaterials;
}

export function buildAcOutdoorUnit(parent, position, yaw = 0) {
  const mat = cachedMaterials ?? {
    acBody: standard('#e8e4da', { roughness: 0.52, metalness: 0.14 }),
    acGrille: standard('#34393e', { roughness: 0.7, metalness: 0.3 }),
    steelDark: standard('#2b3035', { metalness: 0.42, roughness: 0.58 })
  };
  const unit = groupAt(parent, 'AC outdoor unit', position, yaw);
  box(unit, mat.acBody, [0.78, 0.54, 0.29], [0, 0.29, 0]);
  cylinder(unit, mat.acGrille, 0.185, 0.03, [-0.14, 0.29, 0.145]).rotation.x = Math.PI / 2;
  box(unit, mat.acGrille, [0.18, 0.36, 0.02], [0.22, 0.29, 0.145]);
  for (const sx of [-0.26, 0.26]) {
    box(unit, mat.steelDark, [0.032, 0.032, 0.34], [sx, 0.016, 0.01]);
    box(unit, mat.steelDark, [0.032, 0.26, 0.032], [sx, -0.11, -0.14]);
  }
  return unit;
}

function buildSecurityGrille(parent, mat, width, height, position, yaw = 0, { cols = 10, rows = 4, meshBacking = false } = {}) {
  const panel = groupAt(parent, 'Security grille panel', position, yaw);
  const safeCols = Math.max(2, cols);
  const safeRows = Math.max(2, rows);
  for (let c = 0; c <= safeCols; c++) {
    const px = (c / safeCols - 0.5) * width;
    box(panel, mat.grilleCream, [0.022, height, 0.022], [px, height / 2, 0]);
  }
  for (let r = 0; r <= safeRows; r++) {
    const py = (r / safeRows) * height;
    box(panel, mat.grilleCream, [width, 0.022, 0.022], [0, py, 0]);
  }
  if (meshBacking) {
    const mesh = part(panel, unitPlane, mat.wireMesh, [0, height / 2, -0.012], [width, height, 1]);
    mesh.castShadow = false;
  }
  return panel;
}

function buildDiamondGrilleWindow(parent, mat, width, height, position, yaw = 0) {
  const win = groupAt(parent, 'Barred sliding window', position, yaw);
  box(win, mat.concreteSlab, [width + 0.16, height + 0.16, 0.12], [0, 0, -0.01]);
  part(win, unitPlane, mat.shadeGlass, [0, 0, 0.055], [width, height, 1]).castShadow = false;
  box(win, mat.aluminum, [0.04, height, 0.05], [0, 0, 0.065]);
  const cols = Math.max(3, Math.round(width / 0.34));
  for (let c = 0; c <= cols; c++) {
    const px = (c / cols - 0.5) * (width - 0.08);
    box(win, mat.steelDark, [0.018, height - 0.04, 0.022], [px, 0, 0.085]);
  }
  for (const ry of [-height * 0.25, 0, height * 0.25]) {
    box(win, mat.steelDark, [width - 0.06, 0.018, 0.022], [0, ry, 0.085]);
  }
  return win;
}

function buildBreezeBlockParapet(parent, mat, width, height, thickness, position, yaw = 0) {
  const wall = groupAt(parent, 'Slotted breeze-block parapet', position, yaw);
  box(wall, mat.pink, [width, 0.12, thickness], [0, 0.06, 0]);
  box(wall, mat.pink, [width, 0.12, thickness], [0, height - 0.06, 0]);
  const cols = Math.max(2, Math.round(width / 0.36));
  const colW = width / cols;
  const openH = Math.max(0.15, height - 0.24);
  for (let c = 0; c <= cols; c++) {
    const px = -width / 2 + c * colW;
    box(wall, mat.pink, [0.09, openH, thickness], [px, height / 2, 0]);
    if (c < cols) {
      box(wall, mat.pink, [colW - 0.09, 0.08, thickness * 0.72], [px + colW / 2, height * 0.42, 0]);
      box(wall, mat.pink, [colW - 0.09, 0.08, thickness * 0.72], [px + colW / 2, height * 0.68, 0]);
    }
  }
  return wall;
}

function buildStackedDesks(parent, mat, position) {
  const stack = groupAt(parent, 'Stacked auditorium desks', position);
  for (let row = 0; row < 2; row++) {
    for (let tier = 0; tier < 3; tier++) {
      const x = (row - 0.5) * 0.92;
      const y = tier * 0.68;
      box(stack, mat.deskWood, [0.82, 0.036, 0.54], [x, y + 0.64, 0]);
      for (const lx of [-0.36, 0.36]) {
        for (const lz of [-0.22, 0.22]) {
          box(stack, mat.steelDark, [0.028, 0.64, 0.028], [x + lx, y + 0.32, lz]);
        }
      }
    }
  }
}

export function buildAcademicGroundExterior(kit, { root, width, depth, story, facade, recess, section, endWidth = 0 }) {
  const mat = getAcademicMaterials(kit);
  const rearZ = -depth / 2;
  const wallDepthFull = depth - recess;
  // Deep recess supports both the Auditorium colonnade and the ~2.1 m Medical Center alcove
  const rearShift = Math.min(2.15, Math.max(1.25, depth * 0.12));
  const passWallZ = rearZ + Math.min(0.86, rearShift * 0.42);
  const innerWallZ = rearZ + rearShift;
  const coreDepth = Math.max(1.2, wallDepthFull - rearShift);
  const coreCenterZ = (innerWallZ + facade - recess) / 2;

  // Solid recessed ground floor room core + base skirting + section end-return wall across front arcade
  box(root, mat.pink, [width, story, coreDepth], [0, story / 2, coreCenterZ]);
  box(root, mat.black, [width + 0.025, 0.28, coreDepth + 0.04], [0, 0.14, coreCenterZ]);
  if (section) {
    const returnWidth = 0.38;
    const rx = (width - returnWidth) / 2;
    const rz = facade - recess / 2;
    box(root, mat.pink, [returnWidth, story, recess], [rx, story / 2, rz]);
    box(root, mat.black, [returnWidth + 0.025, 0.28, recess], [rx, 0.14, rz + 0.02]);
    addLocalCollider(kit.colliders, root, rx, rz, returnWidth, recess, true, story);
  }

  // Continuous terrazzo veranda plinth & overhead white/concrete slab along -Z
  const plinthH = 0.22;
  const ceilingThick = 0.14;
  const ceilingY = story - ceilingThick / 2;
  box(root, mat.terrazzo, [width, plinthH, rearShift + 0.22], [0, plinthH / 2, rearZ + (rearShift - 0.18) / 2]);
  box(root, mat.concreteSlab, [width + 0.14, ceilingThick, rearShift + 0.28], [0, ceilingY, rearZ + (rearShift - 0.14) / 2]);

  // Subdivide the -Z rear elevation from -X (CSE / stairs right) to +X (Ground passage left):
  const xMin = -width / 2;
  const xMax = width / 2;
  const endBayWidth = Math.max(2.4, endWidth || width * 0.30);
  const xAudEnd = xMin + (width - endBayWidth) * 0.56;
  const xWelfareEnd = xAudEnd + Math.max(2.8, (width - endBayWidth) * 0.26);
  const xMedEnd = xWelfareEnd + Math.max(2.4, width - endBayWidth - (xWelfareEnd - xMin));
  const xSswEnd = Math.min(xMax - 1.9, xMedEnd + endBayWidth * 0.50);

  // --- BAY 1: Auditorium Colonnaded Veranda (xMin .. xAudEnd) ---
  const audCenterX = (xMin + xAudEnd) / 2;
  const audW = xAudEnd - xMin;
  box(root, mat.deepPink, [audW, story - ceilingThick, 0.14], [audCenterX, (story - ceilingThick) / 2, innerWallZ + 0.04]);
  box(root, mat.pink, [audW, 0.36, 0.26], [audCenterX, story - ceilingThick - 0.18, rearZ + 0.13]);

  const colCount = Math.max(3, Math.round(audW / 3.0) + 1);
  const colXs = [];
  for (let i = 0; i < colCount; i++) {
    const cx = THREE.MathUtils.lerp(xMin + 0.24, xAudEnd - 0.24, i / (colCount - 1));
    colXs.push(cx);
    box(root, mat.columnWhite, [0.28, story - ceilingThick - 0.22, 0.28], [cx, plinthH + (story - ceilingThick - plinthH) / 2, rearZ + 0.16]);
    box(root, mat.marbleTrim, [0.34, 0.12, 0.34], [cx, plinthH + 0.06, rearZ + 0.16]);
  }

  if (audW > 3.2) {
    const entX = colXs.length >= 2 ? (colXs[0] + colXs[1]) / 2 : xMin + 1.6;
    box(root, mat.darkDoor, [1.55, 2.24, 0.08], [entX, plinthH + 1.12, innerWallZ - 0.02]);
    part(root, unitPlane, mat.shadeGlass, [entX - 0.36, plinthH + 1.24, innerWallZ - 0.065], [0.56, 1.38, 1]).rotation.y = Math.PI;
    part(root, unitPlane, mat.shadeGlass, [entX + 0.36, plinthH + 1.24, innerWallZ - 0.065], [0.56, 1.38, 1]).rotation.y = Math.PI;
    sign(root, {
      title: 'AUDITORIUM', subtitle: 'STAMFORD UNIVERSITY', position: [entX, plinthH + 2.48, innerWallZ - 0.06],
      width: 1.85, height: 0.36, yaw: Math.PI, background: '#19543e', ink: '#f2ead4'
    });
  }

  if (audW > 5.0 && colXs.length >= 3) {
    // Center notice board strictly midway between two columns so no column obscures it
    const midBay = Math.floor((colXs.length - 1) / 2);
    const boardX = (colXs[midBay - 1] + colXs[midBay]) / 2;
    const door115X = (colXs[colXs.length - 2] + colXs[colXs.length - 1]) / 2;
    box(root, mat.woodDoor, [1.46, 0.9, 0.06], [boardX, plinthH + 1.38, innerWallZ - 0.03]);
    box(root, mat.whitePlaster, [1.32, 0.76, 0.07], [boardX, plinthH + 1.38, innerWallZ - 0.035]);
    box(root, mat.darkDoor, [1.42, 2.18, 0.08], [door115X, plinthH + 1.09, innerWallZ - 0.02]);
    sign(root, {
      title: 'Auditorium A-115', position: [door115X, plinthH + 2.34, innerWallZ - 0.055],
      width: 0.72, height: 0.22, yaw: Math.PI, background: '#1f2326', ink: '#f2ead4'
    });
    buildStackedDesks(root, mat, [xAudEnd - 0.65, plinthH, rearZ + rearShift * 0.56]);
  }
  for (let l = 0; l < 2; l++) {
    const lx = THREE.MathUtils.lerp(xMin + 1.5, xAudEnd - 1.5, (l + 0.5) / 2);
    cylinder(root, mat.warmBulb, 0.065, 0.08, [lx, story - ceilingThick - 0.06, rearZ + rearShift * 0.45]);
  }

  // --- BAY 2: Room A-116 Students' Welfare White Mural Bay (recessed inward at passWallZ) ---
  const welGroup = groupAt(root, 'Students Welfare A-116 bay', [0, 0, 0]);
  const welCenterX = (xAudEnd + xWelfareEnd) / 2;
  const welW = xWelfareEnd - xAudEnd;
  const welFaceZ = passWallZ;
  box(welGroup, mat.whitePlaster, [welW, story - ceilingThick, 0.18], [welCenterX, (story - ceilingThick) / 2, welFaceZ + 0.09]);
  part(welGroup, unitPlane, mat.muralWall, [welCenterX, (story - ceilingThick) / 2, welFaceZ - 0.008],
    [welW - 0.14, story - ceilingThick - 0.24, 1]).rotation.y = Math.PI;
  // Side return wall joining recessed A-116 cleanly to Auditorium colonnade
  box(welGroup, mat.whitePlaster, [0.16, story - ceilingThick, innerWallZ - welFaceZ],
    [xAudEnd + 0.08, (story - ceilingThick) / 2, (welFaceZ + innerWallZ) / 2]);

  const welDoorX = xAudEnd + Math.min(1.05, welW * 0.26);
  box(welGroup, mat.woodDoor, [0.96, 2.16, 0.08], [welDoorX, plinthH + 1.08, welFaceZ - 0.02]);
  box(welGroup, mat.terrazzo, [1.22, plinthH + 0.04, 0.52], [welDoorX, (plinthH + 0.04) / 2, welFaceZ - 0.26]);
  for (const [idx, title] of ["Students' Welfare Office", "Forum's Meeting Room", 'Career Counselling (CCPC)'].entries()) {
    sign(welGroup, {
      title, position: [welDoorX, plinthH + 1.84 - idx * 0.28, welFaceZ - 0.068],
      width: 0.7, height: 0.21, yaw: Math.PI, background: '#193b78', ink: '#f2ede0'
    });
  }
  sign(welGroup, {
    title: 'A-116', position: [welDoorX, plinthH + 2.24, welFaceZ - 0.06],
    width: 0.36, height: 0.13, yaw: Math.PI, background: '#1d1e21', ink: '#ffffff'
  });
  const awning = box(welGroup, mat.corrugatedMetal, [1.75, 0.045, 0.78], [welDoorX - 0.12, plinthH + 2.46, welFaceZ - 0.38]);
  awning.rotation.x = 0.18;
  for (const bx of [-0.7, 0.7]) {
    rod(welGroup, mat.steelDark, [welDoorX - 0.12 + bx, plinthH + 2.12, welFaceZ], [welDoorX - 0.12 + bx, plinthH + 2.4, welFaceZ - 0.68], 0.016);
  }
  if (welW > 2.2) {
    const welWinX = xWelfareEnd - Math.min(1.05, welW * 0.28);
    buildDiamondGrilleWindow(welGroup, mat, Math.min(1.28, welW * 0.35), 1.28, [welWinX, plinthH + 1.48, welFaceZ], Math.PI);
  }

  // --- BAY 3: Deep Recessed Pink Medical Center Alcove (A-117 back, Handwash right/-X, A-118 Medical left/+X) ---
  const medGroup = groupAt(root, 'Medical Center recessed alcove', [0, 0, 0]);
  const medW = xMedEnd - xWelfareEnd;
  const alcW = Math.min(1.82, medW * 0.56);
  const alcRightX = xWelfareEnd + 0.12; // Right side when facing +Z into the building (-X)
  const alcLeftX = alcRightX + alcW;    // Left side when facing +Z into the building (+X)
  const alcCenterX = (alcRightX + alcLeftX) / 2;
  const alcDepth = innerWallZ - passWallZ;
  const alcMidZ = (passWallZ + innerWallZ) / 2;

  // White alcove ceiling soffit & speckled terrazzo alcove floor
  box(medGroup, mat.whitePlaster, [alcW, 0.06, alcDepth], [alcCenterX, story - ceilingThick - 0.03, alcMidZ]);
  box(medGroup, mat.terrazzo, [alcW, plinthH + 0.01, alcDepth], [alcCenterX, (plinthH + 0.01) / 2, alcMidZ]);

  // Deep Back Wall (z = innerWallZ): Room A-117 dark door + 2 red fire extinguishers + wall box
  box(medGroup, mat.deepPink, [alcW + 0.16, story - ceilingThick, 0.12], [alcCenterX, (story - ceilingThick) / 2, innerWallZ + 0.04]);
  box(medGroup, mat.woodDoor, [0.92, 2.08, 0.08], [alcCenterX + 0.18, plinthH + 1.04, innerWallZ - 0.02]);
  sign(medGroup, {
    title: 'A-117', position: [alcCenterX + 0.18, plinthH + 2.2, innerWallZ - 0.06],
    width: 0.34, height: 0.13, yaw: Math.PI, background: '#1e1f22', ink: '#ffffff'
  });
  for (const fx of [-0.42, -0.60]) {
    cylinder(medGroup, mat.fireRed, 0.068, 0.48, [alcCenterX + fx, plinthH + 0.96, innerWallZ - 0.12]);
  }
  box(medGroup, mat.steelDark, [0.26, 0.24, 0.08], [alcCenterX - 0.48, plinthH + 1.62, innerWallZ - 0.06]);

  // Right inner side wall (-X, facing +X): Concrete handwash basin + faucet + drain pipe + blue bucket
  box(medGroup, mat.deepPink, [0.14, story - ceilingThick, alcDepth], [alcRightX - 0.07, (story - ceilingThick) / 2, alcMidZ]);
  const sinkGroup = groupAt(medGroup, 'Handwash basin', [alcRightX + 0.22, plinthH, alcMidZ + 0.06]);
  box(sinkGroup, mat.whitePlaster, [0.42, 0.78, 0.56], [0, 0.39, 0]);
  box(sinkGroup, mat.terrazzo, [0.44, 0.06, 0.58], [0, 0.80, 0]);
  box(sinkGroup, mat.whitePlaster, [0.06, 0.32, 0.58], [-0.19, 0.96, 0]);
  cylinder(sinkGroup, mat.aluminum, 0.018, 0.16, [-0.08, 0.92, 0]).rotation.z = Math.PI / 2;
  cylinder(sinkGroup, mat.fireRed, 0.036, story - ceilingThick - plinthH, [-0.18, (story - ceilingThick - plinthH) / 2, 0.38]);
  cylinder(sinkGroup, mat.bucketBlue, 0.14, 0.28, [0.14, 0.14, -0.34]);

  // Left inner side wall (+X, facing -X): A-118 Medical Center frosted glass door + blue plaque
  box(medGroup, mat.deepPink, [0.14, story - ceilingThick, alcDepth], [alcLeftX + 0.07, (story - ceilingThick) / 2, alcMidZ]);
  box(medGroup, mat.aluminum, [0.06, 2.04, 0.86], [alcLeftX - 0.01, plinthH + 1.02, alcMidZ - 0.05]);
  part(medGroup, unitPlane, mat.shadeGlass, [alcLeftX - 0.045, plinthH + 1.04, alcMidZ - 0.05], [0.76, 1.92, 1]).rotation.y = -Math.PI / 2;
  sign(medGroup, {
    title: 'Medical Center', subtitle: 'Doctor & Paramedic · A-118',
    position: [alcLeftX - 0.052, plinthH + 2.34, alcMidZ - 0.05],
    width: 0.92, height: 0.3, yaw: -Math.PI / 2, background: '#1b3564', ink: '#f2ece0'
  });

  // Left outer wall (+X outside Medical alcove at passWallZ): white lower tile wainscot + black-framed mesh window
  const medOuterW = xMedEnd - alcLeftX;
  if (medOuterW > 0.65) {
    const medOutX = (alcLeftX + xMedEnd) / 2;
    box(medGroup, mat.deepPink, [medOuterW, story - ceilingThick, 0.16], [medOutX, (story - ceilingThick) / 2, passWallZ + 0.08]);
    box(medGroup, mat.whitePlaster, [medOuterW - 0.04, 0.96, 0.18], [medOutX, 0.48, passWallZ + 0.07]);
    buildDiamondGrilleWindow(medGroup, mat, Math.min(1.08, medOuterW - 0.28), 1.12, [medOutX, plinthH + 1.56, passWallZ], Math.PI);
  }

  // --- BAY 4: A-119 Student Service Wing (SSW) Collapsible Gates (recessed at passWallZ) ---
  const sswW = Math.max(2.0, xSswEnd - xMedEnd);
  const sswCenterX = (xMedEnd + xSswEnd) / 2;
  box(root, mat.whitePlaster, [sswW, story - ceilingThick, 0.14], [sswCenterX, (story - ceilingThick) / 2, innerWallZ + 0.04]);
  const door119X = sswCenterX - sswW * 0.12;
  box(root, mat.darkDoor, [1.24, 2.18, 0.08], [door119X, plinthH + 1.09, innerWallZ - 0.02]);
  sign(root, {
    title: 'Student Service Wing (SSW)', subtitle: 'A-119',
    position: [door119X + 0.82, plinthH + 2.02, innerWallZ - 0.055],
    width: 0.8, height: 0.28, yaw: Math.PI, background: '#1c3b74', ink: '#f3ede0'
  });
  const gateBars = Math.max(6, Math.round(sswW / 0.32));
  for (let b = 0; b <= gateBars; b++) {
    const gx = xMedEnd + 0.08 + (b / gateBars) * (sswW - 0.16);
    if (Math.abs(gx - door119X) < 0.62) continue;
    box(root, mat.grilleCream, [0.024, story - ceilingThick - plinthH - 0.08, 0.028],
      [gx, plinthH + (story - ceilingThick - plinthH) / 2, passWallZ + 0.04]);
  }
  for (const ry of [plinthH + 0.05, story - ceilingThick - 0.08]) {
    box(root, mat.grilleCream, [sswW, 0.04, 0.045], [sswCenterX, ry, passWallZ + 0.04]);
  }

  // --- BAY 5: Far-Left (+X) Screened Veranda Return (clean recessed ground wall behind the corner canopy) ---
  const cornerW = Math.max(1.5, xMax - xSswEnd);
  const cornerX = (xSswEnd + xMax) / 2;
  box(root, mat.pink, [0.30, story - ceilingThick, 0.30], [xMax - 0.15, (story - ceilingThick) / 2, passWallZ + 0.15]);
  box(root, mat.pink, [cornerW - 0.30, 0.96, 0.16], [cornerX - 0.15, 0.48, passWallZ + 0.10]);
  buildSecurityGrille(root, mat, Math.max(0.9, cornerW - 0.32), Math.max(0.8, story - ceilingThick - 0.96),
    [cornerX - 0.15, 0.96, passWallZ + 0.10], 0, { cols: Math.max(4, Math.round(cornerW / 0.34)), rows: 4 });

  // +X wrap-around screened veranda return & white ceramic pedestal washbasin at recessed corner
  const returnL = Math.min(3.2, Math.max(1.4, rearShift + 0.6));
  const returnCenterZ = passWallZ + 0.30 + returnL / 2;
  box(root, mat.pink, [0.16, 0.96, returnL], [xMax - 0.08, 0.48, returnCenterZ]);
  buildSecurityGrille(root, mat, returnL, Math.max(0.8, story - ceilingThick - 0.96),
    [xMax - 0.08, 0.96, returnCenterZ], Math.PI / 2, { cols: Math.max(4, Math.round(returnL / 0.34)), rows: 4 });
  const sinkX = xMax - 0.22;
  const sinkZ = passWallZ - 0.26;
  cylinder(root, mat.plumbingPorcelain, 0.11, 0.72, [sinkX, plinthH + 0.36, sinkZ]);
  box(root, mat.plumbingPorcelain, [0.46, 0.16, 0.36], [sinkX, plinthH + 0.78, sinkZ]);

  // --- PROJECTING COVERED PASSAGE CANOPY WITH CENTERED LIGHT (Flush at +X stepped end corner) ---
  const canopyW = Math.min(3.3, Math.max(2.2, endBayWidth * 0.44));
  const canopyD = Math.min(2.45, Math.max(1.85, depth * 0.15));
  const canopyX = xMax - canopyW / 2;
  const canopyZ = rearZ - canopyD / 2;
  const canopyGroup = groupAt(root, 'Projecting passage canopy', [0, 0, 0]);

  // Ground level: 2 slim dark steel posts on outer walkway corners + open 1.7 m walk-through passage
  for (const postSide of [-1, 1]) {
    const px = canopyX + postSide * (canopyW / 2 - 0.10);
    const pz = rearZ - canopyD + 0.10;
    box(canopyGroup, mat.steelDark, [0.085, story - 0.14, 0.085], [px, (story - 0.14) / 2, pz]);
    addLocalCollider(kit.colliders, root, px, pz, 0.16, 0.16, true, story, 0);
  }
  // Crisp white plastered ceiling soffit reaching back to passWallZ + centered circular crimson/warm light
  const fullCanopyDepth = canopyD + (passWallZ - rearZ);
  box(canopyGroup, mat.whitePlaster, [canopyW + 0.12, 0.16, fullCanopyDepth],
    [canopyX, story - 0.08, (rearZ - canopyD + passWallZ) / 2]);
  const lightRing = cylinder(canopyGroup, mat.crimsonLight, 0.32, 0.032, [canopyX, story - 0.166, canopyZ]);
  lightRing.name = 'Circular canopy light';
  lightRing.castShadow = false;
  const lightCore = cylinder(canopyGroup, mat.warmBulb, 0.15, 0.038, [canopyX, story - 0.168, canopyZ]);
  lightCore.castShadow = false;

  // 2nd-floor projecting veranda flush with +X end corner: pink spandrel + breeze-blocks + semi-transparent wire mesh over pale cream windows
  box(canopyGroup, mat.pink, [canopyW, 0.50, canopyD], [canopyX, story + 0.25, canopyZ]);
  const paraY = story + 0.50;
  const paraH = 0.68;
  const grilleH = Math.max(0.7, story - 0.50 - paraH - 0.08);
  box(canopyGroup, mat.interiorCream, [canopyW - 0.72, grilleH + paraH * 0.4, canopyD - 0.72],
    [canopyX, paraY + (grilleH + paraH * 0.4) / 2, canopyZ + 0.22]);
  buildDiamondGrilleWindow(canopyGroup, mat, Math.max(1.2, canopyW - 1.1), grilleH * 0.72,
    [canopyX, paraY + paraH + grilleH * 0.45, canopyZ - (canopyD - 0.72) / 2 + 0.20], Math.PI);

  buildBreezeBlockParapet(canopyGroup, mat, canopyW, paraH, 0.12, [canopyX, paraY, rearZ - canopyD + 0.06], 0);
  buildSecurityGrille(canopyGroup, mat, canopyW, grilleH, [canopyX, paraY + paraH, rearZ - canopyD + 0.06], 0,
    { cols: 6, rows: 3, meshBacking: true });
  for (const side of [-1, 1]) {
    const sideX = canopyX + side * (canopyW / 2 - 0.06);
    buildBreezeBlockParapet(canopyGroup, mat, canopyD, paraH, 0.12, [sideX, paraY, canopyZ], Math.PI / 2);
    buildSecurityGrille(canopyGroup, mat, canopyD, grilleH, [sideX, paraY + paraH, canopyZ], Math.PI / 2,
      { cols: 5, rows: 3, meshBacking: true });
  }
  const canopyRoof = box(canopyGroup, mat.corrugatedMetal, [canopyW + 0.24, 0.06, canopyD + 0.24], [canopyX, story * 2 + 0.14, canopyZ]);
  canopyRoof.rotation.x = 0.06;

  // Elevated collider seals canopy soffit and 2nd-floor room while leaving y = 1.7 m passage completely clear
  addLocalCollider(kit.colliders, root, canopyX, canopyZ, canopyW + 0.20, canopyD + 0.20, true,
    story * 2 + 0.28, story - 0.18);
}

export function buildAcademicEndBayExterior(kit, { end, endWidth, lowerDepth, story, wallHeight, wallY, wall, trim }) {
  const mat = getAcademicMaterials(kit);
  const corridorDepth = Math.min(1.85, lowerDepth * 0.24);
  const stairBayW = THREE.MathUtils.clamp(endWidth * 0.35, 1.8, endWidth - 1.8);
  const breezeW = endWidth - stairBayW;
  const xLeft = -endWidth / 2;
  const stairBayCenterX = xLeft + stairBayW / 2;
  const breezeCenterX = xLeft + stairBayW + breezeW / 2;
  const frontZ = -lowerDepth / 2;
  const roomCoreDepth = Math.max(1.2, lowerDepth - corridorDepth);
  const roomCoreZ = (frontZ + corridorDepth + lowerDepth / 2) / 2;

  // Solid stair-adjacent 2nd-floor bay (above A-116) with decorative diamond-grille sliding window
  box(end, wall, [stairBayW, wallHeight, lowerDepth], [stairBayCenterX, wallY, 0]);
  buildDiamondGrilleWindow(end, mat, Math.min(1.95, stairBayW - 0.5), 1.32, [stairBayCenterX, story + wallHeight * 0.56, frontZ - 0.01], Math.PI);

  // Recessed pale-cream & pink interior rooms behind breeze-block corridor (visible through semi-transparent mesh)
  box(end, wall, [breezeW, wallHeight, roomCoreDepth], [breezeCenterX, wallY, roomCoreZ]);
  box(end, mat.interiorCream, [breezeW - 0.2, wallHeight - 0.3, 0.08], [breezeCenterX, wallY, frontZ + corridorDepth - 0.02]);
  for (const offset of [-breezeW * 0.24, breezeW * 0.24]) {
    if (breezeW > 2.4) {
      buildDiamondGrilleWindow(end, mat, Math.min(1.45, breezeW * 0.32), 1.2,
        [breezeCenterX + offset, story + wallHeight * 0.54, frontZ + corridorDepth - 0.04], Math.PI);
    }
  }

  // Balcony slab + concrete slotted breeze-block parapet + semi-transparent wire mesh wrapping -Z onto +X
  box(end, mat.concreteSlab, [breezeW + 0.16, 0.12, corridorDepth + 0.22], [breezeCenterX, story + 0.06, frontZ + corridorDepth / 2]);
  const paraH = 1.02;
  const topGrilleH = Math.max(0.7, wallHeight - paraH - 0.12);
  buildBreezeBlockParapet(end, mat, breezeW, paraH, 0.14, [breezeCenterX, story + 0.06, frontZ + 0.07], 0);
  buildSecurityGrille(end, mat, breezeW, topGrilleH, [breezeCenterX, story + 0.06 + paraH, frontZ + 0.07], 0,
    { cols: Math.max(6, Math.round(breezeW / 0.38)), rows: 4, meshBacking: true });

  buildBreezeBlockParapet(end, mat, lowerDepth, paraH, 0.14, [endWidth / 2 - 0.07, story + 0.06, 0], Math.PI / 2);
  buildSecurityGrille(end, mat, lowerDepth, topGrilleH, [endWidth / 2 - 0.07, story + 0.06 + paraH, 0], Math.PI / 2,
    { cols: Math.max(8, Math.round(lowerDepth / 0.38)), rows: 4, meshBacking: true });

  for (const [sideWidth, offset, angle] of [
    [endWidth, [0, 0, frontZ], Math.PI],
    [lowerDepth, [endWidth / 2, 0, 0], Math.PI / 2],
    [lowerDepth, [-endWidth / 2, 0, 0], -Math.PI / 2]
  ]) {
    const band = groupAt(end, 'End bay floor trim', offset, angle);
    box(band, trim, [sideWidth, 0.15, 0.22], [0, story + 0.02, 0.05]);
  }

  for (const acOffset of [-0.36, -0.06]) {
    buildAcOutdoorUnit(end, [breezeCenterX + breezeW * acOffset, story + 0.42, frontZ - 0.18], Math.PI);
  }
}

export function buildAcademicUpperGallery(kit, { upper, upperWidth, upperDepth, rise, wall }) {
  const mat = getAcademicMaterials(kit);
  const galleryDepth = Math.min(2.35, Math.max(1.5, upperDepth * 0.16));
  const stairVestibule = Math.min(1.5, Math.max(0.95, upperWidth * 0.2));
  const eastGallery = Math.min(0.85, Math.max(0.45, upperWidth * 0.11));
  const roomW = Math.max(2.0, upperWidth - stairVestibule - eastGallery);
  const roomD = Math.max(2.4, upperDepth - galleryDepth);
  const roomCenterX = (stairVestibule - eastGallery) / 2;
  const roomCenterZ = galleryDepth / 2;

  // Recessed interior 3rd-floor classroom volume (no flush exterior blue office windows on -Z)
  box(upper, wall, [roomW, rise, roomD], [roomCenterX, rise / 2, roomCenterZ]);

  // Inner recessed classroom doors & barred windows visible inside the open veranda gallery
  const innerZ = -upperDepth / 2 + galleryDepth;
  const doorCount = Math.max(2, Math.floor(roomW / 2.6));
  for (let i = 0; i < doorCount; i++) {
    const dx = roomCenterX + ((i + 0.5) / doorCount - 0.5) * (roomW - 0.9);
    box(upper, mat.woodDoor, [0.92, 2.06, 0.06], [dx, 1.03, innerZ - 0.02]);
    buildDiamondGrilleWindow(upper, mat, 0.85, 1.02, [dx + 0.95, 1.56, innerZ - 0.01], Math.PI);
  }
  box(upper, mat.woodDoor, [1.08, 2.12, 0.06], [roomCenterX - roomW / 2 - 0.02, 1.06, -upperDepth / 2 + galleryDepth + 1.4]);

  // Projecting concrete veranda floor ledge along -Z & perimeter curb
  box(upper, mat.concreteSlab, [upperWidth + 0.36, 0.14, upperDepth + 0.36], [0, 0.06, -0.10]);
  box(upper, wall, [upperWidth + 0.08, 0.32, 0.16], [0, 0.22, -upperDepth / 2 + 0.04]);

  // Pink corner pilasters & steel stanchions framing the 3rd-floor open gallery cleanly
  for (const side of [-1, 1]) {
    box(upper, wall, [0.22, rise, 0.22], [side * (upperWidth / 2 - 0.11), rise / 2, -upperDepth / 2 + 0.11]);
  }
  const postCount = Math.max(4, Math.round(upperWidth / 1.85) + 1);
  for (let i = 0; i < postCount; i++) {
    const px = THREE.MathUtils.lerp(-upperWidth / 2 + 0.08, upperWidth / 2 - 0.08, i / (postCount - 1));
    box(upper, mat.steelDark, [0.075, rise - 0.14, 0.075], [px, (rise - 0.14) / 2, -upperDepth / 2 + 0.06]);
  }
  const grilleH = Math.max(1.2, rise - 0.46);
  buildSecurityGrille(upper, mat, upperWidth - 0.16, grilleH, [0, 0.34, -upperDepth / 2 + 0.06], 0,
    { cols: Math.max(14, Math.round(upperWidth / 0.34)), rows: 5 });
  // Continuous top & mid safety handrails along -Z
  for (const hy of [0.96, 0.34 + grilleH]) {
    box(upper, mat.steelDark, [upperWidth, 0.045, 0.055], [0, hy, -upperDepth / 2 + 0.06]);
  }

  // Wrap security grille & safety handrail around +X gallery return
  buildSecurityGrille(upper, mat, upperDepth - 0.16, grilleH, [upperWidth / 2 - 0.06, 0.34, 0], Math.PI / 2,
    { cols: Math.max(14, Math.round(upperDepth / 0.40)), rows: 5 });
  for (const hy of [0.96, 0.34 + grilleH]) {
    box(upper, mat.steelDark, [0.055, 0.045, upperDepth], [upperWidth / 2 - 0.06, hy, 0]);
  }

  // Side railing guarding the exposed -X gallery edge past the upper stair arrival
  const sideRailLen = Math.max(1.2, upperDepth - galleryDepth - 2.0);
  if (sideRailLen > 1.2) {
    const sideRailZ = upperDepth / 2 - sideRailLen / 2;
    buildSecurityGrille(upper, mat, sideRailLen, 0.94, [-upperWidth / 2 + 0.06, 0.14, sideRailZ], Math.PI / 2,
      { cols: Math.max(6, Math.round(sideRailLen / 0.4)), rows: 2 });
    box(upper, mat.steelDark, [0.055, 0.045, sideRailLen], [-upperWidth / 2 + 0.06, 1.08, sideRailZ]);
  }

  // 3 white AC outdoor compressor units mounted on brackets along the -Z outer concrete ledge
  for (const frac of [-0.34, 0, 0.34]) {
    buildAcOutdoorUnit(upper, [frac * (upperWidth - 1.2), 0.28, -upperDepth / 2 - 0.22], Math.PI);
  }

  // Tightly fitted sloped corrugated metal shed roof overhanging the 3rd-floor open gallery
  const tinRoof = box(upper, mat.corrugatedMetal, [upperWidth + 0.36, 0.065, upperDepth + 0.56], [0, rise + 0.14, -0.12]);
  tinRoof.rotation.x = 0.06;
  box(upper, mat.steelDark, [upperWidth + 0.34, 0.075, 0.075], [0, rise + 0.08, -upperDepth / 2 - 0.34]);
  for (let i = 0; i < 4; i++) {
    const px = THREE.MathUtils.lerp(-upperWidth / 2 + 0.28, upperWidth / 2 - 0.28, i / 3);
    rod(upper, mat.steelDark, [px, rise - 0.18, -upperDepth / 2 + 0.06], [px, rise + 0.08, -upperDepth / 2 - 0.32], 0.02);
  }
}

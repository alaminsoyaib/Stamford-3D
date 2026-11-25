import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

const roofHeight = 107 * 0.0254; // IMG_3146.JPG, pavement to painted roof edge.
const roofShoulder = roofHeight - 0.15;
const tireRadius = 0.394;
const beltline = 1.46;
const wheel = new THREE.CylinderGeometry(1, 1, 1, 32);
const bumperHeight = 0.29;

function lowerBody(halfWidth, halfLength, axles) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfLength, bumperHeight);
  for (const center of [-axles[1], -axles[0]]) {
    const radius = tireRadius + 0.085;
    shape.lineTo(center - radius, bumperHeight);
    for (let i = 0; i <= 16; i++) {
      const angle = Math.PI * (1 - i / 16);
      shape.lineTo(center + radius * Math.cos(angle), tireRadius + radius * Math.sin(angle));
    }
    shape.lineTo(center + radius, bumperHeight);
  }
  shape.lineTo(halfLength, bumperHeight);
  shape.lineTo(halfLength, beltline);
  shape.lineTo(-halfLength, beltline);
  shape.closePath();
  const body = new THREE.ExtrudeGeometry(shape, { depth: 2 * halfWidth, bevelEnabled: false });
  body.rotateY(Math.PI / 2);
  body.translate(-halfWidth, 0, 0);
  return body;
}

function roofShell(halfWidth, length) {
  const shape = new THREE.Shape();
  shape.moveTo(-halfWidth, roofShoulder);
  shape.quadraticCurveTo(-halfWidth, roofHeight, -halfWidth + 0.19, roofHeight);
  shape.lineTo(halfWidth - 0.19, roofHeight);
  shape.quadraticCurveTo(halfWidth, roofHeight, halfWidth, roofShoulder);
  shape.closePath();
  return new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false });
}

function scuffedPaint() {
  const random = seededRandom(3146);
  return canvasTexture(1024, 128, (ctx, w, h) => {
    for (let i = 0; i < 175; i++) {
      const x = random() * w;
      const y = i < 100 ? random() * 17 : random() * h;
      const span = 1 + random() * 13;
      ctx.fillStyle = i % 3 ? '#bdc5c179' : '#16415c68';
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x + span, y - 1);
      ctx.lineTo(x + span * 0.75, y + 0.6 + random() * 1.8);
      ctx.lineTo(x + span * 0.2, y + random() * 2.7);
      ctx.fill();
    }
  });
}

export function buildCampusBus(parent, { x, z, yaw = 0, width = 2.89, depth = 8.5, label = 'Varsity Bus' }, colliders) {
  const root = groupAt(parent, label, [x, 0, z], THREE.MathUtils.degToRad(yaw));
  const bodyWidth = width - 0.32;
  const halfWidth = bodyWidth / 2;
  const halfLength = depth / 2 - 0.05;
  const axles = [-depth * 0.298, depth * 0.29];
  const paint = standard('#157fce', { roughness: 0.52, metalness: 0.15 });
  const roofPaint = standard('#2b8ac1', { roughness: 0.48, metalness: 0.15 });
  const darkBlue = standard('#1d5272');
  const seal = standard('#203039');
  const rubber = standard('#222529', { roughness: 0.96 });
  const rim = standard('#3a3e3e', { metalness: 0.32, roughness: 0.59 });
  const aluminum = standard('#c5c6bd', { metalness: 0.29, roughness: 0.43 });
  const light = standard('#e2e4d3', { roughness: 0.29 });
  const amber = standard('#bd792b');
  const brake = standard('#a63b34');
  const glass = standard('#8ba6ad', { transparent: true, opacity: 0.48, depthWrite: false, roughness: 0.2 });
  const dust = standard('#ffffff', { map: scuffedPaint(), transparent: true, depthWrite: false });
  const badgeMap = new THREE.TextureLoader().load(new URL('../assets/stamford-bus-crest.webp', import.meta.url).href);
  badgeMap.colorSpace = THREE.SRGBColorSpace;
  const badge = standard('#ffffff', { map: badgeMap, transparent: true, depthWrite: false });

  function panel(parent, material, x, y, z, width, height) {
    const mesh = part(parent, unitPlane, material, [x, y, z], [width, height, 1]);
    mesh.castShadow = false;
  }

  function window(parent, x, width, bottom, top, frame, split = false) {
    const y = (bottom + top) / 2;
    const height = top - bottom;
    for (const railY of [bottom, top]) box(parent, frame, [width, 0.036, 0.033], [x, railY, 0.008]);
    const mullions = split ? [-width / 2, 0, width / 2] : [-width / 2, width / 2];
    for (const offset of mullions) box(parent, frame, [0.034, height, 0.035], [x + offset, y, 0.01]);
    panel(parent, glass, x, y, -0.001, width, height);
  }

  part(root, lowerBody(halfWidth, halfLength, axles), paint, [0, 0, 0]);
  part(root, roofShell(halfWidth, halfLength * 2), roofPaint, [0, 0, -halfLength]);
  box(root, darkBlue, [bodyWidth - 0.1, 0.14, depth - 0.28], [0, 1.49, 0]);
  box(root, darkBlue, [bodyWidth - 0.12, 0.13, depth - 0.23], [0, roofHeight - 0.23, 0]);
  for (let row = 0; row < 6; row++) {
    for (const side of [-1, 1]) {
      const seatZ = (row - 2.5) * depth * 0.117 - 0.25;
      box(root, seal, [bodyWidth * 0.32, 0.09, 0.48], [side * bodyWidth * 0.27, 1.55, seatZ]);
      box(root, seal, [bodyWidth * 0.32, 0.43, 0.08], [side * bodyWidth * 0.27, 1.78, seatZ - 0.2]).rotation.x = -0.12;
    }
  }
  const windowTop = 2.48;
  for (const side of [-1, 1]) {
    const elevation = groupAt(root, 'Bus side elevation', [side * halfWidth, 0, 0], side * Math.PI / 2);
    const sideX = (z) => -side * z;
    const windowStart = -halfLength + 0.15;
    const doorCenter = halfLength - 0.61;
    const doorWidth = 0.93;
    const windowEnd = doorCenter - 0.55;
    const pitch = (windowEnd - windowStart) / 6;
    box(elevation, paint, [halfLength * 2, roofShoulder - windowTop + 0.01, 0.043],
      [0, (roofShoulder + windowTop + 0.01) / 2, -0.021]);
    box(elevation, aluminum, [halfLength * 2 - 0.09, 0.039, 0.03], [0, beltline, 0.019]);
    for (let index = 0; index < 6; index++) {
      const paneX = sideX(windowStart + (index + 0.5) * pitch);
      const top = index === 1 ? windowTop - 0.17 : windowTop;
      window(elevation, paneX, pitch - 0.043, beltline + 0.036, top, aluminum, true);
      box(elevation, paint, [0.045, windowTop - beltline, 0.041], [paneX - pitch / 2, (windowTop + beltline) / 2, -0.022]);
      if (index === 1) box(elevation, paint, [pitch, windowTop - top, 0.045], [paneX, (top + windowTop) / 2, -0.023]);
    }
    panel(elevation, dust, 0, 1.2, 0.003, depth - 0.23, 0.51);
    panel(elevation, badge, sideX(axles[1] - 0.09), 1.14, 0.007, 0.47, 0.61);
    const forwardX = sideX(doorCenter);
    for (const edge of [windowStart, windowEnd, halfLength - 0.06]) {
      box(elevation, paint, [0.11, windowTop - beltline, 0.056],
        [sideX(edge), (windowTop + beltline) / 2, -0.025]);
    }
    if (side < 0) {
      box(elevation, paint, [doorWidth, 1.07, 0.033], [forwardX, 0.905, 0.031]);
      box(elevation, paint, [doorWidth + 0.12, 0.21, 0.055], [forwardX, 2.375, 0.015]);
      const door = groupAt(elevation, 'Folding passenger door', [forwardX, 0, 0.056]);
      for (const offset of [-doorWidth / 4, doorWidth / 4]) {
        window(door, offset, doorWidth / 2 - 0.065, 1.47, 2.27, seal);
        box(door, darkBlue, [0.093, 0.82, 0.01], [offset, 0.91, 0.001]);
        box(door, paint, [0.12, 0.065, 0.022], [offset, 1.02, 0.012]);
      }
      box(door, seal, [0.018, 1.91, 0.018], [0, 1.35, 0.012]);
      box(door, aluminum, [doorWidth, 0.034, 0.05], [0, 0.4, 0.008]);
      const handleX = -doorWidth / 2 - 0.075;
      rod(door, aluminum, [handleX, 0.99, 0.015], [handleX, 1.36, 0.06], 0.016);
    } else {
      window(elevation, forwardX, doorWidth - 0.045, beltline + 0.036, windowTop, aluminum, true);
    }

    for (const wheelZ of axles) {
      part(root, wheel, rubber, [side * (halfWidth - 0.185), tireRadius, wheelZ], [tireRadius, 0.33, tireRadius]).rotation.z = Math.PI / 2;
      part(root, wheel, rim, [side * (halfWidth - 0.013), tireRadius, wheelZ], [0.248, 0.037, 0.248]).rotation.z = Math.PI / 2;
      part(root, wheel, seal, [side * (halfWidth + 0.006), tireRadius, wheelZ], [0.107, 0.04, 0.107]).rotation.z = Math.PI / 2;
      for (let lug = 0; lug < 6; lug++) {
        const angle = lug * Math.PI / 3;
        part(root, wheel, rubber,
          [side * (halfWidth + 0.009), tireRadius + 0.165 * Math.cos(angle), wheelZ + 0.165 * Math.sin(angle)],
          [0.028, 0.013, 0.028]).rotation.z = Math.PI / 2;
      }
    }
    rod(root, seal, [side * halfWidth, 2.12, halfLength - 0.22],
      [side * (halfWidth + 0.104), 2.21, halfLength - 0.22], 0.021);
    box(root, seal, [0.075, 0.28, 0.115], [side * (halfWidth + 0.122), 2.17, halfLength - 0.22]);
  }
  for (const side of [-1, 1]) {
    const end = groupAt(root, side > 0 ? 'Bus front' : 'Bus rear', [0, 0, side * halfLength], side > 0 ? 0 : Math.PI);
    window(end, 0, bodyWidth - 0.23, 1.49, windowTop, seal, true);
    box(end, paint, [bodyWidth, roofShoulder - windowTop + 0.02, 0.07],
      [0, (roofShoulder + windowTop - 0.02) / 2, -0.036]);
    for (const x of [-halfWidth + 0.059, halfWidth - 0.059]) {
      box(end, paint, [0.118, 1.11, 0.05], [x, 2.01, -0.021]);
      box(end, side > 0 ? light : brake, [0.42, 0.165, 0.04], [x * 0.78, 0.68, 0.026]);
      box(end, amber, [0.12, 0.075, 0.045], [x * 0.93, 0.83, 0.027]);
    }
    box(end, seal, [bodyWidth * 0.52, 0.23, 0.034], [0, 0.85, 0.021]);
    box(end, darkBlue, [bodyWidth + 0.02, 0.16, 0.09], [0, 0.37, 0.004]);
    box(end, aluminum, [0.39, 0.112, 0.023], [0, 0.52, 0.025]);
  }
  addLocalCollider(colliders, root, 0, 0, width, depth, true, roofHeight, 0);
  return root;
}

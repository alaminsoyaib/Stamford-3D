import * as THREE from 'three';
import { academicStoryHeight, addLocalCollider, sign, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

const soffitThickness = 0.28;
const fasciaHeight = 2.35;
const copingThickness = 0.19;
const screenBase = 1.04;
const roofRise = soffitThickness + fasciaHeight + copingThickness;
// IMG_3145 measures 60 ft 2 in from grade to the roof edge.
export const cseStoryHeight = (722 * 0.0254 - roofRise) / 5;

function brickScreen() {
  const rng = seededRandom(3145);
  const map = canvasTexture(256, 256, (ctx, size) => {
    const cell = size / 4;
    ctx.fillStyle = '#a26150';
    ctx.fillRect(0, 0, size, size);
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const x = column * cell;
        const y = row * cell;
        ctx.fillStyle = rng() < 0.5 ? '#aa6652' : '#995b4d';
        ctx.fillRect(x, y, cell, cell);
        const inset = ctx.createLinearGradient(x, y, x + cell, y + cell);
        inset.addColorStop(0, '#4c2b26');
        inset.addColorStop(0.22, '#291c1b');
        inset.addColorStop(0.84, '#211819');
        inset.addColorStop(1, '#6e3d30');
        ctx.fillStyle = inset;
        ctx.beginPath();
        for (const [u, v] of [
          [0.41, 0.11], [0.59, 0.11], [0.88, 0.4], [0.88, 0.60],
          [0.59, 0.89], [0.41, 0.89], [0.12, 0.60], [0.12, 0.4]
        ]) ctx.lineTo(x + u * cell, y + v * cell);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = '#c58268';
        ctx.lineWidth = 1.4;
        ctx.stroke();
      }
    }
    ctx.fillStyle = '#33211d';
    for (let row = 0; row <= 4; row++) {
      for (let column = 0; column <= 4; column++) {
        const x = column * cell;
        const y = row * cell;
        ctx.beginPath();
        ctx.moveTo(x, y - 6.7);
        ctx.lineTo(x + 6.7, y);
        ctx.lineTo(x, y + 6.7);
        ctx.lineTo(x - 6.7, y);
        ctx.fill();
      }
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return [2.6, 5].map((repeatY) => [5.5, 2.75].map((repeatX) => {
    const tile = map.clone();
    tile.repeat.set(repeatX, repeatY);
    tile.needsUpdate = true;
    return standard('#ffffff', { map: tile });
  }));
}

function buildGround({ root, width, depth, story, facade }, { foundation, plaster }) {
  const setback = 0.72;
  const supportHeight = screenBase - 0.2;
  box(root, foundation, [width, screenBase, depth - setback], [0, screenBase / 2, -setback / 2]);
  box(root, plaster, [width, story - supportHeight, depth], [0, (story + supportHeight) / 2, 0]);
  const supports = Math.max(2, Math.round(width / 3.9));
  for (let i = 0; i < supports; i++) {
    const x = (i + 0.5) * width / supports - width / 2;
    box(root, plaster, [0.22, supportHeight, 0.26], [x, supportHeight / 2, facade - setback * 0.52]);
  }
}

function buildScreen(root, materials, { width, depth, facade }, levels) {
  const elevations = [
    { span: width, x: 0, z: facade, angle: 0 },
    { span: depth, x: width / 2, z: 0, angle: Math.PI / 2 },
    { span: width, x: 0, z: -facade, angle: Math.PI },
    { span: depth, x: -width / 2, z: 0, angle: -Math.PI / 2 }
  ];
  for (const { span, x, z, angle } of elevations) {
    const elevation = groupAt(root, 'Terracotta screen elevation', [x, 0, z], angle);
    const bays = Math.max(1, Math.round(span / 3.2) - 1);
    const pitch = span / (bays + 1);
    for (let row = 0; row < levels.length - 1; row++) {
      const bottom = levels[row];
      const rowHeight = levels[row + 1] - bottom;
      const rowMaterials = materials.screens[row === 0 ? 0 : 1];
      const y = bottom + rowHeight / 2;
      let cursor = -span / 2;
      for (let bay = 0; bay < bays + 2; bay++) {
        const end = bay === 0 || bay === bays + 1;
        const bayWidth = end ? pitch * 0.5 : pitch;
        const px = cursor + bayWidth / 2;
        const postWidth = Math.min(bayWidth * 0.3, 0.28);
        box(elevation, materials.plaster, [postWidth, rowHeight, 0.19], [cursor, y, 0.063]);
        part(elevation, unitPlane, rowMaterials[end ? 1 : 0], [px, y, 0.051], [bayWidth, rowHeight - 0.38, 1]);
        if (row > 0 && !end) {
          const frame = Math.min(0.83, bayWidth * 0.6);
          const trim = 0.105;
          for (const sign of [-1, 1]) {
            box(elevation, materials.plaster, [frame, trim, 0.086], [px, y + sign * (frame - trim) / 2, 0.1]);
            box(elevation, materials.plaster, [trim, frame - trim * 2, 0.086], [px + sign * (frame - trim) / 2, y, 0.1]);
          }
        }
        cursor += bayWidth;
      }
      box(elevation, materials.plaster, [0.24, rowHeight, 0.19], [cursor, y, 0.063]);
      box(elevation, materials.plaster, [span + 0.2, 0.45, 0.24], [0, bottom + 0.02, 0.068]);
    }
    box(elevation, materials.plaster, [span + 0.2, 0.22, 0.24], [0, levels.at(-1) - 0.11, 0.068]);
  }
}

function buildRoof(root, { plaster, fascia, blue, roofDeck }, { width, depth, facade, height }) {
  const overhang = 1.32;
  const rear = 0.54;
  const roofWidth = width + 1.26;
  const roofDepth = depth + overhang + rear;
  const centerZ = (overhang - rear) / 2;
  const fasciaY = height + soffitThickness + fasciaHeight / 2;
  const fasciaZ = facade + overhang - 0.041;
  box(root, plaster, [roofWidth, soffitThickness, roofDepth], [0, height + soffitThickness / 2, centerZ]);
  box(root, plaster, [roofWidth - 0.09, fasciaHeight, roofDepth - 0.09], [0, fasciaY, centerZ]);
  box(root, blue, [roofWidth + 0.07, copingThickness, 0.23], [0, height + roofRise - copingThickness / 2, facade + overhang - 0.055]);
  box(root, roofDeck, [roofWidth + 0.07, copingThickness - 0.01, roofDepth - 0.15],
    [0, height + roofRise - copingThickness / 2, centerZ - 0.075]);
  if (fascia) {
    part(root, unitPlane, fascia, [0, fasciaY, fasciaZ], [roofWidth - 0.09, fasciaHeight, 1]);
  } else {
    sign(root, { title: 'STAMFORD UNIVERSITY BANGLADESH', position: [0, fasciaY, fasciaZ],
      width: roofWidth - 0.09, height: fasciaHeight, seal: true, serif: true });
  }
  const brackets = Math.max(2, Math.round(width / 4));
  for (let i = 0; i < brackets; i++) {
    box(root, plaster, [0.36, 0.24, 1.41], [(i + 0.5) * width / brackets - width / 2, height - 0.11, facade + 0.52]);
  }
}

function stairRail(group, metal, x, start, end) {
  const height = 0.94;
  const bottom = 0.16;
  const [y, z] = start;
  const [topY, topZ] = end;
  rod(group, metal, [x, y + height, z], [x, topY + height, topZ], 0.031);
  rod(group, metal, [x, y + bottom, z], [x, topY + bottom, topZ], 0.021);
  const bays = Math.max(1, Math.round(Math.abs(topZ - z) / 0.48));
  for (let bay = 0; bay <= bays; bay++) {
    const t = bay / bays;
    const py = THREE.MathUtils.lerp(y, topY, t);
    const pz = THREE.MathUtils.lerp(z, topZ, t);
    rod(group, metal, [x, py, pz], [x, py + height, pz], 0.023);
    if (bay === bays) continue;
    const qy = THREE.MathUtils.lerp(y, topY, (bay + 1) / bays);
    const qz = THREE.MathUtils.lerp(z, topZ, (bay + 1) / bays);
    rod(group, metal, [x, py + bottom, pz], [x, qy + height - 0.065, qz], 0.012);
    rod(group, metal, [x, py + height - 0.065, pz], [x, qy + bottom, qz], 0.012);
  }
}

function treadPlate() {
  const map = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#69594d';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 12; column++) {
        ctx.save();
        ctx.translate((column + 0.5) * w / 12, (row + 0.5) * h / 8);
        ctx.rotate((row + column) % 2 ? 0.65 : -0.65);
        ctx.fillStyle = '#4b3f35';
        ctx.fillRect(-3.5, -0.6, 7, 2.4);
        ctx.fillStyle = '#9b8f82';
        ctx.fillRect(-3.5, -1.1, 6, 0.9);
        ctx.restore();
      }
    }
  });
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = 4;
  return standard('#ffffff', { map, metalness: 0.34, roughness: 0.71 });
}

function buildStair(root, colliders, materials, { width, depth, floors, story }) {
  if (floors < 2) return;
  const { plaster, darkMetal, treads, nosing } = materials;
  const stairWidth = 1.91;
  const landingDepth = 1.43;
  const halfWidth = stairWidth / 2;
  const steps = Math.round(story / 0.172);
  const run = steps * 0.263;
  const turnsCorner = floors > 2 && width >= run + landingDepth;
  const cornerZ = -depth / 2 - halfWidth - 0.14;
  const lowerEndZ = turnsCorner ? cornerZ + halfWidth : -depth / 2 + 0.42 + landingDepth;
  const stair = groupAt(root, 'Right-rear exterior stair beside the auditorium', [width / 2 + halfWidth + 0.14, 0, 0]);
  box(stair, plaster, [stairWidth + 0.19, 0.125, 0.91], [0, 0.0625, lowerEndZ + run + 0.25]);
  const lower = addFlight([0, 0, lowerEndZ + run], 0);

  if (!turnsCorner) {
    addDoorLanding(lower);
    return;
  }

  // Turn around the rear corner on a shared landing.
  const corner = groupAt(stair, 'Corner landing', [0, story, cornerZ]);
  box(corner, treads, [stairWidth, 0.145, stairWidth], [0, -0.0725, 0]);
  stairRail(corner, darkMetal, halfWidth, [0, halfWidth], [0, -halfWidth]);
  const rearEdge = groupAt(corner, 'Rear landing guard rail', [0, 0, -halfWidth], Math.PI / 2);
  stairRail(rearEdge, darkMetal, 0, [0, halfWidth], [0, -halfWidth]);
  rod(corner, darkMetal, [halfWidth, -story, -halfWidth], [halfWidth, 0, -halfWidth], 0.066);
  addLocalCollider(colliders, corner, 0, 0, stairWidth + 0.15, stairWidth);

  const upper = addFlight([-halfWidth, story, cornerZ], Math.PI / 2);
  addDoorLanding(upper);

  function addFlight(position, yaw) {
    const section = groupAt(stair, 'Steel stair flight and landing', position, yaw);
    const rise = story / steps;
    const stride = run / steps;
    for (let step = 0; step < steps; step++) {
      const stepZ = -(step + 0.5) * stride;
      box(section, treads, [stairWidth, rise - 0.008, stride + 0.012], [0, (step + 0.5) * rise + 0.004, stepZ]);
      box(section, nosing, [stairWidth, 0.023, 0.041], [0, (step + 1) * rise - 0.012, stepZ + stride / 2 - 0.005]);
    }
    for (const x of [-halfWidth, halfWidth]) {
      rod(section, darkMetal, [x, -0.015, 0], [x, story - 0.14, -run], 0.073);
      stairRail(section, darkMetal, x, [0, 0], [story, -run]);
    }
    addLocalCollider(colliders, section, 0, -run / 2, stairWidth + 0.15, run);
    return section;
  }

  function addDoorLanding(section) {
    const landing = groupAt(section, 'Upper stair landing at door', [0, story, -run - landingDepth / 2]);
    box(landing, treads, [stairWidth, 0.145, landingDepth], [0, -0.0725, 0]);
    box(landing, treads, [0.21, 0.145, landingDepth], [-halfWidth - 0.07, -0.0725, 0]);
    stairRail(landing, darkMetal, halfWidth, [0, landingDepth / 2], [0, -landingDepth / 2]);
    const endRail = groupAt(landing, 'End landing guard rail', [0, 0, -landingDepth / 2], Math.PI / 2);
    stairRail(endRail, darkMetal, 0, [0, halfWidth], [0, -halfWidth]);
    for (const x of [-halfWidth, halfWidth]) {
      rod(landing, darkMetal, [x, -story - section.position.y, -landingDepth / 2], [x, 0, -landingDepth / 2], 0.066);
    }
    box(landing, plaster, [0.14, 2.31, 1.36], [-halfWidth - 0.12, 1.15, 0]);
    box(landing, darkMetal, [0.065, 2.09, 1.1], [-halfWidth - 0.04, 1.045, 0]);
    addLocalCollider(colliders, landing, 0, 0, stairWidth + 0.15, landingDepth);
  }
}

export async function createCseExterior(kit) {
  const url = new URL('../assets/cse-fascia.webp', import.meta.url);
  const photo = await new THREE.TextureLoader().loadAsync(url.href).catch(() => null);
  if (photo) {
    photo.colorSpace = THREE.SRGBColorSpace;
    photo.anisotropy = 8;
  }
  const materials = {
    plaster: standard('#e4ded0', { roughness: 0.94 }),
    foundation: standard('#292c2b', { roughness: 1 }),
    screens: brickScreen(),
    fascia: photo && standard('#ffffff', { map: photo, roughness: 0.85 }),
    blue: standard('#304968'),
    roofDeck: standard('#7b7569'),
    darkMetal: standard('#393532', { metalness: 0.48, roughness: 0.69 }),
    treads: treadPlate(),
    nosing: standard('#a69a89', { metalness: 0.43 })
  };
  return {
    groundExterior: (building) => buildGround(building, materials),
    exterior(building) {
      const { root, width, facade, height, floors } = building;
      const rows = Math.max(1, floors - 1);
      const levels = [screenBase];
      for (let row = 1; row < rows; row++) {
        levels.push(THREE.MathUtils.lerp(academicStoryHeight, height, (row - 1) / (rows - 1)));
      }
      buildScreen(root, materials, building, [...levels, height]);
      buildRoof(root, materials, building);
      buildStair(root, kit.colliders, materials, building);
      const rearSignY = levels[1] ?? screenBase;
      sign(root, {
        title: 'DEPT OF CSE', position: [width * 0.16, rearSignY + 0.02, -facade - 0.2],
        width: Math.min(2.12, width * 0.19), height: 0.38, yaw: Math.PI,
        background: '#d1c8b8', ink: '#426681'
      });
    }
  };
}

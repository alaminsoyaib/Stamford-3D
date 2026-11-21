import * as THREE from 'three';
import { academicStoryHeight, officialStoryHeight, sign, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, part, seededRandom, unitPlane } from './sceneKit.js';

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

export async function createCseExterior(kit) {
  const adjacentStoryHeight = kit.map.buildings.official?.academicWing ? officialStoryHeight : academicStoryHeight;
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
    roofDeck: standard('#7b7569')
  };
  return {
    groundExterior: (building) => buildGround(building, materials),
    exterior(building) {
      const { root, width, facade, height, floors } = building;
      const rows = Math.max(1, floors - 1);
      const levels = [screenBase];
      for (let row = 1; row < rows; row++) {
        levels.push(THREE.MathUtils.lerp(adjacentStoryHeight, height, (row - 1) / (rows - 1)));
      }
      buildScreen(root, materials, building, [...levels, height]);
      buildRoof(root, materials, building);
      const rearSignY = levels[1] ?? screenBase;
      sign(root, {
        title: 'DEPT OF CSE', position: [width * 0.16, rearSignY + 0.02, -facade - 0.2],
        width: Math.min(2.12, width * 0.19), height: 0.38, yaw: Math.PI,
        background: '#d1c8b8', ink: '#426681'
      });
    }
  };
}

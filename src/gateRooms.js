import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

const measuredEave = 123 * 0.0254; // IMG_3142.JPG, paving to the crest of the blue front eave.
const wallThickness = 0.32;
const skirting = 0.25;
const ribHeight = 0.027;
const roofProfiles = new Map();

function corrugatedSheet(parent, material, width, depth, x, frontZ, crest, rise) {
  const ribs = Math.max(1, Math.round(width / 0.16));
  const steps = ribs * 8;
  const key = `${ribs}/${rise}`;
  let geometry = roofProfiles.get(key);
  if (!geometry) {
    const positions = [];
    const indices = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps - 0.5;
      const wave = ribHeight * (Math.cos(i * Math.PI / 4) - 1);
      positions.push(u, wave, 0, u, wave + rise, -1);
      const a = i * 2;
      if (i < steps) indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
    }
    geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    roofProfiles.set(key, geometry);
  }
  return part(parent, geometry, material, [x, crest, frontZ], [width, 1, depth]);
}

function paintedPlaster() {
  const random = seededRandom(3142);
  const map = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#f1efea';
    ctx.fillRect(0, 0, w, h);
    for (let i = 0; i < 1800; i++) {
      ctx.fillStyle = i % 4 === 0 ? '#fffaf04d' : '#6d665915';
      ctx.fillRect(random() * w, random() * h, 0.4 + random() * 2, 1 + random() * 3);
    }
  });
  return standard('#ffffff', { map });
}

function wallBand(parent, material, left, right, bottom, top) {
  if (right > left && top > bottom) {
    box(parent, material, [right - left, top - bottom, wallThickness],
      [(left + right) / 2, (bottom + top) / 2, -wallThickness / 2]);
  }
}

function facadeWall(parent, material, span, story, openings) {
  let left = -span / 2;
  for (const { x, width, bottom, top } of openings) {
    wallBand(parent, material, left, x - width / 2, 0, story);
    wallBand(parent, material, x - width / 2, x + width / 2, 0, bottom);
    wallBand(parent, material, x - width / 2, x + width / 2, top, story);
    left = x + width / 2;
  }
  wallBand(parent, material, left, span / 2, 0, story);
}

export function createGateRoomModels({ materials, colliders }) {
  const plaster = paintedPlaster();
  const base = standard('#222627');
  const fascia = standard('#145099');
  const blueSheet = standard('#128ad7', {
    side: THREE.DoubleSide, roughness: 0.44, metalness: 0.18, emissive: '#0a4a7a', emissiveIntensity: 0.12
  });
  const graySheet = standard('#656662', { side: THREE.DoubleSide, roughness: 0.66, metalness: 0.27 });
  const steel = standard('#423d36', { metalness: 0.22 });
  const aluminum = standard('#b9b9ab', { metalness: 0.29, roughness: 0.49 });
  const glazing = standard('#a1b6b6', { transparent: true, opacity: 0.28, depthWrite: false, roughness: 0.26 });
  const transom = standard('#7f908d', { roughness: 0.67 });
  const backing = standard('#a59d83');
  const interiorWall = standard('#ffffff', {
    map: canvasTexture(64, 64, (ctx, w, h) => {
      const shade = ctx.createLinearGradient(0, 0, w * 0.4, h);
      shade.addColorStop(0, '#666052');
      shade.addColorStop(0.36, '#96896f');
      shade.addColorStop(1, '#7e7560');
      ctx.fillStyle = shade;
      ctx.fillRect(0, 0, w, h);
    })
  });
  const shadow = standard('#34342d');
  const enamel = standard('#d3cdb6');
  const notice = standard('#ffffff', {
    map: canvasTexture(384, 132, (ctx, w, h) => {
      ctx.fillStyle = '#213b6e';
      ctx.fillRect(0, 0, w, h);
      ctx.strokeStyle = '#e5e2d7';
      ctx.lineWidth = 4;
      ctx.strokeRect(6, 6, w - 12, h - 12);
      ctx.fillStyle = '#f4efdc';
      ctx.textAlign = 'center';
      ctx.font = 'bold 30px Arial';
      ctx.fillText('HANGING POSTER ON', w / 2, 54, w - 24);
      ctx.fillText('THE WALL IS PROHIBITED', w / 2, 99, w - 24);
    })
  });

  function slidingWindow(wall, opening, { panes = 2, grille = false, open = false } = {}) {
    const { x, width, bottom, top } = opening;
    const height = top - bottom;
    const center = (top + bottom) / 2;
    const frame = 0.036;
    for (const y of [bottom, top]) box(wall, aluminum, [width + frame, frame, 0.066], [x, y, -0.018]);
    for (let i = 0; i <= panes; i++) {
      box(wall, aluminum, [frame, height, 0.065], [x + width * (i / panes - 0.5), center, -0.019]);
    }
    const glassTop = grille ? top - 0.36 : top;
    for (let i = Number(open); i < panes; i++) {
      const paneX = x + width * ((i + 0.5) / panes - 0.5);
      const glass = part(wall, unitPlane, glazing, [paneX, (bottom + glassTop) / 2, -0.039],
        [width / panes - frame, glassTop - bottom - frame, 1]);
      glass.castShadow = false;
    }
    if (grille) {
      box(wall, transom, [width - frame, top - glassTop, 0.025], [x, (top + glassTop) / 2, -0.053]);
      box(wall, aluminum, [width, frame, 0.065], [x, glassTop, -0.018]);
      for (let y = bottom + 0.13; y < glassTop - 0.05; y += 0.14) {
        box(wall, aluminum, [width - frame, 0.013, 0.015], [x, y, 0.006]);
      }
    }
    part(wall, unitPlane, interiorWall, [x, center, -wallThickness + 0.004], [width, height, 1]).castShadow = false;
    box(wall, shadow, [width - 0.04, 0.09, 0.23], [x, bottom + 0.065, -0.17]);
  }

  function guardNook(root, width, story, facade) {
    const nookWidth = 2.12;
    const x = -width / 2 - nookWidth / 2;
    const rear = facade - 2.14;
    const edge = facade + 0.14;
    const crest = story + 0.075;
    const group = groupAt(root, 'Open guard shelter', [x, 0, 0]);
    corrugatedSheet(group, graySheet, nookWidth + 0.04, edge - rear + 0.1, 0, edge, crest, 0.12);
    box(group, materials.concrete, [nookWidth, 0.04, edge - rear], [0, 0.02, (edge + rear) / 2]);
    box(group, backing, [nookWidth, crest, 0.11], [0, crest / 2, rear]);
    addLocalCollider(colliders, root, x, rear, nookWidth, 0.16, true, crest, 0);
    for (const z of [rear + 0.09, facade - 0.92, facade + 0.02]) {
      rod(group, steel, [-nookWidth / 2, crest - 0.08, z], [nookWidth / 2, crest - 0.08, z], 0.025);
    }
    const postX = -nookWidth / 2 + 0.05;
    rod(group, steel, [postX, 0, facade + 0.02], [postX, crest - 0.07, facade + 0.02], 0.031);
    addLocalCollider(colliders, root, x + postX, facade + 0.02, 0.12, 0.12, true, crest, 0);
    box(group, materials.wood, [0.94, 0.05, 0.62], [0.52, 0.78, facade - 0.31]);
    box(group, materials.wood, [0.86, 0.67, 0.49], [0.52, 0.39, facade - 0.31]);
    addLocalCollider(colliders, root, x + 0.52, facade - 0.31, 0.94, 0.62, true, 0.82, 0);
    addLocalCollider(colliders, root, x, (edge + rear) / 2, nookWidth + 0.04, edge - rear + 0.1, true, crest + 0.14, crest - 0.12);
  }

  function meterCage(front, x) {
    const cage = groupAt(front, 'Guard room meter cage', [x, 2.47, 0]);
    box(cage, enamel, [0.28, 0.24, 0.11], [0, -0.025, 0.06]);
    box(cage, shadow, [0.12, 0.083, 0.027], [0, 0.004, 0.123]);
    for (let i = 0; i <= 6; i++) {
      box(cage, steel, [0.012, 0.40, 0.012], [(i - 3) * 0.078, 0, 0.306]);
    }
    for (let i = 0; i <= 5; i++) {
      const y = (i - 2.5) * 0.077;
      box(cage, steel, [0.48, 0.012, 0.012], [0, y, 0.306]);
      for (const side of [-1, 1]) box(cage, steel, [0.012, 0.012, 0.30], [side * 0.234, y, 0.156]);
    }
    for (const side of [-1, 1]) {
      for (const z of [0.06, 0.14, 0.22]) box(cage, steel, [0.012, 0.40, 0.012], [side * 0.234, 0, z]);
    }
  }

  const room = (guardian) => ({
    wall: plaster,
    minWidth: guardian ? 2.9 : 4.3,
    roofTop: ({ story, height }) => height - story + measuredEave - (guardian ? 0.14 : 0) + 0.14,
    groundExterior({ root, width, depth, story, facade }) {
      const front = groupAt(root, guardian ? 'Guardian room frontage' : 'Guard room frontage', [0, 0, facade]);
      const sideInset = guardian ? 0 : wallThickness;
      box(root, plaster, [width - sideInset, story, depth - wallThickness],
        [sideInset / 2, story / 2, -wallThickness / 2]);
      const windowBottom = 1.16;
      if (guardian) {
        const door = { x: -width / 2 + 0.51, width: 0.94, bottom: 0.13, top: 2.43 };
        const window = { x: 0.52, width: width - 1.19, bottom: 1.08, top: 2.66 };
        facadeWall(front, plaster, width, story, [door, window]);
        slidingWindow(front, window, { panes: Math.max(2, Math.round(window.width / 1.04)), grille: true });
        box(front, aluminum, [door.width + 0.03, door.top - door.bottom + 0.05, 0.09],
          [door.x, (door.bottom + door.top) / 2, -0.028]);
        box(front, enamel, [door.width - 0.065, door.top - door.bottom - 0.05, 0.035],
          [door.x, (door.bottom + door.top) / 2, 0.024]);
        box(front, steel, [0.11, 0.026, 0.035], [door.x + 0.33, 1.16, 0.056]);
        box(front, materials.concrete, [door.width + 0.16, 0.135, 0.35], [door.x, 0.068, 0.11]);
        const skirtStart = door.x + door.width / 2;
        box(front, base, [width / 2 - skirtStart, skirting, 0.038],
          [(width / 2 + skirtStart) / 2, skirting / 2, 0.004]);
      } else {
        const first = { x: -width * 0.22, width: 1.48, bottom: windowBottom, top: 2.38 };
        const second = { x: width * 0.22, width: 1.29, bottom: windowBottom, top: 2.29 };
        facadeWall(front, plaster, width, story, [first, second]);
        slidingWindow(front, first, { open: true });
        slidingWindow(front, second);
        box(front, shadow, [0.33, 0.34, 0.11], [first.x - 0.38, first.bottom + 0.18, -0.18]).rotation.z = -0.08;
        meterCage(front, second.x - 0.27);
        box(front, base, [width + 0.039, skirting, 0.039], [0, skirting / 2, 0.004]);
        part(front, unitPlane, notice, [-width / 2 + 0.23, 1.62, 0.009], [0.43, 0.15, 1]).castShadow = false;
        const side = groupAt(root, 'Shelter-facing guard window', [-width / 2, 0, -wallThickness / 2], -Math.PI / 2);
        const sideWindow = { x: (depth - wallThickness) * 0.22, width: 1.25, bottom: 1.12, top: 2.31 };
        facadeWall(side, plaster, depth - wallThickness, story, [sideWindow]);
        slidingWindow(side, sideWindow, { open: true });
        guardNook(root, width, story, facade);
      }
      box(root, base, [0.035, skirting, depth], [width / 2, skirting / 2, 0]);
      box(root, base, [0.035, skirting, depth], [-width / 2, skirting / 2, 0]);
      box(root, base, [width, skirting, 0.035], [0, skirting / 2, -depth / 2]);
    },
    roof({ root, width, depth, story, height, facade }) {
      const eave = facade + (guardian ? 0.37 : 0.78);
      const crest = height - story + measuredEave - (guardian ? 0.14 : 0);
      const overhang = guardian ? 0.06 : 0.19;
      const sheetDepth = depth + eave - facade + 0.13;
      corrugatedSheet(root, guardian ? graySheet : blueSheet, width + overhang * 2, sheetDepth,
        0, eave, crest, 0.13);
      addLocalCollider(colliders, root, 0, eave - sheetDepth / 2, width + overhang * 2, sheetDepth, true, crest + 0.14, crest - 0.14);
      box(root, guardian ? steel : fascia, [width + 0.035, guardian ? 0.14 : 0.26, 0.16],
        [0, height + (guardian ? 0.062 : 0.121), facade + 0.012]);
      const frontRailY = crest - ribHeight * 2 - 0.026;
      box(root, steel, [width + overhang * 2, 0.05, 0.048], [0, frontRailY, eave - 0.09]);
      for (const fraction of [-0.43, 0.02, 0.43]) {
        const x = width * fraction;
        rod(root, steel, [x, height - 0.53, facade + 0.027], [x, frontRailY, eave - 0.09], 0.025);
      }
    }
  });
  return { guard: room(false), guardian: room(true) };
}

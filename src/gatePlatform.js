import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { canvasTexture, groupAt, cylinder, part, rod, seededRandom } from './sceneKit.js';

const id = 'gate-platform';
const dimensions = { width: 6.1468, depth: 3.8862, height: 0.5588 };
const profile = (points) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r, y)), 16);
const potBody = profile([[0, 0], [0.65, 0], [0.7, 0.07], [0.92, 0.84], [1, 0.89], [1, 1], [0.85, 1], [0.84, 0.81]]);
const potLip = profile([[1.006, 0.908], [1.011, 0.987], [0.981, 1.014], [0.864, 1.014], [0.849, 0.983]]);
const leafGeometry = new THREE.BufferGeometry();
leafGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0, -0.46, 0.43, 0, 0, 0.5, 0.16,
  0, 0, 0, 0, 0.5, 0.16, 0.46, 0.43, 0,
  -0.46, 0.43, 0, 0, 1, 0, 0, 0.5, 0.16,
  0.46, 0.43, 0, 0, 0.5, 0.16, 0, 1, 0
], 3));
leafGeometry.computeVertexNormals();

function ceramicTiles() {
  const rng = seededRandom(3140);
  const texture = canvasTexture(256, 256, (context, width, height) => {
    context.fillStyle = '#99948a';
    context.fillRect(0, 0, width, height);
    const cell = width / 4;
    for (let row = 0; row < 4; row++) {
      for (let column = 0; column < 4; column++) {
        const x = column * cell;
        const y = row * cell;
        const tint = 225 + Math.floor(rng() * 9);
        const finish = context.createLinearGradient(x, y, x + cell, y + cell);
        finish.addColorStop(0, `rgb(${tint + 6}, ${tint + 5}, ${tint - 2})`);
        finish.addColorStop(1, `rgb(${tint}, ${tint - 2}, ${tint - 10})`);
        context.fillStyle = finish;
        context.fillRect(x + 0.65, y + 0.65, cell - 1.3, cell - 1.3);
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return standard('#ffffff', { map: texture, roughness: 0.56 });
}

export function buildGatePlatform(zone, kit, gate) {
  const { map, materials: m, foliage } = kit;
  const elements = map.elements ??= {};
  if (!elements[id]) {
    // The reference looks toward the inside of the gate. Its left side is the right side on entry.
    const offset = new THREE.Vector3(19.5, 0, -(dimensions.depth / 2 + 0.43));
    const center = gate.localToWorld(offset);
    elements[id] = {
      ...dimensions, x: center.x, z: center.z, yaw: THREE.MathUtils.radToDeg(gate.rotation.y)
    };
    if (map.deck?.includes('entry-gate') || map.removedObjects?.includes('entry-gate')) (map.deck ??= []).push(id);
  }
  const { width, depth, height } = elements[id];
  const root = groupAt(zone, 'Gate-side tiled platform', [0, 0, 0]);
  kit.layout.add(id, root);

  // The texture shows four tiles per repeat. The risers are two tiles high.
  const geometry = new THREE.BoxGeometry(width, height, depth);
  const uv = geometry.attributes.uv;
  const normals = geometry.attributes.normal;
  const columns = Math.round(width / 0.305) / 4;
  const rows = Math.round(depth / 0.305) / 4;
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * (normals.getX(i) ? rows : columns), uv.getY(i) * (normals.getY(i) ? rows : 0.5));
  }
  part(root, geometry, ceramicTiles(), [0, height / 2, 0]);
  addLocalCollider(kit.colliders, root, 0, 0, width, depth);

  const redClay = standard('#a44c3c');
  const weatheredClay = standard('#8a6c50');
  const paleRim = standard('#e2ddd1');
  const rng = seededRandom(3138);
  // The narrow end away from the gate carries the long row of pots in IMG_3138.
  for (let i = 0; i < 9; i++) {
    const inRow = i < 7;
    const x = (inRow ? 1 : -1) * (width / 2 - 0.3);
    const z = inRow ? (i / 6 - 0.5) * (depth - 0.7) : (i === 7 ? -0.85 : -0.16);
    const planter = groupAt(root, 'Tapered clay planter', [x, height, z]);
    const radius = 0.16 + rng() * 0.075;
    const potHeight = 0.24 + rng() * 0.13;
    const clay = i % 4 === 1 ? weatheredClay : redClay;
    part(planter, potBody, clay, [0, 0, 0], [radius, potHeight, radius]);
    part(planter, potLip, i % 4 === 1 ? clay : paleRim, [0, 0, 0], [radius, potHeight, radius]);
    const soilHeight = potHeight * 0.84;
    cylinder(planter, m.soil, radius * 0.83, 0.018, [0, soilHeight, 0]);

    const phase = rng() * Math.PI * 2;
    for (let stem = 0; stem < 4; stem++) {
      const angle = phase + stem * 2.4;
      const spread = radius * (0.72 + rng() * 0.92);
      const rise = 0.25 + rng() * 0.47;
      const dx = Math.cos(angle) * spread;
      const dz = Math.sin(angle) * spread;
      rod(planter, m.bark, [0, soilHeight, 0], [dx, soilHeight + rise, dz], 0.008);
      for (let leaf = 0; leaf < 5; leaf++) {
        const t = 0.43 + leaf * 0.125;
        const size = 0.068 + rng() * 0.082;
        const mesh = part(planter, leafGeometry, foliage[(i + stem + leaf) % foliage.length],
          [dx * t, soilHeight + rise * t, dz * t], [size * 0.59, size, size]);
        mesh.rotation.set(0.9, angle, (leaf % 2 ? 1 : -1) * (0.45 + rng() * 0.45));
      }
    }
  }
}

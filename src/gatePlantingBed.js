import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { clayPot, leafGeometry } from './gatePlatform.js';
import { groupAt, part, rod, seededRandom } from './sceneKit.js';

const id = 'gate-planting-bed';
const width = 5.2;
const depth = 2.6;
const curbHeight = 0.29;
const soilHeight = 0.26;

function buildCurb(root, m) {
  // Shape XY is mapped to world X and -Z. The short straight return sits closest to the gate.
  const outline = new THREE.Shape();
  outline.moveTo(-2.6, -1.12);
  outline.lineTo(2.6, -1.12);
  outline.lineTo(2.6, 0.1);
  outline.quadraticCurveTo(2.64, 1.31, 0.96, 1.45);
  outline.quadraticCurveTo(-1.1, 1.62, -1.64, 0.24);
  outline.lineTo(-2.6, 0.24);
  outline.closePath();
  const points = outline.curves.flatMap((curve) =>
    curve.getSpacedPoints(Math.max(1, Math.round(curve.getLength() / 0.5))).slice(0, -1));

  const positions = [];
  const colors = [];
  const paint = [new THREE.Color('#30302b'), new THREE.Color('#e7e3d9')];
  for (const [index, a] of points.entries()) {
    const b = points[(index + 1) % points.length];
    positions.push(
      a.x, 0, -a.y, b.x, 0, -b.y, b.x, curbHeight, -b.y,
      a.x, 0, -a.y, b.x, curbHeight, -b.y, a.x, curbHeight, -a.y
    );
    const { r, g, b: blue } = paint[index % paint.length];
    for (let vertex = 0; vertex < 6; vertex++) colors.push(r, g, blue);
  }
  const siding = new THREE.BufferGeometry();
  siding.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  siding.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  siding.computeVertexNormals();
  part(root, siding, standard('#ffffff', { vertexColors: true }), [0, 0, 0]);
  const inner = points.map((point) => point.clone().multiply(new THREE.Vector2(0.94, 0.88)));
  const coping = new THREE.Shape(points);
  coping.holes.push(new THREE.Path(inner));
  part(root, new THREE.ShapeGeometry(coping), m.concrete, [0, curbHeight, 0]).rotation.x = -Math.PI / 2;
  part(root, new THREE.ShapeGeometry(new THREE.Shape(points)), m.soil, [0, soilHeight, 0]).rotation.x = -Math.PI / 2;
}

function buildWhorledTree(parent, m, foliage) {
  const height = 7.4;
  for (let tier = 0; tier < 8; tier++) {
    const y = height * tier / 8;
    rod(parent, m.bark, [0, y, 0], [0, y + height / 8 + 0.01, 0], 0.135 - tier * 0.014);
  }
  for (let tier = 0; tier < 7; tier++) {
    const y = 2.7 + tier * 0.68;
    const reach = 1.65 - tier * 0.22;
    for (let branch = 0; branch < 6; branch++) {
      const angle = branch * Math.PI / 3 + tier * 0.42;
      const dx = Math.sin(angle) * reach;
      const dz = Math.cos(angle) * reach;
      rod(parent, m.bark, [0, y, 0], [dx, y + 0.19, dz], 0.021);
      for (let spray = 0; spray < 5; spray++) {
        const t = 0.27 + spray * 0.165;
        for (const side of [-1, 1]) {
          const leaf = part(parent, leafGeometry, foliage[(tier + branch + spray) % foliage.length],
            [dx * t, y + 0.19 * t, dz * t], [0.18, 0.35 - tier * 0.027, 0.22]);
          leaf.rotation.set(1.3, angle + side * 0.75, 0, 'YXZ');
        }
      }
    }
  }
}

function fanLeaves(parent, kit, base, size, breadth, count, rng) {
  const { materials: m, foliage } = kit;
  for (let i = 0; i < count; i++) {
    const angle = i * 2.4;
    const reach = size * (0.12 + rng() * 0.32);
    const tip = [Math.sin(angle) * reach, base + size * (0.3 + rng() * 0.52), Math.cos(angle) * reach];
    rod(parent, m.bark, [0, base, 0], tip, 0.012);
    const leaf = part(parent, leafGeometry, foliage[i % foliage.length], tip,
      [size * breadth * (0.65 + rng() * 0.35), size * (0.49 + rng() * 0.43), size]);
    leaf.rotation.set(0.56 + rng() * 1.08, angle, (rng() - 0.5) * 0.35, 'YXZ');
  }
}

export function buildGatePlantingBed(zone, kit, gate) {
  const { map, materials: m, foliage } = kit;
  const elements = map.elements ??= {};
  if (!elements[id]) {
    const center = gate.localToWorld(new THREE.Vector3(11.65, 0, -1.83));
    elements[id] = { x: center.x, z: center.z, yaw: THREE.MathUtils.radToDeg(gate.rotation.y), width, depth };
    if (map.deck?.includes('entry-gate') || map.removedObjects?.includes('entry-gate')) (map.deck ??= []).push(id);
  }
  const root = groupAt(zone, 'Gate-side planting bed', [0, 0, 0]);
  kit.layout.add(id, root);
  buildCurb(root, m);
  addLocalCollider(kit.colliders, root, 0.49, -0.18, 4.21, 2.6);
  addLocalCollider(kit.colliders, root, -2.11, 0.44, 0.98, 1.36);

  // These trees are part of the bed so storing or moving it keeps the planting intact.
  kit.tree(root, 1.65, 0.45, 0.94, 'palm', 620, null).position.y = soilHeight;
  const shadeTree = kit.tree(root, -1.04, 0.36, 1.05, 'shade', 621, null);
  shadeTree.position.y = soilHeight;
  shadeTree.rotation.z = 0.12;
  buildWhorledTree(groupAt(root, 'Tiered tree', [0.45, soilHeight, 0.23]), m, foliage);

  const rng = seededRandom(622);
  const redClay = standard('#a94c3b');
  const warmClay = standard('#8b7157');
  const pots = [
    { x: 1.73, z: -0.85, radius: 0.28, height: 0.39, size: 0.66, breadth: 0.16, leaves: 19, clay: redClay },
    { x: 0.92, z: -1.08, radius: 0.24, height: 0.36, size: 0.61, breadth: 0.35, leaves: 12, clay: warmClay },
    { x: 0.06, z: -0.95, radius: 0.25, height: 0.41, size: 0.9, breadth: 0.42, leaves: 8, clay: warmClay },
    { x: -0.83, z: -0.68, radius: 0.15, height: 0.25, size: 0.53, breadth: 0.33, leaves: 6, clay: warmClay },
    { x: -2.19, z: 0.2, radius: 0.21, height: 0.29, size: 0.57, breadth: 0.29, leaves: 11, clay: redClay }
  ];
  for (const { x, z, radius, height, size, breadth, leaves, clay } of pots) {
    const pot = clayPot(root, [x, soilHeight, z], radius, height, { clay, rim: m.concrete, soil: m.soil });
    fanLeaves(pot, kit, height * 0.84, size, breadth, leaves, rng);
  }
  fanLeaves(groupAt(root, 'Underplanting', [1.18, soilHeight, 0]), kit, 0, 0.65, 0.18, 19, rng);
  fanLeaves(groupAt(root, 'Underplanting', [-0.54, soilHeight, 0.39]), kit, 0, 0.62, 0.32, 12, rng);
}

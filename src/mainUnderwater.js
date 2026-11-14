import * as THREE from 'three';
import { batchStaticMeshes, cameraFrustum, createPortal, cylinder, glowSprite, groupAt, part, rod, seededRandom } from './sceneKit.js';
import { createRuntime, movementAxes, setLocation, updateCoordinates } from './sceneRuntime.js';

const TAU = Math.PI * 2;
const limit = 55;
const maxDepth = 120;
const seafloorY = -121.55;
const orb = new THREE.SphereGeometry(1, 16, 10);
const rock = new THREE.DodecahedronGeometry(1, 0);
const bellGeometry = new THREE.SphereGeometry(1, 24, 13, 0, TAU, 0, Math.PI * 0.64);
const rimGeometry = new THREE.TorusGeometry(1, 0.037, 7, 36);
const creatureEye = new THREE.MeshBasicMaterial({ color: '#111b2b' });
const whiteEye = new THREE.MeshBasicMaterial({ color: '#fff4d6' });
const layers = ['Sunlit Reef', 'Midwater', 'The Abyss'];

function matte(color, emissive = '#000000', emissiveIntensity = 0) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.79, emissive, emissiveIntensity });
}

const reefColors = [
  [matte('#ff7965', '#cd574d', 0.24), matte('#ffc3a0', '#e8917c', 0.19)],
  [matte('#f7af4a', '#f78b43', 0.19), matte('#ffe6a0', '#e4b94a', 0.18)],
  [matte('#a587d1', '#a75fc0', 0.23), matte('#f3abd5', '#d974ab', 0.22)],
  [matte('#61c7ac', '#4abda8', 0.16), matte('#a7ead0', '#48c8bd', 0.22)]
];
const rocks = [matte('#53747b'), matte('#627c7c'), matte('#738788'), matte('#435a69')];

function outcrop(parent, [x, y, z], [sx, sy, sz], variant, random) {
  const mesh = part(parent, rock, rocks[variant % rocks.length], [x, y, z], [sx, sy, sz]);
  mesh.rotation.set((random() - 0.5) * 0.47, random() * TAU, (random() - 0.5) * 0.27);
}

function rockColumn(parent, x, topY, z, radius, index, random) {
  const levels = Math.ceil((topY - seafloorY) / 8.5);
  for (let level = 0; level <= levels; level++) {
    const y = THREE.MathUtils.lerp(topY, seafloorY, level / levels);
    const depth = (topY - y) / 100;
    const spread = radius * (0.59 + depth * 0.23 + random() * 0.16);
    const px = x + Math.sign(x) * depth * 2.5 + (random() - 0.5) * 1.5;
    const pz = z + Math.sin(y * 0.19 + index) * 1.1;
    outcrop(parent, [px, y, pz], [spread, 6.7 + random() * 1.6, spread * 0.87], index + level, random);
  }
}

function coral(parent, position, size, variant, rng, branching) {
  const root = groupAt(parent, 'Coral colony', position, rng() * TAU);
  root.scale.setScalar(size);
  const [stem, tip] = reefColors[variant % reefColors.length];
  if (branching) {
    const arms = 4 + Math.floor(rng() * 3);
    rod(root, stem, [0, 0, 0], [0.03, 1.43, 0], 0.11);
    for (let arm = 0; arm < arms; arm++) {
      const angle = arm * TAU / arms;
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      const middle = [dx * 0.31, 0.67 + rng() * 0.39, dz * 0.3];
      const crown = [dx * (0.45 + rng() * 0.33), 1.17 + rng() * 0.65, dz * 0.69];
      rod(root, stem, [0, 0.23 + rng() * 0.35, 0], middle, 0.078);
      rod(root, stem, middle, crown, 0.052);
      part(root, orb, tip, crown, [0.071, 0.105, 0.071]);
      const spur = [middle[0] - dz * 0.31, middle[1] + 0.37, middle[2] + dx * 0.3];
      rod(root, stem, middle, spur, 0.04);
      part(root, orb, tip, spur, [0.057, 0.075, 0.057]);
    }
  } else {
    for (let tube = 0; tube < 6; tube++) {
      const angle = tube * TAU / 6;
      const x = Math.cos(angle) * (0.25 + rng() * 0.18);
      const z = Math.sin(angle) * (0.25 + rng() * 0.18);
      const height = 0.43 + rng() * 0.91;
      const width = 0.13 + rng() * 0.1;
      cylinder(root, stem, width, height, [x, height / 2, z]).rotation.z = x * -0.2;
      const mouth = part(root, rimGeometry, tip, [x + x * height * 0.1, height, z], [width, width, width * 2.3]);
      mouth.rotation.x = -Math.PI / 2;
    }
  }
}

function kelpPatch(scene, position, random, updates) {
  const blades = 7;
  const rows = 17;
  const positions = new Float32Array(blades * rows * 6);
  const indices = [];
  const strands = [];
  const colors = [];
  for (let blade = 0; blade < blades; blade++) {
    const base = blade * rows * 2;
    const angle = blade * 2.399;
    const phase = random() * TAU;
    strands.push({ angle, phase, height: 3.1 + random() * 3.4, width: 0.19 + random() * 0.18 });
    for (let row = 0; row < rows; row++) {
      const t = row / (rows - 1);
      const color = new THREE.Color('#215e50').lerp(new THREE.Color('#82b16b'), t * (0.73 + 0.19 * Math.sin(phase)));
      for (let edge = 0; edge < 2; edge++) colors.push(color.r, color.g, color.b);
      if (row < rows - 1) {
        const i = base + row * 2;
        indices.push(i, i + 2, i + 1, i + 2, i + 3, i + 1);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  const vertices = new THREE.BufferAttribute(positions, 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', vertices);
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.88, emissive: '#205a46', emissiveIntensity: 0.18
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, 3.25, 0), 4.5);
  scene.add(mesh);
  const bounds = new THREE.Sphere(mesh.position.clone().add(mesh.geometry.boundingSphere.center), 4.5);
  updates.push((time, frustum) => {
    if (!frustum.intersectsSphere(bounds)) return;
    for (const [blade, { angle, phase, height, width }] of strands.entries()) {
      const dx = Math.cos(angle);
      const dz = Math.sin(angle);
      for (let row = 0; row < rows; row++) {
        const t = row / (rows - 1);
        // The t² envelope keeps the root still. The travelling term sin(ωt_time − kt + φ) bends each kelp vertex.
        const sway = t * t * (0.82 * Math.sin(time * 1.27 - t * 4.1 + phase) + 0.34 * Math.cos(time * 0.83 + phase));
        const spread = 0.16 + t * 1.08 + sway;
        const edge = width * Math.max(0.035, Math.sin(t * Math.PI) ** 0.74) * (0.84 + 0.16 * Math.sin(t * 38));
        const index = (blade * rows + row) * 2;
        const x = dx * spread;
        const z = dz * spread + 0.37 * sway;
        vertices.setXYZ(index, x - dz * edge, t * height, z + dx * edge);
        vertices.setXYZ(index + 1, x + dz * edge, t * height, z - dx * edge);
      }
    }
    vertices.needsUpdate = true;
    geometry.computeVertexNormals();
  });
}

function buildReef(scene, random, updates) {
  const reef = groupAt(scene, 'Sunlit coral shelves', [0, 0, 0]);
  const shelves = [
    [-10.3, -15.4, 0.25, 5.5], [9.2, -15.4, -3.7, 5.5], [-9, -20.9, -13.8, 7.2],
    [13.6, -21.9, -20.7, 7], [-2.5, -25.3, -25.9, 5.2],
    [-25.8, -25.7, -24, 9.5], [25.7, -25.8, -27.1, 8.6], [-22.8, -25.8, 8.3, 7]
  ];
  for (const [index, [x, y, z, radius]] of shelves.entries()) {
    outcrop(reef, [x, y - 3.25, z], [radius, 5.3, radius * 0.76], index, random);
    outcrop(reef, [x + radius * 0.21, y - 7.1, z - 1], [radius * 0.79, 5.7, radius * 0.69], index + 2, random);
    for (let c = 0; c < 15; c++) {
      const angle = c * 2.399;
      const r = Math.sqrt(random()) * radius * 0.7;
      const px = x + r * Math.cos(angle);
      const pz = z + r * 0.73 * Math.sin(angle);
      const py = y + (1 - r / radius) * 1.16;
      outcrop(reef, [px, py - 0.54, pz], [1 + random() * 0.56, 0.72, 0.91], c + index, random);
      coral(reef, [px, py, pz], 0.54 + random() * 0.94, c + index, random, c % 3 !== 0);
    }
    kelpPatch(scene, [x - radius * 0.31, y + 0.31, z], random, updates);
    kelpPatch(scene, [x + radius * 0.22, y + 0.62, z - radius * 0.31], random, updates);
    rockColumn(reef, x, y - 12, z, radius, index, seededRandom(440 + index * 339));
  }
  batchStaticMeshes(reef);
}

function finGeometry(outline) {
  const shape = new THREE.Shape();
  shape.moveTo(...outline[0]);
  for (const point of outline.slice(1)) shape.lineTo(...point);
  shape.closePath();
  return new THREE.ShapeGeometry(shape);
}

const tailShape = finGeometry([[0.07, 0], [-0.46, 0.39], [-0.36, 0.025], [-0.47, -0.35]]);
const topFin = finGeometry([[-0.42, 0.19], [-0.34, 0.57], [0.16, 0.25], [0.26, 0.08]]);
const sideFin = finGeometry([[0.14, 0.05], [-0.27, -0.23], [-0.22, 0.11]]);

function fishSkin() {
  const geometry = orb.clone();
  const position = geometry.attributes.position;
  const colors = [];
  for (let index = 0; index < position.count; index++) {
    const x = position.getX(index);
    const y = position.getY(index);
    const band = Math.exp(-Math.pow((x + 0.24 + y * 0.13) * 7.8, 2));
    const bright = 0.86 + 0.14 * (y + 1) / 2;
    colors.push(bright - 0.49 * band, bright - 0.43 * band, bright - 0.32 * band);
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  return geometry;
}
const fishGeometry = fishSkin();

function fishSchool(scene, center, count, radius, palette, medium, random, updates) {
  const school = groupAt(scene, medium ? 'Midwater school' : 'Tropical school', center);
  const materials = palette.map((color) => ({
    body: new THREE.MeshStandardMaterial({ color, vertexColors: true, metalness: 0.18, roughness: 0.47,
      emissive: color, emissiveIntensity: medium ? 0.15 : 0.25 }),
    fin: new THREE.MeshStandardMaterial({ color, side: THREE.DoubleSide, roughness: 0.61,
      emissive: color, emissiveIntensity: 0.18 })
  }));
  const phaseBase = random() * TAU;
  const speed = medium ? 0.39 : 0.61;
  const schoolBounds = new THREE.Sphere(school.position, radius * 1.32 + 3);
  const rig = [];
  const batches = new Map();
  const instance = new THREE.Matrix4();
  const partMatrix = new THREE.Matrix4();
  const pose = new THREE.Object3D();
  const tail = new THREE.Object3D();
  tail.position.x = -0.65;

  function addPart(geometry, material, index, position, scale = [1, 1, 1], yaw = 0, articulated = false) {
    const key = `${geometry.id}/${material.id}`;
    if (!batches.has(key)) batches.set(key, { geometry, material, parts: [] });
    const piece = new THREE.Object3D();
    piece.position.fromArray(position);
    piece.scale.fromArray(scale);
    piece.rotation.y = yaw;
    piece.updateMatrix();
    batches.get(key).parts.push({ index, matrix: piece.matrix, articulated });
  }
  for (let index = 0; index < count; index++) {
    const size = (medium ? 0.99 : 0.52) * (0.76 + random() * 0.47);
    const skin = materials[index % materials.length];
    addPart(fishGeometry, skin.body, index, [0, 0, 0], [0.71, medium ? 0.32 : 0.39, 0.23]);
    addPart(topFin, skin.fin, index, [0, 0, 0]);
    for (const side of [-1, 1]) {
      addPart(sideFin, skin.fin, index, [0.11, -0.08, side * 0.17], [1, 1, 1], -side * 0.6);
      addPart(orb, whiteEye, index, [0.46, 0.08, side * 0.177], [0.077, 0.077, 0.032]);
      addPart(orb, creatureEye, index, [0.48, 0.082, side * 0.199], [0.046, 0.048, 0.018]);
    }
    addPart(tailShape, skin.fin, index, [0, 0, 0], [1, 1, 1], 0, true);
    const r = radius + (random() - 0.5) * radius * 0.64;
    const phi = phaseBase + (index / count - 0.5) * 1.07 + (random() - 0.5) * 0.21;
    const offsetY = (random() - 0.5) * (medium ? 3.8 : 2.5);
    rig.push({ size, r, phi, offsetY, body: new THREE.Matrix4(), tail: new THREE.Matrix4() });
  }
  for (const batch of batches.values()) {
    const { geometry, material, parts } = batch;
    batch.mesh = new THREE.InstancedMesh(geometry, material, parts.length);
    batch.mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    // Fixed conservative bounds cover the entire orbit while individual poses move.
    batch.mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), schoolBounds.radius);
    school.add(batch.mesh);
  }
  updates.push((time, frustum) => {
    school.visible = frustum.intersectsSphere(schoolBounds);
    if (!school.visible) return;
    for (let index = 0; index < rig.length; index++) {
      const { size, r, phi, offsetY, body, tail: tailPose } = rig[index];
      const angle = speed * time + phi;
      const sin = Math.sin(angle);
      const cos = Math.cos(angle);
      // With the school as (x₀,z₀), x(t)=x₀+R cos(ωt+φ), z(t)=z₀+R sin(ωt+φ).
      pose.position.set(r * cos, offsetY + Math.sin(angle * 2 + index * 0.47) * 0.45, r * sin);
      // The local +X nose follows the orbit tangent (-sin θ, cos θ). The tail uses θ_y=A sin(kt+φ).
      pose.rotation.y = Math.atan2(-cos, -sin);
      pose.scale.setScalar(size);
      pose.updateMatrix();
      body.copy(pose.matrix);
      tail.rotation.y = 0.52 * Math.sin(time * (medium ? 9.4 : 13.7) + phi);
      tail.updateMatrix();
      tailPose.multiplyMatrices(body, tail.matrix);
    }
    for (const { mesh, parts } of batches.values()) {
      for (const [index, piece] of parts.entries()) {
        partMatrix.copy(piece.articulated ? rig[piece.index].tail : rig[piece.index].body);
        mesh.setMatrixAt(index, instance.multiplyMatrices(partMatrix, piece.matrix));
      }
      mesh.instanceMatrix.needsUpdate = true;
    }
  });
}

function turtle(scene, center, radius, phase, updates) {
  const turtle = groupAt(scene, 'Sea turtle', center);
  const skin = matte('#77a899', '#2b7266', 0.23);
  const shell = matte('#547860', '#2f705e', 0.1);
  const plates = [matte('#9a9265'), matte('#798966'), matte('#657e5c')];
  part(turtle, orb, skin, [0, -0.05, 0], [1.47, 0.43, 0.91]);
  part(turtle, orb, shell, [-0.13, 0.18, 0], [1.34, 0.55, 0.89]);
  for (let index = 0; index < 7; index++) {
    const angle = index * TAU / 7;
    part(turtle, rock, plates[index % plates.length],
      [-0.13 + Math.cos(angle) * 0.81, 0.5, Math.sin(angle) * 0.49], [0.27, 0.12, 0.23]).rotation.y = angle;
  }
  part(turtle, rock, plates[0], [-0.14, 0.62, 0], [0.43, 0.13, 0.33]);
  part(turtle, orb, skin, [1.35, 0.06, 0], [0.44, 0.25, 0.29]);
  part(turtle, orb, skin, [1.73, 0.11, 0], [0.33, 0.23, 0.25]);
  const fins = [];
  for (const side of [-1, 1]) {
    part(turtle, orb, creatureEye, [1.83, 0.193, side * 0.191], [0.064, 0.065, 0.043]);
    const pivot = groupAt(turtle, 'Fore flipper pivot', [0.56, -0.16, side * 0.67]);
    part(pivot, orb, skin, [-0.29, 0, side * 0.66], [0.38, 0.116, 0.86]).rotation.y = -side * 0.43;
    part(turtle, orb, skin, [-1.05, -0.18, side * 0.73], [0.49, 0.113, 0.44]).rotation.y = side * 0.57;
    fins.push([side, pivot]);
  }
  updates.push((time) => {
    const theta = time * 0.23 + phase;
    turtle.position.set(center[0] + radius * Math.cos(theta), center[1] + 0.7 * Math.sin(theta * 2), center[2] + radius * Math.sin(theta));
    turtle.rotation.y = Math.atan2(-Math.cos(theta), -Math.sin(theta));
    turtle.rotation.z = 0.08 * Math.cos(theta * 2);
    for (const [side, pivot] of fins) pivot.rotation.x = side * Math.sin(time * 3.8 + phase) * 0.61;
  });
}

function buildMidwater(scene, random, updates) {
  const cliffs = groupAt(scene, 'Midwater basalt stacks', [0, 0, 0]);
  const stacks = [[-20, -50, -18, 8], [19, -47, -21, 7.3], [29, -62, 4, 9], [-25, -62, 7, 9.5], [-10, -67, -32, 8.1]];
  for (const [index, [x, y, z, size]] of stacks.entries()) {
    rockColumn(cliffs, x, y, z, size, index + 3, seededRandom(391 + index * 173));
  }
  batchStaticMeshes(cliffs);
  const silvers = ['#78b7bb', '#7cc6d1', '#a0b8c3'];
  fishSchool(scene, [1, -35, -10], 11, 7.4, silvers, true, random, updates);
  fishSchool(scene, [-7, -50, -12], 13, 8.3, silvers, true, random, updates);
  fishSchool(scene, [9, -64, -15], 10, 7.6, silvers, true, random, updates);
  turtle(scene, [-2.3, -39.2, -7.5], 6.2, 1.08, updates);
  turtle(scene, [2.4, -54.3, -11], 8.3, 2.35, updates);
  turtle(scene, [-10.4, -65.1, -13.8], 7.3, 0.58, updates);
}

function jellyfish(scene, center, scale, color, phase, hasLight, updates) {
  const root = groupAt(scene, 'Bioluminescent jellyfish', center, phase);
  root.scale.setScalar(scale);
  const lit = new THREE.Color(color);
  const mantle = new THREE.MeshStandardMaterial({
    color: lit, emissive: lit, emissiveIntensity: 0.9, transparent: true, opacity: 0.49,
    depthWrite: false, side: THREE.DoubleSide, roughness: 0.3
  });
  const bell = part(root, bellGeometry, mantle, [0, 0.08, 0], [1, 0.66, 1]);
  const rim = part(root, rimGeometry, new THREE.MeshBasicMaterial({ color: lit, toneMapped: false }),
    [0, -0.16, 0], [0.93, 0.93, 1]);
  rim.rotation.x = -Math.PI / 2;
  part(root, orb, matte(color, color, 0.8), [0, -0.12, 0], [0.34, 0.18, 0.34]);
  const halo = glowSprite(lit, 4.6, 0.33);
  halo.position.y = -0.07;
  root.add(halo);
  const segments = 15;
  const tendrils = 11;
  const geometry = new THREE.BufferGeometry();
  const lines = new THREE.BufferAttribute(new Float32Array(tendrils * segments * 6), 3).setUsage(THREE.DynamicDrawUsage);
  geometry.setAttribute('position', lines);
  const threads = new THREE.LineSegments(geometry, new THREE.LineBasicMaterial({
    color: lit, opacity: 0.55, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  geometry.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, -1.15, 0), 2.5);
  root.add(threads);
  const light = hasLight ? new THREE.PointLight(color, 12, 11, 2) : null;
  if (light) root.add(light);

  const bounds = new THREE.Sphere(new THREE.Vector3().fromArray(center), scale * 4 + 1.6);
  updates.push((time, frustum) => {
    const visible = frustum.intersectsSphere(bounds);
    bell.visible = rim.visible = halo.visible = threads.visible = visible;
    if (!visible && !light) return;
    const pulse = 0.5 + 0.5 * Math.sin(time * 2.65 + phase);
    const width = 0.92 + pulse * 0.12;
    root.position.set(center[0] + Math.sin(time * 0.31 + phase) * 1.08,
      center[1] + Math.sin(time * 0.68 + phase) * 0.52, center[2] + Math.cos(time * 0.27 + phase) * 0.95);
    if (light) light.intensity = 11 + pulse * 13;
    if (!visible) return;
    bell.scale.set(width, 0.76 - 0.18 * pulse, width);
    rim.scale.set(width * 0.93, width * 0.93, 1);
    mantle.emissiveIntensity = 0.6 + pulse * 0.76;
    halo.material.opacity = 0.21 + 0.16 * pulse;
    for (let tendril = 0; tendril < tendrils; tendril++) {
      const angle = tendril * TAU / tendrils;
      const x = Math.cos(angle);
      const z = Math.sin(angle);
      const length = 1.55 + (tendril % 4) * 0.28;
      for (let segment = 0; segment < segments; segment++) {
        for (let end = 0; end < 2; end++) {
          const t = (segment + end) / segments;
          const curl = Math.sin(t * 8 - time * 2.5 + phase + tendril * 0.68) * t * 0.38;
          const r = width * 0.86 - t * 0.41 + curl;
          lines.setXYZ((tendril * segments + segment) * 2 + end, x * r - z * curl * 0.32, -0.22 - length * t, z * r);
        }
      }
    }
    lines.needsUpdate = true;
  });
}

function anglerfish(scene, center, phase, updates) {
  const body = groupAt(scene, 'Abyssal anglerfish', center);
  const skin = matte('#394661', '#242a55', 0.38);
  const fin = new THREE.MeshStandardMaterial({ color: '#564771', side: THREE.DoubleSide, emissive: '#2b1d52', emissiveIntensity: 0.32 });
  const teeth = matte('#e4e5cf', '#8a91a1', 0.21);
  const lureColor = '#aef7c8';
  part(body, orb, skin, [0, 0, 0], [1.12, 0.71, 0.63]);
  part(body, orb, skin, [0.72, -0.41, 0], [0.68, 0.23, 0.5]);
  part(body, orb, creatureEye, [0.95, -0.16, 0], [0.3, 0.23, 0.49]);
  for (const side of [-1, 1]) {
    part(body, orb, whiteEye, [0.63, 0.13, side * 0.516], [0.11, 0.09, 0.045]);
    for (let index = 0; index < 4; index++) {
      part(body, orb, teeth, [0.78 + index * 0.09, -0.23, side * (0.43 - index * 0.029)],
        [0.029, 0.113 - index * 0.014, 0.026]).rotation.z = 0.21;
    }
  }
  const tail = groupAt(body, 'Angler tail pivot', [-1.03, 0, 0]);
  part(tail, tailShape, fin, [0, 0, 0], [1.4, 1.3, 1]);
  const stalk = groupAt(body, 'Glowing lure pivot', [0.22, 0.48, 0]);
  rod(stalk, skin, [0, 0, 0], [0.33, 0.75, 0], 0.044);
  rod(stalk, skin, [0.33, 0.75, 0], [0.82, 0.62, 0], 0.039);
  part(stalk, orb, matte(lureColor, lureColor, 2.45), [0.83, 0.6, 0], [0.107, 0.105, 0.109]);
  const halo = glowSprite(lureColor, 1.65, 0.65);
  const lamp = new THREE.PointLight(lureColor, 12, 9, 2);
  halo.position.set(0.83, 0.6, 0);
  lamp.position.copy(halo.position);
  stalk.add(halo, lamp);
  updates.push((time) => {
    const theta = time * 0.32 + phase;
    body.position.set(center[0] + Math.cos(theta) * 5.2, center[1] + 0.9 * Math.sin(theta * 2), center[2] + Math.sin(theta) * 5.2);
    body.rotation.y = Math.atan2(-Math.cos(theta), -Math.sin(theta));
    tail.rotation.y = Math.sin(time * 6.4 + phase) * 0.47;
    stalk.rotation.z = 0.15 * Math.sin(time * 2.4 + phase);
    lamp.intensity = 12 + 5 * Math.sin(time * 2.8 + phase);
  });
}

function buildAbyss(scene, random, updates) {
  const floorGeometry = new THREE.PlaneGeometry(142, 142, 36, 36);
  const vertices = floorGeometry.attributes.position;
  const sand = [];
  const low = new THREE.Color('#232c49');
  const high = new THREE.Color('#495067');
  for (let index = 0; index < vertices.count; index++) {
    const x = vertices.getX(index);
    const z = vertices.getY(index);
    const elevation = Math.sin(x * 0.19) * Math.cos(z * 0.24) + 0.34 * Math.sin((x + z) * 0.53);
    vertices.setZ(index, elevation * 0.49);
    const color = low.clone().lerp(high, 0.48 + elevation * 0.32);
    sand.push(color.r, color.g, color.b);
  }
  floorGeometry.setAttribute('color', new THREE.Float32BufferAttribute(sand, 3));
  floorGeometry.computeVertexNormals();
  const bottom = new THREE.Mesh(floorGeometry, new THREE.MeshStandardMaterial({
    vertexColors: true, roughness: 0.93, emissive: '#202a4b', emissiveIntensity: 0.18
  }));
  bottom.position.y = seafloorY;
  bottom.rotation.x = -Math.PI / 2;
  scene.add(bottom);
  const vents = groupAt(scene, 'Abyssal seafloor and luminous vents', [0, 0, 0]);
  const ventColors = [matte('#61aad5', '#398fb9', 1.02), matte('#9a75d8', '#7b53d2', 1.15)];
  for (let i = 0; i < 44; i++) {
    const x = (random() - 0.5) * 65;
    const z = (random() - 0.7) * 62;
    const height = 0.55 + random() * 3.8;
    outcrop(vents, [x, -121 + height * 0.28, z], [0.6 + random() * 2.1, height, 0.5 + random() * 1.9], i, random);
    for (let bloom = 0; bloom < 3; bloom++) {
      const base = [x + (random() - 0.5) * 1.3, -120.8, z + (random() - 0.5) * 1.6];
      const end = [base[0] + 0.19, base[1] + height * (0.78 + random()), base[2]];
      rod(vents, ventColors[i % 2], base, end, 0.052 + random() * 0.075);
      part(vents, orb, ventColors[i % 2], end, [0.17, 0.084, 0.17]);
    }
  }
  batchStaticMeshes(vents);
  const glowColors = ['#62dff2', '#ae8fff', '#7b9fff', '#65efd2'];
  for (let index = 0; index < 22; index++) {
    const y = -73 - index * 1.99;
    const angle = index * 2.399;
    const radius = 5.4 + random() * 14.8;
    const center = [Math.cos(angle) * radius, y, -9.1 + Math.sin(angle) * radius * 0.8];
    jellyfish(scene, center, 0.77 + random() * 0.66, glowColors[index % 4], random() * TAU, index % 5 === 0, updates);
  }
  anglerfish(scene, [-2.2, -87.1, -10.2], 1.67, updates);
  anglerfish(scene, [5.1, -103.2, -13.3], 2.09, updates);
  anglerfish(scene, [-3.8, -114.1, -10.1], 3.7, updates);
}

function createSurfaceLight(scene) {
  const time = { value: 0 };
  const surface = new THREE.Mesh(new THREE.PlaneGeometry(148, 148), new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `
      varying vec2 vUV;
      varying float vDepth;
      void main() {
        vUV = position.xy;
        vec4 eye = modelViewMatrix * vec4(position,1.0);
        vDepth = -eye.z;
        gl_Position = projectionMatrix * eye;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec2 vUV;
      varying float vDepth;
      void main() {
        vec2 p = vUV*.86;
        float a = sin(p.x*1.8 + sin(p.y*.87+uTime)*1.5+uTime*.76);
        float b = cos(p.y*2.4 + cos(p.x*.92-uTime)*1.3-uTime*.87);
        float caustic = pow(1.0-abs(a*.64 + b*.36), 11.0);
        float alpha = (0.29 + caustic*.44) * (1.0-smoothstep(26.0,68.0,vDepth));
        gl_FragColor = vec4(mix(vec3(.036,.37,.47),vec3(.52,.92,.86), caustic),alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  }));
  surface.position.y = 0.075;
  surface.rotation.x = -Math.PI / 2;
  scene.add(surface);

  const beams = groupAt(scene, 'Sun shafts', [0, 0, 0]);
  const beamGeometry = new THREE.CylinderGeometry(0.17, 3.25, 26, 22, 1, true);
  const beamMaterial = new THREE.ShaderMaterial({
    uniforms: { uTime: time },
    vertexShader: `
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vHeight;
      void main() {
        vHeight = uv.y;
        vNormal = normalize(normalMatrix*normal);
        vec4 eye = modelViewMatrix*vec4(position,1.);
        vView = -eye.xyz;
        gl_Position = projectionMatrix*eye;
      }`,
    fragmentShader: `
      uniform float uTime;
      varying vec3 vNormal;
      varying vec3 vView;
      varying float vHeight;
      void main() {
        float edge = pow(abs(dot(normalize(vNormal),normalize(vView))),.65);
        float fade = smoothstep(.02,.53,vHeight)*(1.0-smoothstep(.94,1.,vHeight));
        gl_FragColor=vec4(.45,.88,.78, edge*fade*(.043+.015*sin(uTime*.55+vHeight*11.)));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending
  });
  for (const [x, z, size] of [[-7, -13, 1.22], [-2.2, -18, 0.62], [4.3, -25, 0.87], [12.4, -16, 1.13],
    [18.8, -32.3, 1.42], [-19.7, -21.5, 1.23], [-12.5, 3.3, 0.81], [4.1, 1.2, 0.53]]) {
    const shaft = part(beams, beamGeometry, beamMaterial, [x, -12.95, z], [size, 1, size]);
    shaft.rotation.z = -0.18;
    shaft.rotation.x = 0.13;
  }
  return (elapsed) => { time.value = elapsed; };
}

function suspendedParticles(scene, random) {
  const positions = new Float32Array(1700 * 3);
  for (let i = 0; i < positions.length; i += 3) {
    positions[i] = (random() - 0.5) * 120;
    positions[i + 1] = -random() * 121;
    positions[i + 2] = (random() - 0.5) * 120;
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  const field = new THREE.Points(geometry, new THREE.PointsMaterial({
    color: '#a3ddd8', size: 0.092, opacity: 0.46, transparent: true, depthWrite: false
  }));
  scene.add(field);
  return (time) => {
    field.rotation.y = time * 0.0058;
    field.position.y = 0.41 * Math.sin(time * 0.19);
  };
}

function oceanAtmosphere(scene) {
  const profiles = [
    [0, '#57bcc4', 0.014, 2.12, 1.67],
    [25, '#317d9e', 0.021, 1.27, 1.29],
    [70, '#172f56', 0.031, 0.24, 0.73],
    [120, '#090f24', 0.042, 0.025, 0.44]
  ].map(([depth, color, fog, sun, fill]) => ({ depth, color: new THREE.Color(color), fog, sun, fill }));
  scene.background = profiles[0].color.clone();
  scene.fog = new THREE.FogExp2(profiles[0].color, profiles[0].fog);
  const sun = new THREE.DirectionalLight('#c0f9f0', 2.12);
  const fill = new THREE.HemisphereLight('#b6efe9', '#414170', 1.67);
  const upperColor = new THREE.Color('#b6efe9');
  const lowerColor = new THREE.Color('#667cc5');
  sun.position.set(-11, 19, 7);
  scene.add(sun, fill);
  return (depth) => {
    const index = depth < 25 ? 0 : depth < 70 ? 1 : 2;
    const from = profiles[index];
    const to = profiles[index + 1];
    const mix = (depth - from.depth) / (to.depth - from.depth);
    const lerp = THREE.MathUtils.lerp;
    scene.background.copy(from.color).lerp(to.color, mix);
    scene.fog.color.copy(scene.background);
    scene.fog.density = lerp(from.fog, to.fog, mix);
    sun.intensity = lerp(from.sun, to.sun, mix);
    fill.intensity = lerp(from.fill, to.fill, mix);
    fill.color.copy(upperColor).lerp(lowerColor, depth / maxDepth);
  };
}

export function startUnderwater() {
  const runtime = createRuntime({ fov: 64, far: 155, resumeLabel: 'Resume descent' });
  const { scene, camera } = runtime;
  function placeAtReef() {
    camera.position.set(0, -3.8, 12);
    camera.lookAt(0, -10.4, -12);
  }
  placeAtReef();
  const random = seededRandom(72841);
  const animations = [];
  const atmosphere = oceanAtmosphere(scene);
  animations.push(createSurfaceLight(scene), suspendedParticles(scene, random));
  buildReef(scene, random, animations);
  fishSchool(scene, [-2.5, -9.1, -9.5], 14, 4.7, ['#ffc56f', '#f49b53', '#f9d586'], false, random, animations);
  fishSchool(scene, [6.7, -16.2, -13.3], 13, 5.8, ['#8de3e6', '#6faadb', '#f9977c'], false, random, animations);
  fishSchool(scene, [-11.4, -23, -19.6], 14, 6.7, ['#f2b768', '#9c9de0', '#f88a7d'], false, random, animations);
  buildMidwater(scene, random, animations);
  buildAbyss(scene, random, animations);
  const portal = createPortal(scene, { name: 'Return Portal Ring', position: [8, -2, -3.3] });
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const swim = new THREE.Vector3();
  const frustum = new THREE.Frustum();
  const projectionView = new THREE.Matrix4();
  const depthValue = document.getElementById('depth-value');
  const meter = document.getElementById('depth-scale');
  const marker = document.getElementById('depth-marker');
  let lastLayer = -1;
  let nextHud = 0;

  function returnToPool() {
    runtime.travel(() => { window.location.href = 'index.html?arrival=pool'; });
  }
  addEventListener('pageshow', (event) => {
    if (event.persisted && camera.position.distanceTo(portal.position) <= 2.2) placeAtReef();
  });
  document.getElementById('campus-link').addEventListener('click', (event) => {
    if (event.ctrlKey || event.metaKey || event.shiftKey || event.altKey) return;
    event.preventDefault();
    returnToPool();
  });
  runtime.ready();
  runtime.loop((dt, time) => {
    if (runtime.active && !runtime.leaving) {
      const [x, z] = movementAxes(runtime);
      const y = Number(runtime.down('Space')) - Number(runtime.down('ShiftLeft', 'ShiftRight', 'KeyC'));
      runtime.controls.getDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.set(-forward.z, 0, forward.x);
      swim.copy(forward).multiplyScalar(z).addScaledVector(right, x);
      if (swim.lengthSq() > 1) swim.normalize();
      camera.position.addScaledVector(swim, 6.5 * dt);
      camera.position.y = THREE.MathUtils.clamp(camera.position.y + y * 8.8 * dt, -maxDepth, 0);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, -limit, limit);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, -limit, limit);
      if (camera.position.distanceTo(portal.position) <= 2.2) returnToPool();
    }
    const depth = Math.max(0, -camera.position.y);
    atmosphere(depth);
    cameraFrustum(camera, frustum, projectionView);
    for (const animate of animations) animate(time, frustum);
    portal.update(time);
    if (time >= nextHud) {
      updateCoordinates(camera.position);
      depthValue.value = depth.toFixed(1);
      meter.setAttribute('aria-valuenow', depth.toFixed(1));
      marker.style.setProperty('--depth', `${depth / maxDepth * 100}%`);
      const layer = depth < 30 ? 0 : depth < 70 ? 1 : 2;
      if (layer !== lastLayer) {
        setLocation(`LAYER 0${layer + 1}`, layers[layer]);
        lastLayer = layer;
      }
      nextHud = time + 0.095;
    }
  });
}

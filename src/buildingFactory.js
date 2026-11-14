import * as THREE from 'three';
import { createLayoutRegistry } from './campusLayout.js';
import { batchStaticMeshes, box, canvasTexture, cylinder, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

const radians = THREE.MathUtils.degToRad;
const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
const blossomGeometry = new THREE.SphereGeometry(1, 7, 5);
const potGeometry = new THREE.CylinderGeometry(1, 0.71, 1, 11);
const palmGeometry = makePalmFrond();
const signMaterials = new Map();
const facadeClearance = 0.15;
export const maxBuildingFloors = 24;
export const maxBuildingSpan = 150;
const addedDoorWidth = 1.42;
const addedDoorSpan = addedDoorWidth + 0.34;

export function standard(color, settings = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.86, ...settings });
}

function patternTexture(type) {
  const rng = seededRandom(type.length * 3257);
  const texture = canvasTexture(256, 256, (context, width, height) => {
    const image = context.createImageData(width, height);
    for (let row = 0; row < height; row++) {
      for (let col = 0; col < width; col++) {
        const index = (row * width + col) * 4;
        const speckle = 213 + 39 * rng() + 8 * Math.sin(col * 0.17) * Math.cos(row * 0.12);
        image.data[index] = image.data[index + 1] = image.data[index + 2] = speckle;
        image.data[index + 3] = 255;
      }
    }
    context.putImageData(image, 0, 0);
    if (type === 'paving' || type === 'tile' || type === 'brick') {
      const brick = type === 'brick';
      const rows = brick ? 8 : 4;
      const cols = brick ? 4 : 4;
      const dy = height / rows;
      const dx = width / cols;
      for (let row = 0; row < rows; row++) {
        for (let col = -1; col < cols; col++) {
          const x = col * dx + (brick && row % 2 ? dx / 2 : 0);
          const y = row * dy;
          context.fillStyle = `rgba(${rng() > 0.48 ? '20,15,9' : '255,255,255'},${0.03 + rng() * 0.15})`;
          context.fillRect(x, y, dx, dy);
          context.strokeStyle = brick ? '#d8cabb' : '#514c4663';
          context.lineWidth = brick ? 2 : 1.25;
          context.strokeRect(x, y, dx, dy);
          context.fillStyle = '#ffffff41';
          context.fillRect(x + 1, y + 1, dx - 2, 1);
        }
      }
    }
    if (type === 'lattice') {
      context.fillStyle = '#4c342a';
      for (let row = -1; row < 14; row++) {
        for (let col = -1; col < 15; col++) {
          const x = col * 18 + (row % 2 ? 9 : 0);
          const y = row * 19;
          context.beginPath();
          context.ellipse(x, y, 5.6, 6.6, -0.2, 0, Math.PI * 2);
          context.fill();
        }
      }
    }
  });
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export function floor(parent, material, x, z, width, depth, y = 0, tileSize = 4) {
  const geometry = unitPlane.clone();
  const uv = geometry.attributes.uv;
  for (let index = 0; index < uv.count; index++) {
    uv.setXY(index, ((uv.getX(index) - 0.5) * width + x) / tileSize,
      ((uv.getY(index) - 0.5) * depth - z) / tileSize);
  }
  const mesh = part(parent, geometry, material, [x, y, z], [width, depth, 1]);
  mesh.rotation.x = -Math.PI / 2;
  mesh.castShadow = false;
  mesh.userData.grade = true;
  return mesh;
}

export function sign(parent, { title, subtitle = '', position, width, height, yaw = 0,
  background = '#173555', ink = '#f4e8c8', seal = false, serif = false }) {
  const pixels = 1024;
  const key = JSON.stringify([title, subtitle, width, height, background, ink, seal, serif]);
  let material = signMaterials.get(key);
  if (!material) {
    const map = canvasTexture(pixels, Math.max(88, Math.round(pixels * height / width)), (context, w, h) => {
      context.fillStyle = background;
      context.fillRect(0, 0, w, h);
      context.strokeStyle = ink;
      context.globalAlpha = 0.62;
      context.lineWidth = Math.max(2, h * 0.018);
      const inset = h * 0.083;
      context.strokeRect(inset, inset, w - inset * 2, h - inset * 2);
      context.globalAlpha = 1;
      context.fillStyle = ink;
      context.textBaseline = 'middle';
      let left = h * 0.21;
      if (seal) {
        const center = h * 0.54;
        context.lineWidth = h * 0.016;
        for (const radius of [h * 0.31, h * 0.25]) {
          context.beginPath();
          context.arc(center, h * 0.5, radius, 0, Math.PI * 2);
          context.stroke();
        }
        context.font = `bold ${h * 0.25}px Georgia`;
        context.textAlign = 'center';
        context.fillText('S', center, h * 0.51);
        left = h * 0.98;
      }
      context.textAlign = 'center';
      const font = serif ? 'Georgia' : 'Arial';
      const textX = (left + w - h * 0.21) / 2;
      const available = w - left - h * 0.22;
      context.font = `bold ${Math.round(h * (subtitle ? 0.39 : 0.49))}px ${font}`;
      context.fillText(title, textX, h * (subtitle ? 0.41 : 0.53), available);
      if (subtitle) {
        context.font = `600 ${Math.round(h * 0.158)}px Arial`;
        context.fillText(subtitle, textX, h * 0.75, available);
      }
    });
    material = standard(0xffffff, { map, emissive: 0x7189a3, emissiveIntensity: 0.08 });
    signMaterials.set(key, material);
  }
  const mesh = part(parent, unitPlane, material, position, [width, height, 1]);
  mesh.rotation.y = yaw;
  mesh.castShadow = false;
  return mesh;
}

function isDescendantOf(parent, child) {
  let cur = child;
  while (cur) {
    if (cur === parent) return true;
    cur = cur.parent;
  }
  return false;
}

export function addLocalCollider(colliders, group, x, z, width, depth) {
  group.updateWorldMatrix(true, false);
  const lower = new THREE.Vector3(x - width / 2, 0, z - depth / 2);
  const upper = new THREE.Vector3(x + width / 2, 0, z + depth / 2);
  const bounds = new THREE.Box3(lower, upper).applyMatrix4(group.matrixWorld);
  const record = {
    minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z,
    group, local: { x, z, width, depth }
  };
  colliders.push(record);
  return record;
}

export function updateCollidersForGroup(colliders, group) {
  group.updateWorldMatrix(true, true);
  for (const c of colliders) {
    if (c.group && c.local && (c.group === group || isDescendantOf(group, c.group))) {
      c.group.updateWorldMatrix(true, false);
      const lower = new THREE.Vector3(c.local.x - c.local.width / 2, 0, c.local.z - c.local.depth / 2);
      const upper = new THREE.Vector3(c.local.x + c.local.width / 2, 0, c.local.z + c.local.depth / 2);
      const bounds = new THREE.Box3(lower, upper).applyMatrix4(c.group.matrixWorld);
      c.minX = bounds.min.x;
      c.maxX = bounds.max.x;
      c.minZ = bounds.min.z;
      c.maxZ = bounds.max.z;
    }
  }
}

function removeColliders(colliders, group) {
  for (let index = colliders.length - 1; index >= 0; index--) {
    if (isDescendantOf(group, colliders[index].group)) colliders.splice(index, 1);
  }
}

function disposeInstances(root) {
  root.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
}

function canRemove(entry) {
  return entry && entry.id !== 'pool' && entry.id !== 'pool-portal';
}

function fitGroundFixtures(fixtures, width) {
  let left = -width / 2 + facadeClearance;
  let remaining = fixtures.reduce((total, fixture) => total + fixture.span + facadeClearance, 0);
  return fixtures.map(({ x, span, ...fixture }) => {
    remaining -= span + facadeClearance;
    const center = THREE.MathUtils.clamp(x, left + span / 2, width / 2 - remaining - span / 2 - facadeClearance);
    left = center + span / 2 + facadeClearance;
    return { ...fixture, x: center, span };
  });
}

export function wayfinding(parent, materials, { x, z, title, subtitle, yaw = 0, width = 2.35 }) {
  const root = groupAt(parent, `Direction sign · ${title}`, [x, 0, z], yaw);
  for (const side of [-1, 1]) box(root, materials.steel, [0.07, 1.76, 0.09], [side * width * 0.38, 0.88, 0]);
  box(root, materials.blue, [width, 0.57, 0.12], [0, 1.77, 0]);
  sign(root, { title, subtitle, position: [0, 1.77, 0.064], width, height: 0.57 });
  return root;
}

function makePalmFrond() {
  const points = [];
  function point(t, width = 0) {
    return [t * 3.5, Math.sin(t * Math.PI) * 0.87 - t * t * 0.85, width];
  }
  for (let index = 1; index < 15; index++) {
    const t = index / 15;
    const spread = Math.sin(t * Math.PI) * 0.62;
    for (const side of [-1, 1]) {
      const tip = point(t + 0.1, side * spread);
      tip[1] -= spread * 0.36;
      points.push(...point(t - 0.06), ...tip, ...point(t + 0.05));
    }
  }
  points.push(...point(0, -.04), ...point(0, .04), ...point(1));
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(points, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createCampusKit(map) {
  const p = map.palette;
  const colliders = [];
  const layout = createLayoutRegistry(map);
  const { add } = layout;
  const prop = (parent, kind, name, x, z, yaw = 0, options) =>
    add(`${kind}:${x}:${z}`, groupAt(parent, name, [x, 0, z], yaw), undefined, options);
  const direction = (parent, settings) =>
    add(`sign:${settings.x}:${settings.z}`, wayfinding(parent, materials, settings));
  const foliage = ['#45663b', '#66834a', '#7d9654', '#547943'].map((color) =>
    standard(color, { side: THREE.DoubleSide }));
  const windowMaterials = [];
  const windowMap = canvasTexture(128, 128, (context, w, h) => {
    const gradient = context.createLinearGradient(0, 0, w * 0.35, h);
    gradient.addColorStop(0, '#b0cbd1');
    gradient.addColorStop(0.49, '#6d96a5');
    gradient.addColorStop(0.5, '#345363');
    gradient.addColorStop(1, '#234052');
    context.fillStyle = gradient;
    context.fillRect(0, 0, w, h);
    context.fillStyle = '#ffffff24';
    context.beginPath();
    context.moveTo(w * 0.26, 0);
    context.lineTo(w * 0.41, 0);
    context.lineTo(w * 0.06, h);
    context.lineTo(0, h);
    context.closePath();
    context.fill();
  });
  const makeGlass = (color, emission) => {
    const material = standard(color, {
      map: windowMap, metalness: 0.23, roughness: 0.25, emissive: emission, emissiveIntensity: 0
    });
    windowMaterials.push(material);
    return material;
  };
  const materials = {
    blue: standard(p.campusBlue), gate: standard(p.gateBlue, { metalness: 0.36 }),
    concrete: standard(p.concrete), white: standard('#f0e4d1'), steel: standard('#30444a', { metalness: 0.46 }),
    black: standard('#273532'), wood: standard('#98674a'), bark: standard('#62503d'),
    brick: standard(p.brick, { map: patternTexture('brick') }),
    lattice: standard(p.lattice, { map: patternTexture('lattice') }),
    official: standard(p.officialPlaster), academic: standard(p.pinkPlaster),
    library: standard(p.libraryPlaster), civil: standard(p.civilPlaster), cafe: standard(p.canteenRed),
    terracotta: standard('#a5644d'), soil: standard('#6d5941'),
    grass: standard(p.gardenGreen, { map: patternTexture('grass') }),
    field: standard(p.fieldGreen, { map: patternTexture('field') }),
    paving: new THREE.MeshPhysicalMaterial({
      color: '#b8ab96', roughness: 0.94, map: patternTexture('paving'),
      clearcoat: 0.03, clearcoatRoughness: 0.34, specularIntensity: 0.4
    }),
    lane: new THREE.MeshPhysicalMaterial({
      color: '#8d897e', roughness: 0.94, map: patternTexture('lane'),
      clearcoat: 0.03, clearcoatRoughness: 0.34, specularIntensity: 0.4
    }),
    deck: new THREE.MeshPhysicalMaterial({
      color: '#cfceb1', roughness: 0.94, map: patternTexture('tile'),
      clearcoat: 0.03, clearcoatRoughness: 0.34, specularIntensity: 0.4
    }),
    tile: standard(p.poolBlue, { map: patternTexture('tile'), roughness: 0.63 }),
    glass: makeGlass('#e5eeef', '#ffd193'),
    shadeGlass: makeGlass('#a8bec8', '#d79c60'),
    unlitGlass: standard('#89aab9', { map: windowMap, roughness: 0.34, metalness: 0.22 })
  };
  const flowers = ['#ffc872', '#e77d86', '#f2a38a', '#eae3bf'].map((color) => standard(color));
  const warmCenter = standard('#c98c36');
  const themes = {
    guard: { wall: materials.white, trim: materials.blue, story: 2.9 },
    cse: { wall: materials.concrete, trim: materials.white, story: 3.06, recess: 1.28, lattice: true },
    official: { wall: materials.official, trim: materials.concrete, story: 3.3, recess: 1.14 },
    academic: { wall: materials.academic, trim: materials.white, story: 3.15, recess: 1.02 },
    civil: { wall: materials.civil, trim: materials.white, story: 3.25, recess: 0.83, bands: true },
    utility: { wall: materials.library, trim: materials.steel, story: 3.13 },
    garage: { wall: materials.civil, trim: materials.steel, story: 3.03 },
    cafe: { wall: materials.cafe, trim: materials.white, story: 3.7 },
    pool: { wall: materials.gate, trim: materials.blue, story: 2.8 }
  };

  function windowAt(parent, x, y, z, width, height, frame = materials.concrete, glazing = materials.glass, mullions = true) {
    box(parent, frame, [width + 0.14, height + 0.14, 0.095], [x, y, z + 0.01]);
    const glass = part(parent, unitPlane, glazing, [x, y, z + 0.061], [width, height, 1]);
    glass.castShadow = false;
    if (mullions) {
      box(parent, frame, [0.043, height, 0.05], [x, y, z + 0.09]);
      box(parent, frame, [width, 0.047, 0.05], [x, y - height * 0.17, z + 0.09]);
    }
    box(parent, frame, [width + 0.24, 0.08, 0.22], [x, y - height / 2 - 0.085, z + 0.055]);
  }

  function entrance(group, door, face, trim) {
    const width = door.width || 1.45;
    const height = door.height || 2.12;
    const x = door.x;
    box(group, materials.concrete, [width + 0.34, 0.16, 0.65], [x, 0.08, face + 0.24]);
    box(group, trim, [width + 0.24, height + 0.16, 0.16], [x, height / 2 + 0.09, face + 0.035]);
    box(group, door.material || materials.black, [width, height, 0.09], [x, height / 2 + 0.10, face + 0.133]);
    if (door.glass) {
      const panes = width > 2 ? [-width / 4, width / 4] : [0];
      for (const dx of panes) windowAt(group, x + dx, height * 0.58, face + 0.19,
        width / panes.length - 0.21, height * 0.67, materials.steel, materials.shadeGlass, false);
    }
    box(group, materials.white, [0.035, 0.2, 0.053], [x + width * 0.29, 1.07, face + 0.2]);
    if (door.title) {
      sign(group, {
        title: door.title, subtitle: door.subtitle, width: door.signWidth || width + 0.42, height: door.subtitle ? 0.49 : 0.34,
        position: [x, height + 0.42, face + 0.137], background: door.signColor
      });
    }
    if (door.cross) {
      const red = materials.cafe;
      box(group, red, [0.35, 0.1, 0.035], [x, height * 0.68, face + 0.25]);
      box(group, red, [0.1, 0.35, 0.035], [x, height * 0.68, face + 0.255]);
    }
  }

  function building(parent, id, style, options = {}) {
    const spec = map.buildings[id];
    const { wall, trim, story, recess = 0, lattice = false, bands = false } = themes[style];
    const root = groupAt(parent, spec.label, [spec.x, 0, spec.z], radians(spec.yaw));
    const doors = options.doors ?? [];
    const windows = options.windows ?? [];
    const fixtures = [
      ...doors.map((door) => ({ x: door.x, anchor: door.x, door, span: Math.max((door.width || 1.45) + 0.34, door.signWidth || 0) })),
      ...windows.map((window) => ({ x: window.x, anchor: window.x, window, span: window.width + (window.counter ? 0.4 : 0.24) }))
    ].sort((a, b) => a.x - b.x);
    const minWidth = Math.max(2.6, options.minWidth ?? 0,
      fixtures.reduce((total, fixture) => total + fixture.span + facadeClearance, facadeClearance));
    const minDepth = Math.max(2.6, recess + 1.1);
    const originalWidth = spec.facadeWidth ?? spec.width;
    add(id, root, spec);
    const legacyScale = root.scale.clone();
    root.scale.setScalar(1);
    const entry = layout.objects.get(id);
    const model = { story, resize, wallSurfaces: [] };
    entry.building = model;
    spec.floors = Number.isFinite(spec.floors) ? spec.floors : 1;
    delete spec.scale;
    resize(spec.width * legacyScale.x, spec.depth * legacyScale.z, spec.floors * legacyScale.y);
    return root;

    function resize(requestedWidth, requestedDepth, requestedFloors, rebuildDoors = false) {
      const extraDoors = Object.entries(map.elements ?? {}).filter(([, element]) => element.type === 'door' && element.building === id);
      const doorRoom = (side) => extraDoors.filter(([, door]) => door.wall === side).length * (addedDoorSpan + facadeClearance);
      const frontDoorRoom = fixtures.filter(({ door }) => door).reduce((total, fixture) => total + fixture.span + facadeClearance, 0);
      const width = THREE.MathUtils.clamp(requestedWidth, Math.max(minWidth,
        frontDoorRoom + doorRoom('front') + facadeClearance, doorRoom('back') + facadeClearance), maxBuildingSpan);
      const depth = THREE.MathUtils.clamp(requestedDepth, Math.max(minDepth,
        recess + Math.max(doorRoom('right'), doorRoom('left')) + facadeClearance), maxBuildingSpan);
      const floors = THREE.MathUtils.clamp(Math.round(requestedFloors), 1, maxBuildingFloors);
      const shape = [width, depth, floors].map((value) => Number(value.toFixed(4)));
      if (!rebuildDoors && model.shape?.every((value, index) => value === shape[index])) return false;
      model.shape = shape;
      if (shape[0] !== originalWidth) spec.facadeWidth = originalWidth;
      else delete spec.facadeWidth;
      [spec.width, spec.depth, spec.floors] = shape;
      disposeInstances(root);
      removeColliders(colliders, root);
      root.clear();
      model.wallSurfaces.length = 0;
      buildShell(spec.width, spec.depth, floors, extraDoors);
      batchStaticMeshes(root);
      return true;
    }

    function buildShell(width, depth, floors, extraDoors) {
      const height = story * floors;
      const facade = depth / 2;
      const face = facade - recess;
      const groundFixtures = fitGroundFixtures(fixtures.map((fixture) => ({ ...fixture, x: fixture.x * width / originalWidth })), width);
      const walls = [
        { id: 'front', span: width, angle: 0, x: 0, z: face },
        { id: 'right', span: depth - recess, angle: Math.PI / 2, x: width / 2, z: -recess / 2 },
        { id: 'back', span: width, angle: Math.PI, x: 0, z: -depth / 2 },
        { id: 'left', span: depth - recess, angle: -Math.PI / 2, x: -width / 2, z: -recess / 2 }
      ];
      const frontDoors = [];
      for (const surface of walls) {
        model.wallSurfaces.push(surface);
        const placed = extraDoors.filter(([, door]) => door.wall === surface.id);
        const fixturesOnWall = surface.id === 'front' ? groundFixtures.filter(({ door }) => door) : [];
        if (!placed.length) {
          if (surface.id === 'front') frontDoors.push(...fixturesOnWall);
          continue;
        }
        for (const [doorId, spec] of placed) {
          fixturesOnWall.push({ x: spec.offset * surface.span / 2, span: addedDoorSpan, doorId, spec });
        }
        fixturesOnWall.sort((a, b) => a.x - b.x);
        for (const fixture of fitGroundFixtures(fixturesOnWall, surface.span)) {
          if (surface.id === 'front') frontDoors.push(fixture);
          if (!fixture.doorId) continue;
          const alongX = Math.cos(surface.angle);
          const alongZ = -Math.sin(surface.angle);
          const door = groupAt(root, 'Exterior door', [surface.x + fixture.x * alongX, 0, surface.z + fixture.x * alongZ], surface.angle);
          door.userData.layoutId = fixture.doorId;
          entrance(door, { x: 0, width: addedDoorWidth, glass: true }, 0, trim);
          const doorEntry = layout.objects.get(fixture.doorId) ?? {
            id: fixture.doorId, label: fixture.spec.label, bounds: new THREE.Box3(), spec: fixture.spec, buildingId: id
          };
          doorEntry.root = door;
          doorEntry.offset = fixture.x;
          doorEntry.wallSpan = surface.span;
          layout.objects.set(fixture.doorId, doorEntry);
        }
      }
      box(root, wall, [width, story, depth - recess], [0, story / 2, -recess / 2]);
      box(root, materials.black, [width + 0.025, 0.28, depth - recess + 0.04], [0, 0.14, -recess / 2]);
      addLocalCollider(colliders, root, 0, -recess / 2, width, depth - recess);
      if (floors > 1) box(root, wall, [width, height - story, depth], [0, (height + story) / 2, 0]);
      box(root, trim, [width + 0.42, 0.22, depth + 0.4], [0, height + 0.08, 0]);
      box(root, style === 'cse' ? materials.blue : wall, [width + 0.18, 0.37, depth + 0.18], [0, height + 0.35, 0]);
      if (recess) {
        const columns = Math.ceil(width / 4);
        for (let i = 0; i <= columns; i++) {
          const px = -width / 2 + 0.25 + (width - 0.5) * i / columns;
          if (frontDoors.some((door) => Math.abs(door.x - px) < door.span / 2 + 0.35)) continue;
          box(root, trim, [0.38, story, 0.42], [px, story / 2, facade - 0.15]);
          box(root, materials.concrete, [0.55, 0.16, 0.57], [px, 0.08, facade - 0.15]);
          addLocalCollider(colliders, root, px, facade - 0.15, 0.42, 0.48);
        }
      }
      if (options.awning) {
        const canopy = box(root, trim, [width + 0.42, 0.14, 1.27], [0, story - 0.33, facade + 0.55]);
        canopy.rotation.x = 0.1;
        for (const side of [-1, 1]) rod(root, materials.steel, [side * width * 0.42, story - 0.85, facade],
          [side * width * 0.42, story - 0.37, facade + 1.04], 0.037);
      }
      for (const { x, door } of frontDoors) {
        if (door) entrance(root, { ...door, x }, face, trim);
      }
      for (const { x, window, span } of groundFixtures) {
        if (!window || frontDoors.some((fixture) => Math.abs(fixture.x - x) < (fixture.span + span) / 2)) continue;
        windowAt(root, x, window.y ?? 1.6, face, window.width, window.height ?? 1.12,
          trim, window.shade ? materials.shadeGlass : materials.glass);
        if (window.counter) box(root, materials.concrete, [window.width + 0.4, 0.11, 0.38], [x, 1.14, face + 0.16]);
      }
      if (options.title) {
        const panel = sign(root, {
          title: options.title, subtitle: options.subtitle, width: options.signWidth || Math.min(originalWidth - 0.3, 6.3),
          height: style === 'cse' ? 1.36 : 0.67, position: [0, height + (style === 'cse' ? 0.48 : -0.19), facade + 0.2],
          background: style === 'cafe' ? '#9e4136' : '#18365e', seal: style === 'cse', serif: style === 'cse'
        });
        panel.scale.x = Math.min(panel.scale.x, width - 0.1);
      }
      if (style === 'cse') box(root, materials.blue, [width + 0.33, 1.42, 0.31], [0, height + 0.49, facade + 0.018]);

      if (floors > 1) {
        for (const [sideWidth, offset, angle] of [
          [width, [0, 0, facade], 0], [depth, [width / 2, 0, 0], Math.PI / 2],
          [width, [0, 0, -facade], Math.PI], [depth, [-width / 2, 0, 0], -Math.PI / 2]
        ]) {
          const side = groupAt(root, 'Exterior elevation', offset, angle);
          const paneWidth = lattice ? 0.73 : (bands ? 2.48 : 2.16);
          const bays = Math.max(1, Math.min(Math.round(sideWidth / (bands ? 3.3 : 3.05)),
            Math.floor((sideWidth - 0.4) / (paneWidth + 0.36))));
          const pitch = (sideWidth - 0.4) / bays;
          for (let level = 1; level < floors; level++) {
            const y = story * (level + 0.5);
            box(side, trim, [sideWidth, lattice ? 0.31 : 0.15, 0.22], [0, level * story + 0.02, 0.05]);
            for (let col = 0; col < bays; col++) {
              const px = pitch * (col - (bays - 1) / 2);
              if (lattice) {
                box(side, materials.lattice, [pitch - 0.16, story - 0.28, 0.075], [px, y, 0.025]);
                box(side, trim, [0.23, story + 0.03, 0.23], [px - pitch / 2, y, 0.08]);
              }
              if (bands && col === Math.floor(bays / 2)) {
                box(side, materials.lattice, [pitch * 0.65, story - 0.15, 0.085], [px, y, 0.045]);
              }
              windowAt(side, px, y + 0.1, 0.09, paneWidth, lattice ? 0.72 : 1.25, trim,
                (col + level) % 3 === 0 ? materials.shadeGlass : materials.glass, !lattice);
            }
          }
          if (lattice) box(side, trim, [0.22, height - story, 0.22], [(sideWidth - 0.4) / 2, (height + story) / 2, 0.08]);
        }
      }
      if (options.details) {
        const placeX = (x) => THREE.MathUtils.clamp(x * width / originalWidth, -width / 2 + 0.15, width / 2 - 0.15);
        const fixtureX = (x) => frontDoors.find(({ anchor }) => anchor === x)?.x
          ?? groundFixtures.find(({ anchor }) => anchor === x)?.x ?? placeX(x);
        options.details({ root, face, facade, width, placeX, fixtureX });
      }
    }
  }

  function tree(parent, x, z, scale = 1, type = 'shade', seed = 1, id = `tree:${x}:${z}`) {
    const rng = seededRandom(seed);
    const root = groupAt(parent, `${type[0].toUpperCase()}${type.slice(1)} tree`, [x, 0, z], rng() * Math.PI * 2);
    root.scale.setScalar(scale);
    add(id, root, undefined, { label: map.elements?.[id]?.label ?? root.name });
    if (type === 'palm') {
      const height = 6.15;
      for (let index = 0; index < 9; index++) {
        const t = index / 9;
        const next = (index + 1) / 9;
        rod(root, materials.bark, [0.66 * t * t, height * t, 0], [0.66 * next * next, height * next + 0.015, 0],
          0.17 - 0.073 * t);
      }
      for (let index = 0; index < 13; index++) {
        const frond = part(root, palmGeometry, foliage[index % foliage.length], [0.66, height, 0]);
        frond.rotation.set(0, index * 2.4, (rng() - 0.5) * 0.7);
        frond.scale.setScalar(0.62 + rng() * 0.4);
      }
    } else {
      const banyan = type === 'banyan';
      const height = banyan ? 7.5 : 5.1;
      const trunk = banyan ? 0.65 : 0.22;
      rod(root, materials.bark, [0, 0, 0], [0.15, height * 0.79, 0], trunk);
      const arms = banyan ? 12 : 7;
      for (let index = 0; index < arms; index++) {
        const angle = Math.PI * 2 * index / arms;
        const reach = (banyan ? 4 : 1.85) * (0.67 + rng() * 0.6);
        const px = Math.cos(angle) * reach;
        const pz = Math.sin(angle) * reach;
        const py = height * (0.77 + rng() * 0.2);
        rod(root, materials.bark, [0.07, height * (0.49 + rng() * 0.12), 0], [px, py, pz], trunk * 0.42);
        if (banyan) rod(root, materials.bark, [px, py, pz], [px * 1.03, 0.22 + rng() * 2.6, pz * 0.95], 0.035 + rng() * 0.035);
        for (let tuft = 0; tuft < 3; tuft++) {
          const size = (banyan ? 2.6 : 1.55) * (0.5 + rng() * 0.46);
          const leaves = part(root, crownGeometry, foliage[(index + tuft) % foliage.length],
            [px + rng() - 0.5, py + 0.35 + rng() * 0.85, pz + rng() - 0.5], [size, size * 0.63, size * 1.09]);
          leaves.rotation.set(rng(), rng() * 5, rng() * 0.55);
        }
      }
      part(root, crownGeometry, foliage[1], [0.12, height, 0], [2.15, 1.21, 1.86]);
    }
    const trunkWidth = type === 'banyan' ? 1.65 : 0.48;
    addLocalCollider(colliders, root, 0, 0, trunkWidth, trunkWidth);
    return root;
  }

  function shrub(parent, x, z, size, seed, editable = true) {
    const root = editable ? prop(parent, 'shrub', 'Garden shrub', x, z) : parent;
    const rng = seededRandom(seed);
    for (let index = 0; index < 5; index++) {
      const radius = size * (0.41 + rng() * 0.23);
      part(root, crownGeometry, foliage[index % foliage.length],
        [(rng() - 0.5) * size, radius * 0.68, (rng() - 0.5) * size],
        [radius, radius * 0.87, radius]);
    }
  }

  function flowerBed(parent, x, z, radius, seed, count = 28) {
    const root = prop(parent, 'flowers', 'Flower bed', x, z);
    const soil = cylinder(root, materials.soil, radius, 0.08, [0, 0.045, 0]);
    soil.scale.z *= 0.63;
    const rng = seededRandom(seed);
    for (let index = 0; index < count; index++) {
      const angle = rng() * Math.PI * 2;
      const r = Math.sqrt(rng()) * radius * 0.91;
      const px = Math.cos(angle) * r;
      const pz = Math.sin(angle) * r * 0.63;
      const height = 0.2 + rng() * 0.28;
      cylinder(root, foliage[0], 0.016, height, [px, height / 2 + 0.06, pz]);
      part(root, blossomGeometry, warmCenter, [px, height + 0.065, pz], [0.047, 0.033, 0.047]);
      for (let petal = 0; petal < 5; petal++) {
        const petalAngle = petal * Math.PI * 0.4;
        part(root, blossomGeometry, flowers[index % flowers.length],
          [px + Math.cos(petalAngle) * 0.052, height + 0.06, pz + Math.sin(petalAngle) * 0.052],
          [0.041, 0.026, 0.041]);
      }
    }
  }

  function planter(parent, x, z, size, seed) {
    const root = prop(parent, 'planter', 'Potted plant', x, z);
    const pot = part(root, potGeometry, materials.terracotta, [0, size * 0.33, 0], [size, size * 0.66, size]);
    pot.receiveShadow = true;
    const plant = groupAt(root, 'Potted foliage', [0, size * 0.52, 0]);
    shrub(plant, 0, 0, size * 1.5, seed, false);
  }

  function bench(parent, x, z, yaw = 0) {
    const root = prop(parent, 'bench', 'Garden bench', x, z, yaw);
    for (const px of [-0.67, 0.67]) {
      box(root, materials.steel, [0.11, 0.44, 0.43], [px, 0.22, 0]);
      box(root, materials.steel, [0.11, 0.56, 0.105], [px, 0.68, -0.204]);
    }
    for (let index = 0; index < 4; index++) {
      box(root, materials.wood, [1.83, 0.075, 0.087], [0, 0.45, -0.16 + index * 0.108]);
    }
    for (let index = 0; index < 3; index++) {
      box(root, materials.wood, [1.83, 0.102, 0.07], [0, 0.6 + index * 0.13, -0.218]);
    }
    addLocalCollider(colliders, root, 0, 0, 1.82, 0.48);
  }

  function bus(parent, x, z, yaw) {
    const root = groupAt(parent, 'Stamford varsity bus', [x, 0, z], yaw);
    const ivory = materials.white;
    const rubber = standard('#24292c', { roughness: 0.97 });
    const rim = standard('#a8b2b7', { metalness: 0.7, roughness: 0.36 });
    const amber = standard('#d89443');
    const widths = 2.75;
    const length = 8.35;
    box(root, ivory, [widths, 2.64, length], [0, 1.91, 0]);
    box(root, ivory, [2.62, 0.13, 8.06], [0, 3.28, 0]);
    box(root, materials.blue, [2.79, 0.66, 8.39], [0, 1.01, 0]);
    box(root, amber, [2.8, 0.079, 8.405], [0, 1.38, 0]);
    box(root, materials.black, [2.68, 0.22, 8.47], [0, 0.58, 0]);
    const windshield = groupAt(root, 'Driver windshield', [0, 0, length / 2]);
    windowAt(windshield, 0, 2.28, 0.013, 2.39, 1.06, materials.black, materials.unlitGlass);
    for (const side of [-1, 1]) {
      const elevation = groupAt(root, 'Bus passenger side', [side * widths / 2, 0, 0], side * Math.PI / 2);
      for (let index = 0; index < 6; index++) {
        windowAt(elevation, (index - 2.5) * 1.25, 2.43, 0.01, 1.06, 0.82, materials.black, materials.unlitGlass, false);
      }
      sign(elevation, { title: 'STAMFORD UNIVERSITY', subtitle: 'VARSITY TRANSPORT', position: [0, 1.03, 0.047],
        width: 5.6, height: 0.46, seal: true });
      for (const wheelZ of [-2.53, 2.63]) {
        cylinder(root, rubber, 0.52, 0.39, [side * 1.19, 0.54, wheelZ]).rotation.z = Math.PI / 2;
        cylinder(root, rim, 0.27, 0.047, [side * 1.4, 0.54, wheelZ]).rotation.z = Math.PI / 2;
      }
      box(root, ivory, [0.43, 0.17, 0.21], [side * 1.43, 2.2, 4.12]);
      box(root, materials.black, [0.17, 0.39, 0.18], [side * 1.64, 2.18, 4.1]);
      box(root, materials.white, [0.43, 0.2, 0.07], [side * 0.96, 1.17, 4.22]);
      box(root, amber, [0.17, 0.12, 0.075], [side * 1.14, 1.17, 4.23]);
    }
    box(root, materials.steel, [0.9, 0.26, 0.09], [0, 0.96, 4.227]);
    box(root, materials.concrete, [1.19, 0.18, 1.54], [0, 3.41, -0.81]);
    addLocalCollider(colliders, root, 0, 0, 2.89, length + 0.15);
    return root;
  }

  function buildAdded(parent) {
    for (const [id, spec] of Object.entries(map.buildings)) {
      if (spec.type === 'building') building(parent, id, 'utility');
    }
    for (const [id, spec] of Object.entries(map.elements ?? {})) {
      if (spec.type === 'tree') {
        const root = tree(parent, spec.x, spec.z, 1, 'shade', spec.seed, id);
        batchStaticMeshes(root);
      }
    }
  }

  function place(parent, type, position, mount) {
    const records = type === 'building' ? map.buildings : (map.elements ??= {});
    let number = 1;
    while (Object.hasOwn(records, `added-${type}-${number}`)) number++;
    const id = `added-${type}-${number}`;
    if (type === 'door') {
      const { entry, wall, offset } = mount;
      const host = entry.spec;
      const count = Object.values(records).filter((item) => item.type === 'door'
        && item.building === entry.id && item.wall === wall.id).length;
      if ((count + 1) * (addedDoorSpan + facadeClearance) + facadeClearance > wall.span) return null;
      records[id] = { type, label: `Door ${number} · ${entry.label}`, building: entry.id, wall: wall.id, offset };
      entry.building.resize(host.width, host.depth, host.floors, true);
    } else {
      const label = type === 'building' ? `Building ${number}` : `Tree ${number}`;
      const spec = { type, label, x: position.x, z: position.z, yaw: 0 };
      records[id] = spec;
      if (type === 'building') {
        Object.assign(spec, { width: 10, depth: 8, floors: 2 });
        building(parent, id, 'utility');
      } else {
        spec.seed = 5303 + number * 859;
        batchStaticMeshes(tree(parent, spec.x, spec.z, 1, 'shade', spec.seed, id));
      }
    }
    return layout.objects.get(id);
  }

  function moveDoor(entry, offsetMetres) {
    entry.spec.offset = THREE.MathUtils.clamp(offsetMetres * 2 / entry.wallSpan, -1, 1);
    rebuildDoors(entry.buildingId);
  }

  function rebuildDoors(buildingId) {
    const host = layout.objects.get(buildingId);
    const { width, depth, floors } = host.spec;
    host.building.resize(width, depth, floors, true);
  }

  function detach(entry) {
    const removed = [entry];
    for (const child of layout.objects.values()) {
      if (child.buildingId === entry.id) removed.push(child);
    }
    for (const item of removed) layout.objects.delete(item.id);
    removeColliders(colliders, entry.root);
    disposeInstances(entry.root);
    entry.root.removeFromParent();
    return removed;
  }

  function remove(entry) {
    if (!canRemove(entry)) return null;
    const parent = entry.root.parent;
    const obstacleRecords = colliders.filter(({ group }) => isDescendantOf(entry.root, group));
    const items = detach(entry);
    const records = items.map((item) => {
      const type = item.spec?.type;
      const source = type === 'building' ? map.buildings : type === 'tree' || type === 'door' ? map.elements : null;
      if (source) delete source[item.id];
      else (map.removedObjects ??= []).push(item.id);
      return { item, source };
    });
    if (entry.buildingId) rebuildDoors(entry.buildingId);

    function restore() {
      for (const { item, source } of records) {
        layout.objects.set(item.id, item);
        if (source) source[item.id] = item.spec;
        else map.removedObjects = map.removedObjects.filter((id) => id !== item.id);
      }
      if (map.removedObjects?.length === 0) delete map.removedObjects;
      if (entry.buildingId) {
        rebuildDoors(entry.buildingId);
      } else {
        parent.add(entry.root);
        colliders.push(...obstacleRecords);
        updateCollidersForGroup(colliders, entry.root);
      }
    }
    return { items, restore };
  }

  function applyRemovals() {
    for (const id of map.removedObjects ?? []) {
      const entry = layout.objects.get(id);
      if (canRemove(entry)) detach(entry);
    }
  }

  return {
    map, materials, colliders, foliage, windowMaterials, building, windowAt, tree, shrub, flowerBed, planter, bench, bus,
    direction, prop, layout, buildAdded, place, moveDoor, rebuildDoors, remove, applyRemovals,
    refreshColliders: (root) => updateCollidersForGroup(colliders, root)
  };
}

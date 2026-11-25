import * as THREE from 'three';
import { createLayoutRegistry, rounded } from './campusLayout.js';
import { academicWingBounds, rearLinkBounds, worldOutline } from './campusFootprints.js';
import { batchStaticMeshes, box, canvasTexture, cylinder, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

const radians = THREE.MathUtils.degToRad;
const crownGeometry = new THREE.IcosahedronGeometry(1, 1);
const blossomGeometry = new THREE.SphereGeometry(1, 7, 5);
const potGeometry = new THREE.CylinderGeometry(1, 0.71, 1, 11);
const palmGeometry = makePalmFrond();
const signMaterials = new Map();
const facadeClearance = 0.15;
const roofCopingOverhang = 0.09;
const roofTrimOverhang = 0.2;
export const maxBuildingFloors = 24;
export const maxBuildingSpan = 150;
export const academicStoryHeight = 3.15;
export const officialStoryHeight = 3.3;
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

export function addLocalCollider(colliders, group, x, z, width, depth, oriented = true, top, bottom = 0) {
  group.updateWorldMatrix(true, false);
  const lower = new THREE.Vector3(x - width / 2, 0, z - depth / 2);
  const upper = new THREE.Vector3(x + width / 2, 0, z + depth / 2);
  const bounds = new THREE.Box3(lower, upper).applyMatrix4(group.matrixWorld);
  const record = {
    minX: bounds.min.x, maxX: bounds.max.x, minZ: bounds.min.z, maxZ: bounds.max.z,
    group, local: { x, z, width, depth, top, bottom }, oriented
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

function facadeFixtures({ doors = [], windows = [] }) {
  return [
    ...doors.map((door) => ({ x: door.x, anchor: door.x, door, span: Math.max((door.width || 1.45) + 0.34, door.signWidth || 0) })),
    ...windows.map((window) => ({ x: window.x, anchor: window.x, window, span: window.width + (window.counter ? 0.4 : 0.24) }))
  ].sort((a, b) => a.x - b.x);
}

function fixtureRoom(fixtures) {
  return fixtures.reduce((total, fixture) => total + fixture.span + facadeClearance, facadeClearance);
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
  const buildingModels = new Map();
  const parked = new Map();
  const prop = (parent, kind, name, x, z, yaw = 0, options) =>
    add(`${kind}:${x}:${z}`, groupAt(parent, name, [x, 0, z], yaw), undefined, options);
  const direction = (parent, settings) => {
    const root = add(`sign:${settings.x}:${settings.z}`, wayfinding(parent, materials, settings));
    addLocalCollider(colliders, root, 0, 0, settings.width ?? 2.35, 0.24, true, 2.08, 0);
    return root;
  };
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
    shadeGlass: makeGlass('#a8bec8', '#d79c60')
  };
  const flowers = ['#ffc872', '#e77d86', '#f2a38a', '#eae3bf'].map((color) => standard(color));
  const warmCenter = standard('#c98c36');
  const themes = {
    guard: { wall: materials.white, trim: materials.blue, story: 2.8 },
    cse: { wall: materials.concrete, trim: materials.white, story: 3.06 },
    official: { wall: materials.official, trim: materials.concrete, story: officialStoryHeight, recess: 1.14 },
    academic: { wall: materials.academic, trim: materials.white, story: academicStoryHeight, recess: 1.02 },
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

  function building(parent, id, style, options = {}, section = null) {
    if (!section) buildingModels.set(id, { style, options });
    const spec = section?.spec ?? map.buildings[id];
    if (!spec) return null;
    const { wall: defaultWall, trim: defaultTrim, story: defaultStory, recess = 0, bands = false } = themes[style];
    const wall = options.wall ?? defaultWall;
    const trim = section?.trim ?? defaultTrim;
    const story = section?.story ?? options.story ?? defaultStory;
    const root = groupAt(parent, spec.label, [spec.x, 0, spec.z], radians(spec.yaw));
    const fixtures = facadeFixtures(options);
    const originalWidth = spec.facadeWidth ?? spec.width;
    const model = { story, resize, wallSurfaces: section?.wallSurfaces ?? [] };
    if (section) {
      buildShell(spec.width, spec.depth, spec.floors, section.extraDoors);
      return root;
    }
    add(id, root, spec);
    const legacyScale = root.scale.clone();
    root.scale.setScalar(1);
    const entry = layout.objects.get(id);
    entry.building = model;
    const wingFixtures = options.academicWing ? facadeFixtures(options.academicWing) : [];
    let initialFloors = (Number.isFinite(spec.floors) ? spec.floors : 1) * legacyScale.y;
    if (options.rearFloorSetback && !(Number.isFinite(spec.rearFloorSetback)
      && spec.rearFloorSetback > 0 && spec.rearFloorSetback < 1)) {
      spec.rearFloorSetback = options.rearFloorSetback;
      // Add the rear third floor to older two-storey Official Building plans.
      if (Math.round(initialFloors) === 2) initialFloors = 3;
    }
    delete spec.scale;
    resize(spec.width * legacyScale.x, spec.depth * legacyScale.z, initialFloors);
    return root;

    function resize(requestedWidth, requestedDepth, requestedFloors, rebuildDoors = false) {
      const extraDoors = Object.entries(map.elements ?? {}).filter(([doorId, element]) => element.type === 'door'
        && element.building === id && !parked.has(doorId));
      const doorRoom = (side) => extraDoors.filter(([, door]) => door.wall === side).length * (addedDoorSpan + facadeClearance);
      let minWidth = Math.max(2.6, options.minWidth ?? 0, fixtureRoom(fixtures),
        fixtureRoom(fixtures.filter(({ door }) => door)) + doorRoom('front'), doorRoom('back') + facadeClearance);
      let minDepth = Math.max(2.6, recess + 1.1, recess + Math.max(doorRoom('right'), doorRoom('left')) + facadeClearance);
      const wing = options.academicWing && spec.academicWing;
      if (wing) {
        const wingRecess = themes.academic.recess;
        const wingWidth = Math.max(fixtureRoom(wingFixtures),
          fixtureRoom(wingFixtures.filter(({ door }) => door)) + doorRoom('academic-front'), doorRoom('academic-back') + facadeClearance);
        const wingDepth = Math.max(2.6, wingRecess + Math.max(doorRoom('academic-left'), doorRoom('academic-right')) + facadeClearance);
        minWidth = Math.max(minWidth, wingDepth / wing.depthRatio);
        minDepth = Math.max(minDepth, wingWidth / wing.widthRatio);
      }
      const width = THREE.MathUtils.clamp(requestedWidth, minWidth, maxBuildingSpan);
      const depth = THREE.MathUtils.clamp(requestedDepth, minDepth, maxBuildingSpan);
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
      if (wing) {
        building(root, id, 'academic', options.academicWing, {
          spec: academicWingBounds(spec), wallSurfaces: model.wallSurfaces, extraDoors, story, trim
        });
      }
      batchStaticMeshes(root);
      return true;
    }

    function buildShell(width, depth, floors, extraDoors) {
      const endWidth = options.upperFloorStory && spec.upperEndWidthRatio > 0 && spec.upperEndWidthRatio <= 1
        ? width * spec.upperEndWidthRatio : 0;
      const setback = options.rearFloorSetback ? depth * spec.rearFloorSetback : 0;
      const partialUpperFloor = (setback || endWidth) && floors > 1;
      const frontFloors = partialUpperFloor ? floors - 1 : floors;
      const height = story * frontFloors;
      const lowerDepth = endWidth && frontFloors > 1 ? depth * (spec.lowerRoofDepthRatio ?? 0) : 0;
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
        const wallId = section ? `academic-${surface.id}` : surface.id;
        if (section) {
          const [[x, z]] = worldOutline([[surface.x, surface.z]], spec);
          model.wallSurfaces.push({ ...surface, id: wallId, x, z, angle: surface.angle + radians(spec.yaw) });
        } else model.wallSurfaces.push(surface);
        const placed = extraDoors.filter(([, door]) => door.wall === wallId);
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
      if (options.groundExterior) options.groundExterior({ root, width, depth, story, facade, recess, section, endWidth, lowerDepth });
      else {
        box(root, wall, [width, story, depth - recess], [0, story / 2, -recess / 2]);
        box(root, materials.black, [width + 0.025, 0.28, depth - recess + 0.04], [0, 0.14, -recess / 2]);
        if (section) {
          // Return the end wall across the recessed frontage where it meets the adjoining block.
          const returnWidth = 0.38;
          const x = (width - returnWidth) / 2;
          const z = facade - recess / 2;
          box(root, wall, [returnWidth, story, recess], [x, story / 2, z]);
          box(root, materials.black, [returnWidth + 0.025, 0.28, recess], [x, 0.14, z + 0.02]);
          addLocalCollider(colliders, root, x, z, returnWidth, recess, true, story);
        }
      }
      const pad = options.facadePad ?? 0;
      const coreTop = partialUpperFloor
        ? (lowerDepth ? story : height) + 0.535
        : options.roofTop
          ? options.roofTop({ story, height, floors })
          : options.roof
            ? undefined
            : height + 0.535;
      addLocalCollider(colliders, root, 0, -recess / 2, width + pad * 2, depth - recess + pad * 2, true, coreTop, 0);
      if (recess > 0 && !lowerDepth) {
        const overhangBottom = frontFloors > 1 ? story : story - 0.05;
        addLocalCollider(colliders, root, 0, 0, width + pad * 2, depth + pad * 2, true, height + 0.535, overhangBottom);
      }
      if (lowerDepth) {
        buildAcademicStep(width, depth, endWidth, lowerDepth, frontFloors);
      } else {
        if (frontFloors > 1) box(root, wall, [width, height - story, depth], [0, (height + story) / 2, 0]);
        if (options.exterior) options.exterior({ root, width, depth, floors, story, height, facade, recess });
        else if (options.roof) options.roof({ root, width, depth, story, height, facade });
        else if (partialUpperFloor && setback) {
          const frontRoof = groupAt(root, 'Official frontage roof', [0, 0, (depth - setback) / 2]);
          flatRoof(frontRoof, width, setback, height);
        } else flatRoof(root, width, depth, height);
      }

      if (partialUpperFloor) {
        const upperWidth = endWidth || width;
        const upperDepth = depth - setback;
        const x = (width - upperWidth) / 2;
        const z = (upperDepth - depth) / 2;
        const upperHeight = (section?.story ?? options.upperFloorStory ?? story) * floors;
        const rise = upperHeight - height;
        const upper = groupAt(root, 'Setback upper floor', [x, height, z]);
        const upperWall = options.upperFloorWall ?? wall;
        if (options.upperFloorExterior && endWidth) {
          options.upperFloorExterior({
            root, upper, upperWidth, upperDepth, rise, height, upperHeight,
            wall: upperWall, trim, lowerDepth, width, depth, story, floors
          });
        } else {
          box(upper, upperWall, [upperWidth, rise, upperDepth], [0, rise / 2, 0]);
          flatRoof(upper, upperWidth, upperDepth, rise, upperWall);
          upperWindows(upper, upperWidth, upperDepth, 0, 1, { storey: rise });
        }
        addLocalCollider(colliders, root, x, z, upperWidth, upperDepth, true, upperHeight + 0.56, endWidth ? story : height);
      }

      const link = rearLinkBounds(spec);
      if (link) {
        const { x, z, width: linkWidth, depth: linkDepth } = link;
        const fullHeight = story * floors;
        const connector = groupAt(root, 'Academic Building connection', [x, 0, z]);
        box(connector, wall, [linkWidth, fullHeight, linkDepth], [0, fullHeight / 2, 0]);
        flatRoof(connector, linkWidth, linkDepth, fullHeight);
        upperWindows(connector, linkWidth, linkDepth, 1, floors);
        addLocalCollider(colliders, connector, 0, 0, linkWidth, linkDepth, true, fullHeight + 0.535, 0);
      }
      if (recess) {
        const columns = Math.ceil(width / 4);
        const count = section ? columns : columns + 1;
        for (let i = 0; i < count; i++) {
          const px = -width / 2 + 0.25 + (width - 0.5) * i / columns;
          if (frontDoors.some((door) => Math.abs(door.x - px) < door.span / 2 + 0.35)) continue;
          box(root, trim, [0.38, story, 0.42], [px, story / 2, facade - 0.15]);
          box(root, materials.concrete, [0.55, 0.16, 0.57], [px, 0.08, facade - 0.15]);
          addLocalCollider(colliders, root, px, facade - 0.15, 0.42, 0.48, true, story, 0);
        }
      }
      if (options.awning) {
        const canopy = box(root, trim, [width + 0.42, 0.14, 1.27], [0, story - 0.33, facade + 0.55]);
        canopy.rotation.x = 0.1;
        for (const side of [-1, 1]) rod(root, materials.steel, [side * width * 0.42, story - 0.85, facade],
          [side * width * 0.42, story - 0.37, facade + 1.04], 0.037);
        addLocalCollider(colliders, root, 0, facade + 0.55, width + 0.42, 1.27, true, story - 0.22, story - 0.45);
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
          height: 0.67, position: [0, height - 0.19, facade + 0.2],
          background: style === 'cafe' ? '#9e4136' : '#18365e'
        });
        panel.scale.x = Math.min(panel.scale.x, width - 0.1);
      }
      if (!options.exterior && !lowerDepth && frontFloors > 1) upperWindows(root, width, depth, 1, frontFloors);
      if (options.details) {
        const placeX = (x) => THREE.MathUtils.clamp(x * width / originalWidth, -width / 2 + 0.15, width / 2 - 0.15);
        const fixtureX = (x) => frontDoors.find(({ anchor }) => anchor === x)?.x
          ?? groundFixtures.find(({ anchor }) => anchor === x)?.x ?? placeX(x);
        options.details({ root, face, facade, width, depth, height, frontFloors, spec, placeX, fixtureX });
      }
    }

    function buildAcademicStep(width, depth, endWidth, lowerDepth, frontFloors) {
      const frontDepth = depth - lowerDepth;
      const restWidth = width - endWidth;
      const height = story * frontFloors;
      const wallHeight = height - story;
      const wallY = (height + story) / 2;
      const backZ = (lowerDepth - depth) / 2;
      const rearRoof = groupAt(root, 'One-storey Academic roof', [-endWidth / 2, 0, backZ]);
      const lowerRoofY = flatRoof(rearRoof, restWidth, lowerDepth, story);

      const front = groupAt(root, 'Academic frontage', [0, 0, lowerDepth / 2]);
      box(front, wall, [width, wallHeight, frontDepth], [0, wallY, 0]);
      const frontRoof = groupAt(front, 'Academic frontage roof', [-endWidth / 2, 0, 0]);
      const frontRoofY = flatRoof(frontRoof, restWidth, frontDepth, height);
      upperWindows(front, width, frontDepth, 1, frontFloors, { blankSide: 'back' });

      const end = groupAt(root, 'Academic end bay', [restWidth / 2, 0, backZ]);
      if (options.endBayExterior) {
        options.endBayExterior({
          root, end, width, depth, endWidth, restWidth, lowerDepth,
          story, wallHeight, wallY, height, frontFloors, wall, trim
        });
      } else {
        box(end, wall, [endWidth, wallHeight, lowerDepth], [0, wallY, 0]);
        upperWindows(end, endWidth, lowerDepth, 1, frontFloors, { blankSide: 'left' });
      }
      addLocalCollider(colliders, root, 0, lowerDepth / 2, width, frontDepth, true, height + 0.535, story);
      if (section && options.stairs) options.stairs({
        root, width, depth, endWidth, lowerDepth, lowerRoofY, roofOverhang: roofCopingOverhang,
        trimOverhang: roofTrimOverhang, upperLandingY: Math.min(frontRoofY, lowerRoofY + story),
        opensToUpperRoof: frontFloors === 2, sideApproach: spec.yaw === -90
      });
    }

    function flatRoof(parent, width, depth, height, coping = wall) {
      box(parent, trim, [width + 0.42, 0.22, depth + roofTrimOverhang * 2], [0, height + 0.08, 0]);
      box(parent, coping, [width + roofCopingOverhang * 2, 0.37, depth + roofCopingOverhang * 2], [0, height + 0.35, 0]);
      return height + 0.535;
    }

    function upperWindows(parent, width, depth, firstLevel, floors, { storey = story, blankSide } = {}) {
      const facade = depth / 2;
      for (const [name, sideWidth, offset, angle] of [
        ['front', width, [0, 0, facade], 0], ['right', depth, [width / 2, 0, 0], Math.PI / 2],
        ['back', width, [0, 0, -facade], Math.PI], ['left', depth, [-width / 2, 0, 0], -Math.PI / 2]
      ]) {
        const side = groupAt(parent, 'Exterior elevation', offset, angle);
        const paneWidth = Math.min(bands ? 2.48 : 2.16, Math.max(0.25, sideWidth - 0.4));
        const bays = Math.max(1, Math.min(Math.round(sideWidth / (bands ? 3.3 : 3.05)),
          Math.floor((sideWidth - 0.4) / (paneWidth + 0.36))));
        const pitch = (sideWidth - 0.4) / bays;
        for (let level = firstLevel; level < floors; level++) {
          const y = storey * (level + 0.5);
          box(side, trim, [sideWidth, 0.15, 0.22], [0, level * storey + 0.02, 0.05]);
          if (name === blankSide) continue;
          for (let col = 0; col < bays; col++) {
            const px = pitch * (col - (bays - 1) / 2);
            if (bands && col === Math.floor(bays / 2)) {
              box(side, materials.lattice, [pitch * 0.65, storey - 0.15, 0.085], [px, y, 0.045]);
            }
            windowAt(side, px, y + 0.1, 0.09, paneWidth, 1.25, trim,
              (col + level) % 3 === 0 ? materials.shadeGlass : materials.glass);
          }
        }
      }
    }
  }

  function tree(parent, x, z, scale = 1, type = 'shade', seed = 1, id = `tree:${x}:${z}`) {
    const rng = seededRandom(seed);
    const root = groupAt(parent, `${type[0].toUpperCase()}${type.slice(1)} tree`, [x, 0, z], rng() * Math.PI * 2);
    root.scale.setScalar(scale);
    if (id !== null) add(id, root, undefined, { label: map.elements?.[id]?.label ?? root.name });
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
      if (banyan) {
        // Raised weathered grey/pale stone circular sitting bench around the banyan tree base
        const benchRadius = 1.95;
        const benchHeight = 0.5;
        const segments = 16;
        const stoneLight = standard('#cbc6ba', { roughness: 0.82 });
        const stoneDark = standard('#838079', { roughness: 0.86 });
        const stoneCap = standard('#e2dcd0', { roughness: 0.6 });
        cylinder(root, materials.soil, benchRadius - 0.22, benchHeight - 0.08, [0, (benchHeight - 0.08) / 2, 0]);
        for (let seg = 0; seg < segments; seg++) {
          const theta = (seg / segments) * Math.PI * 2;
          const segWidth = (2 * Math.PI * benchRadius) / segments + 0.04;
          const panel = box(root, seg % 2 ? stoneLight : stoneDark, [segWidth, benchHeight - 0.08, 0.36],
            [Math.cos(theta) * benchRadius, (benchHeight - 0.08) / 2, Math.sin(theta) * benchRadius]);
          panel.rotation.y = -theta + Math.PI / 2;
          const cap = box(root, stoneCap, [segWidth + 0.02, 0.08, 0.42],
            [Math.cos(theta) * benchRadius, benchHeight - 0.04, Math.sin(theta) * benchRadius]);
          cap.rotation.y = -theta + Math.PI / 2;
        }
      }
    }
    const trunkWidth = type === 'banyan' ? 1.65 : 0.48;
    if (id !== null) addLocalCollider(colliders, root, 0, 0, trunkWidth, trunkWidth);
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
    addLocalCollider(colliders, root, 0, 0, size * 2, size * 2, true, size * 1.5, 0);
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
    addLocalCollider(colliders, root, 0, 0, 1.82, 0.48, true, 0.95, 0);
  }

  function buildAdded(parent) {
    for (const [id, spec] of Object.entries(map.buildings)) {
      if (spec.type !== 'building') continue;
      const model = buildingModels.get(spec.template);
      building(parent, id, model?.style ?? 'utility', model?.options);
    }
    for (const [id, spec] of Object.entries(map.elements ?? {})) {
      if (spec.type === 'tree') {
        const root = tree(parent, spec.x, spec.z, 1, 'shade', spec.seed, id);
        batchStaticMeshes(root);
      }
    }
    for (const [id, spec] of Object.entries(map.elements ?? {})) {
      if (spec.type === 'copy') copyProp(parent, id, spec);
    }
  }

  function nextNumber(records, type) {
    let number = 1;
    while (Object.hasOwn(records, `added-${type}-${number}`)) number++;
    return number;
  }

  function place(parent, type, position, mount) {
    const records = type === 'building' ? map.buildings : (map.elements ??= {});
    const number = nextNumber(records, type);
    const id = `added-${type}-${number}`;
    if (type === 'door') {
      const { entry, wall, offset } = mount;
      const host = entry.spec;
      if (!fitsDoor(mount)) return null;
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

  function copyProp(parent, id, spec, template = layout.objects.get(spec.template)) {
    if (!template) return null;
    const root = template.root.clone();
    root.name = spec.label;
    root.scale.copy(template.baseScale);
    root.position.y = template.root.position.y;
    (template.root.parent ?? parent).add(root);
    const { surface, elevation } = template;
    add(id, root, spec, { surface, elevation });
    function mapClonedGroup(sourceGroup) {
      if (sourceGroup === template.root) return root;
      const path = [];
      let cur = sourceGroup;
      while (cur && cur !== template.root) {
        const parentNode = cur.parent;
        if (!parentNode) return null;
        path.push(parentNode.children.indexOf(cur));
        cur = parentNode;
      }
      if (cur !== template.root) return null;
      let target = root;
      for (let i = path.length - 1; i >= 0; i--) {
        target = target?.children[path[i]];
        if (!target) return null;
      }
      return target;
    }
    for (const record of colliders.slice()) {
      if (isDescendantOf(template.root, record.group)) {
        const clonedGroup = mapClonedGroup(record.group);
        if (!clonedGroup) continue;
        const { x, z, width, depth, top, bottom } = record.local;
        addLocalCollider(colliders, clonedGroup, x, z, width, depth, record.oriented, top, bottom);
      }
    }
    return layout.objects.get(id);
  }

  function canDuplicate(entry) {
    return Boolean(entry && !entry.buildingId && !['pool', 'pool-portal', 'entry-gate'].includes(entry.id)
      && !entry.id.startsWith('wall:'));
  }

  function duplicate(parent, entry, position) {
    if (!canDuplicate(entry)) return null;
    const baseLabel = entry.spec?.copyLabel ?? entry.label;
    const label = `${baseLabel} copy`;
    const pose = { x: position.x, z: position.z, yaw: rounded(THREE.MathUtils.radToDeg(entry.root.rotation.y)) };
    if (entry.spec?.type === 'tree') {
      const records = map.elements;
      const id = `added-tree-${nextNumber(records, 'tree')}`;
      const spec = { ...structuredClone(entry.spec), ...pose, label, copyLabel: baseLabel };
      records[id] = spec;
      batchStaticMeshes(tree(parent, spec.x, spec.z, 1, 'shade', spec.seed, id));
      return layout.objects.get(id);
    }
    if (!entry.building) {
      const records = map.elements ??= {};
      const template = entry.spec?.template ?? entry.id;
      const id = `added-copy-${nextNumber(records, 'copy')}`;
      const spec = {
        type: 'copy', template, label, copyLabel: baseLabel, ...pose,
        scale: entry.root.scale.toArray().map((value, index) => rounded(value / entry.baseScale.getComponent(index)))
      };
      const result = copyProp(parent, id, spec, entry);
      if (result) records[id] = spec;
      return result;
    }

    const records = map.buildings;
    const id = `added-building-${nextNumber(records, 'building')}`;
    const template = entry.spec.template ?? (entry.spec.type !== 'building' ? entry.id : undefined);
    const model = buildingModels.get(template) ?? buildingModels.get(entry.id);
    records[id] = { ...structuredClone(entry.spec), ...pose, type: 'building', template, label, copyLabel: baseLabel };
    const elements = map.elements ??= {};
    for (const door of layout.objects.values()) {
      if (door.buildingId !== entry.id) continue;
      const number = nextNumber(elements, 'door');
      elements[`added-door-${number}`] = {
        ...structuredClone(door.spec), label: `Door ${number} · ${label}`, building: id
      };
    }
    building(parent, id, model.style, model.options);
    return layout.objects.get(id);
  }

  function moveDoor(entry, offsetMetres) {
    entry.spec.offset = THREE.MathUtils.clamp(offsetMetres * 2 / entry.wallSpan, -1, 1);
    rebuildDoors(entry.buildingId);
  }

  function fitsDoor({ entry, wall }) {
    const count = [...layout.objects.values()].filter((item) => item.buildingId === entry.id && item.spec.wall === wall.id).length;
    return (count + 1) * (addedDoorSpan + facadeClearance) + facadeClearance <= wall.span;
  }

  function mountDoor(entry, target) {
    entry.spec.wall = target.wall.id;
    entry.spec.offset = target.offset;
    rebuildDoors(entry.buildingId);
  }

  function rebuildDoors(buildingId) {
    const host = layout.objects.get(buildingId);
    const { width, depth, floors } = host.spec;
    host.building.resize(width, depth, floors, true);
  }

  function canRestore(record) {
    const host = layout.objects.get(record.entry.buildingId);
    return !record.entry.buildingId || Boolean(host?.building);
  }

  function removeFromDeck(record) {
    if (!record || record.entry.id === 'pool') return false;
    record.setState('removed');
    return true;
  }

  function setHiddenRecord(key, id, hidden) {
    if (hidden) {
      const list = map[key] ??= [];
      if (!list.includes(id)) list.push(id);
    } else if (map[key]) {
      map[key] = map[key].filter((value) => value !== id);
      if (!map[key].length) delete map[key];
    }
  }

  function takeOffMap(entry, state = 'deck') {
    if (!entry || entry.id === 'pool-portal') return null;
    const detached = [];
    const items = [];
    for (const item of layout.objects.values()) {
      if (item === entry || item.buildingId === entry.id || (entry.id === 'pool' && item.id === 'pool-portal')) {
        items.push(item);
      }
    }
    for (const item of items) layout.objects.delete(item.id);
    const roots = entry.id === 'pool' ? items : [entry];
    for (const item of roots) {
      const parent = item.root.parent;
      const obstacles = colliders.filter(({ group }) => isDescendantOf(item.root, group));
      removeColliders(colliders, item.root);
      item.root.removeFromParent();
      disposeInstances(item.root);
      detached.push({ item, parent, obstacles });
    }
    const dynamic = items.flatMap((item) => {
      if (item.spec?.type === 'building') return [[item, map.buildings]];
      if (['tree', 'door', 'copy'].includes(item.spec?.type)) return [[item, map.elements]];
      return [];
    });

    let currentState;
    const record = { entry, items, setState, restore };
    function setState(next) {
      const discard = next === 'removed' || next === 'discarded';
      for (const [item, records] of dynamic) {
        if (discard) delete records[item.id];
        else records[item.id] = item.spec;
      }
      currentState = next;
      setHiddenRecord('deck', entry.id, next === 'deck');
      setHiddenRecord('removedObjects', entry.id, next === 'removed' && !dynamic.some(([item]) => item === entry));
      if (next === 'deck') parked.set(entry.id, record);
      else parked.delete(entry.id);
    }

    function restore() {
      if (!currentState) return;
      setState(null);
      for (const item of items) layout.objects.set(item.id, item);
      for (const { item, parent, obstacles } of detached) {
        parent.add(item.root);
        colliders.push(...obstacles);
        updateCollidersForGroup(colliders, item.root);
      }
      if (entry.buildingId && layout.objects.has(entry.buildingId)) {
        rebuildDoors(entry.buildingId);
      }
    }
    setState(state);
    if (entry.buildingId) rebuildDoors(entry.buildingId);
    return record;
  }

  function applyVisibility() {
    const deck = new Set(map.deck);
    for (const id of [...(map.removedObjects ?? [])]) {
      const entry = layout.objects.get(id);
      if (entry?.buildingId) takeOffMap(entry, 'removed');
    }
    for (const id of deck) {
      const entry = layout.objects.get(id);
      if (entry?.buildingId) takeOffMap(entry);
    }
    for (const id of deck) {
      const entry = layout.objects.get(id);
      if (entry) takeOffMap(entry);
    }
    for (const id of [...(map.removedObjects ?? [])]) {
      takeOffMap(layout.objects.get(id), 'removed');
    }
  }

  return {
    map, materials, colliders, foliage, windowMaterials, building, windowAt, tree, shrub, flowerBed, planter, bench,
    direction, prop, layout, parked, buildAdded, place, canDuplicate, duplicate, moveDoor, fitsDoor, mountDoor, rebuildDoors,
    takeOffMap, applyVisibility, canRestore, removeFromDeck,
    refreshColliders: (root) => updateCollidersForGroup(colliders, root)
  };
}

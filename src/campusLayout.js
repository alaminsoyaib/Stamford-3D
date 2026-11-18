import * as THREE from 'three';
import { campusGatePose, perimeterWalls } from './campusBoundary.js';

const scaleMin = 0.1;
const scaleMax = 20;
const xz = new THREE.Vector3();
// Stock map hashes for LF and CRLF checkouts, newest first.
const stockLayoutKeys = [
  ['stamford-layout-v1-1442516863', 'stamford-layout-v1-108252353'],
  ['stamford-layout-v1-3952416041', 'stamford-layout-v1-4446907'],
  ['stamford-layout-v1-2488626924', 'stamford-layout-v1-1431998899'],
  ['stamford-layout-v1-58594549', 'stamford-layout-v1-2509250825']
];

export function layoutKey(source) {
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  return `stamford-layout-v1-${hash >>> 0}`;
}

export function validateCampusLayout(data) {
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    return { valid: false, error: 'Layout data must be a JSON object.' };
  }
  const { boundary } = data;
  if (!boundary || typeof boundary !== 'object') {
    return { valid: false, error: 'Layout is missing a valid "boundary" object.' };
  }
  if (Array.isArray(boundary.points)) {
    if (boundary.points.length < 3 || !boundary.points.every((pt) => Array.isArray(pt) && pt.length >= 2 && Number.isFinite(pt[0]) && Number.isFinite(pt[1]))) {
      return { valid: false, error: 'Boundary points must contain at least 3 valid [x, z] coordinates.' };
    }
  } else {
    const hasBounds = ['minX', 'maxX', 'minZ', 'maxZ'].every((k) => Number.isFinite(boundary[k]));
    if (!hasBounds) {
      return { valid: false, error: 'Boundary must include minX, maxX, minZ, maxZ or polygon points.' };
    }
  }
  return { valid: true, map: data };
}

function updateStockRoomAndBusPoses(saved, stock) {
  const { guard, guardian, bus } = saved.buildings ?? {};
  const applyPose = (entry, { x, z, yaw }) => Object.assign(entry, { x, z, yaw });
  if (guard?.x === -13.3 && guard.z === 27.2 && guard.yaw === 90 && guard.width === 4.6 && guard.depth === 4.5
      && guardian?.x === -29.3 && guardian.z === 17.25 && guardian.yaw === 90
      && guardian.width === 4.6 && guardian.depth === 4.5) {
    applyPose(guardian, stock.buildings.guardian);
  }
  if (bus?.x === 0 && bus.z === 0 && bus.yaw === 0) {
    const previousBusPose = { x: 24.2, z: 9.3, yaw: 33 };
    applyPose(bus, previousBusPose);
    const parking = saved.elements?.['bus-parking'];
    if (parking?.x === 0 && parking.z === 0 && parking.yaw === 0) applyPose(parking, previousBusPose);
  }
}

function updateStockBoundary(saved, stock) {
  const { boundary } = saved;
  if (!boundary || boundary.points || boundary.minX !== -48 || boundary.maxX !== 50
    || boundary.minZ !== -86 || boundary.maxZ !== 32 || boundary.streetZ !== 45) return;
  const gate = campusGatePose(saved);
  if (gate.x !== stock.gate.x || gate.z !== stock.gate.z || (gate.yaw ?? 0) !== 0) return;
  if (boundary.walls && JSON.stringify(boundary.walls) !== JSON.stringify(perimeterWalls(saved))) return;
  saved.boundary = structuredClone(stock.boundary);
}

function updateStockSurveyPlan(saved, stock) {
  if (saved.surveyTrees || saved.deck?.length || saved.removedObjects?.length
    || JSON.stringify(saved.boundary.points) !== JSON.stringify(stock.boundary.points)
    || Object.keys(saved.elements ?? {}).some((id) => !['bus-parking', 'gate-platform', 'gate-planting-bed'].includes(id))
    || Object.keys(saved.buildings ?? {}).some((id) => !Object.hasOwn(stock.buildings, id))) return;
  if (saved.boundary.walls && JSON.stringify(saved.boundary.walls) !== JSON.stringify(perimeterWalls(saved))) return;
  const formerBuildings = {
    cse: [8.9, -1.5, 22, 17, 0], official: [9, -8, 24, 12, 0], civil: [-28, -42.4, 23, 14.2, 90],
    bus: [24.2, 9.3, 2.89, 8.5, 33], academic: [23, -27.65, 27.3, 11, -90], canteen: [-9.8, -56.3, 14, 6.3, 0],
    poolHouse: [22.1, -74, 8.3, 4.8, -90], law: [44, -18.8, 8.5, 6, -90], pharmacyLibrary: [39.8, -31, 9.2, 6.4, -90]
  };
  const pose = ({ x, z, width, depth, yaw = 0 } = {}) => [x, z, width, depth, yaw];
  const matches = (entry, previous) => pose(entry).every((value, index) => value === previous[index]);
  if (!Object.entries(formerBuildings).every(([id, previous]) => matches(saved.buildings?.[id], previous))
    || !matches(saved.pool, [10.5, -69.5, 12.4, 21, 0]) || Object.keys(saved.pool.portalTransform ?? {}).length || saved.pool.scale
    || !matches(saved.ground, [0, -35.2, 30, 30.4, 0]) || saved.ground.scale
    || saved.garden.points || saved.garden.x !== 7 || saved.garden.z !== 17 || saved.garden.scale || saved.garden.yaw) return;
  const parking = saved.elements?.['bus-parking'];
  if (parking && (parking.x !== 24.2 || parking.z !== 9.3 || parking.yaw !== 33)) return;
  for (const id of Object.keys(formerBuildings)) {
    const { x, z, width, depth, yaw, westWing } = stock.buildings[id];
    Object.assign(saved.buildings[id], { x, z, width, depth, yaw });
    if (westWing) saved.buildings[id].westWing = structuredClone(westWing);
    delete saved.buildings[id].facadeWidth;
  }
  for (const key of ['garden', 'ground', 'pool', 'surveyTrees', 'stops', 'areas']) saved[key] = structuredClone(stock[key]);
  if (parking) Object.assign(parking, { x: stock.buildings.bus.x, z: stock.buildings.bus.z, yaw: stock.buildings.bus.yaw });
}

export function readCampusLayout(source) {
  const key = layoutKey(source);
  const stock = JSON.parse(source);
  let map = stock;
  if (typeof window !== 'undefined') {
    const keys = [key];
    const version = stockLayoutKeys.findIndex((pair) => pair.includes(key));
    if (version >= 0) {
      const lineEnding = stockLayoutKeys[version].indexOf(key);
      for (const pair of stockLayoutKeys.slice(version + 1)) keys.push(pair[lineEnding], pair[1 - lineEnding]);
    }
    findSave: for (const candidate of keys) {
      for (const storage of ['sessionStorage', 'localStorage']) {
        try {
          const saved = window[storage].getItem(candidate);
          if (!saved) continue;
          const savedMap = JSON.parse(saved);
          if (candidate !== key && stockLayoutKeys.at(-1).includes(candidate)) updateStockRoomAndBusPoses(savedMap, stock);
          if (candidate !== key && version <= 1) updateStockBoundary(savedMap, stock);
          if (candidate !== key && version === 0) updateStockSurveyPlan(savedMap, stock);
          map = savedMap;
          break findSave;
        } catch {
          // The source map stays available when storage is blocked.
        }
      }
    }
  }
  function saveLayout(newMap) {
    if (typeof window === 'undefined') return;
    const json = JSON.stringify(newMap);
    for (const storage of ['localStorage', 'sessionStorage']) {
      try {
        window[storage].setItem(key, json);
      } catch {
        // JSON export stays available when storage is blocked.
      }
    }
  }
  return {
    map,
    key,
    save() { saveLayout(map); },
    saveLayout
  };
}

export function createLayoutRegistry(map) {
  const objects = new Map();
  const poolStop = () => map.stops.find(({ key }) => key === '4');
  const poolArea = () => map.areas.find(({ stop }) => stop === '4');

  function captureTransform(entry) {
    const { id, root, spec } = entry;
    const state = {
      pose: [...root.position.toArray(), root.rotation.y, ...root.scale.toArray()],
      spec: structuredClone(spec)
    };
    if (id === 'pool') {
      // Keep the pool, portal, and checkpoint in the same history step.
      delete state.spec.portalTransform;
      state.portal = captureTransform(objects.get('pool-portal'));
      state.stop = structuredClone(poolStop());
      state.area = structuredClone(poolArea());
    }
    if (id === 'pool-portal') state.ring = [...map.pool.ring];
    return state;
  }

  function restoreTransform(entry, state) {
    const { id, root } = entry;
    root.position.fromArray(state.pose);
    root.rotation.y = state.pose[3];
    root.scale.fromArray(state.pose, 4);
    if (state.spec) {
      const spec = entry.spec ??= ((map.elements ??= {})[id] = {});
      for (const key of Object.keys(spec)) {
        if (!Object.hasOwn(state.spec, key) && (id !== 'pool' || key !== 'portalTransform')) delete spec[key];
      }
      Object.assign(spec, structuredClone(state.spec));
    } else if (entry.spec) {
      delete map.elements[id];
      entry.spec = undefined;
    }
    if (state.portal) {
      restoreTransform(objects.get('pool-portal'), state.portal);
      if (state.stop) Object.assign(poolStop(), structuredClone(state.stop));
      if (state.area) Object.assign(poolArea(), structuredClone(state.area));
    }
    if (state.ring) map.pool.ring = [...state.ring];
  }

  return {
    objects, captureTransform, restoreTransform,
    add(id, root, spec = map.elements?.[id], { label = root.name, surface = false, elevation = false } = {}) {
      if (objects.has(id)) throw new Error(`Duplicate layout element ${id}`);
      const baseScale = root.scale.clone();
      const entry = { id, root, label, surface, elevation, baseScale, bounds: new THREE.Box3(), spec };
      if (spec) {
        if (Number.isFinite(spec.x)) root.position.x = spec.x;
        if (Number.isFinite(spec.z)) root.position.z = spec.z;
        if (elevation && Number.isFinite(spec.y)) root.position.y = spec.y;
        if (Number.isFinite(spec.yaw)) root.rotation.y = THREE.MathUtils.degToRad(spec.yaw);
        if (Array.isArray(spec.scale)) {
          for (const [index, axis] of ['x', 'y', 'z'].entries()) {
            const factor = spec.scale[index];
            if (Number.isFinite(factor) && !(surface && axis === 'y')) {
              root.scale[axis] *= THREE.MathUtils.clamp(factor, scaleMin, scaleMax);
            }
          }
        }
      }
      root.userData.layoutId = id;
      objects.set(id, entry);
      return root;
    },
    write(entry) {
      const { root, baseScale, elevation, id } = entry;
      const spec = entry.spec ??= (map.elements ??= {})[id] ??= {};
      spec.x = rounded(root.position.x);
      spec.z = rounded(root.position.z);
      spec.yaw = rounded(THREE.MathUtils.radToDeg(root.rotation.y));
      if (!entry.building) spec.scale = ['x', 'y', 'z'].map((axis) => rounded(root.scale[axis] / baseScale[axis]));
      if (elevation) spec.y = rounded(root.position.y);
    }
  };
}

export function rounded(value) {
  return Number(value.toFixed(4));
}

export function limitScale(entry) {
  for (const axis of ['x', 'y', 'z']) {
    const base = entry.baseScale[axis];
    entry.root.scale[axis] = entry.surface && axis === 'y'
      ? base : THREE.MathUtils.clamp(entry.root.scale[axis], base * scaleMin, base * scaleMax);
  }
}

// Apply the same oriented opening to ground surfaces and the swimming check.
export function createPoolOpening(pool, root) {
  const worldToPool = new THREE.Matrix4();
  const halfSize = new THREE.Vector2(pool.width / 2, pool.depth / 2);
  const enabled = { value: true };
  const materials = new Map();
  function sync() {
    root.updateWorldMatrix(true, false);
    worldToPool.copy(root.matrixWorld).invert();
  }
  sync();
  return {
    sync,
    setEnabled(value) { enabled.value = value; },
    local(position, target) { return target.copy(position).applyMatrix4(worldToPool); },
    terrain(material) {
      if (materials.has(material)) return materials.get(material);
      const clipped = material.clone();
      clipped.onBeforeCompile = (shader) => {
        shader.uniforms.campusPoolInverse = { value: worldToPool };
        shader.uniforms.campusPoolHalfSize = { value: halfSize };
        shader.uniforms.campusPoolEnabled = enabled;
        shader.vertexShader = `uniform mat4 campusPoolInverse;
          varying vec2 campusPoolXZ;
          ${shader.vertexShader.replace('#include <project_vertex>', `
            vec4 poolVertex = vec4(transformed, 1.0);
            #ifdef USE_INSTANCING
              poolVertex = instanceMatrix * poolVertex;
            #endif
            campusPoolXZ = (campusPoolInverse * modelMatrix * poolVertex).xz;
            #include <project_vertex>`)}`;
        shader.fragmentShader = `uniform vec2 campusPoolHalfSize;
          uniform bool campusPoolEnabled;
          varying vec2 campusPoolXZ;
          ${shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
            #include <clipping_planes_fragment>
            if (campusPoolEnabled && all(lessThan(abs(campusPoolXZ), campusPoolHalfSize))) discard;`)}`;
      };
      materials.set(material, clipped);
      return clipped;
    },
    syncMaterials() {
      for (const [source, target] of materials) {
        target.color.copy(source.color);
        target.roughness = source.roughness;
        if (source.isMeshPhysicalMaterial) {
          target.clearcoat = source.clearcoat;
          target.specularIntensity = source.specularIntensity;
        }
      }
    }
  };
}

export function movePoolDependencies(map, previous, current, portal) {
  const relative = new THREE.Matrix4().copy(current).multiply(previous.clone().invert());
  function move(point) {
    return xz.fromArray(point).applyMatrix4(relative).toArray();
  }
  portal.position.fromArray(move(portal.position.toArray()));
  map.pool.ring = portal.position.toArray();
  const stop = map.stops.find(({ key }) => key === '4');
  if (stop) {
    stop.position = move(stop.position);
    stop.position[1] = map.coordinateSystem.eyeHeight;
    stop.lookAt = move(stop.lookAt);
  }
  const area = map.areas.find(({ stop: key }) => key === '4');
  if (area) {
    const { width, depth } = map.pool;
    const extent = new THREE.Box3(
      new THREE.Vector3(-width / 2 - 3.5, 0, -depth / 2 - 3.5),
      new THREE.Vector3(width / 2 + 3.5, 0, depth / 2 + 4)
    ).applyMatrix4(current);
    Object.assign(area, { minX: rounded(extent.min.x), maxX: rounded(extent.max.x), minZ: rounded(extent.min.z), maxZ: rounded(extent.max.z) });
  }
}

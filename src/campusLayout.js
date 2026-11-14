import * as THREE from 'three';

const scaleMin = 0.1;
const scaleMax = 20;
const xz = new THREE.Vector3();

export function readCampusLayout(source) {
  // A changed source file starts a new layout, even in a tab with earlier edits.
  let hash = 2166136261;
  for (let i = 0; i < source.length; i++) hash = Math.imul(hash ^ source.charCodeAt(i), 16777619);
  const key = `stamford-layout-v1-${hash >>> 0}`;
  let map = JSON.parse(source);
  try {
    const saved = sessionStorage.getItem(key);
    if (saved) map = JSON.parse(saved);
  } catch {
    // A fresh map is usable without session storage.
  }
  return { map, save() {
    try {
      sessionStorage.setItem(key, JSON.stringify(map));
    } catch {
      // JSON export still works when session storage is unavailable.
    }
  } };
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
  const materials = new Map();
  function sync() {
    root.updateWorldMatrix(true, false);
    worldToPool.copy(root.matrixWorld).invert();
  }
  sync();
  return {
    sync,
    local(position, target) { return target.copy(position).applyMatrix4(worldToPool); },
    terrain(material) {
      if (materials.has(material)) return materials.get(material);
      const clipped = material.clone();
      clipped.onBeforeCompile = (shader) => {
        shader.uniforms.campusPoolInverse = { value: worldToPool };
        shader.uniforms.campusPoolHalfSize = { value: halfSize };
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
          varying vec2 campusPoolXZ;
          ${shader.fragmentShader.replace('#include <clipping_planes_fragment>', `
            #include <clipping_planes_fragment>
            if (all(lessThan(abs(campusPoolXZ), campusPoolHalfSize))) discard;`)}`;
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

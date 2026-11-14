import * as THREE from 'three';

export const unitBox = new THREE.BoxGeometry(1, 1, 1);
export const unitPlane = new THREE.PlaneGeometry(1, 1);
const unitCylinder = new THREE.CylinderGeometry(1, 1, 1, 10);
const up = new THREE.Vector3(0, 1, 0);

export function seededRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 4294967296;
  };
}

export function canvasTexture(width, height, paint) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  paint(canvas.getContext('2d'), width, height);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 4;
  return texture;
}

export function part(parent, geometry, material, position, scale = [1, 1, 1]) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.set(...position);
  mesh.scale.set(...scale);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

export function box(parent, material, size, position) {
  return part(parent, unitBox, material, position, size);
}

export function cylinder(parent, material, radius, height, position) {
  return part(parent, unitCylinder, material, position, [radius, height, radius]);
}

export function rod(parent, material, from, to, radius) {
  const axis = new THREE.Vector3().fromArray(to).sub(new THREE.Vector3().fromArray(from));
  const mesh = cylinder(parent, material, radius, axis.length(), from);
  mesh.position.addScaledVector(axis, 0.5);
  mesh.quaternion.setFromUnitVectors(up, axis.normalize());
  return mesh;
}

export function groupAt(parent, name, position, yaw = 0) {
  const group = new THREE.Group();
  group.name = name;
  group.position.set(...position);
  group.rotation.y = yaw;
  parent.add(group);
  return group;
}

// Keep batches within an editable object or a spatial cell so offscreen batches can be culled.
export function batchStaticMeshes(root) {
  root.updateWorldMatrix(true, true);
  const targets = new Map();
  const position = new THREE.Vector3();
  function collect(node, owner) {
    if (node.userData.layoutId) owner = node;
    if (node.isMesh && !node.isInstancedMesh && !Array.isArray(node.material) && !node.material.transparent) {
      const target = owner ?? root;
      if (!targets.has(target)) targets.set(target, new Map());
      const batches = targets.get(target);
      position.setFromMatrixPosition(node.matrixWorld);
      const cell = owner ? '' : `/${Math.floor(position.x / 24)}/${Math.floor(position.y / 24)}/${Math.floor(position.z / 24)}`;
      const key = [node.geometry.id, node.material.id, node.castShadow, node.receiveShadow, Boolean(node.userData.grade)].join('/') + cell;
      if (!batches.has(key)) batches.set(key, []);
      batches.get(key).push(node);
    }
    for (const child of node.children) collect(child, owner);
  }
  collect(root);
  const local = new THREE.Matrix4();
  for (const [target, batches] of targets) {
    const targetInverse = target.matrixWorld.clone().invert();
    for (const meshes of batches.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.userData.grade = first.userData.grade;
      for (const [index, mesh] of meshes.entries()) {
        batch.setMatrixAt(index, local.multiplyMatrices(targetInverse, mesh.matrixWorld));
        mesh.removeFromParent();
      }
      batch.computeBoundingSphere();
      batch.computeBoundingBox();
      batch.matrixAutoUpdate = false;
      target.add(batch);
    }
  }

  root.traverse((node) => {
    if (node === root || node.userData.layoutId) return;
    node.updateMatrix();
    node.matrixAutoUpdate = false;
  });
}

export function cameraFrustum(camera, frustum, projectionView) {
  camera.updateMatrixWorld();
  projectionView.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  return frustum.setFromProjectionMatrix(projectionView);
}

export function createSceneryBatches(scene, entries) {
  const scenery = groupAt(scene, 'Walking view scenery batches', [0, 0, 0]);
  const matrix = new THREE.Matrix4();
  const world = new THREE.Matrix4();
  let stale = true;
  function rebuild() {
    const batches = new Map();
    const position = new THREE.Vector3();
    for (const { root, elevation, buildingId } of entries.values()) {
      if (elevation || buildingId) continue;
      root.updateWorldMatrix(true, true);
      position.setFromMatrixPosition(root.matrixWorld);
      const cell = `${Math.floor((position.x + 22) / 44)}/${Math.floor((position.z + 22) / 44)}`;
      root.traverse((mesh) => {
        if (!mesh.isMesh || mesh.userData.grade || mesh.material.transparent || Array.isArray(mesh.material)) return;
        mesh.visible = true;
        const key = [mesh.geometry.id, mesh.material.id, mesh.castShadow, mesh.receiveShadow, cell].join('/');
        if (!batches.has(key)) batches.set(key, []);
        batches.get(key).push(mesh);
      });
    }
    for (const batch of scenery.children) batch.dispose();
    scenery.clear();
    for (const meshes of batches.values()) {
      if (meshes.length < 2) continue;
      const first = meshes[0];
      const count = meshes.reduce((total, mesh) => total + (mesh.isInstancedMesh ? mesh.count : 1), 0);
      const batch = new THREE.InstancedMesh(first.geometry, first.material, count);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      batch.matrixAutoUpdate = false;
      batch.userData.sources = meshes;
      let index = 0;
      for (const mesh of meshes) {
        if (mesh.isInstancedMesh) {
          for (let i = 0; i < mesh.count; i++) {
            mesh.getMatrixAt(i, matrix);
            batch.setMatrixAt(index++, world.multiplyMatrices(mesh.matrixWorld, matrix));
          }
        } else {
          batch.setMatrixAt(index++, mesh.matrixWorld);
        }
      }
      batch.computeBoundingSphere();
      scenery.add(batch);
    }
    stale = false;
  }
  return {
    invalidate() { stale = true; },
    setEditing(editing) {
      if (!editing && stale) rebuild();
      scenery.visible = !editing;
      for (const batch of scenery.children) {
        for (const mesh of batch.userData.sources) mesh.visible = editing;
      }
    }
  };
}

let glowMap;
export function glowSprite(color, size, opacity) {
  glowMap ??= canvasTexture(128, 128, (context, width) => {
    const gradient = context.createRadialGradient(width / 2, width / 2, 0, width / 2, width / 2, width / 2);
    gradient.addColorStop(0, 'rgba(255,255,255,1)');
    gradient.addColorStop(0.23, 'rgba(255,255,255,.56)');
    gradient.addColorStop(0.55, 'rgba(255,255,255,.12)');
    gradient.addColorStop(1, 'rgba(255,255,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, width);
  });
  const sprite = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowMap, color, opacity, transparent: true, blending: THREE.AdditiveBlending,
    depthWrite: false, toneMapped: false
  }));
  sprite.scale.set(size, size, 1);
  return sprite;
}

export function createPortal(parent, { name, position, tilt = 0, radius = 1.52 }) {
  const root = groupAt(parent, name, position);
  const aperture = groupAt(root, 'Portal aperture', [0, 0, 0]);
  aperture.rotation.x = tilt;
  const housing = new THREE.MeshStandardMaterial({ color: 0x173275, metalness: 0.58, roughness: 0.31 });
  const lit = new THREE.MeshStandardMaterial({
    color: 0x127eff, emissive: 0x164fff, emissiveIntensity: 3.4, metalness: 0.36, roughness: 0.25
  });
  const core = new THREE.MeshBasicMaterial({ color: 0x82fbff, toneMapped: false });
  part(aperture, new THREE.TorusGeometry(radius + 0.10, 0.16, 12, 72), housing, [0, 0, 0]);
  part(aperture, new THREE.TorusGeometry(radius, 0.105, 12, 72), lit, [0, 0, 0.04]);
  part(aperture, new THREE.TorusGeometry(radius - 0.135, 0.024, 8, 72), core, [0, 0, 0.095]);

  const glyphs = groupAt(aperture, 'Rotating aperture marks', [0, 0, 0.06]);
  for (let index = 0; index < 24; index++) {
    const angle = index * Math.PI / 12;
    const track = radius + 0.39;
    const tick = box(glyphs, core, [index % 6 === 0 ? 0.21 : 0.08, 0.028, 0.025],
      [Math.cos(angle) * track, Math.sin(angle) * track, 0]);
    tick.rotation.z = angle;
  }
  batchStaticMeshes(glyphs);

  const fieldMap = canvasTexture(256, 256, (context, width) => {
    const center = width / 2;
    const gradient = context.createRadialGradient(center, center, 0, center, center, center);
    gradient.addColorStop(0, 'rgba(99,232,255,.19)');
    gradient.addColorStop(0.49, 'rgba(44,135,255,.10)');
    gradient.addColorStop(0.65, 'rgba(42,195,255,.64)');
    gradient.addColorStop(0.84, 'rgba(40,127,255,.08)');
    gradient.addColorStop(1, 'rgba(40,127,255,0)');
    context.fillStyle = gradient;
    context.fillRect(0, 0, width, width);
  });
  const field = part(aperture, unitPlane, new THREE.MeshBasicMaterial({
    map: fieldMap, opacity: 0.9, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false
  }), [0, 0, 0.12], [radius * 3.03, radius * 3.03, 1]);
  field.castShadow = false;
  const light = new THREE.PointLight(0x39cbff, 25, 12, 2);
  light.position.z = 0.55;
  aperture.add(light);

  return {
    root, position: root.position,
    update(time) {
      const pulse = 0.5 + 0.5 * Math.sin(3.1 * time);
      lit.emissiveIntensity = 2.7 + 1.8 * pulse;
      light.intensity = 20 + 15 * pulse;
      field.material.opacity = 0.66 + pulse * 0.3;
      glyphs.rotation.z = -time * 0.23;
    }
  };
}

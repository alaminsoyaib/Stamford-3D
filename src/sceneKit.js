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

// Batch repeated static parts within each zone while retaining landmark and animated hierarchies.
export function batchStaticMeshes(root) {
  root.updateWorldMatrix(true, true);
  const landmarkRoots = [];
  root.traverse((obj) => {
    if (obj !== root && obj.userData?.isLandmark) landmarkRoots.push(obj);
  });

  function batchTarget(target, predicate) {
    target.updateWorldMatrix(true, true);
    const byAppearance = new Map();
    target.traverse((mesh) => {
      if (!mesh.isMesh || mesh.isInstancedMesh || Array.isArray(mesh.material) || mesh.material.transparent) return;
      if (predicate && !predicate(mesh)) return;
      const key = [mesh.geometry.id, mesh.material.id, mesh.castShadow, mesh.receiveShadow].join('/');
      if (!byAppearance.has(key)) byAppearance.set(key, []);
      byAppearance.get(key).push(mesh);
    });
    const targetInverse = target.matrixWorld.clone().invert();
    const local = new THREE.Matrix4();
    for (const meshes of byAppearance.values()) {
      if (meshes.length < 3) continue;
      const first = meshes[0];
      const batch = new THREE.InstancedMesh(first.geometry, first.material, meshes.length);
      batch.castShadow = first.castShadow;
      batch.receiveShadow = first.receiveShadow;
      for (const [index, mesh] of meshes.entries()) {
        batch.setMatrixAt(index, local.multiplyMatrices(targetInverse, mesh.matrixWorld));
        mesh.removeFromParent();
      }
      batch.computeBoundingSphere();
      target.add(batch);
    }
  }

  for (const landmark of landmarkRoots) {
    batchTarget(landmark);
  }

  batchTarget(root, (mesh) => {
    let cur = mesh.parent;
    while (cur && cur !== root) {
      if (cur.userData?.isLandmark) return false;
      cur = cur.parent;
    }
    return true;
  });
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
  root.rotation.x = tilt;
  const housing = new THREE.MeshStandardMaterial({ color: 0x173275, metalness: 0.58, roughness: 0.31 });
  const lit = new THREE.MeshStandardMaterial({
    color: 0x127eff, emissive: 0x164fff, emissiveIntensity: 3.4, metalness: 0.36, roughness: 0.25
  });
  const core = new THREE.MeshBasicMaterial({ color: 0x82fbff, toneMapped: false });
  part(root, new THREE.TorusGeometry(radius + 0.10, 0.16, 12, 72), housing, [0, 0, 0]);
  part(root, new THREE.TorusGeometry(radius, 0.105, 12, 72), lit, [0, 0, 0.04]);
  part(root, new THREE.TorusGeometry(radius - 0.135, 0.024, 8, 72), core, [0, 0, 0.095]);

  const glyphs = groupAt(root, 'Rotating aperture marks', [0, 0, 0.06]);
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
  const field = part(root, unitPlane, new THREE.MeshBasicMaterial({
    map: fieldMap, opacity: 0.9, transparent: true, depthWrite: false, side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending, toneMapped: false
  }), [0, 0, 0.12], [radius * 3.03, radius * 3.03, 1]);
  field.castShadow = false;
  const light = new THREE.PointLight(0x39cbff, 25, 12, 2);
  light.position.z = 0.55;
  root.add(light);

  return {
    position: root.position,
    update(time) {
      const pulse = 0.5 + 0.5 * Math.sin(3.1 * time);
      lit.emissiveIntensity = 2.7 + 1.8 * pulse;
      light.intensity = 20 + 15 * pulse;
      field.material.opacity = 0.66 + pulse * 0.3;
      glyphs.rotation.z = -time * 0.23;
    }
  };
}

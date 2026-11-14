import * as THREE from 'three';
import { addLocalCollider, floor, sign, standard } from './buildingFactory.js';
import { batchStaticMeshes, box, createPortal, cylinder, groupAt, part, rod } from './sceneKit.js';

const roofGeometry = new THREE.ConeGeometry(1, 1, 4);
roofGeometry.rotateY(Math.PI / 4);
const parasolGeometry = new THREE.ConeGeometry(1, 0.47, 9, 1);

function buildGroundDetails(parent, kit) {
  const { ground } = kit.map;
  const m = kit.materials;
  const lawn = groupAt(parent, 'Central lawn', [ground.x, 0, ground.z]);
  kit.layout.add('ground', lawn, ground, { surface: true });
  floor(lawn, m.field, 0, 0, ground.width, ground.depth, 0.022, 2.4);
  const court = kit.prop(parent, 'court', 'Sports court', -1.9, -35.8, 0, { surface: true });
  const courtX = 0;
  const courtZ = 0;
  const courtW = 14;
  const courtD = 20;
  floor(court, standard('#8b9a7d', { map: m.paving.map }), courtX, courtZ, courtW + 0.72, courtD + 0.7, 0.035, 5);
  floor(court, standard('#698b7c'), courtX, courtZ, courtW, courtD, 0.039);
  const markings = standard('#e0d8b7');
  const courtMark = (size, position) => {
    const mesh = box(court, markings, size, position);
    mesh.userData.grade = true;
    mesh.castShadow = false;
    return mesh;
  };
  for (const edge of [-1, 1]) {
    courtMark([0.075, 0.006, courtD], [courtX + edge * courtW / 2, 0.046, courtZ]);
    courtMark([courtW, 0.006, 0.075], [courtX, 0.046, courtZ + edge * courtD / 2]);
    floor(court, standard('#8eaa9b'), courtX, courtZ + edge * 7.3, 4.4, 5.24, 0.042);
    for (const side of [-1, 1]) {
      courtMark([0.064, 0.007, 5.18], [courtX + side * 2.2, 0.049, courtZ + edge * 7.38]);
    }
    courtMark([4.4, 0.007, 0.065], [courtX, 0.049, courtZ + edge * 4.79]);
  }
  courtMark([courtW, 0.006, 0.075], [courtX, 0.046, courtZ]);
  const circle = part(court, new THREE.TorusGeometry(1.68, 0.029, 5, 64), markings, [courtX, 0.044, courtZ]);
  circle.rotation.x = -Math.PI / 2;
  circle.castShadow = false;
  circle.userData.grade = true;

  const shelter = kit.prop(parent, 'shelter', 'Field shelter', -15.2, -43.4, Math.PI / 2);
  box(shelter, m.concrete, [5.9, 0.12, 4.1], [0, 0.06, 0]);
  part(shelter, roofGeometry, m.cafe, [0, 3.03, 0], [4.76, 1.13, 3.38]);
  for (const x of [-2.63, 2.63]) {
    for (const z of [-1.69, 1.69]) {
      box(shelter, m.blue, [0.12, 2.62, 0.12], [x, 1.36, z]);
      addLocalCollider(kit.colliders, shelter, x, z, 0.16, 0.16);
    }
    box(shelter, m.wood, [0.36, 0.12, 2.4], [x * 0.88, 0.48, 0]);
  }
  kit.bench(parent, 14, -31.1, -Math.PI / 2);
  kit.bench(parent, 14, -36.5, -Math.PI / 2);
  kit.bench(parent, 1.9, -51.3);
  const banyan = kit.tree(parent, -14.6, -29.9, 1.08, 'banyan', 792);
  cylinder(banyan, m.concrete, 1.76, 0.23, [0, 0.116, 0]);
  cylinder(banyan, m.soil, 1.62, 0.08, [0, 0.245, 0]);
  addLocalCollider(kit.colliders, banyan, 0, 0, 2.9, 2.9);
  for (const [x, z, size, type] of [
    [13.4, -22, 1.06, 'palm'], [14, -48.9, 1.02, 'palm'], [-15.6, -49.6, 0.88, 'shade'],
    [-17.6, -37.8, 0.83, 'palm'], [0.4, -49.6, 0.8, 'palm'], [-18.7, -57, 1.1, 'shade']
  ]) kit.tree(parent, x, z, size, type, Math.floor(x * 17 - z * 113));
  for (const [x, z] of [[-15, -51.5], [13.7, -40.4], [13.8, -27.4], [-12.4, -23.1]]) {
    kit.planter(parent, x, z, 0.32, -z * 328);
  }
}

function buildCanteen(parent, kit) {
  const m = kit.materials;
  kit.building(parent, 'canteen', 'cafe', {
    title: 'THE STAMFORD CAFÉ', subtitle: 'CAMPUS CANTEEN', signWidth: 8.3,
    doors: [{ x: -0.83, title: 'Canteen Entrance', width: 2.02, signWidth: 2.49, glass: true }],
    windows: [{ x: -4.64, width: 2.51, height: 1.31, counter: true }, { x: 3.93, width: 3.05, height: 1.28, counter: true }],
    details({ root, width, facade }) {
      const stripes = Math.floor((width - 1.6) / 0.445);
      for (let stripe = 0; stripe < stripes; stripe++) {
        const cloth = box(root, stripe % 3 ? m.cafe : m.white, [0.452, 0.08, 1.48],
          [(stripe - (stripes - 1) / 2) * 0.445, 2.8, facade + 0.62]);
        cloth.rotation.x = 0.19;
      }
    }
  });
  for (const [x, z] of [[-12.7, -50.25], [-8.45, -50.6]]) {
    const patio = kit.prop(parent, 'umbrella', 'Café umbrella and table', x, z);
    cylinder(patio, m.steel, 0.044, 2.4, [0, 1.2, 0]);
    part(patio, parasolGeometry, m.cafe, [0, 2.44, 0], [1.42, 1, 1.42]);
    cylinder(patio, m.wood, 0.67, 0.086, [0, 0.76, 0]);
    for (const dx of [-0.81, 0.81]) cylinder(patio, m.concrete, 0.22, 0.42, [dx, 0.21, 0]);
    addLocalCollider(kit.colliders, patio, 0, 0, 1.34, 1.34);
  }
}

function poolWater(scene, pool) {
  const geometry = new THREE.PlaneGeometry(pool.width, pool.depth, 26, 42);
  geometry.computeBoundingSphere();
  geometry.boundingSphere.radius += 0.08;
  const timeUniform = { value: 0 };
  const dayUniform = { value: 1 };
  const vertex = (wave) => `
    varying vec3 vWorld;
    uniform float uTime;
    void main() {
      vec3 p = position;
      ${wave ? 'p.z = .048 * sin(1.65 * p.x + 1.7 * uTime) + .032 * cos(-1.9 * p.y - 1.31 * uTime);' : ''}
      vWorld = (modelMatrix * vec4(p, 1.0)).xyz;
      gl_Position = projectionMatrix * viewMatrix * vec4(vWorld, 1.0);
    }`;
  const rippleFunctions = `
    uniform float uTime;
    uniform float uDay;
    varying vec3 vWorld;
    float ripple(vec2 p) {
      float a = sin(p.x * 2.6 + sin(p.y * 1.8 + uTime * 1.21) * 1.4 + uTime * 1.62);
      float b = cos(p.y * 3.7 - sin(p.x * 1.5 - uTime * .8) * 2.0 - uTime * 1.28);
      return pow(1.0 - abs(a * .65 + b * .35), 14.0);
    }`;
  const surface = new THREE.Mesh(geometry, new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform, uDay: dayUniform },
    vertexShader: vertex(true),
    fragmentShader: `${rippleFunctions}
      void main() {
        vec3 toEye = normalize(cameraPosition - vWorld);
        vec3 normal = normalize(vec3(-.12 * cos(vWorld.x * 1.65 + uTime * 1.7), 1.0, .11 * sin(vWorld.z * 1.9 - uTime)));
        float fresnel = pow(1.0 - abs(dot(toEye, normal)), 2.5);
        float glint = ripple(vWorld.xz);
        vec3 blue = mix(vec3(.018,.075,.145), vec3(.041,.46,.52), uDay);
        vec3 bright = mix(vec3(.07,.39,.65), vec3(.58,.89,.83), uDay);
        gl_FragColor = vec4(mix(blue, bright, min(.82, fresnel * .65 + glint * .36)), .21 + fresnel * .52 + glint * .11);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, side: THREE.DoubleSide
  }));
  surface.position.y = pool.waterY;
  surface.userData.skipPick = true;
  surface.rotation.x = -Math.PI / 2;
  surface.renderOrder = 3;
  scene.add(surface);

  const caustics = new THREE.Mesh(new THREE.PlaneGeometry(pool.width, pool.depth), new THREE.ShaderMaterial({
    uniforms: { uTime: timeUniform, uDay: dayUniform },
    vertexShader: vertex(false),
    fragmentShader: `${rippleFunctions}
      void main() {
        float light = ripple(vWorld.xz * 1.3) + .42 * ripple(vWorld.zx * .94);
        gl_FragColor = vec4(.31, .89, .84, light * (.12 + uDay * .32));
        #include <colorspace_fragment>
      }`,
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending
  }));
  caustics.position.y = pool.bottomY + 0.016;
  caustics.userData.skipPick = true;
  caustics.rotation.x = -Math.PI / 2;
  scene.add(caustics);
  return (time, daylight) => {
    timeUniform.value = time;
    dayUniform.value = daylight;
    // The vertex shader evaluates h(x,z,t) = .048 sin(1.65x + 1.7t) + .032 cos(1.9z - 1.31t).
  };
}

function buildPoolBasin(parent, kit) {
  const { pool } = kit.map;
  const { width, depth, bottomY } = pool;
  const x = 0;
  const z = 0;
  const m = kit.materials;
  const tileTrim = standard('#287b8d');
  const lip = standard('#e5dec0', { map: m.deck.map, roughness: 0.71 });
  floor(parent, m.tile, x, z, width, depth, bottomY, 1.9);
  const deep = -bottomY;
  for (const side of [-1, 1]) {
    const px = x + side * width / 2;
    const pz = z + side * depth / 2;
    box(parent, m.tile, [0.15, deep, depth], [px + side * 0.075, bottomY / 2, z]);
    box(parent, m.tile, [width + 0.3, deep, 0.15], [x, bottomY / 2, pz + side * 0.075]);
    box(parent, lip, [0.36, 0.16, depth + 0.39], [px + side * 0.18, 0.046, z]);
    box(parent, lip, [width + 0.36, 0.16, 0.34], [x, 0.046, pz + side * 0.17]);
    floor(parent, m.deck, px + side * 1.66, z, 3.32, depth + 6.1, 0.021, 2.05);
    floor(parent, m.deck, x, pz + side * 1.525, width, 3.05, 0.021, 2.05);
  }
  for (const offset of [-3.94, 0, 3.94]) floor(parent, tileTrim, x + offset, z, 0.11, depth - 1.8, bottomY + 0.007);
  for (let step = 0; step < 5; step++) {
    const top = -0.28 - step * 0.37;
    const pz = z + depth / 2 - (step + 0.5) * 0.52;
    box(parent, m.tile, [3.63, top - bottomY, 0.52], [x, (bottomY + top) / 2, pz]);
    box(parent, lip, [3.65, 0.045, 0.075], [x, top + 0.017, pz - 0.225]);
  }
  const ladderX = x - width / 2 + 0.59;
  const ladderZ = z - depth / 2 + 2.6;
  for (const pz of [ladderZ - 0.36, ladderZ + 0.36]) {
    const metal = m.steel;
    rod(parent, metal, [ladderX, -2.14, pz], [ladderX, 0.59, pz], 0.038);
    rod(parent, metal, [ladderX, 0.59, pz], [ladderX - 0.84, 0.59, pz], 0.038);
    rod(parent, metal, [ladderX - 0.84, 0.59, pz], [ladderX - 0.84, 0, pz], 0.038);
  }
  for (let rung = 0; rung < 6; rung++) {
    const y = -1.99 + rung * 0.39;
    rod(parent, m.steel, [ladderX, y, ladderZ - 0.36], [ladderX, y, ladderZ + 0.36], 0.029);
  }
}

function buildPoolSurroundings(parent, kit) {
  const m = kit.materials;
  kit.building(parent, 'poolHouse', 'pool', {
    doors: [{ x: -2.23, title: 'Pool House', width: 1.38, material: m.blue }],
    windows: [{ x: 0.71, width: 2.41, height: 1.01 }],
    details({ root, width, face }) {
      const slats = Math.floor((width - 0.3) / 0.276);
      for (let slat = 0; slat < slats; slat++) {
        const px = (slat - (slats - 1) / 2) * 0.276;
        box(root, m.blue, [0.045, 2.75, 0.049], [px, 1.41, face + 0.026]);
      }
    }
  });
  const gate = kit.prop(parent, 'pool-gate', 'Swimming pool gate', 10.5, -54.85);
  for (const px of [-3.34, 3.34]) {
    box(gate, m.brick, [0.53, 2.58, 0.58], [px, 1.29, 0]);
    box(gate, m.concrete, [0.68, 0.15, 0.73], [px, 2.59, 0]);
    addLocalCollider(kit.colliders, gate, px, 0, 0.55, 0.61);
  }
  box(gate, m.blue, [7.17, 0.5, 0.2], [0, 2.62, 0]);
  sign(gate, { title: 'SWIMMING POOL', subtitle: 'STAMFORD UNIVERSITY BANGLADESH', width: 6.97, height: 0.45,
    position: [0, 2.62, 0.106], serif: true });
  kit.tree(parent, 1.45, -65.2, 1.22, 'palm', 281);
  kit.tree(parent, 18.5, -66.1, 0.92, 'palm', 386);
  for (const [px, pz, scale, type] of [
    [-9.1, -80.7, 1.2, 'shade'], [2, -80.9, 1.04, 'shade'], [10.1, -83.4, 1.23, 'palm'],
    [16.8, -83.4, 1.1, 'shade'], [32, -81, 1.2, 'shade']
  ]) kit.tree(parent, px, pz, scale, type, Math.round((px - pz) * 113));
  for (const [px, pz] of [[3.05, -63.1], [3.0, -70.25], [3.0, -75.2], [17.82, -77.5], [16.1, -56.9],
    [6.8, -82.3], [13.6, -82.6], [15.1, -82.7]]) {
    kit.planter(parent, px, pz, 0.42, -pz * 43);
  }
}

export function buildGroundPool(scene, kit) {
  const m = kit.materials;
  const zone = groupAt(scene, 'Zone D · Central Ground and Swimming Pool', [0, 0, 0]);
  buildGroundDetails(zone, kit);
  kit.building(zone, 'academic', 'academic', {
    title: 'ACADEMIC BUILDING', subtitle: 'GROUND ELEVATION', signWidth: 7.2,
    doors: [
      { x: -9.67, title: 'Academic Gate 02', width: 2.51, signWidth: 3.36, glass: true },
      { x: -3.46, title: 'Medical Center', subtitle: 'A-118  •  DOCTOR & PARAMEDIC', width: 1.65, signWidth: 2.89, cross: true, signColor: '#713936' },
      { x: 2.05, title: 'Student Welfare', subtitle: 'STUDENT SUPPORT OFFICE', width: 1.68, signWidth: 2.6, glass: true },
      { x: 8.19, title: 'Auditorium', width: 2.13, signWidth: 2.49, glass: true }
    ],
    windows: [{ x: -6.4, width: 1.46 }, { x: -0.56, width: 1.49 }, { x: 5.01, width: 1.65 }, { x: 11.48, width: 1.4 }]
  });
  kit.building(zone, 'civil', 'civil', {
    title: 'CIVIL BUILDING', subtitle: 'DEPARTMENT OF CIVIL ENGINEERING',
    doors: [{ x: 2.13, title: 'Civil Engineering', width: 2.6, glass: true }],
    windows: [{ x: -4.65, width: 2.55 }, { x: 7.2, width: 2.9 }]
  });
  buildCanteen(zone, kit);
  kit.direction(zone, { x: 12.85, z: -50.34, title: 'SWIMMING POOL ↑', subtitle: 'FOLLOW THE NORTH PATH', width: 2.64 });
  const pool = kit.map.pool;
  const poolRoot = groupAt(zone, 'Swimming pool', [pool.x, 0, pool.z]);
  kit.layout.add('pool', poolRoot, pool);
  buildPoolBasin(poolRoot, kit);
  buildPoolSurroundings(zone, kit);
  batchStaticMeshes(zone);

  const updateWater = poolWater(poolRoot, pool);
  const portal = createPortal(scene, { name: 'Doraemon Underwater Portal', position: pool.ring, tilt: -Math.PI / 2 });
  kit.layout.add('pool-portal', portal.root, pool.portalTransform ??= {}, { elevation: true });
  return {
    portal, poolRoot,
    update(time, daylight) {
      updateWater(time, daylight);
      portal.update(time);
    }
  };
}

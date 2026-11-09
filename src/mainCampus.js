import * as THREE from 'three';
import { addLocalCollider, createCampusKit, floor, standard } from './buildingFactory.js';
import { batchStaticMeshes, box, canvasTexture, groupAt, seededRandom } from './sceneKit.js';
import { createRuntime, makeMinimap, movementAxes, setLocation, setProximity, updateCoordinates } from './sceneRuntime.js';
import { buildGateGarden } from './zoneA_GateGarden.js';
import { buildCSEAdmission } from './zoneB_CSEAdmission.js';
import { buildGroundPool } from './zoneC_GroundPool.js';
import { createWeather } from './weatherAndLighting.js';

const playerRadius = 0.29;
const walkingSpeed = 5.15;
const headingNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function buildCampusSite(scene, kit) {
  const { map, materials: m } = kit;
  const bounds = map.boundary;
  const pool = map.pool;
  const poolMinX = pool.x - pool.width / 2;
  const poolMaxX = pool.x + pool.width / 2;
  const poolMinZ = pool.z - pool.depth / 2;
  const poolMaxZ = pool.z + pool.depth / 2;
  const site = groupAt(scene, 'Campus grade, streets and perimeter', [0, 0, 0]);
  function slab(mat, minX, maxX, minZ, maxZ, y, size = 4.4) {
    floor(site, mat, (minX + maxX) / 2, (minZ + maxZ) / 2, maxX - minX, maxZ - minZ, y, size);
  }
  // Leave an actual opening in the grade so the camera can go below the pool surface.
  slab(m.paving, bounds.minX, poolMinX, bounds.minZ, bounds.maxZ, 0);
  slab(m.paving, poolMaxX, bounds.maxX, bounds.minZ, bounds.maxZ, 0);
  slab(m.paving, poolMinX, poolMaxX, bounds.minZ, poolMinZ, 0);
  slab(m.paving, poolMinX, poolMaxX, poolMaxZ, bounds.maxZ, 0);
  slab(m.paving, bounds.minX, bounds.maxX, bounds.maxZ, 35.5, 0);
  slab(m.lane, -145, 145, 35.5, 155, -0.018, 6.3);
  const cityGround = standard('#9eaa8c');
  slab(cityGround, -145, bounds.minX, -165, 35.5, -0.03);
  slab(cityGround, bounds.maxX, 145, -165, 35.5, -0.03);
  slab(cityGround, bounds.minX, bounds.maxX, -165, bounds.minZ, -0.03);
  for (const [index, path] of map.walkways.entries()) {
    floor(site, m.lane, path.x, path.z, path.width, path.depth, 0.006 + index * 0.00043, 5.9);
  }
  floor(site, m.lane, map.gate.x, 33.7, map.gate.opening - 0.1, 3.6, 0.008);
  for (let index = -12; index <= 12; index++) {
    box(site, m.white, [2.9, 0.008, 0.103], [map.gate.x + index * 6, 0.006, 41.5]);
  }
  for (const side of [-1, 1]) {
    const x = map.gate.x + side * (map.gate.opening / 2 + 1.1);
    floor(site, m.deck, x + side * 17.7, 34.65, 35.45, 1.35, 0.014);
  }

  function wall(x, z, length, yaw, street = false) {
    const root = groupAt(site, 'Perimeter wall', [x, 0, z], yaw);
    const height = street ? 2.83 : 2.42;
    box(root, m.library, [length, height, 0.38], [0, height / 2, 0]);
    box(root, m.brick, [length, 0.38, 0.43], [0, 0.19, 0]);
    box(root, m.concrete, [length, 0.15, 0.49], [0, height + 0.065, 0]);
    const bays = Math.ceil(length / 6.8);
    for (let index = 0; index <= bays; index++) {
      const px = (length - 0.36) * (index / bays - 0.5);
      box(root, m.brick, [0.41, height + 0.21, 0.54], [px, (height + 0.21) / 2, 0]);
      box(root, m.concrete, [0.54, 0.12, 0.64], [px, height + 0.19, 0]);
    }
    addLocalCollider(kit.colliders, root, 0, 0, length, 0.55);
  }
  const centerX = (bounds.minX + bounds.maxX) / 2;
  const centerZ = (bounds.minZ + bounds.maxZ) / 2;
  wall(centerX, bounds.minZ, bounds.maxX - bounds.minX, 0);
  wall(bounds.minX, centerZ, bounds.maxZ - bounds.minZ, Math.PI / 2);
  wall(bounds.maxX, centerZ, bounds.maxZ - bounds.minZ, Math.PI / 2);
  const left = map.gate.x - map.gate.opening / 2 - 0.56;
  const right = map.gate.x + map.gate.opening / 2 + 0.56;
  wall((bounds.minX + left) / 2, bounds.maxZ, left - bounds.minX, 0, true);
  wall((right + bounds.maxX) / 2, bounds.maxZ, bounds.maxX - right, 0, true);
  batchStaticMeshes(site);

  // A subdued surrounding skyline frames the campus boundary in the street-level views.
  const city = groupAt(scene, 'Dhaka skyline', [0, 0, 0]);
  const rng = seededRandom(566);
  const towerMap = canvasTexture(256, 256, (ctx, w, h) => {
    ctx.fillStyle = '#dedad1';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 9; row++) {
      for (let col = 0; col < 6; col++) {
        ctx.fillStyle = (row + col) % 3 === 1 ? '#a6b3b4' : '#89999f';
        ctx.fillRect(col * 43 + 5, row * 28.5 + 5, 29, 16);
        ctx.fillStyle = '#c6c4bb';
        ctx.fillRect(col * 43 + 4, row * 28.5 + 20, 32, 4);
      }
    }
  });
  const towerMats = ['#bec9c4', '#ddcdb1', '#afbab9', '#dec0b1'].map((color) => standard(color, { map: towerMap }));
  for (let index = 0; index < 22; index++) {
    const across = index < 10;
    const x = across ? (index - 4.8) * 15.6 : (index % 2 ? -1 : 1) * (58 + rng() * 29);
    const z = across ? -104 - rng() * 25 : 25 - (index - 10) * 10.2;
    const height = 15 + rng() * 24;
    const width = 8 + rng() * 7;
    const mat = towerMats[index % towerMats.length];
    const body = box(city, mat, [width, height, 7.3 + rng() * 6], [x, height / 2, z]);
    body.castShadow = false;
    box(city, m.civil, [width * 0.44, 2.13, 3.42], [x - width * 0.18, height + 1.05, z]).castShadow = false;
  }
  batchStaticMeshes(city);
}

function blocked(x, z, colliders, bounds) {
  if (x < bounds.minX + playerRadius || x > bounds.maxX - playerRadius
      || z < bounds.minZ + playerRadius || z > bounds.streetZ - playerRadius) return true;
  return colliders.some(({ minX, maxX, minZ, maxZ }) =>
    x > minX - playerRadius && x < maxX + playerRadius && z > minZ - playerRadius && z < maxZ + playerRadius);
}

function walkWithCollision(position, dx, dz, colliders, bounds) {
  const steps = Math.max(1, Math.ceil(Math.hypot(dx, dz) / 0.16));
  const stepX = dx / steps;
  const stepZ = dz / steps;
  for (let index = 0; index < steps; index++) {
    // Resolve the axes independently to slide along walls and substep to catch thin gates.
    if (stepX && !blocked(position.x + stepX, position.z, colliders, bounds)) position.x += stepX;
    if (stepZ && !blocked(position.x, position.z + stepZ, colliders, bounds)) position.z += stepZ;
  }
}

export async function startCampus() {
  const response = await fetch(new URL('../CAMPUS_MAP.json', import.meta.url));
  if (!response.ok) throw new Error(`Campus map request failed (${response.status})`);
  const map = await response.json();
  const runtime = createRuntime({ fov: 63, far: 220, shadows: true, resumeLabel: 'Resume walk' });
  const { scene, camera } = runtime;
  const kit = createCampusKit(map);
  buildCampusSite(scene, kit);
  buildGateGarden(scene, kit);
  buildCSEAdmission(scene, kit);
  const ground = buildGroundPool(scene, kit);
  const weather = createWeather(runtime, kit);
  const plotMap = makeMinimap(map);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const checkpoints = [...document.querySelectorAll('.checkpoints button')];
  const bearing = document.getElementById('bearing');
  const eyeHeight = map.coordinateSystem.eyeHeight;
  let lastArea;
  let nextHud = 0;

  function dive() {
    runtime.travel(() => { window.location.href = 'underwater.html'; });
  }

  function updateHud() {
    const { x, z } = camera.position;
    const area = map.areas.find((region) => x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ);
    if (area && area !== lastArea) {
      lastArea = area;
      setLocation(`ZONE ${area.code}`, area.name);
      for (const button of checkpoints) {
        if (button.dataset.action === `Digit${area.stop}`) button.setAttribute('aria-current', 'location');
        else button.removeAttribute('aria-current');
      }
    }
    const direction = runtime.controls.getDirection(forward);
    const heading = (THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)) + 360) % 360;
    const cardinal = headingNames[Math.round(heading / 45) % headingNames.length];
    bearing.textContent = `${cardinal} · ${String(Math.round(heading) % 360).padStart(3, '0')}°`;
    updateCoordinates(camera.position);
    plotMap(camera.position, heading, lastArea?.stop);
    const nearPool = Math.abs(x - map.pool.x) < map.pool.width / 2 + 2
      && Math.abs(z - map.pool.z) < map.pool.depth / 2 + 4;
    setProximity(nearPool ? camera.position.y < map.pool.waterY ? 'Swim toward the glowing ring' : 'Walk down the pool steps or dive' : '');
  }

  function teleport(stop) {
    camera.position.set(stop.position[0], eyeHeight, stop.position[2]);
    camera.lookAt(...stop.lookAt);
    updateHud();
  }

  for (const stop of map.stops) {
    if (blocked(stop.position[0], stop.position[2], kit.colliders, map.boundary)) {
      throw new Error(`Checkpoint ${stop.key} intersects a campus collider`);
    }
  }
  const fromOcean = new URLSearchParams(location.search).get('arrival') === 'pool';
  if (fromOcean) document.body.dataset.briefing = 'compact';
  teleport(map.stops[fromOcean ? 3 : 0]);
  addEventListener('pageshow', (event) => {
    if (event.persisted && camera.position.y < map.pool.waterY) teleport(map.stops[3]);
  });
  const stopActions = Object.fromEntries(map.stops.map((stop) => [`Digit${stop.key}`, () => {
    document.body.dataset.briefing = 'compact';
    teleport(stop);
  }]));
  runtime.ready({ ...weather.actions, ...stopActions, KeyP: dive });

  runtime.loop((dt, time) => {
    if (runtime.active && !runtime.leaving) {
      const [x, z] = movementAxes(runtime);
      if (x || z) {
        runtime.controls.getDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.set(-forward.z, 0, forward.x);
        movement.copy(forward).multiplyScalar(z).addScaledVector(right, x).normalize().multiplyScalar(walkingSpeed * dt);
        walkWithCollision(camera.position, movement.x, movement.z, kit.colliders, map.boundary);
      }
      const pool = map.pool;
      const pos = camera.position;
      const inset = pool.z + pool.depth / 2 - pos.z;
      const inside = Math.abs(pos.x - pool.x) < pool.width / 2 && inset > 0 && inset < pool.depth;
      if (inside) {
        const onSteps = Math.abs(pos.x - pool.x) < 1.82 && inset < 2.6;
        const stepTop = -0.28 - Math.floor(inset / 0.52) * 0.37;
        const target = onSteps ? Math.max(-1.53, stepTop + 0.54) : -1.53;
        pos.y = THREE.MathUtils.damp(pos.y, target, 6.3, dt);
        if (pos.y < pool.waterY && pos.distanceTo(ground.portal.position) <= pool.triggerRadius) dive();
      } else {
        pos.y = eyeHeight;
      }
    }
    ground.update(time, weather.update(dt));
    if (time >= nextHud) {
      updateHud();
      nextHud = time + 0.095;
    }
  });
}

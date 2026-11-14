import * as THREE from 'three';
import { addLocalCollider, createCampusKit, floor, standard } from './buildingFactory.js';
import { createCampusEditor } from './campusEditor.js';
import { renderCampusHero } from './campusHero.js';
import { createPoolOpening, movePoolDependencies, readCampusLayout } from './campusLayout.js';
import { batchStaticMeshes, box, canvasTexture, createSceneryBatches, groupAt, seededRandom } from './sceneKit.js';
import { createRuntime, makeMinimap, movementAxes, setLocation, updateCoordinates } from './sceneRuntime.js';
import { buildGateGarden } from './zoneA_GateGarden.js';
import { buildCSEAdmission } from './zoneB_CSEAdmission.js';
import { buildGroundPool } from './zoneC_GroundPool.js';
import { createWeather } from './weatherAndLighting.js';

const playerRadius = 0.29;
const walkingSpeed = 5.15;
const walkingBoost = 1.65;
const headingNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function buildCampusSite(scene, kit) {
  const { map, materials: m } = kit;
  const bounds = map.boundary;
  const site = groupAt(scene, 'Campus grade, streets and perimeter', [0, 0, 0]);
  function slab(mat, minX, maxX, minZ, maxZ, y, size = 4.4) {
    floor(site, mat, (minX + maxX) / 2, (minZ + maxZ) / 2, maxX - minX, maxZ - minZ, y, size);
  }
  slab(m.paving, bounds.minX, bounds.maxX, bounds.minZ, bounds.maxZ, 0);
  slab(m.paving, bounds.minX, bounds.maxX, bounds.maxZ, 35.5, 0);
  slab(m.lane, -145, 145, 35.5, 155, -0.018, 6.3);
  const cityGround = standard('#9eaa8c');
  slab(cityGround, -145, bounds.minX, -165, 35.5, -0.03);
  slab(cityGround, bounds.maxX, 145, -165, 35.5, -0.03);
  slab(cityGround, bounds.minX, bounds.maxX, -165, bounds.minZ, -0.03);
  for (const [index, path] of map.walkways.entries()) {
    const root = groupAt(site, `Walkway ${index + 1}`, [path.x, 0, path.z]);
    kit.layout.add(`walkway:${index + 1}`, root, path, { surface: true });
    floor(root, m.lane, 0, 0, path.width, path.depth, 0.006 + index * 0.00043, 5.9);
  }
  floor(site, m.lane, map.gate.x, 33.7, map.gate.opening - 0.1, 3.6, 0.008);
  for (let index = -12; index <= 12; index++) {
    box(site, m.white, [2.9, 0.008, 0.103], [map.gate.x + index * 6, 0.006, 41.5]);
  }
  for (const side of [-1, 1]) {
    const x = map.gate.x + side * (map.gate.opening / 2 + 1.1);
    floor(site, m.deck, x + side * 17.7, 34.65, 35.45, 1.35, 0.014);
  }

  function wall(side, x, z, length, yaw, street = false) {
    const root = kit.prop(site, 'wall', `Perimeter wall · ${side}`, x, z, yaw);
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
  wall('North', centerX, bounds.minZ, bounds.maxX - bounds.minX, 0);
  wall('West', bounds.minX, centerZ, bounds.maxZ - bounds.minZ, Math.PI / 2);
  wall('East', bounds.maxX, centerZ, bounds.maxZ - bounds.minZ, Math.PI / 2);
  const left = map.gate.x - map.gate.opening / 2 - 0.56;
  const right = map.gate.x + map.gate.opening / 2 + 0.56;
  wall('Street west', (bounds.minX + left) / 2, bounds.maxZ, left - bounds.minX, 0, true);
  wall('Street east', (right + bounds.maxX) / 2, bounds.maxZ, bounds.maxX - right, 0, true);
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
  const { map, save } = readCampusLayout(await response.text());
  const runtime = createRuntime({ fov: 63, far: 220, shadows: true, shiftStrafe: true, resumeLabel: 'Resume walk' });
  const { scene, camera } = runtime;
  const kit = createCampusKit(map);
  buildCampusSite(scene, kit);
  buildGateGarden(scene, kit);
  buildCSEAdmission(scene, kit);
  if (new URLSearchParams(location.search).get('arrival') !== 'pool') {
    const hero = document.getElementById('campus-hero');
    try {
      renderCampusHero(kit.layout.objects.get('cse').root, hero);
    } catch (error) {
      // The tour can still open if the browser cannot allocate a preview context.
      hero.hidden = true;
      console.warn('The CSE landing preview could not render.', error);
    }
  }
  const ground = buildGroundPool(scene, kit);
  const weather = createWeather(runtime, kit);
  kit.buildAdded(scene);
  kit.applyRemovals();
  const scenery = createSceneryBatches(scene, kit.layout.objects);
  scenery.setEditing(false);
  const pool = map.pool;
  const opening = createPoolOpening(pool, ground.poolRoot);
  scene.traverse((object) => {
    if (!object.userData.grade) return;
    for (let parent = object.parent; parent; parent = parent.parent) {
      if (parent === ground.poolRoot) return;
    }
    object.material = opening.terrain(object.material);
  });
  let plotMap = makeMinimap(map);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const poolLocal = new THREE.Vector3();
  const checkpoints = [...document.querySelectorAll('.checkpoints button')];
  const bearing = document.getElementById('bearing');
  const eyeHeight = map.coordinateSystem.eyeHeight;
  let lastArea;
  let nextHud = 0;

  function dive() {
    const roaming = runtime.active || document.body.dataset.briefing === 'compact';
    runtime.travel(() => {
      window.location.href = roaming ? 'underwater.html?roam=1' : 'underwater.html';
    });
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
  }

  function walkableNear(x, z) {
    const bounds = map.boundary;
    x = THREE.MathUtils.clamp(x, bounds.minX + playerRadius, bounds.maxX - playerRadius);
    z = THREE.MathUtils.clamp(z, bounds.minZ + playerRadius, bounds.streetZ - playerRadius);
    if (!blocked(x, z, kit.colliders, bounds)) return [x, z];
    for (let radius = 1; radius < 160; radius++) {
      for (let index = 0; index < 24; index++) {
        const angle = index * Math.PI / 12;
        const px = x + radius * Math.cos(angle);
        const pz = z + radius * Math.sin(angle);
        if (!blocked(px, pz, kit.colliders, bounds)) return [px, pz];
      }
    }
    return null;
  }

  function teleport(stop) {
    const position = walkableNear(stop.position[0], stop.position[2]);
    if (!position) {
      runtime.announce('This layout blocks the checkpoint. Move objects to clear a path.');
      return;
    }
    camera.position.set(position[0], eyeHeight, position[1]);
    camera.lookAt(...stop.lookAt);
    updateHud();
  }
  const fromOcean = new URLSearchParams(location.search).get('arrival') === 'pool';
  if (fromOcean) document.body.dataset.briefing = 'compact';
  teleport(map.stops[fromOcean ? 3 : 0]);
  addEventListener('pageshow', (event) => {
    if (event.persisted && opening.local(camera.position, poolLocal).y < pool.waterY) teleport(map.stops[3]);
  });

  function saveLayout() {
    opening.sync();
    scenery.invalidate();
    runtime.renderer.shadowMap.needsUpdate = true;
    plotMap = makeMinimap(map);
    save();
  }

  const editor = createCampusEditor(runtime, kit, (entry, before, commit) => {
    if (entry.buildingId) {
      if (commit) saveLayout();
      return;
    }
    kit.layout.write(entry);
    kit.refreshColliders(entry.root);
    if (entry.id === 'pool') {
      opening.sync();
      if (!before.equals(entry.root.matrixWorld)) {
        movePoolDependencies(map, before, entry.root.matrixWorld, ground.portal);
        kit.layout.write(kit.layout.objects.get('pool-portal'));
        editor.refresh('pool-portal');
      }
    }
    if (entry.id === 'pool-portal') pool.ring = ground.portal.position.toArray();
    if (commit) saveLayout();
  }, (editing) => {
    scenery.setEditing(editing);
    if (editing) return;
    const { x, z } = camera.position;
    if (blocked(x, z, kit.colliders, map.boundary)) {
      const safe = walkableNear(x, z);
      if (safe) camera.position.set(safe[0], eyeHeight, safe[1]);
      else runtime.announce('This layout blocks the campus. Open the editor to clear a path.');
    }
    updateHud();
  }, saveLayout);

  const stopActions = Object.fromEntries(map.stops.map((stop) => [`Digit${stop.key}`, () => {
    document.body.dataset.briefing = 'compact';
    teleport(stop);
  }]));
  runtime.ready({ ...weather.actions, ...stopActions, KeyP: dive, KeyO: dive, KeyE: editor.toggle });

  runtime.loop((dt, time, view) => {
    editor.update();
    if (runtime.active && !runtime.leaving) {
      const [x, z] = movementAxes(runtime);
      if (x || z) {
        const boosted = runtime.down('ShiftLeft', 'ShiftRight');
        const speed = boosted ? walkingSpeed * walkingBoost : walkingSpeed;
        runtime.controls.getDirection(forward);
        forward.y = 0;
        forward.normalize();
        right.set(-forward.z, 0, forward.x);
        movement.copy(forward).multiplyScalar(z).addScaledVector(right, x).normalize().multiplyScalar(speed * dt);
        walkWithCollision(camera.position, movement.x, movement.z, kit.colliders, map.boundary);
      }
      const pos = camera.position;
      opening.local(pos, poolLocal);
      const inset = pool.depth / 2 - poolLocal.z;
      const inside = Math.abs(poolLocal.x) < pool.width / 2 && inset > 0 && inset < pool.depth;
      if (inside) {
        const onSteps = Math.abs(poolLocal.x) < 1.82 && inset < 2.6;
        const stepTop = -0.28 - Math.floor(inset / 0.52) * 0.37;
        const scaleY = ground.poolRoot.scale.y;
        const basinDepth = Math.max((pool.bottomY + 0.15) * scaleY,
          Math.min(-1.53 * scaleY, ground.portal.position.y + pool.triggerRadius / 2));
        const target = onSteps ? Math.max(basinDepth, (stepTop + 0.54) * scaleY) : basinDepth;
        pos.y = THREE.MathUtils.damp(pos.y, target, 6.3, dt);
        if (pos.y < pool.waterY * scaleY && pos.distanceTo(ground.portal.position) <= pool.triggerRadius) dive();
      } else {
        pos.y = eyeHeight;
      }
    }
    ground.update(time, weather.update(dt, view, editor.active));
    opening.syncMaterials();
    if (!editor.active && time >= nextHud) {
      updateHud();
      nextHud = time + 0.095;
    }
  });
}

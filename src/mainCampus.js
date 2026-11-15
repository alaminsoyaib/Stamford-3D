import * as THREE from 'three';
import { addLocalCollider, createCampusKit, floor, standard } from './buildingFactory.js';
import { createCampusEditor } from './campusEditor.js';
import { createDroneAudio } from './campusDroneAudio.js';
import { closestOnEdge, insideLand, landExtent, nearestLandEdge } from './campusBoundary.js';
import { renderCampusHero } from './campusHero.js';
import { createPoolOpening, movePoolDependencies, readCampusLayout } from './campusLayout.js';
import { batchStaticMeshes, box, canvasTexture, createSceneryBatches, groupAt, seededRandom } from './sceneKit.js';
import { createRuntime, makeMinimap, setLocation, updateCoordinates } from './sceneRuntime.js';
import { buildGateGarden } from './zoneA_GateGarden.js';
import { createWeather } from './weatherAndLighting.js';
import { buildCSEAdmission } from './zoneB_CSEAdmission.js';
import { buildGroundPool } from './zoneC_GroundPool.js';

const playerRadius = 0.29;
const walkingSpeed = 9.0;
const walkingBoost = 1.9;
const droneCeiling = 80;
const droneClimbSpeed = 12;
const headingNames = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

function buildWall(root, m, length, height) {
  box(root, m.library, [length, height, 0.38], [0, height / 2, 0]);
  box(root, m.brick, [length, 0.38, 0.43], [0, 0.19, 0]);
  box(root, m.concrete, [length, 0.15, 0.49], [0, height + 0.065, 0]);
  const bays = Math.ceil(length / 6.8);
  for (let index = 0; index <= bays; index++) {
    const px = Math.max(0, length - 0.36) * (index / bays - 0.5);
    box(root, m.brick, [0.41, height + 0.21, 0.54], [px, (height + 0.21) / 2, 0]);
    box(root, m.concrete, [0.54, 0.12, 0.64], [px, height + 0.19, 0]);
  }
}

function buildCampusSite(scene, kit) {
  const { map, materials: m } = kit;
  const bounds = map.boundary;
  const site = groupAt(scene, 'Campus grade, streets and perimeter', [0, 0, 0]);
  const legacyGround = groupAt(site, 'Street and surrounding ground', [0, 0, 0]);
  function slab(mat, minX, maxX, minZ, maxZ, y, size = 4.4) {
    floor(legacyGround, mat, (minX + maxX) / 2, (minZ + maxZ) / 2, maxX - minX, maxZ - minZ, y, size);
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
  floor(legacyGround, m.lane, map.gate.x, 33.7, map.gate.opening - 0.1, 3.6, 0.008);
  for (let index = -12; index <= 12; index++) {
    box(legacyGround, m.white, [2.9, 0.008, 0.103], [map.gate.x + index * 6, 0.006, 41.5]);
  }
  for (const side of [-1, 1]) {
    const x = map.gate.x + side * (map.gate.opening / 2 + 1.1);
    floor(legacyGround, m.deck, x + side * 17.7, 34.65, 35.45, 1.35, 0.014);
  }

  batchStaticMeshes(legacyGround);
  for (const { root } of kit.layout.objects.values()) batchStaticMeshes(root);

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
  return { legacyGround, city };
}

function createLandSurface(scene, site, map, opening, materials, kit) {
  const terrain = new THREE.Mesh(new THREE.BufferGeometry(), opening.terrain(materials.paving));
  const surround = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), opening.terrain(standard('#596459')));
  terrain.rotation.x = surround.rotation.x = -Math.PI / 2;
  surround.position.y = -0.045;
  terrain.receiveShadow = surround.receiveShadow = true;
  const perimeter = groupAt(scene, 'Automatic boundary walls', [0, 0, 0]);
  kit.perimeter = perimeter;
  scene.add(surround, terrain);
  let previousCornersJson;
  let previousWallsJson;

  function syncPerimeter() {
    perimeter.traverse((object) => { if (object.isInstancedMesh) object.dispose(); });
    perimeter.clear();
    const walls = map.boundary.walls ??= (map.boundary.points
      ? map.boundary.points.map(([x, z], index) => {
          const [nextX, nextZ] = map.boundary.points[(index + 1) % map.boundary.points.length];
          return { id: `wall-${index + 1}`, a: [x, z], b: [nextX, nextZ] };
        })
      : [
          { id: 'wall-north', a: [map.boundary.minX, map.boundary.minZ], b: [map.boundary.maxX, map.boundary.minZ] },
          { id: 'wall-east', a: [map.boundary.maxX, map.boundary.minZ], b: [map.boundary.maxX, map.boundary.maxZ] },
          { id: 'wall-street-east', a: [map.gate.x + map.gate.opening / 2 + 0.56, map.boundary.maxZ], b: [map.boundary.maxX, map.boundary.maxZ] },
          { id: 'wall-street-west', a: [map.boundary.minX, map.boundary.maxZ], b: [map.gate.x - map.gate.opening / 2 - 0.56, map.boundary.maxZ] },
          { id: 'wall-west', a: [map.boundary.minX, map.boundary.maxZ], b: [map.boundary.minX, map.boundary.minZ] }
        ]);
    if (!walls) return;
    for (const seg of walls) {
      const [x, z] = seg.a;
      const [nextX, nextZ] = seg.b;
      const len = Math.hypot(nextX - x, nextZ - z);
      if (len < 0.1) continue;
      const isStreet = seg.id.includes('street');
      const root = groupAt(perimeter, `Perimeter wall · ${seg.id}`, [(x + nextX) / 2, 0, (z + nextZ) / 2],
        Math.atan2(z - nextZ, nextX - x));
      root.userData.wallSegment = seg;
      root.userData.wallSegmentId = seg.id;
      root.userData.layoutId = `wall:${seg.id}`;
      buildWall(root, materials, len, isStreet ? 2.83 : 2.42);
    }
    batchStaticMeshes(perimeter);
  }
  kit.syncPerimeter = syncPerimeter;
  syncPerimeter();

  return (editing) => {
    site.legacyGround.visible = !map.boundary.points;
    site.city.visible = !editing && !map.boundary.points;
    terrain.visible = surround.visible = Boolean(map.boundary.points);
    const corners = map.boundary.points;
    const currentCornersJson = JSON.stringify(corners);
    const currentWallsJson = JSON.stringify(map.boundary.walls);
    if (previousCornersJson === currentCornersJson && previousWallsJson === currentWallsJson) return;
    previousCornersJson = currentCornersJson;
    previousWallsJson = currentWallsJson;
    syncPerimeter();
    if (!terrain.visible) return;
    const points = corners.map(([x, z]) => new THREE.Vector2(x, -z));
    const geometry = new THREE.ShapeGeometry(new THREE.Shape(points));
    const positions = geometry.attributes.position;
    for (let index = 0; index < positions.count; index++) {
      geometry.attributes.uv.setXY(index, positions.getX(index) / 4.4, positions.getY(index) / 4.4);
    }
    terrain.geometry.dispose();
    terrain.geometry = geometry;
    const { minX, maxX, minZ, maxZ } = landExtent(map.boundary);
    surround.position.x = (minX + maxX) / 2;
    surround.position.z = (minZ + maxZ) / 2;
    surround.scale.set(maxX - minX + 280, maxZ - minZ + 280, 1);
  };
}

function blocked(x, z, colliders, bounds) {
  if (bounds.walls && bounds.walls.length) {
    for (const seg of bounds.walls) {
      const [edgeX, edgeZ] = closestOnEdge(x, z, seg.a, seg.b);
      const distSq = (edgeX - x) ** 2 + (edgeZ - z) ** 2;
      if (distSq < (playerRadius + 0.22) ** 2) return true;
    }
  } else {
    const wallInset = bounds.points ? 0.32 : 0;
    if (!insideLand(bounds, x, z, playerRadius + wallInset, true)) return true;
  }
  const { minX, maxX, minZ, maxZ, streetZ } = landExtent(bounds);
  if (x < minX - 35 || x > maxX + 35 || z < minZ - 35 || z > (streetZ || maxZ) + 40) return true;
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
  const { map, save, saveLayout: persistLayout } = readCampusLayout(await response.text());
  const runtime = createRuntime({ fov: 63, far: 220, shadows: true, shiftStrafe: true, resumeLabel: 'Resume flight' });
  const { scene, camera } = runtime;
  const kit = createCampusKit(map);
  const site = buildCampusSite(scene, kit);
  buildGateGarden(scene, kit);
  await buildCSEAdmission(scene, kit);
  if (new URLSearchParams(location.search).get('arrival') !== 'pool') {
    const hero = document.getElementById('campus-hero');
    if (hero instanceof HTMLCanvasElement) {
      try {
        renderCampusHero(kit.layout.objects.get('cse').root, hero);
      } catch (error) {
        // The tour can still open if the browser cannot allocate a preview context.
        hero.hidden = true;
        console.warn('The CSE landing preview could not render.', error);
      }
    }
  }
  const ground = buildGroundPool(scene, kit);
  const weather = createWeather(runtime, kit);
  kit.buildAdded(scene);
  const scenery = createSceneryBatches(scene, kit.layout.objects);
  const pool = map.pool;
  const opening = createPoolOpening(pool, ground.poolRoot);
  scene.traverse((object) => {
    if (!object.userData.grade) return;
    for (let parent = object.parent; parent; parent = parent.parent) {
      if (parent === ground.poolRoot) return;
    }
    object.material = opening.terrain(object.material);
  });
  kit.applyVisibility();
  scenery.setEditing(false);
  const syncLand = createLandSurface(scene, site, map, opening, kit.materials, kit);
  syncLand(false);
  opening.setEnabled(kit.layout.objects.has('pool'));
  let plotMap = makeMinimap(map);
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();
  const movement = new THREE.Vector3();
  const poolLocal = new THREE.Vector3();
  const checkpoints = [...document.querySelectorAll('.checkpoints button')];
  const poolButton = checkpoints.find((button) => button.dataset.action === 'Digit4');
  const bearing = document.getElementById('bearing');
  const eyeHeight = map.coordinateSystem.eyeHeight;
  const droneAudio = createDroneAudio();
  const muteButton = document.querySelector('[data-action="KeyM"]');
  const droneAltitude = document.getElementById('drone-altitude');
  const obstacleBounds = new THREE.Box3();
  const flightOrigin = new THREE.Vector3();
  document.body.dataset.drone = 'true';
  if (droneAltitude) {
    droneAltitude.hidden = false;
    droneAltitude.value = `Drone · ${eyeHeight.toFixed(1)} m`;
  }
  let obstacleTops = new WeakMap();
  let lastArea;
  let activeStop = null;
  let highlightedStop;
  let nextHud = 0;

  function dive() {
    const roaming = runtime.active || document.body.dataset.briefing === 'compact';
    runtime.travel(() => {
      window.location.href = roaming ? 'underwater.html?roam=1' : 'underwater.html';
    });
  }

  function updateHud() {
    const poolPlaced = kit.layout.objects.has('pool');
    opening.local(camera.position, poolLocal);
    const inset = pool.depth / 2 - poolLocal.z;
    const insidePool = poolPlaced && Math.abs(poolLocal.x) < pool.width / 2 && inset > 0 && inset < pool.depth;
    const scaleY = ground.poolRoot.scale.y;
    const waterY = pool.waterY * scaleY;
    const submerged = insidePool && camera.position.y < waterY;
    droneAltitude.value = submerged
      ? `Underwater Drone · ${(waterY - camera.position.y).toFixed(1)} m depth`
      : `Drone · ${camera.position.y.toFixed(1)} m`;
    const { x, z } = camera.position;
    const area = map.areas.find((region) => (region.stop !== '4' || poolPlaced)
      && x >= region.minX && x <= region.maxX && z >= region.minZ && z <= region.maxZ);
    if (area !== lastArea) {
      lastArea = area;
      setLocation(area ? `ZONE ${area.code}` : 'CAMPUS', area?.name ?? 'Campus grounds');
    }
    const stop = activeStop ?? area?.stop;
    if (stop !== highlightedStop) {
      highlightedStop = stop;
      for (const button of checkpoints) {
        if (button.dataset.action === `Digit${stop}`) button.setAttribute('aria-current', 'location');
        else button.removeAttribute('aria-current');
      }
    }
    const direction = runtime.controls.getDirection(forward);
    const heading = (THREE.MathUtils.radToDeg(Math.atan2(direction.x, -direction.z)) + 360) % 360;
    const cardinal = headingNames[Math.round(heading / 45) % headingNames.length];
    bearing.textContent = `${cardinal} · ${String(Math.round(heading) % 360).padStart(3, '0')}°`;
    updateCoordinates(camera.position);
    plotMap(camera.position, heading, stop);
  }

  function walkableNear(x, z) {
    const bounds = map.boundary;
    const span = landExtent(bounds);
    x = THREE.MathUtils.clamp(x, span.minX + playerRadius, span.maxX - playerRadius);
    z = THREE.MathUtils.clamp(z, span.minZ + playerRadius, span.streetZ - playerRadius);
    if (!blocked(x, z, kit.colliders, bounds)) return [x, z];
    if (bounds.points && !insideLand(bounds, x, z)) [x, z] = nearestLandEdge(bounds.points, x, z);
    const maxRadius = Math.max(12, Math.hypot(span.maxX - span.minX, span.streetZ - span.minZ));
    for (let radius = 0.4; radius < maxRadius; radius += radius < 4 ? 0.4 : 1) {
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
    const currentY = camera.position.y;
    const altitude = currentY > 0 ? currentY : eyeHeight;
    camera.position.set(position[0], altitude, position[1]);
    camera.lookAt(...stop.lookAt);
    activeStop = stop.key;
    updateHud();
  }
  const fromOcean = new URLSearchParams(location.search).get('arrival') === 'pool';
  if (fromOcean) document.body.dataset.briefing = 'compact';
  teleport(map.stops[fromOcean && kit.layout.objects.has('pool') ? 3 : 0]);
  addEventListener('pageshow', (event) => {
    if (event.persisted && opening.local(camera.position, poolLocal).y < pool.waterY) {
      teleport(map.stops[kit.layout.objects.has('pool') ? 3 : 0]);
    }
  });

  function saveLayout() {
    obstacleTops = new WeakMap();
    const poolPlaced = kit.layout.objects.has('pool');
    opening.setEnabled(poolPlaced);
    if (!poolPlaced && activeStop === '4') activeStop = null;
    poolButton.disabled = !poolPlaced;
    opening.sync();
    syncLand(editor.active);
    scenery.invalidate();
    runtime.renderer.shadowMap.needsUpdate = true;
    plotMap = makeMinimap(map);
    save();
  }

  function keepTourOnLand() {
    if (activeStop) {
      teleport(map.stops.find(({ key }) => key === activeStop));
      return;
    }
    const { x, z } = camera.position;
    if (blocked(x, z, kit.colliders, map.boundary)) {
      const safe = walkableNear(x, z);
      if (safe) camera.position.set(safe[0], camera.position.y > 0 ? camera.position.y : eyeHeight, safe[1]);
      else runtime.announce('This layout blocks the campus. Open the editor to clear a path.');
    }
    updateHud();
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
    syncLand(editing);
    scenery.setEditing(editing);
    if (!editing) keepTourOnLand();
  }, saveLayout, persistLayout);

  function toggleMute() {
    const isMuted = droneAudio.toggleMute();
    if (muteButton) {
      muteButton.setAttribute('aria-pressed', String(isMuted));
      muteButton.innerHTML = isMuted ? 'Muted <kbd>M</kbd>' : 'Sound <kbd>M</kbd>';
    }
    runtime.announce(isMuted ? 'Drone sound muted' : 'Drone sound active');
  }

  document.getElementById('start').addEventListener('click', () => {
    if (!droneAudio.muted) droneAudio.start();
  });
  runtime.controls.addEventListener('lock', () => {
    if (!droneAudio.muted) droneAudio.start();
  });

  function obstacleTop({ group }) {
    if (!obstacleTops.has(group)) {
      obstacleTops.set(group, obstacleBounds.setFromObject(group).max.y + playerRadius);
    }
    return obstacleTops.get(group);
  }

  function fly(dt, boosted) {
    if (dt <= 0) return;
    const x = Number(runtime.down('KeyD')) - Number(runtime.down('KeyA'));
    const z = Number(runtime.down('KeyW')) - Number(runtime.down('KeyS'));
    const climb = Number(runtime.down('ArrowUp', 'PointerLeft')) - Number(runtime.down('ArrowDown', 'PointerRight'));
    const speed = boosted ? walkingBoost : 1;
    const pos = camera.position;
    flightOrigin.copy(pos);
    if (x || z || climb) activeStop = null;

    const poolPlaced = kit.layout.objects.has('pool');
    opening.local(pos, poolLocal);
    const inset = pool.depth / 2 - poolLocal.z;
    const insidePool = poolPlaced && Math.abs(poolLocal.x) < pool.width / 2 && inset > 0 && inset < pool.depth;
    const scaleY = ground.poolRoot.scale.y;
    const waterY = pool.waterY * scaleY;
    const floorY = (pool.bottomY + 0.3) * scaleY;
    const minY = insidePool ? floorY : eyeHeight;

    if (climb) {
      const nextY = THREE.MathUtils.clamp(pos.y + climb * droneClimbSpeed * speed * dt, minY, droneCeiling);
      if (climb > 0 || nextY >= eyeHeight || insidePool || !kit.colliders.some((obstacle) =>
        pos.x > obstacle.minX - playerRadius && pos.x < obstacle.maxX + playerRadius
        && pos.z > obstacle.minZ - playerRadius && pos.z < obstacle.maxZ + playerRadius
        && nextY < obstacleTop(obstacle))) {
        pos.y = nextY;
      }
    }
    if (x || z) {
      runtime.controls.getDirection(forward);
      forward.y = 0;
      forward.normalize();
      right.set(-forward.z, 0, forward.x);
      movement.copy(forward).multiplyScalar(z).addScaledVector(right, x).normalize().multiplyScalar(walkingSpeed * speed * dt);
      if (pos.y < 0.2 && insidePool) {
        pos.x += movement.x;
        pos.z += movement.z;
        opening.local(pos, poolLocal);
        const clampInset = THREE.MathUtils.clamp(pool.depth / 2 - poolLocal.z, playerRadius + 0.3, pool.depth - playerRadius - 0.3);
        const clampLocalX = THREE.MathUtils.clamp(poolLocal.x, -pool.width / 2 + playerRadius + 0.3, pool.width / 2 - playerRadius - 0.3);
        poolLocal.x = clampLocalX;
        poolLocal.z = pool.depth / 2 - clampInset;
        pos.copy(poolLocal).applyMatrix4(ground.poolRoot.matrixWorld);
      } else {
        const obstacles = kit.colliders.filter((obstacle) => pos.y < obstacleTop(obstacle));
        walkWithCollision(pos, movement.x, movement.z, obstacles, map.boundary);
      }
    }

    opening.local(pos, poolLocal);
    const currentInset = pool.depth / 2 - poolLocal.z;
    const currentlyInPool = poolPlaced && Math.abs(poolLocal.x) < pool.width / 2 && currentInset > 0 && currentInset < pool.depth;
    const isUnderwater = currentlyInPool && pos.y < waterY;
    if (isUnderwater && pos.distanceTo(ground.portal.position) <= pool.triggerRadius) {
      dive();
    }

    // Use the displacement after collision and altitude limits, in camera-relative axes.
    const displacement = movement.subVectors(pos, flightOrigin);
    const maxStep = walkingSpeed * walkingBoost * dt;
    droneAudio.update(
      document.hasFocus(),
      displacement.dot(right) / maxStep,
      displacement.dot(forward) / maxStep,
      displacement.y / (droneClimbSpeed * walkingBoost * dt),
      isUnderwater
    );
  }

  const stopActions = Object.fromEntries(map.stops.map((stop) => [`Digit${stop.key}`, () => {
    document.body.dataset.briefing = 'compact';
    if (stop.key === '4' && !kit.layout.objects.has('pool')) runtime.announce('Place the swimming pool from the deck to visit it.');
    else teleport(stop);
  }]));

  function exitCampus() {
    if (editor.active) editor.toggle();
    teleport(map.stops[0]);
    runtime.exitToStart(() => {
      if (location.search) history.replaceState(null, '', location.pathname);
    });
  }

  document.getElementById('exit-briefing')?.addEventListener('click', exitCampus);

  runtime.ready({
    ...weather.actions,
    ...stopActions,
    KeyP: dive,
    KeyO: dive,
    KeyE: editor.toggle,
    KeyM: toggleMute,
    KeyX: exitCampus,
    Escape: exitCampus
  });
  poolButton.disabled = !kit.layout.objects.has('pool');
  if (new URLSearchParams(location.search).has('editor')) {
    editor.toggle();
  }

  runtime.loop((dt, time, view) => {
    editor.update();
    const roaming = runtime.active && !runtime.leaving;
    if (roaming) {
      fly(dt, runtime.down('ShiftLeft', 'ShiftRight'));
    } else {
      droneAudio.update(false);
    }
    ground.update(time, weather.update(dt, view, editor.active));
    opening.syncMaterials();
    if (!editor.active && time >= nextHud) {
      updateHud();
      nextHud = time + 0.095;
    }
  });
}

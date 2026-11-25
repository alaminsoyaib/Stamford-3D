import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  PLAYER_RADIUS,
  blockedAt,
  obstacleVerticalSpan,
  poolMinAltitude,
  resolveHorizontalMove,
  resolveVerticalMove
} from '../src/campusCollision.js';
import { addEllipsoidCollider, insideOceanCollider, resolveOceanMove, seafloorHeightAt } from '../src/oceanCollision.js';
import { addPoolBasinColliders } from '../src/zoneC_GroundPool.js';
import { addLocalCollider } from '../src/buildingFactory.js';

const map = JSON.parse(readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8'));
const getRawTop = ({ group, local }) => {
  const m = group.matrixWorld.elements;
  return m[13] + local.top * m[5];
};

test('pool stairs and ladder colliders block underwater clipping and support vertical landing on treads', () => {
  const poolRoot = new THREE.Group();
  poolRoot.position.set(map.pool.x, 0, map.pool.z);
  poolRoot.rotation.y = THREE.MathUtils.degToRad(map.pool.yaw);
  poolRoot.updateMatrixWorld(true);

  const colliders = [];
  addPoolBasinColliders(colliders, poolRoot, map.pool);
  assert.equal(colliders.length, 7, 'expected 5 pool step colliders + 2 ladder colliders');

  const toWorld = (lx, lz) => {
    const v = new THREE.Vector3(lx, 0, lz).applyMatrix4(poolRoot.matrixWorld);
    return [v.x, v.z];
  };

  // Every step blocks underwater drone at y = -2.5 from entering its volume
  for (let step = 0; step < 5; step++) {
    const lz = map.pool.depth / 2 - (step + 0.5) * 0.52;
    const [wx, wz] = toWorld(0, lz);
    assert.equal(blockedAt(wx, wz, -2.5, colliders, map.boundary, getRawTop), true,
      `step ${step} must block horizontal entry underwater`);
  }

  // Attempting to swim horizontally into the bottom-most stair tread pushes outside and stays inside pool bounds
  const startLocalZ = map.pool.depth / 2 - 5 * 0.52 - 1.2;
  const [sx, sz] = toWorld(0, startLocalZ);
  const [targetX, targetZ] = toWorld(0, map.pool.depth / 2 - 2.34);
  const pos = new THREE.Vector3(sx, -2.5, sz);
  const worldToPool = poolRoot.matrixWorld.clone().invert();
  const poolMarginX = PLAYER_RADIUS + 0.15;
  const poolMarginZ = PLAYER_RADIUS + 0.15;
  const tmp = new THREE.Vector3();
  const clampToPool = (wx, wz) => {
    tmp.set(wx, pos.y, wz).applyMatrix4(worldToPool);
    tmp.x = THREE.MathUtils.clamp(tmp.x, -map.pool.width / 2 + poolMarginX, map.pool.width / 2 - poolMarginX);
    tmp.z = THREE.MathUtils.clamp(tmp.z, -map.pool.depth / 2 + poolMarginZ, map.pool.depth / 2 - poolMarginZ);
    tmp.applyMatrix4(poolRoot.matrixWorld);
    return [tmp.x, tmp.z];
  };

  resolveHorizontalMove(pos, targetX - sx, targetZ - sz, colliders, map.boundary, getRawTop, PLAYER_RADIUS, clampToPool);
  assert.equal(blockedAt(pos.x, pos.z, pos.y, colliders, map.boundary, getRawTop), false,
    'drone must slide/stop cleanly outside pool stairs without overlapping');
  tmp.copy(pos).applyMatrix4(worldToPool);
  assert.ok(tmp.z < map.pool.depth / 2 - 5 * 0.52 - PLAYER_RADIUS + 0.05,
    'drone must stay clear in front of step 4');

  // Descending onto step 4's front tread stops on top of step 4 rather than entering inside
  const [step4X, step4Z] = toWorld(0, map.pool.depth / 2 - 4.85 * 0.52);
  const landedY = resolveVerticalMove(step4X, step4Z, -0.2, -2.5, colliders, map.boundary, getRawTop);
  const expectedTreadTop = -0.28 - 4 * 0.37 + 0.04 + PLAYER_RADIUS;
  assert.ok(Math.abs(landedY - expectedTreadTop) < 1e-4, `expected landing on step 4 tread at ${expectedTreadTop}, got ${landedY}`);

  // Underwater portal ring remains completely unblocked by stair colliders
  const [ringX, ringY, ringZ] = map.pool.ring;
  assert.equal(blockedAt(ringX, ringZ, ringY, colliders, map.boundary, getRawTop), false);
});

test('poolMinAltitude blocks descending into pool coping lip on outer rim and vertical flush allows surface gliding', () => {
  assert.equal(poolMinAltitude({
    insidePoolBasin: false, insidePoolRaw: true, currentY: 1.2, floorY: -2.55, lipClearY: 0.49, eyeHeight: 1.7
  }), 0.49, 'outer rim must stop at lipClearY instead of clipping into the tile rim');
  assert.equal(poolMinAltitude({
    insidePoolBasin: true, insidePoolRaw: true, currentY: 1.2, floorY: -2.55, lipClearY: 0.49, eyeHeight: 1.7
  }), -2.55, 'inside basin allows full descent to pool floor');

  // Vertical flush tolerance lets a drone resting at span.top glide horizontally without blockedAt false positives
  const root = new THREE.Group();
  root.updateMatrixWorld(true);
  const colliders = [];
  addLocalCollider(colliders, root, 0, 0, 2, 2, true, 3.0, 0);
  const span = obstacleVerticalSpan(colliders[0], getRawTop, PLAYER_RADIUS);
  assert.equal(blockedAt(0, 0, span.top, colliders, map.boundary, getRawTop), false);
});

test('oceanCollision prevents entering rock ellipsoids and clamps smoothly above seafloor waves', () => {
  const colliders = [];
  addEllipsoidCollider(colliders, [10, -20, -15], [4, 5, 3], Math.PI / 5);

  // Move straight into the rock from X direction
  const pos = { x: 2, y: -20, z: -15 };
  resolveOceanMove(pos, 10, 0, 0, colliders);
  assert.equal(insideOceanCollider(pos.x, pos.y, pos.z, colliders), false,
    'drone must never penetrate rock ellipsoid interior');
  assert.ok(pos.x < 10, 'drone must be stopped on the approach side of the rock');

  // Descend down into the seafloor -> stops cleanly at seafloorHeightAt + OCEAN_DRONE_RADIUS or -120
  const floorPos = { x: 3.5, y: -119, z: -6.2 };
  resolveOceanMove(floorPos, 0, -10, 0, colliders);
  assert.ok(floorPos.y >= Math.max(-120, seafloorHeightAt(floorPos.x, floorPos.z) + 0.45) - 1e-6);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { addLocalCollider } from '../src/buildingFactory.js';
import {
  PERIMETER_WALL_HEIGHT,
  PLAYER_RADIUS,
  STREET_WALL_HEIGHT,
  blockedAt,
  outerWorldBounds,
  resolveHorizontalMove,
  resolveVerticalMove,
  wallTop
} from '../src/campusCollision.js';

function rawTop({ group, local }) {
  const m = group.matrixWorld.elements;
  return m[13] + local.top * m[5];
}

function makeBuilding(x, z, width, depth, yawDeg, top, bottom = 0) {
  const group = new THREE.Group();
  group.position.set(x, 0, z);
  group.rotation.y = THREE.MathUtils.degToRad(yawDeg);
  group.updateMatrixWorld(true);
  const colliders = [];
  addLocalCollider(colliders, group, 0, 0, width, depth, true, top, bottom);
  return colliders;
}

test('roof descent clamps cleanly onto building roof and never enters interior', () => {
  const colliders = makeBuilding(0, 0, 20, 20, -12.93, 18.3, 0);
  const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50, walls: [] };

  const nextY = resolveVerticalMove(0, 0, 22, 12, colliders, bounds, rawTop);
  assert.ok(Math.abs(nextY - (18.3 + PLAYER_RADIUS)) < 1e-6, `expected roof clamp at ${18.3 + PLAYER_RADIUS}, got ${nextY}`);
  assert.equal(blockedAt(0, 0, 13.8, colliders, bounds, rawTop), true);
  assert.equal(blockedAt(0, 0, 18.3 + PLAYER_RADIUS, colliders, bounds, rawTop), false);
});

test('ascent under overhangs clamps below soffit while ground descent stays clear', () => {
  const colliders = makeBuilding(0, 0, 20, 10, 0, 10, 3.3);
  const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50, walls: [] };

  // Ascending from ground-floor arcade into 2nd-floor overhang is blocked below soffit
  const upY = resolveVerticalMove(0, 0, 1.7, 5.0, colliders, bounds, rawTop);
  assert.ok(Math.abs(upY - (3.3 - PLAYER_RADIUS)) < 1e-6, `expected ceiling clamp at ${3.3 - PLAYER_RADIUS}, got ${upY}`);

  // Descending from 2.5 m to 1.7 m underneath the same overhang is unobstructed
  const downY = resolveVerticalMove(0, 0, 2.5, 1.7, colliders, bounds, rawTop);
  assert.equal(downY, 1.7);
});

test('drones fly freely over perimeter walls above wallTop and clamp cleanly on descent', () => {
  const bounds = {
    minX: -50, maxX: 50, minZ: -80, maxZ: 32, streetZ: 45,
    walls: [
      { id: 'wall-street-a', a: [39.77, 32], b: [2.86, 32] },
      { id: 'wall-2', a: [55.23, -82.31], b: [65.05, 40.57] }
    ]
  };

  // Below street wall height: blocked from crossing z = 32
  const lowPos = { x: 20, y: 1.7, z: 30 };
  resolveHorizontalMove(lowPos, 0, 5, [], bounds, rawTop);
  assert.ok(lowPos.z <= 32 - PLAYER_RADIUS, `low flight should stay inside street wall, got z=${lowPos.z}`);

  // Above street wall height: flies right over the wall without needing the gate
  const highPos = { x: 20, y: 4.5, z: 30 };
  resolveHorizontalMove(highPos, 0, 5, [], bounds, rawTop);
  assert.ok(Math.abs(highPos.z - 35) < 1e-9, `expected z=35, got ${highPos.z}`);

  // Descending onto street wall vs non-street wall clamps cleanly to respective wallTop
  const streetDrop = resolveVerticalMove(20, 32, 5.0, 1.7, [], bounds, rawTop);
  assert.ok(Math.abs(streetDrop - (STREET_WALL_HEIGHT + PLAYER_RADIUS)) < 1e-6);

  const sideDrop = resolveVerticalMove(60.14, -20.87, 5.0, 1.7, [], bounds, rawTop);
  assert.ok(Math.abs(sideDrop - (PERIMETER_WALL_HEIGHT + PLAYER_RADIUS)) < 1e-6);
});

test('diagonal walls and acute corners slide smoothly and recover from overlap without sticking', () => {
  const bounds = {
    minX: -60, maxX: 60, minZ: -90, maxZ: 45, streetZ: 45,
    walls: [
      { id: 'wall-8', a: [-60.25, 30.30], b: [-51.28, -8.77] },
      { id: 'wall-9', a: [-51.28, -8.77], b: [-65.78, -12.10] }
    ]
  };

  // Move obliquely into diagonal wall-8: should slide along wall tangent rather than freezing
  const pos = { x: -55.0, y: 1.7, z: 10.0 };
  for (let i = 0; i < 20; i++) {
    resolveHorizontalMove(pos, -0.8, 0.2, [], bounds, rawTop);
  }
  assert.ok(!blockedAt(pos.x, pos.z, pos.y, [], bounds, rawTop), 'drone should not end inside diagonal wall');
  assert.ok(pos.z > 10.5, `drone should slide northward/southward along diagonal wall, got z=${pos.z}`);

  // Even if spawned slightly overlapping an interior corner, depenetration pushes out cleanly
  const stuck = { x: -51.4, y: 1.7, z: -8.9 };
  resolveHorizontalMove(stuck, 0.2, 0.2, [], bounds, rawTop);
  assert.ok(!blockedAt(stuck.x, stuck.z, stuck.y, [], bounds, rawTop), 'drone should depenetrate from wall corner');
});

test('empty walls array removes inner walls while preserving outer world boundary envelope', () => {
  const bounds = {
    points: [[-40, -40], [40, -40], [40, 32], [-40, 32]],
    walls: []
  };
  const outer = outerWorldBounds(bounds);

  // Moving past old polygon perimeter (z = 32 -> z = 50) works freely when walls are deleted
  const pos = { x: 0, y: 1.7, z: 30 };
  resolveHorizontalMove(pos, 0, 20, [], bounds, rawTop);
  assert.ok(Math.abs(pos.z - 50) < 1e-9, `expected z=50, got ${pos.z}`);

  // Outer world boundary still stops movement cleanly
  resolveHorizontalMove(pos, 0, 100, [], bounds, rawTop);
  assert.ok(Math.abs(pos.z - outer.maxZ) < 1e-6, `expected stop at outer maxZ ${outer.maxZ}, got ${pos.z}`);
});

test('rotated building OBB allows close flanking pass while preventing corner clipping', () => {
  const colliders = makeBuilding(0, 0, 20, 10, -45, 12, 0);
  const bounds = { minX: -50, maxX: 50, minZ: -50, maxZ: 50, walls: [] };

  // Point near rotated OBB corner: outside the rotated box even though inside its world AABB
  const aabbOnlyPoint = { x: -9.5, y: 1.7, z: -9.5 };
  assert.equal(blockedAt(aabbOnlyPoint.x, aabbOnlyPoint.z, aabbOnlyPoint.y, colliders, bounds, rawTop), false);

  // Moving straight toward rotated front face slides cleanly along exterior face without entering
  const approach = { x: 0, y: 1.7, z: 10 };
  resolveHorizontalMove(approach, 0, -10, colliders, bounds, rawTop);
  assert.equal(blockedAt(approach.x, approach.z, approach.y, colliders, bounds, rawTop), false);
  assert.ok(approach.x < -1, `drone should slide along -45° face, got x=${approach.x}, z=${approach.z}`);
  assert.equal(wallTop({ id: 'wall-street-a' }), STREET_WALL_HEIGHT + PLAYER_RADIUS);
});

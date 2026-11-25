import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import {
  distanceToLandEdge,
  insideLand,
  nearestPointInsideLand,
  resolveEditorLandPosition
} from '../src/campusBoundary.js';
import { PLAYER_RADIUS, blockedAt } from '../src/campusCollision.js';
import { stamfordLandOutline } from '../src/campusLandPresets.js';
import { buildFieldShelter, SHELTER_SPECS } from '../src/fieldShelter.js';

const polygonBoundary = { points: stamfordLandOutline };
const concaveLBoundary = {
  points: [
    [0, 0], [20, 0], [20, 10], [10, 10], [10, 20], [0, 20]
  ]
};

test('nearestPointInsideLand clamps outside coordinates inside polygon and concave corners', () => {
  // Past the east angled wall near (-15, 0) -> clamp inside stamfordLandOutline
  const [ex, ez] = nearestPointInsideLand(polygonBoundary, 65, 5);
  assert.ok(insideLand(polygonBoundary, ex, ez), `expected (${ex}, ${ez}) inside polygon`);

  // Outside the concave L-corner near (14, 14) -> clamp strictly inside concave polygon
  const [cx, cz] = nearestPointInsideLand(concaveLBoundary, 14, 14);
  assert.ok(insideLand(concaveLBoundary, cx, cz), `expected (${cx}, ${cz}) inside concave polygon`);

  // Rectangular boundary without points clamps cleanly
  const rectBoundary = { minX: -10, maxX: 10, minZ: -10, maxZ: 10, streetZ: 15 };
  const [rx, rz] = nearestPointInsideLand(rectBoundary, 22, 19);
  assert.ok(insideLand(rectBoundary, rx, rz, 0, true));
  assert.ok(rx < 10 && rz < 15);
});

test('resolveEditorLandPosition stops snap-back for objects starting outside or dragged past edges', () => {
  // An object currently straddling outside east edge (~x: 68, z: 5) nudged inward (-1 m in X)
  // moves strictly closer to the boundary edge and must be accepted without snapping back.
  const prevX = 68;
  const prevZ = 5;
  assert.ok(!insideLand(polygonBoundary, prevX, prevZ));
  const nudgeIn = resolveEditorLandPosition(polygonBoundary, prevX, prevZ, prevX - 1, prevZ);
  assert.equal(nudgeIn.clamped, false);
  assert.equal(nudgeIn.x, 67);
  assert.equal(nudgeIn.z, 5);
  assert.ok(distanceToLandEdge(polygonBoundary.points, nudgeIn.x, nudgeIn.z)
    < distanceToLandEdge(polygonBoundary.points, prevX, prevZ));

  // Moving further away from the boundary aligns cleanly inside the boundary instead of snapping back
  const pushOut = resolveEditorLandPosition(polygonBoundary, prevX, prevZ, prevX + 4, prevZ);
  assert.equal(pushOut.clamped, true);
  assert.ok(insideLand(polygonBoundary, pushOut.x, pushOut.z));

  // Dragging an inside object past an angled wall clamps cleanly inside near the drop point
  const draggedOut = resolveEditorLandPosition(polygonBoundary, 44, 5, 72, 5);
  assert.equal(draggedOut.clamped, true);
  assert.ok(insideLand(polygonBoundary, draggedOut.x, draggedOut.z));
  assert.ok(draggedOut.x > 55, 'clamped near east wall rather than snapping back to 44');
});

test('buildFieldShelter creates grounded concrete pad, 12 individual seats, 6 columns, and corrugated hip roof', () => {
  const root = new THREE.Group();
  root.position.set(-15.5, 0, -79.2);
  root.rotation.y = 0;
  const kit = { colliders: [] };

  buildFieldShelter(root, kit);
  root.updateMatrixWorld(true);

  const seats = root.children.filter((child) => child.name === 'Shelter bucket seat');
  assert.equal(seats.length, 12, 'expected 12 individual seats (6 per long side)');

  const padTop = SHELTER_SPECS.slab.height;
  const box = new THREE.Box3();
  for (const seat of seats) {
    box.setFromObject(seat);
    assert.ok(Math.abs(box.min.y - padTop) <= 0.02,
      `seat legs must ground on slab top (${padTop} m), got min.y=${box.min.y}`);
    assert.ok(box.max.y >= 0.80, `seat backrest must reach ~0.85 m, got max.y=${box.max.y}`);
  }

  // Whole shelter rests flush on y = 0 ground and spans the hip roof envelope
  const totalBounds = new THREE.Box3().setFromObject(root);
  assert.ok(Math.abs(totalBounds.min.y) <= 0.01, `shelter must rest at y=0, got ${totalBounds.min.y}`);
  assert.ok(totalBounds.max.y >= 3.2, `hip ridge must reach >= 3.2 m, got ${totalBounds.max.y}`);

  // Collider verification: 6 columns + 2 seated rows + 1 hip roof = 9 colliders
  assert.equal(kit.colliders.length, 9);
  const roofCollider = kit.colliders.find((c) => c.local.bottom > 2.0);
  assert.ok(roofCollider, 'expected elevated hip roof collider');
  assert.ok(roofCollider.local.bottom - PLAYER_RADIUS > 1.7,
    'roof eave must clear 1.7 m drone eye height so drones can look under the shelter');

  // Seat rows block near ground, central aisle stays open at eye height 1.7 m
  const map = JSON.parse(readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8'));
  const bounds = map.boundary;
  assert.equal(blockedAt(-15.5, -79.2, 1.7, kit.colliders, bounds, ({ local }) => local.top), false,
    'central aisle must be open at eye height');
  assert.equal(blockedAt(-15.5, -79.2 + SHELTER_SPECS.seatRowZ, 0.5, kit.colliders, bounds, ({ local }) => local.top), true,
    'seated bench row must block near ground level');
  assert.equal(blockedAt(-15.5, -79.2, 2.5, kit.colliders, bounds, ({ local }) => local.top), true,
    'hip roof volume must block mid-roof collisions');
});

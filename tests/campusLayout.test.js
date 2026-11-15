import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateCampusLayout, layoutKey, readCampusLayout } from '../src/campusLayout.js';

test('validateCampusLayout rejects non-object inputs', () => {
  assert.equal(validateCampusLayout(null).valid, false);
  assert.equal(validateCampusLayout('string').valid, false);
  assert.equal(validateCampusLayout([]).valid, false);
});

test('validateCampusLayout rejects objects missing boundary', () => {
  const result = validateCampusLayout({ campus: 'Test' });
  assert.equal(result.valid, false);
  assert.match(result.error, /boundary/i);
});

test('validateCampusLayout rejects invalid boundaries', () => {
  const badPoints = validateCampusLayout({ boundary: { points: [[0, 0], [1, 1]] } });
  assert.equal(badPoints.valid, false);
  assert.match(badPoints.error, /points/i);

  const missingExtents = validateCampusLayout({ boundary: { minX: 0 } });
  assert.equal(missingExtents.valid, false);
  assert.match(missingExtents.error, /boundary/i);
});

test('validateCampusLayout accepts valid boundary with rectangular extents or polygon points', () => {
  const rect = validateCampusLayout({
    boundary: { minX: -50, maxX: 50, minZ: -80, maxZ: 30 }
  });
  assert.equal(rect.valid, true);

  const poly = validateCampusLayout({
    boundary: { points: [[0, 0], [10, 0], [10, 10], [0, 10]] }
  });
  assert.equal(poly.valid, true);
});

test('layoutKey generates consistent hash key', () => {
  const key1 = layoutKey('test-source');
  const key2 = layoutKey('test-source');
  assert.equal(key1, key2);
  assert.match(key1, /^stamford-layout-v1-\d+$/);
});

test('the room and bus update carries forward old saves and moves only stock poses', () => {
  const source = readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8').replaceAll('\r\n', '\n');
  const saved = JSON.parse(source);
  Object.assign(saved.buildings.guardian, { x: -29.3, z: 17.25 });
  Object.assign(saved.buildings.bus, { x: 0, z: 0, yaw: 0 });
  saved.elements = { 'bus-parking': { x: 0, z: 0, yaw: 0 } };
  saved.deck = ['guardian'];
  globalThis.window = {
    sessionStorage: { getItem: () => null },
    localStorage: { getItem: key => key === 'stamford-layout-v1-58594549' ? JSON.stringify(saved) : null }
  };
  try {
    for (const lineEnding of ['\n', '\r\n']) {
      const { map } = readCampusLayout(source.replaceAll('\n', lineEnding));
      assert.equal(map.buildings.guardian.z, 22.6);
      assert.deepEqual(map.elements['bus-parking'], { x: 24.2, z: 9.3, yaw: 33 });
      assert.deepEqual(map.deck, ['guardian']);
    }
    saved.buildings.guard.x += 1;
    saved.buildings.bus.z += 1;
    const { map } = readCampusLayout(source);
    assert.deepEqual(map.buildings.guardian, saved.buildings.guardian);
    assert.deepEqual(map.buildings.bus, saved.buildings.bus);
  } finally {
    delete globalThis.window;
  }
});

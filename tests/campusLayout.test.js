import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampusLayout, layoutKey } from '../src/campusLayout.js';

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

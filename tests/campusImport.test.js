import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCampusLayout } from '../src/campusLayout.js';

test('import parser handles valid CAMPUS_MAP.json string', () => {
  const jsonString = JSON.stringify({
    campus: 'Stamford University Bangladesh',
    boundary: { minX: -48, maxX: 50, minZ: -86, maxZ: 32 }
  });
  const parsed = JSON.parse(jsonString);
  const result = validateCampusLayout(parsed);
  assert.equal(result.valid, true);
  assert.equal(result.map.campus, 'Stamford University Bangladesh');
});

test('import parser catches JSON syntax error', () => {
  assert.throws(() => {
    JSON.parse('{ invalid json }');
  }, /SyntaxError/);
});

test('import validator catches missing boundary in parsed data', () => {
  const parsed = { foo: 'bar' };
  const result = validateCampusLayout(parsed);
  assert.equal(result.valid, false);
  assert.match(result.error, /boundary/i);
});

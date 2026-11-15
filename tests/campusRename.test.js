import test from 'node:test';
import assert from 'node:assert/strict';

test('component rename updates entry, root, spec, and map records', () => {
  const map = {
    buildings: {
      hall: { label: 'University Hall', x: 0, z: 0, yaw: 0, width: 20, depth: 10, floors: 2 }
    },
    elements: {
      'tree-1': { label: 'Shade tree', x: 10, z: 10, yaw: 0 }
    }
  };

  const hallEntry = {
    id: 'hall',
    label: 'University Hall',
    building: true,
    root: { name: 'University Hall', position: { x: 0, z: 0 }, getWorldPosition: () => ({ x: 0, z: 0 }) },
    spec: map.buildings.hall,
    option: { textContent: 'University Hall · 0, 0' }
  };

  const doorEntry = {
    id: 'door-1',
    label: 'Door 1 · University Hall',
    buildingId: 'hall',
    root: { name: 'Door 1 · University Hall', position: { x: 0, z: 0 }, getWorldPosition: () => ({ x: 0, z: 0 }) },
    spec: { label: 'Door 1 · University Hall', building: 'hall' }
  };

  const treeEntry = {
    id: 'tree-1',
    label: 'Shade tree',
    root: { name: 'Shade tree', position: { x: 10, z: 10 }, getWorldPosition: () => ({ x: 10, z: 10 }) },
    spec: map.elements['tree-1']
  };

  const entries = new Map([
    ['hall', hallEntry],
    ['door-1', doorEntry],
    ['tree-1', treeEntry]
  ]);
  const parked = new Map();
  const undoStack = [];
  const redoStack = [];

  function renameEntry(entry, newLabel) {
    if (!entry) return;
    const clean = newLabel.trim();
    if (!clean || clean === entry.label) return;
    const prevLabel = entry.label;

    function apply(label, oldLabel) {
      entry.label = label;
      entry.root.name = label;
      if (!entry.spec) {
        entry.spec = (map.elements ??= {})[entry.id] ??= {};
      }
      entry.spec.label = label;
      if (entry.spec.copyLabel) entry.spec.copyLabel = label;
      if (map.buildings?.[entry.id]) map.buildings[entry.id].label = label;
      else if (map.elements?.[entry.id]) map.elements[entry.id].label = label;

      if (entry.building) {
        for (const child of entries.values()) {
          if (child.buildingId === entry.id && child.label.includes(oldLabel)) {
            child.label = child.label.replace(oldLabel, label);
            child.root.name = child.label;
            if (child.spec) {
              child.spec.label = child.label;
              if (child.spec.copyLabel) child.spec.copyLabel = child.label;
            }
          }
        }
      }
    }

    apply(clean, prevLabel);
    undoStack.push({
      undo: () => apply(prevLabel, clean),
      redo: () => apply(clean, prevLabel)
    });
  }

  // 1. Rename building
  renameEntry(hallEntry, 'Engineering Hall');
  assert.equal(hallEntry.label, 'Engineering Hall');
  assert.equal(hallEntry.root.name, 'Engineering Hall');
  assert.equal(hallEntry.spec.label, 'Engineering Hall');
  assert.equal(map.buildings.hall.label, 'Engineering Hall');
  // Child door label cascaded
  assert.equal(doorEntry.label, 'Door 1 · Engineering Hall');
  assert.equal(doorEntry.spec.label, 'Door 1 · Engineering Hall');

  // 2. Undo rename
  const lastAction = undoStack.pop();
  lastAction.undo();
  assert.equal(hallEntry.label, 'University Hall');
  assert.equal(map.buildings.hall.label, 'University Hall');
  assert.equal(doorEntry.label, 'Door 1 · University Hall');

  // 3. Redo rename
  lastAction.redo();
  assert.equal(hallEntry.label, 'Engineering Hall');
  assert.equal(map.buildings.hall.label, 'Engineering Hall');
  assert.equal(doorEntry.label, 'Door 1 · Engineering Hall');

  // 4. Rename element (tree)
  renameEntry(treeEntry, 'Memorial Oak');
  assert.equal(treeEntry.label, 'Memorial Oak');
  assert.equal(map.elements['tree-1'].label, 'Memorial Oak');

  // 5. Whitespace and empty protection
  const oakActionCount = undoStack.length;
  renameEntry(treeEntry, '   ');
  renameEntry(treeEntry, 'Memorial Oak');
  assert.equal(undoStack.length, oakActionCount); // no new action recorded
});

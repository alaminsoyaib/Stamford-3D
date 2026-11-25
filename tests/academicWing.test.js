import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { academicBuildingOptions } from '../src/academicBuilding.js';
import { createCampusKit } from '../src/buildingFactory.js';
import { perimeterWalls } from '../src/campusBoundary.js';
import { blockedAt } from '../src/campusCollision.js';
import { academicWingBounds, worldOutline } from '../src/campusFootprints.js';
import { buildGroundEnclosure, computeGroundEnclosureBounds } from '../src/groundEnclosure.js';

function withFakeCanvas(fn) {
  const prevDoc = globalThis.document;
  const fakeCtx = new Proxy({}, {
    get(_target, prop) {
      if (prop === 'createLinearGradient' || prop === 'createRadialGradient') {
        return () => ({ addColorStop: () => {} });
      }
      if (prop === 'createImageData') {
        return (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) });
      }
      return () => {};
    }
  });
  globalThis.document = {
    createElement(tag) {
      if (tag !== 'canvas') return {};
      return { width: 256, height: 256, getContext: () => fakeCtx };
    }
  };
  try {
    return fn();
  } finally {
    if (prevDoc === undefined) delete globalThis.document;
    else globalThis.document = prevDoc;
  }
}

test('Academic wing builds recessed A-116, deep Medical alcove with right handwash basin, transparent canopy mesh, and 2nd-floor roof railings', () => {
  const map = JSON.parse(readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8'));
  const off = map.buildings.official;
  const wingSpec = academicWingBounds(off);

  withFakeCanvas(() => {
    const kit = createCampusKit(map);
    const parent = new THREE.Group();
    const wingRoot = kit.building(parent, 'official', 'academic', academicBuildingOptions(kit), {
      spec: wingSpec, wallSurfaces: [], extraDoors: [], story: 3.3, trim: kit.materials.white
    });
    wingRoot.updateMatrixWorld(true);

    // 1. 3rd-floor open veranda gallery & AC units + security grilles
    const upperGroup = wingRoot.children.find((c) => c.name === 'Setback upper floor');
    assert.ok(upperGroup, 'expected Setback upper floor group');
    assert.equal(upperGroup.children.filter((c) => c.name === 'AC outdoor unit').length, 3);
    assert.ok(upperGroup.children.filter((c) => c.name === 'Security grille panel').length >= 3);

    // 2. Wide upper staircase + 1-storey AND 2-storey roof edge railings + 2 under-stair AC units
    const stairsGroup = wingRoot.children.find((c) => c.name === 'Academic wing exterior stairs');
    assert.ok(stairsGroup);
    const upperFlight = stairsGroup.children.find((c) => c.name === 'Lower-roof-to-upper-landing flight');
    const upperBox = new THREE.Box3().setFromObject(upperFlight);
    assert.ok(upperBox.max.z - upperBox.min.z > 4.0);
    assert.ok(stairsGroup.children.find((c) => c.name === '1-storey roof edge railing'));
    assert.ok(stairsGroup.children.find((c) => c.name === '2-storey roof edge railing'));
    assert.equal(stairsGroup.children.filter((c) => c.name === 'AC outdoor unit').length, 2);

    // 3. Recessed A-116 Student Welfare bay sits inward from -depth/2 in wingRoot-local space
    const welfareBay = wingRoot.children.find((c) => c.name === 'Students Welfare A-116 bay');
    assert.ok(welfareBay, 'expected Students Welfare A-116 bay');
    const savedPos = wingRoot.position.clone();
    const savedRotY = wingRoot.rotation.y;
    wingRoot.position.set(0, 0, 0);
    wingRoot.rotation.y = 0;
    wingRoot.updateMatrixWorld(true);
    const welfareLocalBounds = new THREE.Box3().setFromObject(welfareBay);
    const welfareWall = welfareBay.children[0];
    assert.ok(welfareWall.position.z > -wingSpec.depth / 2 + 0.4,
      `A-116 facade wall must sit recessed inward from -depth/2 (wallZ=${welfareWall.position.z}, rearZ=${-wingSpec.depth / 2})`);
    assert.ok(welfareLocalBounds.min.z > -wingSpec.depth / 2 - 0.1,
      `A-116 rain awning must stay inside/near overhang rather than jutting past outer edge (localMinZ=${welfareLocalBounds.min.z})`);
    wingRoot.position.copy(savedPos);
    wingRoot.rotation.y = savedRotY;
    wingRoot.updateMatrixWorld(true);

    // 4. Deep Medical Center alcove includes Handwash basin on the right (-X) inside the alcove
    const medAlcove = wingRoot.children.find((c) => c.name === 'Medical Center recessed alcove');
    assert.ok(medAlcove, 'expected Medical Center recessed alcove');
    const handwash = medAlcove.children.find((c) => c.name === 'Handwash basin');
    assert.ok(handwash, 'expected Handwash basin on right inner side of Medical alcove');

    // 5. Projecting canopy uses transparent wire mesh (not opaque black), has centered red light, and keeps y=1.7 walkway open
    const canopyGroup = wingRoot.children.find((c) => c.name === 'Projecting passage canopy');
    assert.ok(canopyGroup, 'expected Projecting passage canopy');
    let hasTransparentMesh = false;
    canopyGroup.traverse((obj) => {
      if (obj.isMesh && obj.material?.transparent) hasTransparentMesh = true;
    });
    assert.equal(hasTransparentMesh, true, 'canopy 2nd-floor enclosure must use semi-transparent wire mesh');

    const canopyLight = canopyGroup.getObjectByName('Circular canopy light');
    assert.ok(canopyLight, 'expected centered Circular canopy light under canopy soffit');

    wingRoot.position.set(wingSpec.x, 0, wingSpec.z);
    wingRoot.rotation.y = THREE.MathUtils.degToRad(wingSpec.yaw);
    parent.position.set(off.x, 0, off.z);
    parent.rotation.y = THREE.MathUtils.degToRad(off.yaw);
    parent.updateMatrixWorld(true);
    kit.refreshColliders(wingRoot);

    const lightWorld = new THREE.Vector3();
    canopyLight.getWorldPosition(lightWorld);
    const getRawTop = ({ group, local }) => {
      const m = group.matrixWorld.elements;
      return m[13] + local.top * m[5];
    };

    assert.equal(blockedAt(lightWorld.x, lightWorld.z, 1.7, kit.colliders, map.boundary, getRawTop), false,
      'covered passage directly beneath the projecting canopy light must stay open at y=1.7 m');
    assert.equal(blockedAt(lightWorld.x, lightWorld.z, 3.3 + 1.5, kit.colliders, map.boundary, getRawTop), true,
      'enclosed 2nd-floor veranda atop canopy must block collision');
  });
});

test('Ground enclosure creates chain-link wire mesh fence, raised sitting curbs, open ground entrance, and keeps checkpoints clear', () => {
  const map = JSON.parse(readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8'));

  withFakeCanvas(() => {
    const kit = createCampusKit(map);
    const parent = new THREE.Group();
    const fenceRoot = buildGroundEnclosure(parent, kit);
    fenceRoot.updateMatrixWorld(true);

    const runs = fenceRoot.children.filter((c) => c.name === 'Chain-link fence run');
    assert.ok(runs.length >= 4, `expected chain-link fence runs around ground, got ${runs.length}`);
    const curbs = fenceRoot.children.filter((c) => c.name === 'Raised ground seating curb');
    assert.ok(curbs.length >= 2, `expected raised planted sitting curbs, got ${curbs.length}`);
    const entry = fenceRoot.children.find((c) => c.name === 'Ground entrance path');
    assert.ok(entry, 'expected open Ground entrance path');

    const runtimeBoundary = { ...map.boundary, walls: perimeterWalls(map) };
    const getRawTop = ({ group, local }) => {
      const m = group.matrixWorld.elements;
      return m[13] + local.top * m[5];
    };

    // Entrance gateway center must be 100% open for 1.7 m flight into the ground
    const [[entryWorldX, entryWorldZ]] = worldOutline([[map.ground.width / 2 + 0.24, 0]], map.ground);
    assert.equal(blockedAt(entryWorldX, entryWorldZ, 1.7, kit.colliders, runtimeBoundary, getRawTop), false,
      'ground entrance gateway must be open at y = 1.7 m');

    // Fence section beside entrance must block below fence height
    const [[fenceWorldX, fenceWorldZ]] = worldOutline([[map.ground.width / 2 + 0.24, -map.ground.depth / 2 + 2.0]], map.ground);
    assert.equal(blockedAt(fenceWorldX, fenceWorldZ, 1.7, kit.colliders, runtimeBoundary, getRawTop), true,
      'chain-link mesh fence beside entrance must block horizontal clipping');

    // All 4 checkpoints must stay unblocked
    for (const stop of map.stops) {
      assert.equal(blockedAt(stop.position[0], stop.position[2], stop.position[1], kit.colliders, runtimeBoundary, getRawTop), false,
        `checkpoint ${stop.key} (${stop.name}) must remain clear of ground fence colliders`);
    }
  });
});

test('Ground enclosure dynamically wraps scaled/shifted lawn and sports court without cutting across the court', () => {
  const map = JSON.parse(readFileSync(new URL('../CAMPUS_MAP.json', import.meta.url), 'utf8'));
  // Simulate a Layout Editor saved state with scaled lawn, shifted/scaled sports court, and adjacent Academic Wing
  map.ground.x = 6;
  map.ground.z = -34;
  map.ground.yaw = 0;
  map.ground.scale = [2.2, 1, 1.9];
  map.elements = {
    court: { x: 14, z: -38, yaw: 0, scale: [1.6, 1, 1.5] }
  };
  map.buildings.academic = { x: 6, z: -8, width: 22, depth: 12, yaw: 0, floors: 3 };

  withFakeCanvas(() => {
    const kit = createCampusKit(map);
    const parent = new THREE.Group();
    const lawn = new THREE.Group();
    lawn.position.set(map.ground.x, 0, map.ground.z);
    kit.layout.add('ground', lawn, map.ground, { surface: true });
    const courtSite = kit.prop(parent, 'court', 'Sports court', map.ground.x, map.ground.z, 0, { surface: true });
    const shelter = kit.prop(parent, 'shelter', 'Field shelter', -10.5, -34, 0);

    const courtHalfW = (14.72 * 0.81) / 2;
    const courtHalfD = (20.7 * 0.81) / 2;
    const bounds = computeGroundEnclosureBounds(kit, { lawn, courtSite, courtHalfW, courtHalfD, shelter });

    // Every corner of the scaled/shifted court must lie strictly inside the fence enclosure
    courtSite.updateMatrixWorld(true);
    const v = new THREE.Vector3();
    for (const sx of [-courtHalfW, courtHalfW]) {
      for (const sz of [-courtHalfD, courtHalfD]) {
        v.set(sx, 0, sz).applyMatrix4(courtSite.matrixWorld);
        assert.ok(Math.abs(v.x - bounds.centerWorldX) < bounds.halfW,
          `court corner X=${v.x} must stay inside enclosure [${bounds.centerWorldX - bounds.halfW}, ${bounds.centerWorldX + bounds.halfW}]`);
        assert.ok(Math.abs(v.z - bounds.centerWorldZ) < bounds.halfD,
          `court corner Z=${v.z} must stay inside enclosure [${bounds.centerWorldZ - bounds.halfD}, ${bounds.centerWorldZ + bounds.halfD}]`);
      }
    }

    // Front entrance edge must automatically face the adjacent Academic Building (+Z) and shelter edge (-X) stays open
    assert.equal(bounds.frontSide, '+Z', 'entrance/sitting curb must face the adjacent Academic Wing');
    assert.equal(bounds.openShelterSide, '-X', 'Field Shelter side must remain open');

    const fenceRoot = buildGroundEnclosure(parent, kit, { lawn, courtSite, courtHalfW, courtHalfD, shelter });
    fenceRoot.updateMatrixWorld(true);
    assert.ok(fenceRoot.children.find((c) => c.name === 'Ground entrance path'));
    assert.ok(fenceRoot.children.filter((c) => c.name === 'Raised ground seating curb').length === 2);
  });
});

import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { academicWingBounds, worldOutline } from './campusFootprints.js';
import { box, canvasTexture, cylinder, groupAt, part, rod, seededRandom, unitPlane } from './sceneKit.js';

export const GROUND_FENCE_SPECS = {
  entranceWidth: 3.6,
  seatingCurbHeight: 0.46,
  seatingCurbDepth: 0.48,
  frontFenceHeight: 2.05,
  courtFenceHeight: 3.25
};

let cachedAssets = null;

function createChainLinkMaterial() {
  if (typeof document === 'undefined') {
    return new THREE.MeshStandardMaterial({
      color: '#8e928f', transparent: true, opacity: 0.42, side: THREE.DoubleSide, roughness: 0.65, metalness: 0.38
    });
  }
  const map = canvasTexture(128, 128, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(132, 134, 128, 0.82)';
    ctx.lineWidth = 2.4;
    const step = 16;
    for (let offset = -h; offset < w + h; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + h, h);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(offset, h);
      ctx.lineTo(offset + h, 0);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(216, 220, 216, 0.34)';
    ctx.lineWidth = 1;
    for (let offset = -h + 1; offset < w + h; offset += step) {
      ctx.beginPath();
      ctx.moveTo(offset, 0);
      ctx.lineTo(offset + h, h);
      ctx.stroke();
    }
  });
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  return new THREE.MeshStandardMaterial({
    color: '#ffffff',
    map,
    transparent: true,
    alphaTest: 0.12,
    side: THREE.DoubleSide,
    roughness: 0.64,
    metalness: 0.38
  });
}

function getFenceAssets(kit) {
  if (cachedAssets) return cachedAssets;
  const m = kit.materials;
  cachedAssets = {
    mesh: createChainLinkMaterial(),
    postSteel: standard('#6d685f', { metalness: 0.42, roughness: 0.64 }),
    gateBlue: standard('#2b789f', { metalness: 0.34, roughness: 0.52 }),
    curbBody: standard('#cfc9bc', { roughness: 0.84 }),
    curbPlinth: standard('#6e6a61', { roughness: 0.9 }),
    curbCap: standard('#e9e5db', { roughness: 0.54 }),
    entryApron: standard('#bcb5a7', { roughness: 0.88 }),
    trunk: standard('#6b5340', { roughness: 0.9 }),
    soil: m.soil,
    potClay: standard('#a34d3c', { roughness: 0.8 }),
    foliage: kit.foliage,
    crownGeo: new THREE.IcosahedronGeometry(1, 1),
    potGeo: new THREE.CylinderGeometry(0.18, 0.12, 0.24, 10)
  };
  return cachedAssets;
}

function worldToUnscaledLocal(wx, wz, originX, originZ, yaw) {
  const dx = wx - originX;
  const dz = wz - originZ;
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  // Inverse of Three.js Y-rotation: worldX = x*c + z*s, worldZ = -x*s + z*c
  return [dx * c - dz * s, dx * s + dz * c];
}

function unscaledLocalToWorld(lx, lz, originX, originZ, yaw) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  return [originX + lx * c + lz * s, originZ - lx * s + lz * c];
}

function addMeshFenceRun(parent, assets, colliders, [x1, z1], [x2, z2], baseY, height, { postPitch = 3.2, addCollider = true } = {}) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.35) return;
  const angle = Math.atan2(-dz, dx);
  const run = groupAt(parent, 'Chain-link fence run', [(x1 + x2) / 2, baseY, (z1 + z2) / 2], angle);

  const bays = Math.max(1, Math.round(length / postPitch));
  for (let i = 0; i <= bays; i++) {
    const px = (i / bays - 0.5) * length;
    cylinder(run, assets.postSteel, 0.03, height, [px, height / 2, 0]);
  }
  for (const ry of [0.05, height * 0.5, height - 0.04]) {
    rod(run, assets.postSteel, [-length / 2, ry, 0], [length / 2, ry, 0], 0.02);
  }

  const panelGeo = unitPlane.clone();
  const uv = panelGeo.attributes.uv;
  const repX = Math.max(1, length * 1.15);
  const repY = Math.max(1, height * 1.15);
  for (let i = 0; i < uv.count; i++) {
    uv.setXY(i, uv.getX(i) * repX, uv.getY(i) * repY);
  }
  const mesh = part(run, panelGeo, assets.mesh, [0, height / 2, 0], [length, height, 1]);
  mesh.castShadow = false;

  if (addCollider) {
    addLocalCollider(colliders, run, 0, 0, length, 0.16, true, baseY + height, 0);
  }
}

function addCleanSeatingCurb(parent, assets, colliders, [x1, z1], [x2, z2], innerOffsetZ, seed, { allowSaplings = true } = {}) {
  const { seatingCurbHeight, seatingCurbDepth } = GROUND_FENCE_SPECS;
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 0.6) return;
  const angle = Math.atan2(-dz, dx);
  const curb = groupAt(parent, 'Raised ground seating curb', [(x1 + x2) / 2, 0, (z1 + z2) / 2], angle);

  // Clean weathered concrete retaining wall + flat pale tiled sitting cap (matches campus walkway curb)
  box(curb, assets.curbPlinth, [length + 0.02, 0.08, seatingCurbDepth + 0.02], [0, 0.04, 0]);
  box(curb, assets.curbBody, [length, seatingCurbHeight - 0.14, seatingCurbDepth], [0, 0.08 + (seatingCurbHeight - 0.14) / 2, 0]);
  box(curb, assets.curbCap, [length + 0.04, 0.06, seatingCurbDepth + 0.05], [0, seatingCurbHeight - 0.03, 0]);

  const rng = seededRandom(seed);
  // Sparse slender saplings tucked strictly inside grass strips (never placed on top of the painted court)
  if (allowSaplings && length > 5.5) {
    const saplingCount = Math.min(2, Math.max(1, Math.floor(length / 6.5)));
    for (let i = 0; i < saplingCount; i++) {
      const sx = -length / 2 + ((i + 0.5) / saplingCount) * (length - 1.8) + 0.9;
      const sz = innerOffsetZ * (seatingCurbDepth * 0.5 + 0.55);
      const trunkH = 1.2 + rng() * 0.55;
      cylinder(curb, assets.trunk, 0.045, trunkH, [sx, trunkH / 2, sz]);
      for (let c = 0; c < 3; c++) {
        const cr = 0.28 + rng() * 0.18;
        part(curb, assets.crownGeo, assets.foliage[(i + c) % assets.foliage.length],
          [sx + (rng() - 0.5) * 0.34, trunkH + 0.15 + c * 0.16, sz + (rng() - 0.5) * 0.34],
          [cr * 1.15, cr * 0.78, cr]);
      }
    }
  }

  addLocalCollider(colliders, curb, 0, 0, length, seatingCurbDepth + 0.06, true, seatingCurbHeight + 0.04, 0);
}

function addPottedPlantsRow(parent, assets, [x1, z1], [x2, z2], outwardNormal, seed) {
  const dx = x2 - x1;
  const dz = z2 - z1;
  const length = Math.hypot(dx, dz);
  if (length < 2.2) return;
  const rng = seededRandom(seed);
  const count = Math.min(8, Math.max(2, Math.floor(length / 2.6)));
  const pots = groupAt(parent, 'Ground walkway potted plants', [0, 0, 0]);
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const px = x1 + dx * t + outwardNormal[0] * 0.34;
    const pz = z1 + dz * t + outwardNormal[1] * 0.34;
    part(pots, assets.potGeo, assets.potClay, [px, 0.12, pz]);
    for (let c = 0; c < 3; c++) {
      const pr = 0.12 + rng() * 0.09;
      part(pots, assets.crownGeo, assets.foliage[(i + c) % assets.foliage.length],
        [px + (rng() - 0.5) * 0.14, 0.25 + pr * 0.9 + c * 0.07, pz + (rng() - 0.5) * 0.14],
        [pr, pr * 1.2, pr]);
    }
  }
}

function getAcademicWorldCenter(map) {
  if (map.buildings?.academic) {
    return [map.buildings.academic.x, map.buildings.academic.z];
  }
  const official = map.buildings?.official;
  if (official?.academicWing) {
    const wing = academicWingBounds(official);
    const [[wx, wz]] = worldOutline([[wing.x, wing.z]], official);
    return [wx, wz];
  }
  return null;
}

function pickFacingEdge(localPt, halfW, halfD) {
  const scores = [
    { side: '+X', score: localPt[0] - halfW },
    { side: '-X', score: -halfW - localPt[0] },
    { side: '+Z', score: localPt[1] - halfD },
    { side: '-Z', score: -halfD - localPt[1] }
  ];
  scores.sort((a, b) => b.score - a.score);
  return scores[0];
}

export function computeGroundEnclosureBounds(kit, { lawn, courtSite, courtHalfW = 0, courtHalfD = 0, shelter } = {}) {
  const { ground } = kit.map;
  const originX = lawn ? lawn.position.x : ground.x;
  const originZ = lawn ? lawn.position.z : ground.z;
  const yaw = lawn ? lawn.rotation.y : (ground.yaw ?? 0) * Math.PI / 180;

  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  const v = new THREE.Vector3();

  const includeRect = (obj, hw, hd) => {
    if (obj) {
      obj.updateMatrixWorld(true);
      for (const sx of [-hw, hw]) {
        for (const sz of [-hd, hd]) {
          v.set(sx, 0, sz).applyMatrix4(obj.matrixWorld);
          const [lx, lz] = worldToUnscaledLocal(v.x, v.z, originX, originZ, yaw);
          minX = Math.min(minX, lx);
          maxX = Math.max(maxX, lx);
          minZ = Math.min(minZ, lz);
          maxZ = Math.max(maxZ, lz);
        }
      }
    } else {
      minX = Math.min(minX, -hw);
      maxX = Math.max(maxX, hw);
      minZ = Math.min(minZ, -hd);
      maxZ = Math.max(maxZ, hd);
    }
  };

  // Always encompass the full scaled lawn AND the full scaled sports court so the fence never cuts across the court
  const scaleX = ground.scale?.[0] ?? 1;
  const scaleZ = ground.scale?.[2] ?? 1;
  includeRect(lawn, lawn ? ground.width / 2 : (ground.width * scaleX) / 2, lawn ? ground.depth / 2 : (ground.depth * scaleZ) / 2);
  if (courtSite && courtHalfW > 0 && courtHalfD > 0) {
    includeRect(courtSite, courtHalfW, courtHalfD);
  }

  const pad = 0.24;
  minX -= pad;
  maxX += pad;
  minZ -= pad;
  maxZ += pad;

  const midX = (minX + maxX) / 2;
  const midZ = (minZ + maxZ) / 2;
  const [centerWorldX, centerWorldZ] = unscaledLocalToWorld(midX, midZ, originX, originZ, yaw);
  const halfW = (maxX - minX) / 2;
  const halfD = (maxZ - minZ) / 2;

  // Detect external or edge-straddling shelter so we never clip or block shelter entry
  let openShelterSide = null;
  if (shelter) {
    shelter.updateMatrixWorld(true);
    v.set(0, 0, 0).applyMatrix4(shelter.matrixWorld);
    const [slx, slz] = worldToUnscaledLocal(v.x, v.z, centerWorldX, centerWorldZ, yaw);
    const outside = pickFacingEdge([slx, slz], halfW, halfD);
    if (outside.score > -2.8 && outside.score < 6.0) {
      openShelterSide = outside.side;
    }
  }

  // Detect which outer edge faces the Academic Wing walkway (or Checkpoint 3 when Academic is far across stock survey)
  let frontSide = '+X';
  const acadWorld = getAcademicWorldCenter(kit.map);
  const stop3 = kit.map.stops?.find((s) => s.key === '3');
  if (acadWorld) {
    const acadLocal = worldToUnscaledLocal(acadWorld[0], acadWorld[1], centerWorldX, centerWorldZ, yaw);
    const acadEdge = pickFacingEdge(acadLocal, halfW, halfD);
    if (acadEdge.score < 32) {
      frontSide = acadEdge.side;
    } else if (stop3) {
      const stop3Local = worldToUnscaledLocal(stop3.position[0], stop3.position[2], centerWorldX, centerWorldZ, yaw);
      frontSide = pickFacingEdge(stop3Local, halfW, halfD).side;
    }
  } else if (stop3) {
    const stop3Local = worldToUnscaledLocal(stop3.position[0], stop3.position[2], centerWorldX, centerWorldZ, yaw);
    frontSide = pickFacingEdge(stop3Local, halfW, halfD).side;
  }

  // Never let openShelterSide equal frontSide
  if (openShelterSide === frontSide) openShelterSide = null;

  return { centerWorldX, centerWorldZ, yaw, halfW, halfD, frontSide, openShelterSide };
}

export function buildGroundEnclosure(parent, kit, context = {}) {
  const assets = getFenceAssets(kit);
  const bounds = computeGroundEnclosureBounds(kit, context);
  const { centerWorldX, centerWorldZ, yaw, halfW, halfD, frontSide, openShelterSide } = bounds;
  const root = kit.prop(parent, 'ground-fence', 'Central ground fence and seating', centerWorldX, centerWorldZ, yaw);
  const { entranceWidth, seatingCurbHeight, seatingCurbDepth, frontFenceHeight, courtFenceHeight } = GROUND_FENCE_SPECS;

  // Canonical edge descriptors in root local XZ space: start, end, outward unit normal, inner normal sign
  const edges = {
    '+X': { start: [halfW, -halfD], end: [halfW, halfD], outward: [1, 0], span: halfD * 2 },
    '-X': { start: [-halfW, halfD], end: [-halfW, -halfD], outward: [-1, 0], span: halfD * 2 },
    '+Z': { start: [halfW, halfD], end: [-halfW, halfD], outward: [0, 1], span: halfW * 2 },
    '-Z': { start: [-halfW, -halfD], end: [halfW, -halfD], outward: [0, -1], span: halfW * 2 }
  };

  const oppositeSide = { '+X': '-X', '-X': '+X', '+Z': '-Z', '-Z': '+Z' };

  for (const [side, edge] of Object.entries(edges)) {
    if (side === openShelterSide) continue;
    const { start, end, outward, span } = edge;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const ux = dx / span;
    const uz = dz / span;

    if (side === frontSide) {
      // Academic/walkway-facing edge: clean pale raised sitting curb + chain-link mesh + open 3.6 m Ground Entrance Path
      const gateHalf = Math.min(entranceWidth / 2, span * 0.24);
      const gateCenterT = span * 0.5;
      const t1 = Math.max(0.6, gateCenterT - gateHalf);
      const t2 = Math.min(span - 0.6, gateCenterT + gateHalf);

      const pMid = [start[0] + ux * gateCenterT, start[1] + uz * gateCenterT];
      const pGate1 = [start[0] + ux * t1, start[1] + uz * t1];
      const pGate2 = [start[0] + ux * t2, start[1] + uz * t2];

      // Paved entrance apron stepping cleanly onto the ground (zero collider across opening)
      const entryAngle = Math.atan2(-dz, dx);
      const entry = groupAt(root, 'Ground entrance path', [pMid[0] + outward[0] * 0.25, 0, pMid[1] + outward[1] * 0.25], entryAngle);
      box(entry, assets.entryApron, [t2 - t1 + 0.3, 0.032, 1.8], [0, 0.016, 0]).castShadow = false;

      // Blue-painted steel entrance gate posts flanking the open walkway (matching campus photo)
      for (const gp of [pGate1, pGate2]) {
        cylinder(root, assets.gateBlue, 0.048, frontFenceHeight + 0.36, [gp[0], (frontFenceHeight + 0.36) / 2, gp[1]]);
        addLocalCollider(kit.colliders, root, gp[0], gp[1], 0.14, 0.14, true, frontFenceHeight + 0.36, 0);
      }

      // Open chain-link gate leaf swung neatly inward beside post 1 (never blocking the entrance)
      const leafLen = Math.min(1.35, (t2 - t1) * 0.42);
      const leafEnd = [pGate1[0] - outward[0] * leafLen, pGate1[1] - outward[1] * leafLen];
      addMeshFenceRun(root, assets, kit.colliders, pGate1, leafEnd, 0.08, frontFenceHeight * 0.85, { postPitch: 1.5, addCollider: false });

      // Sitting curb sits outward by curbDepth/2 so fence stands cleanly along its inner edge while leaving flat cap clear to sit on
      const curbOffX = outward[0] * (seatingCurbDepth / 2 + 0.04);
      const curbOffZ = outward[1] * (seatingCurbDepth / 2 + 0.04);
      // Compute sign of inner direction in curb-local Z: curb local +Z points along [-uz, ux]
      const curbLocalZDotOutward = -uz * outward[0] + ux * outward[1];
      const innerSign = curbLocalZDotOutward >= 0 ? -1 : 1;

      const courtInv = context.courtSite ? new THREE.Matrix4().copy(context.courtSite.matrixWorld).invert() : null;
      const pointOnCourt = (lx, lz) => {
        if (!courtInv || !context.courtHalfW || !context.courtHalfD) return false;
        const [wx, wz] = unscaledLocalToWorld(lx, lz, centerWorldX, centerWorldZ, yaw);
        const pt = new THREE.Vector3(wx, 0, wz).applyMatrix4(courtInv);
        return Math.abs(pt.x) < context.courtHalfW + 0.45 && Math.abs(pt.z) < context.courtHalfD + 0.45;
      };

      for (const [idx, [a, b]] of [[start, pGate1], [pGate2, end]].entries()) {
        const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (segLen < 0.7) continue;
        const midInnerX = (a[0] + b[0]) / 2 - outward[0] * 0.65;
        const midInnerZ = (a[1] + b[1]) / 2 - outward[1] * 0.65;
        addCleanSeatingCurb(root, assets, kit.colliders,
          [a[0] + curbOffX, a[1] + curbOffZ], [b[0] + curbOffX, b[1] + curbOffZ], innerSign, 910 + idx * 73,
          { allowSaplings: !pointOnCourt(midInnerX, midInnerZ) });
        addMeshFenceRun(root, assets, kit.colliders, a, b, seatingCurbHeight * 0.75, frontFenceHeight);
      }
    } else {
      // Remaining enclosed court sides: tall galvanized diamond chain-link ball-stop mesh hugging the outer perimeter
      addMeshFenceRun(root, assets, kit.colliders, start, end, 0, courtFenceHeight);
      // Add neat small terracotta potted plants along the walkway side adjacent to the front (matching real photo)
      if (side !== oppositeSide[frontSide]) {
        addPottedPlantsRow(root, assets, start, end, outward, 1207 + side.charCodeAt(1) * 31);
      }
    }
  }

  return root;
}

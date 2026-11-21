import * as THREE from 'three';
import { addLocalCollider, standard } from './buildingFactory.js';
import { box, canvasTexture, groupAt, rod } from './sceneKit.js';

const railHeight = 0.94;
const landingDepth = 1.43;
const treadDepth = 0.263;
let steel;

function stairRail(group, material, x, start, end) {
  const [y, z] = start;
  const [topY, topZ] = end;
  const lowerRail = 0.16;
  rod(group, material, [x, y + railHeight, z], [x, topY + railHeight, topZ], 0.031);
  rod(group, material, [x, y + lowerRail, z], [x, topY + lowerRail, topZ], 0.021);
  const bays = Math.max(1, Math.round(Math.abs(topZ - z) / 0.48));
  for (let bay = 0; bay <= bays; bay++) {
    const py = THREE.MathUtils.lerp(y, topY, bay / bays);
    const pz = THREE.MathUtils.lerp(z, topZ, bay / bays);
    rod(group, material, [x, py, pz], [x, py + railHeight, pz], 0.023);
    if (bay === bays) continue;
    const qy = THREE.MathUtils.lerp(y, topY, (bay + 1) / bays);
    const qz = THREE.MathUtils.lerp(z, topZ, (bay + 1) / bays);
    rod(group, material, [x, py + lowerRail, pz], [x, qy + railHeight - 0.065, qz], 0.012);
    rod(group, material, [x, py + railHeight - 0.065, pz], [x, qy + lowerRail, qz], 0.012);
  }
}

function steelMaterials() {
  const map = canvasTexture(128, 64, (ctx, w, h) => {
    ctx.fillStyle = '#69594d';
    ctx.fillRect(0, 0, w, h);
    for (let row = 0; row < 8; row++) {
      for (let column = 0; column < 12; column++) {
        ctx.save();
        ctx.translate((column + 0.5) * w / 12, (row + 0.5) * h / 8);
        ctx.rotate((row + column) % 2 ? 0.65 : -0.65);
        ctx.fillStyle = '#4b3f35';
        ctx.fillRect(-3.5, -0.6, 7, 2.4);
        ctx.fillStyle = '#9b8f82';
        ctx.fillRect(-3.5, -1.1, 6, 0.9);
        ctx.restore();
      }
    }
  });
  map.wrapS = THREE.RepeatWrapping;
  map.repeat.x = 4;
  return {
    metal: standard('#393532', { metalness: 0.48, roughness: 0.69 }),
    treads: standard('#ffffff', { map, metalness: 0.34, roughness: 0.71 }),
    nosing: standard('#a69a89', { metalness: 0.43 })
  };
}

export function buildAcademicStairs(kit, {
  root, width, depth, endWidth, lowerDepth, lowerRoofY, upperLandingY, roofOverhang,
  trimOverhang = Math.max(roofOverhang, 0.2), opensToUpperRoof, sideApproach
}) {
  const stairWidth = Math.min(1.91, lowerDepth - 0.18);
  if (stairWidth < 0.8) return;
  const { metal, treads, nosing } = steel ??= steelMaterials();
  const halfWidth = stairWidth / 2;
  const stairs = groupAt(root, 'Academic wing exterior stairs', [0, 0, 0]);
  const rearRoofEdge = -depth / 2 - roofOverhang;
  const lowerSteps = Math.ceil(lowerRoofY / 0.18);
  const lowerRun = lowerSteps * treadDepth;

  // The surveyed placement has a narrow passage behind the wing. Run the flight along it.
  const cornerX = -width / 2 + 0.65;
  const lowerFoot = sideApproach
    ? [cornerX + landingDepth + lowerRun, 0, rearRoofEdge - halfWidth]
    : [-width / 2 + halfWidth + 0.1, 0, rearRoofEdge - landingDepth - lowerRun];
  const lower = flight('Ground-to-lower-roof flight', lowerFoot, sideApproach ? Math.PI / 2 : Math.PI,
    lowerRoofY, lowerRun, lowerSteps);
  box(lower, kit.materials.concrete, [stairWidth + 0.16, 0.1, 0.65], [0, 0.05, 0.33]);
  landing(lower, 'Lower roof landing', lowerRoofY, lowerRun, sideApproach ? -1 : 0, sideApproach);

  const upperRise = upperLandingY - lowerRoofY;
  const upperSteps = Math.ceil(upperRise / 0.18);
  const upperRun = Math.min(upperSteps * treadDepth, width - endWidth - landingDepth - 0.8);
  if (upperRun <= 0) return;
  const innerCornerX = width / 2 - endWidth;
  // Offset the upper flight left of the frontage wall so treads, stringer, and rail clear the roof trim.
  const upperWallOffset = Math.min(
    Math.max(roofOverhang, trimOverhang) + 0.16,
    Math.max(roofOverhang, lowerDepth - stairWidth)
  );
  const upperZ = lowerDepth - depth / 2 - upperWallOffset - halfWidth;
  const upper = flight('Lower-roof-to-upper-landing flight',
    [innerCornerX - landingDepth - upperRun, lowerRoofY, upperZ], -Math.PI / 2, upperRise, upperRun, upperSteps);
  const landingBridge = opensToUpperRoof ? Math.max(0, upperWallOffset - roofOverhang) : 0;
  landing(upper, 'Upper roof landing', upperRise, upperRun, opensToUpperRoof ? 1 : 0, false, landingBridge);

  function flight(name, foot, yaw, height, run, steps) {
    const group = groupAt(stairs, name, foot, yaw);
    const rise = height / steps;
    const stride = run / steps;
    for (let index = 0; index < steps; index++) {
      const z = -(index + 0.5) * stride;
      const y = (index + 1) * rise;
      box(group, treads, [stairWidth, rise, stride], [0, y - rise / 2, z]);
      box(group, nosing, [stairWidth, 0.023, 0.041], [0, y - 0.012, z + stride / 2 - 0.005]);
    }
    for (const x of [-halfWidth, halfWidth]) {
      rod(group, metal, [x, 0, 0], [x, height - 0.14, -run], 0.073);
      stairRail(group, metal, x, [0, 0], [height, -run]);
    }
    // Follow the slope in four short collision rectangles.
    const segmentLength = run / 4;
    for (let index = 0; index < 4; index++) {
      const top = height * (index + 1) / 4 + railHeight;
      addLocalCollider(kit.colliders, group, 0, -(index + 0.5) * segmentLength, stairWidth, segmentLength, true, top);
    }
    return group;
  }

  function landing(group, name, height, run, openSide, endGuard, bridge = 0) {
    const deck = groupAt(group, name, [0, height, -run - landingDepth / 2]);
    const deckWidth = stairWidth + bridge;
    const deckX = openSide * bridge / 2;
    box(deck, treads, [deckWidth, 0.145, landingDepth], [deckX, -0.0725, 0]);
    for (const side of [-1, 1]) {
      const x = side * halfWidth;
      if (side !== openSide) stairRail(deck, metal, x, [0, landingDepth / 2], [0, -landingDepth / 2]);
      rod(deck, metal, [x, -height, -landingDepth / 2], [x, -0.1, -landingDepth / 2], 0.057);
    }
    if (endGuard) {
      const edge = groupAt(deck, 'Landing end rail', [0, 0, -landingDepth / 2], Math.PI / 2);
      stairRail(edge, metal, 0, [0, halfWidth], [0, -halfWidth]);
    }
    addLocalCollider(kit.colliders, deck, deckX, 0, deckWidth, landingDepth, true, railHeight);
  }
}
